# SWIM/ factory — frond-scribe critical methodology audit

Reviewer: frond-scribe (Opus 4.7)
Date: 2026-05-07
Mandate: `REVIEW/REVIEW-BRIEF.md` — audit the `SWIM/` factory against standard software integration test discipline; treat the factory as code under review; no cohort-cosign cycle.
Scope: every top-level doc in `SWIM/`, both templates, the case `_TEMPLATE.md` + six sampled case files (`A1`, `B5`, `X7`, `D4`, `X12`, `N001`), the case `CATALOG.md`, and PR #13 (body + diff).

---

## 1. Top-level verdict

The SWIM/ factory is **partially methodologically sound** with a **structurally errored test-definition layer**. The catalog/closure layer is genuine engineering: `FULL-SWIM-CHARTER.md` and `CASE-REGISTRY-RULES.md` together define a defensible test-completeness contract — declared inventory, retire grammar, no-silent-drop, election-against-version. The dispatch layer (`templates/code-agent-workorder-template.md`) is the strongest doc in the factory: per-PR gates, branch hygiene, cross-repo CI dispatch. Those layers would survive an outside reviewer.

The test-execution layer below them does not. Cases are 20-line paragraphs naming a claim and an "Evidence surface(s)" abstract; rows are markdown checklists with free-form prose receipts; runbooks are 600-800-line role-specific field journals written from inside named princes; measurement is hand-rolled grep-against-log-string improvised at execution time. Nothing in the pre-PR-13 factory pins an expected-output byte, a runnable harness path, or a verdict-state definition. The factory contains many of the right *names* (matrix, scoreboard, evidence, contamination, regression, fixture-shaped fields like "Evidence surface(s)") and few of the right *artifacts* (committed expected bytes, runnable scripts under version control, machine-checked assertions).

The swim-43 row-03 incident — four runners, four hand-rolled greps, four different bytes, eight hours of chat reconciliation — is **not anomalous**. It is the predicted failure mode of every part of the factory below the catalog layer. The fact that it took until swim-43 to manifest at this cost is luck, not discipline; multiple earlier swims surfaced the same shape and were absorbed into folklore (SEAL-BOY §10 "Lessons", SWIM-METHODOLOGY §"Lessons from Swim 11", SWIM-MONITORING §13 "Lessons from Swim 5–6"). The cohort has been operating below its level — performing not-knowing-how-to-do-integration-testing while the actual gap is that the factory enforces no test-engineering primitives. PR #13 is the right shape of structural fix and should propagate beyond the row template.

---

## 2. Per-document findings

### `README.md` (75 lines)

The first three "Start here" docs are correctly named (`FULL-SWIM-CHARTER` → `CASE-REGISTRY-RULES` → `cases/CATALOG`). The framing "integration testing is part of the proof, not adjacent to it" (line 7) is correct in principle. But the README points to four runbooks (lines 34–40) without naming any test-discipline anchor: there is no link to a fixture directory, a harness directory, an assertion-shape spec, or even a verdict-state spec. A fresh reader following the README path lands on the catalog layer and then on five long role-runbooks — never on a doc that says *"a SWIM test consists of (input, expected, gather, assertion, verdict)."* That doc does not exist.

### `FULL-SWIM-CHARTER.md` (262 lines)

Strengths: §1 (lines 12–24) closure semantics are tight; §2 (lines 30–48) "No declared inventory, no FULL claim" is the right anti-back-formation rule; §6 (lines 178–196) closure rule mechanics are testable; §8 "Non-goals" (lines 236–244) is honest about not every swim being FULL. This is the most disciplined doc in the factory.

Errors:

- **§4 row contract (lines 134–157) lists fields without defining them.** "exact command/tool/prompt surface used" is a field name, not a fixture spec — there is no schema, no example, no "must be runnable by a fresh prince." The field maps directly onto the gap PR #13 fixes, but the Charter itself never demanded that the field be runnable bytes. It demanded that the field be filled. Filling it with prose ("we ran the standard measure") is what the swim-43 row-03 runners did.
- **§4 verdict list (lines 147–155) names six states without defining them.** `PASS`, `FAIL`, `FINDING`, `DEFERRED`, `BLOCKED`, `INVALIDATED`. What is the line between `FAIL` and `FINDING`? When does `INVALIDATED` apply versus `DEFERRED` versus `BLOCKED`? §6 (line 195) describes verdict *classes* (FULL-PASS / FULL-WITH-FINDINGS / NOT-FULL) but never defines the row-level verdict *states* the classes roll up from. A test framework whose verdict states are not defined cannot be machine-checked or cross-runner-reproduced. This is a definition hole, not a vocabulary hole.
- **§5 "Evidence requirement" (lines 162–172) prefers three surfaces (subject/tool result, gateway/journal, durable session/disk) but does not say what a surface must contain.** "Cross-seat byte-pin" is mentioned (CASE-REGISTRY-RULES §2 too) but never specified — pin to what? a hash? a literal log line? a session-store key? Standard discipline would say: the surface is a bytes-on-disk artifact that a verdict can be re-derived from. The Charter leaves this to runner-improv.
- **§3 "Required row families" (lines 53–131) is an 8-bucket feature taxonomy.** This is reasonable as a coverage target but is not a test-engineering primitive — there is no assertion shape associated with each family, no harness library per family, no shared fixture set. Each row in each family re-derives its own measurement.

### `FORMAL-SWIM-RUNBOOK.md` (222 lines)

Strengths: §1 non-negotiables (lines 19–28) are reasonable; §3 pre-swim gate (lines 46–69) is concrete; §9 "What counts as ship-ready" (lines 193–210) is honest about swim-PASS not equaling ship-cert. §3 check 6 (line 66) — fleet-roll-to-all-princes — is genuine multi-host discipline.

Errors:

