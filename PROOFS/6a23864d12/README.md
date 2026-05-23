# Proof Corpus: PR-HEAD SHA `6a23864d12`

**PR**: [openclaw/openclaw#79925](https://github.com/openclaw/openclaw/pull/79925) — feat(continuation): context-pressure-aware continuation
**PR-HEAD SHA**: `6a23864d12ef5845b340923d3d3f1d0978751429`
**Build**: `6a23864`
**Branch**: `cael/candidate-9a5be09893` / `frond-scribe-claude/20260509/narrow-surgery-tight`
**Date**: 2026-05-22 (Friday late evening PDT) / 2026-05-23 (Saturday early UTC)
**Fleet**: 4/4 princes deployed on `6a23864d12` at proof-fire time

> **Every row in this corpus was proven FRESH on `6a23864d12` — the SHA reviewers see as the PR head. No "inherited from prior corpus" claims. Each row has its own evidence files in this directory: `proof.md` (scenario/command/expected/observed) + raw Tempo trace JSON (where applicable) + structured-response JSON (where applicable).**

## Proof Matrix

| Row | Prince | What it proves | Evidence | Verdict |
|-----|--------|---------------|----------|---------|
| [R-CW-1](./R-CW-1/) | 🩸 Cael (+ dual-seat 🌊 Ronan) | `continue_work()` basic wake — agent calls `continue_work(N)`, next turn fires after N seconds | trace `2e2f8e91` (cael) + `7b3394a6` (ronan) | ✅ PASS |
| [R-CW-DELEGATE-SELF-CONTINUATION](./R-CW-DELEGATE-SELF-CONTINUATION/) | 🩸 Cael | **#746 thesis**: delegate sessions can call `continue_work()` to self-elect next turn | trace `d1d8ae4c` | ✅ PASS |
| [R-CD-1](./R-CD-1/) | 🌊 Ronan | `continue_delegate()` normal mode: dispatch → spawn → execute → return | trace `a91abcfc` | ✅ PASS |
| [R-CD-2](./R-CD-2/) | 🌊 Ronan | `continue_delegate(mode="silent-wake")`: silent return + parent wake delivery | trace `7ebd0c9e` + `silent-wake-evidence.json` | ✅ PASS |
| [R-CD-3](./R-CD-3/) | 🌊 Ronan | `continue_delegate(delaySeconds=10)`: delayed dispatch | trace `e8a310df` | ✅ PASS |
| [R-CD-4](./R-CD-4/) | 🌊 Ronan | `continue_delegate(targetSessionKey=...)`: cross-session targeted return | trace `051a8a11` | ✅ PASS |
| [R-CD-CHAINED-DEPTH-2](./R-CD-CHAINED-DEPTH-2/) | 🌊 Ronan | Recursive delegation: depth-1 spawns depth-2 child; trace tree preserved across the capture-before-clear execution-order fix | trace `73156fd1` | ✅ PASS |
| [R-RC-1](./R-RC-1/) | 🌫 Silas | `request_compaction()` threshold REJECT (68% < 70% floor); structured JSON rejection with `guard: "context_threshold"` | `rejection.json` + `rejection-evidence.json` | ✅ PASS |
| [R-OBS-1](./R-OBS-1/) | 🌻 Elliott + figs | External observer `/status` cross-walk: figs (human, from outside the system) verifies 4/4 fleet on `6a23864d12` + chain counters non-zero | `proof.md` | ✅ PASS |
| R-RC-2 | (deferred) | `request_compaction()` accept-path above 70% threshold | — | ⏳ HONEST-LIMIT (gate-stack-working-as-designed; requires >70% context at fire-time, which the gate-stack itself prevents from manufacturing) |

## Files in this corpus

- [`BRIEF.md`](./BRIEF.md) — one-page executive summary for reviewer-friendly tl;dr
- [`README.md`](./README.md) — this file (proof matrix + cross-references)
- [`METHOD.md`](./METHOD.md) — procedure documentation: substrate-frame, row taxonomy, cohort attribution, honest-substrate notes
- [`RESOLVED-SHA.md`](./RESOLVED-SHA.md) — SHA identity, parent commit, gate verdicts, CI state
- [`artifacts/tempo-evidence.md`](./artifacts/tempo-evidence.md) — trace-evidence synthesis: links all 8 Tempo trace JSONs + summarizes span topology
- 9 per-row directories with `proof.md` + trace JSON (or structured response JSON) per row

## What this corpus proves

The continuation infrastructure in PR #79925 — `continue_work()`, `continue_delegate()` (all modes including recursive chained), and `request_compaction()` — operates as designed on the exact SHA the PR ships. Evidence is multi-seat (verified from independent prince-seats on R-CW-1 dual-seat), trace-stitched (OTel span trees confirm parent-child relationships across delegation hops in R-CD-CHAINED-DEPTH-2), and external-observer-verified (figs's `/status` Discord output for R-OBS-1).

## Cross-References

- **PR**: [openclaw/openclaw#79925](https://github.com/openclaw/openclaw/pull/79925)
- **Runbook**: [PR-DRIFT-CURE-GATES-RUNBOOK](https://github.com/karmaterminal/openclaw-bootstrap/blob/main/RUNBOOKS/PR-DRIFT-CURE-GATES-RUNBOOK.md) — 6-gate procedure this corpus satisfies Gate 4 for
- **Corpus-shape canon**: [PROOF-CORPUS-METHOD](https://github.com/karmaterminal/openclaw-bootstrap/blob/main/RUNBOOKS/PROOF-CORPUS-METHOD.md)
- **Gold-standard exemplar**: [`PROOFS/094f45345a/`](../094f45345a/) — 2026-05-13 corpus that this one mirrors in shape

## Co-authored-by

- Cael🩸 <cael.dandelion.cult@hotmail.com>
- Silas🌫 <silas-dandelion-cult@users.noreply.github.com>
- Ronan🌊 <ronan-dandelion-cult@users.noreply.github.com>
- Elliott🌻 <elliott-dandelion-cult@users.noreply.github.com>
- frond-scribe🌿 <scribe.dandelion.cult@hotmail.com>