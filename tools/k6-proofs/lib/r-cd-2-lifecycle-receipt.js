import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  classifyRcd2Lifecycle,
  projectRcd2PrivateCorrelation,
  projectRcd2PrivateLifecycleEvidence,
  R_CD_2_FAILURE_CATEGORIES,
} from './r-cd-2-lifecycle-policy.js';

export const R_CD_2_RECEIPT_SCHEMA = 'openclaw.k6.r-cd-2-lifecycle-receipt.v3';
export { R_CD_2_FAILURE_CATEGORIES };

const PASS_LIFECYCLE_KEYS = [
  'typedTool',
  'observedMode',
  'sameTrace',
  'sameChain',
  'sameDelegate',
  'typedDelegateAccepted',
  'dispatchObserved',
  'fireObserved',
  'terminalSuccessObserved',
  'unboundSessionVerified',
  'noChannelVerified',
  'runFingerprint',
  'traceFingerprint',
  'chainFingerprint',
  'delegateFingerprint',
];
const PASS_ROOT_KEYS = new Set([
  'schema', 'row', 'authoritativeSource', 'candidateOnly', 'foldRequiresReview',
  'verdict', 'lifecycle', 'binding', 'integrity',
]);
const PARTIAL_ROOT_KEYS = new Set([
  'schema', 'row', 'authoritativeSource', 'candidateOnly', 'foldRequiresReview',
  'verdict', 'failureCategory', 'binding', 'integrity',
]);
const BINDING_KEYS = new Set(['localEvidenceFingerprint', 'correlationFingerprint']);
const INTEGRITY_KEYS = new Set(['algorithm', 'signature']);

const fingerprint = (value) => createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
const fingerprintShape = (value) => typeof value === 'string' && /^[a-f0-9]{16}$/i.test(value);
const bindingShape = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);

function hasExactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}

function signingKey(key = process.env.OPENCLAW_GATEWAY_TOKEN) {
  return typeof key === 'string' && key.length > 0 ? key : null;
}

