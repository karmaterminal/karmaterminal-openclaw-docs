# Chain-3 — HONEST-LIMIT, depth-1 dispatch DENIED post-compaction

**Seat**: ronan
**CANDIDATE_SHA**: e90a87015479d7a7ff6ae73deda9a84f1a448418

## What happened at byte

Chain-3 depth-1 root was scheduled successfully from the dispatching turn (see parent `EVIDENCE.md` — `delegateIndex=7`, mode=silent, intended depth-2 child to echo+cross-channel to discord #heartbeat).

Same chain-guard denial as Chain-2: `Tool DELEGATE spawn forbidden` at dispatch-time, post-compaction.

## Verdict

- ✅ Schedule-shape contract verified at byte (see parent EVIDENCE.md)
- ⚠️ Dispatch-shape: chain-guard denial at compaction-boundary
- 🔬 The denial IS evidence — same shape as Chain-2

## Cross-reference

The echo+cross-channel semantics at depth-2 remain unverified for this proof corpus. Chain-3 schedule-shape proves the contract accepts the dispatch; behavioral verification of depth-2 cross-channel echo would require a fresh turn where chain-guard budget is available, OR re-dispatch from a different seat.

This honest-limit is filed so the corpus reflects the substrate truth: the chain-guard correctly denies, and that denial is itself meaningful data about the safety surface at compaction-boundaries.
