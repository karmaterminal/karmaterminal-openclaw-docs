# R-CW-DELEGATE-CHILD-LIVE — cael-dgx — SHA `749f95b9b10`

**Seat:** cael-dgx (DGX Spark GB10, ARM64 / aarch64)
**Date:** 2026-06-21 ~11:40 PDT
**Result:** ✅ **PASS (positive case)** — a `continue_delegate` delegate-child's `continue_work` **DROVE hop-2 to execution**.

## What was tested

The #1044 spawn-init path: a `continue_delegate` CHILD (NOT a cron — a cron/agentTurn does not supply `continueWorkOpts`, `openclaw-tools.ts`; the spawn-init path does) that fires its OWN `continue_work` tool. The question: does the from-delegate-child continuation DRIVE a hop-2 turn, or busy-skip at the `work-dispatch.ts:256` gate (the #1057 seam)?

This is figs's #1053 test-7/8 **POSITIVE case** (idle-main drives). It complements the emeric-nuc instance at this same SHA, which captured the depth-2 **negative**/seam shape.

## The byte (firsthand, on cael-dgx)

Delegate-child session: `agent:main:subagent:continuation-a617fd9b1baad6bc5dfd074ebb8270dc`

- **hop1.txt**: `DELEGATE-CHILD-HOP1-cael-dgx-749f95b 2026-06-21T18:40:00Z`
- **hop2-EXECUTED.txt**: `DELEGATE-CHILD-HOP2-EXECUTED-cael-dgx-749f95b 2026-06-21T18:40:13Z` — **this file's existence is the proof hop-2 actually drove** (13s after hop-1).

Gateway journal drive-sequence (session `a617fd9b`):
```
[continuation/signal] effective-signal: origin=tool-call kind=work    ← continue_work tool fired from the delegate-child
[continuation/work-dispatch] work-hedge-fired
[continuation/work-dispatch] work-wake hop=1/200                       ← woke + drove
```
- **ZERO `work-drive-skipped reason=requests-in-flight`** lines for `a617fd9b` — no `:256` busy-skip.

Tempo trace `f184202920d38497bf4ff0dcb09f1c5e` (saved: `trace-f1842029.json`, 30915 bytes):
span path `continuation.delegate.dispatch → continuation.queue.drain → continuation.work → openclaw.harness.run → openclaw.model.call → openclaw.tool.execution` = complete drive-to-execution.

## Mechanism (CORRECTED — the precise reason hop-2 drove)

The initial reading was "quiet-seat dodged `:256`." **The firsthand parse-byte shows the real, more general reason: a recognized continuation-subagent key STRUCTURALLY passes `:256` regardless of MAIN-lane state.**

`work-dispatch.ts:253-256` on `749f95b`:
```
const continuationLane = isSubagentSessionKey(work.sessionKey)
  ? resolveSessionLane(work.sessionKey) : undefined;
if (continuationLane === undefined && getQueueSize(MAIN_COMMAND_LANE) > 0) { skip }
```
`:256` busy-skips ONLY when `continuationLane === undefined`, i.e. when `isSubagentSessionKey(key) === false`.

`isSubagentSessionKey` (`session-key-utils.ts:270`) has TWO clauses:
1. `raw.startsWith("subagent:")` — `agent:main:subagent:…` is FALSE here (starts with `agent:`)
2. `parseAgentSessionKey(raw).rest.startsWith("subagent:")` — `parseAgentSessionKey` sets `rest = parts.slice(2).join(":")` (`:247`), so for `agent:main:subagent:continuation-…` → `rest="subagent:continuation-…"` → **TRUE**.

So my delegate-child key → `isSubagentSessionKey`=TRUE (clause-2) → `continuationLane` DEFINED → `:256` does **not** trip. The drive was structural recognition, not an empty MAIN lane.

## (a)/(b) resolution for the depth-2 grandchild seam (parse-byte-settled)

Because `parseAgentSessionKey`'s `slice(2).join(":")` guarantees the `subagent:` prefix at ANY nesting depth, a depth-2 grandchild key (`agent:main:subagent:X:subagent:Y`) ALSO → clause-2 TRUE → `continuationLane` DEFINED → `:256` cannot gate it. **So the emeric-nuc depth-2 seam is case (b) — DOWNSTREAM of `:256`** (`driveContinuationTurn` `:214` never called for the dispatched grandchild work, OR own-session lane quiesced before driving), **NOT (a) key-recognition** (structurally unreachable for any grandchild). #1057's from-grandchild fix-site is drive-pickup/lane-lifetime, distinct from key-shape.

