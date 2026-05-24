# R-CW-1: basic wake (5s delay)

**Family**: `continue_work()`
**Lead Prince**: 🩸 Cael
**Status**: ✅ PROVEN on `0dff94dbe4875a3b7ed44c60a9097a5f55083572`
**Trace ID**: `5056554f07cadf29089368be2d309644`
**Fired at**: 2026-05-24 ~13:18 PDT (cael-prince, ARM64)
**Prior baseline**: [`PROOFS/335acbe43a/R-CW-1/proof.md`](../../335acbe43a/R-CW-1/) — feature-byte-identical, behavior matches

## Scenario

Gateway running at `0dff94dbe48` on cael-seat (DGX Spark, ARM64, Linux 6.17.0-1018-nvidia).
Continuation config defaults: `maxChainLength: 200`, `minDelayMs: 5000`, `defaultDelayMs: 15000`.
No prior chain active when fired (fresh session after restart).
OTel exporter pointed at `http://tempo.dandelion.cult:4318` (http/protobuf, service.name=cael-prince).

## Command

```
continue_work(delaySeconds=5, reason="R-CW-1 proof row RE-FIRE with trace capture: basic continue_work wake")
```

## Expected

- Tool returns `{status: "scheduled", delaySeconds: 5, traceparent: "<W3C trace context>"}`
- A `continuation.work` OTel span is emitted with attributes: `delay.ms=5000`, `chain.id=<uuid>`, `chain.step.remaining=<N>`, `reason.preview=<truncated reason>`
- After 5 seconds, the gateway dispatches the next turn for the same session
- The next turn fires with the continuation reason carried forward

## Observed

- Tool response: `{"status":"scheduled","delaySeconds":5,"traceparent":"00-5056554f07cadf29089368be2d309644-34e3d5d9c35a8fd2-01"}` ✅
- Next turn fired ~5s later (system event `continuation:wake-fired turn:18/200`) ✅
- Tempo span `continuation.work` captured with attributes:
  ```
  delay.ms: 5000
  chain.id: 019e59c2-8bca-752c-b748-8f83425138a6
  chain.step.remaining: 181
  reason.preview: (truncated reason)
  ```
- Resource attributes: `service.name=cael-prince`, `host.name=cael`, `host.arch=arm64`, `process.runtime.name=nodejs`

## Verdict

✅ **PROVEN** — continue_work() wake mechanism works as designed.

## Artifacts

- `trace.json` — full Tempo span tree (30.7KB)
- Span names captured: `continuation.work`, `continuation.delegate.dispatch`, `openclaw.run`, `openclaw.harness.run`, `openclaw.model.call`, `openclaw.model.usage`, `openclaw.context.assembled`, `openclaw.tool.execution`
