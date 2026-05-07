# Patch — row-issue-template (post-PR-#13) → expand to canonical six verdict states

**File:** `SWIM/templates/row-issue-template.md`
**Section:** Verdict field (added by PR #13 commit b77fdca)
**Pick up:** can land as a follow-on commit on PR #13 itself, or as a separate PR after PR #13 merges
**Depends on:** PR #13 must have landed first (introduces the Verdict field to extend)

## Before (PR #13 v3)

```markdown
### Verdict — PASS / FAIL / INCONCLUSIVE / METHOD-BROKEN

_The judgment about the Result against the PASS/FAIL bytes in fields 2 and 3, kept separate from the Result itself..._

**Four verdict values, each meaning something distinct:**

- **PASS** — the canonical gather (field 3) ran cleanly and the Result contains the literal PASS bytes from field 2.
- **FAIL** — the canonical gather ran cleanly and the Result contains the literal FAIL bytes from field 2 (or the absence of the PASS bytes after the truth-floor reach below was performed).
- **INCONCLUSIVE** — the substrate question cannot be answered from this run because of an environmental confound (gateway restart mid-window, network partition, host clock skew, etc.). Re-run on stable conditions. Document the confound in the Result block.
- **METHOD-BROKEN** — the gather harness itself is wrong (vocabulary mismatch with the substrate, missing log-scope, stale grep pattern, etc.). _Do not interpret the gather output as a substrate finding._ Fix `measure.sh` (or promote inline gather to `measure.sh`) and re-run. This is the verdict that catches the swim-43 row-03 failure mode from inside the row — *if 0 results, fix the method, don't interpret the result as substrate*. Enforced as a row-state instead of a discipline runners have to remember.
```

## After

```markdown
### Verdict — per VERDICT-VOCABULARY.md

The judgment about the Result against the PASS/FAIL bytes in fields 2 and 3, kept separate from the Result itself. See [`SWIM/VERDICT-VOCABULARY.md`](../VERDICT-VOCABULARY.md) for the canonical six states with literal byte specifications. Quick reference:

- **PASS** — gather ran cleanly; Result contains the literal PASS bytes from field 2.
- **FAIL** — gather ran cleanly; Result contains the literal FAIL bytes from field 2 (or absence of PASS bytes after raw re-read confirmed substrate vocabulary matches expectation). If the substrate response is itself the data point of interest, add `Severity:` field; verdict stays FAIL.
- **INCONCLUSIVE** — substrate question cannot be answered from this run because of an environmental confound (gateway restart mid-window, network partition, host clock skew, stale chain tokens). Re-run on stable conditions; document the confound in the Result block.
- **METHOD-BROKEN** — gather harness itself is wrong (vocabulary mismatch with substrate, missing log-scope, stale grep pattern). _Do not interpret as substrate finding._ Fix harness and re-run. The verdict that catches the swim-43 row-03 failure mode at the row-state layer.
- **BLOCKED** — pre-conditions for the row could not be established (deploy failed, dependency unavailable, fixture setup errored). Test never started. Distinct from INCONCLUSIVE because there was no run to inconclude.
- **DEFERRED** — row consciously not run this cycle. Counts toward NOT-FULL per Charter §6.

(PR #13 introduced the first four; BLOCKED and DEFERRED added to align with Charter and Formal Runbook canonical six. See `PATCHES/01-verdict-vocabulary/PATCH-NOTES.md` in `frond-scribe/swim-factory-audit` branch for the unification rationale.)
```

## Cascading text update — Field reference table

Update the Verdict row in the Field reference table (post-PR-#13 v3) to mention all six states.

### Before

```markdown
| **Measurement protocol — Verdict** | **yes when row is run** | PASS / FAIL / INCONCLUSIVE / METHOD-BROKEN against fields 2 and 3; separate from Result so byte and judgment stay honest |
```

### After

```markdown
| **Measurement protocol — Verdict** | **yes when row is run** | one of canonical six per [`SWIM/VERDICT-VOCABULARY.md`](../VERDICT-VOCABULARY.md): PASS / FAIL / INCONCLUSIVE / METHOD-BROKEN / BLOCKED / DEFERRED. Separate from Result so byte and judgment stay honest. |
```

## Reasoning

PR #13 correctly identified that the row-level Verdict field needed METHOD-BROKEN to catch the morning's failure mode. PR #13's four-state set (PASS / FAIL / INCONCLUSIVE / METHOD-BROKEN) is correct *as far as it goes* but doesn't include BLOCKED (test couldn't start) or DEFERRED (test consciously skipped). Charter §6 closure rules require both for the FULL/NOT-FULL determination.

If row template stays at four states and Charter requires six, runners using the row template can't produce the verdicts Charter needs to compute swim closure. Adding BLOCKED and DEFERRED to the row template closes the gap.

The reference-out to VERDICT-VOCABULARY.md keeps future refinements (additional clarification of any state's bytes, or — in the unlikely future — a 7th state) from requiring re-edit of the row template.

## Risks

- Ordering risk: this patch depends on PR #13 having landed. If PR #13 doesn't land (rejected, abandoned, superseded), this patch is moot. Mitigation: don't apply this patch until PR #13 commits are in main. The PATCH-NOTES.md in this directory notes the dependency.
- Two more verdict states to remember. Low risk — BLOCKED and DEFERRED are well-defined in standard test discipline (skip / setup-error) and the canonical-vocabulary doc gives them specific byte semantics.
