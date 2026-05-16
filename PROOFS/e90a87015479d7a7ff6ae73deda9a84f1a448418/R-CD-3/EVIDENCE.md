# R-CD-3 — continue_delegate(mode="post-compaction")

**Seat**: ronan (spark-ecdf, 10.0.0.246)
**CANDIDATE_SHA**: e90a87015479d7a7ff6ae73deda9a84f1a448418
**Binary**: OpenClaw 2026.5.17 (e90a870)
**Gateway PID**: 2042862
**Fire timestamp**: 2026-05-16 ~10:50 PDT
**Mode**: post-compaction

## Tool fire

```
continue_delegate(
  task="R-CD-3 proof fire from ronan-seat. ...",
  mode="post-compaction"
)
```

Note: NO `delaySeconds` parameter — post-compaction is event-triggered, not timer-triggered.

## Tool response (captured at byte)

```json
{
  "status": "queued-for-compaction",
  "mode": "post-compaction",
  "delegateIndex": 3,
  "delegatesThisTurn": 3,
  "traceparent": "00-2aac17fa815fbf2254be4ffe9687c486-ed6199ae3a814b1c-01",
  "note": "Delegate will fire when compaction occurs, not on a timer. The shard starts at the moment of compaction and returns to the post-compaction session. Chain tracking applies at dispatch time."
}
```

## Mode-shape distinction (load-bearing evidence)

**post-compaction vs normal/silent-wake**:
- normal/silent-wake: `status: "scheduled"` + `delaySeconds: <N>` (timer-triggered)
- post-compaction: `status: "queued-for-compaction"` + NO delaySeconds (event-triggered)
- note field explicitly describes fire-on-compaction-event semantics
- Same traceparent + delegateIndex chain continues across all 3 modes within turn-scope

## Tempo query URL

```
http://tempo.dandelion.cult/api/traces/2aac17fa815fbf2254be4ffe9687c486
```

## Verdict

QUEUED-FOR-COMPACTION ACCEPT. Lifeboat shape verified at byte.
delegatesThisTurn=3 confirms multi-mode parallel-fan-out from same turn.

ACCEPT-shape contract verified: status, mode, delegateIndex, delegatesThisTurn, traceparent, note. Note field carries semantic description of event-triggered vs timer-triggered firing.

Open follow-up: actual fire-on-compaction return-payload requires compaction event to occur. Will be verified when this session compacts (post-row-fires) OR via explicit request_compaction() if needed for proof corpus.
