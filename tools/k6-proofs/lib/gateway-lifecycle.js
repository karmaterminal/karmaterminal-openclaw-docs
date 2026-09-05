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

export function gatewayLifecycleSucceeded(value) {
  if (gatewayLifecyclePhase(value) !== 'end') return false;
  const status = value.data?.status;
  return typeof status === 'string' && status.toLowerCase() === 'ok';
}

export function gatewayWakeRunId(value, acceptedRunId) {
  const runId = gatewayLifecycleRunId(value);
  return runId && runId !== acceptedRunId && gatewayLifecyclePhase(value) === 'start' ? runId : null;
}
