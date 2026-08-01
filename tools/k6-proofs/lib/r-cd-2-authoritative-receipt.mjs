import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// R-CD-2 has one authority.  The scenario gathers private, nonce-bound
// acquisition data; this module joins it with the private Tempo topology and
// emits the only public-safe receipt allowed to promote a candidate verdict.
export const R_CD_2_AUTHORITATIVE_RECEIPT_SCHEMA = 'openclaw.k6.r-cd-2-authoritative-receipt.v2';

const FAILURE_CATEGORIES = new Set([
  'missing-send-run-lifecycle',
  'send-run-mismatch',
  'provider-or-turn-failure',
  'delegate-replay-unsafe',
  'missing-terminal-sentinel',
  'runtime-selection-unavailable',
  'runtime-selection-mismatch',
  'session-creation-unverified',
  'send-topology-mismatch',
  'missing-continuation-topology',
  'invalid-continuation-topology',
]);
const RUNTIME_SOURCES = new Set([
  'env',
  'agent',
  'defaults',
  'model',
  'provider',
  'implicit',
  'session',
  'session-key',
]);

const hex = (value, length) => typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`, 'i').test(value);
const fingerprint = (value) => createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
const binding = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const runtimeSource = (value) => typeof value === 'string' && RUNTIME_SOURCES.has(value);

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
  return evidence?.default_agent_observed === true &&
    evidence?.session_created === true &&
    evidence?.session_creation_preflight_clear === true &&
    evidence?.session_create_accepted === true &&
    evidence?.session_create_response_verified === true &&
    hex(evidence?.created_session_id_fingerprint, 16) &&
    evidence?.session_unbound_confirmed === true &&
    evidence?.runtime_catalog_observed === true &&
    evidence?.runtime_selection_verified === true &&
    evidence?.selected_session_model_verified === true &&
    evidence?.selected_session_runtime_verified === true &&
    evidence?.selected_execution_runtime_id === 'openclaw' &&
    runtimeSource(evidence?.selected_execution_runtime_source) &&
    evidence?.selected_session_runtime_source === evidence.selected_execution_runtime_source &&
    typeof evidence?.selected_execution_model_provider === 'string' &&
    evidence.selected_execution_model_provider.length > 0 &&
    hex(evidence?.selected_execution_model_fingerprint, 16) &&
    evidence?.runtime_selection_action === 'explicit-create' &&
    evidence?.model_selection_scope === 'new-session-only' &&
    evidence?.sticky_model_mutation_used === false &&
    evidence?.send_accepted === true &&
    evidence?.send_run_captured === true &&
    evidence?.dispatch_terminal_sentinel_observed === true &&
    evidence?.dispatch_terminal_sentinel_same_run_window === true &&
    evidence?.terminal_success_same_run === true &&
    evidence?.typed_delegate_success_same_run === true &&
    evidence?.wake_lifecycle_observed === true &&
    evidence?.post_wake_quiet === true &&
    evidence?.channel_message_observed === false &&
    evidence?.dispatch_failure_observed !== true &&
    hex(evidence?.send_run_fingerprint, 16) &&
    hex(evidence?.row_nonce_fingerprint, 16) &&
    evidence.send_run_fingerprint === evidence.terminal_run_fingerprint &&
    hex(evidence?.accepted_send_trace_id, 32);
}

function topologyPasses(correlation) {
  // Consume the collector's public continuation schema directly.  Do not
  // accept the old, synthetic top-level `tool`/`mode`/boolean projection: a
  // receipt that the real collector cannot emit must never certify this row.
  return correlation?.continuation?.tool === 'continue_delegate' &&
    correlation?.delegate?.mode === 'silent-wake' &&
    Array.isArray(correlation?.toolSpanIds) && correlation.toolSpanIds.length === 1 &&
    hex(correlation.toolSpanIds[0], 16) &&
    hex(correlation?.traceId, 32) && typeof correlation?.chainId === 'string' && correlation.chainId.length > 0 &&
    hex(correlation?.dispatchSpanId, 16) && hex(correlation?.fireSpanId, 16) &&
    correlation.dispatchSpanId !== correlation.fireSpanId &&
    hex(correlation?.rowBinding?.acceptedSendRunFingerprint, 16) &&
    hex(correlation?.rowBinding?.nonceFingerprint, 16) &&
    hex(correlation?.rowBinding?.acceptedSendTraceId, 32);
}

// The accepted sessions.send response is the authority for this row's turn.
// Do not combine its lifecycle with a separately-valid continuation trace.
function sameAcceptedTrace(evidence, correlation) {
  return evidence?.accepted_send_trace_id === correlation?.traceId;
}

// A matching Tempo trace alone is not a sufficient join: a reused/shared
// trace could otherwise splice one accepted sessions.send lifecycle to a
// different row's continuation topology. The collector copies only opaque
// fingerprints from the private row evidence after it validates the trace's
// nonce-derived reason contract. Require all three identities here.
function sameRowBinding(evidence, correlation) {
  return evidence?.send_run_fingerprint === correlation?.rowBinding?.acceptedSendRunFingerprint &&
    evidence?.row_nonce_fingerprint === correlation?.rowBinding?.nonceFingerprint &&
    evidence?.accepted_send_trace_id === correlation?.rowBinding?.acceptedSendTraceId;
}

function categoryFor(evidence, correlation) {
  if (evidence?.failureCategory === 'runtime-selection-unavailable') return 'runtime-selection-unavailable';
  if (evidence?.failureCategory === 'runtime-selection-mismatch') return 'runtime-selection-mismatch';
  if (evidence?.failureCategory === 'session-creation-unverified') return 'session-creation-unverified';
  if (evidence?.failureCategory === 'delegate-replay-unsafe') return 'delegate-replay-unsafe';
  if (evidence?.failureCategory === 'missing-terminal-sentinel') return 'missing-terminal-sentinel';
  if (evidence?.dispatch_failure_observed) return 'provider-or-turn-failure';
  if (evidence?.send_run_captured &&
      (evidence?.dispatch_terminal_sentinel_observed !== true ||
       evidence?.dispatch_terminal_sentinel_same_run_window !== true)) {
    return 'missing-terminal-sentinel';
  }
  if (!evidence?.send_run_captured || !evidence?.terminal_success_same_run || !evidence?.wake_lifecycle_observed) {
    return evidence?.send_run_mismatch ? 'send-run-mismatch' : 'missing-send-run-lifecycle';
  }
  if (!correlation) return 'missing-continuation-topology';
  if (!sameAcceptedTrace(evidence, correlation) || !sameRowBinding(evidence, correlation)) return 'send-topology-mismatch';
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
        acceptedSendTrace: evidence?.accepted_send_trace_id || null,
        nonce: evidence?.row_nonce_fingerprint || null,
        defaultAgentObserved: evidence?.default_agent_observed === true,
        sessionCreationPreflight: evidence?.session_creation_preflight_clear === true,
        sessionCreateAccepted: evidence?.session_create_accepted === true,
        sessionCreateResponseVerified: evidence?.session_create_response_verified === true,
        createdSession: evidence?.created_session_id_fingerprint || null,
        runtimeCatalog: evidence?.runtime_catalog_observed === true,
        runtimeSelection: evidence?.runtime_selection_action || null,
        modelSelectionScope: evidence?.model_selection_scope || null,
        stickyModelMutationUsed: evidence?.sticky_model_mutation_used === true,
        runtime: evidence?.selected_execution_runtime_id || null,
        runtimeSource: evidence?.selected_execution_runtime_source || null,
        sessionRuntimeSource: evidence?.selected_session_runtime_source || null,
        modelProvider: evidence?.selected_execution_model_provider || null,
        model: evidence?.selected_execution_model_fingerprint || null,
        selectedSessionModelVerified: evidence?.selected_session_model_verified === true,
        selectedSessionRuntimeVerified: evidence?.selected_session_runtime_verified === true,
        runtimeSelectionVerified: evidence?.runtime_selection_verified === true,
        dispatchTerminalSentinel: evidence?.dispatch_terminal_sentinel_observed === true,
        dispatchTerminalSentinelSameRunWindow:
          evidence?.dispatch_terminal_sentinel_same_run_window === true,
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
        mode: correlation?.delegate?.mode || null,
        acceptedSendTrace: evidence?.accepted_send_trace_id || null,
        acceptedSendRun: correlation?.rowBinding?.acceptedSendRunFingerprint || null,
        nonce: correlation?.rowBinding?.nonceFingerprint || null,
        topologyAcceptedSendTrace: correlation?.rowBinding?.acceptedSendTraceId || null,
      }),
    },
  };

  if (!evidencePasses(evidence) || !topologyPasses(correlation) || !sameAcceptedTrace(evidence, correlation) || !sameRowBinding(evidence, correlation)) {
    return seal({ ...base, verdict: 'PARTIAL-candidate', failureCategory: categoryFor(evidence, correlation) }, signingKey);
  }

  return seal({
    ...base,
    verdict: 'PASS-candidate',
    lifecycle: {
      typedTool: 'continue_delegate',
      mode: 'silent-wake',
      executionRuntime: 'openclaw',
      executionRuntimeSource: evidence.selected_execution_runtime_source,
      executionModelProvider: evidence.selected_execution_model_provider,
      executionModelFingerprint: evidence.selected_execution_model_fingerprint,
      runtimeSelectionAction: 'explicit-create',
      modelSelectionScope: 'new-session-only',
      defaultAgentObserved: true,
      sessionCreationPreflightVerified: true,
      sessionIdFingerprint: evidence.created_session_id_fingerprint,
      sessionModelVerified: true,
      sessionRuntimeVerified: true,
      stickyModelMutationUsed: false,
      runtimeSelectionVerified: true,
      sameTrace: true,
      sameChain: true,
      typedToolObserved: true,
      dispatchObserved: true,
      fireObserved: true,
      dispatchTerminalSentinelObserved: true,
      dispatchTerminalSentinelSameRunWindow: true,
      terminalSuccessSameRun: true,
      wakeLifecycleObserved: true,
      unboundSessionVerified: true,
      noChannelVerified: true,
      traceFingerprint: fingerprint(correlation.traceId),
      acceptedSendTraceFingerprint: fingerprint(evidence.accepted_send_trace_id),
      acceptedSendRunFingerprint: fingerprint(evidence.send_run_fingerprint),
      rowNonceFingerprint: fingerprint(evidence.row_nonce_fingerprint),
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
    life.executionRuntime === 'openclaw' &&
    runtimeSource(life.executionRuntimeSource) &&
    typeof life.executionModelProvider === 'string' && life.executionModelProvider.length > 0 &&
    hex(life.executionModelFingerprint, 16) &&
    life.runtimeSelectionAction === 'explicit-create' &&
    life.modelSelectionScope === 'new-session-only' &&
    life.stickyModelMutationUsed === false &&
    ['defaultAgentObserved', 'sessionCreationPreflightVerified', 'sessionModelVerified', 'sessionRuntimeVerified', 'runtimeSelectionVerified', 'sameTrace', 'sameChain', 'typedToolObserved', 'dispatchObserved', 'fireObserved', 'dispatchTerminalSentinelObserved', 'dispatchTerminalSentinelSameRunWindow', 'terminalSuccessSameRun', 'wakeLifecycleObserved', 'unboundSessionVerified', 'noChannelVerified'].every((key) => life[key] === true) &&
    hex(life.sessionIdFingerprint, 16) &&
    hex(life.traceFingerprint, 16) && hex(life.acceptedSendTraceFingerprint, 16) &&
    life.traceFingerprint === life.acceptedSendTraceFingerprint &&
    hex(life.acceptedSendRunFingerprint, 16) && hex(life.rowNonceFingerprint, 16) &&
    hex(life.chainFingerprint, 16) && hex(life.delegateFingerprint, 16);
  return pass ? { valid: true, verdict: receipt.verdict } : { valid: false, reason: 'invalid-pass-lifecycle' };
}
