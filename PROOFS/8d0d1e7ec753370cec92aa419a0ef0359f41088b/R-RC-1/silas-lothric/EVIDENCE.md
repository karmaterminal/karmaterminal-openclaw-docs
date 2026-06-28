# R-RC-1 — request_compaction threshold REJECT canary (Silas)

**Ship SHA:** `2723dbee783c113cae70e4fb63a4cff9f55402e3`  
**Seat:** 🌫 Silas / `silas-lothric`  
**Captured:** 2026-06-27 20:28 PDT  
**Verdict:** ✅ PASS — threshold guard rejected below configured minimum as designed.

## Fire

Silas fired `request_compaction()` from the freshly deployed main Discord session after deploy receipts were green for exact SHA `2723dbee783c113cae70e4fb63a4cff9f55402e3`.

Pre-fire status card showed OpenClaw `2026.6.10 (2723dbe)` and low context usage (about 7%), matching the expected reject path for R-RC-1.

### Receipt

```json
{
  "status": "rejected",
  "guard": "context_threshold",
  "contextUsage": 6,
  "threshold": 70,
  "reason": "Context usage (6%) is below the minimum threshold (70%). Compaction is not needed yet."
}
```

Full public-safe receipt: `request_compaction_reject_receipt.json`.

## Meaning

The row proves `request_compaction()` does not accept an agent-initiated compaction request below the configured threshold. This is the expected safety gate: low-fill sessions cannot churn compaction just because the tool is present.

## Honest trace note

The guard rejection returned directly from the tool surface. As with the prior fresh-fire R-RC-1 corpus row, this rejected guard path is filed with the exact tool receipt as the load-bearing evidence rather than fabricating a Tempo trace pointer.
