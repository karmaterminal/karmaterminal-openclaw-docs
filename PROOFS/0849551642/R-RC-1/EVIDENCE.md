# R-RC-1: request_compaction threshold reject

**Row**: R-RC-1
**Prince**: 🌫 Silas (silas-dandelion-cult)
**Seat**: urudyne (10.0.0.153, WSL2)
**Build**: OpenClaw 2026.5.22 (6a23864) — PR-HEAD SHA `6a23864d12ef5845b340923d3d3f1d0978751429`
**Timestamp**: 2026-05-23T04:01:00Z
**Context at fire**: 68% (670k / 1.0m)
**Trace ID**: — (synchronous tool-return; the rejection-path produces a structured JSON response, no traceparent propagation because the call doesn't fan out to a new operation)

## Proof

Silas's session called `request_compaction()` at 68% context (below the 70% floor). The platform returned a structured rejection — not an error, not a silent no-op:

```json
{
  "status": "rejected",
  "guard": "context_threshold",
  "contextUsage": 68,
  "threshold": 70,
  "reason": "Context usage (68%) is below the minimum threshold (70%). Compaction is not needed yet."
}
```

(Earlier in the night, 🌊 ronan's session at 63% context fired the same row and received the same structured rejection shape, reported in Discord at message `1507580345`. The behavior is reproducible across prince-seats on this SHA.)

## What this proves

- The 70% floor guard on `request_compaction()` is functional on deployed ACTUAL PR-HEAD `6a23864d12`
- Rejection is returned as structured data (not an error), allowing the agent to reason about WHY
- The agent is told its current context usage (68%) + the threshold it needs to reach (70%)
- Prevents wasteful compaction below threshold

## Why this proves the floor-guard invariant

Before this feature: an agent could call `request_compaction()` at any context-usage, and the platform would auto-compact regardless. That meant the agent could spend cycles on compaction overhead even when it had plenty of context-budget left — wasteful + jarring.

After this feature: the floor guard introduces a check — if context < 70%, refuse the request with a structured response explaining why. The agent learns "you don't need to compact yet" without losing its turn or hitting an error-state.

## Verification

- Gateway confirmed on `6a23864d12` via `session_status` at the same timestamp
- Steer mode, depth 0, chain 12/200 (silas's session at fire-time)
- This is the EXACT SHA on PR #79925 HEAD
- Fresh fire — not inherited from prior corpus

## Verdict

**✅ PASS** on `6a23864d12` (the canonical PR-head SHA). Floor guard correctly rejects below-threshold compaction requests with structured-explanation response.