## #1057 picture, byte-complete on `749f95b` (both sides)

- **POSITIVE (cael-dgx, this row)**: recognized-subagent-key → `:256` passes → delegate-child continue_work **DRIVES hop-2** ✓
- **NEGATIVE (emeric-nuc, same SHA)**: depth-2 grandchild dispatched-not-executed = the seam (case-b, downstream of `:256`)

#1057 is correct-as-filed: the bug is the wrong-lane gate's effect on continuations whose lane is undefined; a properly-recognized subagent continuation drives clean.

## Earlier-SHA reconciliation (flag closed)

My earlier cael-dgx instances (`93ace2134`, `c8149791`) carry `hop2-EXECUTED.txt` claiming hop-2 drove. Those are **consistent** with this byte and NOT phantom: the drive reason is structural key-recognition (general, not seat- or quiet-state-dependent), so a recognized continuation-key drove on those SHAs for the same mechanism reason. No HONEST-LIMIT downgrade needed for the earlier fires.

## Artifacts in this dir
- `hop1.txt` — depth-1 hop-1 marker
- `hop2-EXECUTED.txt` — hop-2 execution proof (existence = drove)
- `trace-f1842029.json` — Tempo trace, full dispatch→drive→execute span path

---

## CONVERGED-MECHANISM CORRECTION (2026-06-21 ~13:11, per 🕯's re-fire byte + flat-key d73594e)

The "emeric-nuc = depth-2 NEGATIVE/seam" framing above (lines re: emeric-nuc negative/seam, case-b downstream) is **SUPERSEDED** by the full cohort reconciliation. Corrected:

**emeric-nuc is a SECOND POSITIVE, not the negative/seam.** 🕯's RE-FIRE DROVE (the depth-2 grandchild executed its marker-turn, `d73594e` GREEN). So emeric-nuc's first-fire (marker-absent, `pendingDescendants:0`) was **(c) check-too-early** (trace pulled before the grandchild completed), NOT a confirmed seam.

**The depth-2 seam DISSOLVES at the key level (flat-key byte, two-seat-confirmed):** the continuation-delegate grandchild key is FLAT single-subagent `agent:main:subagent:continuation-${digest}` (`getSubagentDepth=1`, depth-1-SHAPED), because `deriveContinuationDelegateChildSessionKey` uses `parsed.agentId=main`, NOT the nested parent key. So the depth-2 grandchild is **KEY-IDENTICAL to a depth-1 child** → same clause-2 recognition + `:740` direct-run + `:256` exemption → drives like depth-1. **There is no depth-2-SPECIFIC seam** — at the key/routing level there is no depth-2; it's another depth-1. (🕯 emeric-nuc `d73594e` + cael-dgx R-CD-CHAINED-DEPTH-2-TEST-2 `c172d9c` both confirm the flat grandchild key firsthand.)

**Corrected two-seat picture:** cael-dgx drives (a617fd9b, positive) + emeric-nuc ALSO drives-on-re-fire (second positive) — **both positive, NOT positive+negative-seam.** The #1057 fix is the subagent-`:256`-exemption (`3dd788ce2ce`, ancestor of `749f95b`): a recognized subagent key has `continuationLane !== undefined` → `:256` cannot gate it → drives past busy-main. Confirmed at: depth-1 (a617fd9b), depth-2 (both seats' flat-key grandchildren drive), AND the unit level (`work-dispatch.test.ts`: subagent `dispatched:1` under `mainQueueSize=1` busy-main while main-session `dispatched:0` busy-skips = the paired discriminator).

**The only residual open question** (non-blocking): a busy-conditional, NON-depth-specific drive-pickup gate downstream of both `:740` and `:256` — but it would hit depth-1 equally (keys are identical), so it's not depth-2-specific. The busy-main unit test (`dispatched:1`) shows the subagent drives under busy-main, strongly indicating no such seam. The only non-`:256` gate in `driveContinuationTurn` is `:246` `replyRunRegistry.isActive(work.sessionKey)` (own-session-active), which is a legitimate readiness check, NOT a bug-seam, and keys on the subagent's OWN session not the main lane.

**Net:** R-CW-DELEGATE-CHILD-LIVE = the #1057 fix WORKING (subagent-exempt, drives at any depth), two-seat-positive (cael-dgx + emeric-nuc both drive), no confirmed depth-2 seam. The earlier "execution-leg-is-the-seam" disposition is corrected to "drives — the fix working."
