import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const R_CD_2_RECEIPT_SCHEMA = 'openclaw.k6.r-cd-2-lifecycle-receipt.v2';
export const R_CD_2_FAILURE_CATEGORIES = new Set([
  'missing-lifecycle-correlation',
  'invalid-lifecycle-topology',
  'missing-local-lifecycle-evidence',
  'provider-transport-error',
  'model-policy-rejected',
  'delegate-replay-unsafe',
  'dispatching-turn-failed',
  'dispatching-turn-replay-invalid',
  'dispatching-turn-aborted',
  'dispatching-turn-not-live',
]);

const fingerprint = (value) => createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
const fingerprintShape = (value) => typeof value === 'string' && /^[a-f0-9]{16}$/i.test(value);
const bindingShape = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);

const ROOT_KEYS = new Set([
  'schema', 'row', 'authoritativeSource', 'candidateOnly', 'foldRequiresReview',
  'verdict', 'failureCategory', 'lifecycle', 'binding', 'integrity',
]);
const PASS_LIFECYCLE_KEYS = new Set([
  'typedTool', 'observedMode', 'sameTrace', 'sameChain', 'typedDelegateAccepted',
  'dispatchObserved', 'fireObserved', 'terminalSuccessObserved',
  'unboundSessionVerified', 'noChannelVerified', 'traceFingerprint',
  'chainFingerprint', 'delegateFingerprint',
]);
const BINDING_KEYS = new Set(['localEvidenceFingerprint', 'correlationFingerprint']);
const INTEGRITY_KEYS = new Set(['algorithm', 'signature']);

function hasOnlyKeys(value, allowed) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).every((key) => allowed.has(key));
}

export function publicFingerprint(value) {
  return fingerprint(value);
}

export function privateBinding(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function signingKey(key = process.env.OPENCLAW_GATEWAY_TOKEN) {
  return typeof key === 'string' && key.length > 0 ? key : null;
}

function canonicalReceiptPayload(receipt) {
  const payload = {
    schema: R_CD_2_RECEIPT_SCHEMA,
    row: 'R-CD-2',
    authoritativeSource: 'r-cd-2-lifecycle-resolver',
    candidateOnly: true,
    foldRequiresReview: true,
    verdict: receipt.verdict,
    binding: {
      localEvidenceFingerprint: receipt.binding?.localEvidenceFingerprint,
      correlationFingerprint: receipt.binding?.correlationFingerprint,
    },
  };
  if (receipt.verdict === 'PARTIAL-candidate') payload.failureCategory = receipt.failureCategory;
  if (receipt.verdict === 'PASS-candidate') {
    payload.lifecycle = Object.fromEntries(
      [...PASS_LIFECYCLE_KEYS].map((key) => [key, receipt.lifecycle?.[key]]),
    );
  }
  return JSON.stringify(payload);
}

export function sealRcd2LifecycleReceipt(receipt, key) {
  const secret = signingKey(key);
  if (!secret) throw new Error('missing-r-cd-2-receipt-signing-key');
  return {
    ...receipt,
    integrity: {
      algorithm: 'hmac-sha256-gateway-token-v1',
      signature: createHmac('sha256', secret).update(canonicalReceiptPayload(receipt)).digest('hex'),
    },
  };
}

function integrityIsValid(receipt, key) {
  const secret = signingKey(key);
  if (!secret || !hasOnlyKeys(receipt.integrity, INTEGRITY_KEYS) ||
      receipt.integrity.algorithm !== 'hmac-sha256-gateway-token-v1' ||
      !bindingShape(receipt.integrity.signature)) return false;
  const expected = createHmac('sha256', secret).update(canonicalReceiptPayload(receipt)).digest('hex');
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(receipt.integrity.signature, 'hex'));
}

/**
 * Return the only lifecycle receipt shape that may cross into public artifacts.
 * Never serialize the resolver input object directly: it can contain private
 * correlation fields even when its known fields happen to be safe.
 */
