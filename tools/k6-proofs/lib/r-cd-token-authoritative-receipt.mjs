import { createHash } from 'node:crypto';
import { classifyTokenEvidence } from './r-cd-token-contract.js';
import {
  GATEWAY_HMAC_RECEIPT_ALGORITHM,
  sealSignedObserverReceipt,
  validateSignedObserverReceiptIntegrity,
} from './signed-observer-receipt.mjs';

export const R_CD_TOKEN_RECEIPT_SCHEMA = 'openclaw.k6.r-cd-token-authoritative-receipt.v1';
const SHA = /^[a-f0-9]{40}$/;

function hex(value, length) {
  return typeof value === 'string' &&
    new RegExp(`^[a-f0-9]{${length}}$`, 'i').test(value);
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

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
  });
}

function seal(receipt, key) {
  return sealSignedObserverReceipt({
    receipt,
    signingKey: key,
    canonicalize: canonical,
  });
}

function topologyPasses(correlation) {
  return correlation?.continuation?.tool === 'continue_delegate' &&
    correlation?.continuation?.originSurface === 'raw-final-text' &&
    Array.isArray(correlation?.toolSpanIds) && correlation.toolSpanIds.length === 0 &&
    hex(correlation?.traceId, 32) &&
    typeof correlation?.chainId === 'string' && correlation.chainId.length > 0 &&
    hex(correlation?.dispatchSpanId, 16) &&
    hex(correlation?.fireSpanId, 16) &&
    correlation.dispatchSpanId !== correlation.fireSpanId &&
    correlation?.sameTrace === true &&
    correlation?.distinctSpans === true;
}

function sameReasonBinding(evidence, correlation) {
  return evidence?.reason_hash === correlation?.reason?.hash &&
    Number(evidence?.reason_length) === Number(correlation?.reason?.length);
}

function runtimeIdentityMatches({ candidateSha, runtimeBuildSha, ancillaryRuntime }) {
  if (candidateSha === runtimeBuildSha) return true;
  return ancillaryRuntime?.schema === 'openclaw.k6.ancillary-runtime-provenance.v1' &&
    ancillaryRuntime?.row === 'R-CD-TOKEN' &&
    ancillaryRuntime?.valid === true &&
    ancillaryRuntime?.canonicalSha === candidateSha &&
    ancillaryRuntime?.runtimeSha === runtimeBuildSha &&
    ancillaryRuntime?.canonicalIdentityRemainsPure === true &&
    ancillaryRuntime?.ownerPathsUnchanged === true &&
    SHA.test(ancillaryRuntime?.canonicalTree || '') &&
    SHA.test(ancillaryRuntime?.runtimeTree || '') &&
    hex(ancillaryRuntime?.contractSha256, 64);
}

function ancillaryRuntimeProvenanceSha256(ancillaryRuntime) {
  if (!ancillaryRuntime) return null;
  return createHash('sha256').update(`${JSON.stringify(ancillaryRuntime, null, 2)}\n`).digest('hex');
}

function partialFailureCategory({
  identityMatches,
  evidenceVerdict,
  correlation,
  reasonMatches,
}) {
  if (!identityMatches) return 'runner-or-build-identity-mismatch';
  if (evidenceVerdict !== 'PASS-candidate') return 'incomplete-or-nonunique-lifecycle';
  if (!correlation) return 'missing-continuation-topology';
  if (!reasonMatches) return 'reason-topology-mismatch';
  return 'invalid-continuation-topology';
}

