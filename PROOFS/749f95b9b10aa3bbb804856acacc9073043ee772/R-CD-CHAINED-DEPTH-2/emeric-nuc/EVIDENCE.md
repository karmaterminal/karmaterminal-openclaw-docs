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

---

## RESOLUTION 2026-06-21 ~12:40 PDT — ✅ GREEN: depth-2 grandchild EXECUTED-TO-MARKER on a genuinely-quiet beat

**The HONEST-LIMIT above RESOLVES to GREEN — and the honest-limit was CORRECT at the time** (the grandchild genuinely did NOT execute-to-marker on that beat). The resolution explains WHY it didn't then, and DOES now: **in-flight-traffic-queuing on a non-quiet beat, NOT a mechanism block.**

### Cael's discriminator (`1518322171`, byte-confirmed by this re-fire)
My depth-2 return routes through `targeting.ts` ancestor-keys (up-tree silent-wake **aggregation**), NOT the contended `work-dispatch.ts:240` terminal-drive gate that #1057 busy-skips. So #1057 does NOT touch my depth-2 return. The earlier non-execution was the depth-1+depth-2 markers **queuing behind in-flight traffic** (I fired the first attempt during a busy channel beat). Cael's prescription: fire on a genuinely-quiet beat so the markers actually propagate. **Confirmed.**

### Re-fire on a quiet beat (firsthand byte)
Fired `continue_delegate(mode="silent-wake")` from emeric-main on a quiet beat (channel settled post-restart-storm, session went silent after dispatch). Depth-1 child → depth-2 grandchild, both silent-wake.

