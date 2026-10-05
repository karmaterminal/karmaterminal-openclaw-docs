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

// R-CD-2 silent-wake binding. The parent's wake turn writes the
// { notify:false, outcome:"done" } completion record itself (heartbeat_respond
// inside the woken run), so the record necessarily arrives AFTER that run's
// lifecycle start. Gating the start on an already-seen record made the wake
// receipt unobtainable. Instead remember every session-bound, in-window start
// of a run other than the dispatch run, and bind when the completion record
// arrives from that same run (either order is accepted).
export function createSilentWakeBinder({ acceptedRunId }) {
  const starts = new Map();
  const records = new Set();
  let bound = null;
  const bind = (runId) => {
    if (bound || !starts.has(runId) || !records.has(runId)) return null;
    bound = { runId, ...starts.get(runId) };
    return bound;
  };
  return {
    noteStart(runId, meta = {}) {
      if (!runId || runId === acceptedRunId || starts.has(runId)) return null;
      starts.set(runId, meta);
      return bind(runId);
    },
    noteCompletionRecord(runId) {
      if (!runId || runId === acceptedRunId) return null;
      records.add(runId);
      return bind(runId);
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
