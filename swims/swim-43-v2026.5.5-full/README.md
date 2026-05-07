# swim-43 v2026.5.5 FULL — declaration

**Project**: [karmaterminal Project 67 — SEAL-BOY 🌊🩲💦 SWIM 43](https://github.com/orgs/karmaterminal/projects/67)
**Spine**: `karmaterminal/openclaw-bootstrap#915` (parent #907)
**Charter**: `SWIM/FULL-SWIM-CHARTER.md`
**Registry**: `SWIM/cases/CATALOG.md` v1
**Status**: DECLARED — pre-fire

---

## Substrate declaration

- **Swim ID**: `swim-43-v2026.5.5-full`
- **Candidate branch**: `frond/v2026.5.5/canonical`
- **Exact commit SHA**: `24b76bf` (per `ssh cael "openclaw --version"` returning `OpenClaw 2026.5.5 (24b76bf)`)
- **Release tag basis**: `v2026.5.5`
- **Canonical branch name**: `frond/v2026.5.5/canonical`
- **SUT host**: `cael-host` (deployed v5.5 verified at `OpenClaw 2026.5.5 (24b76bf)`)
- **SUT seat/channel**: `agent:main:discord:channel:1466192485440164011` (cael-seat in #sprites-of-thornfield)

## Fixed roles per SWIM-METHODOLOGY.md lines 9-19

- **Driver / Test Administrator**: Ronan 🌊 (this prince)
- **SUT / Subject Under Test**: Silas 🌫 (canary box per canon — but cohort byte-walks today firing from cael-host show v5.5 deployed there too; SUT determination per spine #915 wants real-host-with-mixed-evidence)
- **Coordinator / Deployer**: Cael 🩸 (builds + deploys + verifies dist)
- **Monitor**: Elliott 🌻 (independent SSH evidence collection)
- **Adjudicator**: figs

## Scoreboard

`swims/swim-43-v2026.5.5-full/SCOREBOARD.md` (TBD this PR)

## Per-case disposition manifest

Per `CASE-REGISTRY-RULES.md` §2: every active case in registry v1 must be dispositioned (in scope / required / deferred / omitted with reason). 56 active cases total in `SWIM/cases/`.

### Family A (registry block A) — maps to multiple modern families per FULL-SWIM-CROSSWALK.md

| Case | Title | Modern family | Disposition | Reason |
|---|---|---|---|---|
| A0 | Fleet feature-flag parity (precondition gate) | Rollout | **required** | precondition for any downstream row; cohort already on v5.5 SHA `24b76bf` per `ssh cael 'openclaw --version'` so flag-parity-by-deploy-version satisfied; needs explicit cross-seat byte-confirmation of flag state pre-row-1 |
| A0.2 | Post-deploy log enumeration & categorization (precondition) | Rollout | **required** | precondition; substrate-knowledge in L-v5.5-journal-vocabulary lesson already documents v5.5 anomaly categories (log.info-from-scheduler not surfacing) |
| A1 | Flow registry + per-agent sessions persistence across restart | Turns | **required** | core Turns substrate-truth; needs explicit fire-restart-verify cycle on cael-host SUT with cross-seat attestation |
| A2 | continuationChainCount / continuationChainTokens accounting | Guards | **required** | core Guards budget-truth; needs chain-fire at known depth + fanout-fire at known recipient count |
| A3 | delegatePendingFlags derivation from TaskFlow (post-Bug-A) | Delegates | **required** | post-Bug-A regression-protection; needs stage-pending + restart + verify-derivation cycle |
| A4 | TaskFlow delegate-store lifecycle (create → read → consume → expire) | Turns | **required** | core Turns lifecycle-truth; janitor-expire-path needs explicit verification |
| A5 | Timer arm / disarm / dispose (no leaks, no double-fire) | Turns | **required** | core Turns timer-correctness; cancellation path + single-fire path both need verification per RFC §6.7 |

### Family B (registry block B)

| Case | Title | Modern family | Disposition | Reason |
|---|---|---|---|---|
| B1 | F1 clean continue_work (no inbound noise) | Turns | **required** | core Turns clean-fire baseline; quiet-channel single-fire verification |
| B2 | F2 noisy continue_work (inbound during reservation) | Turns | **required** | core Turns reservation-vs-fold semantics; never-both invariant |
| B3 | F3 clean continue_delegate (quiet room) | Delegates | **required** | core Delegates default-mode lifecycle; spawn+return+announce |
| B4 | F4 noisy continue_delegate (inbound during delay) | Delegates | **required** | core Delegates noisy-channel correctness; no-loss-no-double under inbound |
| B5 | F5 silent-wake via continue_delegate | Delegates | **required** | core Delegates silent-wake mode; silent-return + subsequent-turn-fire both verified |
| B6 | F6 back-to-back scheduling (two delegates same turn) | Delegates | **required** | core Delegates concurrency; race-free arm + independent fire + return |
| B7 | F7 subagent-announce path — ghost-wake / stale-wake | Delegates | **required** | regression-protection per RFC §3.4; graceful handling not crash/double-emit |
| B8 | F8 post-compaction delegate survival | Recovery | **required** | core Recovery substrate; pre-compaction stage + post-compaction execute in successor |

(continues for C / D / E / N / X — all 56 cases need disposition; this skeleton lists structure, full disposition follows in subsequent commits as Driver reads each case file + makes disposition call)

## Declared row inventory

To be populated after per-case disposition completes. Each `required` case maps to one row file under `swims/swim-43-v2026.5.5-full/rows/`.

## Current execution status

- ☑ Substrate declared (this file)
- ☐ Per-case disposition complete for all 56 active cases
- ☐ Required row files authored (one per `required` case)
- ☐ Scoreboard populated
- ☐ Row execution begun
- ☐ Closure verdict published (`FULL-PASS` / `FULL-WITH-FINDINGS` / `NOT-FULL`)

## Notes on prior cohort meta-coordination

Earlier today (2026-05-07 morning), cohort spent ~6 hours debating whether to instantiate `swims/swim-43/` retroactively after running pseudo-rows in chat. Cohort 4-of-4 voted close-as-never-existed per silas's rule-grandfathering argument. That vote was overtaken by figs's direct adjudication at msg `1501985085...` *"you are executing an integration test... you should be executing the highest numbered project in karmaterminal org with SWIM in the title (i believe 67)"* — project 67 IS SWIM 43. figs-as-Adjudicator override per role-canon. Declaring swim-43 NOW per #915 spine + project 67 board state.

Substrate-knowledge from morning's cohort byte-walks (v5.5 journal-vocabulary divergence between code-source and substrate-emission, layer-split between journal vs agent-context-injection) lives at `SWIM/lessons/L-v5.5-journal-vocabulary.md`. Worked example using new template lives at `SWIM/templates/worked-examples/continuation-delayed-self-election/`. Both inform row-authoring for this swim.
