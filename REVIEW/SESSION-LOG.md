# Frond-scribe SWIM/ factory audit — session log

Reviewer: frond-scribe (Opus 4.7)
Date: 2026-05-07
Branch target: `frond-scribe/swim-factory-audit`
Working directory: `/tmp/silas-frond-scribe-swim-review/`

This log captures what I read, in what order, and what stood out as I went. It is not the audit itself — that lives in `REVIEW/SWIM-FACTORY-AUDIT.md`. This is the working trace so silas can examine progress.

## 14:11Z — kickoff
Read `REVIEW/REVIEW-BRIEF.md`. Mandate is clear: audit the SWIM/ factory against standard software integration test discipline, not against cohort-internal vocabulary. Trigger was swim-43 row-03 — four runners produced four different bytes from four hand-rolled greps because the row template did not specify measurement protocol. The brief asks whether that gap is a one-off or structural.

Plan:
- Read in size-priority order: `SWIM-MONITORING-RUNBOOK.md` (791 lines), `SEAL-BOY-SWIM-RUNBOOK.md` (664 lines), then templates, then everything else by size.
- Sample 5–6 representative case files (not all 56).
- Read PR #13 diff before writing the PR-13 assessment section.
- Write findings to `REVIEW/SWIM-FACTORY-AUDIT.md`. Commit periodically.

## 14:13Z — SWIM-MONITORING-RUNBOOK.md (791 lines) — read

Major observations:
- Document is structured as a single role's how-to-chat journal ("Elliott 🌻 — Test subject monitoring"). Section 11.5 is literally "What I Learned About Attention." This is a personal field journal, not a runbook.
- No machine-readable test definitions anywhere. All measurement is grep-against-log-strings done by humans.
- §6 "Report Format" is a free-form narrative template (Timeline, Anomalies, Contamination). No assertion shape, no expected vs actual delta.
- Three outcome states only: PASS / FAIL / TAINTED. No INCONCLUSIVE, no METHOD-BROKEN. TAINTED conflates contamination with method failure.
- The "drift cues" pattern (§0.5, §4.1) is essentially feature-thumbprint version verification done via log-string grep. Decent intent, fragile implementation.
- §11 "Keeping Focus During Long Tests" is a meditation on attention — the runbook is solving for runner cognitive load because the test framework offers no automation.
- §3.3 "Contamination Log" is trust-based — runner is asked to "track anything that might have leaked." No enforcement.
- Vocabulary: "Admin / Monitor / Subject / Operator" — sociological roles, not standard test framework roles.

## 14:13Z — SEAL-BOY-SWIM-RUNBOOK.md (664 lines) — read

Major observations:
- Glossary (§0) defines cohort terms only. None map to standard test-framework vocabulary (driver, oracle, fixture, harness, isolation, test double).
- §3.1 "Blind Enrichment" scoring rubric: PASS / CONFABULATION / CONTAMINATED / LOW CONFIDENCE. Yet another 4-outcome rubric — different from PR #13's PASS / FAIL / INCONCLUSIVE / METHOD-BROKEN. CONFABULATION conflates "wrong substrate output" with "successful measurement of wrong output."
- §5.1 "Test Execution Template" is a markdown checklist; the "exact question" probe is improvised per-test — no fixture file, no committed bytes.
- §6 "Common Failure Modes" lists 9 modes — many ("Chain hop counter stuck", "Config change not taking effect") are infrastructure issues disguised as substrate findings.
- §10 "Lessons" — narrative wisdom not encoded as enforced rules.
- Result column in test execution template: PASS / FAIL / CONTAMINATED / DEFERRED. THIRD distinct outcome vocabulary in the same factory.
- §1.3 Channel Silence Protocol relies on chat ritual ("Post ⚓💗, wait, count to tolerance+2 silence"), not on harness isolation.

Cross-doc finding so far: three separate outcome vocabularies in the runbooks, and PR #13 introduces a fourth. The factory has no shared verdict taxonomy.

## 14:14Z — Templates — read

- `row-issue-template.md` (pre-PR-13): has Surface / Coverage expectation / Status ladder. NO measurement protocol fields. Status ladder is process scaffolding (Triaged, Comprehension-gated, Evidence-cleansed) — six lifecycle states for a test definition that has no input / expected / assertion shape.
- `code-agent-workorder-template.md`: code-agent dispatch protocol. Per-PR gates well-defined (tsgo, lint, vitest, build). Cross-repo CI dispatch (§6.5) well-specified. Strongest doc in the factory by methodology standards — but for code-agent dispatch, not SWIM testing per se.
- PR #13: adds 5 fields (PASS bytes / gather script path / FAIL bytes / Result block / Verdict) + Truth-floor reach + When-protocol-missing + history postscript. Verdict states PASS/FAIL/INCONCLUSIVE/METHOD-BROKEN. Right shape for the row template; verdict vocabulary diverges from the runbooks. Does not propagate to SEAL-BOY, MONITORING, case files, or workorder template.

