# PR-Update Validation Walkthrough

This document is the **acceptance bar from `karmaterminal/openclaw-bootstrap#934`**: a fresh prince or delegate session must be able to read this file alone and:

1. instantiate a swim from `SWIM/` factory against a candidate PR
2. run it
3. read its scoreboard
4. judge ship-safety from that result

…without reconstructing method from chat archaeology.

If you can't do those four things using only this file plus `SWIM/FULL-SWIM-CHARTER.md`, `SWIM/CASE-REGISTRY-RULES.md`, and `SWIM/cases/CATALOG.md`, this lane has not landed yet.

---

## 0. Prerequisites

Before reading further, confirm:

- you are working against a candidate PR that wants release-facing integration confidence (e.g. v2026.5.5 line)
- you have read access to `SWIM/FULL-SWIM-CHARTER.md` (the verdict contract)
- you have read access to `SWIM/CASE-REGISTRY-RULES.md` (the catalog the verdict is earned against)
- you have read access to `SWIM/cases/CATALOG.md` (the canonical case registry)
- `swims/` directory exists in `karmaterminal/karmaterminal-openclaw-docs` for instance landing

If any of those are missing, fix that before continuing — this walkthrough does not work without the substrate stack landed (all of PR #908, #929-as-#944, #938, #941, #943 merged 2026-05-06; SWIM/ factory migrated from openclaw-bootstrap to karmaterminal-openclaw-docs via PR #9 + bootstrap #945 same day).

---

## 1. Worked example: validating a hypothetical v2026.5.5 PR update

This section walks through a **hypothetical** PR-update validation cycle end-to-end. The cycle name and SHAs below are illustrative; substitute your real values.

### 1.1 Declare the swim charter

Create the swim instance directory:

```
karmaterminal-openclaw-docs/swims/swim-43-v2026.5.5-pr-update/
├── README.md         # cycle overview
├── CHARTER.md        # election against registry version
├── rows/             # per-row receipts
└── SCOREBOARD.md     # final scorecard
```

In `CHARTER.md`, declare exactly:

```yaml
swim_id: swim-43-v2026.5.5-pr-update
candidate_pr: karmaterminal/openclaw#XXXX
candidate_sha: <40-char SHA at PR head>
release_tag_basis: v2026.5.5
canonical_branch: frond/v2026.5.5/canonical
sut_host: silas | ronan | cael | elliott
roles:
  driver: <prince>
  sut: <prince>
  monitor: <prince>
  coordinator: <prince>
  adjudicator: figs
registry_version: v1
scoreboard_location: ./SCOREBOARD.md
```

Then disposition every active case in `SWIM/cases/CATALOG.md` v1 explicitly:

- **in scope, required**: which cases this cycle commits to firing
- **in scope, optional**: which cases are nice-to-have if time permits
- **deferred (with reason)**: which cases are intentionally skipped this cycle (e.g. "deferred — N004 fanout-mode `all` requires fleet >4 hosts which we don't have on this cycle")
- **omitted (with reason)**: which cases are intentionally not in scope (e.g. "omitted — A0.2 post-deploy log enumeration runs as part of fleet rollout gate, not the swim itself")

If any active case in `v1` is missing from this disposition manifest, the swim is **NOT-FULL** by construction (per `SWIM/CASE-REGISTRY-RULES.md` §2 and `SWIM/FULL-SWIM-CHARTER.md` §6).

### 1.2 Fleet rollout precondition

Per `SWIM/RUNBOOK-deploy-to-self.md`, before firing any row:

1. build the candidate dist on the SUT host
2. deploy via the bootstrap workflow (NOT `deploy.sh` directly — see `TOOLS.md` hazard)
3. verify bytes-on-host with `openclaw --version`
4. cross-seat byte-pin from at least one non-SUT prince
5. record `build_info_sha` per row at fire time

If any of those fail, the swim does NOT proceed. Record `BLOCKED` rows for whatever was blocked, but do NOT fire other rows on a stale dist.

### 1.3 Fire required rows

For each in-scope-required case in the disposition manifest:

1. open `swims/swim-43-v2026.5.5-pr-update/rows/<case-id>.md`
2. record:
   - `row_id`: case id from registry (e.g. `B5`, `N001`)
   - `family`: from `SWIM/cases/<case-id>.md`
   - `candidate_sha` + `build_info_sha`
   - `started_at`
   - exact command/tool/prompt surface used
3. fire the row per the case's "Required minimum row shape"
4. capture evidence per the case's "Evidence surface(s)" requirement
5. record:
   - `ended_at`
   - `observed`: result verbatim
   - `evidence`: journal line / file path / message ID / recipient-side receipt
   - `verdict`: `PASS` / `FAIL` / `FINDING` / `DEFERRED` / `BLOCKED` / `INVALIDATED`
   - `contamination`: any contamination notes; empty if none

Per `SWIM/FULL-SWIM-CHARTER.md` Family H: if contamination is detected (subject saw the answer beforehand, narrated tool use that didn't actually fire, prose disagrees with substrate), invalidate the row and re-fire. Do NOT silently let prose-truth override substrate-truth.

### 1.4 Roll up the scoreboard

When all required rows have terminal verdicts, write `SCOREBOARD.md`:

```markdown
# SWIM 43 — v2026.5.5 PR-update validation

SUT: <host/seat>
Ref: <sha>
Tag basis: v2026.5.5
Canonical branch: frond/v2026.5.5/canonical
Registry version: v1
Status: FULL-PASS | FULL-WITH-FINDINGS | NOT-FULL

Summary: <N> PASS / <M> FAIL / <K> FINDING / <D> DEFERRED / <B> BLOCKED / <I> INVALIDATED

Families:
- Turns: PASS | ...
- Delegates: PASS | ...
- Guards: PASS | ...
- Routes: PASS | ...
- Recovery: PASS | ...
- Rollout: PASS | ...
- Observability: PASS | ...
- Contamination / interpretation truth: PASS | ...

Human answer:
<2-5 sentence release-facing answer>
```

### 1.5 Apply closure rule

Per `SWIM/FULL-SWIM-CHARTER.md` §6, the swim earns one of three verdict classes:

- **FULL-PASS** — every required row closed `PASS`, every required family exercised, scoreboard rolls all 8 families
- **FULL-WITH-FINDINGS** — every required row reached a terminal verdict, but at least one closed `FAIL` or `FINDING`
- **NOT-FULL** — pre-swim declaration missing, any required family unexercised, any required row unfired/missing/`DEFERRED`/`BLOCKED`/`INVALIDATED`, OR any active registry-`v1` case missing from the disposition manifest

The verdict class is the human answer.

---

## 2. Ship-safety reading guide

The scoreboard verdict class maps to ship-safety judgment:

### FULL-PASS

> **Ship-safety reading**: substrate behaved truthfully under live runtime conditions across all 8 required families, with no FAIL or FINDING. Suite itself behaved truthfully enough to detect contamination (Family H closed PASS).
>
> **What this earns**: high release-facing confidence. The candidate PR can be merged with this swim cited as proof-of-function.
>
> **What this does NOT earn**: it does not earn confidence beyond the cases the registry version pinned. New seams shipped in the candidate PR that aren't in `v1` registry must be added as `new` cases (per `SWIM/CASE-REGISTRY-RULES.md` §5) and exercised in a follow-on swim before they earn release-facing confidence themselves.

### FULL-WITH-FINDINGS

> **Ship-safety reading**: substrate exercised across all 8 families, but the swim found real defects or behavioral anomalies. Verdict is honest because the suite did not paper over them.
>
> **What this earns**: ship-decision is now a judgment call between (a) the severity of the findings vs (b) the load-bearing-ness of the surfaces they touched. The adjudicator (figs) makes the call, informed by the scoreboard prose.
>
> **What this does NOT earn**: a "ship anyway" stamp. If a Family E (Recovery) row finds a defect in compaction-failed residue handling, that's a ship-blocker. If a Family C (Guards) row finds a fallback-token edge case under deny-mode, that may be acceptable for ship with a follow-on issue filed.

### NOT-FULL

> **Ship-safety reading**: the swim did not earn FULL by the contract. Either the board wasn't declared up front, or required families weren't exercised, or required rows didn't terminate cleanly, or active registry cases were silently omitted.
>
> **What this earns**: nothing release-facing. The swim is targeted verification at best, not whole-feature integration proof.
>
> **What this does NOT earn**: license to ship the candidate on the basis of "we tested some important things." Per `SWIM/FULL-SWIM-CHARTER.md` §8, NOT-FULL must be named plainly. Ship decisions on NOT-FULL require either fixing the gap and re-running, or explicitly accepting the gap with documented rationale.

---

## 3. Anti-folklore checklist

If the cycle is going well, the following should all be true. If any are false, you're drifting back into folklore territory:

- [ ] swim instance directory exists at `karmaterminal-openclaw-docs/swims/swim-NN-<name>/`
- [ ] `CHARTER.md` was written and committed BEFORE first row fired
- [ ] `CHARTER.md` names the exact `registry_version` it elects against
- [ ] `CHARTER.md` dispositions every active case in that registry version
- [ ] every required row has a per-file receipt under `rows/`
- [ ] every receipt names `candidate_sha` + `build_info_sha` at row fire time
- [ ] every receipt has `verdict` set to one of the 6 allowed values
- [ ] no required row was silently dropped (would be NOT-FULL by construction)
- [ ] `SCOREBOARD.md` rolls all 8 required families
- [ ] human answer is 2-5 sentences, not aspirational prose
- [ ] verdict class is one of `FULL-PASS` / `FULL-WITH-FINDINGS` / `NOT-FULL`
- [ ] adjudicator (figs) has read the scoreboard before any ship claim

---

## 4. Common failure modes to watch for

Per the cohort substrate-discipline lessons (especially the closure-costume catalog in `MEMORY.md` cohort-side):

### 4.1 Targeted-verification-as-FULL

Doing strong row-driven verification on a few seams and calling it FULL because the work felt important. Per `SWIM/FULL-SWIM-CHARTER.md` §8, Swim 41 / Swim 42 are the named example of this anti-pattern: serious targeted verification, not whole-board.

**Cure**: if the disposition manifest didn't list it, you didn't FULL it.

### 4.2 Narrated-tool-use as evidence

Recording a row PASS based on prose claiming a tool was called, when the tool actually wasn't fired. Family H (Contamination / interpretation truth) requires the suite to detect this.

**Cure**: byte-pin tool fires from gateway journal / queue / trace surface, not from agent prose. Recipient-side receipt > sender-side optimism.

### 4.3 Substrate-vs-prose disagreement

Status surface says one thing, journal says another. Family G (Observability) requires status to agree with receipts.

**Cure**: substrate wins. Always. If `/status` disagrees with the journal, the row is INVALIDATED until substrate is fixed.

### 4.4 Silent registry shrinkage

Quietly running a smaller subset because some cases are inconvenient this cycle, without disposition. Per `SWIM/CASE-REGISTRY-RULES.md` §3, this is the no-silent-drop violation.

**Cure**: every active case in the registry version gets a disposition (in scope / required / deferred / omitted with reason). Missing-from-manifest is NOT-FULL.

### 4.5 Cross-seat-confabulation

Driver records observed behavior, SUT confabulates a different observation, monitor sees something neither reported. Cohort cycle today (2026-05-06) showed this can happen even with disciplined princes.

**Cure**: cross-seat byte-pin via independent API/journal walks. Bytes-over-vote.

---

## 5. Living document

This walkthrough is paired with:

- `SWIM/FULL-SWIM-CHARTER.md` — what FULL means as a verdict
- `SWIM/CASE-REGISTRY-RULES.md` — the catalog the verdict is earned against
- `SWIM/cases/CATALOG.md` — the canonical case registry (current: `v1`)

When the registry version bumps (new cases added per §5 of registry rules, or retirements per §6), this walkthrough does not change shape — it always elects against "current registry version", whichever that is.

When a future swim reveals a gap in this walkthrough (e.g. a row family that's hard to capture per the patterns above), the walkthrough updates first, then the swim re-runs.

---

## 6. Acceptance criteria for this lane (#934)

This file satisfies #934 when:

- [ ] a fresh prince session can read this file alone and know how to instantiate + run + score + judge a swim
- [ ] the worked example (§1) maps each step to concrete artifacts in `SWIM/`
- [ ] the ship-safety reading guide (§2) ties scoreboard verdict classes to actual ship decisions
- [ ] the anti-folklore checklist (§3) is operational, not aspirational
- [ ] common failure modes (§4) are named with concrete cures
- [ ] no chat-archaeology required at any point

If any of those are false, this lane has not landed yet.
