# R-RC-1 — `request_compaction` REJECT at context_threshold gate

**Row owner:** 🌫 Silas
**Seat:** silas (lothric, 10.0.0.100; CachyOS, i9-14900KS, RTX 5090)
**Exact ship-SHA:** `8b5dde6165958d0eaba3c492ae52311548313de4` (deployed, byte-verified active fleet-wide per frond-scribe 2026-06-09 06:52 PDT cross-seat probe)
**Captured:** 2026-06-09 06:53:48 PDT
**Reproof of:** R-RC-1 from `PROOFS/2807efc1c1e8…/` — the gate-fires-as-designed proof that `request_compaction` REJECTS below the 70% context threshold.

## Behavior proven

`request_compaction(reason)` invoked at context-usage below the `context_threshold` guard returns a structured rejection (NOT an exception, NOT a silent fall-through) with the guard name, current usage, and threshold — proving the volitional-compaction safety gate fires as-designed on the deployed `8b5dde6165` runtime.

## Receipt (verbatim from tool response)

```json
{
  "status": "rejected",
  "guard": "context_threshold",
  "contextUsage": 32,
  "threshold": 70,
  "reason": "Context usage (32%) is below the minimum threshold (70%). Compaction is not needed yet."
}
```

## Field-by-field gate-verification

- **status = "rejected"** ✓ — explicit rejected verdict (NOT "compaction_requested" / "queued" / null)
- **guard = "context_threshold"** ✓ — names the specific guard that fired (not generic "denied")
- **contextUsage = 32** ✓ — current measured usage (`session_status` immediately prior reported `Context: 313k/1.0m (31%)` — consistent within 1 tick)
- **threshold = 70** ✓ — matches `R-CONFIG-DEFAULTS` (cohort-confirmed `contextThreshold = 0.70` default)
- **reason** ✓ — human-readable, includes both the measured usage and the threshold for diagnostic clarity

## Honest scope (pre-trace-by-design, carried forward from 2807 R-RC-1)

This row, by its REJECT-arm nature, does not produce a Tempo trace. The runtime rejects the request before any continuation-fire span is emitted (the gate is upstream of trace-instrumentation, which is correct — rejections don't carry continuation context to trace). This is the same pre-trace-by-design honest note carried in the 2807 corpus's R-RC-1 verdict line and is gate-design-correct, not a coverage gap. The complementary ACCEPT-arm at ≥70% context (R-RC-2) was captured by 🪨 rune at 80% ctx on 2807 (`cmp-mq1m28hj-YvoHAA`, trace `dea80c41`); together the two arms prove the compaction-threshold gate in both directions, satisfying figs's both-paths directive.

## Verdict: ✅ PASS

The `request_compaction` context_threshold gate fires-as-designed on the deployed `8b5dde6165` runtime. The reject-arm of the volitional-compaction safety surface is byte-confirmed live.

## Pointer

Cross-arm: `PROOFS/2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427/R-RC-2/` for the ACCEPT-path at ≥70% (rune-captured at 80% ctx).
