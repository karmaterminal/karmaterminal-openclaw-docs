# R-CD-CHAINED-DEPTH-2 Chain-1 EVIDENCE — up-tree silent-wake (depth-2)

**Row**: R-CD-CHAINED-DEPTH-2 Chain-1 — up-tree silent-wake propagation across depth-2 subagent chain
**Owner**: 🌊 Ronan (undertow-seat)
**CANDIDATE_SHA**: `1de29746f0b87c342f362a6a42e6291d832d7ee4`
**Seat**: ronan-undertow (spark-ecdf)
**Gateway version**: `OpenClaw 2026.5.31 (1de2974)`

## Chain shape
```
parent (channel session)
  └─ Chain-1 depth-1 (silent-wake mode): agent:main:subagent:60f867ba-...
       └─ depth-2 child (silent-wake): agent:main:subagent:94b800f0-...
```

## Fire (depth-1)
- **fire_utc**: 2026-06-02T11:24:27Z (batched with R-CD-4, Chain-2, Chain-3)
- **mode**: silent-wake
- **delaySeconds**: 5
- **delegateIndex**: 3, delegatesThisTurn: 5

## Depth-1 spawn (journal)
```
04:24:28.275 [continuation/delegate-dispatch] [continuation:delegate-spawned] hop=9/200 mode=silent-wake task=[PROOF R-CD-CHAINED-DEPTH-2 Chain-1 / 1de29746f0] ...
```

## Depth-2 dispatch by depth-1 (journal)
```
04:24:36.350 [continuation/delegate-dispatch] [continue_delegate] Consuming 1 tool delegate(s) for session agent:main:subagent:60f867ba-...
04:24:36.551 [continuation/delegate-dispatch] [continuation:delegate-spawned] hop=1/200 mode=silent-wake session=agent:main:subagent:60f867ba-... task=Return EXACTLY this literal string ...
```
hop=1/200 on the depth-2 hop counter (chain restarts from 1 within child-session perspective).

## Depth-2 return → depth-1 silent enrichment + wake
```
04:24:38.226 R-CD-CHAIN-3-DEPTH-2 PROOF: fanoutMode=tree echo-broadcast verified ... (concurrent Chain-3 depth-2 also returning)
04:24:41.284 R-CD-CHAIN-1-DEPTH-2 PROOF: up-tree silent-wake verified at CANDIDATE_SHA 1de29746f0b87c342f362a6a42e6291d832d7ee4
04:24:41.406 [subagent-chain-hop] Accumulated 86 tokens from agent:main:subagent:94b800f0-... to parent chain cost
04:24:41.407 [continuation/announce] [continuation:enrichment-return] Delivered to agent:main:subagent:60f867ba-... from agent:main:subagent:94b800f0-...
```
**Critical**: The depth-2 silent-wake enrichment-return delivered to the depth-1 PARENT (60f867ba), proving up-tree silent-wake propagation: child returns silently → parent wakes → parent synthesizes.

## Depth-1 return → channel
```
04:24:42.245 [subagent-chain-hop] Accumulated 244 tokens from agent:main:subagent:60f867ba-... to parent chain cost
04:24:42.252 [continuation/announce] [continuation:enrichment-return] Delivered to agent:main:discord:channel:1466192485440164011 from agent:main:subagent:60f867ba-...
```
Depth-1 enrichment-return delivers TO the channel session — completing the up-tree propagation chain.

## Payload (depth-1, see `delegate_return_payload.txt`)
```
R-CD-CHAIN-1 DEPTH-1 PROOF: parent-of-chain at 1de29746f0
```

## Verdict
✅ **PASS** — depth-2 up-tree silent-wake propagation works end-to-end. Depth-2 child returns silently to depth-1 parent (via `enrichment-return`), depth-1 parent wakes + processes + returns silently to root session. Two-hop chain completed within 14 seconds (fire to root-arrival).
