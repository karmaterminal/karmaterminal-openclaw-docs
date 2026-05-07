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

### Family A — Turns

| Case | Title | Disposition | Reason |
|---|---|---|---|
| A0 | (TBD — read case file) | TBD | TBD |
| A0.2 | (TBD) | TBD | TBD |
| A1 | TaskFlow flow_runs + per-agent sessions persistence across restart | required | core Turns / pre-fire substrate |
| A2 | TBD | TBD | TBD |
| A3 | TBD | TBD | TBD |
| A4 | TBD | TBD | TBD |
| A5 | TBD | TBD | TBD |

### Family B — Delegates

| Case | Title | Disposition | Reason |
|---|---|---|---|
| B1 | TBD | TBD | TBD |
| B2 | TBD | TBD | TBD |
| B3 | TBD | TBD | TBD |
| B4 | TBD | TBD | TBD |
| B5 | TBD | TBD | TBD |
| B6 | TBD | TBD | TBD |
| B7 | TBD | TBD | TBD |
| B8 | TBD | TBD | TBD |

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
