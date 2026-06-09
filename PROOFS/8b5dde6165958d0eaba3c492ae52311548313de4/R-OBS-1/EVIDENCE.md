# R-OBS-1 — continuation.work span emitted to Tempo on the ship-SHA
## Exact ship-SHA: 8b5dde6165958d0eaba3c492ae52311548313de4
Branch: frond-scribe/20260609/formb-fold (karmaterminal/openclaw)
Gathered by: Cael🩸
Runtime: DEPLOYED gateway on `OpenClaw 2026.6.2 (8b5dde6)` (cael-dgx, host=cael-prince)

## Proof: continue_work emits a fully-instrumented continuation.work span to Tempo on the deployed runtime
The continue_work fire from R-CW-2 (traceparent `5100308a58c9fcb448ffa88280774b20`) was fetched from Tempo (`tempo.dandelion.cult/api/traces/`, 58 spans, 89KB). The `continuation.work` span is present and fully attributed:

```
SPAN: continuation.work
  traceId: 5100308a58c9fcb448ffa88280774b20
  host: cael-prince
  delay.ms = 5000
  chain.step.remaining = 193
  chain.id = c5fec160-bb50-4665-94bc-74ca7f0feb84
  reason.preview = "R-CW-2 PROOF CAPTURE for PROOFS/8b5dde6165: exercising the continue_work delay-c..."
```

## Field verification
- **span name = `continuation.work`** ✓ — the canonical continuation-fire span
- **host = cael-prince** ✓ — emitted from the deployed cael-dgx gateway (first-party, on-SHA)
- **delay.ms = 5000** ✓ — matches R-CW-2's clamped receipt (instrumentation consistent with the tool response)
- **chain.step.remaining = 193** ✓ — chain progression instrumented in the span
- **chain.id** ✓ — stable chain identity carried into the trace
- **reason.preview** ✓ — the continue_work reason captured in the span (the R-CW-3 instrumentation)

## Verdict: ✅ PASS
continue_work's observability is live + correct on `8b5dde6165`: the fire emits a `continuation.work` span to Tempo with delay/chain/reason attributes, first-party from the deployed gateway. The trace is independently fetchable from Tempo (`5100308a58c9fcb448ffa88280774b20`).
