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

const fingerprintShape = (value) => typeof value === 'string' && /^[a-f0-9]{16}$/i.test(value);
const traceShape = (value) => typeof value === 'string' && /^[a-f0-9]{32}$/i.test(value) && !/^0+$/.test(value);
const spanShape = (value) => typeof value === 'string' && /^[a-f0-9]{16}$/i.test(value) && !/^0+$/.test(value);
const identityShape = (value) => typeof value === 'string' && value.length > 0;

function knownFailureCategory(evidence) {
  const kind = evidence?.failure_receipt?.kind;
  if (R_CD_2_FAILURE_CATEGORIES.has(kind)) return kind;
  if (evidence?.dispatch_replay_unsafe_observed === true) return 'dispatching-turn-replay-invalid';
  if (evidence?.failed_item_observed === true || evidence?.dispatch_failure_observed === true) {
    return 'dispatching-turn-failed';
  }
  return 'missing-local-lifecycle-evidence';
}

export function projectRcd2PrivateLifecycleEvidence(evidence) {
  return {
    row: evidence?.row || null,
    sessionCreated: evidence?.session_created === true,
    sessionUnboundConfirmed: evidence?.session_unbound_confirmed === true,
    toolAccepted: evidence?.tool_accepted === true,
    delegateMode: evidence?.delegate_mode || null,
    reasonHash: evidence?.reason_hash || null,
    reasonLength: Number.isInteger(evidence?.reason_length) ? evidence.reason_length : null,
    sendRunIdCaptured: evidence?.send_run_id_captured === true,
    sendRunFingerprint: evidence?.send_run_fingerprint || null,
    delegateScheduledReceipt: evidence?.delegate_scheduled_receipt === true,
    delegateScheduledRunMatched: evidence?.delegate_scheduled_run_matched === true,
    dispatchTurnCompleted: evidence?.dispatch_turn_completed === true,
    terminalSuccessObserved: evidence?.terminal_success_observed === true,
    terminalRunMatched: evidence?.terminal_run_matched === true,
    terminalRunFingerprint: evidence?.terminal_run_fingerprint || null,
    parentWakeObserved: evidence?.parent_wake_observed === true,
    childFireOrCompletionObserved: evidence?.child_fire_or_completion_observed === true,
    wakeRunMatched: evidence?.wake_run_matched === true,
    wakeRunFingerprint: evidence?.wake_run_fingerprint || null,
    wakeDelaySatisfied: evidence?.wake_delay_satisfied === true,
    postWakeQuietCompleted: evidence?.post_wake_quiet_completed === true,
    channelMessageObserved: evidence?.channel_message_observed === true,
    dispatchFailureObserved: evidence?.dispatch_failure_observed === true,
    dispatchReplayUnsafeObserved: evidence?.dispatch_replay_unsafe_observed === true,
    failedItemObserved: evidence?.failed_item_observed === true,
    failureCategory: knownFailureCategory(evidence),
  };
}

export function classifyRcd2LocalEvidence(evidence) {
  const local = projectRcd2PrivateLifecycleEvidence(evidence);
  const sameRun = fingerprintShape(local.sendRunFingerprint) &&
    local.sendRunFingerprint === local.terminalRunFingerprint &&
    local.sendRunFingerprint === local.wakeRunFingerprint;
  const complete = Boolean(
    local.row === 'R-CD-2' &&
    local.sessionCreated &&
    local.sessionUnboundConfirmed &&
    local.toolAccepted &&
    local.delegateMode === 'silent-wake' &&
    fingerprintShape(local.reasonHash) &&
    Number.isInteger(local.reasonLength) &&
    local.reasonLength > 0 &&
    local.sendRunIdCaptured &&
    local.delegateScheduledReceipt &&
    local.delegateScheduledRunMatched &&
    local.dispatchTurnCompleted &&
    local.terminalSuccessObserved &&
    local.terminalRunMatched &&
    local.parentWakeObserved &&
    local.childFireOrCompletionObserved &&
    local.wakeRunMatched &&
    local.wakeDelaySatisfied &&
    local.postWakeQuietCompleted &&
    !local.channelMessageObserved &&
    !local.dispatchFailureObserved &&
    !local.dispatchReplayUnsafeObserved &&
    !local.failedItemObserved &&
    sameRun
  );
  return {
    complete,
    failureCategory: complete ? null : local.failureCategory,
    projection: local,
  };
}

