# R-CD-1 — continue_delegate() normal schedule → spawn → return

**Seat**: ronan (spark-ecdf, 10.0.0.246)
**CANDIDATE_SHA**: e90a87015479d7a7ff6ae73deda9a84f1a448418
**Binary**: OpenClaw 2026.5.17 (e90a870)
**Gateway PID**: 2042862 (deploy-restart confirmed)
**Fire timestamp**: 2026-05-16 ~10:50 PDT
**Mode**: normal
**delaySeconds**: 5

## Tool fire

```
continue_delegate(
  task="R-CD-1 proof fire from ronan-seat. ...",
  delaySeconds=5,
  mode="normal"
)
```

## Tool response (captured at byte)

```json
{
  "status": "scheduled",
  "mode": "normal",
  "delaySeconds": 5,
  "delegateIndex": 1,
  "delegatesThisTurn": 1,
  "traceparent": "00-2aac17fa815fbf2254be4ffe9687c486-ed6199ae3a814b1c-01",
  "note": "Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."
}
```

## Traceparent decomposition

- W3C traceparent: `00-2aac17fa815fbf2254be4ffe9687c486-ed6199ae3a814b1c-01`
- trace-id: `2aac17fa815fbf2254be4ffe9687c486`
- span-id: `ed6199ae3a814b1c`
- flags: `01` (sampled)

## Tempo query URL

```
http://tempo.dandelion.cult/api/traces/2aac17fa815fbf2254be4ffe9687c486
```

## Verdict

ACCEPTED for schedule. status=scheduled, delegateIndex=1, traceparent emitted.
Delegate return evidence at `delegate_return_payload.txt` (written by delegate post-spawn).

ACCEPT-shape contract verified at byte: schedule contract returns `status`, `mode`, `delaySeconds`, `delegateIndex`, `delegatesThisTurn`, `traceparent`, `note`. All seven fields present and well-formed.