## 14:14Z — FULL-SWIM-CHARTER.md (262 lines) — read

Strongest doc on closure semantics. §1 / §6 closure rules are tight. §2 anti-back-formation rule is right. But §4 row contract names fields without defining them runnably, and §4 lists six verdict states (PASS / FAIL / FINDING / DEFERRED / BLOCKED / INVALIDATED) without defining the difference between any pair. The Charter's verdict list is also inconsistent with FORMAL-SWIM-RUNBOOK §6 (which is missing BLOCKED).

## 14:14Z — PR-UPDATE-VALIDATION-WALKTHROUGH.md (260 lines) — read

Most externality-conscious doc in the factory. §6 explicitly states the fresh-prince acceptance criterion. But §1.3 still re-states the row contract without resolving the gather-method gap PR #13 fixes. §3 anti-folklore checklist is presence-checks not content-checks.

## 14:14Z — FORMAL-SWIM-RUNBOOK.md (222 lines) — read

§3 pre-swim gate is concrete and testable. §9 ship-ready criteria honestly distinguish swim-PASS from ship-cert. But §6 verdict list (PASS/FAIL/FINDING/DEFERRED/INVALIDATED) is missing BLOCKED that the Charter has — the two co-canonical docs disagree on the verdict set. §3 line 67 explicitly accepts SUT-SHA drift from ship-candidate during swim execution; this is operationally pragmatic but not test discipline.

## 14:14Z — SWIM-COORDINATOR-NOTES.md / SWIM-SUBJECT-NOTES.md / SWIM-METHODOLOGY.md — read

- COORDINATOR-NOTES introduces a SIXTH verdict vocabulary (UNTESTED / VERIFIED / DISPROVED / NEW / TAINTED / CODE-FIX). "The Storm Pattern" is the cohort solving for chat congestion that arises because tests don't produce clean verdicts.
- SUBJECT-NOTES correctly identifies the canary blindness problem but encodes the fix (negative probes, positive probes) as advice, not as fixture-shape rules.
- METHODOLOGY §"Lessons from Swim 11" is folklore where harness primitives belong.

## 14:14Z — Smaller docs (CASE-REGISTRY-RULES, FULL-SWIM-CROSSWALK, ARCHAEOLOGY-INVENTORY-8-40, RUNBOOK-deploy-to-self, README) — read

- CASE-REGISTRY-RULES is the second-strongest doc by methodology standards. No-silent-drop, retire grammar, version bumps. Solid catalog discipline. But governs catalog *membership*, not catalog entry *content* — empty case files with right headers satisfy the rules.
- RUNBOOK-deploy-to-self.md is short and focused (89 lines), delegating build/verify/swap to a workflow file rather than re-encoding as runner-improv. This is the model the rest of the factory should adopt.
- README's "Start here" path leads to catalog and runbooks but never to a doc that defines what a SWIM test IS as a (input, expected, gather, assertion, verdict) tuple. That doc does not exist.

## 14:15Z — Case files — sampled 6 (A1, B5, X7, D4, X12, N001)

All 23-24 line abstract feature-claim entries. "Required minimum row shape" is a 1-sentence prose ("verify rejection with declared error/state", "verify silent return AND verify subsequent turn fires"). No expected bytes, no gather method, no fixture, no harness path. The case is a feature catalog entry, not a test definition. _TEMPLATE.md (the case template) does not have the measurement-protocol fields PR #13 added to row-issue-template — so PR #13 patches the per-run receipt but not the canonical claim definition above it. First runner on each new case re-derives the gather method.

## 14:30Z — Audit drafted

Wrote REVIEW/SWIM-FACTORY-AUDIT.md.

Verdict: factory is partially methodologically sound. Catalog/closure/dispatch layers are real engineering. Test-execution layer is structurally errored: no test-definition primitive (fixture/harness/assertion), no committed expected bytes, five-to-seven verdict vocabularies, fixture isolation done by chat ritual, build verification by log-string thumbprint, lessons-as-folklore where harness primitives belong, role-runbooks at 2000 lines for one feature.

PR #13: right shape, should land, should propagate. The METHOD-BROKEN verdict and the harness-script-in-row-dir doctrine are the structural fixes for the swim-43 row-03 incident-class. Seven follow-on gaps named in the audit Recommendations.

The swim-43 row-03 incident is not anomalous. It is the predicted failure mode of every part of the factory below the catalog layer.