export function projectRcd2PrivateCorrelation(correlation) {
  const traceId = correlation?.traceId || null;
  const chainId = correlation?.chainId || null;
  // The collector proves this fingerprint on both dispatch and fire spans; the
  // scenario derives the same value from the exact delegated task.
  const delegateIdentity = correlation?.reason?.hash || null;
  const toolSpanIds = Array.isArray(correlation?.toolSpanIds) ? [...correlation.toolSpanIds] : [];
  return {
    schema: correlation?.schema || null,
    row: correlation?.row || null,
    tool: correlation?.continuation?.tool || null,
    dispatchSpan: correlation?.continuation?.acceptSpan || null,
    fireSpan: correlation?.continuation?.fireSpan || null,
    observedMode: correlation?.delegate?.mode || null,
    sameTrace: correlation?.sameTrace === true,
    distinctSpans: correlation?.distinctSpans === true,
    traceId,
    dispatchTraceId: correlation?.dispatchTraceId || traceId,
    fireTraceId: correlation?.fireTraceId || traceId,
    toolTraceIds: Array.isArray(correlation?.toolTraceIds)
      ? [...correlation.toolTraceIds]
      : toolSpanIds.map(() => traceId),
    chainId,
    dispatchChainId: correlation?.dispatchChainId || chainId,
    fireChainId: correlation?.fireChainId || chainId,
    delegateIdentity,
    dispatchDelegateIdentity: correlation?.dispatchDelegateIdentity || delegateIdentity,
    fireDelegateIdentity: correlation?.fireDelegateIdentity || delegateIdentity,
    dispatchSpanId: correlation?.dispatchSpanId || null,
    fireSpanId: correlation?.fireSpanId || null,
    toolSpanIds,
    reasonLength: Number.isInteger(correlation?.reason?.length) ? correlation.reason.length : null,
  };
}

export function classifyRcd2Lifecycle({ evidence, correlation }) {
  const local = classifyRcd2LocalEvidence(evidence);
  if (!local.complete) {
    return {
      verdict: 'PARTIAL-candidate',
      failureCategory: local.failureCategory,
      local,
      topology: null,
    };
  }
  if (!correlation || typeof correlation !== 'object') {
    return {
      verdict: 'PARTIAL-candidate',
      failureCategory: 'missing-lifecycle-correlation',
      local,
      topology: null,
    };
  }

  const topology = projectRcd2PrivateCorrelation(correlation);
  const traceIds = [topology.dispatchTraceId, topology.fireTraceId, ...topology.toolTraceIds];
  const spanIds = [topology.dispatchSpanId, topology.fireSpanId, ...topology.toolSpanIds];
  const complete = Boolean(
    topology.schema === 'openclaw.k6.continuation-trace-correlation.v1' &&
    topology.row === 'R-CD-2' &&
    topology.tool === 'continue_delegate' &&
    topology.dispatchSpan === 'continuation.delegate.dispatch' &&
    topology.fireSpan === 'continuation.delegate.fire' &&
    topology.observedMode === 'silent-wake' &&
    topology.sameTrace &&
    topology.distinctSpans &&
    traceShape(topology.traceId) &&
    traceIds.length >= 3 &&
    traceIds.every((value) => value === topology.traceId) &&
    identityShape(topology.chainId) &&
    topology.dispatchChainId === topology.chainId &&
    topology.fireChainId === topology.chainId &&
    fingerprintShape(topology.delegateIdentity) &&
    topology.delegateIdentity === local.projection.reasonHash &&
    topology.reasonLength === local.projection.reasonLength &&
    topology.dispatchDelegateIdentity === topology.delegateIdentity &&
    topology.fireDelegateIdentity === topology.delegateIdentity &&
    spanIds.length >= 3 &&
    spanIds.every(spanShape) &&
    new Set(spanIds).size === spanIds.length
  );

  return complete
    ? { verdict: 'PASS-candidate', failureCategory: null, local, topology }
    : { verdict: 'PARTIAL-candidate', failureCategory: 'invalid-lifecycle-topology', local, topology };
}
