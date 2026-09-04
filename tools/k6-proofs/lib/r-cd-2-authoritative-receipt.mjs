import { createHash } from 'node:crypto';
import {
  GATEWAY_HMAC_RECEIPT_ALGORITHM,
  sealSignedObserverReceipt,
  validateSignedObserverReceiptIntegrity,
} from './signed-observer-receipt.mjs';

// R-CD-2 has one authority.  The scenario gathers private, nonce-bound
// acquisition data; this module joins it with the private Tempo topology and
// emits the only public-safe receipt allowed to promote a candidate verdict.
export const R_CD_2_AUTHORITATIVE_RECEIPT_SCHEMA = 'openclaw.k6.r-cd-2-authoritative-receipt.v1';

const FAILURE_CATEGORIES = new Set([
  'missing-send-run-lifecycle',
  'send-run-mismatch',
  'provider-or-turn-failure',
  'delegate-replay-unsafe',
  'silent-channel-delivery',
  'missing-terminal-sentinel',
  'send-topology-mismatch',
  'missing-continuation-topology',
  'invalid-continuation-topology',
]);
const CONCLUSIVE_FAILURE_CATEGORIES = new Set([
  'provider-or-turn-failure',
  'delegate-replay-unsafe',
  'silent-channel-delivery',
  'missing-terminal-sentinel',
]);
const LIFECYCLE_DIAGNOSTIC_KEYS = [
  'sessionCreated', 'sessionUnbound', 'sendAccepted', 'sendRunCaptured',
  'dispatchTerminalSentinel', 'dispatchTerminalSentinelSameRun',
  'terminalSuccessSameRun', 'typedDelegateSuccessSameRun', 'wakeLifecycle',
  'postWakeQuiet', 'noChannelDelivery', 'sendRunFingerprint',
  'rowNonceFingerprint', 'terminalRunMatchesSend', 'acceptedSendTraceShape',
  'dispatchAcceptedBeforeSentinel', 'sentinelBeforeLifecycleEnd',
  'lifecycleEndBeforeWake', 'wakeBeforeQuietWindow',
];
const TOPOLOGY_DIAGNOSTIC_KEYS = [
  'typedTool', 'silentWake', 'exactlyOneToolSpan', 'traceId', 'chainId',
  'dispatchSpan', 'fireSpan', 'distinctDispatchAndFire', 'sendRunBinding',
  'nonceBinding', 'acceptedTraceBinding', 'acceptedTraceSource',
];
const JOIN_DIAGNOSTIC_KEYS = ['acceptedTrace', 'acceptedRun', 'rowNonce'];

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
    diagnostics: receipt.diagnostics,
    binding: receipt.binding,
  });
}

function seal(receipt, key) {
  return sealSignedObserverReceipt({
    receipt,
    signingKey: key,
    canonicalize: canonical,
  });
}

function orderedLifecycleChecks(evidence) {
  const accepted = evidence?.dispatch_accepted_at_ms;
  const sentinel = evidence?.dispatch_terminal_sentinel_at_ms;
  const ended = evidence?.dispatch_lifecycle_end_at_ms;
  const wake = evidence?.wake_lifecycle_at_ms;
  const quiet = evidence?.post_wake_quiet_at_ms;
  return {
    dispatchAcceptedBeforeSentinel:
      Number.isFinite(accepted) && Number.isFinite(sentinel) && accepted <= sentinel,
    sentinelBeforeLifecycleEnd:
      Number.isFinite(sentinel) && Number.isFinite(ended) && sentinel <= ended,
    lifecycleEndBeforeWake:
      Number.isFinite(ended) && Number.isFinite(wake) && ended <= wake,
    wakeBeforeQuietWindow:
      Number.isFinite(wake) && Number.isFinite(quiet) && wake <= quiet,
  };
}

