/**
 * row-runner-fixture.mjs — fire one row through the real row-list runner.
 *
 * run-proofs.sh is the composition boundary that turns k6 evidence into
 * run-result.json and, only for a review-complete run, candidate-run-result.json.
 * This helper drives that boundary with no live seat: a committed throwaway
 * harness checkout (#496), a k6 stub that replays fixed evidence and a VU
 * verdict, and one local HTTP server that answers both the readiness gateway
 * WebSocket and the Tempo API. Everything downstream of k6 (extraction, trace
 * collection, redaction, the envelope writer) is the real harness code.
 */
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { buildHarnessCheckout } from './harness-checkout.mjs';
import { attachReadinessGateway } from './readiness-gateway.mjs';

const run = promisify(execFile);

export const RUNNER_CANDIDATE_SHA = 'a'.repeat(40);
const TOKEN = 'row-runner-fixture-token';
const SEAT = 'cael-dgx';

async function writeExecutable(file, source) {
  await writeFile(file, source, { mode: 0o755 });
  await chmod(file, 0o755);
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

/**
 * @param {string} repoRoot repository whose tools/k6-proofs is under test
 * @param {object} options
 * @param {string} options.rowId row to fire
 * @param {object} options.evidence evidence record the k6 stub prints
 * @param {string} [options.vuVerdict] VU-emitted VERDICT line value
 * @param {(url: URL, response: import('node:http').ServerResponse) => void} options.tempo
 *   Tempo API handler for /api/search and /api/traces/<id>
 */
export async function runRowThroughRunner(repoRoot, { rowId, evidence, vuVerdict = 'PASS-candidate', tempo }) {
  const root = await mkdtemp(path.join(tmpdir(), 'row-runner-fixture-'));
  const bin = path.join(root, 'bin');
  const out = path.join(root, 'out');
  await Promise.all([mkdir(bin, { recursive: true }), mkdir(out, { recursive: true })]);
  const harness = await buildHarnessCheckout(repoRoot, path.join(root, 'harness'));
  const k6Output = path.join(root, 'k6-output.txt');
  await writeFile(
    k6Output,
    `=== K6-PROOF-EVIDENCE === ${JSON.stringify(evidence)}\n[${rowId}] VERDICT: ${vuVerdict}\n`,
  );

  const tempoRequests = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname.startsWith('/health') || url.pathname.startsWith('/status')) {
      response.writeHead(200).end('{}');
      return;
    }
    tempoRequests.push(url.pathname);
    tempo(url, response);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  attachReadinessGateway(server, { token: TOKEN, runtimeSha: RUNNER_CANDIDATE_SHA });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    await writeExecutable(path.join(bin, 'openclaw'), '#!/bin/sh\nprintf \'%s\\n\' \'{"enabled":true,"maxChainLength":3,"maxDelegatesPerTurn":3,"costCapTokens":3}\'\n');
    await writeExecutable(path.join(bin, 'hostname'), `#!/bin/sh\nprintf '%s\\n' ${SEAT}\n`);
    await writeExecutable(path.join(bin, 'journalctl'), '#!/bin/sh\ncase " $* " in *" --show-cursor "*) printf \'%s\\n\' \'-- cursor: row-runner-fixture\' ;; esac\n');
    await writeExecutable(path.join(bin, 'k6'), `#!/bin/sh\nif [ "\${1:-}" = version ]; then printf '%s\\n' 'k6 v2.0.0'; exit 0; fi\ncat ${shellQuote(k6Output)}\n`);
    const env = { ...process.env };
    // An ambient isolated-gateway service name would make the collector query a
    // different service than the fixture's seat convention.
    delete env.OPENCLAW_PROOFS_SERVICE_NAME;
    delete env.OPENCLAW_PROOFS_K6_TEMPO_REQUIRED;
    Object.assign(env, {
      PATH: `${bin}:${process.env.PATH}`,
      K6_BIN: path.join(bin, 'k6'),
      OPENCLAW_GATEWAY_TOKEN: TOKEN,
      OPENCLAW_GATEWAY_WS: baseUrl.replace(/^http/, 'ws'),
      OPENCLAW_PROOFS_TEMPO_BASE_URL: baseUrl,
      OPENCLAW_CANDIDATE_SHA: RUNNER_CANDIDATE_SHA,
      OPENCLAW_RUNTIME_BUILD_SHA: RUNNER_CANDIDATE_SHA,
      OPENCLAW_RUNTIME_SHA: RUNNER_CANDIDATE_SHA,
      OPENCLAW_GATEWAY_UNIT: 'openclaw-row-runner-fixture.service',
      OPENCLAW_REQUIRED_MAX_SPAWN_DEPTH: '2',
      OPENCLAW_EXPECTED_MAX_SPAWN_DEPTH: '5',
      OPENCLAW_SESSION_KEY: 'agent:main:row-runner-fixture',
      OPENCLAW_SEAT_NAME: SEAT,
    });
    let result;
    try {
      const { stdout, stderr } = await run(
        'bash',
        ['scripts/run-proofs.sh', '--live', '--docs-ref', harness.docsRef, '--out-dir', out, rowId, RUNNER_CANDIDATE_SHA],
        { cwd: path.join(harness.checkout, 'tools/k6-proofs'), env, timeout: 90_000, maxBuffer: 16 * 1024 * 1024 },
      );
      result = { code: 0, stdout, stderr };
    } catch (error) {
      if (typeof error.code !== 'number') throw error;
      result = { code: error.code, stdout: error.stdout, stderr: error.stderr };
    }
    const runBase = path.join(out, RUNNER_CANDIDATE_SHA, rowId, SEAT);
    const runIds = await readdir(runBase).catch(() => []);
    if (runIds.length !== 1) {
      throw new Error(`expected one ${rowId} run directory, found ${runIds.length}\n${result.stdout}\n${result.stderr}`);
    }
    const runDir = path.join(runBase, runIds[0]);
    const readJson = async (name) => JSON.parse(await readFile(path.join(runDir, name), 'utf8'));
    const readOptionalJson = (name) => readJson(name).catch((error) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    return {
      root,
      runDir,
      result,
      tempoRequests,
      files: await readdir(runDir),
      runResult: await readJson('run-result.json'),
      envelope: await readOptionalJson('candidate-run-result.json'),
      cleanup: () => rm(root, { recursive: true, force: true }),
    };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
