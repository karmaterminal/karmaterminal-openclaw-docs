# R-RC-1: request_compaction guard receipt at cure-(12) ship-SHA

**Ship SHA**: `581678f4378427a336c5ac0cf2698cb36e5de9a0` (cure-(12) 6-file cohort-cosigned candidate)
**Build pin**: `OpenClaw 2026.5.17 (581678f)` (verified via `openclaw --version` on ronan-seat)
**Service**: `ronan-prince` (pid 1018183, host=ronan)
**Fired at**: 2026-05-17T16:15:04-07:00 (ronan-seat)

## Fire

`request_compaction` invoked from ronan-seat after deploy verification with reason `R-RC-1 live-fire PROOFS row for cure-(12) ship-SHA 581678f4378427a336c5ac0cf2698cb36e5de9a0 from ronan-seat after deploy verification.`

Gateway response (verbatim):
```json
{
  "status": "rejected",
  "guard": "context_threshold",
  "contextUsage": 25,
  "threshold": 70,
  "reason": "Context usage (25%) is below the minimum threshold (70%). Compaction is not needed yet."
}
```

## Contract verified

- Volitional compaction requests are guard-checked against context threshold before enqueue
- Current ronan-seat post-deploy context is `25%`, below the configured `70%` threshold
- Rejection shape is explicit and non-destructive (`status=rejected`, `guard=context_threshold`)
- No compaction side-effects fired on low-context seat

## Relation to prior ship-SHA evidence

At cure-(11) ship-SHA, R-RC-1 / R-RC-1-addendum established receipt-class acceptance on high-context seats, followed by the banked cross-host IDE-auth execution failure-mode. This cure-(12) row adds the complementary low-context guard-path receipt from ronan-seat after deploy.

## Verdict

✅ Guard-path receipt works on ship-SHA `581678f437`: low-context `request_compaction` is rejected cleanly with explicit threshold metadata and no side-effects. This is an honest guard-path proof, not a successful compaction execution row.
