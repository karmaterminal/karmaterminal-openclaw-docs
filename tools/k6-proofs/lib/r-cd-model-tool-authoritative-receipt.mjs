import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  classifyRcdModelToolVerdict,
  RCD_MODEL_TOOL_REQUIRED_MODEL,
} from './r-cd-model-tool-verdict.js';

export const R_CD_MODEL_TOOL_RECEIPT_SCHEMA =
  'openclaw.k6.r-cd-model-tool-authoritative-receipt.v1';

const HEX_16 = /^[a-f0-9]{16}$/i;
const HEX_32 = /^[a-f0-9]{32}$/i;
const HEX_64 = /^[a-f0-9]{64}$/i;
const NO_VERDICT_CATEGORIES = new Set([
  'missing-continuation-topology',
  'invalid-continuation-topology',
  'missing-model-execution',
  'ambiguous-model-execution',
  'incomplete-model-execution',
  'incomplete-row-lifecycle',
  'invalid-model-request',
]);

const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fingerprint = (value) =>
  createHash('sha256').update(String(value ?? '')).digest('hex').slice(0, 16);

function canonical(receipt) {
  return JSON.stringify({
    schema: receipt.schema,
    row: receipt.row,
    authoritativeSource: receipt.authoritativeSource,
    candidateOnly: receipt.candidateOnly,
    foldRequiresReview: receipt.foldRequiresReview,
    verdict: receipt.verdict,
    failureCategory: receipt.failureCategory || null,
    binding: receipt.binding,
    lifecycle: receipt.lifecycle || null,
    execution: receipt.execution || null,
  });
}

function seal(receipt, key) {
  if (typeof key !== 'string' || !key) throw new Error('missing gateway signing key');
  return {
    ...receipt,
    integrity: {
      algorithm: 'hmac-sha256-gateway-token-v1',
      signature: createHmac('sha256', key).update(canonical(receipt)).digest('hex'),
    },
  };
}

function topologyPasses(correlation, evidence) {
  return correlation?.row === 'R-CD-MODEL-TOOL' &&
    correlation?.continuation?.tool === 'continue_delegate' &&
    correlation?.delegate?.mode === 'normal' &&
    correlation?.sameTrace === true &&
    correlation?.distinctSpans === true &&
    HEX_32.test(correlation?.traceId || '') &&
    HEX_16.test(correlation?.dispatchSpanId || '') &&
    HEX_16.test(correlation?.fireSpanId || '') &&
    correlation.dispatchSpanId !== correlation.fireSpanId &&
    HEX_32.test(evidence?.accepted_send_trace_id || '') &&
    correlation.rowBinding?.acceptedSendTraceId === evidence.accepted_send_trace_id &&
    correlation.traceId === evidence.accepted_send_trace_id;
}

function lifecycle(evidence) {
  return {
    rowBound: evidence?.row === 'R-CD-MODEL-TOOL',
    requestedModelBound:
      evidence?.requested_model_byte === RCD_MODEL_TOOL_REQUIRED_MODEL,
    manifestModelBound: evidence?.manifest_model_matches_required === true,
    dispatchAccepted: evidence?.dispatch_accepted === true,
    parentScheduledSentinel: evidence?.parent_scheduled_sentinel === true,
    childSessionObserved: evidence?.child_session_observed === true,
    returnPayloadObserved: evidence?.return_payload === true,
    disposableSessionVerified:
      evidence?.disposable_session_required !== true || evidence?.session_created === true,
  };
}

function lifecyclePasses(value) {
  return Object.values(value).every((entry) => entry === true);
}

function failureCategory(correlation, classification, lifecycleReceipt, evidence) {
  if (!correlation) return 'missing-continuation-topology';
  if (!lifecycleReceipt.rowBound ||
      !lifecycleReceipt.requestedModelBound ||
      !lifecycleReceipt.manifestModelBound) {
    return 'invalid-model-request';
  }
  if (!topologyPasses(correlation, evidence)) {
    return 'invalid-continuation-topology';
  }
  if (correlation.modelExecution?.bound !== true) {
    return Number(correlation.modelExecution?.childHarnessCount) > 1
      ? 'ambiguous-model-execution'
      : 'missing-model-execution';
  }
  if (classification.verdict === 'FAIL-candidate') return 'execution-model-mismatch';
  if (correlation.modelExecution?.complete !== true) return 'incomplete-model-execution';
  if (!lifecyclePasses(lifecycleReceipt)) return 'incomplete-row-lifecycle';
  return 'incomplete-model-execution';
}

