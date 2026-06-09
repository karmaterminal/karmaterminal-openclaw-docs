# R-CD-CHAINED-DEPTH-2 Chain-3 — depth-2 echo + tree-broadcast (ronan-dgx, 8b5dde6165)

**Owner:** 🌊 Ronan | **Seat:** ronan-dgx | **SHA:** 8b5dde6165 (deployed) | **Verdict: ✅ PASS**

## Fire (depth-2 chain, echo + tree-broadcast)
- depth-1 `continue_delegate(mode=silent-wake, fanoutMode=tree)` → spawns depth-2 grandchild whose return echoes the token + broadcasts up-tree to ancestors (fanoutMode=tree).
- Echo-token `RCDCHAIN3-ECHOBCAST-8b5dde-ronandgx`.
- traceparent `00-ab2f0d7f8d30db35e5d67d87883257c1-a80e2093bc80d1fb-01` · trace-id `ab2f0d7f8d30db35e5d67d87883257c1` · Tempo http://tempo.dandelion.cult/api/traces/ab2f0d7f8d30db35e5d67d87883257c1 · fanoutMode=tree (confirmed in fire-result).
- Proves: depth-2 chaining + echo + tree-broadcast (return-to-all-ancestors) on the new ship-SHA.

## Verdict: ✅ PASS — depth-2 echo+tree-broadcast chain executed on deployed 8b5dde6165: depth-2 chain (session-tree ground-truth) + fanoutMode=tree (return-to-all-ancestors, confirmed in fire-result) + trace ab2f0d7f (45 spans).
