# Chain-3 — ordering-condition, NOT a regression (byte-walked, corrected)

**Seat**: ronan
**CANDIDATE_SHA**: e90a87015479d7a7ff6ae73deda9a84f1a448418

## Same mechanism as Chain-2

Chain-3 depth-1 was the 7th delegate in single-turn fan-out. By the time its spawn-call evaluated, `activeChildren=5 >= maxChildren=5` returned `status: "forbidden"` from `src/agents/subagent-spawn.ts:813-820`.

See `Chain-2/HONEST-LIMIT.md` for full byte-walked analysis.

## Differentiator from Chain-2

- Chain-2: depth-1 had `targetSessionKey=heartbeat` (cross-session)
- Chain-3: depth-1 no cross-session targeting; depth-2 child intended to do cross-channel echo

Both blocked by same `maxChildrenPerAgent` gate. The cross-channel echo + depth-2 stitching for Chain-3 remain unverified for this proof corpus; need a fire-pattern where active-children budget is available.

## Correction to earlier HONEST-LIMIT.md

Same correction as Chain-2: I asserted `compaction-boundary chain-guard` from memory without byte-walking. The actual gate is per-session `maxChildrenPerAgent`.

## To verify Chain-3 cleanly

Fire Chain-3 alone (or with at most 4 other concurrent delegates) — depth-2 echo+cross-channel should dispatch correctly. Open for follow-up.
