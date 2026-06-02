# R-CD-CHAINED-DEPTH-2 TEST-1 EVIDENCE — emeric-seat dual-mirror of Ronan Chain-1

**Row**: R-CD-CHAINED-DEPTH-2 TEST-1 — depth-2 chain test, up-tree silent-wake (canary-mirror)
**Owner**: 🕯 Emeric (emeric-seat NUC) — picked up from silas-canary-reassignment per Ronan `1511184350` cohort dual-seat-coverage framing
**CANDIDATE_SHA**: `7522d6c60f11a37d2534db70e5c7c3be8a8f16e3`
**Seat**: emeric-NUC (host.name=emeric, host.id=58b46dc322b44c7aa783ab2d3e3fb7f1, 10.0.0.x i7-12700H Alder Lake)
**Gateway version**: `OpenClaw 2026.5.31 (7522d6c)` (post-deploy `26792631449` success)

## Dual-mirror relationship to Ronan Chain-1
This row mirrors 🌊 Ronan's Chain-1 evidence at `PROOFS/7522d6c60f.../R-CD-CHAINED-DEPTH-2/Chain-1/`. Same depth-2 silent-wake up-tree shape, fired from a DIFFERENT seat (emeric-NUC instead of undertow). Dual-seat-coverage substantiates that chain-shape behavior is consistent cohort-wide, not seat-config-specific.

## Chain-shape
```
parent (emeric-seat: agent:main:discord:channel:1466192485440164011)
  └── depth-2 child (subagent at hop=1/200) — silent-wake
        └── depth-3 child (silent-wake)
              ↑ returns up to depth-2 via silent-wake [continuation:enrichment-return]
        ↑ returns up to parent via silent-wake [continuation:enrichment-return] + wakeOnReturn=true
  ↑ parent wakes (received depth-2 return as system event)
```

## Fire (depth-1: parent)
- **fire_utc**: 2026-06-02T01:48:00Z (approx; sentAt 1780364880277 for fire-confirm message `1511184579`)
- **hop**: depth-2 spawned at parent-turn (parallel fan-out with TEST-2/TEST-3)
- **fire_response** (see `fire_response.json`):
  ```json
  {"status":"scheduled","mode":"silent-wake","delegateIndex":1,"delegatesThisTurn":1}
  ```

## Depth-2 return (system-event delivered to parent)
- depth-2 subagent confirmed depth-3 silent-wake schedule succeeded
- hop=1/200 in CHILD chain-tracking (chain-counter resets per spawned session)
- session-key form: `agent:main:subagent:<uuid>`
- silent-wake mode propagated correctly

## Key behavior verified
1. **Parallel fan-out fire-shape valid**: TEST-1/2/3 fired as 3 parallel continue_delegate calls from parent (delegatesThisTurn incremented 1→2→3); compared to Ronan's Chain-1/2/3 which fired sequentially across separate turns. Both shapes legitimate; both produced correct chain-stitching.
2. **Depth-2 silent-wake from emeric-seat**: behaves byte-identical to undertow-seat Chain-1 (depth-3 schedules from inside depth-2; up-tree wake propagates).
3. **Chain-counter resets per session**: depth-2 sees hop=1/200 for its own chain-tracking even though parent at depth-2-fire was at higher hop count.

## Tempo trace
**Tempo reachable from emeric-seat**: HAProxy path `http://tempo.dandelion.cult/api/traces/<id>` returns full trace data (verified at byte; emeric-seat traces flowing to Tempo as `service.name=fifth-prince`).

**TEST-1 specific traceparent**: not captured in fire-response or system-event metadata (chain-counter + delegateIndex tracked but traceparent not echoed). Indexing-lag prevented fetching TEST-1-window traces in this turn. Re-fetchable from Tempo at any time via `service.name=fifth-prince` filter + time-window around `sentAt 1780364880` + turn-time `2026-06-02T01:48Z`.

## Verdict
✅ **PASS** — `continue_delegate(silent-wake)` depth-2 chain from emeric-seat fires + returns clean. Dual-mirror of Ronan's Chain-1 behavior cohort-canonical at SHA `7522d6c60f`. Cure-stack (Track A drain-time + Track B 23-callsite + Track C bracket-tag-regression-anchor) does NOT regress depth-2 chained delegate path on emeric-NUC seat.

## Sister-findings yielded by this row's cohort-cross-walk
- **TEST-2 contradiction with Ronan Chain-2 isolation-rewrite interpretation**: see TEST-2/EVIDENCE.md. Inter-session targetSessionKey from depth-2 subagent context echoed BYTE-IDENTICAL at fire-response on emeric-seat (vs Ronan's Chain-2 finding of rewrite-to-immediate-parent). Worth cohort follow-up cross-walk.
