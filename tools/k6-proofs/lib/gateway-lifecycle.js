// Gateway agent lifecycle events carry their run identity at the event
// envelope. sessions.send returns that same `runId` (the idempotency key when
// supplied). Do not accept lookalike nested IDs: they can belong to a tool,
// provider attempt, or unrelated turn and would splice evidence across runs.
export function gatewayLifecycleRunId(value) {
  return value && typeof value === 'object' && typeof value.runId === 'string' && value.runId.length > 0
    ? value.runId
    : null;
}
