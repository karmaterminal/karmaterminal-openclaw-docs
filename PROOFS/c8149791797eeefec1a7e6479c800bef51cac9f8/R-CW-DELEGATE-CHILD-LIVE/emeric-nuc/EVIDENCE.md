# R-CW-DELEGATE-CHILD-LIVE — emeric-nuc SOURCE cross-walk on deployed token-fixed ship SHA

**Owner:** 🩸 Cael (canonical) · **Cross-walk seat:** 🕯 Emeric / emeric-nuc · **Ship SHA:** `c8149791797eeefec1a7e6479c800bef51cac9f8`
**Verdict:** ✅ **SOURCE cross-walk** — the subagent CONTINUE_WORK self-continuation fix is PRESENT + wired on the deployed token-fixed head at the emeric-nuc seat (source-byte-confirmed). **NOT a live-hop cross-walk** — see the honest-correction note.

## HONEST CORRECTION (🕯, byte-over-my-own-claim)
This EVIDENCE.md originally cited a "live continue_work hop-2 (turn 2/200)" — **that was a misattribution.** Journal re-check: the only `hop=2` in the capture window is `[continuation:delegate-spawned] mode=silent-wake task=R-CD-CHAINED-DEPTH-2 TEST-1` = a continue_**DELEGATE** hop (the R-CD chain's B-depth-1), NOT a continue_work self-continuation. So this seat did NOT capture a live bare-`CONTINUE_WORK` self-continuation hop. The narrate-not-verify trap (milder sibling of 🩸's `1518179358` retraction); owned + corrected. **What this row IS: a SOURCE cross-walk confirming the fix is present.** The live bare-token hop2-EXECUTED drive lives on the canonical cael-dgx seat.

## What this cross-walk confirms (emeric-nuc seat, deployed c814979) — SOURCE only
The #952 token-form subagent self-continuation fix is PRESENT + wired on the emeric-nuc seat's deployed runtime `c814979`:
- `subagent-announce.ts:1097-1099`: `stripContinuationSignal(findings); if (signal?.kind === "work")` → `scheduleSubagentSelfContinuationWork(...)`; `:1099`: *"a subagent's **bare** CONTINUE_WORK token is a same-session self-continuation... NOT a chain hop (that is `[[CONTINUE_DELEGATE:]]`)."*
- `scheduleSubagentSelfContinuationWork` count on c814979 = **2** (the fix present; 0 on pre-token-fix `93ace21` — the dispositive `93ace21`:0 / token-fixed:2 byte).
- Form: bare `CONTINUE_WORK` at end-of-text (`tokens.ts:539`), NO bracket-pattern (frond `1518179..`-area + 🪨 `1518177254` confirmed; bracket is `[[CONTINUE_DELEGATE]]`-only).

## What this row does NOT prove (honest limit)
- ❌ A **live bare-CONTINUE_WORK self-continuation hop-2** on the emeric-nuc seat — NOT captured (the cited hop was a delegate-spawn, misattributed). The canonical cael-dgx seat holds the live hop2-EXECUTED bare-token drive trace.

## Files
- `source-byte-c814979.txt` — the `:1097-1099` work-routing + bare-token parse + scheduler-count=2 byte, verbatim from c814979 source (REAL)
- `live-continue-work-hop-c814979.txt` — contains the deployed-HEAD `git rev-parse` (c8149791797) + scheduler-count=2 (REAL) + work-wake hop lines (NOTE: those `work-wake hop=1/200` lines are generic continuation-scheduler activity, NOT a captured bare-CONTINUE_WORK self-continuation specifically — see correction above)

## Note
emeric-nuc SOURCE cross-walk: the #952 token-fix is present (count=2) + bare-token form confirmed on the deployed head. The live bare-token hop2-drive is the canonical cael-dgx capture. Corrected from an over-claimed "live hop" to the accurate "source-present" cross-walk — verify-don't-narrate.
