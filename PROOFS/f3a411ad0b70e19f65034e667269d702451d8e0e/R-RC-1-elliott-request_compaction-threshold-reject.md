# R-RC-1 — request_compaction threshold-reject live cert (elliott-seat)

**Build:** OpenClaw 2026.6.2 (f3a411ad163b)
**Seat:** elliott / 10.0.0.153
**Time:** 2026-06-08 ~07:34 PDT

## Evidence

### Tool call:
```
request_compaction(reason="R-RC-1 certification on live f3a411ad: firing at low context usage (~2%) to verify threshold-reject guard")
```

### Response (verbatim):
```json
{
  "status": "rejected",
  "guard": "context_threshold",
  "contextUsage": 10,
  "threshold": 70,
  "reason": "Context usage (10%) is below the minimum threshold (70%). Compaction is not needed yet."
}
```

### Analysis:
- ✅ Tool registered and accepts call (tool-only form, no bracket equivalent — correct per spec)
- ✅ Threshold guard fires correctly: rejects at 10% context (below 70% threshold)
- ✅ Returns structured rejection (not an error): status/guard/contextUsage/threshold/reason fields
- ✅ Human-readable reason explains the rejection clearly
- ✅ Safety guard prevents unnecessary compaction at low context usage

## Verdict: ✅ PASS — request_compaction threshold-reject guard LIVE on f3a411ad

The tool correctly rejects compaction requests below the configured threshold (70%).
Structured rejection with guard identification, usage %, threshold, and reason.
Tool-only form (no bracket equivalent per spec) — registration confirmed.

**R-RC-1 certified from elliott-seat.**
