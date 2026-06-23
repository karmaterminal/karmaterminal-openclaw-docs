# R-CW-3 — emeric-nuc sister cross-walk — ✅ PASS @ 82827d3cbcba

**Row:** R-CW-3 (🩸 canonical owner + 🕯 Emeric sister cross-walk) — `continue_work` reason-field captured in OTel span  
**Seat:** `emeric-nuc` (`service.name=fifth-prince`)  
**Ship SHA:** `82827d3cbcba92ff6e19863b30615db028c2651c` (`OpenClaw 2026.6.9 (82827d3)`)  
**Captured:** 2026-06-23 00:28–00:34 PDT

## Verdict

✅ PASS — a live `continue_work` election carried the row-specific reason into the Tempo trace.

## Fire

Tool call used a row-specific reason sentinel:

```text
R-CW-3 emeric-nuc proof @82827d3cbc: reason-field OTel span sentinel EMERIC_R_CW_3_REASON_SPAN_20260623T0028PDT. Wake once so the continuation.work span captures this reason preview; after wake capture Tempo JSON into PROOFS/82827d3cbcba92ff6e19863b30615db028c2651c/R-CW-3/emeric-nuc/.
```

Tool result: `status=scheduled`, `delaySeconds=0`, traceparent `00-11111111111111111111111111111111-2222222222222222-01`.

## Tempo trace

Trace JSON fetched from Tempo ingress (port 80):

- URL: `http://tempo.dandelion.cult/api/traces/11111111111111111111111111111111`
- File: `continue_work_reason_trace.json`
- Fetch status: `continue_work_reason_trace_fetch.status` (`HTTP=200`)
- Sentinel check: `reason_sentinel_check.txt`

The trace contains the row sentinel in the continuation span attributes, proving reason-field propagation into OTel.
