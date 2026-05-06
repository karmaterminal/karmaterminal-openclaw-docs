# Swim 6 — three-layer canary validation

**Cycle window**: 2026-03-06 (~05:17 PST summary timestamp)
**SUT**: continuation canary on Silas (`urudyne`, WSL2)
**Build**: `3a03f4658`
**Result**: 11 passed · 1 failed (fix applied) · 2 deferred

## Status

This page preserves historical continuation evidence evacuated from the older
`karmaterminal/openclaw` branch `ronan/rfc-evidence-appendix`, which served as an
RFC evidence surface before `karmaterminal-openclaw-docs` existed.

It is historical evidence, not the current validation cycle.

## Scorecard

| Test | Description | Result |
| --- | --- | --- |
| 6-1 | Blind enrichment | ✅ PASS |
| 6-2 | Queue-drain resistance | ✅ PASS |
| 6-3 | Post-compaction (needs context buildup) | ⏸️ DEFERRED |
| 6-4 | Return-to-fresh-session (3/3 shards) | ✅ PASS |
| 6-5 | Context-pressure lifecycle | ⏳ DEFERRED |
| 6-6 | 3-hop chain + visible announce | ✅ PASS |
| 6-7 | Chain length enforcement (off-by-one) | ❌ FAIL → fix applied |
| 6-7b | Fan-out cap (`maxDelegatesPerTurn`) | ✅ PASS |
| 6-8 | Legacy token hygiene | ✅ PASS |
| 6-9a | Missing file (graceful `ENOENT`) | ✅ PASS |
| 6-9b | Slow shard (69s, completes independently) | ✅ PASS |
| 6-9c | Empty task (tool-level rejection) | ✅ PASS |
| 6-10 | Flood test (5 spawned, 5 forbidden — three-layer defense) | ✅ PASS |

## Key findings preserved from the source branch

### 6-1 Blind enrichment

A planted file at `/tmp/swim6-enrichment.txt` (Cathar heresy) was read by a
`continue_delegate` shard returned with `silent-wake`. The blind probe recalled
Rex Mundi, 1209, Béziers, and Arnaud Amalric. The wake metadata confirmed a
`delegate-return` trigger.

### 6-2 Queue-drain resistance

The test validated that draining the event queue did not destroy pending delegate
markers. The fix landed at `38c43b486`, moving delegate-pending state out of the
queue and into a dedicated map.

### 6-4 Return to fresh session

Three delayed delegates were dispatched, the session was `/new`'d, and all three
returned to the fresh session through channel-key routing. The historical note
preserved here is load-bearing: gateway timers survived the session reset because
those timers lived in the gateway process, not in the session transcript.

## Source artifacts evacuated into this page

The historical source material came from:

- `karmaterminal/openclaw` branch `ronan/rfc-evidence-appendix`
- `SWIM6-FINDINGS.md`
- `docs/design/continue-work-signal-v2.md` (historical appendix summary)

The source branch was an older frozen RFC-evidence surface that predates the
public docs repo. This page exists so the RFC no longer has to rely on that branch
remaining discoverable forever.
