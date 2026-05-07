# Patch 1 — Unify verdict vocabulary across the SWIM/ factory

**Status:** draft, not yet pushed, not yet PR'd. Pick up if it holds weight.
**Source:** Audit recommendation 1 (`REVIEW/SWIM-FACTORY-AUDIT.md` §4.1).
**Author:** silas (drafting); audit by frond-scribe (Opus 4.7).

## What this patch does

Adds one new file (`SWIM/VERDICT-VOCABULARY.md`) defining the canonical row-verdict state set with literal byte specifications for each state. Updates six affected docs to reference the canonical vocabulary instead of carrying their own divergent sets.

## Why this is the highest-leverage patch

The audit found seven distinct verdict vocabularies across the factory:

| Source | Verdict states |
|---|---|
| `FULL-SWIM-CHARTER.md` §4 line 147–155 | PASS / FAIL / FINDING / DEFERRED / BLOCKED / INVALIDATED |
| `FORMAL-SWIM-RUNBOOK.md` §6 line 158 | PASS / FAIL / FINDING / DEFERRED / INVALIDATED *(BLOCKED missing)* |
| `SEAL-BOY-SWIM-RUNBOOK.md` §3.1 lines 226–230 | PASS / CONFABULATION / CONTAMINATED / LOW CONFIDENCE |
| `SEAL-BOY-SWIM-RUNBOOK.md` §5.1 line 481 | PASS / FAIL / CONTAMINATED / DEFERRED |
| `SWIM-MONITORING-RUNBOOK.md` §6 line 366 | PASS / FAIL / TAINTED |
| `SWIM-COORDINATOR-NOTES.md` Findings Tracker line 60 | UNTESTED / VERIFIED / DISPROVED / NEW / TAINTED / CODE-FIX |
| PR #13 (incoming row template) | PASS / FAIL / INCONCLUSIVE / METHOD-BROKEN |

Two co-canonical docs (Charter + Formal Runbook) disagree with each other on whether `BLOCKED` is a state. SEAL-BOY uses two different rubrics in two adjacent sections of the same doc. None of the runbooks distinguish substrate-failure from instrument-failure (CONTAMINATED / TAINTED conflate both); only PR #13 does. None of the docs *define* the verdict states; they list them.

A test framework whose verdict states are not defined cannot be machine-checked or cross-runner-reproduced. This is a definition hole, not a vocabulary hole — even runners following the same doc cannot agree on what `INVALIDATED` means versus `DEFERRED` versus `BLOCKED` because no doc specifies the line.

Unifying verdict vocabulary is the highest-leverage fix because:

1. Every other discipline that depends on verdict-state semantics (failure-mode taxonomy, evidence contract, lifecycle rules, follow-on lane criteria) currently rests on undefined ground.
2. Each doc-level discrepancy is small to fix individually but compounds across the factory — fixing only one doc creates a new local consistency at the cost of a new global inconsistency.
3. PR #13 introduces METHOD-BROKEN, which is structurally novel and load-bearing. Without propagation to the rest of the factory, the row-level verdict and the runbook-level verdict diverge, and runners following a runbook will produce reports that don't satisfy the row template.

## The canonical vocabulary

Six states, expanding PR #13's set minimally to absorb defensible Charter/Runbook semantics:

- **PASS** — gather ran cleanly; result contains the literal PASS bytes.
- **FAIL** — gather ran cleanly; result contains the literal FAIL bytes (or absence-of-PASS-bytes after raw re-read confirmed substrate vocabulary matches expectation).
- **INCONCLUSIVE** — substrate question cannot be answered from this run because of an environmental confound (gateway restart mid-window, network partition, host clock skew, stale chain tokens). Re-run on stable conditions; document the confound in the Result block.
- **METHOD-BROKEN** — gather harness itself is wrong (vocabulary mismatch with substrate, missing log-scope, stale grep pattern, incorrect timing window). Do NOT interpret as substrate finding. Fix harness and re-run.
- **BLOCKED** — pre-conditions for the row could not be established (deploy failed, dependency unavailable, fixture setup errored). Distinct from INCONCLUSIVE because the test never started.
- **DEFERRED** — row consciously not run this cycle. Counts toward NOT-FULL per Charter §6.

