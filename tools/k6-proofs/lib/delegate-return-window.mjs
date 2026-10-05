// When a delegate's return (or the wake it causes) may be counted (docs#564).
//
// A delegate cannot fire before its own delay has elapsed, so the earliest a
// real return can exist is anchor + delayMs. The window opens there. The old
// fixed observation gate (OPENCLAW_MIN_DELEGATE_DELAY_MS, default 5000) is kept
// only as a diagnostic: a fast child that finished inside it was a real return
// that the old rule discarded (R-CD-1 re-run, 77 ms early). R-CD-4 already
// treats its gate as diagnostic-only (lib/r-cd-4-authority.mjs).
//
// Pre-dispatch echoes stay excluded: no anchor (the scheduled sentinel or the
// accepted dispatch) means the window is closed.

export function delegateReturnWindow({ anchorAtMs, delayMs, legacyGateMs, nowMs }) {
  const anchored = Number.isFinite(anchorAtMs);
  const delay = Number.isFinite(delayMs) && delayMs > 0 ? delayMs : 0;
  const opensAtMs = anchored ? anchorAtMs + delay : null;
  const open = anchored && Number.isFinite(nowMs) && nowMs >= opensAtMs;
  const legacyGate = Number.isFinite(legacyGateMs) ? Math.max(legacyGateMs, delay) : null;
  const beforeLegacyGate = open && legacyGate !== null && nowMs < anchorAtMs + legacyGate;
  return { open, opensAtMs, beforeLegacyGate };
}
