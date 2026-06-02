# R-CD-2 EVIDENCE — `continue_delegate(silent-wake)` round-trip

**Row**: R-CD-2 — `continue_delegate(mode="silent-wake")` full path
**Owner**: 🌊 Ronan (undertow-seat)
**CANDIDATE_SHA**: `7522d6c60f11a37d2534db70e5c7c3be8a8f16e3`
**Seat**: ronan-undertow (spark-ecdf, 10.0.0.246)
**Gateway version**: `OpenClaw 2026.5.31 (7522d6c)`

## Fire
- **fire_utc**: 2026-06-02T01:34:30Z
- **mode**: silent-wake
- **delaySeconds**: 0
- **fire_response**: `{"status":"scheduled","mode":"silent-wake","delaySeconds":0,"delegateIndex":1,"delegatesThisTurn":1}` (see `fire_response.json`)

## Spawn (journal evidence)
```
Jun 01 18:35:32 [continuation/delegate-dispatch] [continuation:delegate-spawned] hop=10/200 mode=silent-wake session=agent:main:discord:channel:1466192485440164011 task=R-CD-2 PROOF FIRE...
```

## Return + silent-wake announce (the distinguishing feature vs R-CD-1)
```
Jun 01 18:35:38 R-CD-2 PROOF EVIDENCE: continue_delegate silent-wake mode round-trip OK from ronan-undertow at 7522d6c60f
Jun 01 18:35:38 [subagent-chain-hop] Accumulated 132 tokens from agent:main:subagent:2c20d9e5-2798-42c6-9e5f-662a8ae334c8 to parent chain cost
Jun 01 18:35:38 [continuation/announce] [continuation/silent-wake] wakeOnReturn=true target=agent:main:discord:channel:1466192485440164011 silentAnnounce=true
```

## Key behavior verified
- **silent-wake mode**: `wakeOnReturn=true silentAnnounce=true` — silent return + parent-turn-wake triggered correctly
- **delegate_session_key**: `agent:main:subagent:2c20d9e5-2798-42c6-9e5f-662a8ae334c8`
- **runtime**: 6s spawn-to-return
- **chain-cost**: 132 tokens accumulated to parent
- **hop**: 10/200 within chain-tracking limit

## Tempo trace
**Status**: ⚠️ NOT CAPTURED (same as R-CD-1 — observability stack down, related to `#854`). Journal-based parent-child stitching evidence above substitutes.

## Verdict
✅ **PASS** — `continue_delegate(mode=silent-wake)` from undertow-seat at CANDIDATE_SHA `7522d6c60f` schedules + spawns + returns silently + wakes parent. The `silentAnnounce=true wakeOnReturn=true` log-line is the load-bearing differentiator vs R-CD-1 normal-mode. Cure-bytes do not regress the silent-wake delegate path.
