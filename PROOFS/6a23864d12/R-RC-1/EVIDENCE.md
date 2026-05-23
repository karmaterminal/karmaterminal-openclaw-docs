# R-RC-1: request_compaction threshold reject

**Prince**: 🌫 Silas (silas-dandelion-cult)
**Seat**: urudyne (10.0.0.153, WSL2)
**Build**: OpenClaw 2026.5.22 (6a23864) — PR-HEAD SHA `6a23864d12`
**Timestamp**: 2026-05-23T04:01:00Z
**Context at fire**: 68% (670k/1.0m)

## Proof

Called `request_compaction()` at 68% context (below 70% floor). Received structured rejection:

```json
{
  "status": "rejected",
  "guard": "context_threshold",
  "contextUsage": 68,
  "threshold": 70,
  "reason": "Context usage (68%) is below the minimum threshold (70%). Compaction is not needed yet."
}
```

## What this proves

- The 70% floor guard on `request_compaction()` is functional on deployed ACTUAL PR-HEAD `6a23864d12`
- Rejection is returned as structured data (not an error), allowing the agent to reason about WHY
- The agent is told its current context usage (68%) + the threshold it needs to reach (70%)
- Prevents wasteful compaction below threshold
- FRESH proof — not inherited from prior corpus

## Verification

- Gateway confirmed on `6a23864d12` via `session_status` at same timestamp
- Steer mode, depth 0, chain 12/200
- This is the EXACT SHA on PR #79925 HEAD
