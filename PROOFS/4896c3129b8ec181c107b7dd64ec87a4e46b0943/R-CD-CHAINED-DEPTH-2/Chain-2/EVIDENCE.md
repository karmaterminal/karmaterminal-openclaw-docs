# R-CD-CHAINED-DEPTH-2 Chain-2 EVIDENCE — inter-session targeted return (depth-2)

**Row**: R-CD-CHAINED-DEPTH-2 Chain-2 — depth-2 child returns to targetSessionKey, not to depth-1 parent
**Owner**: 🌊 Ronan (undertow-seat)
**CANDIDATE_SHA**: `4896c3129b8ec181c107b7dd64ec87a4e46b0943`
**Gateway version**: `OpenClaw 2026.6.2 (4896c31)`

## Chain shape
```
parent (channel session)
  └─ Chain-2 depth-1 (normal): agent:main:subagent:63b060dc-c4c6-4666-8b06-95c775fd162c
       └─ depth-2 child (targetSessionKey=agent:main:main): agent:main:subagent:d6c47ab5-61c8-4e22-90df-02afcbef4f27
```

## Fire (depth-1)
- **fire_utc**: 2026-06-02T16:00:31Z
- **mode**: normal
- **delaySeconds**: 0
- **delegateIndex**: 5, delegatesThisTurn: 5
- **traceparent**: `00-a9ee3e3adbbd6a37996e2b8d07f320fa-29409e3be7b9464c-01`

## Depth-1 spawn (journal)
```
09:00:31.822 [continuation/delegate-dispatch] [continuation:delegate-spawned] hop=22/200 mode=normal session=agent:main:discord:channel:1466192485440164011 task=[PROOF R-CD-CHAINED-DEPTH-2 Chain-2 / 4896c3129b] ...
```

Subagent runId: `0e8e6383-4a2c-4d30-b5ac-09330fa8d30d`, runtime 5483ms.

## Depth-1 dispatches depth-2 with targetSessionKey then returns immediately
```
09:00:38.556 [continuation/delegate-dispatch] [continue_delegate] Consuming 1 tool delegate(s) for session agent:main:subagent:63b060dc-c4c6-4666-8b06-95c775fd162c
09:00:38.744 R-CD-CHAIN-2 DEPTH-1 PROOF: dispatched inter-session targeted depth-2 at 4896c3129b
09:00:38.892 [continuation/delegate-dispatch] [continuation:delegate-spawned] hop=1/200 mode=normal session=agent:main:subagent:63b060dc-... task=Return EXACTLY this literal string and nothing else ...
```

Note: depth-1 returns to channel (literal-string at 09:00:38.744) BEFORE depth-2 spawns (09:00:38.892). Fire-and-forget shape as designed.

## Depth-2 return (routed to targetSessionKey, not to depth-1)
```
09:00:42.552 R-CD-CHAIN-2-DEPTH-2 PROOF: inter-session targeted return verified at CANDIDATE_SHA 4896c3129b8ec181c107b7dd64ec87a4e46b0943
09:00:42.558 [subagent-chain-hop] Accumulated 86 tokens from agent:main:subagent:d6c47ab5-61c8-4e22-90df-02afcbef4f27 to parent chain cost
09:00:43.075 [subagent-chain-hop] Accumulated 289 tokens from agent:main:subagent:63b060dc-c4c6-4666-8b06-95c775fd162c to parent chain cost
```

The depth-2 d6c47ab5 fired the literal-string. Chain-cost accumulated 86 tokens from d6c47ab5 (depth-2) AND 289 tokens from 63b060dc (depth-1) to the root parent — both contribute to chain accounting.

The targetSessionKey routing path: depth-2 fired with `targetSessionKey=agent:main:main` parameter; return-routing followed that target (separate from the depth-1 parent that dispatched it).

## Payload (depth-1, see `delegate_return_payload.txt`)
```
R-CD-CHAIN-2 DEPTH-1 PROOF: dispatched inter-session targeted depth-2 at 4896c3129b
---
depth-2 return (routed to targetSessionKey=agent:main:main, not to depth-1):
R-CD-CHAIN-2-DEPTH-2 PROOF: inter-session targeted return verified at CANDIDATE_SHA 4896c3129b8ec181c107b7dd64ec87a4e46b0943
```

## Tempo HONEST-LIMIT

Same as R-CD-1: parent trace 404 at fetch time. HONEST-LIMIT precedent per cael `018e39ce45.../R-CW-1/`.

## Scope-bound at byte

Proves inter-session targeted-return: depth-2 child with `targetSessionKey` routes its return to the specified target (not to the dispatching depth-1 parent). Fire-and-forget shape: depth-1 returns to channel immediately after dispatching depth-2; depth-2 return follows its own targetSessionKey route. Sister-shape to prior cycle `1de29746f0/R-CD-CHAINED-DEPTH-2/Chain-2/` at refreshed SHA.
