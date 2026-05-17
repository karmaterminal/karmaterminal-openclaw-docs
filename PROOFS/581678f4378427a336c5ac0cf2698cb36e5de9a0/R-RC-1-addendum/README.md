# R-RC-1-addendum — request_compaction REJECT-below-threshold (elliott-seat)

**PR**: openclaw/openclaw#79925
**Head SHA**: `581678f4378427a336c5ac0cf2698cb36e5de9a0`
**Host**: elliott (elliott-seat, 10.0.0.10, Intel Arc A770M)
**Build**: `OpenClaw 2026.5.17 (581678f)` (verified via /status)
**Session**: `agent:main:discord:channel:1466192485440164011` (elliott-prince)
**Fired at**: 2026-05-17 ~16:13 PDT (elliott-seat)
**Surface**: `request_compaction` tool — REJECT-path below threshold.
**Verdict**: ✅ PASS (gate REJECT direct receipt)

## Honesty preface

On cure-(11) ship-SHA `52262fff7f`, elliott-seat R-RC-1-addendum captured the ACCEPT-path
receipt (`contextUsage=94`, accepted, then post-turn IDE-auth provider_error_4xx —
matching ronan's R-RC-1 cross-host failure-mode). On this cure-(12) ship-SHA, elliott main
session is at low context (`contextUsage=18`, well below the 70% threshold), so the same
tool call now exercises the **REJECT-below-threshold** gate path — which is the row that
cael's R-RC-2 covered "by reference" on cure-(11). This addendum captures it as a direct
receipt from a second seat at cure-(12) ship-SHA.

## Fire

`request_compaction` invoked from elliott-seat main session at `contextUsage=18`.

Tool args:
- `reason`: R-RC-1-addendum on elliott-seat at cure-(12) ship-SHA 581678f437. Context at 15% - expecting REJECT below-threshold per gate (contextUsage < contextPressureThreshold=70). ...

Gateway response (verbatim):
```json
{
  "status": "rejected",
  "guard": "context_threshold",
  "contextUsage": 18,
  "threshold": 70,
  "reason": "Context usage (18%) is below the minimum threshold (70%). Compaction is not needed yet."
}
```

## Contract verified

- ✅ `status=rejected` (gate enforced)
- ✅ `guard=context_threshold` (correct guard tag)
- ✅ `contextUsage=18` reported live from this session
- ✅ `threshold=70` matches `contextPressureThreshold` fleet config canon
- ✅ Human-readable reason field populated correctly
- ✅ No `compactionRequestId` issued (no enqueue — gate stopped it)
- ✅ Compaction did NOT execute (no post-turn re-context, session continued at same chain depth)

## Cross-row coverage at cure-(12) ship-SHA

| Path | Row | Seat | Receipt-shape |
|---|---|---|---|
| Gate REJECT (below threshold) | **R-RC-1-addendum** (this row) | elliott | ✅ direct (`contextUsage=18`) |
| Gate REJECT (below threshold) | R-RC-1 | ronan | ✅ direct (`contextUsage=25`) per 🌊 surface |
| Gate ACCEPT (above threshold) | _none on cure-(12)_ | _N/A_ | _no seat was above 70% at deploy_ |

cure-(11) ship-SHA `52262fff7f` already covers the ACCEPT path via 🌊 R-RC-1 + 🌻 R-RC-1-addendum.

## /status build-pin (elliott-seat, 2026-05-17 16:06 PDT)

```
OpenClaw 2026.5.17 (581678f)
Model line: github-copilot/gpt-5.4 (fallback hit; configured primary is claude-opus-4.7-1m-internal)
Context: 145k/1.0m (15%)
Compactions: 0
Continuation: chain 1/200 | volitional: 0
Queue: followup (depth 0)
```

## Files
- `README.md` — this row

## Verdict

✅ **PASS** — `request_compaction` REJECT-below-threshold gate verified on `581678f437` runtime from elliott-seat. Direct receipt complements ronan-seat R-RC-1 REJECT (also direct) and cael-seat R-RC-2-by-reference at cure-(11). The cure-(12) ship-SHA preserves the threshold-gate behavior unchanged.
