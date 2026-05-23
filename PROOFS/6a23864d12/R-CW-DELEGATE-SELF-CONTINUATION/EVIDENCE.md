# R-CW-DELEGATE-SELF-CONTINUATION — Evidence

**Row**: R-CW-DELEGATE-SELF-CONTINUATION
**Prince**: 🩸 Cael (cael-seat, host `cael` per trace `host.name` attribute)
**SHA tested**: `6a23864d12ef5845b340923d3d3f1d0978751429` (PR-head)
**Date fired**: 2026-05-22 ~20:44 PDT / 2026-05-23 ~03:44 UTC
**Trace ID**: `d1d8ae4ce4b8a55a8d266b70a18d3590`

## What this row proves

The **#746 thesis**: delegate sessions can call `continue_work(<seconds>)` to schedule their own next turn. The delegate is *not* limited to single-shot execution — it can self-elect subsequent turns just like a top-level prince session can.

## Mechanic

1. Parent session (🩸 cael's main session) calls `continue_delegate("...")` to spawn a delegate
2. Delegate session boots, processes its instructions
3. Delegate calls `continue_work(7)` — schedules its own next turn 7 seconds from completion
4. Current turn ends; delegate's session enters wait state for 7s
5. After 7s wait, delegate session wakes; gateway fires its next turn
6. Delegate posts "FINAL PROOF COMPLETE" to channel; subsequent shutdown

## Live-fire receipts (Discord)

- Cael's dispatch announce: `1507590118`+`1507590261` (turn 1 of the delegate, scheduling continue_work(7s))
- Cael's wake announce: `1507590206` ("Woke 7s later at 2026-05-22T20:45 PDT. #746 PROVEN on ACTUAL PR HEAD.")
- Cael's verify announce: `1507590616` (declaring R-CW-DELEGATE-SELF-CONTINUATION re-PROVEN on the actual head)

## Trace evidence

`trace-d1d8ae4c.json` — raw OTel trace JSON pulled via `curl http://tempo.dandelion.cult/api/traces/d1d8ae4ce4b8a55a8d266b70a18d3590` from a prince-seat with network access to the Tempo instance.

The trace contains spans for: `openclaw.model.usage`, agent-turn, delegate-spawn, continuation-signal-fire, post-wake-turn-start. All emitted with `service.name=cael-prince` and `host.name=cael`. The full span tree shows the delegate's pre-wake turn AND post-wake turn stitched under one trace-id — exactly the behavior `continue_work()` from a delegate must produce.

## Why this proves #746

Before this feature: a delegate (subagent) could only execute one turn after spawn; subsequent turns weren't reachable from within the delegate's own logic. The `continue_work()` tool was a top-level-prince capability, not a subagent capability.

After this feature: delegates CAN call `continue_work()` and get their next turn scheduled. The trace + the channel-receipt + the 7-second-gap-between-spawn-and-wake all confirm the feature operates as designed on the SHA the PR ships.

## Verdict

**✅ PASS** on `6a23864d12` (the canonical PR-head SHA).
