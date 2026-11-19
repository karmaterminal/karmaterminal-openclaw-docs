/**
 * token-budget-runner-fixture.mjs — fire a row matrix through the real
 * run-proofs.sh with a token budget and a fake usage source.
 *
 * The budget is enforced at the row-list runner, so this drives that boundary
 * with no live seat and no model: a committed throwaway harness checkout (#496),
 * one local server that is both the readiness gateway and the usage source
 * (sessions.list + sessions.usage.timeseries answered from a test-supplied
 * plan), and a k6 stub. The k6 stub leaves markers per scenario —
 * <scenario>.started, .finished, and .terminated when it is stopped — so a test
 * can tell a row that ran from one that was stopped or never dispatched. A
 * per-scenario action lets a row break the run's own machinery as it starts:
 * kill-meter (SIGKILL the meter), stop-meter (SIGSTOP it, so it goes stale),
 * term-runner (SIGTERM run-proofs.sh) or ignore-term (the k6 stub ignores
 * SIGTERM, as a k6 stuck in teardown would). The k6 stub's parent is the runner, and
 * the meter is the only process started with `--parent-pid <runner pid>`, so
 * the action never reaches another test's processes.
 * Everything else (the meter, the ledger, extraction, redaction, run-result) is
 * the real harness code.
 */
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { buildHarnessCheckout } from './harness-checkout.mjs';
import { attachReadinessGateway } from './readiness-gateway.mjs';

const run = promisify(execFile);

export const BUDGET_CANDIDATE_SHA = 'b'.repeat(40);
export const BUDGET_SEAT = 'cael-dgx';
export const BUDGET_CONFIGURED_SESSION = 'agent:main:token-budget-fixture';
const TOKEN = 'token-budget-runner-fixture-token';

/** Three plain WebSocket rows with no trace collection: fast, and enough to see before/during/after. */
export const BUDGET_ROWS = Object.freeze([
  Object.freeze({ row: 'PREFLIGHT', scenario: 'preflight.js' }),
  Object.freeze({ row: 'R-CONFIG-DEFAULTS', scenario: 'r-config-defaults.js' }),
  Object.freeze({ row: 'R-CONFIG-INTERSESSION', scenario: 'r-config-intersession.js' }),
]);

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
 * @param {string|null} [options.budget] OPENCLAW_PROOFS_TOKEN_BUDGET, or null for none
 * @param {Record<string, number>} [options.sleepSeconds] per-scenario k6 stub run time
 * @param {(ctx: {markers: string, started: (scenario: string) => boolean}) => object} options.usage
 *   gateway methods for the usage source, given access to the k6 markers
 * @param {Record<string, 'kill-meter'|'stop-meter'|'term-runner'|'ignore-term'>} [options.actions] per-scenario k6 stub action
 * @param {string} [options.rows] the row list argument (default: the three BUDGET_ROWS)
 * @param {string|null} [options.staleReceipt] content of a token-budget-receipt.json left in the out dir beforehand
 * @param {boolean} [options.dryRun]
 * @param {string[]} [options.extraArgs] extra run-proofs.sh arguments
 */
