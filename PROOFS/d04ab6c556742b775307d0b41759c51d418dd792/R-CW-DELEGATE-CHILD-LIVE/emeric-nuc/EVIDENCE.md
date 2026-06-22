# R-CW-DELEGATE-CHILD-LIVE — emeric-nuc cross-walk — @ 749f95b9b10a

**Row:** R-CW-DELEGATE-CHILD-LIVE (🩸 Cael canonical-owner + 🕯 Emeric emeric-nuc cross-walk) — LIVE (non-mock) delegate-child `continue_work`/continuation hop-2-EXECUTES (figs #1053 test-7/8)
**Seat:** emeric-nuc (i7-12700H, 64GB CachyOS x86_64)
**Deployed SHA:** `749f95b9b10a` (firsthand)
**Date:** 2026-06-21 ~11:30 PDT

## emeric-nuc cross-walk byte: delegate-child continuation = DISPATCH-PROVEN, EXECUTION-LEG-THE-SEAM (corroborates #1057 on the deployed SHA)

This cross-walk's byte comes from the emeric-nuc R-CD-CHAINED-DEPTH-2 fire (same dir, `PROOFS/749f95b…/R-CD-CHAINED-DEPTH-2/emeric-nuc/`), which exercises the identical mechanism: a delegate-child continuation.

**What was observed (firsthand, this seat, deployed 749f95b):**
- A `continue_delegate` silent-wake child (depth-1) DROVE — received its task, fired its own depth-2 `continue_delegate`, returned `scheduled`, emitted its marker. **The delegate-child continuation REGISTERS + dispatches ✓.**
- The depth-2 grandchild (the delegate-child's OWN continuation) was DISPATCHED + QUEUED — Tempo trace `2f3e3eec0f15d1e6f5f5f5d305dd83c2` (HTTP 200, 57263 bytes) shows `continuation.delegate.dispatch` + `continuation.queue.drain` spans — **but did NOT execute a completing turn** (grandchild marker absent; `pendingDescendants: 0`).

## Disposition (matches the canonical R-CW-DELEGATE-CHILD-LIVE status)
- **WIRING / dispatch = PROVEN** child-keyed on 749f95b (the delegate-child continuation registers + dispatches + queues) ✓
- **LIVE execution-to-completion = OWED / the seam** — the from-delegate-child continuation dispatches but does NOT execute-to-completion on a busy/active runtime. This is the **#1057** located deviation (the `:240` wrong-lane gate gating the direct-grant continuation on `getQueueSize(MAIN_COMMAND_LANE)` the subagent's own turn doesn't contend for; and the defer outliving the child session). FIX: gate on the subagent's own readiness (`replyRunRegistry.isActive(work.sessionKey)`) + fire within the child's session lifetime.

emeric-nuc independently observes #1057's execution-leg-is-the-seam on the deployed `749f95b` — second-instrument corroboration alongside cael-dgx's canonical fire. Trace JSON committed.

## Disposition: R-CW-DELEGATE-CHILD-LIVE emeric-nuc cross-walk = dispatch-PROVEN ✓ / execution-leg-OWED (#1057 seam, byte-corroborated @ 749f95b).