function lifecycleChecks(evidence) {
  return {
    sessionCreated: evidence?.session_created === true,
    sessionUnbound: evidence?.session_unbound_confirmed === true,
    sendAccepted: evidence?.send_accepted === true,
    sendRunCaptured: evidence?.send_run_captured === true,
    dispatchTerminalSentinel: evidence?.dispatch_terminal_sentinel_observed === true,
    dispatchTerminalSentinelSameRun: evidence?.dispatch_terminal_sentinel_same_run_window === true,
    terminalSuccessSameRun: evidence?.terminal_success_same_run === true,
    typedDelegateSuccessSameRun: evidence?.typed_delegate_success_same_run === true,
    wakeLifecycle: evidence?.wake_lifecycle_observed === true,
    postWakeQuiet: evidence?.post_wake_quiet === true,
    noChannelDelivery: evidence?.channel_message_observed === false,
    sendRunFingerprint: hex(evidence?.send_run_fingerprint, 16),
    rowNonceFingerprint: hex(evidence?.row_nonce_fingerprint, 16),
    terminalRunMatchesSend: hex(evidence?.send_run_fingerprint, 16) &&
      evidence.send_run_fingerprint === evidence?.terminal_run_fingerprint,
    acceptedSendTraceShape: evidence?.accepted_send_trace_id == null ||
      hex(evidence.accepted_send_trace_id, 32),
    ...orderedLifecycleChecks(evidence),
  };
}

function evidencePasses(evidence) {
  return Object.values(lifecycleChecks(evidence)).every(Boolean) &&
    evidence?.dispatch_failure_observed !== true;
}

function topologyPasses(correlation) {
  // Consume the collector's public continuation schema directly.  Do not
  // accept the old, synthetic top-level `tool`/`mode`/boolean projection: a
  // receipt that the real collector cannot emit must never certify this row.
  return Object.values(topologyChecks(correlation)).every(Boolean);
}

// Prefer an accepted sessions.send trace when the response provides one.
// The deployed response currently omits it, so the only fallback is the one
// trace already selected by this row's unique nonce-derived reason contract.
function sameAcceptedTrace(evidence, correlation) {
  if (hex(evidence?.accepted_send_trace_id, 32)) {
    return correlation?.rowBinding?.acceptedSendTraceSource === 'sessions-send-response' &&
      evidence.accepted_send_trace_id === correlation?.traceId;
  }
  return evidence?.accepted_send_trace_id == null &&
    correlation?.rowBinding?.acceptedSendTraceSource === 'unique-reason-bound-trace' &&
    correlation?.rowBinding?.acceptedSendTraceId === correlation?.traceId;
}

// A matching Tempo trace alone is not a sufficient join: a reused/shared
// trace could otherwise splice one accepted sessions.send lifecycle to a
// different row's continuation topology. The collector copies only opaque
// fingerprints from the private row evidence after it validates the trace's
// nonce-derived reason contract. Require all three identities here.
function sameRowBinding(evidence, correlation) {
  return evidence?.send_run_fingerprint === correlation?.rowBinding?.acceptedSendRunFingerprint &&
    evidence?.row_nonce_fingerprint === correlation?.rowBinding?.nonceFingerprint &&
    sameAcceptedTrace(evidence, correlation);
}

function topologyChecks(correlation) {
  return {
    typedTool: correlation?.continuation?.tool === 'continue_delegate',
    silentWake: correlation?.delegate?.mode === 'silent-wake',
    exactlyOneToolSpan: Array.isArray(correlation?.toolSpanIds) &&
      correlation.toolSpanIds.length === 1 && hex(correlation.toolSpanIds[0], 16),
    traceId: hex(correlation?.traceId, 32),
    chainId: typeof correlation?.chainId === 'string' && correlation.chainId.length > 0,
    dispatchSpan: hex(correlation?.dispatchSpanId, 16),
    fireSpan: hex(correlation?.fireSpanId, 16),
    distinctDispatchAndFire: hex(correlation?.dispatchSpanId, 16) &&
      hex(correlation?.fireSpanId, 16) && correlation.dispatchSpanId !== correlation.fireSpanId,
    sendRunBinding: hex(correlation?.rowBinding?.acceptedSendRunFingerprint, 16),
    nonceBinding: hex(correlation?.rowBinding?.nonceFingerprint, 16),
    acceptedTraceBinding: hex(correlation?.rowBinding?.acceptedSendTraceId, 32),
    acceptedTraceSource: new Set(['sessions-send-response', 'unique-reason-bound-trace'])
      .has(correlation?.rowBinding?.acceptedSendTraceSource),
  };
}

