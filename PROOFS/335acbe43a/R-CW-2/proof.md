# R-CW-2 — continue_work() delaySeconds=0 (immediate) → config minimum clamp

**Target SHA**: `335acbe43a354486e74c684aaa2e2fe14e9aa8c6` (deployed cael-seat 2026-05-23T07:45 UTC)
**Status**: ✅ PASS
**Prince**: 🩸 Cael
**Tempo trace**: [`17d62e3cb4312fd486182c4b34e7d80d`](http://tempo.dandelion.cult/api/traces/17d62e3cb4312fd486182c4b34e7d80d)

## Scenario

`continue_work()` invoked with `delaySeconds=0` (immediate wake request) should be clamped UP to the configured runtime minimum (`continuation.minDelayMs`, default 5000ms = 5s) — preventing busy-loop continuation. Verifies the minimum-delay guard is honored at the scheduler boundary.

## Command

```
continue_work({
  delaySeconds: 0,
  reason: "R-CW-2: immediate-wake clamp-to-minimum verification on PR #85651 head 335acbe43a"
})
```

## Expected

- Tool returns with `{status: "scheduled", delaySeconds: 5, traceparent: "..."}` (NOT 0 — clamped UP to minDelayMs/1000)
- OTel span attributes show: `continuation.delaySeconds.requested=0`, `continuation.delaySeconds.effective=5`, `continuation.clamp.reason="minDelayMs"`
- Wake fires at ~5s (configured minimum), not at ~0s
- Behavior protects against tight-loop continuations (`continue_work(0)` repeating would spin)

## Observed

🩸 Cael (Discord `1507653754`): *"R-CW-2 FIRED — `continue_work(delaySeconds=0)` → clamped to 5s by config (`minDelayMs: 5000`). trace `17d62e3cb4312fd486182c4b34e7d80d`. proves: immediate wake respects configured minimum."*

Trace fetched from `http://tempo.dandelion.cult/api/traces/17d62e3cb4312fd486182c4b34e7d80d` from cael-seat. Raw JSON at [`trace-17d62e3c.json`](./trace-17d62e3c.json) (12,173 bytes, unedited runtime emission).

Requested delay (0s) was clamped to configured minimum (5s = `minDelayMs: 5000`). Wake fired at the clamped time, not immediately. Tight-loop guard substantiated.

## Behavior verified

✅ Immediate-wake request (`delaySeconds=0`) is honored as a request
✅ Scheduler clamps UP to configured `minDelayMs` floor (5000ms)
✅ Returned `delaySeconds` reflects the effective (clamped) value
✅ Trace records both requested + effective delays for audit
✅ Wake fires at clamped time, not requested time
✅ Protects against busy-loop continuation patterns

## Co-fired

Fresh fire on PR #85651 head `335acbe43a354486e74c684aaa2e2fe14e9aa8c6`. No inheritance.
