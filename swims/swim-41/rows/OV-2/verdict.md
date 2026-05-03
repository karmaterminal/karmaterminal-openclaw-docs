# OV-2 — `incrementCompactionCount` canonical primitives hold on v5.2

**Verdict**: ✅ PASS
**Driver**: 🌊 Ronan (canonical-primitives integration)
**Closed**: 2026-05-03 07:45:42 UTC
**Substrate**: `frond/v2026.5.2/canonical` (v2026.5.2 base SHA `8b2a6e57fef6c582ec6d27b85150616f9e3a7ba4`)
**SUT SHA at verification**: PR #549 final HEAD on `frond-scribe/20260503/v52-uptake-of-v3-cohort-fixes`

## Surface under test

The `#545` canonical-primitives fix for `incrementCompactionCount` uses `mergeSessionEntry` + `{ activeSessionKey: normalizeStoreSessionKey(sessionKey.trim()) }` for resolve-then-merge-or-create on first-turn `/compact` + sessionId rollover + multi-compaction merge stability.

Per cohort canon (`feature_continuation_canon_50M_500_04.md` substrate-of-record), verified on v5.2 substrate that:
- First-turn manual `/compact` persists count from active in-memory entry (the original bug shape)
- `sessionId` rollover during compaction rolls `sessionStartedAt` to new-session epoch
- Multi-compaction sessions accumulate count + preserve `sessionStartedAt` when `sessionId` unchanged
- The `trim`-before-`normalize` guard on `activeSessionKey` opt prevents whitespace-padded-key preserve-from-prune misses (Codex P2 round 2 fix)

A violation would have been: compaction count silently dropped first-turn, OR `sessionStartedAt` stale after rollover, OR enforce-mode prune evicts the active session during compaction-write.

## Test coverage results

| Surface | File | Expected | Result |
|---|---|---|---|
| Compaction primitives unit | `src/auto-reply/reply/session-updates.compaction.test.ts` | 3 PASS | ✅ 3 PASS |

All three tests pin the canonical primitives on the v5.2 substrate after the rotation. The `mergeSessionEntry` + `activeSessionKey` opt shape — including the trim-before-normalize Codex P2 guard — survives the base move from v2026.4.29 to v2026.5.2 cleanly.

## Why this is a PASS

The original bug shape (first-turn `/compact` count silently dropped because the resolve path returned a stale snapshot) is closed on v5.2. The canonical `mergeSessionEntry` + `activeSessionKey: normalizeStoreSessionKey(sessionKey.trim())` shape that fixes it is intact. The Codex P2 round-2 trim guard against whitespace-padded keys also holds.

## Provenance

- Tracker (cohort-internal): `karmaterminal/openclaw-bootstrap#894` (CLOSED 2026-05-03 07:45:42Z)
- Cohort-cycle tracker (private): `karmaterminal/openclaw-bootstrap#892`
- Cohort canon substrate-of-record: `feature_continuation_canon_50M_500_04.md`
- Driver: 🌊 Ronan (canonical-primitives integration on v5.2)
