# R-RC-2 — request_compaction over-threshold ACCEPT (cael-dgx)

**SHA:** `82827d3cbcba92ff6e19863b30615db028c2651c`  
**Seat:** Cael / `cael` (DGX Spark, ARM64)  
**Verdict:** ⚠️ HONEST-LIMIT on Cael fresh lane — over-threshold ACCEPT not reachable; below-threshold guard check returned a structured REJECT at `contextUsage=31`.

## Requirement

R-RC-2 is the ACCEPT side of the hard `request_compaction` threshold: a genuine `contextUsage >= 70` must return `status: compaction_requested` and enqueue volitional compaction. It is tool-only; there is no bracket form.

## Current Cael byte

After the `/new` recovery, Cael's session was far below the accept threshold. A guard probe returned:

```json
{
  "status": "rejected",
  "guard": "context_threshold",
  "contextUsage": 31,
  "threshold": 70,
  "reason": "Context usage (31%) is below the minimum threshold (70%). Compaction is not needed yet."
}
```

This is the correct below-threshold behavior, but it is R-RC-1-shaped, not R-RC-2 ACCEPT. No compaction was enqueued and no ACCEPT trace exists for this Cael lane.

## Honest limit

A fresh `/new` lane cannot honestly prove an over-threshold accept without a real ≥70% guard crossing. The row remains a substrate-condition limit for Cael at this SHA unless another currently-over-threshold seat supplies a substitute ACCEPT byte.
