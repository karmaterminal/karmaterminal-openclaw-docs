# R-CD-CHAINED-DEPTH-2 Chain-1 — depth-2 up-tree silent-wake (ronan-dgx, 8b5dde6165)

**Owner:** 🌊 Ronan | **Seat:** ronan-dgx | **SHA:** 8b5dde6165 (deployed) | **Verdict: ✅ PASS**

## Fire (depth-2 chain, up-tree silent-wake)
- depth-1 `continue_delegate(mode=silent-wake)` fired on deployed 8b5dde6165 → instructed to spawn a depth-2 grandchild with up-tree silent-wake return.
- Echo-token `RCDCHAIN1-UPTREE-8b5dde-ronandgx`.
- traceparent `00-b877e9cd2a73cd67523f2d800484bef9-7f357fe7218b5aa6-01` · trace-id `b877e9cd2a73cd67523f2d800484bef9` · Tempo http://tempo.dandelion.cult/api/traces/b877e9cd2a73cd67523f2d800484bef9
- Proves: depth-2 chaining + up-tree return propagation on the new ship-SHA.

## Verdict: ✅ PASS — depth-2 chain (depth-1→depth-2 grandchild) fired + up-tree silent-wake return + session-tree ground-truth + trace, all on deployed 8b5dde6165.

## Session-tree ground-truth (sessions_list, confirms depth-2 execution)
- depth-1 parent `agent:main:subagent:continuation-3ee1d75243ef98454d7aff4a1fe3bd5d` (runtime 11428ms) → spawned depth-2 child `agent:main:subagent:continuation-daca245f14de9335427b63eef5adbeb0` (runtime 3436ms). The parent→child chain in the live session-tree IS the depth-2 chaining, executed on deployed 8b5dde6165. Trace `b877e9cd2a73cd67523f2d800484bef9` (28-34 spans). Up-tree silent-wake return propagated (triggered parent capture).
