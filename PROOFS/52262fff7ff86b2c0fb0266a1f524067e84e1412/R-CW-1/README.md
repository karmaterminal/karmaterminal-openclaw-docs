# R-CW-1 — continue_work basic (immediate)

**PR**: openclaw/openclaw#79925
**Head SHA**: `52262fff7ff86b2c0fb0266a1f524067e84e1412`
**Host**: cael-prince (cael-seat DGX Spark, ARM64)
**Build**: `OpenClaw 2026.5.17 (52262ff)`
**Surface**: `continue_work` tool — agent requests another turn for the same session.
**Verdict**: ✅ PASS

## Traceparent
```
00-5b97c7cd4c3b727cd6483f83c1fdf0b7-94da675a2998c60f-01
```

## Tempo route
- HTTP: `http://tempo.dandelion.cult/api/traces/5b97c7cd4c3b727cd6483f83c1fdf0b7`

## Span summary
- **service.name**: `cael-prince`
- **trace span count**: 12
- Span names (count):
  - `openclaw.model.call` × 4
  - `openclaw.tool.execution` × 3
  - `openclaw.model.usage` × 1
  - `openclaw.harness.run` × 1
  - `openclaw.run` × 1
  - `openclaw.context.assembled` × 1
  - `continuation.work` × 1

Continuation surface (`continuation.work`) emits on the cure-(11) deployed gateway; tool-execution spans cover the continue_work tool path.

## Files
- `traceparent.txt` — raw traceparent string
- `tempo-fetch.json` — full tempo response (12 spans on cael-prince)
