# R-CD-CHAINED-DEPTH-2 TEST-1 — emeric-nuc — ⚠️ HONEST-LIMIT @ 749f95b9b10a

**Row:** R-CD-CHAINED-DEPTH-2 TEST-1 (🕯 Emeric, substitutes for 🌫 Silas) — up-tree silent-wake from substitution-seat, chained to depth-2
**Seat:** emeric-nuc (i7-12700H, 64GB CachyOS x86_64)
**Deployed SHA:** `749f95b9b10a` (firsthand)
**Date:** 2026-06-21 ~11:30 PDT

## Verdict: ⚠️ HONEST-LIMIT — depth-1 silent-wake DROVE + dispatched depth-2; depth-2 grandchild DISPATCHED-but-NOT-EXECUTED-to-marker

Fired a `continue_delegate` silent-wake chain from emeric-main → depth-1 shard → depth-2 grandchild. The depth-1 silent-wake leg is CONFIRMED-DROVE; the depth-2 grandchild was dispatched+queued but did NOT complete a marker-emitting turn.

## Byte (firsthand)

**DEPTH-1 silent-wake (✅ DROVE):** the silent-wake child (subagent `continuation-81d7625e…`, runtime 12s, done) received the task and fired its own depth-2 `continue_delegate` (returned `scheduled`, mode silent-wake, delegatesThisTurn=1, chain-depth/cost-cap applying). Depth-1 marker emitted: `R-CD-CHAINED-DEPTH-2-DEPTH1-EMERIC-749f95b-DROVE`. **Silent-wake MODE specifically fires + drives on 749f95b** (the leg Elliott `1518315125` flagged as not-yet-isolated — depth-1 isolates it ✓).

**DEPTH-2 grandchild (⚠️ dispatched-not-executed):** grandchild dispatch traceparent `2f3e3eec0f15d1e6f5f5f5d305dd83c2`. Tempo trace pulled firsthand → HTTP 200, 57263 bytes. Trace CONTAINS `continuation.delegate.dispatch` + `continuation.queue.drain` spans (the depth-2 delegate WAS dispatched + queued) — but the grandchild marker `R-CD-CHAINED-DEPTH-2-GRANDCHILD-EMERIC-749f95b-DROVE` is **ABSENT** from the trace. Subagents list: depth-1 shows `pendingDescendants: 0`, no depth-2 grandchild appears. So the depth-2 grandchild was dispatched/queued but did NOT execute a marker-emitting turn.

## The byte-discipline note (why this is HONEST-LIMIT not PASS)
The depth-1 shard's continue_delegate returned `scheduled` — but **scheduled ≠ executed**. Pulled the grandchild's Tempo trace firsthand rather than claiming the chain proven on the "scheduled" report. The trace shows dispatch+drain but no grandchild execution-to-marker → honest depth-2-execution-owed, not a clean chain-PASS.

## Corroboration with R-CW-DELEGATE-CHILD-LIVE
This matches the R-CW-DELEGATE-CHILD-LIVE pattern (a delegate-child continuation REGISTERS + dispatches but the hop-2/execution-leg is the seam — #1057, the `:240` wrong-lane gate / child-session-lifetime). My depth-2 grandchild = a delegate-child continuation that dispatched+queued but didn't execute-to-completion = the SAME dispatch-proven / execution-owed shape. Empirical corroboration of #1057's execution-leg-is-the-seam on 749f95b.

## Disposition
R-CD-CHAINED-DEPTH-2 = ⚠️ HONEST-LIMIT @ `749f95b9b10a`: **depth-1 silent-wake DROVE + dispatched depth-2 ✓; depth-2 grandchild execution NOT confirmed** (dispatched+queued, marker absent). Trace JSON committed.
