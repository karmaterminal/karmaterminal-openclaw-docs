# R-CD-1: continue_delegate live-fire proof at cure-(10)

**Candidate SHA**: `df502943c2667ff2e1eed9f850379b41f9b8a8f6`  
**Build pin**: `OpenClaw 2026.5.17 (df50294)` (verified via `openclaw --version` on ronan-seat at fire time)  
**Service**: `ronan-prince` (pid 3489531)  
**Fired at**: 2026-05-17T00:04:08-07:00 PDT  
**Traceparent**: `00-35286da765c65ea5f72cc74ffe972cd8-e4e33ab70279b895-01`

## Fire

`continue_delegate` invoked from a live turn on the ronan gateway (post-deploy `25983929603` SUCCESS at `df502943c2`). Tool args: `mode=silent-wake`, `delaySeconds=0`. Gateway returned `status=scheduled`, `delegateIndex=1`, with traceparent above.

## Tempo trace fetch

```
GET http://tempo.dandelion.cult/api/traces/35286da765c65ea5f72cc74ffe972cd8
```

Response captured to `tempo-fetch.json` (12 spans across the parent turn, all `service.name=ronan-prince`, pid `3489531`, executable `/home/figs/flesh_beast_tmp/openclaw/dist/index.js`).

## Span timeline (from tempo)

| Span | Duration | Tool |
|---|---|---|
| openclaw.context.assembled | 0.00ms | — |
| openclaw.model.call | 5298ms | — |
| openclaw.tool.execution | 619ms | exec |
| openclaw.model.call | 3785ms | — |
| openclaw.tool.execution | 50ms | exec |
| openclaw.model.call | 3962ms | — |
| openclaw.tool.execution | 80ms | exec |
| openclaw.model.call | 4840ms | — |
| **openclaw.tool.execution** | **19ms** | **continue_delegate** |
| openclaw.model.call | 4596ms | — |
| openclaw.tool.execution | 33ms | exec |
| openclaw.model.call | 3347ms | — |

## Verdict

✅ **continue_delegate fires through the live cure-(10) gateway.** Tempo trace fetched successfully via `runWithDiagnosticTraceparent` propagation. Tool execution span `openclaw.tool.execution / tool=continue_delegate` confirms the tool was dispatched and traced. Trace ID matches the traceparent returned by the tool call. No skipped cases. Whole-thing tempo evidence captured.
