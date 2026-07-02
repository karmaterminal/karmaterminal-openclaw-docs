# Continuation feature — desired-behavior spec (the expectation, so "erroneous" is definable)

Anchor: deployed `3ae2d4cb2cca793d2a077a6c1d8daeaf43bc40f5`. This defines what SHOULD happen for each cell of figs's #1053 test-matrix, grounded in the implementation. "Works/doesn't" is measured against THIS, not a shrug.

## The 4 surfaces × 2 contexts

| surface | main/root session | delegate-child (subagent) |
|---|---|---|
| `continue_work()` tool | DESIRED: schedules one next-turn; fires once at its delay. | DESIRED: child self-continues — schedules + DRIVES hop-2 in the child's OWN session (figs `1516841690`). |
| `CONTINUE_WORK[:N]` bare token | DESIRED: parity with the tool — drives hop-2 from parsed reply text (`tokens.ts:538`). | DESIRED: parity — child self-continues (parsed; routes same scheduler). |
| `[[CONTINUE_WORK]]` bracket | DESIRED: NOT parsed in main (canonical lacks it by design; main uses bare-token + tool). Intentional. | DESIRED: parsed (`subagent-announce.ts:453`), figs ruled it MUST fire (lightContext leaf has no tool — bracket is its only path). |
| `continue_delegate()` tool / `[[CONTINUE_DELEGATE]]` | DESIRED: schedule → spawn → return (both forms parity). | DESIRED: child spawns a further delegate (chains; return follows up-tree on collapse to root). |

## figs's 8 tests — desired behavior + erroneous-definition