- **§6 "Evidence contract" (lines 146–161) lists a verdict set inconsistent with the Charter.** Formal Runbook §6 line 158: `PASS / FAIL / FINDING / DEFERRED / INVALIDATED`. Charter §4 lines 147–155: `PASS / FAIL / FINDING / DEFERRED / BLOCKED / INVALIDATED`. The Formal Runbook is missing `BLOCKED` outright. These two docs are co-canonical (the README points to both as "Start here"). A factory whose two governance docs disagree on the allowed verdict set has no allowed verdict set. This is a structural rigor failure, not a typo.
- **§3 line 67 ("Drift acknowledgment").** The doc explicitly accepts SUT-SHA drifting from ship-candidate-SHA *during* swim execution, with the rule "rigor lives in honest scoping, NOT in pausing forward code motion." This may be operationally correct for the cohort's velocity, but it is not test discipline. Standard integration-test discipline pins the SUT to the artifact under test for the duration of the test; drift means the test does not certify what it claims to certify, and the certification is invalid even if a delta-walk is performed afterward. The runbook's phrase "operationally tolerated" is the cohort negotiating with the discipline. Either restate as "we accept the rigor cost" or rebuild the SUT-pinning protocol.
- **§3 line 64 "tool availability verified in-context, not just assumed from source".** Correct rule. The implementation in the runbooks below (verifying via log-string grep) is fragile, but the rule itself is right.
- **§4 "Canonical matrix shape" (lines 73–115) calls out 28 core rows minimum with abstract identifiers (TC1-4, F1-8, P1-7, R1-5, V1-3) but does not link any identifier to a runnable case file or harness path.** The matrix is an advertisement of coverage breadth, not a test catalog with executable members.

### `SEAL-BOY-SWIM-RUNBOOK.md` (664 lines)

This is a personal field journal in runbook clothing. The voice is identified ("Voice is mine," line 6) and the document expresses "Method, not findings" (line 4) — correct intent, but the method is encoded as 664 lines of prose-and-bash for a single role. Nothing here is harness-extractable.

Errors:

