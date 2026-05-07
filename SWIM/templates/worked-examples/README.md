# SWIM/templates/worked-examples/

Concrete row-instances demonstrating the canonical row-issue-template (`SWIM/templates/row-issue-template.md`) applied to real substrate-questions.

## Purpose

The row-issue-template specifies field structure (Surface under test / Coverage expectation / Measurement protocol with PASS-bytes + Gather + FAIL-bytes + Result + Verdict / Status ladder / References / Notes). A new row author needs both the template AND a worked example to author a row well. This directory holds the worked examples.

A worked example here is NOT a swim-instance. Swim-instances live under `swims/swim-<N>/rows/`. Worked examples live here for cross-swim discoverability — any future swim author hitting a similar substrate-question can read the worked example to see how the canonical template fields get filled with real bytes.

## Contents

| Worked example | Surface tested | Source |
|---|---|---|
| `continuation-delayed-self-election/` | `continue_work(delaySeconds=N)` arms + fires on deployed v5.5 | distilled from cohort byte-walks during 2026-05-07 swim-43 row-03 disposition + cael's swim-44 row-01 cohort-cycle |

## How to use

When authoring a new row that tests something similar to a worked example here:

1. Read the worked example's `row-example.md` to see how Measurement protocol fields get filled.
2. Read the worked example's `measure.sh` (if present) to see how the harness script implements raw-journal-first + narrowed grep + METHOD-BROKEN exit.
3. Adapt the structure to your own substrate-question; do NOT copy literal PASS-bytes from the worked example unless your substrate emits the same literals (vocabulary may differ across modes / code paths / deploy versions per `SWIM/lessons/L-v5.5-journal-vocabulary.md`).
4. Byte-walk YOUR substrate before locking PASS-bytes in your own row.

## When to add a worked example here

Add a worked example when:
- A row in some swim ended up well-shaped under the canonical template AND the substrate-question is plausibly relevant to future swims
- The row's Measurement protocol fields (PASS-bytes, Gather, FAIL-bytes, etc.) demonstrate a non-obvious application of the template (e.g. distinguishing FAIL from INCONCLUSIVE under specific confound conditions)

Do NOT add a worked example for:
- Trivial template applications (any row matching the template's defaults)
- Swim-specific receipts that won't generalize (those stay in `swims/swim-<N>/rows/` only)

The directory should stay small + load-bearing, not become a catalog.