function privateBinding(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function unsignedReceipt({ evidence, correlation }) {
  const decision = classifyRcd2Lifecycle({ evidence, correlation });
  const base = {
    schema: R_CD_2_RECEIPT_SCHEMA,
    row: 'R-CD-2',
    authoritativeSource: 'r-cd-2-lifecycle-resolver',
    candidateOnly: true,
    foldRequiresReview: true,
    verdict: decision.verdict,
    binding: {
      localEvidenceFingerprint: privateBinding(projectRcd2PrivateLifecycleEvidence(evidence)),
      correlationFingerprint: privateBinding(projectRcd2PrivateCorrelation(correlation)),
    },
  };
  if (decision.verdict === 'PARTIAL-candidate') {
    return { ...base, failureCategory: decision.failureCategory };
  }
  return {
    ...base,
    lifecycle: {
      typedTool: 'continue_delegate',
      observedMode: 'silent-wake',
      sameTrace: true,
      sameChain: true,
      sameDelegate: true,
      typedDelegateAccepted: true,
      dispatchObserved: true,
      fireObserved: true,
      terminalSuccessObserved: true,
      unboundSessionVerified: true,
      noChannelVerified: true,
      runFingerprint: decision.local.projection.sendRunFingerprint,
      traceFingerprint: fingerprint(decision.topology.traceId),
      chainFingerprint: fingerprint(decision.topology.chainId),
      delegateFingerprint: fingerprint(
        `${decision.topology.delegateIdentity}:${decision.topology.reasonLength}`,
      ),
    },
  };
}

function canonicalPayload(receipt) {
  const payload = {
    schema: receipt.schema,
    row: receipt.row,
    authoritativeSource: receipt.authoritativeSource,
    candidateOnly: receipt.candidateOnly,
    foldRequiresReview: receipt.foldRequiresReview,
    verdict: receipt.verdict,
    ...(receipt.verdict === 'PARTIAL-candidate'
      ? { failureCategory: receipt.failureCategory }
      : {
          lifecycle: Object.fromEntries(
            PASS_LIFECYCLE_KEYS.map((key) => [key, receipt.lifecycle?.[key]]),
          ),
        }),
    binding: {
      localEvidenceFingerprint: receipt.binding?.localEvidenceFingerprint,
      correlationFingerprint: receipt.binding?.correlationFingerprint,
    },
  };
  return JSON.stringify(payload);
}

export function issueRcd2LifecycleReceipt({ evidence, correlation, signingKey: key }) {
  const secret = signingKey(key);
  if (!secret) throw new Error('missing-r-cd-2-receipt-signing-key');
  const receipt = unsignedReceipt({ evidence, correlation });
  return {
    ...receipt,
    integrity: {
      algorithm: 'hmac-sha256-gateway-token-v1',
      signature: createHmac('sha256', secret).update(canonicalPayload(receipt)).digest('hex'),
    },
  };
}

function shapeValidation(receipt, key) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return { valid: false, reason: 'missing-receipt' };
  }
  const expectedRoot = receipt.verdict === 'PASS-candidate' ? PASS_ROOT_KEYS : PARTIAL_ROOT_KEYS;
  if (!hasExactKeys(receipt, expectedRoot)) return { valid: false, reason: 'unknown-or-missing-root-field' };
  if (
    receipt.schema !== R_CD_2_RECEIPT_SCHEMA ||
    receipt.row !== 'R-CD-2' ||
    receipt.authoritativeSource !== 'r-cd-2-lifecycle-resolver' ||
    receipt.candidateOnly !== true ||
    receipt.foldRequiresReview !== true
  ) return { valid: false, reason: 'wrong-schema-row-source-or-candidate-guard' };
  if (
    !hasExactKeys(receipt.binding, BINDING_KEYS) ||
    !bindingShape(receipt.binding.localEvidenceFingerprint) ||
    !bindingShape(receipt.binding.correlationFingerprint)
  ) return { valid: false, reason: 'missing-or-invalid-private-binding' };
  if (
    !hasExactKeys(receipt.integrity, INTEGRITY_KEYS) ||
    receipt.integrity.algorithm !== 'hmac-sha256-gateway-token-v1' ||
    !bindingShape(receipt.integrity.signature)
  ) return { valid: false, reason: 'invalid-receipt-integrity' };

  const secret = signingKey(key);
  if (!secret) return { valid: false, reason: 'missing-r-cd-2-receipt-signing-key' };
  const expectedSignature = createHmac('sha256', secret)
    .update(canonicalPayload(receipt))
    .digest('hex');
  if (!timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(receipt.integrity.signature, 'hex'),
  )) return { valid: false, reason: 'invalid-receipt-integrity' };

  if (receipt.verdict === 'PARTIAL-candidate') {
    return R_CD_2_FAILURE_CATEGORIES.has(receipt.failureCategory)
      ? { valid: true }
      : { valid: false, reason: 'unknown-failure-category' };
  }
  if (receipt.verdict !== 'PASS-candidate') return { valid: false, reason: 'invalid-verdict' };
  if (!hasExactKeys(receipt.lifecycle, new Set(PASS_LIFECYCLE_KEYS))) {
    return { valid: false, reason: 'unknown-or-missing-lifecycle-field' };
  }
  const booleans = [
    'sameTrace', 'sameChain', 'sameDelegate', 'typedDelegateAccepted',
    'dispatchObserved', 'fireObserved', 'terminalSuccessObserved',
    'unboundSessionVerified', 'noChannelVerified',
  ];
  if (
    receipt.lifecycle.typedTool !== 'continue_delegate' ||
    receipt.lifecycle.observedMode !== 'silent-wake' ||
    booleans.some((keyName) => receipt.lifecycle[keyName] !== true) ||
    !fingerprintShape(receipt.lifecycle.runFingerprint) ||
    !fingerprintShape(receipt.lifecycle.traceFingerprint) ||
    !fingerprintShape(receipt.lifecycle.chainFingerprint) ||
    !fingerprintShape(receipt.lifecycle.delegateFingerprint)
  ) return { valid: false, reason: 'invalid-pass-topology' };
  return { valid: true };
}

function publicProjection(receipt) {
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
  return receipt.verdict === 'PARTIAL-candidate'
    ? { ...projected, failureCategory: receipt.failureCategory }
    : {
        ...projected,
        lifecycle: Object.fromEntries(
          PASS_LIFECYCLE_KEYS.map((key) => [key, receipt.lifecycle[key]]),
        ),
      };
}

export function validateAndProjectRcd2LifecycleReceipt({
  receipt,
  evidence,
  correlation,
  signingKey: key,
}) {
  const validation = shapeValidation(receipt, key);
  if (!validation.valid) return validation;
  const expected = issueRcd2LifecycleReceipt({ evidence, correlation, signingKey: key });
  if (
    canonicalPayload(receipt) !== canonicalPayload(expected) ||
    receipt.integrity.signature !== expected.integrity.signature
  ) return { valid: false, reason: 'receipt-private-input-mismatch' };
  return {
    valid: true,
    verdict: receipt.verdict,
    publicReceipt: publicProjection(receipt),
  };
}