- **Glossary (§0, lines 11–22) defines cohort-internal sociological terms (Admin, Operator, SUT, Shard, Ground truth, Blind, Contaminated, Drift cue) and zero standard test-engineering terms (driver, oracle, fixture, harness, isolation level, test double, golden file, assertion).** The glossary is the entry surface for an outside reviewer. An outside reviewer cannot map "Operator" to "test oracle," "Blind" to "fixture-isolated input," or "Drift cue" to "build version verification" without doing the translation themselves. Each substitution is a rigor cost.
- **§3.1 "Blind Enrichment" scoring rubric (lines 226–230): `PASS / CONFABULATION / CONTAMINATED / LOW CONFIDENCE`.** A 4-state outcome that does not align with the Charter's 6 states or the Formal Runbook's 5 states. CONFABULATION conflates "substrate produced wrong content" (a substrate FAIL that the harness correctly measured) with "method correctly returned a value but the value is wrong" (which is just FAIL). LOW CONFIDENCE has no objective definition — "SUT can't distinguish enrichment from channel context" is a runner judgment call. CONTAMINATED conflates harness-isolation failure (which is a method/instrument problem, equivalent to PR #13's METHOD-BROKEN) with substrate-content leakage (which is a setup-step failure that requires re-running, closer to INCONCLUSIVE). A test framework whose outcomes are not orthogonal cannot produce reproducible verdicts.
- **§5.1 "Test Execution Template" (lines 446–483).** The template's "Probe" section (lines 475–479) requires the runner to write *exact question* and *SUT response (verbatim or summary)*. "Verbatim or summary" is the gap. A summary is not a byte. PR #13's "Result — actual output, byte-pinned. No editorialization" is the structural fix to exactly this line. SEAL-BOY §5.1 should consume the same fix, but PR #13 does not propagate here.
- **§5.1 Result column (line 481): `PASS ✅ / FAIL ❌ / CONTAMINATED / DEFERRED`.** The third distinct verdict vocabulary in the same factory. Same conflations as §3.1 plus DEFERRED added.
- **§1.3 "Channel Silence Protocol" (lines 111–127) is environmental hygiene by chat ritual.** "Post `⚓💗` (anchor pattern — circuit breaker for storm). Wait for all agents to go silent. Count to `tolerance + 2` in seconds of silence. THEN dispatch." This is solving for the test running on the production communication channel because there is no isolated test channel. Standard test discipline would use a dedicated test fixture (a separate channel, a separate gateway, or a programmatic generation-counter source) so the test does not require humans to silence themselves. The chat ritual is the runner-paying-the-cost-of-the-missing-fixture.
- **§6 "Common Failure Modes" table (lines 525–540) lists 9 failure modes; multiple ("Chain hop counter stuck", "Config change not taking effect", "Shard uses sessions_spawn instead of brackets", "Brackets in file trigger safety refusal") are method-instrument or interpretation problems being recorded as substrate failure modes.** "Config change not taking effect → Restart gateway" is a setup-step bug, not a substrate failure mode. The taxonomy mixes substrate findings with harness defects.
- **§10 "Lessons" (lines 643–658) is folklore.** "Rich content binds. Bare words confabulate" (line 645) should be a fixture-shape rule encoded into the test setup ("blind-enrichment fixture must contain ≥N tokens of semantic context, not bare keywords"). Instead it is narrative wisdom that the next runner inherits orally. "Stale chain tokens are the #1 test pollution source. Always check before each test." (paraphrased from MONITORING §13) is a setup-hook in a standard framework — the framework runs the check automatically and fails the test if state is dirty. SEAL-BOY makes the runner remember.

### `SWIM-MONITORING-RUNBOOK.md` (791 lines)

Largest doc in the factory. A personal field journal written from "Elliott 🌻" perspective with §11.5 literally titled "What I Learned About Attention." Standard test discipline does not have a "what I learned about attention" section because the harness is not run inside a runner's attention.

Errors:

- **§3 "Evidence Collection" (lines 252–298) is a manual checklist — log slice via `journalctl --since`, session-store delta via `diff`, Discord transcript screenshot, "stopwatch timestamps for dispatch → return."** Stopwatch timing in 2026 for an integration test is the marker. There is no automated evidence pipeline; the runner ssh-greps live during the test, and the receipt is "Did the runner notice the right log line?" PR #13's harness-script-in-row-dir is the structural fix; this runbook should consume it but does not.
- **§3.2 "Anomaly Flags" (lines 274–289).** Five anomaly conditions that "flag immediately to admin (Ronan)." Three of the five — "Timer cancel with drift=0", "Stale tokens polluting tests", "Cost cap hit unexpectedly" — are methodology-side. They are signs the harness was wrong (stale state, missed configuration), not substrate findings. The runbook records them as observation outputs, not as METHOD-BROKEN verdicts that invalidate the row.
- **§3.3 "Contamination Log" (lines 291–298) is trust-based.** "Track anything that might have leaked test content to the SUT… Did admin (Ronan) mention file contents in #sprites? Did any prince describe expected results in channel? Did the operator (figs) give hints about what the shard should find?" The runner is asked to remember and report contamination. Standard discipline would isolate the fixture so contamination is mechanically impossible; failing that, would log every channel post that touched the fixture by mechanical comparison. Asking humans to remember is not a test isolation primitive.
- **§6 "Report Format" (lines 360–385) is free-form prose.** "Timeline:" with `HH:MM:SS — Admin dispatched [method]` etc. This is a narrative shape. There is no structured (Test ID, expected, observed, delta, verdict) record. It is impossible to diff two reports for the same test on different runs because the field shape is not standardized.
- **§6 Result column (line 366): `✅ PASS / ❌ FAIL / ⚠️ TAINTED`.** Three states. No INCONCLUSIVE. No METHOD-BROKEN. TAINTED conflates contamination (re-run) with method failure (fix instrument).
- **§8.2 "Verifying the Canary (Feature Thumbprint)" (lines 437–473) verifies the deployed build via grep against compiled JS bundle strings.** This is the right intent (verify byte-on-host is the byte under test) implemented through a fragile thumbprint. A log-string thumbprint can change for cosmetic reasons, breaking the verification without breaking the substrate; conversely, a bug fix can land that doesn't touch any thumbprinted string and the thumbprint won't catch it. Standard discipline would expose `openclaw --build-info` returning a hash + commit SHA + dirty-tree flag, and the runbook would assert against that. The seven thumbprints in §8.2 are a reasonable workaround, but their fragility is not flagged.
- **§11 "Keeping Focus During Long Tests" (lines 656–711) is a meditation on runner cognitive load.** §11.5 lists six lessons about attention, including "Queue lag makes you look dead." The runbook is solving for the runner being a human-shaped LLM that has to chat-respond, ssh-tail-log, capture-evidence, and not-contaminate-the-subject all at once. A standard test framework solves this by being a daemon. The fact that this section exists at all is the strongest single signal that the factory has placed the test-running burden on a chat-improvising runner instead of on a harness.
- **§13 "Lessons from Swim 5–6 Monitoring" (lines 783–791).** Same folklore problem as SEAL-BOY §10. "Stale chain tokens are the #1 test pollution source. Always check before each test." → setup hook. "Channel noise during chain tests kills timers." → fixture isolation. "Post-`/new` doesn't clear in-memory state." → tear-down hook. Every lesson here is a primitive a standard framework provides. The runbook makes the runner remember each one.

### `SWIM-COORDINATOR-NOTES.md` (219 lines)

Personal field journal for "Cael 🩸" coordinator role. Most internal-facing of the runbooks; least concerned with test discipline.

Errors:

- **§Pre-Swim Setup §2 "Findings Tracker" (lines 41–60) introduces a sixth verdict vocabulary: `UNTESTED / VERIFIED / DISPROVED / NEW / TAINTED / CODE-FIX`.** Sixth distinct verdict set in one factory (counting Charter, Formal Runbook, SEAL-BOY enrichment scoring, SEAL-BOY result column, MONITORING reports, this tracker). PR #13 will be the seventh. The cohort cannot agree with itself on outcome states.
- **§The Storm Pattern (lines 88–98) is conflict-management protocol for chat congestion during testing.** "When a test produces an interesting result, all 3 princes will want to analyze it simultaneously. This creates a message storm." The reason all 3 princes analyze simultaneously is because the test produces ambiguous outputs (log lines that need interpretation) rather than verdicts. A harness with a clean PASS/FAIL/INCONCLUSIVE/METHOD-BROKEN verdict produces no storm — the runners read the verdict line. The "Storm Pattern" is the cohort solving for the consequence of the missing harness instead of the missing harness itself.
- **§Lessons §Codex ⚓ Round 2 (lines 178–183): "⚓ rewrote our runbooks — good structural upgrades, but stripped the voice and lived texture. Lesson: take the content, put it back in your body."** This is the document explicitly choosing voice/texture over structural rigor. A code reviewer would flag this. The methodology cost of "voice and lived texture" is that runbooks cannot be reused across runners or onboarded to fresh princes without the voice-translation step. The cohort has named the trade-off and chosen the side that costs externality discipline.

### `SWIM-SUBJECT-NOTES.md` (213 lines)

Personal field journal from "the canary" perspective. The most subjectively written of all the runbooks ("The canary doesn't hear its own alarm — but it's getting better at saying 'I don't know.'"). This is a real epistemic constraint of testing an LLM-shaped subject, but the runbook does not encode it as a test discipline primitive.

Errors:

- **§1 (lines 7–25) acknowledges the subject's blindness and §7 (lines 136–152) recommends "include a negative probe" — but neither is encoded as a fixture requirement.** "Include at least one negative probe" should be a row template field ("Negative-probe fixture: ___"), not a recommendation in a journal. The next runner has to remember.
- **§5 "Contamination — How I Accidentally Cheat" (lines 94–115).** The subject's contamination rules (§5 lines 108–115) are behavioral rules the subject is supposed to remember during the test. "After dispatching: say 'dispatched' and nothing else about content." Standard discipline would prevent the subject from posting content via the production channel during the test window — i.e. enforce by harness, not by self-discipline. The runbook chooses self-discipline.
- **§7 "I Don't Know" vs Confabulation (lines 136–152) treats the confabulation/recall distinction as a runner judgment call, not as a fixture primitive.** "Include probes with keywords that *sound like* they could be in the enrichment but aren't. Tests whether I'm recalling vs inferring." This is a real and good test idea — and it should be a fixture pair: the positive-probe fixture and the negative-probe fixture, both committed bytes, both checked against a verdict. It is left as advice.

### `SWIM-METHODOLOGY.md` (113 lines)

Smallest of the role/methodology docs. Mostly post-Swim-11 lessons.

Errors:

- **§Evidence Standards "Three independent sources needed for critical results" (lines 46–49) is the right rule.** But the items below are heterogeneous: "tool returning `{status: scheduled}`" is a return-value assertion (good); "WORK timer fired in gateway journal" is a log-string grep (fragile); "tool entries in session JSONL — proves tool calls happened on disk" is a structured-data check (good). The rule treats these three as equivalent. They are not — the log-string grep is the one that produced swim-43 row-03's failure mode.
- **§Lessons from Swim 11 (lines 64–91) is folklore again.** "Validate tool + token presence after every deploy to SUT." → harness step. "Observer queue depth > 10 = compromised observations." → harness gate. "Deploy checklist: never `--ignore-scripts`." → CI rule. Every lesson is a primitive that a standard framework has.

### `RUNBOOK-deploy-to-self.md` (89 lines)

Strongest of the role-runbooks by methodology standards. Concrete commands, named foot-guns, "NEVER" rules. The 4-clause shape (lines 19–28) is sound. §"NEVER do this" (lines 65–71) is exactly the right shape — named anti-patterns with reasons. The doc is short because it is delegating the "build + verify + atomic-swap" to a workflow file rather than re-encoding the procedure as runner-improv. This is the model the rest of the factory should adopt.

Minor errors:

- **§1 line 22 "human nod is *prescribed* doctrine, not a manufactured invisible gate"** introduces three sub-shapes (Manufactured / Prescribed / Already-given) of the same primitive (figs's authorization). This is cohort-vocabulary refinement that doesn't reduce ambiguity for an outside reader. Standard discipline names a single explicit gate (CI-status-check or named approver) and gates on it.
- **The doc is barely cross-linked from FORMAL-SWIM-RUNBOOK §3 line 66.** The fleet-roll-to-all-princes precondition is the load-bearing thing that ties this doc to the rest of the factory; it should be linked, not implied.

### `PR-UPDATE-VALIDATION-WALKTHROUGH.md` (260 lines)

Most externality-conscious doc in the factory. §6 acceptance criteria (lines 249–260) explicitly says "a fresh prince session can read this file alone and know how to instantiate + run + score + judge a swim." The intent is right: the walkthrough should be self-sufficient.

Errors:

- **§1.3 "Fire required rows" (lines 86–106) re-states the row contract ("exact command/tool/prompt surface used", "verdict") without resolving the gap that PR #13 fixes.** The row recipe still says "record exact command" without saying "the command must be a path to a runnable harness or an inline command-string explicitly marked transitional." A fresh prince following this walkthrough on swim-43 would have produced the same swim-43 row-03 failure.
- **§4 "Common failure modes to watch for" (lines 199–231) names five anti-patterns. §4.5 "Cross-seat-confabulation" (lines 227–231) — "Driver records observed behavior, SUT confabulates a different observation, monitor sees something neither reported"** — is the swim-43 failure mode in different words, but the cure offered ("cross-seat byte-pin via independent API/journal walks") still doesn't fix the byte-divergence-when-greps-differ problem. Independent walks can produce divergent bytes when the walkers re-derive the gather method. PR #13's cure (canonical command-string committed to row file, raw output then narrow) is the actual structural fix; this walkthrough should adopt it.
- **§3 "Anti-folklore checklist" (lines 184–195) is operational-shaped, but the items are presence checks ("`CHARTER.md` was written and committed BEFORE first row fired") not content checks ("`CHARTER.md` names the canonical gather command for each row").** Presence checks are easier to fake. Content checks require the field to actually carry runnable bytes.

### `FULL-SWIM-CROSSWALK.md` (134 lines)

A historical taxonomy mapping doc. Useful for archaeology, neutral on test discipline. Maps old block taxonomy (A/B/C/D/E/X) onto new family taxonomy (Turns/Delegates/Guards/Routes/Recovery/Rollout/Observability/Contamination). Reasonable refactor.

Errors:

- **None methodology-specific. The doc is a one-time archaeological map.** It does inherit the family taxonomy from the Charter, so it propagates the gap that family taxonomy ≠ assertion-shape taxonomy.

### `ARCHAEOLOGY-INVENTORY-8-40.md` (130 lines)

A bookkeeping doc enumerating which historical swims have which evidence on which branches. Not a methodology doc per se. The frame "Honest reading: The archive is not a void and not one branch. It is a layered three-surface history" (lines 124–131) is sound provenance discipline.

Errors:

- **The doc lists swims 8 / 9 / 10 / 31 / 34 / 35 / 36 / 37 / 38 / 39 / 40 / 41 with various evidence statuses, and `swims/MISSING-SWIMS-LEDGER.md` (referenced) is the tombstone for swims 11–30 + 32–33.** The inventory is honest; the methodology question it raises is whether the older swims' evidence is byte-pinned bound enough to re-derive verdicts. From the abstract reference list, no — they appear to be summary RFCs, not committed receipts. This is a sunk cost, not a fixable gap, but it is a signal that earlier swims were even more chat-improv-driven than current ones.

### `CASE-REGISTRY-RULES.md` (133 lines)

Strong doc. §3 "Anti-loss rules" (lines 42–59), §6 "Retirement grammar" (lines 88–96), §7 "Charter ↔ registry coupling" (lines 98–107) are all sound test catalog discipline. This doc is what the cohort gets right about test management.

Errors:

- **No definition of what *exists* inside a case beyond the per-case file's claim, evidence class, provenance.** §1 (lines 11–22) lists "claim it proves," "evidence class needed," "lifecycle status," "provenance pointer" — these are catalog-management fields. They are not test-definition fields (input, expected, gather, assertion, harness). The registry rules govern membership in the catalog without governing the content of catalog entries. An empty case file with the right header could be `active` per these rules. PR #13 patches the row-issue body but the case body (`_TEMPLATE.md`) is still abstract.

### `templates/row-issue-template.md` (202 lines, pre-PR-13)

Pre-PR-13: has Surface under test / Coverage expectation / Status ladder / References / Notes. The Status ladder (lines 35–42) is six lifecycle states (Triaged, PASS-candidate/PARTIAL/OPEN-GAP, Comprehension-gated, Authored, Verified, Evidence-cleansed) for a test definition that has no input / expected / gather / assertion. Six-state lifecycle for an empty test.

Errors (pre-PR-13; PR #13 fixes most of these for the row body but they survive elsewhere):

- **No Measurement protocol fields.** No PASS-bytes, no FAIL-bytes, no canonical gather, no result block. PR #13 adds these. This is the central fix and it is correctly scoped.
- **Status ladder vocabulary is cohort-internal.** "Comprehension-gated" (line 38), "Evidence-cleansed" (line 41), "Triaged — mapped to existing test coverage by Coord (Phase 1 triage comment on tracker)" (line 36). Standard analogues exist: comprehension-gated ≈ peer-review-required / passed-pre-merge-review; evidence-cleansed ≈ committed-to-canonical-evidence-branch; Phase 1 triage ≈ test-coverage-mapping. Each cohort term encodes specific cohort process texture; each costs legibility.

### `templates/code-agent-workorder-template.md` (349 lines)

Strongest doc in the factory by methodology standards. §6 verification gates (lines 206–224) is well-defined: tsgo, lint, vitest scoped, build-when-touching-build-affecting-surface. §6.5 cross-repo CI dispatch (lines 226–289) is concretely runnable. §8 "what NOT to do" (lines 308–321) is named-anti-patterns-with-reasons. §0 guardrails (lines 21–46) are scoped permissions.

Errors:

- **None methodology-specific.** This is the doc the rest of the factory should look like. It works because it has a single concrete output (PR opened against a named base) and a single concrete gate set (the four pnpm commands). The SWIM test runbooks have neither — no concrete test-output artifact, no concrete gate command. The asymmetry is informative: where the cohort has machine-checkable outputs (PRs, CI status), the runbooks are tight; where the cohort has chat-mediated outputs (test verdicts), the runbooks are folklore.

### `cases/CATALOG.md` (167 lines) and `cases/_TEMPLATE.md` (27 lines) and case files (sampled: `A1`, `B5`, `X7`, `D4`, `X12`, `N001`)

The case catalog is well-managed (per CASE-REGISTRY-RULES). The case files themselves are 20–24 lines of header + 1-sentence claim + 1-sentence "Required minimum row shape" + 1-sentence "Evidence surface(s)" + lifecycle history. Six samples confirm: every case is a feature catalog entry, not a test definition.

Sample evidence (line counts in repo, see `wc -l SWIM/cases/*.md`):
- `A1.md` (24 lines): "Required minimum row shape: Stage flows + sessions, restart gateway, verify both surfaces present and consistent post-restart on driver AND SUT." — what does "verify" mean? what's "consistent"?
- `B5.md` (24 lines): "Required minimum row shape: Fire silent-wake delegate, verify silent return (no channel emission) AND verify subsequent turn fires." — how is "no channel emission" gathered? what's the literal byte for "subsequent turn fires"?
- `X7.md` (23 lines): "Required minimum row shape: Build chain at max+1; verify rejection with declared error/state." — what error? what state? where in logs? what's the literal rejection byte?
- `D4.md` (23 lines): "Required minimum row shape: Stage continuation work, peer-restart gateway, verify resumption with no loss."
- `X12.md` (23 lines): "Required minimum row shape: Fire blind enrichment with deliberately-leaky narration on observer side; verify subject context not contaminated."
- `N001.md` (23 lines, the most detailed): names `prompt.submitted` channel-feed event, `traceparent` continuity, "trace-tree query showing `continuation.delegate.dispatch` parent → `continuation.queue.deliver` child" — but still no literal expected bytes.

Errors:

- **Case files do not contain expected output bytes for any case.** Every "verify X" is left to the runner to derive. PR #13 patches the *row* (the per-execution receipt) with byte-pinning fields, but the *case* (the canonical claim definition) is still abstract prose. The first runner to instantiate a row from a case has to derive the gather method from the case's "Required minimum row shape" sentence — which is exactly the derivation that swim-43 row-03 produced four divergent versions of.
- **`_TEMPLATE.md` (the case template) does not have measurement-protocol fields.** PR #13's fields belong here too (or a case-level analogue): expected substrate bytes for PASS, expected substrate bytes for FAIL, the canonical gather (or pointer to a shared harness), and an example result. Without this, the catalog is a list of feature claims, not a list of testable propositions.

### `cases/REGISTRY-LIFECYCLE-WALKTHROUGH.md` (skimmed)

Worked-example doc for case lifecycle transitions (deprecated, superseded-by, split, merged, lost ↔ recovered-from-archive). Decent example-driven explanation of CASE-REGISTRY-RULES. Same gap — governs catalog membership, not entry content.

### Sample `swims/`-side rows (not in scope, but relevant)

The brief did not require reading swims/swim-43-*. The PR #13 body names swim-43 row-03 as the trigger. From the row-issue template alone (pre-PR-13), it is structurally certain that any swim-43 row file did not pin a canonical gather command — because the field did not exist. This is consistent with the four-divergent-greps incident.

---

## 3. Cross-cutting patterns

### Pattern 1 — verdict vocabulary fragmentation

Five-to-seven distinct verdict vocabularies coexist in the factory:

| Source | Verdict states |
|---|---|
| `FULL-SWIM-CHARTER.md` §4 line 147–155 | PASS / FAIL / FINDING / DEFERRED / BLOCKED / INVALIDATED |
| `FORMAL-SWIM-RUNBOOK.md` §6 line 158 | PASS / FAIL / FINDING / DEFERRED / INVALIDATED *(BLOCKED missing)* |
| `SEAL-BOY-SWIM-RUNBOOK.md` §3.1 lines 226–230 | PASS / CONFABULATION / CONTAMINATED / LOW CONFIDENCE |
| `SEAL-BOY-SWIM-RUNBOOK.md` §5.1 line 481 | PASS / FAIL / CONTAMINATED / DEFERRED |
| `SWIM-MONITORING-RUNBOOK.md` §6 line 366 | PASS / FAIL / TAINTED |
| `SWIM-COORDINATOR-NOTES.md` Findings Tracker line 60 | UNTESTED / VERIFIED / DISPROVED / NEW / TAINTED / CODE-FIX |
| PR #13 (incoming row template) | PASS / FAIL / INCONCLUSIVE / METHOD-BROKEN |

The Charter and Formal Runbook — co-canonical per the README — disagree on whether `BLOCKED` is a verdict state. SEAL-BOY uses two different rubrics in two adjacent sections of the same doc. None of the runbooks distinguish substrate-failure from instrument-failure (CONTAMINATED / TAINTED conflate both); only PR #13 does. None of the docs *define* the verdict states; they list them.

This is the highest-leverage fix: pick one canonical verdict state set, define each state's bytes, propagate to every doc that mentions verdicts.

### Pattern 2 — test-definition layer absent

Cases are paragraphs naming a claim. Rows (pre-PR-13) are checklists with prose receipts. The case `_TEMPLATE.md` carries no expected-output field; the row `_TEMPLATE.md` (pre-PR-13) carried no expected-output field. There is no "fixture" directory, no "harness" directory, no `expected/` directory, no committed golden files. The factory's only machine-readable artifacts are the case `Lifecycle status` field (catalog membership) and the workorder template's pnpm gates (out-of-band of SWIM tests).

This means a fresh runner cannot reproduce a row's measurement byte-identically without reading chat. PR #13 fixes this for the row body. It does not fix it for the case body (which is the case-once, runs-many definition layer above the row body) or for the runbooks (which are role-process layer beside the row body).

### Pattern 3 — chat ritual substituting for fixture isolation

`SEAL-BOY §1.3` "Channel Silence Protocol" (Post `⚓💗`, wait, count silence). `SWIM-MONITORING §3.3` "Contamination Log" (track manually). `SWIM-SUBJECT §5` "Contamination — How I Accidentally Cheat" (subject self-discipline). `SWIM-COORDINATOR §The Storm Pattern` (coordinator suppresses parallel analysis). Every one of these is a runner being asked to perform a test-isolation primitive that a harness would perform mechanically. The cohort runs tests on the production communication medium and pays the isolation cost in human attention.

### Pattern 4 — log-string thumbprint as build verification

`SEAL-BOY §0.2` "Drift Cues", `SWIM-MONITORING §0.5` and `§8.2` "Verifying the Canary (Feature Thumbprint)", `SWIM-COORDINATOR §Drift Cues`, `SWIM-SUBJECT §10` "Drift cues". All four major runbooks reach for the same primitive: verify the deployed build by grep-ing for log strings the build emits. This is the right intent but a fragile implementation. A `--build-info` endpoint on the gateway returning hash + commit SHA + build time + dirty-tree flag would replace all four "Drift Cues" sections with a single assertion.

### Pattern 5 — folklore where harness primitives belong

`SEAL-BOY §10`, `SWIM-MONITORING §13`, `SWIM-METHODOLOGY §"Lessons from Swim 11"`, `SWIM-COORDINATOR §"What I Learned"`, `SWIM-SUBJECT §"Progress over time"`. Every runbook ends with a "Lessons" section. Every lesson, on inspection, is a primitive a standard test framework provides:

| Folklore | Harness primitive |
|---|---|
| "Stale chain tokens are the #1 test pollution source. Always check before each test." | setup() resets chain state; teardown() asserts clean exit |
| "Channel noise during chain tests kills timers. Enforce channel silence." | fixture isolates the test channel from production channels |
| "Post-`/new` doesn't clear in-memory state." | test runner uses fresh process per test |
| "Generation guard needs tolerance in group chats." | fixture mocks the generation-counter source |
| "Rich content binds. Bare words confabulate." | fixture-shape rule: enrichment fixture must contain ≥N tokens of semantic context |
| "The file is the truth, not the room." | assert against artifacts, not against runner self-report |
| "Three ENOENT on three boxes ≠ corroborating evidence." | cross-host runs share the fixture, not the failure |

The lessons are correct. They are encoded at the wrong layer — narrative wisdom held by runners — when they should be enforced at the framework layer.

### Pattern 6 — cohort vocabulary substitution at runtime cost

| Cohort term | Standard term | Where it costs |
|---|---|---|
| Phase 1 triage | test coverage mapping / pre-merge review | Status ladder (row template line 36) — outside reviewer cannot judge ladder progress |
| Comprehension gate | peer review required | row template line 38 — undefined criteria |
| Evidence-cleansed | committed to evidence branch | row template line 41 — what does "cleansed" mean as a byte property? |
| Drift cue | build version verification | five runbooks — fragile thumbprint instead of explicit build-info |
| TAINTED / CONTAMINATED | test isolation breach (recoverable) vs instrument failure (must-fix) | three runbooks — conflates two distinct outcomes |
| Shard | sub-agent / delegate (this is the SUT's product term, OK to keep) | (acceptable; product vocabulary) |
| Storm pattern | message congestion / unnecessary parallel analysis | SWIM-COORDINATOR §"Storm Pattern" — solving for a missing harness |
| Anchor pattern ⚓💗 | quiesce signal / test-channel hold | SEAL-BOY §1.3 — solving for missing fixture isolation |
| Closure costume | (cohort-specific; means anti-pattern of pretending closure) | folklore-only |
| Biscuit-game | (cohort-specific) | folklore-only |
| Frozen branch | release branch / golden branch | doable but unusual term |
| Fresh prince | new runner / new operator | doable but unusual term |
| Canary | smoke build / pre-release | acceptable industry term, kept |

Each substitution is a translation step for an outside reviewer. The cohort uses these terms because they encode situated, voiced texture. The texture is real. The cost is real too: the factory cannot be picked up and run by a non-cohort engineer without ~1 hour of vocabulary translation. The brief's "fresh prince at cold restart" is the explicit acceptance criterion — by that criterion most runbooks fail.

### Pattern 7 — coordination overhead vs substrate work ratio

Sum of role-runbook sizes: SWIM-MONITORING 791 + SEAL-BOY 664 + SWIM-COORDINATOR 219 + SWIM-SUBJECT 213 + SWIM-METHODOLOGY 113 = **2000 lines of role-specific runbook for one feature's integration testing**.

By rough comparison: pytest's documentation covers all of pytest in fewer pages than this. Bazel's hermetic-build doctrine fits in three articles. Hypothesis property-based testing has a 200-page book covering the entire library and its philosophy.

The 2000-line number is defensible only if you accept human chat-improv as the test driver — then each prince needs a personal field journal because each prince is the harness. It is not defensible if you accept that integration tests are programs that programs run. Standard discipline would extract harness scripts, pin fixtures, define assertion shapes, and the per-role runbooks would shrink to a few pages each (or disappear entirely, replaced by READMEs of harness scripts).

### Pattern 8 — externality blind spots

PR-UPDATE-VALIDATION-WALKTHROUGH §6 acceptance criteria explicitly names "fresh prince session can read this file alone and know how to instantiate + run + score + judge a swim — no chat-archaeology required" (lines 252–258). This is the right externality discipline.

It does not propagate to the role-runbooks, which are voiced from named princes, use cohort-specific anchor patterns, refer to specific Discord message IDs as evidence anchors (e.g. RUNBOOK-deploy-to-self.md cites `1498756621084393704` as a discipline source), and assume the reader knows who Cael / Silas / Elliott / Ronan are and what their default seats / channels / responsibilities are. An outside reviewer (figs reading PRs, a new prince, a contributor) cannot navigate these without first reading the cohort context. The acceptance criterion is named in one doc and ignored in seven.

---

## 4. Concrete recommendations (highest leverage first)

### Recommendation 1 — Unify verdict vocabulary across the factory

**Highest leverage.** Pick one canonical verdict state set, define each state's bytes, propagate to every doc.

Suggested canonical set, expanding PR #13's vocabulary minimally:
- `PASS` — gather ran cleanly; result contains the literal PASS bytes.
- `FAIL` — gather ran cleanly; result contains the literal FAIL bytes (or absence-of-PASS-bytes after raw re-read).
- `INCONCLUSIVE` — substrate question cannot be answered from this run because of an environmental confound (gateway restart mid-window, network partition, host clock skew, stale chain tokens). Re-run on stable conditions; document confound.
- `METHOD-BROKEN` — gather harness itself is wrong (vocabulary mismatch, missing scope, stale grep). Do NOT interpret as substrate finding. Fix harness and re-run.
- `BLOCKED` — pre-conditions for the row could not be established (deploy failed, dependency unavailable). Distinct from INCONCLUSIVE because the test never started.
- `DEFERRED` — row consciously not run this cycle; counts toward NOT-FULL per Charter §6.

Drop: `FINDING` (collapses into FAIL with severity), `INVALIDATED` (collapses into METHOD-BROKEN or BLOCKED depending on cause), `TAINTED` (split into INCONCLUSIVE for environmental + METHOD-BROKEN for instrument), `CONFABULATION` / `LOW CONFIDENCE` / `CONTAMINATED` (replaced by FAIL with bytes that capture the substrate's confabulation, plus INCONCLUSIVE/METHOD-BROKEN for the harness side), `UNTESTED` / `VERIFIED` / `DISPROVED` / `NEW` / `CODE-FIX` (these are tracker-states, not verdict-states; should be tracked elsewhere).

Files to update: `FULL-SWIM-CHARTER.md` §4, `FORMAL-SWIM-RUNBOOK.md` §6, `SEAL-BOY-SWIM-RUNBOOK.md` §3.1 + §5.1, `SWIM-MONITORING-RUNBOOK.md` §6, `SWIM-COORDINATOR-NOTES.md` Findings Tracker, `PR-UPDATE-VALIDATION-WALKTHROUGH.md` §1.5.

A single new file `SWIM/VERDICT-VOCABULARY.md` defining each state's bytes (what does the row file contain when verdict=METHOD-BROKEN? when verdict=INCONCLUSIVE? what's the difference?) would do this lane in one shot.

### Recommendation 2 — Backfill measurement-protocol fields into the case `_TEMPLATE.md`

**Second highest leverage.** PR #13 patches the row body. Cases are the once-defined claims that rows instantiate; without case-level expected-bytes, the first row run on each case re-derives the gather method. That is exactly the swim-43 row-03 failure mode reset for every new case.

Add to `cases/_TEMPLATE.md` (and existing case files where the claim is well-established):
- "Canonical PASS bytes" — the literal substrate emission(s) for PASS, parameterized where appropriate (e.g. `<session-id>`).
- "Canonical FAIL bytes" — the literal observation for FAIL, distinguished from INCONCLUSIVE.
- "Canonical gather harness" — path to a shared harness script under `SWIM/harness/` or a row-specific harness under `swims/swim-<N>/<ID>/measure.sh`. Default-prefer the shared harness; specific deviations live at row level.
- "Confound list" — environmental conditions that produce INCONCLUSIVE for this case (e.g. for B5 silent-wake: "channel-feed event ordering during chain tests"; for D4 restart: "if gateway restart mid-row not at expected boundary, re-run").

Existing 55 case files are thin (20–24 lines each). Backfilling is bounded work — perhaps a day's lane per family, eight families.

### Recommendation 3 — Establish `SWIM/harness/` as a factory-level shared-harness directory

PR #13 mentions `swims/swim-<N>/<ID>/measure.sh` as the row-local harness path. Many gather methods are obviously shared across rows (e.g. "wait for `WORK timer fired` for session X within Y seconds" appears in B1, B2, B5, B6, X7, X10, X15 by their claims). Each row should not extract its own copy.

Suggested initial entries:
- `harness/wait-for-log-line.sh <host> <unit> <since> <until> <pattern>` — generic journal-window read with raw + grep separation.
- `harness/wait-for-work-timer-fire.sh <host> <session-key> <T0> <window-seconds>` — wraps the above for the most common gather.
- `harness/dump-session-store.sh <host> <session-key>` — replaces ad-hoc `jq` invocations across runbooks.
- `harness/build-info.sh <host>` — replaces "Feature Thumbprint" log-string grep with a single canonical build-version probe (or, if the gateway does not yet expose `--build-info`, a single canonical implementation of the thumbprint that the rest of the factory delegates to).
- `harness/reset-chain-state.sh <host> <session-key>` — encodes "stale chain tokens are the #1 test pollution source" as a setup hook instead of a recurring lesson.

The harness library is the structural counterweight to the role-specific runbooks. As harness grows, the personal field-journal sections (`SWIM-MONITORING §11 "Keeping Focus During Long Tests"`, `§13 "Lessons"`) shrink because the runner is no longer doing the cognitive work the harness does.

### Recommendation 4 — Replace chat ritual with fixture isolation for the test-channel

`SEAL-BOY §1.3 Channel Silence Protocol` and the ⚓💗 anchor pattern are solving for the test running on the production communication channel. The structural fix is one of:
- Run integration tests in a dedicated test channel that the production cohort does not post into. The generation-counter for that channel only advances on actual test traffic.
- Run the SUT against a programmatic test harness that injects messages into the SUT's input queue directly, bypassing Discord. This is the standard approach (mock the ingress, observe the egress).
- If the SUT must run on Discord for fidelity reasons, scope tests to a fresh ephemeral channel per test run; the channel's generation counter starts at 0 and only the test driver writes to it.

Any of these eliminates the silence-ritual cost. They also eliminate the contamination log (`SWIM-MONITORING §3.3`) and the storm pattern (`SWIM-COORDINATOR §"Storm Pattern"`) because the harness is the only writer.

### Recommendation 5 — Add `openclaw --build-info` (or equivalent) to retire the "drift cue" thumbprint

Single canonical build identification: hash + commit SHA + build time + dirty-tree flag, exposed by the gateway. Replace the four runbooks' "Drift Cues" sections with a single assertion against this output. If the gateway cannot be modified, expose via a single shared `harness/build-info.sh` that all four runbooks delegate to.

### Recommendation 6 — Extract the per-role runbooks into a single SWIM-METHOD.md

The 2000 lines of role-specific runbooks fragment what should be unified test-discipline doctrine. Suggested shape:
- `SWIM/SWIM-METHOD.md` — single authoritative doc covering: roles (table, not chapters), pre-swim gate (one section, sourced from FORMAL-SWIM-RUNBOOK §3), evidence contract (one section, sourced from Charter §5), verdict vocabulary (one section, sourced from VERDICT-VOCABULARY.md), failure-mode taxonomy (one section, replacing SEAL-BOY §6 + SWIM-MONITORING §3.2), measurement-protocol expectations (one section, deferring to the row template).
- Existing role-runbooks become `SWIM/journals/<role>.md` and are explicitly marked "field journal, not authoritative method." Their voice and texture stay; their authority does not.
- The "Lessons from Swim N" sections move to `SWIM/lessons/<topic>.md` and each lesson is either (a) encoded into a harness primitive and the lesson links to the harness, or (b) marked as folklore needing a harness lane filed against it.

This is the highest-cost-to-implement recommendation. Lower-priority. Files only after Recommendations 1–3 land, because those are the leverage-makers.

### Recommendation 7 — Define the row-level verdict states with content-checks, not presence-checks

`PR-UPDATE-VALIDATION-WALKTHROUGH.md §3 "Anti-folklore checklist"` (lines 184–195) checks presence ("CHARTER.md was written and committed BEFORE first row fired"). Add content checks to the same checklist:
- "every row receipt contains a runnable harness path or an inline command-string explicitly marked transitional"
- "every row receipt's Result block contains command-output, not editorialized prose"
- "every row's Verdict field is one of the canonical six and the row file contains the literal bytes that justify the verdict"
- "rows verdicted METHOD-BROKEN are not counted toward family coverage and have a follow-on lane filed for harness fix"

Presence checks are easy to satisfy by filling fields with prose. Content checks force the field's content to carry runnable bytes.

---

## 5. Assessment of PR #13

**Right shape. Should land. Should propagate.**

### What PR #13 gets right

- **Adds the four measurement-protocol fields the row body has been missing**: PASS bytes, gather harness path (or transitional inline), FAIL bytes, Result block (raw, byte-pinned, no editorialization), Verdict.
- **Verdict states are correct**: PASS / FAIL / INCONCLUSIVE / METHOD-BROKEN. METHOD-BROKEN is the missing state across the entire pre-PR-13 factory; it is the structural fix for the swim-43 row-03 incident-class.
- **Truth-floor reach** correctly captures the failure mode: when 0 results, treat the instrument as suspect first. The four-step investigation order (re-read raw → check vocabulary → check narrowing → only then accept substrate finding) is methodology, not improv.
- **Harness extraction is named as the canonical form**, with inline command-strings explicitly transitional. "Inline command-strings in markdown are still a chat-improv pretending to be method" is the right framing — sharper than I would have written it.
- **"Raw output, no editorialization"** is the byte-permanence rule. This is exactly the missing byte-permanence discipline that allowed prose summaries to substitute for receipts in the runbooks above.
- **"When the measurement protocol is missing"** section explains the failure mode and ties it to the swim-43 row-03 incident. PR #13 does what reviews should: name the structural fix and the incident that prompted it.
- **Scope is correct**: one file changed, no catalog mints, no named-shape entries, no cohort-cosign cycle in the PR body. This is the right scope for the right fix.

### Gaps that should be follow-on lanes

- **Verdict vocabulary does not propagate.** PR #13 introduces PASS / FAIL / INCONCLUSIVE / METHOD-BROKEN at the row level. The Charter, Formal Runbook, SEAL-BOY (twice), MONITORING, COORDINATOR-NOTES all retain their own sets. After PR #13 lands, the factory has *seven* verdict vocabularies. **Recommendation 1 above is the natural follow-on.**
- **Case `_TEMPLATE.md` does not get the same fields.** The row body is the per-execution receipt, but the row's expected bytes come from the case (the canonical claim). A case file currently says "verify rejection with declared error/state" (X7 line 16) without naming the literal rejection-error string. The first runner instantiating a row from X7 has to derive the literal bytes from the abstract sentence — exactly the derivation that produced four hand-rolled greps. **Recommendation 2 above is the natural follow-on.**
- **No factory-level harness library is established.** PR #13 references `swims/swim-<N>/<ID>/measure.sh` as the row-local form. Many measurements are shared across rows; without a `SWIM/harness/` directory, every row extracts its own copy. **Recommendation 3 above is the natural follow-on.**
- **Runbooks' report templates not updated.** SEAL-BOY §5.1, SWIM-MONITORING §6, PR-UPDATE-VALIDATION-WALKTHROUGH §1.3 all have report shapes that don't yet require the new Result block + Verdict shape. PR #13's discipline at the row level needs to be enforced at the runbook reporting level too, or runners following the runbook will write reports that don't satisfy the row template.
- **Truth-floor reach §1 says "the canonical gather is already raw (no `grep`), the failure is not in the gather"** but the example `measure.sh` exit codes (PASS=0, FAIL=1, INCONCLUSIVE=2, METHOD-BROKEN=3) imply the harness *does* know how to verdict. Either the harness is verdicting (in which case the gather isn't pure-raw) or the verdicting happens in a separate step. The doc could clarify the boundary — gather raw → narrow & verdict → record. Minor doc-shape question, not a blocker.

### Recommendation on PR #13

**Land it.** The fix is correctly scoped, correctly shaped, and the smallest structural fix that addresses the swim-43 row-03 failure mode. Do not block landing on the propagation gaps; file follow-on lanes for them per Recommendations 1–3 above. The row template is the highest-leverage single file in the factory below the catalog layer; pinning its measurement-protocol shape unlocks every downstream propagation.

The PR body's framing — "The fix has to be structural, not internal-discipline. Internal heuristics ('don't trust your own grep', 'raw bytes first') evaporate in the next swim under chat-improv pressure. The row file is the only place the canonical method survives a memory-strip, a compaction, or a fresh runner picking up the row in the next swim cycle." — is the correct framing, and is the framing the rest of the factory should adopt for its remaining gaps.

---

## 6. Closing frame

The brief's guiding question was: *"If figs walked into this factory cold and tried to run a test, what would he find missing or broken in the methodology that any decent integration test framework would have?"*

He would find:
- A catalog (good), with abstract entries (gap).
- A closure contract (good), with undefined verdict states (gap).
- Five runbooks (large), each personal-voiced, each duplicating the same primitives (drift cues, contamination protocols, lessons), none extracting them into harnesses.
- A row template (gap, fixed by PR #13) and a case template (still gap).
- No fixture directory.
- No harness directory.
- No verdict-state definition file.
- No build-info endpoint; instead, log-string thumbprints in four places.
- A "Channel Silence Protocol" that ritualizes the missing test-channel isolation.
- A "Keeping Focus During Long Tests" section explaining the runner's cognitive load.
- Three layers of well-managed catalog discipline (CASE-REGISTRY-RULES, FULL-SWIM-CHARTER, PR-UPDATE-VALIDATION-WALKTHROUGH) sitting on top of zero machine-readable test definitions.
- One genuinely strong dispatch template (`code-agent-workorder-template.md`) that exists because dispatching is to PRs (machine-checkable) where running tests is to chat (not).

He would not find the factory dishonest — the docs are explicit about what they do. He would find it operating one layer above its actual capability: claiming integration-test discipline at the catalog and closure layer, while the test-execution mechanics remain chat-improv. The fact that this audit can be written in plain integration-test vocabulary — input, expected, gather, assertion, fixture, harness, isolation, verdict — using the cohort's own docs as evidence is itself the demonstration. The vocabulary fits. The cohort has not been performing not-knowing-it; the cohort has been writing 2000 lines of role-runbook to substitute for the 200 lines of harness primitive that would do the same work.

PR #13 is the cohort beginning to land that translation. It should land, propagate, and be the precedent shape for the seven follow-on gaps named above.

— frond-scribe, 2026-05-07