export function resolveRcdModelToolAuthoritativeReceipt({
  evidence,
  correlation,
  signingKey,
}) {
  const lifecycleReceipt = lifecycle(evidence);
  const classification = classifyRcdModelToolVerdict({
    ...evidence,
    modelExecution: topologyPasses(correlation, evidence) ? correlation.modelExecution : null,
  });
  const base = {
    schema: R_CD_MODEL_TOOL_RECEIPT_SCHEMA,
    row: 'R-CD-MODEL-TOOL',
    authoritativeSource: 'r-cd-model-tool-row-scoped-resolver',
    candidateOnly: true,
    foldRequiresReview: true,
    verdict: classification.verdict,
    failureCategory:
      classification.verdict === 'PASS-candidate'
        ? null
        : failureCategory(correlation, classification, lifecycleReceipt, evidence),
    binding: {
      localEvidenceFingerprint: digest({
        row: evidence?.row || null,
        nonce: fingerprint(evidence?.nonce),
        session: fingerprint(evidence?.child_session_key),
        dispatchAccepted: lifecycleReceipt.dispatchAccepted,
        acceptedSendTrace: fingerprint(evidence?.accepted_send_trace_id),
        parentScheduledSentinel: lifecycleReceipt.parentScheduledSentinel,
        childSessionObserved: lifecycleReceipt.childSessionObserved,
        returnPayloadObserved: lifecycleReceipt.returnPayloadObserved,
        disposableSessionVerified: lifecycleReceipt.disposableSessionVerified,
      }),
      topologyFingerprint: digest({
        trace: correlation?.traceId || null,
        chain: correlation?.chainId || null,
        dispatch: correlation?.dispatchSpanId || null,
        fire: correlation?.fireSpanId || null,
        reason: correlation?.reason || null,
        rowBinding: correlation?.rowBinding || null,
        execution: correlation?.modelExecution || null,
      }),
    },
    lifecycle: lifecycleReceipt,
    execution: correlation?.modelExecution?.bound === true
      ? {
          targetIdentity: RCD_MODEL_TOOL_REQUIRED_MODEL,
          traceId: correlation.traceId,
          chainId: correlation.chainId,
          childHarnessSpanId: correlation.modelExecution.childHarnessSpanId,
          childRunSpanId: correlation.modelExecution.childRunSpanId,
          calls: correlation.modelExecution.calls,
        }
      : null,
  };
  return seal(base, signingKey);
}

export function validateRcdModelToolAuthoritativeReceipt(receipt, key) {
  if (!receipt ||
      receipt.schema !== R_CD_MODEL_TOOL_RECEIPT_SCHEMA ||
      receipt.row !== 'R-CD-MODEL-TOOL' ||
      receipt.authoritativeSource !== 'r-cd-model-tool-row-scoped-resolver' ||
      receipt.candidateOnly !== true ||
      receipt.foldRequiresReview !== true ||
      !HEX_64.test(receipt.binding?.localEvidenceFingerprint || '') ||
      !HEX_64.test(receipt.binding?.topologyFingerprint || '') ||
      receipt.integrity?.algorithm !== 'hmac-sha256-gateway-token-v1' ||
      !HEX_64.test(receipt.integrity?.signature || '') ||
      typeof key !== 'string' ||
      !key) {
    return { valid: false, reason: 'invalid-shape' };
  }
  const expected = createHmac('sha256', key).update(canonical(receipt)).digest('hex');
  if (!timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(receipt.integrity.signature, 'hex'),
  )) {
    return { valid: false, reason: 'invalid-integrity' };
  }

  if (receipt.verdict === null) {
    return NO_VERDICT_CATEGORIES.has(receipt.failureCategory)
      ? { valid: true, verdict: null }
      : { valid: false, reason: 'invalid-no-verdict-category' };
  }

  const execution = receipt.execution;
  const calls = Array.isArray(execution?.calls) ? execution.calls : [];
  const executionShape = execution?.targetIdentity === RCD_MODEL_TOOL_REQUIRED_MODEL &&
    HEX_32.test(execution?.traceId || '') &&
    typeof execution?.chainId === 'string' &&
    execution.chainId.length > 0 &&
    HEX_16.test(execution?.childHarnessSpanId || '') &&
    HEX_16.test(execution?.childRunSpanId || '') &&
    calls.length > 0 &&
    calls.every((call) =>
      HEX_16.test(call?.spanId || '') &&
      ['UNSET', 'OK'].includes(call?.status) &&
      typeof call?.provider === 'string' &&
      typeof call?.model === 'string' &&
      call?.complete === true &&
      call.identity === (call.model.startsWith(`${call.provider}/`)
        ? call.model
        : `${call.provider}/${call.model}`));
  if (!executionShape) return { valid: false, reason: 'invalid-execution-shape' };

  const identities = calls.map((call) => call.identity);
  if (receipt.verdict === 'PASS-candidate') {
    const pass = lifecyclePasses(receipt.lifecycle) &&
      identities.every((identity) => identity === RCD_MODEL_TOOL_REQUIRED_MODEL) &&
      receipt.failureCategory == null;
    return pass
      ? { valid: true, verdict: receipt.verdict }
      : { valid: false, reason: 'invalid-pass-authority' };
  }
  if (receipt.verdict === 'FAIL-candidate') {
    const fail = receipt.failureCategory === 'execution-model-mismatch' &&
      identities.some((identity) => identity !== RCD_MODEL_TOOL_REQUIRED_MODEL);
    return fail
      ? { valid: true, verdict: receipt.verdict }
      : { valid: false, reason: 'invalid-fail-authority' };
  }
  return { valid: false, reason: 'invalid-verdict' };
}
