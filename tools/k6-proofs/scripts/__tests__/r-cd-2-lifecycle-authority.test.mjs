import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolveRcd2LifecycleReceipt } from '../resolve-r-cd-2-lifecycle-receipt.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '../..');
const manifest = path.join(repoRoot, 'manifests/r-cd-2.json');
const writer = path.join(repoRoot, 'scripts/evidence-writer.mjs');
const postprocess = path.join(repoRoot, 'scripts/postprocess-k6-summary.mjs');
const sha = 'a'.repeat(40);

function validCorrelation(overrides = {}) {
  return {
    continuation: {
      tool: 'continue_delegate',
      acceptSpan: 'continuation.delegate.dispatch',
      fireSpan: 'continuation.delegate.fire',
    },
    delegate: { mode: 'silent-wake' },
    sameTrace: true,
    distinctSpans: true,
    traceId: '1'.repeat(32),
    chainId: 'test-chain-001',
    dispatchSpanId: '2'.repeat(16),
    fireSpanId: '3'.repeat(16),
    toolSpanIds: ['4'.repeat(16)],
    ...overrides,
  };
}

test('R-CD-2 lifecycle authority is fail-closed for July, provider, and wrong-topology shapes', () => {
  assert.deepEqual(
    resolveRcd2LifecycleReceipt({ collectorPresent: false, correlation: null }),
    {
      schema: 'openclaw.k6.r-cd-2-lifecycle-receipt.v1',
      row: 'R-CD-2',
      authoritativeSource: 'continuation-trace-correlation',
      candidateOnly: true,
      foldRequiresReview: true,
      verdict: 'PARTIAL-candidate',
      failureCategory: 'missing-lifecycle-correlation',
    },
  );
  assert.equal(
    resolveRcd2LifecycleReceipt({
      collectorPresent: false,
      correlation: null,
      failureReceipt: { kind: 'delegate-replay-unsafe' },
    }).failureCategory,
    'delegate-replay-unsafe',
  );
  assert.equal(
    resolveRcd2LifecycleReceipt({
      correlation: validCorrelation({ delegate: { mode: 'normal' } }),
    }).failureCategory,
    'invalid-lifecycle-topology',
  );
  assert.equal(
    resolveRcd2LifecycleReceipt({
      correlation: validCorrelation({ sameTrace: false }),
    }).failureCategory,
    'invalid-lifecycle-topology',
  );
});

test('R-CD-2 lifecycle authority accepts only the complete same-chain silent-wake topology', () => {
  const result = resolveRcd2LifecycleReceipt({ correlation: validCorrelation() });
  assert.equal(result.verdict, 'PASS-candidate');
  assert.equal(result.lifecycle.typedTool, 'continue_delegate');
  assert.equal(result.lifecycle.observedMode, 'silent-wake');
  assert.equal(result.lifecycle.sameTrace, true);
  assert.equal(result.lifecycle.toolSpanCount, 1);
  for (const field of ['traceHash', 'chainHash', 'dispatchSpanHash', 'fireSpanHash']) {
    assert.match(result.lifecycle[field], /^[a-f0-9]{16}$/);
  }
  assert.equal(JSON.stringify(result).includes('test-chain-001'), false);
});

async function runWriters(receipt) {
  const dir = await mkdtemp(path.join(tmpdir(), 'r-cd-2-authority-'));
  const receiptPath = path.join(dir, 'r-cd-2-lifecycle-receipt.json');
  const inputPath = path.join(dir, 'k6.log');
  const summaryPath = path.join(dir, 'summary.json');
  await writeFile(receiptPath, `${JSON.stringify(receipt)}\n`);
  await writeFile(inputPath, [
    '--- R-CD-2 EVIDENCE SUMMARY ---',
    JSON.stringify({ row: 'R-CD-2', tool_accepted: true, task_created: true, redacted_events: [] }),
    '--- END EVIDENCE ---',
  ].join('\n'));
  await writeFile(summaryPath, JSON.stringify({
    metrics: {
      proof_failures: { values: { count: 0 } },
      checks: { values: { rate: 1 } },
    },
  }));
  const writerRun = await execFileAsync(process.execPath, [writer, '--input', inputPath, '--row', 'R-CD-2', '--seat', 'test', '--sha', sha, '--manifest', manifest, '--lifecycle-receipt', receiptPath], { cwd: dir });
  const postRun = await execFileAsync(process.execPath, [postprocess, '--manifest', manifest, '--summary', summaryPath, '--out-root', path.join(dir, 'post'), '--run-id', 'test', '--lifecycle-receipt', receiptPath], { cwd: dir });
  const writerDir = JSON.parse(writerRun.stdout).runDir;
  const postDir = JSON.parse(postRun.stdout).runDir;
  return {
    writerResult: JSON.parse(await readFile(path.join(dir, writerDir, 'row-result.json'), 'utf8')),
    postResult: JSON.parse(await readFile(path.join(postDir, 'row-result.json'), 'utf8')),
  };
}

test('shared artifact writers require the same R-CD-2 lifecycle verdict', async () => {
  // Test the public contract directly: both scripts reject a missing receipt,
  // so outer acceptance/check metrics cannot create a R-CD-2 PASS on either path.
  const dir = await mkdtemp(path.join(tmpdir(), 'r-cd-2-writers-'));
  const input = path.join(dir, 'k6.log');
  const summary = path.join(dir, 'summary.json');
  await writeFile(input, '--- R-CD-2 EVIDENCE SUMMARY ---\n{"tool_accepted":true,"task_created":true,"redacted_events":[]}\n--- END EVIDENCE ---\n');
  await writeFile(summary, JSON.stringify({ metrics: { proof_failures: { values: { count: 0 } }, checks: { values: { rate: 1 } } } }));
  await assert.rejects(
    execFileAsync(process.execPath, [writer, '--input', input, '--row', 'R-CD-2', '--seat', 'test', '--sha', sha, '--manifest', manifest], { cwd: dir }),
  );
  await assert.rejects(
    execFileAsync(process.execPath, [postprocess, '--manifest', manifest, '--summary', summary, '--out-root', path.join(dir, 'post')], { cwd: dir }),
  );
});

test('shared artifact writers agree on partial and complete lifecycle fixtures', async () => {
  const july = resolveRcd2LifecycleReceipt({
    collectorPresent: false,
    correlation: null,
    failureReceipt: { kind: 'provider-transport-error' },
  });
  const julyResults = await runWriters(july);
  assert.equal(julyResults.writerResult.outcome, 'PARTIAL-candidate');
  assert.equal(julyResults.postResult.outcome, 'PARTIAL-candidate');
  assert.equal(julyResults.writerResult.lifecycleReceipt.failureCategory, 'provider-transport-error');

  const complete = resolveRcd2LifecycleReceipt({ correlation: validCorrelation() });
  const completeResults = await runWriters(complete);
  assert.equal(completeResults.writerResult.outcome, 'PASS-candidate');
  assert.equal(completeResults.postResult.outcome, 'PASS-candidate');
});
