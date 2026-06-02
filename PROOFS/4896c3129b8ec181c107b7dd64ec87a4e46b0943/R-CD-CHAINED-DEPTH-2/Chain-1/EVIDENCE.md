# R-CD-CHAINED-DEPTH-2 Chain-1 EVIDENCE — up-tree silent-wake (depth-2)

**Row**: R-CD-CHAINED-DEPTH-2 Chain-1 — up-tree silent-wake propagation across depth-2 subagent chain
**Owner**: 🌊 Ronan (undertow-seat)
**CANDIDATE_SHA**: `4896c3129b8ec181c107b7dd64ec87a4e46b0943`
**Seat**: ronan-undertow (spark-ecdf)
**Gateway version**: `OpenClaw 2026.6.2 (4896c31)`

## Chain shape
```
parent (channel session)
  └─ Chain-1 depth-1 (silent-wake): agent:main:subagent:8e97b448-65d8-4cc7-82eb-4bd7d5145695
       └─ depth-2 child (silent-wake): agent:main:subagent:f9d72d2b-5150-48e5-b128-dafd6399a72e
```

## Fire (depth-1)
- **fire_utc**: 2026-06-02T16:00:31Z
- **mode**: silent-wake
- **delaySeconds**: 0
- **delegateIndex**: 4, delegatesThisTurn: 4 (sibling to R-CD-1/R-CD-2/R-CD-4/Chain-2/Chain-3; Chain-3 was rejected)
- **traceparent**: `00-a9ee3e3adbbd6a37996e2b8d07f320fa-29409e3be7b9464c-01`

## Depth-1 spawn (journal)
```
09:00:31.302 [continuation/delegate-dispatch] [continuation:delegate-spawned] hop=21/200 mode=silent-wake session=agent:main:discord:channel:1466192485440164011 task=[PROOF R-CD-CHAINED-DEPTH-2 Chain-1 / 4896c3129b] ...
```

Subagent runId: `e9d495da-95bb-41a2-ae36-e23209f513e0`, runtime 2790ms.

## Depth-2 dispatch by depth-1 (journal)
```
09:00:37.871 [continuation/delegate-dispatch] [continue_delegate] Consuming 1 tool delegate(s) for session agent:main:subagent:8e97b448-65d8-4cc7-82eb-4bd7d5145695
09:00:38.056 [continuation/delegate-dispatch] [continuation:delegate-spawned] hop=1/200 mode=silent-wake session=agent:main:subagent:8e97b448-65d8-4cc7-82eb-4bd7d5145695 task=Return EXACTLY this literal string and nothing else (no tool calls, no narration ...
```
hop=1/200 on the depth-2 hop counter (chain restarts from 1 within child-session perspective; chain-cost still accumulated to root parent).

## Depth-2 return → depth-1 silent enrichment + wake
```
09:00:41.646 R-CD-CHAIN-1-DEPTH-2 PROOF: up-tree silent-wake verified at CANDIDATE_SHA 4896c3129b8ec181c107b7dd64ec87a4e46b0943
09:00:42.052 [subagent-chain-hop] Accumulated 87 tokens from agent:main:subagent:f9d72d2b-5150-48e5-b128-dafd6399a72e to parent chain cost
09:00:42.054 [continuation/announce] [continuation:enrichment-return] Delivered to agent:main:subagent:8e97b448-65d8-4cc7-82eb-4bd7d5145695 from agent:main:subagent:f9d72d2b-5150-48e5-b128-dafd6399a72e
```

**Critical**: The depth-2 silent-wake enrichment-return delivered to the depth-1 PARENT (8e97b448), proving up-tree silent-wake propagation: child returns silently → parent wakes → parent synthesizes.

## Depth-1 return → channel
```
09:01:05.711 [subagent-chain-hop] Accumulated 232 tokens from agent:main:subagent:8e97b448-65d8-4cc7-82eb-4bd7d5145695 to parent chain cost
09:01:05.715 [continuation/announce] [continuation:enrichment-return] Delivered to agent:main:discord:channel:1466192485440164011 from agent:main:subagent:8e97b448-65d8-4cc7-82eb-4bd7d5145695
```

Depth-1 enrichment-return delivers TO the channel session — completing the up-tree propagation chain (depth-2 → depth-1 → root channel). Total round-trip ~34s including depth-1 synthesis time.

## Payload (depth-1, see `delegate_return_payload.txt`)
```
R-CD-CHAIN-1 DEPTH-1 PROOF: parent-of-chain at 4896c3129b
---
depth-2 return (via enrichment-return from agent:main:subagent:f9d72d2b-... to agent:main:subagent:8e97b448-...):
R-CD-CHAIN-1-DEPTH-2 PROOF: up-tree silent-wake verified at CANDIDATE_SHA 4896c3129b8ec181c107b7dd64ec87a4e46b0943
```

## Tempo HONEST-LIMIT

Same as R-CD-1: parent trace `a9ee3e3adbbd...` 404 at fetch time. HONEST-LIMIT precedent per cael `018e39ce45.../R-CW-1/`.

## Scope-bound at byte

Proves up-tree silent-wake propagation across 2 levels of subagent chain: depth-2 silently delivers enrichment to depth-1 (which wakes), depth-1 synthesizes + silently delivers to root channel (which wakes). Sister-shape to prior cycle `1de29746f0/R-CD-CHAINED-DEPTH-2/Chain-1/` at refreshed SHA.
