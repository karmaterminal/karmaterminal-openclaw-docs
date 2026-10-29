import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
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

test('current session observer can sign a bound return without removed TaskFlow IDs', () => {
  const sessionEvidence = {
    ...evidence,
    observation_surface: 'sessions.list spawnedBy + chat.history own spawn task',
    observer_rounds_accepted: 3,
    observer_traversals_refused: 0,
    tasks_list_rejected: undefined,
    origin_task_id_hash: null,
    delegate_task_id_hash: null,
    delegate_parent_task_id_hash: null,
  };
  const receipt = resolve({ evidence: sessionEvidence });
  assert.equal(receipt.verdict, 'PASS-candidate');
  assert.deepEqual(validateRcdTokenAuthoritativeReceipt(receipt, key), {
    valid: true, verdict: 'PASS-candidate',
  });
  for (const overrides of [
    { observer_traversals_refused: 1 },
    { delegate_requester_matches_origin_child: false },
    { return_source_session_hash: h('f') },
    { delegate_task_unique_count: 2 },
  ]) {
    assert.equal(resolve({ evidence: { ...sessionEvidence, ...overrides } }).verdict, 'PARTIAL-candidate');
  }
  assert.equal(resolve({
    evidence: sessionEvidence,
    correlation: { ...correlation, reason: { hash: h('f'), length: 42 } },
  }).verdict, 'PARTIAL-candidate');
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

/** Re-seal a receipt with the gateway key, exactly as the resolver does. */
function reseal(receipt) {
  const canonical = JSON.stringify({
    schema: receipt.schema,
    row: receipt.row,
    authoritativeSource: receipt.authoritativeSource,
    candidateOnly: receipt.candidateOnly,
    foldRequiresReview: receipt.foldRequiresReview,
    verdict: receipt.verdict,
    failureCategory: receipt.failureCategory || null,
    binding: receipt.binding,
    lifecycle: receipt.lifecycle || null,
  });
  return {
    ...receipt,
    integrity: { ...receipt.integrity, signature: createHmac('sha256', key).update(canonical).digest('hex') },
  };
}

test('the signed receipt records the bound route; a targeted return never PASSes, signed or not (#1727)', () => {
  // Legacy evidence (no route) is the header parser's direct announce.
  assert.equal(resolve().lifecycle.returnRoute, 'direct-announce');
  assert.equal(resolve({ evidence: { ...evidence, return_route: 'direct-announce' } }).lifecycle.returnRoute, 'direct-announce');
  // A targeted return correlated on both legs, with the topology present:
  // PARTIAL, its correlation fingerprinted.
  const correlated = {
    ...evidence,
    delegate_return_observed: false,
    return_target_session_hash: null,
    return_source_session_hash: null,
    targeted_return_correlated: true,
    targeted_return_run_id_hash: h('c'),
    targeted_return_after_delegate_end_ms: 312,
    origin_spawn_run_id_hash: h('d'),
    source_return_observed: true,
    source_return_run_id_hash: evidence.delegate_run_id_hash,
  };
  const partial = resolve({ evidence: correlated });
  assert.equal(partial.verdict, 'PARTIAL-candidate');
  assert.equal(partial.failureCategory, 'incomplete-or-nonunique-lifecycle');
  assert.equal(partial.lifecycle, undefined);
  assert.deepEqual(validateRcdTokenAuthoritativeReceipt(partial, key), { valid: true, verdict: 'PARTIAL-candidate' });
  assert.notEqual(partial.binding.localEvidenceFingerprint,
    resolve({ evidence: { ...correlated, targeted_return_run_id_hash: h('f') } }).binding.localEvidenceFingerprint);
  // Evidence claiming a targeted-return bind is refused.
  assert.equal(resolve({ evidence: {
    ...correlated,
    delegate_return_observed: true,
    return_target_session_hash: h('4'),
    return_source_session_hash: h('5'),
    return_route: 'targeted-return',
  } }).verdict, 'PARTIAL-candidate');
  // A PASS lifecycle naming the targeted route is invalid even when correctly
  // signed: a signature over a correlation cannot stand in for the join.
  assert.deepEqual(validateRcdTokenAuthoritativeReceipt(reseal(resolve()), key), { valid: true, verdict: 'PASS-candidate' });
  for (const returnRoute of ['targeted-return', 'log-only']) {
    const sealed = reseal({ ...resolve(), lifecycle: { ...resolve().lifecycle, returnRoute } });
    assert.deepEqual(validateRcdTokenAuthoritativeReceipt(sealed, key), { valid: false, reason: 'invalid-pass-lifecycle' }, returnRoute);
  }
  // The route field is signed.
  const tampered = structuredClone(resolve());
  tampered.lifecycle.returnRoute = 'targeted-return';
  assert.equal(validateRcdTokenAuthoritativeReceipt(tampered, key).valid, false);
});
