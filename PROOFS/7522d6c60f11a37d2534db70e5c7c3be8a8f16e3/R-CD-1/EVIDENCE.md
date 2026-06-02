# R-CD-1 EVIDENCE — `continue_delegate(normal-mode)` round-trip

**Row**: R-CD-1 — `continue_delegate()` schedule → spawn → return
**Owner**: 🌊 Ronan (undertow-seat)
**CANDIDATE_SHA**: `7522d6c60f11a37d2534db70e5c7c3be8a8f16e3` (uncurse-tip post-Track-C #858 cure-stack merge)
**Seat**: ronan-undertow (spark-ecdf, 10.0.0.246, DGX Spark, 128GB unified)
**Gateway version**: `OpenClaw 2026.5.31 (7522d6c)`

## Fire
- **fire_utc**: 2026-06-02T01:33:15Z
- **mode**: normal
- **delaySeconds**: 0
- **delegateIndex**: 1, delegatesThisTurn: 1
- **parent_session_key**: `agent:main:discord:channel:1466192485440164011`
- **fire_response**: `{"status":"scheduled","mode":"normal","delaySeconds":0,"delegateIndex":1,"delegatesThisTurn":1}` (see `fire_response.json`)

## Spawn (journal evidence)
```
Jun 01 18:33:45 [continuation/delegate-dispatch] [continue_delegate] Consuming 1 tool delegate(s) for session agent:main:discord:channel:1466192485440164011
Jun 01 18:33:46 [continuation/delegate-dispatch] [continuation:delegate-spawned] hop=9/200 mode=normal session=agent:main:discord:channel:1466192485440164011 task=R-CD-1 PROOF FIRE at uncurse-tip `7522d6c60f` from ronan-undertow seat.
```
(see `journal_continuation.log`)

## Return
- **return_utc**: 2026-06-02T01:33:46Z
- **delegate_session_key**: `agent:main:subagent:29b714aa-2846-4d48-a1be-e30c90f39729`
- **delegate_session_id**: `7c6f0b7d-f44c-4985-96c9-d6dce27957a0`
- **runtime**: 3s
- **tokens**: in=6, out=120, prompt_cache=34.4k
- **round_trip_total**: 31s (fire-to-return-event)
- **payload** (see `delegate_return_payload.txt`):
  ```
  R-CD-1 PROOF EVIDENCE: continue_delegate normal-mode round-trip OK from ronan-undertow at 7522d6c60f
  turn-time UTC: 2026-06-02T01:33Z
  delegate session-key: agent:main:subagent:29b714aa-2846-4d48-a1be-e30c90f39729
  ```

## Chain-cost accounting (journal evidence)
```
Jun 01 18:33:50 [subagent-chain-hop] Accumulated 126 tokens from agent:main:subagent:29b714aa-2846-4d48-a1be-e30c90f39729 to parent chain cost
```
Chain depth from spawn: `hop=9/200` (within 200-hop chain-tracking limit per gateway config).

## Tempo trace
**Status**: ⚠️ NOT CAPTURED. Tempo/Grafana observability stack on elliott (k3s) is currently down — `kubectl get svc -n observability tempo` returns connection-refused. `tempo.dandelion.cult` DNS resolves but port 3100 not listening. Related to `#854` (broader infra crash from overnight).

**Substitution**: journal `[continuation:delegate-spawned]` + `[subagent-chain-hop]` lines provide functionally-equivalent parent-child-stitching evidence (session-key matches between spawn + return, chain-cost accounting confirms parent received child tokens). Tempo trace can be re-captured + folded in post-rune-rescue when observability stack restored.

## Verdict
✅ **PASS** — `continue_delegate(mode=normal)` from undertow-seat at CANDIDATE_SHA `7522d6c60f` schedules + spawns + returns clean. Round-trip behavior matches pre-cure baseline. Cure-bytes (Track A drain-time bifurcation + Track B 23 channel-monitor flag-flips + Track C bracket-tag regression-anchor) do not regress the continuation-tool surface.
