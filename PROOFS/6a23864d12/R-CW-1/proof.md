# R-CW-1 — continue_work() basic wake (10s delay)

**Target SHA**: `6a23864d12` (deployed cael-seat + ronan-seat 2026-05-23T03:38Z)
**Status**: PASS (dual-seat)
**Fired**: 2026-05-23T03:57:00Z (cael) + 2026-05-23T04:05:00Z (ronan)
**Traces**: `2e2f8e9163214e449e5f91a6fc13f002` (cael) + `7b3394a6...` (ronan)
**Tempo**: http://tempo.dandelion.cult/api/traces/2e2f8e9163214e449e5f91a6fc13f002

## Scenario

`continue_work(delaySeconds=10)` schedules the current session's next turn to fire after 10 seconds. The session yields, then wakes ~10s later with the continuation reason preserved. This is the most basic continuation primitive.

## Command

```
continue_work(
  delaySeconds=10,
  reason="R-CW-1 FRESH PROOF on 6a23864d12: basic wake test."
)
```

## Expected

- Tool returns `status: "scheduled"` with `delaySeconds: 10` and traceparent
- Session yields current turn
- ~10s later: session wakes with `[continuation:wake]` event
- Reason field preserved verbatim in wake context

## Observed (cael-seat)

**Tool-call result:**
```json
{
  "status": "scheduled",
  "delaySeconds": 10,
  "traceparent": "00-2e2f8e9163214e449e5f91a6fc13f002-09a911196f056a77-01"
}
```

- ✅ Tool returned scheduling ack with traceparent
- ✅ Session woke ~10s later
- ✅ Reason preserved in wake context
- ✅ Posted proof completion to Discord (msg `1507598404593913981`)
- ✅ Host: cael (ARM64, DGX Spark), build `OpenClaw 2026.5.22 (6a23864)`

## Observed (ronan-seat)

- ✅ Same behavior confirmed independently on second DGX Spark
- ✅ Trace `7b3394a6` (22KB span tree)
- ✅ Posted "R-CW-1 on 6a23864d12: Basic continue_work proved on actual PR HEAD"

## Verdict

**PASS (dual-seat)**: `continue_work(delaySeconds=10)` schedules and fires correctly on `6a23864d12`. Proven independently on two ARM64 DGX Spark machines. The most basic continuation primitive works on the actual PR HEAD.

## Artifacts

- `trace-2e2f8e91.json` — full Tempo span tree, cael-seat (13KB)
- `trace-7b3394a6.json` — full Tempo span tree, ronan-seat (22KB)
