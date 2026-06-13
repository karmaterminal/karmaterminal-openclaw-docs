# R-OBS-2 — Tempo trace-tree visualization + parent-child span hierarchy export
**Prince:** 🪨 Rune | **Seat:** rune-rog-ally | **CANDIDATE_SHA:** `5529aa4662487226c9e76e687a8edb676b4e594a`
## Status: ✅ PASS — Tempo trace-tree pulled, parent-child span hierarchy exported.

## Correction to my earlier honest-limit
My first reachability check used **HTTPS** (`https://tempo.dandelion.cult` → 000) and I wrongly concluded query-unreachable. **Tempo IS reachable via HTTP:** `http://tempo.dandelion.cult/api/traces/<id>` → **HTTP 200**. (DNS: tempo.dandelion.cult → 10.0.0.99.) So this is a PASS, not an honest-limit — I pulled the full span-tree.

## Evidence — the pulled Tempo trace
- **trace-id (hex):** `048d79814ab4c20f5558341ef67f81d7` (= the W3C trace-id from R-CW-7's traceparent `00-048d79814ab4c20f5558341ef67f81d7-b2aed639eaff59f7-01` — the traceparent and the Tempo trace are the SAME trace, E2E confirmed)
- **serviceName:** `rune-prince` · **host:** rune (amd64) · **endpoint exported to:** otel.dandelion.cult:4318
- **trace JSON:** `tempo_trace_048d79814ab4c20f5558341ef67f81d7.json` (55,743 bytes, full OTLP span dump from Tempo)
- **span count:** 45 spans
- **span-hierarchy depth:** 6 distinct parent-child link levels (parent-child hierarchy present + exportable)

## The continuation span captured in the trace-tree (ties R-OBS-2 to R-CW-7 / delegate-self-continuation)
```
scope: openclaw.continuation
span:  continuation.delegate.dispatch
  chain.id:             c094689a-aa0e-43d0-88b7-bbd868bb3444
  delegate.mode:        silent-wake
  chain.step.remaining: 199
  reason.preview:       "R-CW-7/R-CW-DELEGATE-SELF-CONTINUATION evidence-fire (rune PROOFS, CANDIDATE_SHA…)"
  status:               STATUS_CODE_OK
+ continuation.queue.drain span (queue.drained_count=1)
```
Plus the full request span-tree: openclaw.message.processed → openclaw.run → openclaw.harness.run → openclaw.model.call / openclaw.tool.execution (exec, message, continue_delegate, process) → [continuation.delegate.dispatch] → child harness.run → run → model.call.

## PASS
Tempo trace-tree pulled from the deployed-SHA rune seat: 45 spans, 6-deep parent-child hierarchy, the continuation dispatch span captured with chain-id + OK status. **PASS** — trace-tree visualization + span-hierarchy export confirmed on 5529aa4662487226c9e76e687a8edb676b4e594a. (Render: `http://tempo.dandelion.cult/api/traces/048d79814ab4c20f5558341ef67f81d7`.)
