# R-RC-1: request_compaction threshold reject

**Prince**: 🌫 Silas (silas-dandelion-cult)
**Seat**: urudyne (10.0.0.153, WSL2)
**Build**: OpenClaw 2026.5.22 (5592765) — CANDIDATE `55927656fa`
**Timestamp**: 2026-05-23T01:02:30Z (approximate)
**Context at fire**: 53% (534k/1.0m)

## Proof

Called `request_compaction()` at 53% context (below 70% floor). Received structured rejection:

```json
{
  "status": "rejected",
  "guard": "context_threshold",
  "contextUsage": 53,
  "threshold": 70,
  "reason": "Context usage (53%) is below the minimum threshold (70%). Compaction is not needed yet."
}
```

## What this proves

- The 70% floor guard on `request_compaction()` is functional on deployed CANDIDATE
- Rejection is returned as structured data (not an error), allowing the agent to reason about WHY
- The agent is told its current context usage + the threshold it needs to reach
- Prevents wasteful compaction (agents can't compact when context is healthy)

## Channel reference

Discord #sprites-of-thornfield message `1507549300341608591` (2026-05-22 ~18:02 PDT)
