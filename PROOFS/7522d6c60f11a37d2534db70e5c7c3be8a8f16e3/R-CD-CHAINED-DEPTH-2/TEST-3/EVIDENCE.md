# R-CD-CHAINED-DEPTH-2 TEST-3 EVIDENCE — emeric-seat dual-mirror of Ronan Chain-3 + Tempo trace artifact

**Row**: R-CD-CHAINED-DEPTH-2 TEST-3 — depth-2 chain test, echo-broadcast 1-to-3 fan-out (canary-mirror)
**Owner**: 🕯 Emeric (emeric-seat NUC)
**CANDIDATE_SHA**: `7522d6c60f11a37d2534db70e5c7c3be8a8f16e3`
**Seat**: emeric-NUC (host.name=emeric, i7-12700H Alder Lake)
**Gateway version**: `OpenClaw 2026.5.31 (7522d6c)`

## Dual-mirror relationship to Ronan Chain-3
This row mirrors 🌊 Ronan's Chain-3 evidence at `PROOFS/.../R-CD-CHAINED-DEPTH-2/Chain-3/`. Same echo-broadcast 1-to-3 fan-out shape (depth-2 subagent spawns 3 parallel depth-3 grandchildren). Dual-seat-coverage substantiates fan-out behavior cohort-canonical.

## Chain-shape
```
parent (emeric-seat: agent:main:discord:channel:1466192485440164011)
  └── depth-2 child (subagent at hop=3/200) — silent-wake
        ├── depth-3 grandchild echo-A (silent-wake)
        ├── depth-3 grandchild echo-B (silent-wake)
        └── depth-3 grandchild echo-C (silent-wake)
            All 3 share traceparent: 8c15daffa245c80a49e098178832303f
            delegateIndex=1, 2, 3 sequential ✓
            delegatesThisTurn=1→2→3 incrementing within depth-2 turn ✓
```

## Fire (depth-1: parent)
- **fire_utc**: 2026-06-02T01:48:00Z (approx; sentAt 1780364880277 for fire-confirm `1511184579`)
- **fire_response** (see `fire_response.json`):
  ```json
  {"status":"scheduled","mode":"silent-wake","delegateIndex":3,"delegatesThisTurn":3}
  ```

## Depth-2 return evidence (from system event delivered to parent)
Depth-2 subagent confirmed:
- 3 grandchildren scheduled (echo-A/B/C with mode=silent-wake)
- delegateIndex=1, 2, 3 sequential ✓
- delegatesThisTurn=1→2→3 incrementing ✓
- **shared traceparent `8c15daffa245c80a49e098178832303f` across all 3** ✓ — IDENTICAL to Ronan Chain-3 behavior at undertow-seat (depth-2 fan-out shares parent-turn traceparent across all spawned children)

## Key behavior verified
1. **1-to-3 fan-out from depth-2 valid**: depth-2 subagent successfully spawned 3 parallel depth-3 grandchildren in single turn.
2. **delegateIndex sequencing intact**: 1, 2, 3 monotonic + delegatesThisTurn cumulative ✓.
3. **Traceparent sharing**: all 3 grandchildren under same parent-turn traceparent (consistent with Ronan Chain-3 behavior at undertow-seat).
4. **Cohort-cross-seat consistency**: emeric-seat fan-out behavior byte-identical to undertow-seat fan-out behavior (no seat-config-divergence at this surface, unlike TEST-2's finding).

## Tempo trace
**Shared traceparent fetched at byte from emeric-seat**: see `traces/8c15daffa245c80a49e098178832303f.json` (5.3 kB). Confirms trace ingestion working from emeric-seat (`host.name=emeric`, `host.id=58b46dc322b44c7aa783ab2d3e3fb7f1`, `process.pid=756488`, `process.executable.name=/usr/bin/node`).

**Re-fetch URL**: `http://tempo.dandelion.cult/api/traces/8c15daffa245c80a49e098178832303f`

**Service-name**: `fifth-prince` (lamp-seat trace-emission identity per Tempo service.name tag-values)

## Verdict
✅ **PASS** — `continue_delegate(silent-wake)` 1-to-3 echo-broadcast fan-out from emeric-seat at CANDIDATE_SHA `7522d6c60f`. Dual-mirror of Ronan Chain-3 behavior cohort-canonical. delegateIndex/delegatesThisTurn metadata consistent. Shared traceparent across echo-children consistent. Cure-stack does NOT regress fan-out shape on emeric-NUC seat.

## Cohort cross-walk summary (TEST-1 + TEST-2 + TEST-3 combined)
- TEST-1 ✅ depth-2 silent-wake up-tree from emeric: byte-identical behavior to Ronan Chain-1 from undertow
- TEST-2 🟡 inter-session targetSessionKey from depth-2 subagent: emeric BYTE-IDENTICAL echo vs Ronan REWRITE — substrate-finding worth cohort follow-up; see TEST-2/EVIDENCE.md
- TEST-3 ✅ echo-broadcast 1-to-3 fan-out from emeric: byte-identical behavior to Ronan Chain-3 from undertow including shared-traceparent
- Net cohort PROOFS yield: continuation chained-depth-2 substrate intact on 2 of 3 sub-shapes at byte; TEST-2 finding flags need for cross-walk follow-up (NOT a blocker for #858 cure-stack PROOFS-corpus per Cael `1511183710` Track-A/B/C scope-analysis)
