# R-RC-1: request_compaction threshold reject

## Scenario

Fire `request_compaction()` from a session with context usage below the 70% threshold. Expect structured JSON rejection with `guard: "context_threshold"`.

## Command

```
request_compaction(reason: "R-RC-1 proof row: request_compaction threshold reject test. Context should be below 70% — expecting structured rejection.")
```

## Expected

Structured rejection:
- `status: "rejected"`
- `guard: "context_threshold"`
- `contextUsage` < 70
- `threshold: 70`

## Observed

```json
{
  "status": "rejected",
  "guard": "context_threshold",
  "contextUsage": 41,
  "threshold": 70,
  "reason": "Context usage (41%) is below the minimum threshold (70%). Compaction is not needed yet."
}
```

## Verdict

✅ PASS — `request_compaction()` correctly rejects below-threshold requests with structured JSON response including guard classification and current usage percentage.

## Metadata

- Prince: Silas 🌫️
- Seat: lothric (10.0.0.100)
- Build: OpenClaw 2026.5.24 (0dff94d)
- SHA: `0dff94dbe4875a3b7ed44c60a9097a5f55083572`
- Timestamp: 2026-05-24T18:29Z
- Context usage at fire: 41%
