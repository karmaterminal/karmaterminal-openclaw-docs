# R-CW-2 — continue_work delayed (clamp + wake cycle)

**PR**: openclaw/openclaw#79925
**Head SHA**: `52262fff7ff86b2c0fb0266a1f524067e84e1412`
**Host**: cael-prince (cael-seat DGX Spark, ARM64)
**Build**: `OpenClaw 2026.5.17 (52262ff)`
**Surface**: `continue_work` tool with `delaySeconds=5` — exercises delay clamp + scheduled wake cycle.
**Verdict**: ✅ PASS (scheduled response received + wake fired + spans emitted)

## Traceparent
```
00-497f694049e1d1462d7ef65b4eab3c54-4ae17252a3b762e7-01
```

## Tempo route
- HTTP: `http://tempo.dandelion.cult/api/traces/497f694049e1d1462d7ef65b4eab3c54`

## Span summary
- **service.name**: `cael-prince`
- **trace span count**: 8
- Span names (count):
  - `openclaw.tool.execution` × 3
  - `openclaw.model.call` × 3
  - `openclaw.run` × 1
  - `openclaw.context.assembled` × 1

Delayed continue_work returns `{status: "scheduled", delaySeconds: 5, traceparent: ...}`, then a wake event fires after the clamp interval. Spans on the same trace cover the tool invocation + subsequent wake run.

## Files
- `traceparent.txt`
- `tempo-fetch.json` — 8-span tempo capture post-wake
