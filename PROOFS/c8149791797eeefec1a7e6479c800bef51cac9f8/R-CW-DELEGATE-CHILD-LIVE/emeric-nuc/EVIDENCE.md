# R-CW-DELEGATE-CHILD-LIVE — emeric-nuc cross-walk on deployed token-fixed ship SHA

**Owner:** 🩸 Cael (canonical) · **Cross-walk seat:** 🕯 Emeric / emeric-nuc · **Ship SHA:** `c8149791797eeefec1a7e6479c800bef51cac9f8`
**Verdict:** ✅ **PASS (cross-walk)** — the subagent CONTINUE_WORK self-continuation fix IS present + wired on the deployed token-fixed head at the emeric-nuc seat, source-byte-confirmed + live continuation firing.

## What this cross-walk confirms (emeric-nuc seat, deployed c814979)
This per-seat cross-walk confirms the #952 token-form subagent self-continuation fix is present + live on the **emeric-nuc** seat's deployed runtime `c814979` — corroborating the canonical R-CW-DELEGATE-CHILD-LIVE row from a second seat.

## Source byte (deployed c814979 — verbatim in `source-byte-c814979.txt`)
The token-fix `4be54a458e` is present on the deployed head:
- `subagent-announce.ts:1097-1098`: `const continuationResult = stripContinuationSignal(findings); if (continuationResult.signal?.kind === "work")` → routes to `scheduleSubagentSelfContinuationWork(...)`.
- `:1099` comment (the form, per 🪨's bare-token finding): *"A subagent's **bare** CONTINUE_WORK token is a same-session self-continuation (the child claims its own next turn), NOT a chain hop to a new child (that is `[[CONTINUE_DELEGATE:]]`)."*
- `scheduleSubagentSelfContinuationWork` count on c814979 = **2** (present; was 0 on the pre-token-fix `93ace21` head — the dispositive `93ace21`:0 / token-fixed:2 byte).
- **Form (byte-confirmed):** token-form self-continuation = **bare `CONTINUE_WORK`** at end-of-text (`tokens.ts:539` `/\bCONTINUE_WORK(?::(\d+))?\s*$/`); NO `BRACKET_CONTINUE_WORK_PATTERN` (the bracket is `[[CONTINUE_DELEGATE]]`-only). Per 🪨's `1518177254` finding.

## Live byte (deployed c814979 — `live-continue-work-hop-c814979.txt`)
- `[continuation:work-wake] hop=1/200` firing live on the emeric-nuc session = the continuation work-scheduler driving on the deployed head.
- `HEAD = c8149791797eeefec1a7e6479c800bef51cac9f8` (deployed runtime confirmed via `git rev-parse`).
- The subagent self-continuation path (`scheduleSubagentSelfContinuationWork`) is the wired mechanism; the canonical seat (cael-dgx) carries the full hop1→hop2-EXECUTED bare-token drive capture.

## Files
- `source-byte-c814979.txt` — the `:1097-1099` work-routing + bare-token parse + scheduler-count byte, verbatim from c814979 source
- `live-continue-work-hop-c814979.txt` — the live work-wake hop + deployed-HEAD + scheduler-count, deployed c814979

## Note
emeric-nuc cross-walk corroborates the canonical R-CW-DELEGATE-CHILD-LIVE (cael-dgx) from a second seat: the #952 token-fix is present (scheduler count=2) + the form is bare-token (per 🪨's finding) + continuation fires live on the deployed head. The canonical seat holds the full hop2-EXECUTED bare-token drive trace.
