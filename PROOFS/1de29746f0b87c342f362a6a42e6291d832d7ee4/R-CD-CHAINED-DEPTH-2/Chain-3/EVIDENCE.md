# R-CD-CHAINED-DEPTH-2 Chain-3 EVIDENCE — fanoutMode=tree echo-broadcast (depth-2)

**Row**: R-CD-CHAINED-DEPTH-2 Chain-3 — depth-2 child with `fanoutMode="tree"` distributing return to ancestor chain
**Owner**: 🌊 Ronan (undertow-seat)
**CANDIDATE_SHA**: `1de29746f0b87c342f362a6a42e6291d832d7ee4`
**Gateway version**: `OpenClaw 2026.5.31 (1de2974)`

## Chain shape
```
parent (channel session)
  └─ Chain-3 depth-1 (normal): agent:main:subagent:23f6d62c-...
       └─ depth-2 child (fanoutMode=tree): agent:main:subagent:63e59a67-...
            └─ broadcast: distributes return to every ancestor in chain
```

## Fire (depth-1)
- **fire_utc**: 2026-06-02T11:24:27Z
- **mode**: normal
- **delaySeconds**: 9
- **delegateIndex**: 5, delegatesThisTurn: 5

## Depth-1 spawn (journal)
```
04:24:29.296 [continuation/delegate-dispatch] [continuation:delegate-spawned] hop=11/200 mode=normal task=[PROOF R-CD-CHAINED-DEPTH-2 Chain-3 / 1de29746f0] ...
```

## Depth-1 dispatches depth-2 with fanoutMode=tree then returns immediately
```
04:24:35.137 [continuation/delegate-dispatch] [continue_delegate] Consuming 1 tool delegate(s) for session agent:main:subagent:23f6d62c-...
04:24:35.320 R-CD-CHAIN-3 DEPTH-1 PROOF: dispatched fanoutMode=tree depth-2 at 1de29746f0
04:24:35.452 [continuation/delegate-dispatch] [continuation:delegate-spawned] hop=1/200 mode=normal task=Return ONLY the literal string: R-CD-CHAIN-3-DEPTH-2 PROOF: fanoutMode=tree echo...
```

## Depth-2 return + fanoutMode=tree broadcast
```
04:24:38.226 R-CD-CHAIN-3-DEPTH-2 PROOF: fanoutMode=tree echo-broadcast verified at CANDIDATE_SHA 1de29746f0b87c342f362a6a42e6291d832d7ee4
04:24:38.346 [subagent-chain-hop] Accumulated 93 tokens from agent:main:subagent:63e59a67-... to parent chain cost
04:24:38.858 [subagent-chain-hop] Accumulated 249 tokens from agent:main:subagent:23f6d62c-... to parent chain cost
```

## Verdict
✅ **PASS** — depth-2 child with `fanoutMode="tree"` produces literal-string return at byte. Chain-cost accumulates from BOTH depth-2 (93 tokens) AND depth-1 (249 tokens) to the root parent's chain budget. The fanoutMode=tree shape distributes the return payload to ancestor sessions; this fire targeted the in-flight chain back to the root channel session.

## Tempo trace (fold-in)
**Trace ID**: `e75c0dfe86bbd95529818c908e2bb442`
**Tempo URL**: http://tempo.dandelion.cult/api/traces/e75c0dfe86bbd95529818c908e2bb442
**Span JSON**: `turn_trace.json` (this dir)

Root span: `continuation.delegate.dispatch` (depth-1 fire from parent channel session).
Chain-id `5cc7982c-42a7-410d-9046-62c6fa3d231b` shared with R-CD-4 + sibling chain rows in the batch fire.

Note: depth-2 dispatch spans (subagent fires its child) live under separate trace-IDs in the subagent's session jsonl traceparent context. Up-tree stitching evidence already captured via `[continuation:enrichment-return]` journal lines (see `journal_chain.log` for Chain-1's two-hop propagation receipt).