1. **root → `continue_work()`** — DESIRED: exactly 1 next-turn fires. ERRONEOUS: 0 turns (drop) or >1 (double-arm).
2. **root → `[[CONTINUE_WORK]]`** — in MAIN: DESIRED: no-op (bracket not a main token; bare `CONTINUE_WORK` is the main token form). Not erroneous-that-it-doesn't-fire; erroneous would be silently doing something unexpected. (Open: do we WANT main bracket-parity? Default answer: no — main has the tool + bare-token; bracket is the tool-less-leaf affordance.)
3. **root → `[continue_work(60), continue_work(120), continue_work()]`, yield immediately** — DESIRED: **3 distinct next-turns**, at +0s, +60s, +120s (each election has its own `dueAt` = electedAt + delay; `consumePendingWork` returns only matured). #982 array-fix (`attempt-execution.ts:769`) enables all 3 to enqueue. ERRONEOUS: only 1 fires (the pre-#982 single-var drop — now fixed).
4. **root → `[continue_work(60), continue_work(120), continue_work()]`, wait 120s then yield** — DESIRED is **CONDITIONAL on the stale-grace threshold** (`work-dispatch.ts:368-393`, `partitionSupersededWork`, #986 Guard 2): **on-time staggered elections drain one-per-poll and NEVER co-arrive** → each fires as its own turn (so the default + 60s + 120s = up to 3 distinct turns if they drain on-time). **A batch of >1 maturing together means they PILED UP** (the session was busy through the window); a stale pile **past `supersededGraceMs` (= `maxDelayMs × SUPERSEDED_GRACE_MULTIPLIER`)** is COALESCED — the stale ones are `markPendingWorkSuperseded` + folded into the newest (`[system:continuation-note] N stale wake(s) folded into newest (backlog coalesce)`); below the grace they are NOT collapsed. So the answer to figs's "do they collapse?" is **"depends on the stale-grace"**: on-time → N distinct turns; piled-past-grace → fold-to-newest. ERRONEOUS: collapsing on-time-staggered elections (losing distinct turns) OR failing to fold a genuine stale pile (turn-storm of long-overdue wakes). [Corrected from an earlier "collapse-by-design" overstatement: the collapse is grace-conditional, not blanket.]
4a. **root → `[continue_work(0 active-35s), continue_work(20), continue_work(21), continue_work(22)]`** — DESIRED: the +20/+21/+22 wakes mature while the immediate reply-run is active, but they MUST NOT start parallel provider/model calls against the same session. Acceptable current-design outcomes are: (a) delayed wakes queue/idle-retry and enter only after the active run completes; or (b) delayed wakes coalesce/evaporate with a visible `[system:continuation-note]`/warning delivered into the active turn carrying provenance (`originRunId`, `originTurnId`, `electedAt`, `anchorFinalizedAt`, `dueAt`, `foldedAt`/`deliveredAt`, `overdueBy`, original reason, chain/hop, flowId, disposition). ERRONEOUS: simultaneous provider buys for the same session, no conflict telemetry, or repeated buy/retry storm. This is the R-CW-ACTIVE-OVERLAP row; it is distinct from stale-backlog collapse because the contention is with a live in-flight reply-run. Observed R-1135-ACTIVE-TOOL-2028 current behavior: delayed idle-retry delivery after the active run, not evaporate+inform into the active turn; bounded but not figs's preferred disposition, and not the Silas #1137 provenance-note contract.
5. **root → `continue_delegate()`** — DESIRED: schedule → spawn child → child runs → returns. ERRONEOUS: no spawn / no return.
6. **root → `[[CONTINUE_DELEGATE]]`** — DESIRED: parity with (5).
7. **root → `[continue_delegate() → continue_work() → continue_delegate()]`** (tool) — DESIRED: the delegate-child self-continues with `continue_work` (drives its OWN hop-2) AND spawns a further `continue_delegate`; the inner delegate's return wakes the child (or doesn't), and the child's return follows up-tree on collapse to root. The child's continue_work has NOTHING to do with the parent/root session. ERRONEOUS: the child's continue_work doesn't drive hop-2 (the #952/#1044 regression — FIXED; or a residual that the live `Real behavior proof` gate catches).
8. **repeat (7) with TOKEN** — DESIRED: parity (bracket `[[CONTINUE_WORK]]` from the child drives hop-2; bracket `[[CONTINUE_DELEGATE]]` chains).

## Current proven/owed state (against the above definitions)

- **CODED-WORKING + unit-tested**: (1) tool main · (2) bare-token main · #982 array-fix (multi-cw enqueue, `attempt-execution.ts:769`) · #1044 reap-cull (`issue-1044-tool-form-self-continue.test.ts`, mocked) · (5)(6) delegate · the bracket-child arm (`:453`→`:545`).
- **PROOF-row owed (the fix is in; the row isn't filed)**: tests 3/4 (multi-cw fan-out + the wait-120s-collapse semantics above) · **R-CW-ACTIVE-OVERLAP** (due-while-active collision stress; R-1135 class) · tests 7/8 LIVE hop-2-EXECUTE — **TWO LAYERS (🌊+🪨 re-split):** (1) the DISPATCH-MECHANISM is TEST-PROVEN-AS-BUG — 🌿's test (`ef90f994b2`) + PR #1060's regression-test (`work-dispatch.test.ts`) assert the `dispatched` count: own-session-idle + main-busy → `received 0 / expected 1` = the `:240` wrong-lane gate busy-skips = #1057 (figs-ruled), GREEN post-fix. (2) the LIVE terminal-drive-COMPLETES-end-to-end (a real delegate-child takes a fresh hop-2 turn to COMPLETION on a genuinely-quiet runtime seat) is **still OWED** — the live runs busy-skipped / the child ended before the hedge fired, so no fresh turn completed live (the dispatch-unit-assertion ≠ the live-full-loop-completion). The #1045 `Real behavior proof` gate is an orthogonal doc-gate (greps the body), NOT the behavioral surface. So: dispatch-mechanism-TEST-PROVEN-AS-BUG + fix-owed (PR #1060) · live-full-loop-completion still OWED.
- **By-design (state it, don't defer)**: main does NOT parse bracket-`[[CONTINUE_WORK]]` (tool+bare-token are the main forms) · continue_work registration is asymmetric (needs in-process `continueWorkOpts` callback; continue_delegate uses TaskFlow) · multi-cw elections drain one-per-poll when on-time-staggered; only a stale pile past `supersededGraceMs` is coalesced/folded into the newest (`partitionSupersededWork`, grace-conditional — NOT a blanket collapse).

## New PROOFS rows to add

- **R-CW-MULTI** (🩸 Cael) — multi-`continue_work()` same-turn fan-out: N elections in one turn → N distinct wakes at their delays (tests #982 array-fix). BOTH forms (tool + bare-token). Proves test-3 (yield-immediately = 3 distinct turns).
- **R-CW-ACTIVE-OVERLAP** (🩸 Cael + 🌿 scribe-observer) — due-while-active collision stress: one immediate `continue_work` holds the reply-run active while delayed siblings mature (+20/+21/+22 in R-1135). Proves that matured work does NOT buy parallel provider turns against the same session; it either queues/idle-retries until active completes or coalesces/evaporates with explicit warning/continuation-note. Evidence must include visible wake order, flow status/revisions, request-in-flight/skip/coalesce logs, model-call spans, Tempo traces, folded-note provenance fields when applicable (`originRunId`, `originTurnId`, `electedAt`, `anchorFinalizedAt`, `dueAt`, `foldedAt`/`deliveredAt`, `overdueBy`, original reason, chain/hop, flowId, disposition), and classification as one of: delayed-idle-retry, evaporate+inform-with-provenance, stale-fold-with-provenance, or regression/parallel-buy.
- **R-CW-MULTI-COLLAPSE** (🩸 Cael) — multi-`continue_work()` with elapsed-overlap: the grace-conditional fold — on-time-staggered drains one-per-poll (distinct turns); a stale pile past `supersededGraceMs` is coalesced into the newest (`partitionSupersededWork`/`markPendingWorkSuperseded`). Proves test-4 (the grace-threshold discriminator, NOT a blanket collapse).
- **R-CW-DELEGATE-CHILD-LIVE** (🩸 Cael / 🕯 cross-walk) — the LIVE (non-mock) from-child hop-2-EXECUTE (tests 7/8). **STATUS: WIRING (register+arm+wake+hop-1-dispatch-ATTEMPT) PROVEN child-keyed ✓** (🌫 2026-06-20, precision-corrected by 🌊: delegate-child continue_work registers+arms+wakes+fires-the-hop-1-dispatch-ATTEMPT under its own session key, flowId `48510873` — then `work-drive-skipped requests-in-flight` = **busy-skipped at hop-1, NEVER hop-2-EXECUTE**; #1044 wiring LIVE in the delegate-child) — figs's "a delegate MUST self-continue" answered at the **WIRING / no-inversion** level (NOT hop-2-execute — "dispatches" overstated it; both 🌫's `48510873` + 🌊's `db3d5e33` busy-skipped at hop-1). **DESIRED (figs-ruled): from-child continue_work MUST DRIVE hop-2.** Defer-when-GENUINELY-contended (the subagent's own turn would actually collide) is fine/by-design; permanent-defer is NOT. **LOCATED DEVIATION = #1057 (figs-ruled BUG, RED on `3ae2d4cb2c`): the from-child terminal drive is BROKEN on a busy main seat** — `work-dispatch.ts:240` gates the direct-grant continuation on `getQueueSize(MAIN_COMMAND_LANE)`, the MAIN lane the subagent's own direct-grant turn does NOT contend for → it defers on traffic that isn't its own → perpetual HOP1-only, never drives. This is the **wrong-lane gate = the bug, NOT "correct-by-design busy-skip"** (the spec must name the deviation, not normalize it — else it encodes the bug as the expectation, the exact "shrug" figs called out). Second dimension (🪨): the defer outlives the child session → hop-2 LOST not delayed. **FIX (both dimensions): (a) gate on the subagent's own readiness (`replyRunRegistry.isActive(work.sessionKey)`), NOT MAIN_COMMAND_LANE; (b) drive within the child's session lifetime.** Two-instrument-confirmed (🕯 spawn-init `75c6899b` + 🌫 delegate-child + 🌊 harness = the same `:240` defect). NB the #1045 `Real behavior proof` gate is a PR-body-evidence-policy check (greps the PR body), NOT a runtime hop-2 test — the behavioral surface is #1057. **The one OWED clean cell: a genuinely-quiet child-seat (same-agent idle at wake AND child alive through the hedge) where the drive FIRES** — greens it; on a busy main seat, #1057 is the confirmed deviation.

## Mixed-surface fanout stress (2026-07-01)

**R-CONTINUATION-MIXED-SURFACE-FANOUT** exercises a single originating turn that emits three independent continuation surfaces:

1. token-form `CONTINUE_WORK:20`;
2. immediate `continue_delegate` whose result wakes/returns to the origin;
3. a delegate-child that schedules its own depth-2 `continue_delegate(..., 22s, targetSessionKey=<main-session>)`.

DESIRED: each branch keeps separate provenance, chain/hop identity, trace id/span hierarchy, and delivery disposition. No branch silently masks another; no duplicate provider turn is bought for the same session; depth-2 targeted return reaches the exact target session; any token-origin `continue_work` that matures into an active turn is subject to the same fold/inform provenance contract as R-CW-ACTIVE-OVERLAP.

ERRONEOUS: token form silently no-ops on a surface claiming token support; message-tool-only surfaces are misclassified as token-proof; one branch collapses another without provenance; targeted depth-2 return is dropped or misdelivered; or the combination produces an unbounded retry/wake storm.

Surface caveat: this row must record the originating surface. A token embedded inside a `message` tool body is not scanned, but a raw assistant final-text response ending in bracket/bare continuation syntax is scanned even in this Discord session class (Cael live canary 2026-07-01: raw final `[[CONTINUE_WORK:20]]` produced a continuation wake). Do not count message-tool body text as token proof; use raw final text or an explicit harness for the token leg.

## §collection-on-collapse — figs's NECESSARY proof (the one that outranks the 8 single-shots)

figs #1053 flagged: *"this does NOT test necessary like inter-session return, chains, fanout etc. which are NECESSARY proofs... if this last doesn't make sense and isn't in proofs rows; we have critical gap... this is the basis of chains, and for chain collection **where it is not the delegate waking the parent that causes new turn in delegate parent** — 'i am a delegate and i sent out more, their return wakes me, or it doesnt, and whatever happens my return will follow up tree on collapse to root'."*

**The DISTINCT cases (the gap):**
- **up-tree silent-WAKE** (R-CD-CHAINED-DEPTH-2 covers this): a child's return WAKES the parent → causes a new parent-turn.
- **collection-on-COLLAPSE** (figs's #7, the gap): the return follows up-tree on collapse **regardless of whether it triggered a wake** — the aggregation-without-wake. EVEN IF the child-return did not cause a new parent-turn, the delegate's own return still reaches root on collapse.

**DESIRED behavior:**
1. A delegate that spawned its own delegates: their returns may wake it (→ new turn) OR not (no new turn). Either is valid.
2. **Regardless of (1), the delegate's OWN return follows up-tree to its parent (`parentRunId` default return) or to all ancestors (`fanoutMode="tree"`, `targeting.ts:46`) on collapse to root.** The return is injected as a follow-up (`subagent-announce.ts:1579`, deliver=false) — it aggregates up-tree as CONTEXT the orchestrator receives, NOT necessarily a wake.
3. So a multi-level chain collapsing to root: every level's return reaches root, whether or not any individual return triggered a parent-turn along the way.

**ERRONEOUS:** a return is LOST when no wake fires (return-only-on-wake) — i.e. if the only way a return propagates up is by waking the parent, then a non-waking return is dropped, and the collection-on-collapse is broken. This is the failure figs's "necessary proof" guards against.

**Grounding:** `fanoutMode="tree"` (`tokens.ts:322`, `subagent-announce.ts:220`, `targeting.ts:46` ancestor-routing) + `parentRunId` threading (`subagent-announce.ts:274/538/1628`) + follow-up injection (`:1579` deliver=false). The wake-vs-collapse distinction is exactly figs's "their return wakes me, or it doesnt, and WHATEVER HAPPENS my return will follow up tree on collapse."

**R-CD-COLLECTION-ON-COLLAPSE** proves: a 2+-level chain where an intermediate return does NOT wake its parent, yet the leaf+intermediate returns still reach root on collapse (the orchestrator/root receives them). BOTH forms (tool `continue_delegate()` + bracket `[[CONTINUE_DELEGATE]]`). Trace: `parentRunId`-stitched spans showing the up-tree return on a non-waking collapse.

### Collapse-independence + ordering-independence (🌫's authored refinement, 2026-06-20) — the load-bearing sub-cases

*Invariant (the assertion target):* **no return is orphaned** — every leaf's result reaches root on collapse, via the chain, even if no intermediate turn was triggered by it.

*Should-happen, per surface:*
- **`fanoutMode:"tree"`** → a leaf's return is delivered to **every ancestor in the continuation chain** up to root, not just its direct parent.
- **collapse-independence** → the return reaches root **even if the intermediate ancestor already ended/collapsed** before the leaf returned. The chain-state persists the ancestry; collapse of an intermediate must NOT sever the up-tree path.
- **ordering-independence** → leaf-return-AFTER-intermediate-collapse still collects at root (the hard sub-case — the exact place a real bug hides).

*Erroneous-if:* a leaf return is dropped because an intermediate ancestor's session ended/collapsed first (orphaned-by-earlier-collapse) → **BUG**. Depth-only (child spawned) without the return arriving at root → **NOT a proof of the feature** (depth-2-ran ≠ collection-proven).

**Test-shape (🌫-authored, the assertion to build R-CD against):**
```
root(A) --continue_delegate(fanout=tree)--> B --continue_delegate(fanout=tree)--> C(leaf)

1. C completes + returns a sentinel payload
2. FORCE the ordering edge: B ends/collapses BEFORE C's return propagates
   (advance B to terminal, then release C's return)
3. ASSERT: A (root) receives C's sentinel — collected up-tree across the
   collapsed intermediate. parentRunId/chain-ancestry carries it past B's death.
4. NEGATIVE guard: assert C's return is NOT silently dropped (no orphan,
   no "B-ended-so-discard")
```
**The load-bearing assertion is step 3+4: root collects the leaf across a DEAD intermediate.** That's the feature; depth-2-ran is not. The collapse-ordering edge (step 2) is where a real bug hides — **if the chain-ancestry is read from the LIVE intermediate rather than persisted state, B's collapse orphans C.** That is the exact thing the row must catch.

**⚠️ Harness requirement (🩸 integration, from 🌊's v1 wall + 🌫's three-clears finding):** the chain (A→B→C) intermediates must be **mode=session (detached)**, NOT mode=run. A mode=run child keeps the parent blocked → MAIN_COMMAND_LANE stays non-empty → the idle/collapse path can't quiesce (proven live: 🌊's mode=run wired-subagent hit perpetual `requests-in-flight`, hop-2 never drove). The idle-fire instrument must clear **three** gates: model (opus-pin) · wiring (delegate-child/spawn-init, NOT cron — cron is #1058-dead) · **genuine-idle (mode=session, NOT mode=run)**. The collection-on-collapse test inherits this: use mode=session intermediates so B can genuinely collapse + the up-tree return can fire on a drained lane.

