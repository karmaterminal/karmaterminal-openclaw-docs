# R-RC-1 — request_compaction() threshold REJECT below 70%

**Target SHA**: `335acbe43a354486e74c684aaa2e2fe14e9aa8c6` (deployed silas-seat 2026-05-23T07:45 UTC)
**Status**: ✅ PASS
**Prince**: 🌫 Silas

## Scenario

`request_compaction()` invoked when context usage is below the minimum threshold (configured at 70%) must return a structured rejection with `guard: "context_threshold"` and detailed reason — never compact the session. Verifies the threshold-floor guard: agents can't trigger compaction prematurely.

## Command

```
request_compaction({
  reason: "R-RC-1 PROOF: threshold reject below 70% verification"
})
```

Fired from silas-seat at 7% context usage.

## Expected

- Tool returns structured rejection JSON immediately (no compaction)
- `status: "rejected"` (top-level)
- `guard: "context_threshold"` (which guard fired)
- `contextUsage` field showing current usage
- `threshold` field showing the configured floor (70)
- `reason` field with human-readable explanation
- No state change — context is not modified
- No error thrown — clean structured response

## Observed

🌫 Silas (Discord `1507659099`):

```json
{
  "status": "rejected",
  "guard": "context_threshold",
  "contextUsage": 7,
  "threshold": 70,
  "reason": "Context usage (7%) is below the minimum threshold (70%). Compaction is not needed yet."
}
```

Verbatim from silas-seat live response. Stored at [`rejection.json`](./rejection.json).

🌫 Silas: *"Scenario: request compaction below 70% threshold. Expected: structured rejection with `guard: 'context_threshold'`. Observed: exact match. Clean structured JSON, no error, no crash."*

## Behavior verified

✅ `request_compaction()` returns structured rejection at sub-threshold usage
✅ Rejection JSON contains all required fields (status, guard, contextUsage, threshold, reason)
✅ `guard: "context_threshold"` identifies the firing guard
✅ Human-readable reason string included for debugging
✅ No state change — context preserved
✅ No exception — clean structured response

## Substrate-note

The rejection-path is metadata-only (no compaction performed, no OTel trace span beyond the tool-call envelope). The rejection JSON IS the canonical evidence — there's no Tempo trace tree to fetch for this row because the path correctly short-circuits before any compaction work begins. This is by design: the threshold guard rejects early, before any costly compaction substrate is touched.

## Co-fired

Fresh fire on PR #85651 head `335acbe43a354486e74c684aaa2e2fe14e9aa8c6`. No inheritance.
