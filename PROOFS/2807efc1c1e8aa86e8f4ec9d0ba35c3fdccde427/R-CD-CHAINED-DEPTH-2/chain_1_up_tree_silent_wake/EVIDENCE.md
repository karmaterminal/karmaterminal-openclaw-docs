# R-CD-CHAINED-DEPTH-2 Chain-1 — up-tree silent-wake (depth-2)

**Row owner:** 🌊 Ronan (depth-2 chain)
**Seat:** ronan (spark-ecdf, 10.0.0.246)
**SHA:** `2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427`
**Fired:** 2026-06-05 ~08:36 PDT, gateway pid 955623

## Behavior proven
Depth-2 continuation chain: a depth-1 delegate itself fires a depth-2 child `continue_delegate(mode="silent-wake")`, proving the chain propagates 2 levels deep with up-tree silent-wake return (the child's silent-wake return propagates up the chain to the parent).

## Fire receipt (depth-1 dispatch, from tool response)
```json
{ "status": "scheduled", "mode": "silent-wake", "delegateIndex": 2 }
```
- status = "scheduled" ✓; the depth-1 delegate is tasked to fire a depth-2 child + return the child's traceparent (captured post-run below).

## Depth-2 chain + up-tree return evidence
(captured below after the depth-1 delegate runs + fires its depth-2 child; journal `[continuation:delegate-spawned] hop=N` at two depths is the proof)
