# Swim coverage index

> **Purpose**: single map of *which swims have what evidence in this repo*, so cohort can see at-a-glance what survives, what's thin, and where the genuine gaps are.
>
> **Date of this index**: 2026-05-06 (elliott-seat seed; 🌊 to arrange + extend).
>
> **Definition** (per figs canon, msg `1501657...`-area, 2026-05-06): a swim is *"a FULL and comprehensive / exhaustive integration test case collection, which exercises in vivo ALL element claims of our RFC as minimum. It can and is adapted as our feature changes shape."*

## Coverage at a glance

| Swim | Era / SUT context | What's in this repo | Source-of-truth |
|---|---|---|---|
| 5 | 2026-03-05, generation-guard / preemption | `STATUS.md` (TC5-0 round-1+2 + root-cause+fix) | `openclaw-bootstrap:SWIM/history/SWIM5-STATUS.md` |
| 6 | three-layer architecture canary `3a03f4658` | `FINDINGS.md` (P0 maxChainLength off-by-one + fix) + `PROTOCOL.md` (test protocol) | `openclaw-bootstrap:SWIM/history/SWIM6-*.md` |
| 7 | 2026-03-06, build `b07e7e40c`, opus-4-6 | `RESULTS.md` (driver/monitor/subject formation + per-test results) | `openclaw-bootstrap:SWIM/history/SWIM7-RESULTS.md` |
| 8 | — | **NOT YET RECOVERED** | hunt: feature/context-pressure-squashed RFC history era |
| 9 | early canary, build `b2322f5`, low-context | `README.md` (5/5 PASS after `requestCompactionOpts` forwarding fix) | this repo (pre-existing) |
| 10 | full-path coverage canary, build `ad32cde` | `README.md` (13-row scorecard, 12 PASS / 0 FAIL / 1 DEFERRED) | this repo (pre-existing) |
| 11–28 | — | **GAPS — NOT YET RECOVERED** | hunt: bootstrap issues / per-prince branches / channel-record |
| 29 | 2026-04-14, codex-fixup-2026-04-14 era | `cael-evidence.md` (TC1/TC2 PASS, TC3 INCONCLUSIVE under provider-confound, TC4 partial) | `openclaw-bootstrap:tests/behavioral/informal/swim-29-cael-evidence-2026-04-14.md` |
| 30 | — | **NOT YET RECOVERED** | hunt: bootstrap issues |
| 31 | 2026-04-15, candidate `101e808a8a` | `EVIDENCE.md` (TC1/TC2 PASS, TC3 FINDING — swim stopped per runbook §5) | `openclaw-bootstrap:SWIM/history/SWIM31-EVIDENCE.md` |
| 32 | — | **NOT YET RECOVERED** | hunt: bootstrap issues |
| 33 | — | **NOT YET RECOVERED** | hunt: bootstrap issues |
| 34 | formal-matrix era (the big board) | `README.md` + `ROWS.md` + `BRIEF.md` (continuation-module) | `openclaw-bootstrap:swims/swim-34-formal-matrix/` |
| 35 | stabilization era | `README.md` + `ROWS.md` + `BRIEF.md` | `openclaw-bootstrap:swims/swim-35-stabilization/` |
| 36 | — | `CHARTER.md` | `openclaw-bootstrap:swims/swim-36/` |
| 37 | trap-class taxonomy era | `CHARTER.md` + `CASES.md` + `FEATURE-COVERAGE.md` | `openclaw-bootstrap:swims/swim-37/` + `studies/swim-37/harness/` (in-repo test code) |
| 38 | slippy-hoodie | `CHARTER.md` | `openclaw-bootstrap:swims/swim-38-slippy-hoodie/` |
| 39 | volatile-purge | `CHARTER.md` + `CASES.md` + `FEATURE-COVERAGE.md` | `openclaw-bootstrap:swims/swim-39-volatile-purge/` |
| 40 | v29-substrate-verification | `CHARTER.md` + `SCOREBOARD.md` | `openclaw-bootstrap:swims/swim-40-v29-substrate-verification/` |
| 41 | v5.2 substrate recheck | `README.md` + 4 OV-row receipts | this repo (pre-existing) |
| 42 | v5.5 cohort verification surface | `EVIDENCE-LAYERS.md` + 5 row clusters | this repo (pre-existing) |

## Genuine gaps (need hunting)

- **Swim 8** — between SWIM7-RESULTS and SWIM9-canary. Likely lives in `feature/context-pressure-squashed` RFC history era.
- **Swim 11–28** — the largest gap. Per silas-seat archaeology, swim 31 + swim 34 era bracket this; intermediate swims likely live in `openclaw-bootstrap` issues, per-prince branches that may have been force-pushed away, or channel-record.
- **Swim 30, 32, 33** — small gaps adjacent to swim 31.

## What this index is NOT

- Not an authoritative scoreboard. Each swim's substrate is what it is; some are full readme-style scorecards (10), some are findings + fix records (5/6), some are charters with CASES + COVERAGE matrices (37/39), some are evidence-only (31, 29).
- Not a verdict. A swim being recovered here doesn't mean it currently passes against today's substrate; it means the historical evidence of *that swim having been done* survives.
- Not the FULL-swim definition. That's a separate cohort canon item (5 families: turn-election + delegate-modes + guardrails + routing/delivery + compaction/recovery; one named SUT/tag/canonical branch; one cycle; row verdicts; top-level scorecard; explicit closure rule).

## How to use this index

When citing a swim in RFC appendix, PR body, or release notes:
1. Look up the swim here
2. Use the source-of-truth column to find canonical material
3. Link the corresponding folder in this repo as the public-facing surface
4. If the swim is in the gap-list and you have substrate that can fill it, drop it in via PR

## Source seeds

- 🌫 surgical-archaeology pass (cohort msg series, 2026-05-06): named the three-surface decomposition (feature-branch RFC history + openclaw-bootstrap + karmaterminal-openclaw-docs) and the genuine-gap shape.
- 🌻 elliott-seat: harvested `openclaw-bootstrap:SWIM/history/`, `SWIM/lessons/`, `swims/`, and `tests/behavioral/informal/` to populate this index seed.
- 🌊 to arrange + extend: cohort runner-seat for swim-orchestration; this index is offered as starting material for the v2026.5.5 release-facing swim coverage map.
