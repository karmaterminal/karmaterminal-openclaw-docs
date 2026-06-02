# R-CD-CHAINED-DEPTH-2 Chain-2 EVIDENCE — inter-session targeted return (depth-2)

**Row**: R-CD-CHAINED-DEPTH-2 Chain-2 — depth-2 child returns to targetSessionKey, not to depth-1 parent
**Owner**: 🌊 Ronan (undertow-seat)
**CANDIDATE_SHA**: `1de29746f0b87c342f362a6a42e6291d832d7ee4`
**Gateway version**: `OpenClaw 2026.5.31 (1de2974)`

## Chain shape
```
parent (channel session)
  └─ Chain-2 depth-1 (normal): agent:main:subagent:2e5c9942-...
       └─ depth-2 child (targetSessionKey=agent:main:main): agent:main:subagent:b809bb46-...
```

## Fire (depth-1)
- **fire_utc**: 2026-06-02T11:24:27Z
- **mode**: normal
- **delaySeconds**: 7
- **delegateIndex**: 4, delegatesThisTurn: 5

## Depth-1 spawn (journal)
```
04:24:28.723 [continuation/delegate-dispatch] [continuation:delegate-spawned] hop=10/200 mode=normal task=[PROOF R-CD-CHAINED-DEPTH-2 Chain-2 / 1de29746f0] ...
```

## Depth-1 dispatches depth-2 with targetSessionKey then returns immediately
```
04:24:34.492 [continuation/delegate-dispatch] [continue_delegate] Consuming 1 tool delegate(s) for session agent:main:subagent:2e5c9942-...
04:24:34.587 R-CD-CHAIN-2 DEPTH-1 PROOF: dispatched inter-session targeted depth-2 at 1de29746f0
04:24:34.708 [continuation/delegate-dispatch] [continuation:delegate-spawned] hop=1/200 mode=normal task=[PROOF R-CD-CHAINED-DEPTH-2 Chain-2 / 1de29746f0] Depth-2 delegate. Your ONLY jo...
```
Note: depth-1 returns to channel (literal-string at 04:24:34.587) BEFORE depth-2 spawns (04:24:34.708). Fire-and-forget shape as designed.

## Depth-2 return (routed to targetSessionKey, not to depth-1)
```
04:24:39.033 R-CD-CHAIN-2-DEPTH-2 PROOF: inter-session targeted return verified at CANDIDATE_SHA 1de29746f0b87c342f362a6a42e6291d832d7ee4
04:24:39.257 [subagent-chain-hop] Accumulated 85 tokens from agent:main:subagent:b809bb46-... to parent chain cost
04:24:40.286 [subagent-chain-hop] Accumulated 311 tokens from agent:main:subagent:2e5c9942-... to parent chain cost
```
The depth-2 b809bb46 fired the literal-string. Chain-cost accumulated 85 tokens from b809bb46 (depth-2) AND 311 tokens from 2e5c9942 (depth-1) to the root parent — both contribute to chain accounting.

## Verdict
✅ **PASS** — depth-2 inter-session targeted return works. depth-1 fires depth-2 with `targetSessionKey="agent:main:main"`, depth-1 returns to its caller immediately (fire-and-forget), depth-2 routes its payload to the targetSessionKey rather than back up the spawn chain. Chain-cost still accrues to the dispatching root parent regardless of routing.

## Tempo trace (fold-in)
**Trace ID**: `9129ce27a27eeb11f2c9ff83b83e7fd1`
**Tempo URL**: http://tempo.dandelion.cult/api/traces/9129ce27a27eeb11f2c9ff83b83e7fd1
**Span JSON**: `turn_trace.json` (this dir)

Root span: `continuation.delegate.dispatch` (depth-1 fire from parent channel session).
Chain-id `5cc7982c-42a7-410d-9046-62c6fa3d231b` shared with R-CD-4 + sibling chain rows in the batch fire.

Note: depth-2 dispatch spans (subagent fires its child) live under separate trace-IDs in the subagent's session jsonl traceparent context. Up-tree stitching evidence already captured via `[continuation:enrichment-return]` journal lines (see `journal_chain.log` for Chain-1's two-hop propagation receipt).
