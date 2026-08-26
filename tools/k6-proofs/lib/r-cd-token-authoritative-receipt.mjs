import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { classifyTokenEvidence } from './r-cd-token-contract.js';

export const R_CD_TOKEN_RECEIPT_SCHEMA = 'openclaw.k6.r-cd-token-authoritative-receipt.v1';
const SHA = /^[a-f0-9]{40}$/;
const hex = (value, length) => typeof value === 'string' &&
  new RegExp(`^[a-f0-9]{${length}}$`, 'i').test(value);
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

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
  if (typeof key !== 'string' || !key) throw new Error('missing gateway signing key');
  return {
    ...receipt,
    integrity: {
      algorithm: 'hmac-sha256-gateway-token-v1',
      signature: createHmac('sha256', key).update(canonical(receipt)).digest('hex'),
    },
  };
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

function runnerIdentityMatches({ evidence, attemptState, metadata }) {
  const candidateSha = metadata?.candidateSha;
  const runtimeBuildSha = metadata?.runtimeBuildSha;
  return metadata?.row === 'R-CD-TOKEN' &&
    SHA.test(candidateSha || '') &&
    SHA.test(runtimeBuildSha || '') &&
    candidateSha === runtimeBuildSha &&
    attemptState?.schema === 'openclaw.k6.r-cd-token.attempt-state.v1' &&
    attemptState?.row === 'R-CD-TOKEN' &&
    attemptState?.attemptIdHash === evidence?.attempt_id_hash &&
    attemptState?.rowNonceHash === evidence?.row_nonce_hash &&
    attemptState?.candidateSha === candidateSha &&
    attemptState?.runtimeBuildSha === runtimeBuildSha &&
    attemptState?.automaticRetryAllowed === false &&
    evidence?.candidateSha === candidateSha &&
    evidence?.runtimeBuildSha === runtimeBuildSha;
}

export function resolveRcdTokenAuthoritativeReceipt({
  evidence,
  correlation,
  attemptState,
  metadata,
  signingKey,
}) {
  const identityMatches = runnerIdentityMatches({ evidence, attemptState, metadata });
  const evidenceVerdict = identityMatches ? classifyTokenEvidence(evidence) : 'PARTIAL-candidate';
  const base = {
    schema: R_CD_TOKEN_RECEIPT_SCHEMA,
    row: 'R-CD-TOKEN',
    authoritativeSource: 'r-cd-token-row-scoped-resolver',
    candidateOnly: true,
    foldRequiresReview: true,
    binding: {
      candidateSha: metadata?.candidateSha || null,
      runtimeBuildSha: metadata?.runtimeBuildSha || null,
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
        returnRun: evidence?.origin_return_run_id_hash || null,
        originCursorSnapshotAccepted: evidence?.origin_cursor_snapshot_accepted === true,
        originCursorSnapshotsRejected: evidence?.origin_cursor_snapshots_rejected ?? null,
        returnCursor: evidence?.origin_return_cursor ?? null,
        returnMessageSeq: evidence?.origin_return_message_seq ?? null,
        returnEventCount: evidence?.origin_return_event_count ?? null,
        rootSubstitutedReturnCount: evidence?.root_substituted_return_count ?? null,
        reason: evidence?.reason_hash || null,
        length: evidence?.reason_length || null,
        delegateCorrelationStrategy: evidence?.delegate_correlation_strategy || null,
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

  if (evidenceVerdict !== 'PASS-candidate' ||
      !topologyPasses(correlation) ||
      !sameReasonBinding(evidence, correlation)) {
    const failureCategory = !identityMatches
      ? 'runner-or-build-identity-mismatch'
      : evidenceVerdict !== 'PASS-candidate'
        ? 'incomplete-or-nonunique-lifecycle'
        : !correlation
          ? 'missing-continuation-topology'
          : !sameReasonBinding(evidence, correlation)
            ? 'reason-topology-mismatch'
            : 'invalid-continuation-topology';
    return seal({
      ...base,
      verdict: 'PARTIAL-candidate',
      failureCategory,
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
      delegateCorrelationStrategy: 'disposable-origin-child-lineage',
      taskLedgerFullyPaginated: true,
      childCompleted: true,
      parentReturnObserved: true,
      normalOriginReturnObserved: true,
      exactlyOneNormalOriginReturn: true,
      originCursorSnapshotAccepted: true,
      originReturnAfterInitialCursor: true,
      rootSubstitutedReturn: false,
      returnBoundToDelegateChild: true,
      delegateOwnedByOriginChild: true,
      noTypedToolOrigin: true,
      sameTrace: true,
      sameChain: true,
      attemptIdHash: evidence.attempt_id_hash,
      rowNonceHash: evidence.row_nonce_hash,
      sendRunIdHash: evidence.send_run_id_hash,
      originRunIdHash: evidence.origin_run_id_hash,
      delegateRunIdHash: evidence.delegate_run_id_hash,
      returnTargetSessionHash: evidence.return_target_session_hash,
      returnSourceSessionHash: evidence.return_source_session_hash,
      originReturnRunIdHash: evidence.origin_return_run_id_hash,
      originReturnCursor: evidence.origin_return_cursor,
      originReturnMessageSeq: evidence.origin_return_message_seq,
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
      receipt.binding?.runtimeBuildSha !== receipt.binding.candidateSha ||
      !hex(receipt.binding?.localEvidenceFingerprint, 64) ||
      !hex(receipt.binding?.topologyFingerprint, 64) ||
      receipt.integrity?.algorithm !== 'hmac-sha256-gateway-token-v1' ||
      !hex(receipt.integrity?.signature, 64) ||
      typeof key !== 'string' || !key) {
    return { valid: false, reason: 'invalid-shape' };
  }
  const expected = createHmac('sha256', key).update(canonical(receipt)).digest('hex');
  if (!timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(receipt.integrity.signature, 'hex'))) {
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
    'normalOriginReturnObserved', 'exactlyOneNormalOriginReturn',
    'originCursorSnapshotAccepted', 'originReturnAfterInitialCursor',
    'returnBoundToDelegateChild', 'delegateOwnedByOriginChild', 'noTypedToolOrigin',
    'sameTrace', 'sameChain',
  ];
  const hashes = [
    'attemptIdHash', 'rowNonceHash', 'sendRunIdHash', 'originRunIdHash',
    'delegateRunIdHash', 'returnTargetSessionHash', 'returnSourceSessionHash',
    'originReturnRunIdHash', 'traceFingerprint', 'chainFingerprint',
  ];
  const originReturnCursor = lifecycle?.originReturnCursor;
  const originReturnMessageSeq = lifecycle?.originReturnMessageSeq;
  const pass = lifecycle?.surfaceClass === 'raw-final-text' &&
    lifecycle?.delegateCorrelationStrategy === 'disposable-origin-child-lineage' &&
    requiredTrue.every((name) => lifecycle[name] === true) &&
    lifecycle?.rootSubstitutedReturn === false &&
    hashes.every((name) => hex(lifecycle?.[name], 16)) &&
    Number.isSafeInteger(originReturnCursor) && originReturnCursor >= 0 &&
    Number.isSafeInteger(originReturnMessageSeq) && originReturnMessageSeq > originReturnCursor &&
    lifecycle.originRunIdHash !== lifecycle.delegateRunIdHash &&
    lifecycle.returnTargetSessionHash !== lifecycle.returnSourceSessionHash;
  return pass
    ? { valid: true, verdict: receipt.verdict }
    : { valid: false, reason: 'invalid-pass-lifecycle' };
}
