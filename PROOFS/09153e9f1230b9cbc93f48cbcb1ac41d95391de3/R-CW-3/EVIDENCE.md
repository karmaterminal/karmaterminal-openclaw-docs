# R-CW-3 — continue_work reason field captured in the continuation.work span
## Exact ship-SHA: 8b5dde6165958d0eaba3c492ae52311548313de4
Branch: frond-scribe/20260609/formb-fold (karmaterminal/openclaw)
Gathered by: Cael🩸
Runtime: DEPLOYED gateway on `OpenClaw 2026.6.2 (8b5dde6)` (cael-dgx, host=cael-prince)

## Proof: the continue_work `reason` argument is instrumented into the span on the ship-SHA
The R-CW-2 fire passed a `reason` argument ("R-CW-2 PROOF CAPTURE for PROOFS/8b5dde6165: exercising the continue_work delay-clamp..."). That reason is captured in the `continuation.work` span on Tempo (trace `5100308a58c9fcb448ffa88280774b20`, host=cael-prince) as the `reason.preview` attribute:

```
reason.preview = "R-CW-2 PROOF CAPTURE for PROOFS/8b5dde6165: exercising the continue_work delay-c..."
```

The reason text passed to the tool round-trips into the trace attribute — confirming the continue_work reason-field instrumentation emits on-SHA (the same category-1 capture-path confirmed in the 2807 R-CW-3 cross-walk, now re-attested on `8b5dde6165` from cael-prince's first-party span).

## Verdict: ✅ PASS
continue_work's `reason` field is instrumented into the `continuation.work` span on `8b5dde6165`: the reason argument round-trips from the tool call into the Tempo `reason.preview` attribute, first-party from the deployed gateway. Not a regression — the instrumentation emits on-SHA (consistent with the 2807 corpus's category-1 resolution).