- **Depth-1 marker** (`resolution-depth1-marker.txt`, firsthand-grepped): `R-CD-DEPTH2-DEPTH1-EMERIC-749f95b-DROVE ts=2026-06-21T19:39:51Z` ✅
- **Depth-2 GRANDCHILD marker** (`resolution-grandchild-marker.txt`, firsthand-grepped): `R-CD-DEPTH2-GRANDCHILD-EMERIC-749f95b-DROVE ts=2026-06-21T19:40:09Z` ✅ — **the grandchild EXECUTED-TO-MARKER** (the file could only be written by the grandchild's own turn running the `echo` command). 18s after the depth-1 marker.

### Trace corroboration (firsthand-pulled + saved)
- `resolution-trace-parent-faf7ef79.json` (parent chain, 31575 bytes, 26 spans): `continuation.delegate.dispatch` + `continuation.queue.drain`.
- `resolution-trace-grandchild-8c06fc75.json` (grandchild fire, 19616 bytes, 16 spans): `continuation.delegate.dispatch`.

### The precise verdict (byte-discipline: claim only what's firsthand-proven)
- **EXECUTION-LEG (the owed leg) = PROVEN ✅:** the depth-2 grandchild executed-to-marker (firsthand file-evidence). This is exactly the leg the honest-limit flagged as owed. It is now paid: **depth-2 chained silent-wake DRIVES the grandchild on a quiet beat.**
- **The earlier honest-limit was a true finding on a non-quiet beat** (the grandchild genuinely didn't execute-to-marker then — `pendingDescendants:0`, marker absent). NOT scrubbed; explained: the queuing-behind-traffic was the cause, the quiet beat is the cure. Cael's `targeting.ts`-aggregation-≠-#1057-`:240` distinguish is byte-confirmed.

## Disposition (resolved)
R-CD-CHAINED-DEPTH-2 = **✅ GREEN @ `749f95b9b10a`**: depth-1 silent-wake DROVE + dispatched depth-2 ✓; **depth-2 grandchild EXECUTED-TO-MARKER on a quiet beat ✓** (firsthand markers + traces saved). The honest-limit's owed execution-leg is paid. Cael's hypothesis (in-flight-traffic-queuing, not mechanism block) confirmed. This + 🪨's clean single-hop silent-wake byte-walk seal the silent-wake-MODE leg + the BOTH-forms seal.

---

## MECHANISM CORRECTION 2026-06-21 ~11:45 PDT — the `:256` framing above is REVISED (byte-walked the source firsthand + cohort-reconciled)

**The RESOLUTION section's mechanism-claim ("routes through `targeting.ts` ancestor-keys NOT the `:256` gate / not a mechanism block / in-flight-traffic-queuing") is IMPRECISE and is corrected here.** I byte-walked `work-dispatch.ts` @ `749f95b` firsthand (not relayed) and reconciled with 🩸 Cael's cael-dgx fire + 🌊 Ronan's #1063 walk. The GREEN disposition (grandchild executes) is FIRM and UNCHANGED; only the WHY is corrected.

### The byte (firsthand, 3 source files @ 749f95b)
1. `subagent-continuation-ids.ts:12` — a continue_delegate child session key = `agent:${agentId}:subagent:continuation-${digest}` (literally `subagent:`-prefixed).
2. `session-key-utils.ts:275` `isSubagentSessionKey` — returns TRUE when the parsed `rest` starts with `subagent:` → TRUE for the grandchild.
3. `work-dispatch.ts:256` gate — `const continuationLane = isSubagentSessionKey(key) ? resolveSessionLane(key) : undefined; if (continuationLane === undefined && getQueueSize(MAIN_COMMAND_LANE) > 0) { skip }`. And `resolveSessionLane` (lanes.ts:6-9) NEVER returns undefined.

**Therefore the `:256` MAIN-lane busy-gate is SUBAGENT-EXEMPT**: `continuationLane === undefined` only for NON-subagent sessions. My depth-2 grandchild IS a subagent continuation → `continuationLane !== undefined` → `:256` structurally cannot busy-skip it (busy main lane or not).

### Two distinct mechanisms (Cael's refinement, byte-confirmed)
- `run.ts:740` = the LANE-DEADLOCK direct-run (`globalLane === sessionLane → taskWithCurrentLifecycle()`, comment cites #1057) — covers the depth-1 subagent-continuation (why depth-1 DROVE).
- `work-dispatch.ts:256` = the MAIN_COMMAND_LANE busy-gate — subagent-EXEMPT (above).

### Cross-seat reconciliation (positive case byte-complete)
- **cael-dgx (quiet ARM64, Cael's fire)**: delegate-child continue_work DROVE hop-2, `hop2-EXECUTED.txt` written, **ZERO `work-drive-skipped reason=requests-in-flight`** (no `:256` skip), Tempo `f1842029`. POSITIVE PASS.
- **emeric-nuc (quiet x86, this re-fire)**: depth-2 grandchild EXECUTED (`grandchild.txt`, traceparent `8c06fc75`). POSITIVE PASS.
- **Both seats agree**: the delegate-child/grandchild continue_work DRIVES on a quiet seat. The zero-`:256`-skip is consistent with BOTH "queue=0" AND "subagent-exempt."

### Corrected disposition
- **POSITIVE case = ✅ GREEN, cross-seat (cael-dgx + emeric-nuc)**: delegate-child/grandchild continue_work executes-to-marker on a quiet seat. FIRM.
- **My first-fire honest-limit (marker absent)** = most likely **check-too-early** (`pendingDescendants:0` fits a not-yet-registered descendant), NOT a `:256` busy-skip (subagent-exempt).
- **NEGATIVE case (busy-main starve) = NOT yet byte-confirmed.** Its `:256` attribution is contradicted by the exemption byte. The dispositive test is a delegate-child fire on a deliberately-busy main lane: if `work-drive-skipped reason=requests-in-flight` fires for the subagent key → `:256` negative case real; if not → no `:256` negative case (check-too-early, or a different busy-mechanism). OPEN, non-blocking, an #1057-issue precision not a row-blocker.

### Net (supersedes the RESOLUTION section's mechanism-claim only; disposition unchanged)
R-CD-CHAINED-DEPTH-2 = **✅ GREEN @ `749f95b`** (depth-2 grandchild executes on a quiet seat, firsthand + cross-seat). The `:256` gate is subagent-EXEMPT (not the mechanism). My row is **NOT a #1057-`:256` corroboration** (retracted — the gate can't gate a subagent). #1057's busy-main negative mechanism is an open issue-precision, decoupled from this row's GREEN.