export function rCd2AuthorityChecks(evidence, correlation) {
  const lifecycle = lifecycleChecks(evidence);
  const topology = topologyChecks(correlation);
  const joins = {
    acceptedTrace: sameAcceptedTrace(evidence, correlation),
    acceptedRun: evidence?.send_run_fingerprint ===
      correlation?.rowBinding?.acceptedSendRunFingerprint,
    rowNonce: evidence?.row_nonce_fingerprint === correlation?.rowBinding?.nonceFingerprint,
  };
  return {
    lifecycle,
    topology,
    joins,
    lifecycleComplete: Object.values(lifecycle).every(Boolean),
    topologyComplete: Object.values(topology).every(Boolean),
    joinComplete: Object.values(joins).every(Boolean),
  };
}

function categoryFor(evidence, correlation) {
  if (evidence?.channel_message_observed === true) return 'silent-channel-delivery';
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
  const diagnostics = rCd2AuthorityChecks(evidence, correlation);
  const base = {
    schema: R_CD_2_AUTHORITATIVE_RECEIPT_SCHEMA,
    row: 'R-CD-2',
    authoritativeSource: 'r-cd-2-row-scoped-resolver',
    candidateOnly: true,
    foldRequiresReview: true,
    diagnostics,
    binding: {
      localEvidenceFingerprint: binding({
        send: evidence?.send_run_fingerprint || null,
        terminal: evidence?.terminal_run_fingerprint || null,
        wake: evidence?.wake_run_fingerprint || null,
        acceptedSendTrace: evidence?.accepted_send_trace_id || null,
        nonce: evidence?.row_nonce_fingerprint || null,
        dispatchTerminalSentinel: evidence?.dispatch_terminal_sentinel_observed === true,
        dispatchTerminalSentinelSameRunWindow:
          evidence?.dispatch_terminal_sentinel_same_run_window === true,
        terminalSuccess: evidence?.terminal_success_same_run === true,
        typedDelegate: evidence?.typed_delegate_success_same_run === true,
        quiet: evidence?.post_wake_quiet === true,
        failed: evidence?.dispatch_failure_observed === true,
        replayDiagnostic: evidence?.replay_invalid_observed === true ||
          evidence?.failureCategory === 'delegate-replay-unsafe',
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
    const failureCategory = categoryFor(evidence, correlation);
    return seal({
      ...base,
      verdict: CONCLUSIVE_FAILURE_CATEGORIES.has(failureCategory)
        ? 'FAIL-candidate'
        : 'PARTIAL-candidate',
      failureCategory,
    }, signingKey);
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
      dispatchTerminalSentinelObserved: true,
      dispatchTerminalSentinelSameRunWindow: true,
      terminalSuccessSameRun: true,
      wakeLifecycleObserved: true,
      unboundSessionVerified: true,
      noChannelVerified: true,
      replayDiagnosticObserved: evidence?.replay_invalid_observed === true ||
        evidence?.failureCategory === 'delegate-replay-unsafe',
      traceFingerprint: fingerprint(correlation.traceId),
      acceptedSendTraceFingerprint: fingerprint(correlation.rowBinding.acceptedSendTraceId),
      acceptedSendTraceSource: correlation.rowBinding.acceptedSendTraceSource,
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
      !hex(receipt.binding?.topologyFingerprint, 64) || !validDiagnostics(receipt.diagnostics) ||
      receipt.integrity?.algorithm !== GATEWAY_HMAC_RECEIPT_ALGORITHM ||
      !hex(receipt.integrity?.signature, 64)) return { valid: false, reason: 'invalid-shape' };
  if (!validateSignedObserverReceiptIntegrity({
    receipt,
    signingKey,
    canonicalize: canonical,
  })) return { valid: false, reason: 'invalid-integrity' };
  if (receipt.verdict === 'PARTIAL-candidate') return FAILURE_CATEGORIES.has(receipt.failureCategory) &&
    !CONCLUSIVE_FAILURE_CATEGORIES.has(receipt.failureCategory)
    ? { valid: true, verdict: receipt.verdict } : { valid: false, reason: 'invalid-failure-category' };
  if (receipt.verdict === 'FAIL-candidate') return CONCLUSIVE_FAILURE_CATEGORIES.has(receipt.failureCategory)
    ? { valid: true, verdict: receipt.verdict } : { valid: false, reason: 'invalid-failure-category' };
  const life = receipt.lifecycle;
  const pass = receipt.verdict === 'PASS-candidate' && life?.typedTool === 'continue_delegate' && life.mode === 'silent-wake' &&
    receipt.diagnostics.lifecycleComplete === true && receipt.diagnostics.topologyComplete === true &&
    receipt.diagnostics.joinComplete === true &&
    ['sameTrace', 'sameChain', 'typedToolObserved', 'dispatchObserved', 'fireObserved', 'dispatchTerminalSentinelObserved', 'dispatchTerminalSentinelSameRunWindow', 'terminalSuccessSameRun', 'wakeLifecycleObserved', 'unboundSessionVerified', 'noChannelVerified'].every((key) => life[key] === true) &&
    typeof life.replayDiagnosticObserved === 'boolean' &&
    hex(life.traceFingerprint, 16) && hex(life.acceptedSendTraceFingerprint, 16) &&
    life.traceFingerprint === life.acceptedSendTraceFingerprint &&
    new Set(['sessions-send-response', 'unique-reason-bound-trace']).has(life.acceptedSendTraceSource) &&
    hex(life.acceptedSendRunFingerprint, 16) && hex(life.rowNonceFingerprint, 16) &&
    hex(life.chainFingerprint, 16) && hex(life.delegateFingerprint, 16);
  return pass ? { valid: true, verdict: receipt.verdict } : { valid: false, reason: 'invalid-pass-lifecycle' };
}

function validDiagnostics(diagnostics) {
  if (!diagnostics || typeof diagnostics !== 'object') return false;
  if (!validBooleanMap(diagnostics.lifecycle, LIFECYCLE_DIAGNOSTIC_KEYS) ||
      !validBooleanMap(diagnostics.topology, TOPOLOGY_DIAGNOSTIC_KEYS) ||
      !validBooleanMap(diagnostics.joins, JOIN_DIAGNOSTIC_KEYS)) return false;
  const expectedTopLevel = ['joinComplete', 'joins', 'lifecycle', 'lifecycleComplete', 'topology', 'topologyComplete'];
  if (Object.keys(diagnostics).sort().join('\0') !== expectedTopLevel.sort().join('\0')) return false;
  return diagnostics.lifecycleComplete === Object.values(diagnostics.lifecycle).every(Boolean) &&
    diagnostics.topologyComplete === Object.values(diagnostics.topology).every(Boolean) &&
    diagnostics.joinComplete === Object.values(diagnostics.joins).every(Boolean);
}

function validBooleanMap(value, expectedKeys) {
  return value && typeof value === 'object' &&
    Object.keys(value).sort().join('\0') === [...expectedKeys].sort().join('\0') &&
    Object.values(value).every((entry) => typeof entry === 'boolean');
}
