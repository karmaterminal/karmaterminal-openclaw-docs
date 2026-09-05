import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, readdir, rm, writeFile, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { signedSeatReadinessFixture } from './helpers/seat-readiness-fixture.mjs';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const script = join(repoRoot, 'tools/k6-proofs/scripts/seat-readiness-preflight.mjs');
const policy = join(repoRoot, 'tools/k6-proofs/seat-readiness.policy.json');
const schema = join(repoRoot, 'tools/k6-proofs/seat-readiness.schema.json');
const workflow = join(repoRoot, '.github/workflows/k6-proof.yml');
const project81Workflow = join(repoRoot, '.github/workflows/project81-k6-proof.yml');
const runner = join(repoRoot, 'tools/k6-proofs/scripts/run-proofs.sh');

async function withTmp(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'p81-seat-readiness-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runPreflight(args, env) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

test('seat readiness policy keeps the k6 proof-standard version in one place', async () => {
  const parsed = JSON.parse(await readFile(policy, 'utf8'));
  assert.equal(parsed.schema, 'openclaw.k6.seat-readiness-policy.v1');
  assert.equal(parsed.k6.expectedVersion, 'v2.0.0');
  assert.ok(parsed.env.some((entry) => entry.name === 'OPENCLAW_GATEWAY_TOKEN' && entry.secret === true));
  assert.ok(parsed.env.some((entry) => entry.name === 'OPENCLAW_CANDIDATE_SHA' && entry.required === true));
  assert.ok(parsed.env.some((entry) => entry.name === 'OPENCLAW_GATEWAY_RESTART_CMD' && entry.required === false));
  assert.ok(parsed.env.some((entry) => entry.name === 'OPENCLAW_K6_COST_CAP_TEST_VALUE' && entry.required === false));
});

test('offline readiness remains public-safe and cannot become a pass receipt', async () => {
  await withTmp(async (dir) => {
    const fakeK6 = join(dir, 'k6');
    await writeFile(fakeK6, '#!/bin/sh\necho "k6 v2.0.0 (commit/test)"\n');
    await chmod(fakeK6, 0o755);

    const token = 'CANARY-TOKEN-VALUE-DO-NOT-PRINT';
    const candidateSha = '2723dbee783c113cae70e4fb63a4cff9f55402e3';
    const run = runPreflight(['--json', '--no-gateway', '--expected-k6-version', 'v2.0.0'], {
      K6_BIN: fakeK6,
      OPENCLAW_GATEWAY_TOKEN: token,
      OPENCLAW_CANDIDATE_SHA: candidateSha,
      OPENCLAW_RUNTIME_SHA: candidateSha,
      OPENCLAW_DOCS_SHA: 'd9fd19c6d3b587d36764d0184143b43885762ee1',
      OPENCLAW_SEAT_NAME: 'unit-seat',
      OPENCLAW_GATEWAY_UNIT: 'unit-gateway.service',
      OPENCLAW_SELECTED_ROWS: 'R-UNIT-SEAT-READINESS',
      OPENCLAW_REQUIRED_MAX_SPAWN_DEPTH: '2',
      OPENCLAW_EXPECTED_MAX_SPAWN_DEPTH: '5',
      OPENCLAW_SESSION_KEY: 'agent:main:discord:channel:test',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:18789',
    });

    assert.equal(run.status, 2, run.stderr || run.stdout);
    assert.doesNotMatch(run.stdout, new RegExp(token));
    const report = JSON.parse(run.stdout);
    assert.equal(report.schema, 'openclaw.k6.seat-readiness.v2');
    assert.equal(report.outcome, 'PARTIAL-candidate');
    assert.equal(report.policy.name, 'k6 PROOFS seat readiness policy');
    assert.equal(report.k6.command, 'k6');
    assert.doesNotMatch(JSON.stringify(report.k6), new RegExp(dir));
    assert.equal(report.k6.version, 'v2.0.0');
    assert.equal(report.gateway.mode, 'skipped-by-flag');
    assert.equal(report.target.authentication.authenticated, false);
    assert.equal(report.integrity.signature, null);
    const tokenEnv = report.env.find((entry) => entry.name === 'OPENCLAW_GATEWAY_TOKEN');
    assert.deepEqual(
      { present: tokenEnv.present, secret: tokenEnv.secret, value: tokenEnv.value },
      { present: true, secret: true, value: undefined },
    );
    assert.equal(report.session.scope, 'main-agent-session');
  });
});

test('seat readiness schema tracks policy, continuation readiness, checked k6 candidates, and env purposes', async () => {
  const parsed = JSON.parse(await readFile(schema, 'utf8'));
  assert.ok(parsed.required.includes('policy'));
  assert.ok(parsed.required.includes('target'));
  assert.ok(parsed.required.includes('bindings'));
  assert.ok(parsed.required.includes('bindingDigest'));
  assert.ok(parsed.required.includes('integrity'));
  assert.ok(parsed.properties.target.required.includes('configuredMaxSpawnDepth'));
  assert.ok(parsed.properties.target.required.includes('effectiveMaxSpawnDepth'));
});

test('workflow and matrix runner cannot fall through failed readiness or ambient host config', async () => {
  const [workflowSource, project81Source, runnerSource] = await Promise.all([
    readFile(workflow, 'utf8'),
    readFile(project81Workflow, 'utf8'),
    readFile(runner, 'utf8'),
  ]);
  const readiness = workflowSource.indexOf('- name: Seat readiness preflight');
  assert.ok(readiness >= 0);
  const downstream = workflowSource.slice(readiness);
  for (const step of ['Run k6 scenario', 'Write evidence artifacts', 'Upload run log (dry_run)', 'Upload proof artifacts']) {
    const start = downstream.indexOf(`- name: ${step}`);
    assert.ok(start >= 0, `missing workflow step ${step}`);
    const next = downstream.indexOf('\n      - name:', start + 1);
    const section = downstream.slice(start, next < 0 ? undefined : next);
    assert.match(section, /if:.*steps\.readiness\.outputs\.ready == 'true'/u);
  }
  assert.doesNotMatch(downstream, /expanduser\("~\/\.openclaw/u);
  assert.match(project81Source, /id: target_readiness/u);
  assert.match(project81Source, /steps\.target_readiness\.outputs\.ready == 'true'/u);
  assert.doesNotMatch(project81Source, /~\/\.openclaw|openclaw\.json/u);
  assert.doesNotMatch(runnerSource, /~\/\.openclaw\/openclaw\.json/u);
  assert.match(runnerSource, /verify-seat-readiness\.mjs/u);
});

test('evidence writer copies supplied seat-readiness report into candidate artifacts', async () => {
  await withTmp(async (dir) => {
    const k6Output = join(dir, 'run.txt');
    const readiness = join(dir, 'seat-readiness.json');
    const nonce = 'R-CD-1-1783882863334-writer';
    const sessionKey = `agent:main:r-cd-1-${nonce}`;
    await writeFile(k6Output, `=== K6-PROOF-EVIDENCE ===\n${JSON.stringify({
      manifest_loaded: true,
      tool_accepted: true,
      child_spawned: true,
      nonce,
      sessionKey,
      reason_hash: 'adfa6bb5a86112ed',
      reason_length: 139,
      redacted_events: [{ type: 'res', ok: true, sessionKey, message: `Proof nonce ${nonce}` }],
    })}\n--- END EVIDENCE ---\n`);
    const signingKey = 'evidence-writer-readiness-token';
    const candidateSha = '2723dbee783c113cae70e4fb63a4cff9f55402e3';
    const docsSha = 'd9fd19c6d3b587d36764d0184143b43885762ee1';
    const gatewayWs = 'ws://127.0.0.1:18789';
    await writeFile(readiness, `${JSON.stringify(signedSeatReadinessFixture({
      signingKey,
      candidateSha,
      docsSha,
      gatewayWs,
      seat: 'unit-seat',
      unit: 'unit-gateway.service',
      rows: ['R-UNIT-SEAT-READINESS'],
    }))}\n`);

    const writer = join(repoRoot, 'tools/k6-proofs/scripts/evidence-writer.mjs');
    const run = spawnSync(process.execPath, [
      writer,
      '--input', k6Output,
      '--row', 'R-UNIT-SEAT-READINESS',
      '--seat', 'unit-seat',
      '--sha', '2723dbee783c113cae70e4fb63a4cff9f55402e3',
      '--seat-readiness', readiness,
    ], {
      cwd: dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        OPENCLAW_GATEWAY_TOKEN: signingKey,
        OPENCLAW_GATEWAY_WS: gatewayWs,
        OPENCLAW_RUNTIME_SHA: candidateSha,
        OPENCLAW_DOCS_SHA: docsSha,
        OPENCLAW_GATEWAY_UNIT: 'unit-gateway.service',
        OPENCLAW_SELECTED_ROWS: 'R-UNIT-SEAT-READINESS',
        OPENCLAW_REQUIRED_MAX_SPAWN_DEPTH: '2',
        OPENCLAW_EXPECTED_MAX_SPAWN_DEPTH: '5',
      },
    });

    test('evidence writer rejects a missing receipt before creating artifacts', async () => {
      await withTmp(async (dir) => {
        const input = join(dir, 'run.txt');
        await writeFile(input, '=== K6-PROOF-EVIDENCE ===\n{}\n--- END EVIDENCE ---\n');
        const result = spawnSync(process.execPath, [
          join(repoRoot, 'tools/k6-proofs/scripts/evidence-writer.mjs'),
          '--input', input,
          '--row', 'R-CD-1',
          '--seat', 'unit-seat',
          '--sha', '2723dbee783c113cae70e4fb63a4cff9f55402e3',
        ], { cwd: dir, encoding: 'utf8' });
        assert.notEqual(result.status, 0);
        assert.deepEqual(await readdir(dir), ['run.txt']);
      });
    });

    assert.equal(run.status, 0, run.stderr || run.stdout);
    const printed = JSON.parse(run.stdout);
    const copied = JSON.parse(await readFile(join(dir, printed.runDir, 'seat-readiness.json'), 'utf8'));
    assert.equal(copied.schema, 'openclaw.k6.seat-readiness.v2');
    const evidence = await readFile(join(dir, printed.runDir, 'EVIDENCE.md'), 'utf8');
    assert.match(evidence, /seat-readiness\.json.*captured/);
    for (const name of ['EVIDENCE.md', 'k6-summary.json', 'gateway-events.ndjson', 'evidence-redaction.json']) {
      const content = await readFile(join(dir, printed.runDir, name), 'utf8');
      assert.doesNotMatch(content, new RegExp(nonce));
      assert.doesNotMatch(content, new RegExp(sessionKey));
    }
  });
});
