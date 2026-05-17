# R-CW-1: continue_work live-fire + wake proof at cure-(10)

**Candidate SHA**: `df502943c2667ff2e1eed9f850379b41f9b8a8f6`  
**Build pin**: `OpenClaw 2026.5.17 (df50294)` (verified via `openclaw --version` on ronan-seat)  
**Service**: `ronan-prince`  
**Fired at**: 2026-05-17T00:05:57-07:00 PDT  
**Traceparent**: `00-83de10bd1f6bbcc927fbe976d8c423c0-25185901f860b27f-01`

## Fire

`continue_work` invoked with `delaySeconds=3` from a live turn on the ronan gateway. Gateway returned `status=scheduled`, traceparent as above.

## Tempo trace fetch

```
GET http://tempo.dandelion.cult/api/traces/83de10bd1f6bbcc927fbe976d8c423c0
```

Response captured to `tempo-fetch.json` (17KB, 14 spans).

## Span timeline (from tempo)

| Span | Tool |
|---|---|
| openclaw.model.usage | — |
| openclaw.harness.run | — |
| openclaw.run | — |
| openclaw.context.assembled | — |
| openclaw.model.call | — |
| openclaw.tool.execution | exec |
| openclaw.model.call | — |
| **openclaw.tool.execution** | **continue_work** |
| openclaw.model.call | — |
| openclaw.tool.execution | exec |
| openclaw.model.call | — |
| openclaw.tool.execution | sessions_yield |
| openclaw.model.call | — |
| **continuation.work** | — (wake-side span) |

## Verdict

✅ **continue_work fires AND wakes** through the live cure-(10) gateway. Both spans captured under same trace ID:
1. `openclaw.tool.execution / tool=continue_work` — the scheduling call
2. `continuation.work` — the wake-side span, proving the scheduled continuation actually fired through the runtime substrate

The wake-side `continuation.work` span landing under the same parent traceparent confirms `runWithDiagnosticTraceparent` propagation across the schedule→wake boundary on cure-(10).
