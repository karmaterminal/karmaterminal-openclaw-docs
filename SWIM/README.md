# SWIM Factory

Durable factory for continuation integration testing. **Public proof-of-function surface** for the OpenClaw continuation feature.

## Why this is here (and not in bootstrap)

Per figs's principle (2026-05-06): **integration testing is part of the proof, not adjacent to it**. Without the factory visible publicly, in-code tests claim more than they can carry alone. Reviewers should be able to read the WHAT, the HOW, and the means by which the test corpus is generated, on the same public surface that holds the executed swim instances.

That public surface is this repository. Swim instances live as a directory-neighbor under [`swims/`](../swims/). Factory definitions live here.

This factory was migrated from `karmaterminal/openclaw-bootstrap/SWIM/` on 2026-05-06 per `karmaterminal/openclaw-bootstrap#939` (FULL-swim charter substrate). The bootstrap repo retains `SWIM/lessons/` + `SWIM/history/` as private archive context (cohort-internal SHAs / PR refs / coordination history that doesn't sanitize cleanly), plus `SWIM/MIGRATED.md` as a forward-pointer to this directory.

## Start here

1. **[`FULL-SWIM-CHARTER.md`](FULL-SWIM-CHARTER.md)** — the verdict contract. What FULL means. Which 8 families a chartered swim must exercise to earn the adjective.
2. **[`CASE-REGISTRY-RULES.md`](CASE-REGISTRY-RULES.md)** — the lifecycle grammar that prevents silent loss. How cases enter the catalog (`new`), how they leave (`deprecated` / `superseded-by` / `split` / `merged` / `lost` ↔ `recovered-from-archive`).
3. **[`cases/CATALOG.md`](cases/CATALOG.md)** — the canonical case registry, currently at version `v1`. Every active case the FULL charter has to elect against.
4. **[`PR-UPDATE-VALIDATION-WALKTHROUGH.md`](PR-UPDATE-VALIDATION-WALKTHROUGH.md)** — fresh-session-readable walkthrough of how to take a PR update, instantiate a swim from this factory, run it, score it, and judge ship-safety from the result.

If you can read those four files alone and instantiate a swim against a PR update without further chat archaeology, this factory has done its job.

## Factory contents

### Contract layer

- [`FULL-SWIM-CHARTER.md`](FULL-SWIM-CHARTER.md) — what FULL means as a verdict
- [`CASE-REGISTRY-RULES.md`](CASE-REGISTRY-RULES.md) — registry lifecycle grammar
- [`cases/CATALOG.md`](cases/CATALOG.md) — registry version `v1` with 45 historical cases (recovered from `swim-34-formal-matrix/ROWS.md` via `FULL-SWIM-CROSSWALK.md`) and 10 new cases (N001-N010) for cross-session targeted return, multi-recipient, fanout, chain-budget, OTel trace-context propagation, request_compaction, post-compaction successor truth
- [`cases/_TEMPLATE.md`](cases/_TEMPLATE.md) — per-case file shape for new intake
- [`cases/REGISTRY-LIFECYCLE-WALKTHROUGH.md`](cases/REGISTRY-LIFECYCLE-WALKTHROUGH.md) — worked examples for every retire transition + version-bump discipline

### Runbook layer

- [`FORMAL-SWIM-RUNBOOK.md`](FORMAL-SWIM-RUNBOOK.md) — authoritative swim starter, fixed-role definitions, pre-swim gate checklist
- [`SEAL-BOY-SWIM-RUNBOOK.md`](SEAL-BOY-SWIM-RUNBOOK.md) — driver execution runbook
- [`SWIM-COORDINATOR-NOTES.md`](SWIM-COORDINATOR-NOTES.md) — coordinator runbook
- [`SWIM-MONITORING-RUNBOOK.md`](SWIM-MONITORING-RUNBOOK.md) — monitor / evidence runbook
- [`SWIM-SUBJECT-NOTES.md`](SWIM-SUBJECT-NOTES.md) — SUT / subject runbook
- [`SWIM-METHODOLOGY.md`](SWIM-METHODOLOGY.md) — methodology summary
- [`RUNBOOK-deploy-to-self.md`](RUNBOOK-deploy-to-self.md) — fleet-roll deploy preconditions for a swim cycle

### Walkthrough layer

- [`PR-UPDATE-VALIDATION-WALKTHROUGH.md`](PR-UPDATE-VALIDATION-WALKTHROUGH.md) — end-to-end worked example: PR-update → declare charter → fleet-roll → fire required rows → roll up scoreboard → judge ship-safety
- [`cases/REGISTRY-LIFECYCLE-WALKTHROUGH.md`](cases/REGISTRY-LIFECYCLE-WALKTHROUGH.md) — retire-grammar + version-bump worked examples

### Templates

- [`templates/`](templates/) — reusable templates for code-agent workorders and row-issue filings

## Where executed swim instances live

Swim instances are at directory-neighbor [`swims/`](../swims/). See [`swims/README.md`](../swims/README.md) for the public swim corpus index (currently swim-05 / 06 / 07 / 09 / 10 / 31 / 34 / 35 / 36 / 37 / 38 / 39 / 40 / 41 / 42 with provenance-class tags per `MISSING-SWIMS-LEDGER.md`).

A new FULL swim cycle creates a `swims/swim-NN-<name>/` directory containing its `CHARTER.md` (electing against a `cases/CATALOG.md` version), per-row receipts under `rows/`, and final `SCOREBOARD.md`.

## Discipline reminders

Per `FULL-SWIM-CHARTER.md` §6 closure rule:
- a swim earns FULL only if every required family was exercised, every required row was actually fired, and no required row ends `DEFERRED` / `BLOCKED` / `INVALIDATED`
- a case missing entirely from the swim's disposition manifest makes the swim **NOT-FULL by construction**

Per `CASE-REGISTRY-RULES.md`:
- no silent drop: a case can only leave the active set via explicit lifecycle transition with a recorded reason and (where applicable) replacement pointer
- no silent inheritance: a case can only enter the active set via explicit `new` declaration with family + claim + evidence-class + provenance

## Bootstrap private archive

What stays in `karmaterminal/openclaw-bootstrap/SWIM/`:
- `lessons/` — cohort-internal lesson texts referencing intra-cohort coordination decisions, PR refs, prince-host SHAs
- `history/` — historical evidence with bootstrap-internal pointers (sanitization cost high, value-to-public-reader low)
- `MIGRATED.md` — forward-pointer to this docs-repo location for the publishable factory contents
- `swims/` — historical swim-instance archive trees with rollback evidence + branch lineage (`swim-34-formal-matrix/`, `swim-35-stabilization/`, etc.); these have public-shelf pointers in `karmaterminal-openclaw-docs/swims/` per the `bootstrap-pointer` provenance class

Public-shelf pointers and the appendix-discipline ledger in [`swims/MISSING-SWIMS-LEDGER.md`](../swims/MISSING-SWIMS-LEDGER.md) keep the boundary honest: bootstrap remains source-of-truth body for historical instances; public surface here carries the pointer with explicit provenance class.
