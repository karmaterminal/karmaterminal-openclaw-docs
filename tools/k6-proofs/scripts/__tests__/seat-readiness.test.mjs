import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, writeFile, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const script = join(repoRoot, 'tools/k6-proofs/scripts/seat-readiness-preflight.mjs');
const policy = join(repoRoot, 'tools/k6-proofs/seat-readiness.policy.json');
const schema = join(repoRoot, 'tools/k6-proofs/seat-readiness.schema.json');

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

test('seat readiness JSON contains no env secret values and reports booleans only', async () => {
  await withTmp(async (dir) => {
    const fakeK6 = join(dir, 'k6');
    const fakeOpenClawDir = join(dir, 'bin');
    const fakeOpenClaw = join(fakeOpenClawDir, 'openclaw');
    await mkdir(fakeOpenClawDir, { recursive: true });
    await writeFile(fakeK6, '#!/bin/sh\necho "k6 v2.0.0 (commit/test)"\n');
    await writeFile(fakeOpenClaw, '#!/bin/sh\necho \'{"enabled":true,"maxChainLength":200,"maxDelegesPerTurn":500,"costCapTokens":500000}\' | sed s/Deleges/Delegates/\n');
    await chmod(fakeK6, 0o755);
    await chmod(fakeOpenClaw, 0o755);

    const token = 'CANARY-TOKEN-VALUE-DO-NOT-PRINT';
    const run = runPreflight(['--json', '--no-gateway', '--expected-k6-version', 'v2.0.0'], {
      K6_BIN: fakeK6,
      OPENCLAW_GATEWAY_TOKEN: token,
      OPENCLAW_CANDIDATE_SHA: '2723dbee783c113cae70e4fb63a4cff9f55402e3',
      OPENCLAW_SEAT_NAME: 'unit-seat',
      OPENCLAW_SESSION_KEY: 'agent:main:discord:channel:test',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:18789',
      PATH: `${fakeOpenClawDir}:${process.env.PATH}`,
    });

    assert.equal(run.status, 0, run.stderr || run.stdout);
    assert.doesNotMatch(run.stdout, new RegExp(token));
    const report = JSON.parse(run.stdout);
    assert.equal(report.schema, 'openclaw.k6.seat-readiness.v1');
    assert.equal(report.outcome, 'PASS-candidate');
    assert.equal(report.policy.name, 'k6 PROOFS seat readiness policy');
    assert.equal(report.k6.path, fakeK6);
    assert.equal(report.k6.version, 'v2.0.0');
    assert.equal(report.gateway.mode, 'skipped-by-flag');
    assert.equal(report.continuation.mode, 'checked');
    assert.equal(report.continuation.enabled, true);
    assert.equal(report.continuation.defaultsPresent, true);
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
  assert.ok(parsed.required.includes('continuation'));
  assert.ok(parsed.properties.continuation.required.includes('enabled'));
  assert.ok(parsed.properties.continuation.required.includes('defaultsPresent'));
  assert.ok(parsed.properties.k6.required.includes('checked'));
  assert.ok(parsed.properties.env.items.required.includes('purpose'));
});

test('evidence writer copies supplied seat-readiness report into candidate artifacts', async () => {
  await withTmp(async (dir) => {
    const k6Output = join(dir, 'run.txt');
    const readiness = join(dir, 'seat-readiness.json');
    await writeFile(k6Output, `=== K6-PROOF-EVIDENCE ===\n${JSON.stringify({
      manifest_loaded: true,
      tool_accepted: true,
      child_spawned: true,
      redacted_events: [{ type: 'res', ok: true }],
    })}\n--- END EVIDENCE ---\n`);
    await writeFile(readiness, `${JSON.stringify({ schema: 'openclaw.k6.seat-readiness.v1', outcome: 'PASS-candidate' })}\n`);

    const writer = join(repoRoot, 'tools/k6-proofs/scripts/evidence-writer.mjs');
    const run = spawnSync(process.execPath, [
      writer,
      '--input', k6Output,
      '--row', 'R-UNIT-SEAT-READINESS',
      '--seat', 'unit-seat',
      '--sha', '2723dbee783c113cae70e4fb63a4cff9f55402e3',
      '--seat-readiness', readiness,
    ], { cwd: dir, encoding: 'utf8' });

    assert.equal(run.status, 0, run.stderr || run.stdout);
    const printed = JSON.parse(run.stdout);
    const copied = JSON.parse(await readFile(join(dir, printed.runDir, 'seat-readiness.json'), 'utf8'));
    assert.equal(copied.schema, 'openclaw.k6.seat-readiness.v1');
    const evidence = await readFile(join(dir, printed.runDir, 'EVIDENCE.md'), 'utf8');
    assert.match(evidence, /seat-readiness\.json.*captured/);
  });
});
