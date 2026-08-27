import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveRcd2AuthoritativeReceipt } from '../../lib/r-cd-2-authoritative-receipt.mjs';

test('a replay diagnostic cannot override the complete bound silent-wake lifecycle', () => {
  const run = 'a'.repeat(16);
  const trace = 'b'.repeat(32);
  const nonce = 'e'.repeat(16);
  const receipt = resolveRcd2AuthoritativeReceipt({
    signingKey: 'replay-diagnostic-regression-key',
    evidence: {
      session_created: true,
      session_unbound_confirmed: true,
      send_accepted: true,
      send_run_captured: true,
      dispatch_terminal_sentinel_observed: true,
      dispatch_terminal_sentinel_same_run_window: true,
      terminal_success_same_run: true,
      typed_delegate_success_same_run: true,
      wake_lifecycle_observed: true,
      post_wake_quiet: true,
      channel_message_observed: false,
      dispatch_failure_observed: true,
      failureCategory: 'delegate-replay-unsafe',
      replay_invalid_observed: true,
      send_run_fingerprint: run,
      terminal_run_fingerprint: run,
      row_nonce_fingerprint: nonce,
      accepted_send_trace_id: trace,
    },
    correlation: {
      continuation: { tool: 'continue_delegate' },
      delegate: { mode: 'silent-wake' },
      toolSpanIds: ['1'.repeat(16)],
      traceId: trace,
      chainId: 'public-chain-id',
      dispatchSpanId: '2'.repeat(16),
      fireSpanId: '3'.repeat(16),
      rowBinding: {
        acceptedSendRunFingerprint: run,
        nonceFingerprint: nonce,
        acceptedSendTraceId: trace,
        acceptedSendTraceSource: 'sessions-send-response',
      },
    },
  });
  assert.equal(receipt.verdict, 'PASS-candidate');
  assert.equal(receipt.lifecycle.replayDiagnosticObserved, true);
});
