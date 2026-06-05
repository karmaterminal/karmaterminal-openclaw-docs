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

## Depth-2 chain + up-tree silent-wake PROVEN (journal) — see depth2_chain_journal.txt
The byte shows the full depth-2 nesting:
1. **Depth-1 spawn:** `hop=8/200 mode=silent-wake session=...channel:1466192485440164011` — the Chain-1 delegate.
2. **Depth-1 fires depth-2 child:** the depth-1 delegate itself called `continue_delegate`, capturing the child's traceparent.
3. **Depth-2 child spawn:** `hop=1/200 mode=silent-wake session=agent:main:subagent:b53ed2a8-...` — **the defining depth-2 proof**: the child spawned on a SUBAGENT-session chain (a delegate spawned BY a delegate), fresh hop-counter on the nested chain.
4. **Up-tree silent-wake return:** "depth-2 child returning up-tree via silent-wake" — the child's return propagates up-tree.

## Chain-1 FINAL VERDICT: ✅ PASS (depth-2 up-tree silent-wake, ronan-seat, SHA 2807efc)
A delegate spawned a child delegate (depth-2, subagent-of-subagent chain hop=1), the child returned up-tree via silent-wake. Depth-2 continuation chains propagate with up-tree silent-wake on the assembly SHA.
