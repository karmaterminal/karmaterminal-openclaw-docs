import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const script = join(repoRoot, 'tools/k6-proofs/scripts/live-run-guard.mjs');
const validEnv = {
  ...process.env,
  OPENCLAW_GATEWAY_TOKEN: 'unit-token-not-printed',
  OPENCLAW_CANDIDATE_SHA: '2723dbee783c113cae70e4fb63a4cff9f55402e3',
  OPENCLAW_SESSION_KEY: 'agent:main:discord:channel:test',
};

function runGuard(manifest, extraEnv = {}) {
  return spawnSync(process.execPath, [script, '--manifest', manifest, '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...validEnv, ...extraEnv },
  });
}

test('live-run guard fails closed for orchestration-required config-mutating rows', async () => {
  for (const manifestName of ['r-cw-5.json', 'r-cw-6.json']) {
    const manifest = join(repoRoot, 'tools/k6-proofs/manifests', manifestName);
    const run = runGuard(manifest);
    assert.equal(run.status, 1, `${manifestName} unexpectedly passed: ${run.stdout}`);
    const parsed = JSON.parse(run.stdout);
    assert.equal(parsed.ok, false);
    assert.ok(
      parsed.errors.some((error) => error.includes('orchestration-required is not directly runnable')),
      `${manifestName} errors did not include orchestration-required fail-closed guard: ${run.stdout}`,
    );
    assert.doesNotMatch(run.stdout, /unit-token-not-printed/);
  }
});

test('live-run guard still permits ordinary k6-runnable manifests with required env present', async () => {
  const manifest = join(repoRoot, 'tools/k6-proofs/manifests/r-config-defaults.json');
  const run = runGuard(manifest);
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const parsed = JSON.parse(run.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.rowId, 'R-CONFIG-defaults');
  assert.equal(parsed.classification, 'k6-runnable');
});

test('live-run guard still permits static preflight manifests without live candidate env', async () => {
  const manifest = join(repoRoot, 'tools/k6-proofs/manifests/preflight.example.json');
  const run = runGuard(manifest, {
    OPENCLAW_GATEWAY_TOKEN: '',
    OPENCLAW_CANDIDATE_SHA: '',
    OPENCLAW_SESSION_KEY: '',
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const parsed = JSON.parse(run.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.rowId, 'preflight');
  assert.equal(parsed.classification, 'static-preflight-only');
});

test('config-mutating row manifests keep restore/review receipts declared', async () => {
  for (const manifestName of ['r-cw-5.json', 'r-cw-6.json']) {
    const manifestPath = join(repoRoot, 'tools/k6-proofs/manifests', manifestName);
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    assert.equal(manifest.mutates, true);
    assert.equal(manifest.scenario.status, 'scaffold');
    assert.equal(manifest.liveRunSafety.classification, 'orchestration-required');
    assert.equal(manifest.liveRunSafety.foldRequiresReview, true);
    for (const receiptName of [
      'seat-readiness-continuation-enabled',
      'original-config-captured',
      'failure-safe-restore-armed',
      'config-restored',
    ]) {
      assert.ok(
        manifest.expectedReceipts.some((receipt) => receipt.name === receiptName && receipt.required === true),
        `${manifestName} missing expected receipt ${receiptName}`,
      );
      assert.ok(
        manifest.liveRunSafety.requiredReceipts.includes(receiptName),
        `${manifestName} liveRunSafety.requiredReceipts missing ${receiptName}`,
      );
    }
  }
});
