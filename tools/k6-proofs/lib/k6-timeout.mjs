// k6's socket.setTimeout rejects a non-positive delay: it throws
// "setTimeout requires a >0 timeout parameter, received 0.00". Inside a
// message handler that throw is caught as a parse error after the caller has
// already set its "scheduled" flag, so the poll never runs and never
// reschedules. R-CW-DELEGATE-SELF attempt 3 (2026-10-05, docs aa6a6525) lost
// every child-hop read this way: child_hop_history_reads 0.
// Every delay handed to socket.setTimeout goes through this clamp.
export function k6TimeoutMs(delayMs) {
  const ms = Number(delayMs);
  return Number.isFinite(ms) && ms >= 1 ? ms : 1;
}
