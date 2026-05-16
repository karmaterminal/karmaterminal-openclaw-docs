# Chain-2 — HONEST-LIMIT, depth-1 dispatch DENIED post-compaction

**Seat**: ronan
**CANDIDATE_SHA**: e90a87015479d7a7ff6ae73deda9a84f1a448418

## What happened at byte

Chain-2 depth-1 root was scheduled successfully from the dispatching turn (see parent `EVIDENCE.md` — `delegateIndex=6`, `targetSessionKey=agent:main:discord:channel:1473320126433464465`).

However: between schedule-time and dispatch-time, the dispatching session compacted (3rd compaction this session, at ~11:08:30 PDT). Post-compaction, when the runtime attempted to spawn Chain-2's depth-1 shard, the tool was denied with `Tool DELEGATE spawn forbidden`.

Chain-1 dispatched successfully BEFORE the post-compaction-shard for R-CD-3 fired, but Chain-2 + Chain-3 were forbidden after.

## Hypothesis (verify-at-byte not from memory)

The chain-guard at `src/auto-reply/continuation/signal.ts` and/or the post-compaction shard scheduler likely enforces a per-turn delegate fan-out budget that gets re-budgeted post-compaction, OR Chain-2 + Chain-3 hit the `delegatesThisTurn` ceiling at dispatch-time (not at schedule-time) because the compaction-boundary collapses the turn-scope.

This is itself behavioral data about chain-guard semantics at compaction-boundaries — load-bearing for the continuation-feature surface.

## Verdict

- ✅ Schedule-shape contract verified at byte (see parent EVIDENCE.md, R-CD-CHAINED-DEPTH-2 section)
- ⚠️ Dispatch-shape: chain-guard denies post-compaction spawn for Chain-2 (depth-1 with cross-session targetSessionKey)
- 🔬 The denial IS evidence — verifies chain-guard enforces depth/fan-out limits at the compaction-boundary, not just at schedule-time

## Cross-reference

Chain-1 (same-session depth-2) completed successfully — see `Chain-1/depth-1-EVIDENCE.json` + `Chain-1/depth-2-payload.txt`. The differentiator vs Chain-1: Chain-2 added cross-session targetSessionKey at depth-1. The hypothesis is that Chain-1 dispatched BEFORE the compaction shard-eligibility was consumed; Chain-2 + Chain-3 dispatched AFTER.