export async function runBudgetMatrix(repoRoot, {
  budget = null,
  sleepSeconds = {},
  actions = {},
  rows: rowList = null,
  staleReceipt = null,
  usage = () => ({}),
  dryRun = false,
  extraArgs = [],
  env: extraEnv = {},
} = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'token-budget-runner-'));
  const bin = path.join(root, 'bin');
  const out = path.join(root, 'out');
  const markers = path.join(root, 'markers');
  await Promise.all([bin, out, markers].map((dir) => mkdir(dir, { recursive: true })));
  const harness = await buildHarnessCheckout(repoRoot, path.join(root, 'harness'));
  for (const [scenario, seconds] of Object.entries(sleepSeconds)) {
    await writeFile(path.join(markers, `${scenario}.sleep`), `${seconds}\n`);
  }
  for (const [scenario, action] of Object.entries(actions)) {
    await writeFile(path.join(markers, `${scenario}.action`), `${action}\n`);
  }
  if (staleReceipt !== null) await writeFile(path.join(out, 'token-budget-receipt.json'), staleReceipt);

  const started = (scenario) => existsSync(path.join(markers, `${scenario}.started`));
  const server = createServer((request, response) => response.writeHead(404).end());
  const sockets = new Set();
  server.on('upgrade', (request, socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const gateway = attachReadinessGateway(server, {
    token: TOKEN,
    runtimeSha: BUDGET_CANDIDATE_SHA,
    methods: usage({ markers, started }),
  });
  const wsUrl = `ws://127.0.0.1:${server.address().port}`;

  try {
    const rowByScenario = Object.fromEntries(BUDGET_ROWS.map(({ row, scenario }) => [scenario, row]));
    await writeExecutable(path.join(bin, 'k6'), [
      '#!/bin/sh',
      'if [ "${1:-}" = version ]; then printf \'%s\\n\' \'k6 v2.0.0\'; exit 0; fi',
      'scenario="$(basename "${2:-unknown}")"',
      `markers=${shellQuote(markers)}`,
      ': > "$markers/$scenario.started"',
      'printf \'%s\\n\' "$PPID" > "$markers/runner.pid"',
      'case "$(cat "$markers/$scenario.action" 2>/dev/null)" in',
      '  kill-meter) pkill -KILL -f -- "--parent-pid $PPID\\$" ;;',
      '  stop-meter) pkill -STOP -f -- "--parent-pid $PPID\\$" ;;',
      '  term-runner) kill -TERM "$PPID" ;;',
      'esac',
      'seconds="$(cat "$markers/$scenario.sleep" 2>/dev/null || echo 0)"',
      'sleep "$seconds" &',
      'sleeper=$!',
      'if [ "$(cat "$markers/$scenario.action" 2>/dev/null)" = ignore-term ]; then',
      '  trap \': > "$markers/$scenario.term-ignored"\' TERM',
      'else',
      '  trap \'kill "$sleeper" 2>/dev/null; : > "$markers/$scenario.terminated"; exit 143\' TERM',
      'fi',
      // A trapped signal ends `wait` even when the trap ignores it, so wait until the sleep is gone.
      'while kill -0 "$sleeper" 2>/dev/null; do wait "$sleeper"; done',
      'case "$scenario" in',
      ...Object.entries(rowByScenario).map(([scenario, row]) => `  ${shellQuote(scenario)}) row=${shellQuote(row)} ;;`),
      '  *) row=UNKNOWN ;;',
      'esac',
      ': > "$markers/$scenario.finished"',
      'printf \'=== K6-PROOF-EVIDENCE === {"row":"%s"}\\n[%s] VERDICT: PASS-candidate\\n\' "$row" "$row"',
      '',
    ].join('\n'));
    await writeExecutable(path.join(bin, 'openclaw'), '#!/bin/sh\nprintf \'%s\\n\' \'{"enabled":true,"maxChainLength":3,"maxDelegatesPerTurn":3,"costCapTokens":3}\'\n');
    await writeExecutable(path.join(bin, 'hostname'), `#!/bin/sh\nprintf '%s\\n' ${BUDGET_SEAT}\n`);
    await writeExecutable(path.join(bin, 'journalctl'), '#!/bin/sh\ncase " $* " in *" --show-cursor "*) printf \'%s\\n\' \'-- cursor: token-budget-fixture\' ;; esac\n');

    const env = { ...process.env };
    for (const name of Object.keys(env)) {
      if (name.startsWith('OPENCLAW_')) delete env[name];
    }
    Object.assign(env, {
      PATH: `${bin}:${process.env.PATH}`,
      K6_BIN: path.join(bin, 'k6'),
      OPENCLAW_GATEWAY_TOKEN: TOKEN,
      OPENCLAW_GATEWAY_WS: wsUrl,
      OPENCLAW_PROOFS_TEMPO_BASE_URL: wsUrl.replace(/^ws/, 'http'),
      OPENCLAW_CANDIDATE_SHA: BUDGET_CANDIDATE_SHA,
      OPENCLAW_RUNTIME_BUILD_SHA: BUDGET_CANDIDATE_SHA,
      OPENCLAW_RUNTIME_SHA: BUDGET_CANDIDATE_SHA,
      OPENCLAW_GATEWAY_UNIT: 'openclaw-token-budget-fixture.service',
      OPENCLAW_REQUIRED_MAX_SPAWN_DEPTH: '2',
      OPENCLAW_EXPECTED_MAX_SPAWN_DEPTH: '5',
      OPENCLAW_SESSION_KEY: BUDGET_CONFIGURED_SESSION,
      OPENCLAW_SEAT_NAME: BUDGET_SEAT,
      OPENCLAW_PROOFS_TOKEN_BUDGET_POLL_SECONDS: '0.2',
      OPENCLAW_PROOFS_TOKEN_BUDGET_READ_TIMEOUT_SECONDS: '2',
      ...extraEnv,
    });
    if (budget !== null) env.OPENCLAW_PROOFS_TOKEN_BUDGET = budget;
    const rows = rowList ?? BUDGET_ROWS.map(({ row }) => row).join(',');
    const args = ['scripts/run-proofs.sh', dryRun ? '--dry-run' : '--live', '--docs-ref', harness.docsRef, '--out-dir', out, ...extraArgs, rows, BUDGET_CANDIDATE_SHA];
    const startedAt = Date.now();
    let result;
    try {
      const { stdout, stderr } = await run('bash', args, {
        cwd: path.join(harness.checkout, 'tools/k6-proofs'),
        env,
        timeout: 120_000,
        maxBuffer: 16 * 1024 * 1024,
      });
      result = { code: 0, stdout, stderr };
    } catch (error) {
      if (typeof error.code !== 'number') throw error;
      result = { code: error.code, stdout: error.stdout, stderr: error.stderr };
    }
    result.elapsedMs = Date.now() - startedAt;

    const runDirs = {};
    for (const { row } of BUDGET_ROWS) {
      const base = path.join(out, BUDGET_CANDIDATE_SHA, row, BUDGET_SEAT);
      const ids = await readdir(base).catch(() => []);
      runDirs[row] = ids.length === 1 ? path.join(base, ids[0]) : (ids.length === 0 ? null : ids.map((id) => path.join(base, id)));
    }
    const marker = (scenario, kind) => existsSync(path.join(markers, `${scenario}.${kind}`));
    const k6 = Object.fromEntries(BUDGET_ROWS.map(({ row, scenario }) => [row, {
      started: marker(scenario, 'started'),
      finished: marker(scenario, 'finished'),
      terminated: marker(scenario, 'terminated'),
      ...(marker(scenario, 'term-ignored') ? { termIgnored: true } : {}),
    }]));
    const receiptPath = path.join(out, 'token-budget-receipt.json');
    const receipt = existsSync(receiptPath) ? JSON.parse(await readFile(receiptPath, 'utf8')) : null;
    const usageCalls = gateway.calls.filter((call) => call.method.startsWith('sessions.'));
    const runnerPidFile = path.join(markers, 'runner.pid');
    const runnerPid = existsSync(runnerPidFile) ? Number((await readFile(runnerPidFile, 'utf8')).trim()) : null;
    let metersLeft = null;
    if (runnerPid) {
      metersLeft = await run('pgrep', ['-f', '--', `--parent-pid ${runnerPid}$`]).then(
        ({ stdout }) => stdout.trim().split('\n').filter(Boolean).length,
        (error) => (error.code === 1 ? 0 : null),
      );
      // A stopped meter (stop-meter) must not outlive the test either way.
      await run('pkill', ['-KILL', '-f', '--', `--parent-pid ${runnerPid}$`]).catch(() => {});
    }
    return {
      root,
      out,
      result,
      receipt,
      receiptText: receipt ? await readFile(receiptPath, 'utf8') : null,
      runDirs,
      k6,
      usageCalls,
      runnerPid,
      metersLeft,
      connects: gateway.connects,
      readJson: async (file) => JSON.parse(await readFile(file, 'utf8')),
      cleanup: () => rm(root, { recursive: true, force: true }),
    };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  }
}

/** sessions.list rows for the configured session plus, once `when()` holds, one k6 disposable session. */
export function disposableSessionListing(when) {
  return () => ({
    ok: true,
    payload: {
      sessions: [
        { key: BUDGET_CONFIGURED_SESSION, sessionId: 'configured' },
        ...(when() ? [{ key: 'agent:main:r-config-defaults-fixture', sessionId: 'disposable', label: 'k6 R-CONFIG-DEFAULTS fixture' }] : []),
      ],
      hasMore: false,
      nextOffset: null,
    },
  });
}

/** A sessions.usage.timeseries answer with one point of `tokens`. */
export function usagePoint(sessionId, tokens) {
  return {
    ok: true,
    payload: { sessionId, points: [{ timestamp: 1, input: tokens, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: tokens, cost: 0 }] },
  };
}
