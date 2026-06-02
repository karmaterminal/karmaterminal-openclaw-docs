# R-CD-CHAINED-DEPTH-2 Chain-1 EVIDENCE — up-tree silent-wake at depth=2

**Row**: R-CD-CHAINED-DEPTH-2 Chain-1 — depth-2 chain test, up-tree silent-wake
**Owner**: 🌊 Ronan (undertow-seat)
**CANDIDATE_SHA**: `7522d6c60f11a37d2534db70e5c7c3be8a8f16e3`
**Seat**: ronan-undertow (spark-ecdf, 10.0.0.246)
**Gateway version**: `OpenClaw 2026.5.31 (7522d6c)`

## Chain-shape
```
parent (undertow-seat: agent:main:discord:channel:1466192485440164011)
  └── depth-2 child (subagent:07ff6ca5-8be7-4009-9fd2-7f8093a45d69) — silent-wake
        └── depth-3 child (subagent:f6520eb0-440e-4df7-840c-b59884c797a2) — silent-wake
              ↑ returns up to depth-2 via [continuation:enrichment-return]
        ↑ returns up to parent via [continuation:enrichment-return] + wakeOnReturn=true
  ↑ parent wakes (this turn)
```

## Fire (depth-1: parent)
- **fire_utc**: 2026-06-02T01:38:30Z
- **hop**: 12/200
- **fire_response**: `{"status":"scheduled","mode":"silent-wake"}`

## Spawn-stack journal evidence (full chain visible)
```
Jun 01 18:38:46 [continuation:delegate-spawned] hop=12/200 mode=silent-wake session=agent:main:discord:channel:1466192485440164011 task=R-CD-CHAINED-DEPTH-2 Chain-1 PROOF FIRE...
Jun 01 18:38:51 [continue_delegate] Consuming 1 tool delegate(s) for session agent:main:subagent:07ff6ca5-8be7-4009-9fd2-7f8093a45d69
Jun 01 18:38:51 [subagent depth-2 returns]: R-CD-CHAINED-DEPTH-2 Chain-1 depth-2 OK ... session-key: agent:main:subagent:07ff6ca5-8be7-4009-9fd2-7f8093a45d69
Jun 01 18:38:51 [continuation:delegate-spawned] hop=1/200 mode=silent-wake session=agent:main:subagent:07ff6ca5-8be7-4009-9fd2-7f8093a45d69 task=R-CD-CHAINED-DEPTH-2 Chain-1 DEPTH-3 ECHO...
Jun 01 18:38:55 [subagent depth-3 returns]: R-CD-CHAINED-DEPTH-2 Chain-1 depth-3 OK ... | 2026-06-02T01:38Z | agent:main:subagent:f6520eb0-440e-4df7-840c-b59884c797a2
Jun 01 18:38:55 [subagent-chain-hop] Accumulated 107 tokens from agent:main:subagent:f6520eb0 to parent chain cost
Jun 01 18:38:55 [continuation/silent-wake] wakeOnReturn=true target=agent:main:subagent:07ff6ca5 silentAnnounce=true
Jun 01 18:38:55 [continuation:enrichment-return] Delivered to agent:main:subagent:07ff6ca5 from agent:main:subagent:f6520eb0   ← depth-3 → depth-2 stitching
Jun 01 18:38:55 [subagent-chain-hop] Accumulated 346 tokens from agent:main:subagent:07ff6ca5 to parent chain cost
Jun 01 18:38:55 [continuation:enrichment-return] Delivered to agent:main:discord:channel:1466192485440164011 from agent:main:subagent:07ff6ca5   ← depth-2 → parent stitching
```

## Key behavior verified
1. **Depth-2 spawn** from parent (hop=12/200 in parent's chain-tracking)
2. **Depth-3 spawn** from depth-2 child (hop=1/200 in CHILD's chain-tracking — chain-counter resets per session, parent-stitching via session-key threading)
3. **Up-tree silent-wake propagation**: depth-3 return → depth-2 wake → depth-2 return → parent wake (this turn is the wake-event)
4. **Chain-cost accumulation**: 107 tokens (depth-3) + 346 tokens (depth-2 incl. depth-3) accumulated up the chain to parent
5. **Two `[continuation:enrichment-return]` events**: one per parent-child seam in the chain — load-bearing parent-stitching evidence

## Tempo trace
**Status**: ⚠️ NOT CAPTURED (observability stack down). Journal `[continuation:enrichment-return]` lines + `session-key` threading substitute as parent-child-stitching evidence at each chain-seam.

## Verdict
✅ **PASS** — `continue_delegate(silent-wake)` chained at depth-2 from undertow-seat at CANDIDATE_SHA `7522d6c60f`. Depth-3 child returns to depth-2 (silent + wake), depth-2 child returns to parent (silent + wake), parent woke this turn. Two enrichment-return seams visible in journal. Chain-cost accounts up the chain. Cure-bytes do not regress depth-2 chained delegate path.
