// Gateway agent lifecycle events carry their run identity at the event
// envelope. sessions.send returns that same `runId` (the idempotency key when
// supplied). Do not accept lookalike nested IDs: they can belong to a tool,
// provider attempt, or unrelated turn and would splice evidence across runs.
export function gatewayLifecycleRunId(value) {
  return value && typeof value === 'object' && typeof value.runId === 'string' && value.runId.length > 0
    ? value.runId
    : null;
}

// Gateway lifecycle identity lives on the event envelope.  `session.message`
// is transcript content and deliberately carries no authoritative run id in
// the deployed protocol.  Keep the distinction explicit so a delayed message
// can never be promoted into a wake receipt by shape guessing.
export function gatewayLifecyclePhase(value) {
  if (!gatewayLifecycleRunId(value)) return null;
  if (String(value.stream || '').toLowerCase() !== 'lifecycle') return null;
  const phase = String(value.data?.phase || '').toLowerCase();
  return phase === 'start' || phase === 'end' ? phase : null;
}

// A successful runtime terminal carries no `status` at all: the live event at
// openclaw 41b8d69b90 / 14d31a81b1 is { phase: "end", aborted: false,
// stopReason: "stop", executionSettled: true, ... } (codex harness
// buildCodexLifecycleTerminalMeta returns undefined on success; failures set
// status "timed_out" or "cancelled"). Success therefore requires an explicit
// aborted:false, no error, and either no status or the legacy "ok".
export function gatewayLifecycleSucceeded(value) {
  if (gatewayLifecyclePhase(value) !== 'end') return false;
  const data = value.data;
  // A yielded end is paused (continue_work), not terminal success; the gateway
  // emitter defaults aborted:false, so the yield marker must be checked itself.
  if (data.aborted === true || data.error !== undefined || data.yielded === true) return false;
  const status = data.status;
  if (status === undefined) return data.aborted === false;
  return typeof status === 'string' && status.toLowerCase() === 'ok';
}

export function gatewayLifecycleSessionKey(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidates = [value.sessionKey, value.session]
    .filter((candidate) => typeof candidate === 'string' && candidate.length > 0);
  const unique = [...new Set(candidates)];
  return unique.length === 1 ? unique[0] : null;
}

export function gatewayWakeRunId(value, acceptedRunId, expectedSessionKey) {
  const runId = gatewayLifecycleRunId(value);
  const sessionKey = gatewayLifecycleSessionKey(value);
  return runId &&
    runId !== acceptedRunId &&
    gatewayLifecyclePhase(value) === 'start' &&
    sessionKey === expectedSessionKey
    ? runId
    : null;
}

// R-CD-2 silent-wake binding. A wake START is a session-bound, in-window
// lifecycle start of a run other than the dispatch run; it binds only when that
// same run gives its own wake receipt, in either order. Two receipt forms:
// - 'heartbeat-completion-record': the { notify:false, outcome:"done" } record
//   a heartbeat wake writes through heartbeat_respond (openclaw 14d31a81b1,
//   whose targeting still woke through requestHeartbeatNow). The record comes
//   from the woken run, so it arrives AFTER that run's start.
// - 'assistant-wake-ack': the exact nonce-bound acknowledgement the woken run
//   answers in assistant text. From openclaw 8baac2feb6 (#1475) a delegate
//   return wakes an ordinary session-event turn (requestContinuationWake ->
//   enqueueSessionEventForHost): no heartbeat_respond exists there, its input
//   rows are hidden from session.message, and its lifecycle data names no
//   delegate, so the run's own answer is the only run-bound wake receipt.
export function createSilentWakeBinder({ acceptedRunId }) {
  const starts = new Map();
  const receipts = new Map();
  let bound = null;
  const bind = (runId) => {
    if (bound || !starts.has(runId) || !receipts.has(runId)) return null;
    bound = { runId, ...starts.get(runId), receiptSource: receipts.get(runId) };
    return bound;
  };
  const noteWakeReceipt = (runId, source) => {
    if (!runId || runId === acceptedRunId || typeof source !== 'string' || !source) return null;
    if (!receipts.has(runId)) receipts.set(runId, source);
    return bind(runId);
  };
  return {
    noteStart(runId, meta = {}) {
      if (!runId || runId === acceptedRunId || starts.has(runId)) return null;
      starts.set(runId, meta);
      return bind(runId);
    },
    noteWakeReceipt,
    noteCompletionRecord(runId) {
      return noteWakeReceipt(runId, 'heartbeat-completion-record');
    },
    bound: () => bound,
  };
}

// Run identity of a transcript/agent event: the envelope runId, else the
// transcript row's own __openclaw.runId (session.message carries it there).
export function eventRunId(eventData) {
  return gatewayLifecycleRunId(eventData) ||
    (typeof eventData?.message?.__openclaw?.runId === 'string' && eventData.message.__openclaw.runId) ||
    null;
}
