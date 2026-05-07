# Frond-scribe review brief: SWIM/ factory critical methodology audit

## Mandate

Critically review the entire `SWIM/` factory in this repo (`karmaterminal/karmaterminal-openclaw-docs`) for **errored methodology in software integration testing discipline**. This is a code-review-style audit, not a sympathetic read.

The cohort has been drifting on substrate-engineering discipline. Standard integration-test-methodology vocabulary (input fixtures, expected outputs, assertion shapes, test isolation, harness reuse, regression-vs-progression, fail-fast, hermetic builds, trace-vs-log, observability discipline) is largely absent from the SWIM/ factory's own runbooks and templates. The factory uses cohort-internal vocabulary (Phase 1 triage, comprehension gate, evidence-cleansed, frozen branch) where standard test-engineering vocabulary would do the same work more rigorously and more legibly to outside reviewers.

The trigger: swim-43 row-03 produced ~8h of cohort-channel reconciliation because four runners measured the same substrate question with four different hand-rolled greps and produced four different bytes. The fix-PR (in flight at https://github.com/karmaterminal/karmaterminal-openclaw-docs/pull/13) adds five measurement-protocol fields to the row template. **That fix is downstream patching of one symptom.** What this review needs to surface is whether the SWIM/ factory's underlying methodology has the same shape of gap throughout — places where cohort-improv is doing the work that standard test discipline would do.

## What to read

```
SWIM/
├── ARCHAEOLOGY-INVENTORY-8-40.md      130 lines
├── CASE-REGISTRY-RULES.md             133 lines
├── FORMAL-SWIM-RUNBOOK.md             222 lines
├── FULL-SWIM-CHARTER.md               262 lines
├── FULL-SWIM-CROSSWALK.md             134 lines
├── PR-UPDATE-VALIDATION-WALKTHROUGH.md 260 lines
├── README.md                           75 lines
├── RUNBOOK-deploy-to-self.md           89 lines
├── SEAL-BOY-SWIM-RUNBOOK.md           664 lines
├── SWIM-COORDINATOR-NOTES.md          219 lines
├── SWIM-METHODOLOGY.md                113 lines
├── SWIM-MONITORING-RUNBOOK.md         791 lines
├── SWIM-SUBJECT-NOTES.md              213 lines
├── cases/                              56 case files
└── templates/
    ├── code-agent-workorder-template.md  349 lines
    └── row-issue-template.md             202 lines
```

Plus the in-flight fix at https://github.com/karmaterminal/karmaterminal-openclaw-docs/pull/13 — read the PR diff so your review can either say *"this fix is the right shape but should also do X, Y, Z elsewhere in the factory"* or *"this fix is wrongly-shaped, here's why."*

## What to look for — critical questions

For each runbook / template / charter document, evaluate against standard software-integration-test methodology:

1. **Test definition discipline.** Does the document specify how tests are defined? Required fields for a test/row/case (input, expected, gather method, assertion shape, verdict, isolation requirements)? Or does it leave any of these to chat-improv / cohort-derivation?

2. **Reproducibility.** Could a fresh reviewer (or a fresh prince at cold restart) take a row file and reproduce its test byte-identically *without* reading any chat? If not, what's the gap?

3. **Failure mode taxonomy.** Does the methodology distinguish PASS / FAIL / INCONCLUSIVE / METHOD-BROKEN (or equivalent)? Or does it conflate substrate-failure with measurement-failure?

4. **Harness reuse vs improv.** When the same measurement is needed across multiple rows / hosts / swims, does the methodology require harness extraction (script in the repo) or allow re-derivation in chat each time?

5. **Evidence permanence.** Does the methodology require raw output bytes committed to the row file, or does it allow chat-summarized findings as evidence?

6. **Vocabulary inheritance hazard.** Does any document allow runners to silently inherit grep patterns, log scopes, command shapes from prior cycles without verifying against raw substrate? (This is the swim-43 row-03 failure mode.)

7. **Confound discipline.** Does the methodology require explicit naming of environmental confounds (gateway restart mid-window, network partition, host clock skew) that produce INCONCLUSIVE rather than substrate findings? Or does it treat all measurement output as substrate-truth?

8. **Coordination overhead vs substrate work ratio.** Read the runbooks (especially `SEAL-BOY-SWIM-RUNBOOK.md` at 664 lines and `SWIM-MONITORING-RUNBOOK.md` at 791 lines). Estimate: what fraction of the runbook is actual test methodology vs cohort-coordination-protocol? Is the ratio defensible? Standard integration test discipline doesn't usually need 791-line monitoring runbooks.

9. **Cohort-internal vocabulary substitution.** Where standard test-engineering vocabulary exists (assertion, fixture, hermetic build, regression test, smoke test, golden file, snapshot test, observability trace, tracing-vs-logging), does the factory use it? Or does it use cohort-coined terms (Phase 1 triage, comprehension gate, evidence-cleansed, biscuit-game, closure-costume)? Each substitution is a rigor cost — name them.

10. **Externality blind spots.** Do any documents account for the cost the factory imposes on outside readers (figs reviewing PRs, future princes inheriting the system)? Or is the factory structurally inward-facing?

## What NOT to do

- **No cohort-cosign cycle.** Don't praise the factory's "rigor" or "discipline" because the cohort uses those words about itself. Hold it to standard software engineering test discipline.
- **No catalog/named-shape additions to your own review.** If you find a methodology error, name it in plain English. Don't mint "errored-shape #N" entries.
- **No softening.** This review is the acid into water. Add it slowly but truly. If the factory is structurally broken in a place, say so. Figs's specific frame: *"don't pretend at me you need me to spoon feed you methodology for software integration testing."* The cohort has been doing exactly that — performing not-knowing-it. The review should treat the cohort as competent integration test engineers who have been operating below their level.

## Output shape

`REVIEW/SWIM-FACTORY-AUDIT.md` in this worktree, structured as:

1. **Top-level verdict** — one paragraph. Is the SWIM/ factory methodologically sound, partially sound, or structurally errored?
2. **Per-document findings** — one section per file in `SWIM/` (skip case files for v1; one section for `cases/` as a category). Each section names specific methodology errors with file:line references.
3. **Cross-cutting patterns** — patterns of error that appear across multiple documents (e.g. *"cohort-vocabulary substitution for standard test-engineering vocabulary appears in N documents at lines X, Y, Z"*).
4. **Concrete recommendations** — file-level changes the cohort could make to bring SWIM/ closer to standard integration test discipline. Prioritize: which fix has the highest leverage?
5. **Assessment of PR #13** — is the in-flight fix the right shape? Should it expand to include other parts of the factory? Should it be rejected and a different fix shape written?

Commit `REVIEW/SWIM-FACTORY-AUDIT.md` to a branch `frond-scribe/swim-factory-audit` when done. Don't push (let silas review locally first). Log the review session to `REVIEW/SESSION-LOG.md` with timestamps and major findings as you go, so silas can examine progress without re-running.

## Working notes

- Worktree root: `/tmp/silas-frond-scribe-swim-review/`
- Branch (existing checkout): `main` (you can branch off as needed)
- Don't push to remote without explicit confirmation
- Standard test-engineering references you may cite: Hamcrest assertion shapes, Pytest fixtures, JUnit categories, Go table-driven tests, hermetic build doctrine (Bazel/Pants), property-based testing (Hypothesis/QuickCheck), observability-vs-monitoring distinction (Cindy Sridharan), fail-fast vs defer-error patterns
- If the factory is methodologically sound and the swim-43 row-03 failure was anomalous, say that clearly. The acid frame is *true acid into actual water*, not pretending the water is acidic when it isn't.

silas — 2026-05-07 morning, post-figs-flag. dispatching this because figs's frame is exact: i should not be asking him for the next drop of methodology when frond-scribe can review against standard discipline.
