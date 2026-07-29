# Project 86 fold-readiness review

Independent pre-create review of the Project 86 planning substrate: the row catalog, the round
contract set, the code breadcrumbs, and the proposed 38-issue dispatch plan, read as one system.

**This document is analysis only.** No issue was created or edited, project 86 was not mutated,
no proof row was executed, and no source corpus or tooling file was changed. Every claim below is
checked against the exact bytes of the pinned inputs.

---

## 1. Verdict

> ## `READY_AFTER_MECHANICAL_FIXES`

The plan is a byte-faithful projection of the reviewed catalog and is structurally sound: identities are unique, every referenced path and command resolves against the docs-base bytes, no body can make a prince halt the fleet on a row-local failure, and HONEST_LIMIT is permitted on R-RC-2 only. It is not yet safe to create. Twelve blocker-class corrections must be applied first, all of them uniform and machine-applicable: the commands pre-attest the deployed runtime SHA and defeat the round's load-bearing identity gate; no body carries the G1-G5 pre-fire gate; the prescribed primary command takes no same-session lock for 18 rows that require one; R-RC-2 is described as concurrency-safe against SAFETY-ROWS.md; and the three support entries are targeted at corpus row directories that would fail validate-corpus.mjs or inflate the 35-row denominator to 38.

| | |
| --- | --- |
| Planned issues | **38** |
| Issues that pass every check as written | **0 / 38** |
| Blocker-class corrections | **12** (`MC-01` … `MC-12`) |
| Non-blocking mechanical corrections | **5** (`MC-13` … `MC-17`) |
| Non-blocking follow-ups | **9** (`FU-01` … `FU-09`) |
| Recommended issue count after review | **38** (unchanged) |
| Exact-SHA corpus denominator | **35** (unchanged) |
| Structural changes required to the plan | **none** — every correction is a literal edit |

Nothing in the plan needs to be re-decided. The identities are right, the counts reconcile, every
referenced path and command resolves, and — importantly — no body can make a prince halt the fleet
over a row-local failure or launder context pressure into a pass. What is missing is enforcement:
the bodies describe safety rules that their own commands do not carry out.

---

## 2. Inputs and exact SHAs

All four inputs were resolved and byte-verified before review.

| Input | Repo | Ref | SHA | Verified |
| --- | --- | --- | --- | --- |
| Docs base | `karmaterminal/karmaterminal-openclaw-docs` | — | `abe1f9f0749d849b01da4e5d354c205ecffac946` | yes |
| Catalog | `karmaterminal/karmaterminal-openclaw-docs` | `codeagent/project86-proof-catalog` | `366251db79004274f4213e1cb59908aa27ef6693` | yes |
| Round contract | `karmaterminal/karmaterminal-openclaw-docs` | `codeagent/project86-proof-contract` | `bb4ad4367e67190cba3f0909d58c36c259bf6a3d` | yes |
| Breadcrumbs | `karmaterminal/openclaw` | `codeagent/project86-proof-breadcrumbs` | `14355117ec7efb111cb013826c441e62a29954ce` | yes |
| Issue plan | local untracked | — | `INPUT-project86-proof-issue-plan.json` (`frond-scribe.project86.issue-plan.v1`, 38 rows, `candidate_sha: null`) | yes |

Files read in full:

- `analysis/project86-proof-row-inventory.json` (5 215 lines) and `.md` (4 012 lines) — all 38 catalog entries and all 38 proposed issue bodies.
- `analysis/project86-proof-round-contract.md` (782 lines), `analysis/project86-proof-issue-template.md` (368 lines), `analysis/project86-regression-triage-template.md` (258 lines).
- `analysis/project86-proof-code-breadcrumbs.json` (6 985 lines) and `.md` (1 557 lines) — all 35 breadcrumb rows and the validation handoff.
- The complete 38-row issue plan.

