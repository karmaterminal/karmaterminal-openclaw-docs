# R-RC-1 — request_compaction threshold REJECT canary (Silas)

**Ship SHA:** `82827d3cbcba92ff6e19863b30615db028c2651c`
**Seat:** 🌫 Silas / `silas-lothric`
**Captured:** 2026-06-23 00:10 PDT
**Verdict:** ✅ PASS — threshold guard rejected below configured minimum as designed.

## Fire

Silas fired `request_compaction()` from the freshly-compacted main session to prove the low-context threshold rejection path.

### Receipt

```json
{
  "status": "rejected",
  "guard": "context_threshold",
  "contextUsage": 19,
  "threshold": 70,
  "reason": "Context usage (19%) is below the minimum threshold (70%). Compaction is not needed yet."
}
```

## Meaning

The row proves `request_compaction()` does not accept an agent-initiated compaction request below the configured threshold. This is the expected safety gate: low-fill sessions cannot churn compaction just because the tool is present.

## Honest trace note

The guard rejection returned directly from the tool surface. A Tempo lookup for `openclaw.toolName="request_compaction"` in the capture window returned no trace document for this rejected guard path, so the proof is filed with the exact tool receipt as the load-bearing evidence rather than fabricating a trace pointer.
