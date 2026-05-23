# R-CW-1 — continue_work() basic wake on `6a23864d12`

**Target SHA**: `6a23864d12` (deployed cael-seat, confirmed `OpenClaw 2026.5.22 (6a23864)`)
**Status**: PASS
**Fired**: 2026-05-23 03:57:00 UTC (2026-05-22 20:57 PDT)
**Trace**: `2e2f8e9163214e449e5f91a6fc13f002`
**Tempo**: http://tempo.dandelion.cult/api/traces/2e2f8e9163214e449e5f91a6fc13f002

## Scenario

`continue_work(delaySeconds=10)` called from cael-main-session. The tool schedules the session's next turn to fire after 10 seconds. On wake: the session takes its next turn with the continuation reason preserved.

## Command

```
continue_work(
  delaySeconds=10,
  reason="R-CW-1 FRESH PROOF on 6a23864d12: basic wake test. Fire-time anchor 2026-05-23T03:57 PDT (21:57 PDT). Expected wake ~21:57:10."
)
```

## Observed

**Tool-call result:**
```json
{
  "status": "scheduled",
  "delaySeconds": 10,
  "traceparent": "00-2e2f8e9163214e449e5f91a6fc13f002-09a911196f056a77-01"
}
```

**Wake**: Session took its next turn ~10s later. Continuation reason preserved in wake context. Session posted proof completion to Discord (msg `1507598404593913981`).

## Trace spans (from Tempo export)

```
[cael] openclaw.harness.run — parent run containing the continue_work() call
[cael] openclaw.model.call — model generates continue_work() tool call
[cael] openclaw.tool.execution — continue_work registration
[cael] openclaw.harness.run — SECOND run (the 10s wake)
```

## Verdict

**PASS**: `continue_work(delaySeconds=10)` schedules and fires correctly on `6a23864d12`. The session wakes after the requested delay with reason preserved. Basic continuation infrastructure proven on actual PR HEAD.

## Artifacts

- `trace-2e2f8e91.json` — full Tempo span tree export (13KB)