function runnerIdentityMatches({ evidence, attemptState, metadata, ancillaryRuntime }) {
  const candidateSha = metadata?.candidateSha;
  const runtimeBuildSha = metadata?.runtimeBuildSha;
  const ancillarySha256 = ancillaryRuntimeProvenanceSha256(ancillaryRuntime);
  return metadata?.row === 'R-CD-TOKEN' &&
    SHA.test(candidateSha || '') &&
    SHA.test(runtimeBuildSha || '') &&
    runtimeIdentityMatches({ candidateSha, runtimeBuildSha, ancillaryRuntime }) &&
    attemptState?.schema === 'openclaw.k6.r-cd-token.attempt-state.v1' &&
    attemptState?.row === 'R-CD-TOKEN' &&
    attemptState?.attemptIdHash === evidence?.attempt_id_hash &&
    attemptState?.rowNonceHash === evidence?.row_nonce_hash &&
    attemptState?.candidateSha === candidateSha &&
    attemptState?.runtimeBuildSha === runtimeBuildSha &&
    (candidateSha === runtimeBuildSha ||
      attemptState?.runtimeProvenanceSha256 === ancillarySha256) &&
    attemptState?.automaticRetryAllowed === false &&
    evidence?.candidateSha === candidateSha &&
    evidence?.runtimeBuildSha === runtimeBuildSha;
}

export function resolveRcdTokenAuthoritativeReceipt({
  evidence,
  correlation,
  attemptState,
  metadata,
  ancillaryRuntime,
  signingKey,
}) {
  const identityMatches = runnerIdentityMatches({
    evidence,
    attemptState,
    metadata,
    ancillaryRuntime,
  });
  const ancillaryRuntimeSha256 = ancillaryRuntimeProvenanceSha256(ancillaryRuntime);
  const evidenceVerdict = identityMatches ? classifyTokenEvidence(evidence) : 'PARTIAL-candidate';
  const topologyMatches = topologyPasses(correlation);
  const reasonMatches = sameReasonBinding(evidence, correlation);
  const ancillaryRuntimeUsed = metadata?.candidateSha !== metadata?.runtimeBuildSha;
  const base = {
    schema: R_CD_TOKEN_RECEIPT_SCHEMA,
    row: 'R-CD-TOKEN',
    authoritativeSource: 'r-cd-token-row-scoped-resolver',
    candidateOnly: true,
    foldRequiresReview: true,
    binding: {
      candidateSha: metadata?.candidateSha || null,
      runtimeBuildSha: metadata?.runtimeBuildSha || null,
      ancillaryRuntimeProvenanceSha256: ancillaryRuntimeSha256,
      localEvidenceFingerprint: digest({
        attempt: evidence?.attempt_id_hash || null,
        runnerAttempt: attemptState?.attemptIdHash || null,
        nonce: evidence?.row_nonce_hash || null,
        runnerNonce: attemptState?.rowNonceHash || null,
        sessionCreated: evidence?.session_created === true,
        disposableOriginReady: evidence?.disposable_origin_ready === true,
        send: evidence?.send_run_id_hash || null,
        origin: evidence?.origin_run_id_hash || null,
        delegate: evidence?.delegate_run_id_hash || null,
        returnTarget: evidence?.return_target_session_hash || null,
        returnSource: evidence?.return_source_session_hash || null,
        reason: evidence?.reason_hash || null,
        length: evidence?.reason_length || null,
      }),
      topologyFingerprint: digest({
        trace: correlation?.traceId || null,
        chain: correlation?.chainId || null,
        dispatch: correlation?.dispatchSpanId || null,
        fire: correlation?.fireSpanId || null,
        reason: correlation?.reason || null,
        origin: correlation?.continuation?.originSurface || null,
      }),
    },
  };

  if (evidenceVerdict !== 'PASS-candidate' || !topologyMatches || !reasonMatches) {
    return seal({
      ...base,
      verdict: 'PARTIAL-candidate',
      failureCategory: partialFailureCategory({
        identityMatches,
        evidenceVerdict,
        correlation,
        reasonMatches,
      }),
    }, signingKey);
  }

  return seal({
    ...base,
    verdict: 'PASS-candidate',
    lifecycle: {
      surfaceClass: 'raw-final-text',
      disposableOriginReady: true,
      parserDetected: true,
      exactlyOneOriginTask: true,
      exactlyOneTokenDelegateTask: true,
      taskLedgerFullyPaginated: true,
      childCompleted: true,
      parentReturnObserved: true,
      returnBoundToDelegateChild: true,
      delegateOwnedByOriginChild: true,
      noTypedToolOrigin: true,
      ancillaryRuntime: ancillaryRuntimeUsed,
      sameTrace: true,
      sameChain: true,
      attemptIdHash: evidence.attempt_id_hash,
      rowNonceHash: evidence.row_nonce_hash,
      sendRunIdHash: evidence.send_run_id_hash,
      originRunIdHash: evidence.origin_run_id_hash,
      delegateRunIdHash: evidence.delegate_run_id_hash,
      returnTargetSessionHash: evidence.return_target_session_hash,
      returnSourceSessionHash: evidence.return_source_session_hash,
      traceFingerprint: createHash('sha256').update(correlation.traceId).digest('hex').slice(0, 16),
      chainFingerprint: createHash('sha256').update(correlation.chainId).digest('hex').slice(0, 16),
    },
  }, signingKey);
}