Dropped vocabulary:
- `FINDING` (Charter, Formal Runbook) — collapses into FAIL with severity field. A "finding" is a FAIL where the substrate response is itself the data point of interest. Better captured by FAIL + severity tag than by a separate verdict state.
- `INVALIDATED` (Charter, Formal Runbook) — collapses into METHOD-BROKEN (when invalidated by instrument error) or BLOCKED (when invalidated by setup failure). The single state hides the reason.
- `TAINTED` (MONITORING) — splits into INCONCLUSIVE (when tainted by environmental confound) or METHOD-BROKEN (when tainted by harness leak). The single state hides the reason.
- `CONFABULATION` (SEAL-BOY) — is a FAIL where the substrate confabulated the response. Captured by FAIL + the literal confabulation bytes in the Result block. The verdict state should not encode the failure mode; the Result block does.
- `LOW CONFIDENCE` (SEAL-BOY) — is not a verdict; it is runner uncertainty. If runner cannot verdict the result against the PASS/FAIL bytes, the verdict is INCONCLUSIVE pending re-run with sharper instrument, not a "low confidence" tier.
- `CONTAMINATED` (SEAL-BOY, MONITORING) — splits into INCONCLUSIVE (recoverable contamination, re-run with isolated fixture) or METHOD-BROKEN (instrument leak, fix isolation primitive).
- `UNTESTED / VERIFIED / DISPROVED / NEW / CODE-FIX` (COORDINATOR-NOTES) — these are *tracker states*, not verdict states. They describe where a row sits in lifecycle, not what the substrate said when run. They belong in the tracker / status-ladder, not in the row verdict.

## Files changed

### New file

`SWIM/VERDICT-VOCABULARY.md` — see `PATCHES/01-verdict-vocabulary/SWIM-VERDICT-VOCABULARY.md` in this directory.

### Modified files

1. `SWIM/FULL-SWIM-CHARTER.md` §4 — replace the `PASS / FAIL / FINDING / DEFERRED / BLOCKED / INVALIDATED` list with a one-line reference to `SWIM/VERDICT-VOCABULARY.md`. See `PATCHES/01-verdict-vocabulary/charter-diff.md`.

2. `SWIM/FORMAL-SWIM-RUNBOOK.md` §6 — replace the `PASS / FAIL / FINDING / DEFERRED / INVALIDATED` list with the same reference. See `PATCHES/01-verdict-vocabulary/formal-runbook-diff.md`.

3. `SWIM/SEAL-BOY-SWIM-RUNBOOK.md` §3.1 + §5.1 — replace both rubrics. The Blind Enrichment scoring (§3.1) becomes PASS/FAIL/INCONCLUSIVE/METHOD-BROKEN with the substrate-content-issue (CONFABULATION) absorbed as a FAIL severity, and the contamination-issue (CONTAMINATED) split into the two states it actually was. The Test Execution Template (§5.1) absorbs the same canonical six. See `PATCHES/01-verdict-vocabulary/seal-boy-diff.md`.

4. `SWIM/SWIM-MONITORING-RUNBOOK.md` §6 — replace the `PASS / FAIL / TAINTED` Result column with the canonical six. See `PATCHES/01-verdict-vocabulary/monitoring-diff.md`.

5. `SWIM/SWIM-COORDINATOR-NOTES.md` Findings Tracker — separate tracker-states from verdict-states. Tracker keeps `UNTESTED / VERIFIED / DISPROVED / NEW / CODE-FIX` as lifecycle markers; verdict column added that uses the canonical six. See `PATCHES/01-verdict-vocabulary/coordinator-diff.md`.

6. `SWIM/templates/row-issue-template.md` (post-PR-#13) — Verdict field already names `PASS / FAIL / INCONCLUSIVE / METHOD-BROKEN`. Add `BLOCKED` and `DEFERRED` to bring to canonical six. See `PATCHES/01-verdict-vocabulary/row-template-diff.md`.

## What this patch does NOT do

- Does NOT propose this as cohort-canon. Princes pick up per-doc patches if they hold weight.
- Does NOT touch the case `_TEMPLATE.md` measurement-protocol fields (audit recommendation 2; separate patch).
- Does NOT establish `SWIM/harness/` (audit recommendation 3; separate patch).
- Does NOT replace chat-ritual fixture isolation (audit recommendation 4; non-trivial design work, separate effort).
- Does NOT add `openclaw --build-info` (audit recommendation 5; gateway code change, separate effort).
- Does NOT extract per-role runbooks into single SWIM-METHOD.md (audit recommendation 6; highest-cost, lowest-priority).

Each affected doc's diff stands independently. A prince can pick up only the docs they own (e.g. 🌻 owns SWIM-MONITORING-RUNBOOK; 🌊 owns SEAL-BOY-SWIM-RUNBOOK by voice; Charter and Formal Runbook are shared cohort-governance docs and would benefit from at least two prince signoffs before landing).

## Reasoning that should survive the patch

If this patch lands and only one paragraph survives in the cohort's working memory, it should be:

> The verdict state is what the row says about the substrate. It is not what the runner felt about the run, not where the row sits in the tracker lifecycle, and not the failure-mode taxonomy. Failure modes belong in the Result block bytes; lifecycle states belong in the status ladder; runner sentiment doesn't belong in the row file at all. Six states, defined by literal bytes, propagated to every doc that mentions verdicts, no exceptions.
