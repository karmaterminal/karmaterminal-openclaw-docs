import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  resolveRcd2AuthoritativeReceipt,
  validateRcd2AuthoritativeReceipt,
} from '../../lib/r-cd-2-authoritative-receipt.mjs';

const signingKey = 'r-cd-2-authoritative-receipt-test-key';
const run = 'a'.repeat(16);
const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '../..');
const manifestPath = path.join(repoRoot, 'manifests/r-cd-2.json');
const writerPath = path.join(repoRoot, 'scripts/evidence-writer.mjs');
const postprocessorPath = path.join(repoRoot, 'scripts/postprocess-k6-summary.mjs');

function evidence(overrides = {}) {
  return {
    session_created: true, session_unbound_confirmed: true,
    send_accepted: true, send_run_captured: true,
    terminal_success_same_run: true, typed_delegate_success_same_run: true,
    wake_same_run: true, post_wake_quiet: true,
    channel_delivery_observed: false, dispatch_failure_observed: false,
    send_run_fingerprint: run, terminal_run_fingerprint: run, wake_run_fingerprint: run,
    ...overrides,
  };
}

function correlation(overrides = {}) {
  return {
    tool: 'continue_delegate', mode: 'silent-wake', sameTrace: true, sameChain: true,
    typedToolObserved: true, dispatchObserved: true, fireObserved: true,
    traceId: 'b'.repeat(32), chainId: 'private-chain-id',
    dispatchSpanId: 'c'.repeat(16), fireSpanId: 'd'.repeat(16),
    ...overrides,
  };
}

test('R-CD-2 promotes only a same-run typed silent-wake topology', () => {
  const receipt = resolveRcd2AuthoritativeReceipt({ evidence: evidence(), correlation: correlation(), signingKey });
  assert.equal(receipt.verdict, 'PASS-candidate');
  assert.equal(validateRcd2AuthoritativeReceipt(receipt, signingKey).valid, true);
  assert.doesNotMatch(JSON.stringify(receipt), /private-chain-id|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/);
});

test('R-CD-2 rejects outer-send acceptance plus an unrelated delayed message', () => {
  const receipt = resolveRcd2AuthoritativeReceipt({
    evidence: evidence({ terminal_success_same_run: false, wake_same_run: false, send_run_mismatch: true }),
    correlation: correlation(), signingKey,
  });
  assert.deepEqual([receipt.verdict, receipt.failureCategory], ['PARTIAL-candidate', 'send-run-mismatch']);
});

test('R-CD-2 rejects replay failure, wrong mode, and mismatched trace topology', () => {
  const replay = resolveRcd2AuthoritativeReceipt({
    evidence: evidence({ dispatch_failure_observed: true, failureCategory: 'delegate-replay-unsafe' }),
    correlation: correlation(), signingKey,
  });
  assert.equal(replay.failureCategory, 'delegate-replay-unsafe');
  for (const bad of [correlation({ mode: 'normal' }), correlation({ sameTrace: false })]) {
    const receipt = resolveRcd2AuthoritativeReceipt({ evidence: evidence(), correlation: bad, signingKey });
    assert.deepEqual([receipt.verdict, receipt.failureCategory], ['PARTIAL-candidate', 'invalid-continuation-topology']);
  }
});

test('R-CD-2 writer and postprocessor accept only the authoritative receipt', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'r-cd-2-authoritative-'));
  try {
    const receipt = resolveRcd2AuthoritativeReceipt({ evidence: evidence(), correlation: correlation(), signingKey });
    const receiptPath = path.join(dir, 'receipt.json');
    const logPath = path.join(dir, 'k6.log');
    const summaryPath = path.join(dir, 'summary.json');
    await writeFile(receiptPath, JSON.stringify(receipt));
    await writeFile(logPath, '--- R-CD-2 EVIDENCE SUMMARY ---\n{"row":"R-CD-2","redacted_events":[]}\n--- END EVIDENCE ---\n');
    await writeFile(summaryPath, JSON.stringify({ metrics: { proof_failures: { values: { count: 0 } }, checks: { values: { rate: 1 } } } }));
    const env = { ...process.env, OPENCLAW_GATEWAY_TOKEN: signingKey };
    const writer = await execFileAsync(process.execPath, [writerPath, '--input', logPath, '--row', 'R-CD-2', '--seat', 'unit', '--sha', 'a'.repeat(40), '--manifest', manifestPath, '--authoritative-receipt', receiptPath], { cwd: dir, env });
    const writerDir = JSON.parse(writer.stdout).runDir;
    const writerResult = JSON.parse(await readFile(path.join(dir, writerDir, 'row-result.json'), 'utf8'));
    assert.equal(writerResult.outcome, 'PASS-candidate');
    assert.equal(writerResult.verdictSource, 'r-cd-2-authoritative-receipt');
    const post = await execFileAsync(process.execPath, [postprocessorPath, '--manifest', manifestPath, '--summary', summaryPath, '--out-root', path.join(dir, 'post'), '--run-id', 'unit', '--authoritative-receipt', receiptPath], { cwd: dir, env });
    const postDir = JSON.parse(post.stdout).runDir;
    const postResult = JSON.parse(await readFile(path.join(postDir, 'row-result.json'), 'utf8'));
    assert.equal(postResult.outcome, 'PASS-candidate');
    assert.equal(postResult.verdictSource, 'r-cd-2-authoritative-receipt');
    await assert.rejects(execFileAsync(process.execPath, [writerPath, '--input', logPath, '--row', 'R-CD-2', '--seat', 'unit', '--sha', 'a'.repeat(40)], { cwd: dir, env }));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
