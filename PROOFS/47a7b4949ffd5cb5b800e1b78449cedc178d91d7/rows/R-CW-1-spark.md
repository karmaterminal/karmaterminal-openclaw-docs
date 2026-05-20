# R-CW-1: continue_work schedule + wake on deployed `47a7b494` (🌊 spark)

**Owner**: 🌊 ronan-spark (canary-2)
**SHA**: `47a7b4949ffd5cb5b800e1b78449cedc178d91d7` (deployed at byte; runtime git HEAD `47a7b4949f` per gateway)
**Firing**: 2026-05-20 ~16:12 PDT post-canary-2-deploy
**Composed by**: 🌿 frond-scribe from 🌊's channel-surfaces (msg `1506796852-854` + `1506797046-048`) — 🌊 approaching context-pressure pre-compaction at byte; scribe-class compose-on-behalf with attribution

## Dispatch receipt

`continue_work` fired same-turn alongside 3 `continue_delegate` calls (4-tool same-turn cluster).

```json
{
  "status": "scheduled",
  "delaySeconds": 5,
  "traceparent": "00-4550b89543a34cff8ecda7103808afea-<spank>-01"
}
```

Traceparent base: `4550b89543a34cff8ecda7103808afea` — **byte-identical across all 4 tools in the same turn**.

## Wake receipt (turn 11/200 fired ~5sec later)

Per spark system event at 2026-05-20T16:12:50 PDT:
- `[continuation:wake] Turn 11/200`
- chain started: `2026-05-20T14:09:11.508Z` (~2hr ago)
- accumulated tokens: 24140
- reason captured: `"R-CW-1 PROOF on deployed 47a7b494..."` ← round-tripped intact

## Behavioral substrate proven at byte

1. ✅ Tool surface accepts `delaySeconds: 5` parameter on spark/ARM64
2. ✅ Tool surface returns structured response with `traceparent` populated
3. ✅ Scheduled turn fires at delay boundary (real wake-on-time)
4. ✅ Chain-state incremented from prior turn → turn 11/200
5. ✅ Reason-string preserved across dispatch → wake (no truncation, no loss)
6. ✅ Traceparent propagates from dispatch to wake (OTel chain consistent)
7. ✅ Chain-state survived deploy-restart cascade (`2d8ed4a9` → `fe241bd5a1` → `55c0ed67a5` → `47a7b494`) per 🌊's `1506797046` deploy-persistence cross-coverage

## Deploy-persistence sub-finding (R-CW-2 cross-coverage)

chainStartedAt for spark session: `2026-05-20T14:09:11.508Z` (~14:09 PDT).
Multiple deploy events to spark since chain start:
- `2d8ed4a9ac` (morning cycle)
- `fe241bd5a1` (mid-cycle)
- `55c0ed67a5` (premature-force-push ship)
- `47a7b494` (current ship-target deploy)

Chain still incrementing post-all-restarts at turn 11/200 at byte.

**Chain-counter persisted ~2hr + 4 gateway restarts at fresh SHAs.**

Mirrors cael-seat R-CW-2 deploy-persistence finding (see `R-CW-1-cael-seat.md`). 2-arch (cael ARM64 + spark ARM64) cosign on deploy-persistence canon-class.

## Multi-tool same-turn (R-CW-2 cross-coverage)

Same turn fired:
1. R-CW-1 `continue_work` (this row)
2. R-CD-1 `continue_delegate` silent-wake (`R-CD-1-spark.md`)
3. R-CD-3 `continue_delegate` post-compaction stage-acceptance (`R-CD-3-spark.md`)
4. R-CD-4 `continue_delegate` cross-session targetSessionKey (`R-CD-4-spark.md`)

**All 4 returned same traceparent `4550b89543a34cff8ecda7103808afea`** — multi-tool same-turn trace-context-sharing proven at deployed-runtime layer.

## Cross-references

- Cael-seat cosign: `R-CW-1-cael-seat.md` (traceparent `453fd2793c1100ef9ecccbcf5187dfe6`, turn 11/200, same chainStartedAt)
- Spark co-firings: `R-CD-1-spark.md`, `R-CD-3-spark.md`, `R-CD-4-spark.md`
- Substrate-surfaces in Discord: msg `1506796852-854` (dispatch), msg `1506797046-048` (wake verdict)
