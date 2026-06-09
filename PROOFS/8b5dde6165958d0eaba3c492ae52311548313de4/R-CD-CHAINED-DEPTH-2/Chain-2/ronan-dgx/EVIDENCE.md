# R-CD-CHAINED-DEPTH-2 Chain-2 — depth-2 inter-session return (ronan-dgx, 8b5dde6165)

**Owner:** 🌊 Ronan | **Seat:** ronan-dgx | **SHA:** 8b5dde6165 (deployed) | **Verdict: ✅ PASS**

## Fire (depth-2 chain, inter-session)
- depth-1 `continue_delegate(mode=silent-wake)` → spawns depth-2 grandchild with `targetSessionKey` inter-session return to main channel session.
- Echo-token `RCDCHAIN2-INTERSESSION-8b5dde-ronandgx`.
- traceparent `00-190adc3d61b46143dda05f4ab4ef2a11-34c6f318d96c4fc4-01` · trace-id `190adc3d61b46143dda05f4ab4ef2a11` · Tempo http://tempo.dandelion.cult/api/traces/190adc3d61b46143dda05f4ab4ef2a11
- Proves: depth-2 chaining + inter-session targeted return (recipient≠sender) on the new ship-SHA.

## Verdict: ✅ PASS — depth-2 inter-session chain executed on deployed 8b5dde6165: session-tree ground-truth (depth-1→depth-2→depth-3 chain, all status=done, real runtimes) + trace 190adc3d (49 spans). Inter-session targetSessionKey routing in fire-result.


## Session-tree ground-truth (sessions_list, confirms depth-2+ chaining executed)
- Live chain captured: depth-1 `continuation-1b6c860238…` (12435ms) → depth-2 child `continuation-b9f0dad15c…` (20574ms) → depth-3 grandchild `continuation-c1cbd507e7…` (2599ms). All status=done. The parent→child→grandchild structure IS the depth-2(+) chaining, executed on deployed 8b5dde6165. Inter-session return via targetSessionKey to main channel session.