export function validateRcdTokenAuthoritativeReceipt(receipt, key) {
  if (!receipt ||
      receipt.schema !== R_CD_TOKEN_RECEIPT_SCHEMA ||
      receipt.row !== 'R-CD-TOKEN' ||
      receipt.authoritativeSource !== 'r-cd-token-row-scoped-resolver' ||
      receipt.candidateOnly !== true ||
      receipt.foldRequiresReview !== true ||
      !SHA.test(receipt.binding?.candidateSha || '') ||
      !SHA.test(receipt.binding?.runtimeBuildSha || '') ||
      (receipt.binding.runtimeBuildSha !== receipt.binding.candidateSha &&
        !hex(receipt.binding?.ancillaryRuntimeProvenanceSha256, 64)) ||
      !hex(receipt.binding?.localEvidenceFingerprint, 64) ||
      !hex(receipt.binding?.topologyFingerprint, 64) ||
      receipt.integrity?.algorithm !== GATEWAY_HMAC_RECEIPT_ALGORITHM ||
      !hex(receipt.integrity?.signature, 64) ||
      typeof key !== 'string' || !key) {
    return { valid: false, reason: 'invalid-shape' };
  }
  if (!validateSignedObserverReceiptIntegrity({
    receipt,
    signingKey: key,
    canonicalize: canonical,
  })) {
    return { valid: false, reason: 'invalid-integrity' };
  }
  if (receipt.verdict !== 'PASS-candidate') {
    return receipt.verdict === 'PARTIAL-candidate' &&
      typeof receipt.failureCategory === 'string'
      ? { valid: true, verdict: receipt.verdict }
      : { valid: false, reason: 'invalid-non-pass' };
  }
  const lifecycle = receipt.lifecycle;
  const requiredTrue = [
    'disposableOriginReady', 'parserDetected', 'exactlyOneOriginTask', 'exactlyOneTokenDelegateTask',
    'taskLedgerFullyPaginated', 'childCompleted', 'parentReturnObserved',
    'returnBoundToDelegateChild', 'delegateOwnedByOriginChild', 'noTypedToolOrigin',
    'sameTrace', 'sameChain',
  ];
  const hashes = [
    'attemptIdHash', 'rowNonceHash', 'sendRunIdHash', 'originRunIdHash',
    'delegateRunIdHash', 'returnTargetSessionHash', 'returnSourceSessionHash',
    'traceFingerprint', 'chainFingerprint',
  ];
  const pass = lifecycle?.surfaceClass === 'raw-final-text' &&
    typeof lifecycle?.ancillaryRuntime === 'boolean' &&
    (receipt.binding.runtimeBuildSha === receipt.binding.candidateSha
      ? lifecycle.ancillaryRuntime === false
      : lifecycle.ancillaryRuntime === true) &&
    requiredTrue.every((name) => lifecycle[name] === true) &&
    hashes.every((name) => hex(lifecycle?.[name], 16)) &&
    lifecycle.originRunIdHash !== lifecycle.delegateRunIdHash &&
    lifecycle.returnTargetSessionHash !== lifecycle.returnSourceSessionHash;
  return pass
    ? { valid: true, verdict: receipt.verdict }
    : { valid: false, reason: 'invalid-pass-lifecycle' };
}