export function projectRcd2PublicLifecycleReceipt(receipt) {
  const validation = validateRcd2LifecycleReceipt(receipt);
  if (!validation.valid) throw new Error(`R-CD-2 lifecycle receipt rejected: ${validation.reason}`);
  const projected = {
    schema: R_CD_2_RECEIPT_SCHEMA,
    row: 'R-CD-2',
    authoritativeSource: 'r-cd-2-lifecycle-resolver',
    candidateOnly: true,
    foldRequiresReview: true,
    verdict: receipt.verdict,
    binding: {
      localEvidenceFingerprint: receipt.binding.localEvidenceFingerprint,
      correlationFingerprint: receipt.binding.correlationFingerprint,
    },
    integrity: {
      algorithm: receipt.integrity.algorithm,
      signature: receipt.integrity.signature,
    },
  };
  if (receipt.verdict === 'PARTIAL-candidate') {
    projected.failureCategory = receipt.failureCategory;
  } else {
    projected.lifecycle = Object.fromEntries(
      [...PASS_LIFECYCLE_KEYS].map((key) => [key, receipt.lifecycle[key]]),
    );
  }
  return projected;
}

export function localEvidenceIsComplete(evidence) {
  return Boolean(
    evidence?.session_created === true &&
    evidence?.session_unbound_confirmed === true &&
    evidence?.tool_accepted === true &&
    evidence?.send_run_id_captured === true &&
    evidence?.delegate_scheduled_receipt === true &&
    evidence?.dispatch_turn_completed === true &&
    evidence?.terminal_success_observed === true &&
    evidence?.terminal_run_matched === true &&
    evidence?.parent_wake_observed === true &&
    evidence?.child_fire_or_completion_observed === true &&
    evidence?.wake_run_matched === true &&
    evidence?.post_wake_quiet_completed === true &&
    evidence?.channel_message_observed === false &&
    evidence?.dispatch_failure_observed !== true,
  );
}

export function validateRcd2LifecycleReceipt(receipt, key) {
  if (!receipt || typeof receipt !== 'object') return { valid: false, reason: 'missing-receipt' };
  if (!hasOnlyKeys(receipt, ROOT_KEYS)) return { valid: false, reason: 'unknown-root-field' };
  if (receipt.schema !== R_CD_2_RECEIPT_SCHEMA || receipt.row !== 'R-CD-2' || receipt.authoritativeSource !== 'r-cd-2-lifecycle-resolver') {
    return { valid: false, reason: 'wrong-schema-row-or-source' };
  }
  if (!hasOnlyKeys(receipt.binding, BINDING_KEYS) ||
      !bindingShape(receipt.binding.localEvidenceFingerprint) ||
      !bindingShape(receipt.binding.correlationFingerprint)) {
    return { valid: false, reason: 'missing-or-invalid-private-binding' };
  }
  if (!integrityIsValid(receipt, key)) return { valid: false, reason: 'invalid-receipt-integrity' };
  if (receipt.verdict === 'PARTIAL-candidate') {
    return R_CD_2_FAILURE_CATEGORIES.has(receipt.failureCategory) && !receipt.lifecycle
      ? { valid: true, verdict: receipt.verdict }
      : { valid: false, reason: 'unknown-failure-category' };
  }
  if (receipt.verdict !== 'PASS-candidate') return { valid: false, reason: 'invalid-verdict' };
  const lifecycle = receipt.lifecycle;
  if (!hasOnlyKeys(lifecycle, PASS_LIFECYCLE_KEYS)) return { valid: false, reason: 'invalid-lifecycle-projection' };
  const booleans = ['sameTrace', 'sameChain', 'typedDelegateAccepted', 'dispatchObserved', 'fireObserved', 'terminalSuccessObserved', 'unboundSessionVerified', 'noChannelVerified'];
  if (
    lifecycle.typedTool !== 'continue_delegate' ||
    lifecycle.observedMode !== 'silent-wake' ||
    booleans.some((key) => lifecycle[key] !== true) ||
    !fingerprintShape(lifecycle.traceFingerprint) ||
    !fingerprintShape(lifecycle.chainFingerprint) ||
    !fingerprintShape(lifecycle.delegateFingerprint)
  ) return { valid: false, reason: 'invalid-pass-topology' };
  return { valid: true, verdict: receipt.verdict };
}
