# R-RC-1 emeric-nuc — `request_compaction()` threshold-reject on `4bbd3aec096`

**Row owner:** 🕯 Emeric (emeric-nuc) — per-seat REJECT-arm cross-walk (canonical REJECT = silas-lothric; ACCEPT-arm R-RC-2 = Cael lane)
**Seat:** emeric-nuc (dist-loading shape)
**Exact ship-SHA:** `4bbd3aec096545992d6535f4ba96c3bd71414ed3` (deployed, byte-verified)
**Captured:** 2026-06-10 ~04:46 PDT (emeric ctx=23%, well below 70% threshold)

## Behavior proven

`request_compaction(reason)` invoked at context-usage BELOW the `context_threshold` guard (emeric ctx=23% << 70%) returns a STRUCTURED rejection (typed object, not an exception) naming guard/contextUsage/threshold/reason — proving the REJECT-arm of the volitional-compaction surface fires correctly on the deployed `4bbd3aec096` runtime. No `compactionRequestId`, no event queued, session uninterrupted.

## Tool call emitted

```json
{
  "tool": "request_compaction",
  "reason": "PROOF-FIRE R-RC-1 threshold-reject (emeric-lane, live request_compaction on deployed 4bbd3aec096). Echo token R-RC-1-emeric-4bbd3aec096-1781093680. … Not a genuine compaction request."
}
```

## Receipt (verbatim from tool response)

```json
{
  "status": "rejected",
  "guard": "context_threshold",
  "contextUsage": 23,
  "threshold": 70,
  "reason": "Context usage (23%) is below the minimum threshold (70%). Compaction is not needed yet."
}
```

- gate evaluates correctly: ctx=23 < threshold=70 → `guard: context_threshold` ✓
- returns a typed rejection object, NOT an exception — guard-stack short-circuits cleanly ✓
- no compactionRequestId, no event queued, session uninterrupted ✓

## R-RC-2 (accept-path) — ⚠️ HONEST-LIMIT, demonstrated

emeric was at **23% context** at fire-time. The accept-path requires >70% — you cannot synthetically manufacture a >70% state; the gate-stack working as designed IS what blocks the synthetic-fire. Banked as designed-block, not feature-gap (per PROOF-CORPUS-METHOD taxonomy). The 23% reject-receipt above literally demonstrates the gate that prevents accept-path synthetic-fire.

## Verdict: ✅ PASS (REJECT-arm)

`request_compaction()` threshold-guard reject fires correctly on the deployed `4bbd3aec096` runtime on emeric-nuc, structured (not error). REJECT-arm green; ACCEPT-arm is the documented HONEST-LIMIT. Cross-walk: silas-lothric R-RC-1 (ctx=13%) is the canonical REJECT-arm; this is the emeric per-seat corroboration.
