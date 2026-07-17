import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveRcd2AuthoritativeReceipt,
  validateRcd2AuthoritativeReceipt,
} from '../../lib/r-cd-2-authoritative-receipt.mjs';

const signingKey = 'r-cd-2-authoritative-receipt-test-key';
const run = 'a'.repeat(16);

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
