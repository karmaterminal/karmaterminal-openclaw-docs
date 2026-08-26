import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveRcdTokenAuthoritativeReceipt,
  validateRcdTokenAuthoritativeReceipt,
} from '../../lib/r-cd-token-authoritative-receipt.mjs';

const h = (character) => character.repeat(16);
const key = 'test-gateway-key';
const sha = 'a'.repeat(40);
const metadata = { row: 'R-CD-TOKEN', candidateSha: sha, runtimeBuildSha: sha };
const evidence = {
  surface_class: 'raw-final-text',
  session_created: true,
  disposable_origin_ready: true,
  prompt_injected: true,
  send_accepted: true,
  send_run_id_hash: h('1'),
  row_nonce_hash: h('2'),
  attempt_id_hash: h('3'),
  candidateSha: sha,
  runtimeBuildSha: sha,
  origin_subscription_accepted: true,
  delegate_return_observed: true,
  return_target_session_hash: h('4'),
  return_source_session_hash: h('5'),
  task_pagination_exhausted: true,
  task_snapshot_consistent: true,
  task_snapshot_stable_count: 3,
  task_snapshot_digest: '0'.repeat(16),
  tasks_list_rejected: 0,
  origin_task_unique_count: 1,
  delegate_task_unique_count: 1,
  origin_task_id_hash: h('6'),
  origin_run_id_hash: h('7'),
  origin_requester_session_hash: h('8'),
  origin_child_session_hash: h('4'),
  delegate_task_id_hash: h('9'),
  delegate_run_id_hash: h('a'),
  delegate_requester_session_hash: h('4'),
  delegate_child_session_hash: h('5'),
  delegate_requester_matches_origin_child: true,
  delegate_parent_mismatch: false,
  delegate_correlation_strategy: 'disposable-origin-child-lineage',
  origin_task_status: 'completed',
  delegate_task_status: 'completed',
  interrupted: false,
  reason_hash: h('b'),
  reason_length: 42,
};
const attemptState = {
  schema: 'openclaw.k6.r-cd-token.attempt-state.v1',
  row: 'R-CD-TOKEN',
  attemptIdHash: h('3'),
  rowNonceHash: h('2'),
  candidateSha: sha,
  runtimeBuildSha: sha,
  automaticRetryAllowed: false,
};
const correlation = {
  traceId: 'c'.repeat(32),
  chainId: '11111111-1111-4111-8111-111111111111',
  dispatchSpanId: h('d'),
  fireSpanId: h('e'),
  toolSpanIds: [],
  sameTrace: true,
  distinctSpans: true,
  reason: { hash: h('b'), length: 42 },
  continuation: { tool: 'continue_delegate', originSurface: 'raw-final-text' },
};

function resolve(overrides = {}) {
  return resolveRcdTokenAuthoritativeReceipt({
    evidence: overrides.evidence || evidence,
    correlation: overrides.correlation || correlation,
    attemptState: overrides.attemptState || attemptState,
    metadata: overrides.metadata || metadata,
    signingKey: key,
  });
}

test('only the complete exactly-once bracket lifecycle plus matching topology can PASS', () => {
  const receipt = resolve();
  assert.equal(receipt.verdict, 'PASS-candidate');
  assert.equal(receipt.binding.candidateSha, sha);
  assert.equal(receipt.binding.runtimeBuildSha, sha);
  assert.deepEqual(validateRcdTokenAuthoritativeReceipt(receipt, key), {
    valid: true, verdict: 'PASS-candidate',
  });
});

test('duplicate scheduling, interruption, typed-tool origin, and mismatched reason are non-PASS', () => {
  for (const overrides of [
    { evidence: { ...evidence, delegate_task_unique_count: 2 } },
    { evidence: { ...evidence, interrupted: true } },
    { evidence: { ...evidence, disposable_origin_ready: false } },
    { correlation: { ...correlation, toolSpanIds: [h('f')] } },
    { correlation: { ...correlation, reason: { hash: h('f'), length: 42 } } },
  ]) {
    const receipt = resolve(overrides);
    assert.notEqual(receipt.verdict, 'PASS-candidate');
    assert.equal(validateRcdTokenAuthoritativeReceipt(receipt, key).valid, true);
  }
});

test('candidate/runtime mismatch is signed non-PASS and cannot become authority', () => {
  const receipt = resolve({
    metadata: { ...metadata, runtimeBuildSha: 'f'.repeat(40) },
  });
  assert.equal(receipt.verdict, 'PARTIAL-candidate');
  assert.equal(validateRcdTokenAuthoritativeReceipt(receipt, key).valid, false);
});

test('tampering invalidates the signed receipt', () => {
  const receipt = resolve();
  receipt.lifecycle.delegateRunIdHash = h('f');
  assert.equal(validateRcdTokenAuthoritativeReceipt(receipt, key).valid, false);
});