Read-only environment checks: umbrella issue **#451 is OPEN**; project 86 exists with `Status`
options exactly `Todo, in_coding_agent, In Progress, prince_review, swim, Done` and **no** `Row`/
`Seat`/`Wave` custom fields (13 fields, all built-in) — confirming round contract §15.5. Project 86
**already holds 3 items** (#451, #1423, PR #1425), so the post-create expectation is 41, not 38.

---

## 3. Counts and set reconciliation

### 3.1 The denominators all reconcile

| Quantity | Value | Source | Verified against bytes |
| --- | --- | --- | --- |
| Manifest entries | 38 | catalog | 38 files in `tools/k6-proofs/manifests/` |
| Scenario files | 35 | catalog | 35 files in `tools/k6-proofs/scenarios/` |
| Reference-required corpus rows | **35** | catalog `reference_required` | reference `proofs-manifest.json`: `rows`=35, `required_rows`=35, `rollup.total_rows`=35 |
| Manifest-only entries | 3 | catalog | `preflight`, `R-CW-5A`, `R-CW-6A` |
| Runnable manifest entries | 36 | `list-runnable-rows.mjs --all` | excludes the 2 scaffolded fixtures |
| Runner live-suite entries | 34 | `list-runnable-rows.mjs --live-suite` | also excludes `R-CW-5A`/`R-CW-6A` |
| Breadcrumb rows | 35 | breadcrumbs | set-identical to the 35 reference-required rows |
| Planned issues | 38 | plan | set-identical to the 38 catalog entries |
| Reference rollup | 2 pass / 32 partial / 1 fail / 0 honest_limit / 35 total | reference corpus | matches |

`38 = 35 + preflight + R-CW-5A + R-CW-6A` holds exactly. Execution classes agree in both directions:
all-38 is `live k6 22 / static validator 13 / isolated fixture 2 / support 1`; corpus-35 is
`live k6 22 / static validator 11 / isolated fixture 2 / support 0`.

### 3.2 The plan is a faithful projection of the catalog

- Plan row ids **==** catalog canonical row ids (38, no extras, no omissions).
- All 38 `body` values are **byte-identical** to `catalog.rows[].proposed_issue_body`.
- All 38 `title` values are **byte-identical** to `proposed_issue_title`.
- `execution_class`, `artifact_subtree` and `failure_scope` are byte-identical.
- The only added field is `assignee`.

This matters for the fix strategy: **every defect found in a body is a catalog defect, and every
correction applies uniformly.** There is no per-issue drift to chase.

### 3.3 Path and command validation against the docs base

- **0** missing paths. Every `manifest_path`, `scenario_path`, `backup_manual_runbook_paths` entry and `reference_paths` entry resolves at `abe1f9f0`.
- **0** duplicate manifest paths. 8 static rows correctly share `scenarios/static-corpus-row-validator.js`.
- All 23 `run-proof.sh <basename>` fallback commands resolve to real scenario files.
- `run-proofs.sh` really does accept `--live` (line 72), so the primary commands execute.
- Both fixture scripts accept every flag used (`--source-dir`, `--candidate-sha`, `--artifact-dir`, `--cap`, `--max-chain-length`, `--json`).
- Line citations check out: `R-CW-5-ISOLATED-TOOL-SURFACE.md:40-47`, `R-CW-6-ISOLATED-MAX-CHAIN.md:67-75`, `skill/SKILL.md:129-139` all land on the cited command blocks.
- `gateway-reload.yml` is **confirmed absent** repository-wide.

---

## 4. What the plan already gets right

Stated plainly, because it constrains how much of the round needs to change:

1. **No body can trigger a fleet halt from a row-local failure.** `failure_scope.blocks_all_proofs`
   is `false` on all 38 entries, and all 38 carry *"Continue independent proof rows unless the
   finding is explicitly classified as a halt-state."* Non-trivial failures route to a
   `karmaterminal/openclaw` issue, not to a stop.
2. **Context pressure can never be laundered into completion.** All 38 carry the PARTIAL policy.
   `honest_limit.permitted` is `true` for **R-RC-2 only**, and only against a nonce-bound
   `request_compaction` toolResult with `status: rejected` and `guard: context_threshold`.
3. **The commit boundary is already disjoint and already protected.** All 38 declare a row-owned
   destination and the clause *"do not edit `PROOFS/INDEX.json` or `proofs-manifest.json`"*.
4. **Redaction is universal.** All 38 end with the no-secrets clause naming tokens, session keys,
   prompt bodies, nonces, raw gateway payloads and private filesystem paths.
5. **Concurrency classification matches the contract on 37 of 38 rows.** The single divergence is
   `R-RC-2`, which the round contract had already flagged as a recorded discrepancy.
6. **`R-CW-5A`/`R-CW-6A` cannot inflate the rollup by verdict**: PASS is explicitly not permitted
   and their expected class is `construct-only`. (They can still inflate it *by directory* — §6.3.)

---

## 5. Blockers

Twelve corrections must land before any issue is created. Each is a literal edit; none requires a
decision that is not already made in the round contract or a runbook.

### `MC-01` — Stop pre-attesting the deployed runtime SHA

**Applies to:** 23 issue(s)

**Why.** The command asserts OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA>. run-proofs.sh honours that value verbatim (DEPLOYED_BUILD_STAMP="${OPENCLAW_RUNTIME_BUILD_SHA:-unknown}") and writes it into runner-metadata.json::runtimeBuildSha, and R-CD-TOKEN's pre-dispatch-build-identity-gate compares exactly those two variables. Supplying it makes the gate unfalsifiable and makes every live identity receipt an assertion rather than an observation. Round contract 4 calls this the single most load-bearing gate.

```diff
- OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
- OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA> \
+ OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
```

### `MC-02` — Make the disposable session mechanical, not aspirational

**Applies to:** 23 issue(s)

**Why.** Round contract 3.1 condition 4 requires each concurrently running row to use its own disposable session and fresh nonce, and every body already says to use one, but no command sets the variables the scenarios actually read (OPENCLAW_CREATE_DISPOSABLE_SESSION / _SESSIONS). The documented form at PROOF-RUN-METHOD.md:99-109 sets both.

```diff
- OPENCLAW_SESSION_KEY=<SESSION_KEY> \
- ./scripts/run-proofs.sh --live 
+ OPENCLAW_SESSION_KEY=<SESSION_KEY> \
+ OPENCLAW_CREATE_DISPOSABLE_SESSION=true \
+ OPENCLAW_CREATE_DISPOSABLE_SESSIONS=true \
+ ./scripts/run-proofs.sh --live 
```

### `MC-03` — Restore fail-closed same-session serialization

**Applies to:** 18 issue(s)

**Why.** 19 rows declare sameSessionConcurrencySafe:false and round contract 3.2 says enforcement is "fail-closed and mechanical". run-proofs.sh contains no reference to live-run-guard.mjs and takes no flock; only run-proof.sh (the fallback) does. As written the primary path for every serialized row has zero enforcement.

### `MC-04` — Add the pre-fire identity gate G1-G5 to every issue

**Applies to:** 38 issue(s)

**Why.** Round contract 4 and the issue template both require G1-G5 to be run on the firing seat and pasted into the row issue before the fire window opens. No planned body contains it. With MC-01 unfixed as well, a prince currently has no mechanism at all to detect a seat that is not on the candidate.

### `MC-05` — Retarget support/companion artifact subtrees out of the corpus row namespace

**Applies to:** 3 issue(s): `preflight`, `R-CW-5A`, `R-CW-6A`

**Why.** validate-corpus.mjs no-orphan-row-dirs treats every subdirectory of PROOFS/<SHA>/ that is not artifacts/, gates/, or _-prefixed and not declared in proofs-manifest.json::rows[].dir as an orphan and fails. It also computes tallied.total_rows = manifest.rows.length. So committing preflight/, R-CW-5A/ and R-CW-6A/ as bare row dirs either fails the validator on the next fold or forces total_rows to 38 and destroys the 35-row denominator. The reference corpus has exactly 35 row dirs plus artifacts/, and no preflight/R-CW-5A/R-CW-6A dir.

### `MC-06` — Declare the non-corpus status of the three support entries

**Applies to:** 3 issue(s): `preflight`, `R-CW-5A`, `R-CW-6A`

**Why.** Nothing in these three bodies tells the prince or the scribe that the entry is outside the 35-row exact-SHA denominator. Without it a folded R-CW-5A can be mistaken for a corpus row, and R-CW-5A/R-CW-6A cannot honestly hold any of the validator states {pass,partial,thin,fail,honest_limit,missing} because their own verdict contract says PASS is "not permitted as a runtime row PASS".

### `MC-07` — R-RC-2 must be serialized fail-closed and ordered after R-RC-1

**Applies to:** 1 issue(s): `R-RC-2`

**Why.** The body reproduces manifests/r-rc-2.json (sameSessionConcurrencySafe:true, requiresHumanConfirmation:false). SAFETY-ROWS.md Guardrails 1 makes R-RC-* serialization load-bearing (the compaction cycle holds a session-write-lock for up to agents.defaults.compaction.timeoutSeconds, default 180s, and a parallel same-session row becomes a second lock-acquirer), Guardrails 2 fixes the order R-RC-1 -> R-RC-2, and Guardrails 5 requires mutating rows to be marked serialized:true + requiresHumanConfirmation:true. Round contract 3.3 and 15.1 rule serialized (fail-closed) for project 86 and forbid resolving it by improvisation. live-run-guard.mjs sets lockRequired only when sameSessionConcurrencySafe === false, so the guard will NOT lock this row - the serialization must be procedural until the manifest is fixed.

### `MC-08` — R-RC-1 carries the family ordering obligation

**Applies to:** 1 issue(s): `R-RC-1`

**Why.** SAFETY-ROWS.md Guardrails 2 requires R-RC-1 to resolve before R-RC-2 is attempted; the R-RC-1 body never says so, so the ordering has no owner.

### `MC-09` — R-CW-5 / R-CW-6 serialize on fixture resources, not on a gateway session

**Applies to:** 2 issue(s): `R-CW-5`, `R-CW-6`

**Why.** Both bodies say "Serialize this row under the runner lock and do not overlap another continuation row on the same target session". These rows are transport: process-local / classification: orchestration-required and open no gateway session, so that instruction is unactionable. Round contract 3.2 states the real constraint: one fixture invocation at a time per seat, a private 0700 artifact directory, and a tracked-clean source worktree. The 0700 mode gate is exactly what stopped both seats' first invocations in the reference corpus - a mechanically proven non-fire - and it is currently unstated.

```diff
- Same-session concurrency safe: **false**. Serialize this row under the runner lock and do not overlap another continuation row on the same target session.
+ Same-session concurrency safe: **false**, but this is a `process-local` / `orchestration-required` fixture: it opens no gateway session and takes no same-session lock. Serialize on the **fixture resources** instead (round contract 3.2):
+ 
+ - one fixture invocation at a time on this seat;
+ - a **new, empty, private artifact directory with mode `0700`** (`mkdir -p <EMPTY_PRIVATE_ARTIFACT_DIR> && chmod 700 <EMPTY_PRIVATE_ARTIFACT_DIR>`). The fixture exits at this gate before any body runs; that exit is a **mechanically proven non-fire**, does not consume the one-fire budget, and must be ledgered here with its exact error string;
+ - a tracked-clean exact-candidate source worktree (the fixture refuses staged or unstaged tracked changes);
+ - never lower fleet config and never restart a gateway to make this row pass. `gateway-reload.yml` does not exist in this repository and must not be invented.
```

### `MC-10` — Name the accountable prince instead of inviting a claim

**Applies to:** 38 issue(s)

**Why.** Every body says "Live assignment: none; claim this issue before running." That contradicts the plan's own assignee field and round contract 1 ("A row has one accountable prince at all times"), and it is the ownership-overlap hazard: two princes can both claim, and a one-fire row can be double-fired. The template requires an Accountable prince field.

### `MC-11` — State the both-forms mandate and name the sibling row

**Applies to:** 38 issue(s)

**Why.** Round contract 8.2 and the issue template make a continuation row that proves only the typed tool OR only the token/bracket surface INCOMPLETE, not pass. No body states its surface role or names its sibling, so a prince cannot know whether their row is complete. Surface provenance (raw assistant final text vs message-tool body) is also unstated, and the reference corpus R-CD-TOKEN failure was exactly a message-body misread.

### `MC-12` — Link the governing contract, template and breadcrumbs

**Applies to:** 38 issue(s)

**Why.** No body links the round contract, the regression triage template, or the code breadcrumbs. Round contract 10 requires regressions to be filed with analysis/project86-regression-triage-template.md, and the breadcrumbs are the only source of per-row owner symbols, upstream caller chain, declared failure-class triage, blast radius and halt scope. Without the link a prince cannot classify row-local vs family-local correctly.

---

## 6. Adjudications

### 6.1 R-RC-2 manifest concurrency versus SAFETY-ROWS.md

**Finding.** tools/k6-proofs/manifests/r-rc-2.json declares liveRunSafety.sameSessionConcurrencySafe: true and requiresHumanConfirmation: false. SAFETY-ROWS.md classifies R-RC-2 as state-mutating and Guardrails 1 makes serialization load-bearing via an actual session-write-lock held for up to agents.defaults.compaction.timeoutSeconds (default 180s); Guardrails 2 fixes R-RC-1 before R-RC-2; Guardrails 5 requires mutating rows to carry serialized:true + requiresHumanConfirmation:true. The planned R-RC-2 body reproduces the manifest value verbatim ("Same-session concurrency safe: true") and mentions neither the ordering nor human confirmation. live-run-guard.mjs sets lockRequired only when sameSessionConcurrencySafe === false, so no mechanical lock will ever be taken for this row on either the primary or the fallback path.

**Ruling.** BLOCKER. The runbook wins. R-RC-2 is serialized fail-closed and human-confirmed for project 86, exactly as round contract 3.3 and 15.1 already ruled. Because the guard cannot enforce it, serialization must be made procedural in the body (MC-07) and R-RC-1 must carry the ordering obligation (MC-08). A docs issue is filed to reconcile the manifest (FU-01). Do not relax the runbook to match the manifest and do not resolve this by improvisation at fire time.

**Corrections:** `MC-07`, `MC-08` · **Follow-ups:** `FU-01`

### 6.2 Whether 38 issues is correct despite the 35-row corpus denominator

**Finding.** The catalog reconciles 38 manifest entries as 35 canonical reference rows + preflight + R-CW-5A/R-CW-6A, and that reconciliation checks out against the bytes: 38 manifests and 35 scenario files exist at the docs base; reference_required is true for exactly 35 entries; the reference corpus proofs-manifest.json has rows=35, required_rows=35 and rollup.total_rows=35 with no preflight/R-CW-5A/R-CW-6A row; and the breadcrumbs independently represent exactly the same 35. The plan is a byte-faithful projection with one added assignee field.

**Ruling.** 38 is correct as an ISSUE count and 35 is correct as the CORPUS denominator. They are different quantities and the round must publish both, with the corpus one cited as authoritative. The risk is not the count; it is that the three support issues currently point at corpus row directories, which would force the scribe to choose between a failing validator and a 38-row rollup. MC-05 and MC-06 remove that choice.

**Corrections:** `MC-05`, `MC-06` · **Follow-ups:** —

### 6.3 How R-CW-5A / R-CW-6A are represented without corrupting corpus rollup

**Finding.** Both are catalog_scope "manifest-only static companion", reference_required false, expected_artifact_class "construct-only", and their verdict contract explicitly says PASS is "not permitted as a runtime row PASS". Neither has a row object or a row directory in the reference corpus. But their planned Row-owned destination is PROOFS/<FINAL_CANDIDATE_SHA>/R-CW-5A/<SEAT>/ and .../R-CW-6A/<SEAT>/. validate-corpus.mjs no-orphan-row-dirs tolerates only artifacts/, gates/ and _-prefixed subdirectories, and tallied.total_rows is literally manifest.rows.length. So as planned, committing them either fails the validator on the very next fold or forces the scribe to add them to rows[] - which would push total_rows to 38 and demand a state from {pass,partial,thin,fail,honest_limit,missing} that their own contract forbids.

**Ruling.** BLOCKER, mechanically fixable. Retarget both to PROOFS/<FINAL_CANDIDATE_SHA>/_static-companions/<ROW-ID>/<SEAT>/ (underscore-prefixed, validator-ignored) and add an explicit "Not a corpus row" clause forbidding any appearance in required_rows, rows[] or rollup. Same treatment for preflight, retargeted to PROOFS/<FINAL_CANDIDATE_SHA>/gates/preflight/<SEAT>/, matching the reference corpus which keeps seat/fleet readiness under artifacts/ rather than as a row dir.

**Corrections:** `MC-05`, `MC-06` · **Follow-ups:** —

### 6.4 Absent gateway-reload.yml

**Finding.** Confirmed absent: no path matching gateway-reload anywhere in the docs repository at abe1f9f0749d849b01da4e5d354c205ecffac946. The workflows present are k6-proof.yml and project81-k6-proof.yml. Round contract 5.3 and 15.3 record the absence correctly, and the issue template carries it as a comment. R-CW-5 and R-CW-6 correctly use the process-local fixtures run-cost-cap-fixture.mjs and run-max-chain-fixture.mjs, both of which exist and both of whose flags (--source-dir, --candidate-sha, --artifact-dir, --cap, --max-chain-length, --json) are accepted by the committed scripts.

**Ruling.** No blocker. No planned body names gateway-reload.yml or any reload/restart mechanism. The residual risk is that the R-CW-5/R-CW-6 bodies do not repeat the prohibition, so a prince hitting the fixture boundary could improvise a restart. MC-09 folds the prohibition and the 0700 artifact-directory gate into both bodies.

**Corrections:** `MC-09` · **Follow-ups:** —

### 6.5 Runbook rows without manifests

**Finding.** Round contract 15.4 names R-CW-ACTIVE-OVERLAP and R-CONTINUATION-MIXED-SURFACE-FANOUT as defined in RUNBOOKS/PROOF-CORPUS-METHOD.md but absent from the reference required_rows and from tools/k6-proofs/manifests/. Verified: neither appears in the catalog, the plan, the breadcrumbs, or the 38 manifest files. Every one of the 38 planned issues has a manifest that exists at the docs base, with no duplicates.

**Ruling.** No blocker, and the exclusion is correct. A row with no manifest has no declared receipt contract, no liveRunSafety block and no expectedArtifactClass, so rung A4 alone cannot produce foldable evidence for it. Do not add either row to project 86 in this round. If a later round wants them, they need a manifest plus a scenario before dispatch. Record the exclusion in the round denominator statement so the round cannot be accused of silently shrinking its scope.

**Corrections:** — · **Follow-ups:** —

### 6.6 Final mechanical replacement of <FINAL_CANDIDATE_SHA>

**Finding.** plan.candidate_sha is null. The literal <FINAL_CANDIDATE_SHA> occurs 310 times across the 38 bodies (7 or 9 per body) and 38 more times in rows[].artifact_subtree, for 348 sites. It never occurs in a title. No other placeholder shares a prefix with it. The remaining placeholders (<SEAT> 132, <SESSION_KEY> 62, <EXACT_CANDIDATE_WORKTREE> 2, <EMPTY_PRIVATE_ARTIFACT_DIR> 2) are per-seat runtime values and must survive substitution.

**Ruling.** Safe and mechanically verifiable, with three preconditions. First, freeze and validate the SHA as 40-char lowercase hex before substituting - evidence-writer.mjs rejects anything else and validate-corpus requires capture_sha to equal the directory name. Second, apply MC-01 before substitution, otherwise the substitution is what hard-codes the false runtime attestation into 348 sites. Third, assert post-conditions: zero residual <FINAL_CANDIDATE_SHA> and exactly 348 occurrences of the SHA across body+artifact_subtree.

**Corrections:** `MC-17`, `MC-01` · **Follow-ups:** —

### 6.7 Whether any issue body can make a prince halt the whole round on a row-local failure, or accept generic context pressure as completion

**Finding.** Fleet halt: no. failure_scope.blocks_all_proofs is false on all 38 entries. 35 bodies scope failure to "this row or its directly affected continuation family"; R-CONFIG-DEFAULTS and R-CONFIG-INTERSESSION scope to "live continuation rows on the affected seat"; preflight scopes to "all live rows on the affected seat" and explicitly lets static validators and isolated fixtures continue. All 38 carry "Continue independent proof rows unless the finding is explicitly classified as a halt-state" and route non-trivial failures to a karmaterminal/openclaw issue rather than to a stop. Context pressure: no. All 38 carry "Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete", and honest_limit.permitted is true for R-RC-2 alone, gated on a nonce-bound request_compaction toolResult with status rejected and guard context_threshold. R-CW-5A and R-CW-6A additionally state that passing static automation while candidate behavior stays unexecuted is still incomplete.

**Ruling.** PASS on both, and this is the plan's strongest property. Two residual gaps, neither of which creates a halt: no body uses the word "swim" or names the family-local swim path from round contract 9.2, and no body links the breadcrumbs whose declaredFailureClassTriage and haltScope fields are what let a prince tell row-local from family-local. MC-12 supplies both. Note the one genuine escalation asymmetry: the breadcrumbs classify R-REGRESSION-TRAP-TESTS as "all-proofs" and R-CONFIG-DEFAULTS as "all-continuation-proofs", while the catalog gives them narrower scopes - an under-escalation, tracked as FU-03.

**Corrections:** `MC-12` · **Follow-ups:** `FU-03`

---

## 7. Issue-by-issue matrix (all 38)

Checks:

- **C01** — unique canonical row/support identity
- **C02** — actionable automation command resolves to committed bytes
- **C03** — old-runbook fallback present and resolvable
- **C04** — exact candidate/deployment placeholders present
- **C05** — pre-fire identity gate (G1-G5) present
- **C06** — expected receipts + artifacts declared
- **C07** — redaction boundary stated
- **C08** — row-owned commit boundary is corpus-legal
- **C09** — breadcrumb owner/caller/failure-class guidance linked
- **C10** — same-session serialization declared AND mechanically enforced
- **C11** — continue/family-swim/halt routing explicit, no fleet halt
- **C12** — both-forms mandate + named sibling row
- **C13** — assigned seat compatible with class and workload
- **C14** — deployed-runtime identity not pre-attested by the command

`P` pass · `!` warn · `X` fail

| # | Row | Class | Denominator | Assignee (planned → recommended) | C01 | C02 | C03 | C04 | C05 | C06 | C07 | C08 | C09 | C10 | C11 | C12 | C13 | C14 | Verdict |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `preflight` | support | support | scribe | P | P | P | P | X | P | P | X | X | P | P | P | ! | X | **FAIL** |
| 2 | `R-CD-1` | live k6 | corpus (35) | silas | P | P | P | P | X | P | P | P | X | X | P | X | P | X | **FAIL** |
| 3 | `R-CD-2` | live k6 | corpus (35) | cael | P | P | P | P | X | P | P | P | X | X | P | X | P | X | **FAIL** |
| 4 | `R-CD-3` | live k6 | corpus (35) | ronan | P | P | P | P | X | P | P | P | X | ! | P | X | ! | X | **FAIL** |
| 5 | `R-CD-4` | live k6 | corpus (35) | emeric | P | P | P | P | X | P | P | P | X | X | P | X | ! | X | **FAIL** |
| 6 | `R-CD-CHAINED-DEPTH-2` | live k6 | corpus (35) | ronan | P | P | P | P | X | P | P | P | X | X | P | X | ! | X | **FAIL** |
| 7 | `R-CD-COLLECTION-ON-COLLAPSE` | static validator | corpus (35) | cael | P | P | P | P | X | P | P | P | X | P | P | ! | P | P | **FAIL** |
| 8 | `R-CD-MODEL-CHAINED-ALT` | live k6 | corpus (35) | cael | P | P | P | P | X | P | P | P | X | X | P | X | P | X | **FAIL** |
| 9 | `R-CD-MODEL-DEFAULT` | live k6 | corpus (35) | cael | P | P | P | P | X | P | P | P | X | X | P | X | P | X | **FAIL** |
| 10 | `R-CD-MODEL-TOKEN` | live k6 | corpus (35) | cael | P | P | P | P | X | P | P | P | X | X | P | X | P | X | **FAIL** |
| 11 | `R-CD-MODEL-TOOL` | live k6 | corpus (35) | cael | P | P | P | P | X | P | P | P | X | X | P | X | P | X | **FAIL** |
| 12 | `R-CD-RETURN-OVERLAP` | static validator | corpus (35) | cael | P | P | P | P | X | P | P | P | X | P | P | ! | P | P | **FAIL** |
| 13 | `R-CD-SILENT` | live k6 | corpus (35) | cael | P | P | P | P | X | P | P | P | X | X | P | X | P | X | **FAIL** |
| 14 | `R-CD-TOKEN` | live k6 | corpus (35) | elliott | P | P | P | P | X | P | P | P | X | X | P | X | P | X | **FAIL** |
| 15 | `R-CONFIG-DEFAULTS` | live k6 | corpus (35) | elliott | P | P | P | P | X | P | P | P | X | P | P | P | P | X | **FAIL** |
| 16 | `R-CONFIG-INTERSESSION` | live k6 | corpus (35) | elliott | P | P | P | P | X | P | P | P | X | P | P | P | P | X | **FAIL** |
| 17 | `R-CW-1` | live k6 | corpus (35) | silas | P | P | P | P | X | P | P | P | X | X | P | X | P | X | **FAIL** |
| 18 | `R-CW-2` | live k6 | corpus (35) | ronan → **silas** | P | P | P | P | X | P | P | P | X | X | P | X | ! | X | **FAIL** |
| 19 | `R-CW-3` | live k6 | corpus (35) | ronan → **silas** | P | P | P | P | X | P | P | P | X | X | P | X | ! | X | **FAIL** |
| 20 | `R-CW-4` | live k6 | corpus (35) | ronan → **emeric** | P | P | P | P | X | P | P | P | X | X | P | X | ! | X | **FAIL** |
| 21 | `R-CW-5` | isolated fixture | corpus (35) | ronan | P | P | P | P | X | P | P | P | X | X | P | X | ! | P | **FAIL** |
| 22 | `R-CW-5A` | static validator | support | ronan → **rune** | P | P | P | P | X | P | P | X | X | P | P | ! | ! | P | **FAIL** |
| 23 | `R-CW-6` | isolated fixture | corpus (35) | ronan | P | P | P | P | X | P | P | P | X | X | P | X | ! | P | **FAIL** |
| 24 | `R-CW-6A` | static validator | support | ronan → **rune** | P | P | P | P | X | P | P | X | X | P | P | ! | ! | P | **FAIL** |
| 25 | `R-CW-7` | static validator | corpus (35) | emeric | P | P | P | P | X | P | P | P | X | P | P | ! | ! | P | **FAIL** |
| 26 | `R-CW-DELEGATE-CHILD-LIVE` | static validator | corpus (35) | emeric | P | P | P | P | X | P | P | P | X | P | P | ! | ! | P | **FAIL** |
| 27 | `R-CW-DELEGATE-SELF-CONTINUATION` | live k6 | corpus (35) | ronan → **emeric** | P | P | P | P | X | P | P | P | X | X | P | X | ! | X | **FAIL** |
| 28 | `R-CW-DELEGATE-TOKEN` | static validator | corpus (35) | emeric | P | P | P | P | X | P | P | P | X | P | P | ! | ! | P | **FAIL** |
| 29 | `R-CW-MULTI-COLLAPSE` | static validator | corpus (35) | emeric | P | P | P | P | X | P | P | P | X | P | P | ! | ! | P | **FAIL** |
| 30 | `R-CW-MULTI` | static validator | corpus (35) | emeric | P | P | P | P | X | P | P | P | X | P | P | ! | ! | P | **FAIL** |
| 31 | `R-CW-TOKEN` | live k6 | corpus (35) | ronan | P | P | P | P | X | P | P | P | X | X | P | X | ! | X | **FAIL** |
| 32 | `R-OBS-1` | live k6 | corpus (35) | elliott | P | P | P | P | X | P | P | P | X | P | P | P | P | X | **FAIL** |
| 33 | `R-OBS-2` | static validator | corpus (35) | elliott | P | P | P | P | X | P | P | P | X | P | P | P | P | P | **FAIL** |
| 34 | `R-OBS-STATUS` | static validator | corpus (35) | rune | P | P | P | P | X | P | P | P | X | P | P | P | ! | P | **FAIL** |
| 35 | `R-RC-1` | live k6 | corpus (35) | ronan | P | P | P | P | X | P | P | P | X | X | P | P | ! | X | **FAIL** |
| 36 | `R-RC-2` | live k6 | corpus (35) | ronan | P | P | P | P | X | P | P | P | X | X | P | P | ! | X | **FAIL** |
| 37 | `R-REGRESSION-TRAP-TESTS` | static validator | corpus (35) | elliott | P | P | P | P | X | P | P | P | X | P | P | P | P | P | **FAIL** |
| 38 | `R-TRACE-REDACTION-1121` | static validator | corpus (35) | elliott | P | P | P | P | X | P | P | P | X | P | P | P | P | P | **FAIL** |

Check tally:

| Check | pass | warn | fail |
| --- | ---: | ---: | ---: |
| C01 unique canonical row/support identity | 38 | 0 | 0 |
| C02 actionable automation command resolves to committed bytes | 38 | 0 | 0 |
| C03 old-runbook fallback present and resolvable | 38 | 0 | 0 |
| C04 exact candidate/deployment placeholders present | 38 | 0 | 0 |
| C05 pre-fire identity gate (G1-G5) present | 0 | 0 | 38 |
| C06 expected receipts + artifacts declared | 38 | 0 | 0 |
| C07 redaction boundary stated | 38 | 0 | 0 |
| C08 row-owned commit boundary is corpus-legal | 35 | 0 | 3 |
| C09 breadcrumb owner/caller/failure-class guidance linked | 0 | 0 | 38 |
| C10 same-session serialization declared AND mechanically enforced | 17 | 1 | 20 |
| C11 continue/family-swim/halt routing explicit, no fleet halt | 38 | 0 | 0 |
| C12 both-forms mandate + named sibling row | 10 | 9 | 19 |
| C13 assigned seat compatible with class and workload | 17 | 21 | 0 |
| C14 deployed-runtime identity not pre-attested by the command | 15 | 0 | 23 |

### 7.1 Per-row notes

**`preflight`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C08` — artifact_subtree PROOFS/<SHA>/preflight/ is a bare row dir; validate-corpus.mjs no-orphan-row-dirs only tolerates artifacts/, gates/, _*; folding it into rows[] would make total_rows=38 and break the 35-row denominator
- `C09` — no breadcrumb/round-contract/triage-template link; no breadcrumb row exists for this support entry
- `C13` — assigned to the foreground scribe; contract 1 bars the scribe from firing a row they own as scribe-of-record without a second reviewer, and the body says "Live assignment: none; claim this issue"
- `C14` — command sets OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA>, which forces runner-metadata.json::runtimeBuildSha to equal the candidate and auto-satisfies the R-CD-TOKEN pre-dispatch-build-identity-gate; the deployed SHA is then never independently observed

**`R-CD-1`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C10` — declared serialized but the prescribed run-proofs.sh command never invokes live-run-guard.mjs and takes no flock; only run-proof.sh (the fallback) enforces the lock
- `C12` — no both-forms statement and no named tool-form/token-form sibling; contract 8.2 makes single-surface coverage INCOMPLETE, not pass
- `C14` — command sets OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA>, which forces runner-metadata.json::runtimeBuildSha to equal the candidate and auto-satisfies the R-CD-TOKEN pre-dispatch-build-identity-gate; the deployed SHA is then never independently observed

**`R-CD-2`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C10` — declared serialized but the prescribed run-proofs.sh command never invokes live-run-guard.mjs and takes no flock; only run-proof.sh (the fallback) enforces the lock
- `C12` — no both-forms statement and no named tool-form/token-form sibling; contract 8.2 makes single-surface coverage INCOMPLETE, not pass
- `C14` — command sets OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA>, which forces runner-metadata.json::runtimeBuildSha to equal the candidate and auto-satisfies the R-CD-TOKEN pre-dispatch-build-identity-gate; the deployed SHA is then never independently observed

**`R-CD-3`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C10` — ssc:true but the row can trigger compaction, which holds a session-write-lock (SAFETY-ROWS.md 1); disposable session is hedged as "when the row can compact", not mandated
- `C12` — no both-forms statement and no named tool-form/token-form sibling; contract 8.2 makes single-surface coverage INCOMPLETE, not pass
- `C13` — seat holds 10 serial-bound rows (round critical path)
- `C14` — command sets OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA>, which forces runner-metadata.json::runtimeBuildSha to equal the candidate and auto-satisfies the R-CD-TOKEN pre-dispatch-build-identity-gate; the deployed SHA is then never independently observed

**`R-CD-4`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C10` — declared serialized but the prescribed run-proofs.sh command never invokes live-run-guard.mjs and takes no flock; only run-proof.sh (the fallback) enforces the lock
- `C12` — no both-forms statement and no named tool-form/token-form sibling; contract 8.2 makes single-surface coverage INCOMPLETE, not pass
- `C13` — substitution: catalog suggests rune, plan assigns emeric-nuc (emeric); contract 1 requires substitutions be named and justified
- `C14` — command sets OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA>, which forces runner-metadata.json::runtimeBuildSha to equal the candidate and auto-satisfies the R-CD-TOKEN pre-dispatch-build-identity-gate; the deployed SHA is then never independently observed

**`R-CD-CHAINED-DEPTH-2`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C10` — declared serialized but the prescribed run-proofs.sh command never invokes live-run-guard.mjs and takes no flock; only run-proof.sh (the fallback) enforces the lock
- `C12` — no both-forms statement and no named tool-form/token-form sibling; contract 8.2 makes single-surface coverage INCOMPLETE, not pass
- `C13` — seat holds 10 serial-bound rows (round critical path)
- `C14` — command sets OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA>, which forces runner-metadata.json::runtimeBuildSha to equal the candidate and auto-satisfies the R-CD-TOKEN pre-dispatch-build-identity-gate; the deployed SHA is then never independently observed

**`R-CD-COLLECTION-ON-COLLAPSE`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C12` — static validator: both-forms role not stated, sibling not named

**`R-CD-MODEL-CHAINED-ALT`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C10` — declared serialized but the prescribed run-proofs.sh command never invokes live-run-guard.mjs and takes no flock; only run-proof.sh (the fallback) enforces the lock
- `C12` — no both-forms statement and no named tool-form/token-form sibling; contract 8.2 makes single-surface coverage INCOMPLETE, not pass
- `C14` — command sets OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA>, which forces runner-metadata.json::runtimeBuildSha to equal the candidate and auto-satisfies the R-CD-TOKEN pre-dispatch-build-identity-gate; the deployed SHA is then never independently observed

**`R-CD-MODEL-DEFAULT`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C10` — declared serialized but the prescribed run-proofs.sh command never invokes live-run-guard.mjs and takes no flock; only run-proof.sh (the fallback) enforces the lock
- `C12` — no both-forms statement and no named tool-form/token-form sibling; contract 8.2 makes single-surface coverage INCOMPLETE, not pass
- `C14` — command sets OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA>, which forces runner-metadata.json::runtimeBuildSha to equal the candidate and auto-satisfies the R-CD-TOKEN pre-dispatch-build-identity-gate; the deployed SHA is then never independently observed

**`R-CD-MODEL-TOKEN`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C10` — declared serialized but the prescribed run-proofs.sh command never invokes live-run-guard.mjs and takes no flock; only run-proof.sh (the fallback) enforces the lock
- `C12` — no both-forms statement and no named tool-form/token-form sibling; contract 8.2 makes single-surface coverage INCOMPLETE, not pass
- `C14` — command sets OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA>, which forces runner-metadata.json::runtimeBuildSha to equal the candidate and auto-satisfies the R-CD-TOKEN pre-dispatch-build-identity-gate; the deployed SHA is then never independently observed

**`R-CD-MODEL-TOOL`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C10` — declared serialized but the prescribed run-proofs.sh command never invokes live-run-guard.mjs and takes no flock; only run-proof.sh (the fallback) enforces the lock
- `C12` — no both-forms statement and no named tool-form/token-form sibling; contract 8.2 makes single-surface coverage INCOMPLETE, not pass
- `C14` — command sets OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA>, which forces runner-metadata.json::runtimeBuildSha to equal the candidate and auto-satisfies the R-CD-TOKEN pre-dispatch-build-identity-gate; the deployed SHA is then never independently observed

**`R-CD-RETURN-OVERLAP`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C12` — static validator: both-forms role not stated, sibling not named

**`R-CD-SILENT`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C10` — declared serialized but the prescribed run-proofs.sh command never invokes live-run-guard.mjs and takes no flock; only run-proof.sh (the fallback) enforces the lock
- `C12` — no both-forms statement and no named tool-form/token-form sibling; contract 8.2 makes single-surface coverage INCOMPLETE, not pass
- `C14` — command sets OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA>, which forces runner-metadata.json::runtimeBuildSha to equal the candidate and auto-satisfies the R-CD-TOKEN pre-dispatch-build-identity-gate; the deployed SHA is then never independently observed

**`R-CD-TOKEN`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C10` — declared serialized but the prescribed run-proofs.sh command never invokes live-run-guard.mjs and takes no flock; only run-proof.sh (the fallback) enforces the lock
- `C12` — no both-forms statement and no named tool-form/token-form sibling; contract 8.2 makes single-surface coverage INCOMPLETE, not pass
- `C14` — command sets OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA>, which forces runner-metadata.json::runtimeBuildSha to equal the candidate and auto-satisfies the R-CD-TOKEN pre-dispatch-build-identity-gate; the deployed SHA is then never independently observed

**`R-CONFIG-DEFAULTS`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C14` — command sets OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA>, which forces runner-metadata.json::runtimeBuildSha to equal the candidate and auto-satisfies the R-CD-TOKEN pre-dispatch-build-identity-gate; the deployed SHA is then never independently observed

**`R-CONFIG-INTERSESSION`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C14` — command sets OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA>, which forces runner-metadata.json::runtimeBuildSha to equal the candidate and auto-satisfies the R-CD-TOKEN pre-dispatch-build-identity-gate; the deployed SHA is then never independently observed

**`R-CW-1`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C10` — declared serialized but the prescribed run-proofs.sh command never invokes live-run-guard.mjs and takes no flock; only run-proof.sh (the fallback) enforces the lock
- `C12` — no both-forms statement and no named tool-form/token-form sibling; contract 8.2 makes single-surface coverage INCOMPLETE, not pass
- `C14` — command sets OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA>, which forces runner-metadata.json::runtimeBuildSha to equal the candidate and auto-satisfies the R-CD-TOKEN pre-dispatch-build-identity-gate; the deployed SHA is then never independently observed

**`R-CW-2`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C10` — declared serialized but the prescribed run-proofs.sh command never invokes live-run-guard.mjs and takes no flock; only run-proof.sh (the fallback) enforces the lock
- `C12` — no both-forms statement and no named tool-form/token-form sibling; contract 8.2 makes single-surface coverage INCOMPLETE, not pass
- `C13` — seat holds 10 serial-bound rows (round critical path)
- `C14` — command sets OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA>, which forces runner-metadata.json::runtimeBuildSha to equal the candidate and auto-satisfies the R-CD-TOKEN pre-dispatch-build-identity-gate; the deployed SHA is then never independently observed

**`R-CW-3`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C10` — declared serialized but the prescribed run-proofs.sh command never invokes live-run-guard.mjs and takes no flock; only run-proof.sh (the fallback) enforces the lock
- `C12` — no both-forms statement and no named tool-form/token-form sibling; contract 8.2 makes single-surface coverage INCOMPLETE, not pass
- `C13` — seat holds 10 serial-bound rows (round critical path)
- `C14` — command sets OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA>, which forces runner-metadata.json::runtimeBuildSha to equal the candidate and auto-satisfies the R-CD-TOKEN pre-dispatch-build-identity-gate; the deployed SHA is then never independently observed

**`R-CW-4`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C10` — declared serialized but the prescribed run-proofs.sh command never invokes live-run-guard.mjs and takes no flock; only run-proof.sh (the fallback) enforces the lock
- `C12` — no both-forms statement and no named tool-form/token-form sibling; contract 8.2 makes single-surface coverage INCOMPLETE, not pass
- `C13` — seat holds 10 serial-bound rows (round critical path)
- `C14` — command sets OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA>, which forces runner-metadata.json::runtimeBuildSha to equal the candidate and auto-satisfies the R-CD-TOKEN pre-dispatch-build-identity-gate; the deployed SHA is then never independently observed

**`R-CW-5`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C10` — process-local fixture described as a gateway "runner lock ... same target session"; contract 3.2 serializes on fixture resources (one invocation per seat, 0700 artifact dir, tracked-clean worktree); the 0700 gate is unstated
- `C12` — no both-forms statement and no named tool-form/token-form sibling; contract 8.2 makes single-surface coverage INCOMPLETE, not pass
- `C13` — seat holds 10 serial-bound rows (round critical path)

**`R-CW-5A`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C08` — artifact_subtree PROOFS/<SHA>/R-CW-5A/ is a bare row dir; validate-corpus.mjs no-orphan-row-dirs only tolerates artifacts/, gates/, _*; folding it into rows[] would make total_rows=38 and break the 35-row denominator
- `C09` — no breadcrumb/round-contract/triage-template link; no breadcrumb row exists for this support entry
- `C12` — static validator: both-forms role not stated, sibling not named
- `C13` — seat holds 10 serial-bound rows (round critical path)

**`R-CW-6`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C10` — process-local fixture described as a gateway "runner lock ... same target session"; contract 3.2 serializes on fixture resources (one invocation per seat, 0700 artifact dir, tracked-clean worktree); the 0700 gate is unstated
- `C12` — no both-forms statement and no named tool-form/token-form sibling; contract 8.2 makes single-surface coverage INCOMPLETE, not pass
- `C13` — seat holds 10 serial-bound rows (round critical path)

**`R-CW-6A`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C08` — artifact_subtree PROOFS/<SHA>/R-CW-6A/ is a bare row dir; validate-corpus.mjs no-orphan-row-dirs only tolerates artifacts/, gates/, _*; folding it into rows[] would make total_rows=38 and break the 35-row denominator
- `C09` — no breadcrumb/round-contract/triage-template link; no breadcrumb row exists for this support entry
- `C12` — static validator: both-forms role not stated, sibling not named
- `C13` — seat holds 10 serial-bound rows (round critical path)

**`R-CW-7`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C12` — static validator: both-forms role not stated, sibling not named
- `C13` — substitution: catalog suggests ronan-dgx, plan assigns emeric-nuc (emeric); contract 1 requires substitutions be named and justified

**`R-CW-DELEGATE-CHILD-LIVE`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C12` — static validator: both-forms role not stated, sibling not named
- `C13` — substitution: catalog suggests ronan-dgx, plan assigns emeric-nuc (emeric); contract 1 requires substitutions be named and justified

**`R-CW-DELEGATE-SELF-CONTINUATION`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C10` — declared serialized but the prescribed run-proofs.sh command never invokes live-run-guard.mjs and takes no flock; only run-proof.sh (the fallback) enforces the lock
- `C12` — no both-forms statement and no named tool-form/token-form sibling; contract 8.2 makes single-surface coverage INCOMPLETE, not pass
- `C13` — seat holds 10 serial-bound rows (round critical path)
- `C14` — command sets OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA>, which forces runner-metadata.json::runtimeBuildSha to equal the candidate and auto-satisfies the R-CD-TOKEN pre-dispatch-build-identity-gate; the deployed SHA is then never independently observed

**`R-CW-DELEGATE-TOKEN`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C12` — static validator: both-forms role not stated, sibling not named
- `C13` — substitution: catalog suggests ronan-dgx, plan assigns emeric-nuc (emeric); contract 1 requires substitutions be named and justified

**`R-CW-MULTI-COLLAPSE`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C12` — static validator: both-forms role not stated, sibling not named
- `C13` — substitution: catalog suggests ronan-dgx, plan assigns emeric-nuc (emeric); contract 1 requires substitutions be named and justified

**`R-CW-MULTI`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C12` — static validator: both-forms role not stated, sibling not named
- `C13` — substitution: catalog suggests ronan-dgx, plan assigns emeric-nuc (emeric); contract 1 requires substitutions be named and justified

**`R-CW-TOKEN`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C10` — declared serialized but the prescribed run-proofs.sh command never invokes live-run-guard.mjs and takes no flock; only run-proof.sh (the fallback) enforces the lock
- `C12` — no both-forms statement and no named tool-form/token-form sibling; contract 8.2 makes single-surface coverage INCOMPLETE, not pass
- `C13` — seat holds 10 serial-bound rows (round critical path)
- `C14` — command sets OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA>, which forces runner-metadata.json::runtimeBuildSha to equal the candidate and auto-satisfies the R-CD-TOKEN pre-dispatch-build-identity-gate; the deployed SHA is then never independently observed

**`R-OBS-1`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C14` — command sets OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA>, which forces runner-metadata.json::runtimeBuildSha to equal the candidate and auto-satisfies the R-CD-TOKEN pre-dispatch-build-identity-gate; the deployed SHA is then never independently observed

**`R-OBS-2`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced

**`R-OBS-STATUS`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C13` — substitution: catalog suggests elliott-legion, plan assigns rune-rog-ally (rune); contract 1 requires substitutions be named and justified

**`R-RC-1`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C10` — declared serialized but the prescribed run-proofs.sh command never invokes live-run-guard.mjs and takes no flock; only run-proof.sh (the fallback) enforces the lock
- `C13` — seat holds 10 serial-bound rows (round critical path)
- `C14` — command sets OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA>, which forces runner-metadata.json::runtimeBuildSha to equal the candidate and auto-satisfies the R-CD-TOKEN pre-dispatch-build-identity-gate; the deployed SHA is then never independently observed

**`R-RC-2`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced
- `C10` — body declares "Same-session concurrency safe: true" against SAFETY-ROWS.md Guardrails 1-2 and round-contract 3.3 which rule R-RC-* serialized fail-closed; R-RC-1-first ordering and human confirmation are absent; live-run-guard cannot lock it because r-rc-2.json declares sameSessionConcurrencySafe:true
- `C13` — seat holds 10 serial-bound rows (round critical path)
- `C14` — command sets OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA>, which forces runner-metadata.json::runtimeBuildSha to equal the candidate and auto-satisfies the R-CD-TOKEN pre-dispatch-build-identity-gate; the deployed SHA is then never independently observed

**`R-REGRESSION-TRAP-TESTS`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced

**`R-TRACE-REDACTION-1121`**
- `C05` — no G1-G5 block; contract 4 requires it be run and pasted pre-fire
- `C09` — no breadcrumb/round-contract/triage-template link; breadcrumb row exists but is unreferenced

---

## 8. Non-blocking mechanical corrections

### `MC-13` — Normalise titles to the contract template format

**Applies to:** 38 issue(s)

**Why.** The issue template mandates `[P86] <ROW-ID> - <one-line behavior> (<seat>)`; the plan uses `[Project 86] <ROW-ID>: <behavior>` with no seat.

### `MC-14` — Add wave, reviewer sign-off and the completion checklist

**Applies to:** 38 issue(s)

**Why.** The template ends with a 19-item completion checklist plus Wave assignment and a reviewer-not-the-prince sign-off. Without it there is no per-issue exit gate, and project 86 has no Row/Seat/Wave custom fields (verified read-only: 13 fields, none of them Row/Seat/Wave), so this identity can only live in the body.

### `MC-15` — R-OBS-1: pre-check the tool inventory that failed it last round

**Applies to:** 1 issue(s): `R-OBS-1`

**Why.** R-OBS-1 is the one reference-corpus `fail`, caused by a disposable session whose effective policy denied `session_status` (docs issue #439). The body carries no warning and no pre-check, so the round is set up to reproduce a known avoidable failure on its one already-failing row.

### `MC-16` — R-CD-3: mandate the dedicated disposable session

**Applies to:** 1 issue(s): `R-CD-3`

**Why.** R-CD-3 is the post-compaction lifeboat row and can trigger compaction, which per SAFETY-ROWS.md 1 holds a session-write-lock. Its manifest says sameSessionConcurrencySafe:true and the body only hedges "use a disposable/isolated session when the row can compact", which is a preference, not a rule.

### `MC-17` — Resolve <FINAL_CANDIDATE_SHA> exactly once, mechanically

**Applies to:** 38 issue(s)

**Why.** plan.candidate_sha is null. The token appears 310 times across the 38 bodies and 38 more times in artifact_subtree (348 sites). It is a single unambiguous literal with no partial-word collisions, so substitution is safe and verifiable. evidence-writer.mjs rejects any non-40-char lowercase SHA, and validate-corpus requires capture_sha == directory name.

**Procedure.** 1. Freeze the candidate. 2. Assert `[[ "$SHA" =~ ^[0-9a-f]{40}$ ]]`. 3. Set `plan.candidate_sha`. 4. `python3 -c` byte substitution of the literal `<FINAL_CANDIDATE_SHA>` -> `$SHA` over `rows[].body`, `rows[].title` and `rows[].artifact_subtree`. 5. Assert zero residual occurrences of `<FINAL_CANDIDATE_SHA>` and exactly 348 occurrences of `$SHA`. 6. Leave `<SEAT>`, `<SESSION_KEY>`, `<EXACT_CANDIDATE_WORKTREE>`, `<EMPTY_PRIVATE_ARTIFACT_DIR>`, `<FEATURE_SOURCE_PATH>`, `<FEATURE_MARKER>` unsubstituted - those are per-seat runtime values.

### `MC-14` block — appended verbatim to every body

This is the literal text `MC-14` appends. It is the completion checklist from
`analysis/project86-proof-issue-template.md:325-347`, plus the `Wave` and reviewer lines that
have nowhere else to live (project 86 has no `Row`/`Seat`/`Wave` custom fields).

````markdown
## Wave

Wave: `<0 harness | 1 critical-first | 2 parallel bulk | 3 serialized tail>`
Reviewer (must not be the row prince): `<PRINCE>`

## Completion checklist

- [ ] Project 86 `Status` walked `Todo` -> `in_coding_agent` -> `In Progress` -> `prince_review`
- [ ] Pre-fire identity gate G1-G5 pasted into this issue; G2 == G1; G3 > 0
- [ ] `seat-readiness.json` is `PASS-candidate`
- [ ] Same-session lock guard run (or row is documented concurrency-safe)
- [ ] Row fired **exactly once**; any prior attempt is a ledgered mechanically-proven non-fire
- [ ] Both-forms mandate satisfied, or explicitly N/A with the sibling row named
- [ ] Token-surface provenance recorded (raw final text vs message-tool body)
- [ ] All required receipts present and byte-readable; none promised
- [ ] Tempo trace JSON captured (or trace debt stated honestly and the row is not `pass`)
- [ ] Bounded, redacted gateway journal captured (or debt intentionally retained as PARTIAL)
- [ ] `EVIDENCE.md` carries the explicit "no secrets" line
- [ ] No secrets anywhere in artifacts, commits, or this issue; no stale `pending_push` /
      `upload-blame` / `TODO-UPLOAD` tokens
- [ ] `node tools/k6-proofs/scripts/validate-corpus.mjs --sha <FINAL_CANDIDATE_SHA>` output pasted
- [ ] Artifacts committed direct to `main` under this issue's declared destination only
- [ ] Zero edits to `INDEX.json`, `proofs-manifest.json`, or corpus-root docs
- [ ] Proposed state stated here: `pass` / `partial` / `thin` / `fail` / `honest_limit`, with reasons
- [ ] Regression issue opened and linked, if applicable
- [ ] Reviewer (not the row prince) signed off
- [ ] Scribe folded the row; `validate-corpus.mjs --index` exit 0 pasted
- [ ] Status set to `Done` (or `swim` with the blocking issue named)
````

> **Appended verbatim to every body. For the 3 support entries (preflight, R-CW-5A, R-CW-6A) drop the 'validate-corpus.mjs --sha' and 'Scribe folded the row' lines: they are not corpus rows and are never folded into rows[].**

---

## 9. Blockers vs non-blocking follow-ups

### 9.1 Blockers — an issue created without these is contradictory or unsafe

| ID | Blocker | Issues affected |
| --- | --- | ---: |
| `MC-01` | Stop pre-attesting the deployed runtime SHA | 23 |
| `MC-02` | Make the disposable session mechanical, not aspirational | 23 |
| `MC-03` | Restore fail-closed same-session serialization | 18 |
| `MC-04` | Add the pre-fire identity gate G1-G5 to every issue | 38 |
| `MC-05` | Retarget support/companion artifact subtrees out of the corpus row namespace | 3 |
| `MC-06` | Declare the non-corpus status of the three support entries | 3 |
| `MC-07` | R-RC-2 must be serialized fail-closed and ordered after R-RC-1 | 1 |
| `MC-08` | R-RC-1 carries the family ordering obligation | 1 |
| `MC-09` | R-CW-5 / R-CW-6 serialize on fixture resources, not on a gateway session | 2 |
| `MC-10` | Name the accountable prince instead of inviting a claim | 38 |
| `MC-11` | State the both-forms mandate and name the sibling row | 38 |
| `MC-12` | Link the governing contract, template and breadcrumbs | 38 |

### 9.2 Non-blocking follow-ups — file them, do not gate creation on them

| ID | Follow-up |
| --- | --- |
| `FU-01` | **File a docs issue to reconcile manifests/r-rc-2.json with SAFETY-ROWS.md** — The manifest declares sameSessionConcurrencySafe:true and requiresHumanConfirmation:false for a state-mutating compaction row. SAFETY-ROWS.md Guardrails 1/2/5 require the opposite. MC-07 works around it procedurally; the manifest itself still needs fixing so live-run-guard.mjs can enforce it mechanically. Round contract 15.1 already asks for this. |
| `FU-02` | **Catalog data defect: R-CD-4 suggested_owner_seat_class is the bare name "rune"** — Every other row cites a canon seat name (cael-dgx, ronan-dgx, silas-lothric, elliott-legion, emeric-nuc, rune-rog-ally). R-CD-4 cites "rune". Normalise to rune-rog-ally in the catalog. |
| `FU-03` | **R-REGRESSION-TRAP-TESTS halt scope disagrees between catalog and breadcrumbs** — The breadcrumbs classify its haltScope as "all-proofs" ("a failing shared regression trap invalidates the assembly baseline"), and R-CONFIG-DEFAULTS as "all-continuation-proofs". The catalog gives both the generic "this row or its directly affected continuation family". The divergence is in the safe direction (it cannot cause a wrongful fleet halt) but it means a genuine baseline invalidation has no declared escalation path in the issue body. |
| `FU-04` | **command_source citation is looser than the instantiated command** — 23 rows cite PROOF-RUN-METHOD.md:95-109 as the source. Those lines do document the row-list live form, but as `./scripts/run-proofs.sh R-CD-2,R-CD-4 <sha>` with OPENCLAW_GATEWAY_WS, OPENCLAW_GATEWAY_TOKEN and both disposable-session variables, and without --live or OPENCLAW_RUNTIME_BUILD_SHA. --live is a real flag (run-proofs.sh line 72) so the command executes, but the citation should be widened or the command aligned. MC-01/MC-02 close the material part of the gap. |
| `FU-05` | **Breadcrumbs are bound to assembly SHA b134a64a…, not to the final candidate** — If <FINAL_CANDIDATE_SHA> != b134a64a44351bcbce2d086da4ac30a596c01699, symbol and test paths in the breadcrumbs may drift. The document already declares itself triage assistance and not a behavioral verdict; record the delta in issue #451 when the candidate is frozen. |
| `FU-06` | **Workflow-dispatch rung A1 points at a different repository than the committed workflow** — The issue template A1 block runs `gh workflow run project81-k6-proof.yml --repo karmaterminal/openclaw-bootstrap`, while `.github/workflows/project81-k6-proof.yml` also exists in karmaterminal-openclaw-docs at the docs base. No planned body uses rung A1, so this does not block creation, but the ladder should name the authoritative copy. |
| `FU-07` | **Six assignments diverge from the catalog-suggested seat without a substitution record** — R-CD-4 (suggested rune -> emeric); R-CW-7, R-CW-DELEGATE-CHILD-LIVE, R-CW-DELEGATE-TOKEN, R-CW-MULTI, R-CW-MULTI-COLLAPSE (suggested ronan-dgx -> emeric); R-OBS-STATUS (suggested elliott-legion -> rune). All seven are defensible - six are offline static rows and the moves relieve ronan - but round contract 1 requires substitutions to be named. MC-10 records the accountable prince; the substitution rationale still needs a line in each issue. |
| `FU-08` | **Emeric is not in the reference corpus dispatch_allocation** — The reference manifest allocates cael 8, elliott 8, ronan 16, rune 1, silas 2 - no emeric. Emeric held the independent read-only reconciliation arm. Giving emeric six rows is a sound rebalance, but the scribe must then name a different independent reviewer for emeric's rows and confirm the round still has a non-firing reconciliation arm. |
| `FU-09` | **Project 86 already contains three items** — Read-only check: project 86 holds issue #451 (In Progress), issue #1423 (in_coding_agent) and PR #1425 (Todo). After creation the project must contain exactly 41 items, of which 38 are the new proof issues. Post-create verification must use that number, not 38. |

---

## 10. Assignment, workload and rebalance

### 10.1 As planned

Serial-bound = rows that cannot overlap another row on the same seat/session, using the
contract-corrected classification (19 manifest `sameSessionConcurrencySafe:false` rows, plus
`R-RC-2` forced serialized by round contract §3.3). Serial-bound load, not row count, is what
determines the round's critical path.

| Prince | Seat | Total | Serial-bound | live k6 | fixture | static | support |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| ronan | `ronan-dgx` | 13 | **10** | 9 | 2 | 2 | 0 |
| cael | `cael-dgx` | 8 | **6** | 6 | 0 | 2 | 0 |
| silas | `silas-lothric` | 2 | **2** | 2 | 0 | 0 | 0 |
| emeric | `emeric-nuc` | 6 | **1** | 1 | 0 | 5 | 0 |
| elliott | `elliott-legion` | 7 | **1** | 4 | 0 | 3 | 0 |
| scribe | `(scribe)` | 1 | **0** | 0 | 0 | 0 | 1 |
| rune | `rune-rog-ally` | 1 | **0** | 0 | 0 | 1 | 0 |

**Ronan holds 10 of the 20 serial-bound rows** — five times Silas, ten times Elliott — plus both
isolated fixtures, plus the entire ordered compaction tail (`R-RC-1 → R-RC-2`), plus both static
companions. Ronan is the round's single-seat critical path and its single point of failure. This is
the reference round's shape repeating: that manifest allocated `ronan 16 / cael 8 / elliott 8 /
silas 2 / rune 1`, and the round contract opens by describing that round as *"the failure mode
written down"*. Two structural notes fall out of the same comparison: the reference
`dispatch_allocation` has **no emeric** (he held the independent read-only reconciliation arm), and
seven of the plan's assignments diverge from the catalog's suggested seat without a substitution
record.

### 10.2 Recommended rebalance — six moves, all within the documented seat class

| Row | From | To | Why it is safe |
| --- | --- | --- | --- |
| `R-CW-2` | ronan | silas | generic "gateway operator seat with a coordinated disposable session"; silas-lothric already runs R-CD-1/R-CW-1 |
| `R-CW-3` | ronan | silas | same generic seat class; keeps the R-CW-1/2/3 tool-form cluster on one seat |
| `R-CW-4` | ronan | emeric | same generic seat class; emeric-nuc holds only one live row |
| `R-CW-DELEGATE-SELF-CONTINUATION` | ronan | emeric | same generic seat class; pairs with emeric's existing delegate static rows |
| `R-CW-5A` | ronan | rune | offline static validator, no gateway session, no hardware demand — safe on rune-rog-ally |
| `R-CW-6A` | ronan | rune | offline static validator, no gateway session, no hardware demand — safe on rune-rog-ally |

Deliberately **not** moved: `R-CW-5`/`R-CW-6` stay on `ronan-dgx` (they need a clean exact-candidate
worktree and a pinned `pnpm install --frozen-lockfile` in a disposable worktree — a source-capable
seat requirement); `R-RC-1`/`R-RC-2` stay together on one seat because SAFETY-ROWS.md fixes their
order; `R-CW-TOKEN` stays on `ronan-dgx`, its documented light-context subagent-capable seat;
`R-CD-TOKEN` stays on `elliott-legion`, its documented raw-final-text scanner-capable seat (the
runner hard-gates that row on `seat.class == "raw-final-text"`). Nothing live is moved onto
`rune-rog-ally`, whose handheld class is only given offline static work.

### 10.3 After rebalance

| Prince | Seat | Total | Serial-bound | live k6 | fixture | static | support |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| cael | `cael-dgx` | 8 | **6** | 6 | 0 | 2 | 0 |
| ronan | `ronan-dgx` | 7 | **6** | 5 | 2 | 0 | 0 |
| silas | `silas-lothric` | 4 | **4** | 4 | 0 | 0 | 0 |
| emeric | `emeric-nuc` | 8 | **3** | 3 | 0 | 5 | 0 |
| elliott | `elliott-legion` | 7 | **1** | 4 | 0 | 3 | 0 |
| scribe | `(scribe)` | 1 | **0** | 0 | 0 | 0 | 1 |
| rune | `rune-rog-ally` | 3 | **0** | 0 | 0 | 3 | 0 |

Peak serial-bound load drops from **10 to 6** and the round no longer has a single-seat critical
path. Totals are unchanged at 38.

---

## 11. Final recommended issue count and denominator language

**Recommended issue count: 38. Unchanged.** The count is correct; what was wrong was that the
three non-corpus issues were pointed at corpus row directories.

Publish this on issue #451 **before Wave 1**, verbatim (round contract §15.2 and
`PROOF-RUN-METHOD.md` §1 both require the round to declare its denominator up front):

> Project 86 dispatches **38 issues**. Exactly **35** of them are exact-SHA corpus rows: they are
> the sole membership of `PROOFS/<SHA>/proofs-manifest.json::required_rows` and `rows[]`, and the
> sole input to `INDEX.json::rollup`, whose `total_rows` is **35**. The other **3** issues are
> coordination/support and are never folded into `rows[]` and never counted in any rollup:
> `preflight` (seat readiness, support class) and the manifest-only static companions `R-CW-5A`
> and `R-CW-6A`, whose verdict contract forbids a runtime `PASS` and whose output is
> `construct-only`. **The corpus denominator for project 86 is 35.** The `36` and `34` produced by
> `list-runnable-rows.mjs --all` and `--live-suite` are runner selectors and must never be
> published as the round denominator. `R-CW-ACTIVE-OVERLAP` and
> `R-CONTINUATION-MIXED-SURFACE-FANOUT` are defined in `RUNBOOKS/PROOF-CORPUS-METHOD.md` but have
> no manifest and no scenario; they are explicitly **out of scope** for this round and are not
> counted in either number.

Phrase every progress report as *"N of 35 corpus rows"*. Never *"N of 38"*.

---

## 12. Pre-create checklist

1. [ ] Freeze the candidate SHA; assert 40-char lowercase hex; record it on issue #451 and set plan.candidate_sha.
2. [ ] Run G3 once round-wide for the chosen candidate (feature-presence probe). If it returns 0, do not create any issue - the pin is wrong.
3. [ ] Apply MC-01 through MC-12 (blockers) to the plan JSON, then MC-13 through MC-16.
4. [ ] Apply MC-17 (<FINAL_CANDIDATE_SHA> substitution) LAST; assert 0 residual tokens and 348 substituted sites.
5. [ ] Re-run the reconciliation asserts: 38 rows, 35 with reference_required true, 3 support entries, no duplicate row ids, no duplicate manifest paths.
6. [ ] Assert no body still contains the strings "OPENCLAW_RUNTIME_BUILD_SHA=" or "Live assignment: none".
7. [ ] Assert every serialized row body contains "live-run-guard.mjs", and that R-RC-2 no longer says "Same-session concurrency safe: **true**".
8. [ ] Assert all three support bodies contain "_static-companions" or "gates/preflight" and the "Not a corpus row" clause.
9. [ ] Assert all 38 bodies contain "G1 ok", "seat-readiness-preflight.mjs", "Both-forms mandate", "project86-proof-code-breadcrumbs" and "project86-regression-triage-template".
10. [ ] Seed C0 first: create PROOFS/<SHA>/ with README.md, METHOD.md, RESOLVED-SHA.md, ARTIFACTS.md and a seed proofs-manifest.json listing all 35 required rows at state "missing", plus required_rows[] and dispatch_allocation; point INDEX.json at the new SHA; confirm validate-corpus.mjs --index exits 0 with missing = total_rows = 35.
11. [ ] Reconcile every assignee against the seeded proofs-manifest.json::dispatch_allocation - not the catalog owner table, not this report. If they conflict, stop dispatch and repair the corpus first.
12. [ ] Record the six rebalance moves and the seven seat substitutions as explicit substitution notes; name a non-firing independent reviewer for emeric's rows.
13. [ ] Confirm no credential, session key, nonce or private filesystem path appears in any body; the only permitted token forms are the bare variable name and ***.
14. [ ] Confirm project 86 currently holds 3 items so the post-create expectation is 41.
15. [ ] Open Wave 1 issues only (one live row per participating seat); hold Wave 2 in Todo until every Wave 1 row clears prince_review.

---

## 13. Post-create verification checklist

1. [ ] Assert exactly 38 new issues exist in karmaterminal/karmaterminal-openclaw-docs, one per row id, no duplicates: gh issue list --search "[P86]" --limit 100 --json number,title.
2. [ ] Assert every created issue body is byte-identical to the corrected plan row body (hash each body and compare to sha256 of plan.rows[].body).
3. [ ] Assert project 86 holds 41 items total (3 pre-existing + 38 new) and that all 38 new items are at Status = Todo.
4. [ ] Assert each of the 38 issues has exactly one assignee and that the assignee set matches the recommended allocation: ronan 7, cael 8, elliott 7, emeric 8, silas 4, rune 3, scribe 1.
5. [ ] Assert each issue is linked to umbrella #451.
6. [ ] Assert zero issue bodies contain "<FINAL_CANDIDATE_SHA>", "OPENCLAW_RUNTIME_BUILD_SHA=", "Live assignment: none", or a 40-char hex string other than the frozen candidate and the reference corpus SHA 4c235d8c1997e8964160117f8d6bf650ad1e8203 and docs base abe1f9f0749d849b01da4e5d354c205ecffac946.
7. [ ] Assert the 35 corpus issues name a Row-owned destination under PROOFS/<SHA>/<ROW-ID>/ and that the 3 support issues do not.
8. [ ] Secret-scan all 38 created bodies for token/bearer/authorization/session_key material; expect zero hits beyond bare variable names.
9. [ ] Re-run and paste: node tools/k6-proofs/scripts/check-manifest-scenarios.mjs; check-scenario-alignment.mjs; check-proof-row-manifests.mjs; validate-corpus.mjs --index. All must be green before Wave 1 fires.
10. [ ] Post the denominator statement verbatim on issue #451 before Wave 1, per PROOF-RUN-METHOD.md section 1 and round contract 15.2.

---

## 14. Acceptance mapping

| Acceptance criterion | Status |
| --- | --- |
| no issue created from contradictory or unsafe body | Satisfied only after MC-01..MC-12 are applied; before that, 38/38 bodies fail at least one blocker check. |
| corpus denominator stays distinct | Satisfied after MC-05 and MC-06 move preflight/R-CW-5A/R-CW-6A out of the row-dir namespace and declare their non-corpus status. |
| princes never touch shared manifests | Already satisfied: all 38 bodies carry the "do not edit PROOFS/INDEX.json or proofs-manifest.json" clause and a disjoint row-owned destination. |
| row local failure is never a fleet halt | Already satisfied: blocks_all_proofs is false on all 38 entries and all 38 carry "Continue independent proof rows unless the finding is explicitly classified as a halt-state." |
| generic context pressure is never completion | Already satisfied: all 38 carry the PARTIAL policy, and honest_limit is permitted on R-RC-2 only, gated on a nonce-bound rejected request_compaction toolResult with guard=context_threshold. |
| corrections are mechanically applicable | Satisfied: every correction is a literal find/replace, an anchored insert, or a single global substitution, specified against exact bytes. |
| no credentials or private session material in outputs | Satisfied: inputs and outputs scanned; only the literal env var NAME OPENCLAW_GATEWAY_TOKEN and *** placeholders appear, no values. |

---

## 15. Machine-readable companion

`analysis/project86-fold-readiness.json` (`frond-scribe.project86.fold-readiness.v1`) carries the
same content in applicable form: `mechanical_corrections[]` with literal `find`/`replace`,
`per_row` maps, anchors and insertion points; `issue_matrix[]` with all 14 checks per row;
`assignment.rebalance_moves[]`; `pre_create_checklist[]`; and
`post_create_verification_checklist[]`. Apply `MC-01 … MC-16` first and `MC-17` last.

No credential, token value, session key, nonce, prompt body or private filesystem path appears in
either output. The only token forms present are the bare environment-variable name
`OPENCLAW_GATEWAY_TOKEN` and the `***` placeholder.
