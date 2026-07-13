import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const script = join(repoRoot, 'tools/k6-proofs/scripts/postprocess-k6-summary.mjs');
const manifest = join(repoRoot, 'tools/k6-proofs/manifests/preflight.example.json');
const summary = join(repoRoot, 'tools/k6-proofs/examples/k6-summary.preflight.example.json');

async function withTmp(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'p81-k6-observability-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runPostprocess(args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

test('row-result exposes the dashboard v1 observability fields', async () => {
  await withTmp(async (outRoot) => {
    const run = runPostprocess([
      '--manifest', manifest,
      '--summary', summary,
      '--out-root', outRoot,
      '--run-id', 'k6-run-observability-contract',
    ]);

    assert.equal(run.status, 0, run.stderr || run.stdout);
    const printed = JSON.parse(run.stdout);
    const result = JSON.parse(await readFile(join(printed.runDir, 'row-result.json'), 'utf8'));

    assert.equal(result.schema, 'openclaw.k6.proof-row-result.v1');
    assert.equal(result.scenario, 'preflight');
    assert.equal(result.toolSurface, 'read-only');
    assert.equal(result.transport, 'websocket');
    assert.equal(result.failureClass, 'none');
    assert.equal(result.metrics.proofFailures, 0);
    assert.equal(result.metrics.checksRate, 1);
    assert.equal(result.metrics.durationMs, 10);
    assert.ok(Array.isArray(result.receipts));
    assert.equal(result.candidateOnly, true);
    assert.equal(result.foldRequiresReview, true);
  });
});

test('receipt summary statuses are normalized into row-result receipts', async () => {
  await withTmp(async (outRoot) => {
    const customSummary = join(outRoot, 'summary.json');
    const parsed = JSON.parse(await readFile(summary, 'utf8'));
    parsed.proof_receipts = {
      'manifest-loaded': 'present',
      'k6-summary': false,
    };
    await writeFile(customSummary, `${JSON.stringify(parsed, null, 2)}\n`);

    const run = runPostprocess([
      '--manifest', manifest,
      '--summary', customSummary,
      '--out-root', outRoot,
      '--run-id', 'k6-run-observability-receipts',
    ]);

    assert.equal(run.status, 0, run.stderr || run.stdout);
    const printed = JSON.parse(run.stdout);
    const result = JSON.parse(await readFile(join(printed.runDir, 'row-result.json'), 'utf8'));
    const receipts = Object.fromEntries(result.receipts.map((r) => [r.name, r.status]));

    assert.equal(receipts['manifest-loaded'], 'present');
    assert.equal(receipts['k6-summary'], 'missing');
    assert.equal(result.failureClass, 'missing-receipt');
  });
});
