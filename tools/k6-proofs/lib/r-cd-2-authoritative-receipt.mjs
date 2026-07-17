import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// R-CD-2 has one authority.  The scenario gathers private, nonce-bound
// acquisition data; this module joins it with the private Tempo topology and
// emits the only public-safe receipt allowed to promote a candidate verdict.
export const R_CD_2_AUTHORITATIVE_RECEIPT_SCHEMA = 'openclaw.k6.r-cd-2-authoritative-receipt.v1';

const FAILURE_CATEGORIES = new Set([
  'missing-send-run-lifecycle',
  'send-run-mismatch',
  'provider-or-turn-failure',
  'delegate-replay-unsafe',
  'missing-continuation-topology',
  'invalid-continuation-topology',
]);

const hex = (value, length) => typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`, 'i').test(value);
const fingerprint = (value) => createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
const binding = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function canonical(receipt) {
  return JSON.stringify({
    schema: receipt.schema,
    row: receipt.row,
    authoritativeSource: receipt.authoritativeSource,
    candidateOnly: receipt.candidateOnly,
    foldRequiresReview: receipt.foldRequiresReview,
    verdict: receipt.verdict,
    failureCategory: receipt.failureCategory || null,
    lifecycle: receipt.lifecycle || null,
    binding: receipt.binding,
  });
}

function seal(receipt, key) {
  if (typeof key !== 'string' || key.length === 0) throw new Error('missing gateway signing key');
  return {
    ...receipt,
    integrity: {
      algorithm: 'hmac-sha256-gateway-token-v1',
      signature: createHmac('sha256', key).update(canonical(receipt)).digest('hex'),
    },
  };
}

function evidencePasses(evidence) {
  return evidence?.session_created === true &&
    evidence?.session_unbound_confirmed === true &&
    evidence?.send_accepted === true &&
    evidence?.send_run_captured === true &&
    evidence?.terminal_success_same_run === true &&
    evidence?.typed_delegate_success_same_run === true &&
    evidence?.wake_same_run === true &&
    evidence?.post_wake_quiet === true &&
    evidence?.channel_delivery_observed === false &&
    evidence?.dispatch_failure_observed !== true &&
    hex(evidence?.send_run_fingerprint, 16) &&
    evidence.send_run_fingerprint === evidence.terminal_run_fingerprint &&
    evidence.send_run_fingerprint === evidence.wake_run_fingerprint;
}

function topologyPasses(correlation) {
  return correlation?.tool === 'continue_delegate' &&
    correlation?.mode === 'silent-wake' &&
    correlation?.sameTrace === true && correlation?.sameChain === true &&
    correlation?.typedToolObserved === true &&
    correlation?.dispatchObserved === true && correlation?.fireObserved === true &&
    hex(correlation?.traceId, 32) && typeof correlation?.chainId === 'string' && correlation.chainId.length > 0 &&
    hex(correlation?.dispatchSpanId, 16) && hex(correlation?.fireSpanId, 16) &&
    correlation.dispatchSpanId !== correlation.fireSpanId;
}

function categoryFor(evidence, correlation) {
  if (evidence?.failureCategory === 'delegate-replay-unsafe') return 'delegate-replay-unsafe';
  if (evidence?.dispatch_failure_observed) return 'provider-or-turn-failure';
  if (!evidence?.send_run_captured || !evidence?.terminal_success_same_run || !evidence?.wake_same_run) {
    return evidence?.send_run_mismatch ? 'send-run-mismatch' : 'missing-send-run-lifecycle';
  }
  if (!correlation) return 'missing-continuation-topology';
  return 'invalid-continuation-topology';
}

export function resolveRcd2AuthoritativeReceipt({ evidence, correlation, signingKey }) {
  const base = {
    schema: R_CD_2_AUTHORITATIVE_RECEIPT_SCHEMA,
    row: 'R-CD-2',
    authoritativeSource: 'r-cd-2-row-scoped-resolver',
    candidateOnly: true,
    foldRequiresReview: true,
    binding: {
      localEvidenceFingerprint: binding({
        send: evidence?.send_run_fingerprint || null,
        terminal: evidence?.terminal_run_fingerprint || null,
        wake: evidence?.wake_run_fingerprint || null,
        terminalSuccess: evidence?.terminal_success_same_run === true,
        typedDelegate: evidence?.typed_delegate_success_same_run === true,
        quiet: evidence?.post_wake_quiet === true,
        failed: evidence?.dispatch_failure_observed === true,
      }),
      topologyFingerprint: binding({
        trace: correlation?.traceId || null,
        chain: correlation?.chainId || null,
        dispatch: correlation?.dispatchSpanId || null,
        fire: correlation?.fireSpanId || null,
        mode: correlation?.mode || null,
      }),
    },
  };

  if (!evidencePasses(evidence) || !topologyPasses(correlation)) {
    return seal({ ...base, verdict: 'PARTIAL-candidate', failureCategory: categoryFor(evidence, correlation) }, signingKey);
  }

  return seal({
    ...base,
    verdict: 'PASS-candidate',
    lifecycle: {
      typedTool: 'continue_delegate',
      mode: 'silent-wake',
      sameTrace: true,
      sameChain: true,
      typedToolObserved: true,
      dispatchObserved: true,
      fireObserved: true,
      terminalSuccessSameRun: true,
      unboundSessionVerified: true,
      noChannelVerified: true,
      traceFingerprint: fingerprint(correlation.traceId),
      chainFingerprint: fingerprint(correlation.chainId),
      delegateFingerprint: fingerprint(`${correlation.dispatchSpanId}:${correlation.fireSpanId}`),
    },
  }, signingKey);
}

export function validateRcd2AuthoritativeReceipt(receipt, signingKey) {
  if (!receipt || receipt.schema !== R_CD_2_AUTHORITATIVE_RECEIPT_SCHEMA || receipt.row !== 'R-CD-2' ||
      receipt.authoritativeSource !== 'r-cd-2-row-scoped-resolver' || receipt.candidateOnly !== true ||
      receipt.foldRequiresReview !== true || !hex(receipt.binding?.localEvidenceFingerprint, 64) ||
      !hex(receipt.binding?.topologyFingerprint, 64) || receipt.integrity?.algorithm !== 'hmac-sha256-gateway-token-v1' ||
      !hex(receipt.integrity?.signature, 64)) return { valid: false, reason: 'invalid-shape' };
  const expected = createHmac('sha256', signingKey).update(canonical(receipt)).digest('hex');
  if (!timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(receipt.integrity.signature, 'hex'))) return { valid: false, reason: 'invalid-integrity' };
  if (receipt.verdict === 'PARTIAL-candidate') return FAILURE_CATEGORIES.has(receipt.failureCategory)
    ? { valid: true, verdict: receipt.verdict } : { valid: false, reason: 'invalid-failure-category' };
  const life = receipt.lifecycle;
  const pass = receipt.verdict === 'PASS-candidate' && life?.typedTool === 'continue_delegate' && life.mode === 'silent-wake' &&
    ['sameTrace', 'sameChain', 'typedToolObserved', 'dispatchObserved', 'fireObserved', 'terminalSuccessSameRun', 'unboundSessionVerified', 'noChannelVerified'].every((key) => life[key] === true) &&
    hex(life.traceFingerprint, 16) && hex(life.chainFingerprint, 16) && hex(life.delegateFingerprint, 16);
  return pass ? { valid: true, verdict: receipt.verdict } : { valid: false, reason: 'invalid-pass-lifecycle' };
}
