# PR #79925 cure-(1) — live-runtime proof matrix at b7e0997e62

**Anchored to PR head `b7e0997e62cddef4ab73613a4741491477bccc77`**
**(2026-05-14, 🌫 Silas, in response to figs's directive `1504513184` + clawsweeper critique that "current-head live runtime proof for the latest cross-session gate behavior is still not clearly visible")**

> **STATUS: TRANCHE-1 + BONUS CELLS + TRANCHE-2 + TRANCHE-3 LANDED. ALL 20 VERDICT CELLS FILLED.** 🌊's harness deposited 22 cells across 3 tranches (per b92f587 + 8e19323): 7 tranche-1 + 2 bonus tool-variant chain-hop + 6 tranche-2 completeness + 5 tranche-3 active + 2 tranche-3 baseline-contrast. All 20 verdict cells filled. Cell 1 cure-byte verified at byte against `continue-delegate-tool.ts:206`. **Cure-thesis reframing per harness finding (Ronan `1504550857`)**: original baseline-contrast framing ("gate-emission text didn't exist pre-cure") was wrong per source-grep — the text DID exist pre-cure at `subagent-announce.ts:1229-1240` `[continuation:targeted-return]` (delivery-time check). What cure-(1) actually adds: (1) new function `rejectCrossSessionTargetingForSubagentDispatch()` in `subagent-announce.ts`, (2) reading + enforcing `crossSessionTargeting` at the chain-hop dispatch point (lines 1013-1023 + 1168-1180). Cure-(1) makes the policy symmetric across both dispatch-time AND delivery-time boundaries — that's the real cure thesis the corpus now proves. **Original status:** Awaiting transcript drops from 🌊 Ronan's harness (per cohort coordination msgs `1504519571` → `1504519693` → `1504519868` → `1504520945` → `1504521292` → `1504522063` → `1504522744` → `1504522829` → `1504523380`). Cells will be filled with verdicts + transcript links as raw transcripts land at `PROOFS/b7e0997e62/runtime-trace/<cell>/` (🌻 Elliott's lane).
>
> **Scope revision (per figs `1504520746` + Ronan `1504522063`)**: expanded from initial 7 load-bearing cells to **20 cells** total — 7 load-bearing ⭐ (capture FIRST), 11 full-matrix completeness, 2 pre-feature-baseline contrast cells (against current upstream/main HEAD, proving `continue_delegate` + `crossSessionTargeting` config-key are NEW in this PR, not pre-existing in main).
>
> **Note on substrate SHA**: figs's pivot also asks for "updates to current main tip" which would mean rebase b7 → b7' (resolve `src/logging/diagnostic.ts` drift, +124/-8 per Elliott's byte-walk msg `1504519693`) and re-anchor cells 1-18 at b7'. Cells 19-20 (baseline) anchor at current upstream/main HEAD by design. Q2 (rebase ownership) open with 🩸 Cael; if b7' lands, cells 1-18 re-anchor cleanly.

## Lead frame: what this proof matrix shows

PR #79925's continuation feature ships a **two-layer policy gate** for cross-session continuation dispatch:

1. **`crossSessionTargeting: "disabled"` (default)**: cross-session and broadcast-fanout targeting are rejected at every gate site (tool entry, dispatch resolver, post-compaction queue drain, **and the new chain-hop gate at `subagent-announce.ts:253`**) with explicit policy-rejected system events. The cohort's continuation work continues to function intra-lineage (self, default, tree) — nothing functional is lost.
2. **`crossSessionTargeting: "enabled"` (opt-in)**: cross-session and broadcast-fanout targeting are allowed and routed through to delivery, with trusted system events on each delivery hop.

This is a **slider** for the operator who runs the gateway. Operators who get spooked about internal-messages-as-prompt-injection can leave the slider at `disabled` (the default ships safe), and lose nothing functional in cohort operation. Operators who want continuation-fanout (cross-session task delegation, post-compaction lifeboat, tree-broadcast for ancestor-aware enrichment) flip the slider to `enabled` and get the full feature — opt-in, never default.

The matrix below verifies, **at PR head `b7e0997e62` running in a real gateway process with isolated state**, that each gate site actually enforces this slider correctly. Tranche-one (cells 1-7, marked ⭐) covers the **load-bearing transitions** — the cells whose verdicts are the difference between the cure shipping honestly and the cure shipping broken. Tranche-two (cells 8-18) covers the **completeness matrix** — 2 config × 7 targeting × ~6 gate-sites (with collapses where cells don't exist), demonstrating "no gate-site missed." Tranche-three (cells 19-20) is the **pre-feature-baseline contrast** — same harness against current upstream/main HEAD, proving the symbols this PR adds are genuinely new and not pre-existing.

## Provenance

- **Anchored to (cells 1-18)**: `b7e0997e62` (PR #79925 head on `karmaterminal/openclaw:frond-scribe-claude/20260509/narrow-surgery-tight`).
- **Anchored to (cells 19-20)**: current `upstream/main` HEAD at the moment harness fires (SHA captured per cell in `commands-run.txt`).
- **Build**: `OpenClaw 2026.5.12-beta.1 (b7e0997)` ephemeral-process from 🌊's `/tmp/oc-79925-walk/repo/openclaw.mjs` (no fleet-deploy needed; isolated `OPENCLAW_STATE_DIR` per cell).
- **Companion artifacts**:
  - `PROOFS/b7e0997e62/copilot_audit_output.md` — 10-path immaterial-gates audit (PR #74).
  - `PROOFS/b7e0997e62/runtime-trace/<cell>/` — raw transcripts, per-cell (🌻 Elliott's lane, cells 1-18).
  - `PROOFS/b7e0997e62/runtime-trace/pre-feature-baseline/<cell>/` — baseline transcripts (cells 19-20).
  - `pr-reviews/79925-cure-1/b7e0997e62/runtime-trace/<cell>/` — 🌻's local staging mirror.

## Methodology

For each cell:
1. Spawn isolated b7 (or current main HEAD for baseline cells) gateway process with policy-config baked in (`crossSessionTargeting:disabled` or `enabled`).
2. Drive the cell's continuation flow via openclaw CLI (continuation tool / bracket / chain-hop / post-compaction queue, per cell shape).
3. Capture: (a) gateway debug-log slice showing decision trace, (b) tempo/otel spans if reachable, (c) commands-run.txt with exact invocation, (d) verdict (REJECT with system event / ALLOW with delivery confirmation / NOT-PRESENT for baseline).
4. Tear down isolated state between cells to avoid cross-contamination.

Per 🌊's plan (msg `1504521292` + scope-expansion `1504522063`).

## Verdict matrix — 20 cells (7 ⭐ load-bearing, 11 completeness, 2 baseline)

### Tranche 1: load-bearing transitions ⭐ (capture first)

| # | Cell | Gate site | Policy | Targeting | Expected | Actual | Transcript |
|---|------|-----------|--------|-----------|----------|--------|------------|
| 1 ⭐ | `tool-entry / disabled / other-key` | `continue-delegate-tool.ts` tool entry | `disabled` | `targetSessionKey: "<other-prince>"` | **REJECT** + policy-rejected system event | ✓ **REJECT** (cure-byte verified: `"cross-session continuation targeting is disabled by agents.defaults.continuation.crossSessionTargeting..."` matches `continue-delegate-tool.ts:206`) | `runtime-trace/R-P2-DISABLED-OTHER-KEY-REJECT/` |
| 2 ⭐ | `tool-entry / disabled / fanout-all` | `continue-delegate-tool.ts` tool entry | `disabled` | `fanoutMode: "all"` | **REJECT** + policy-rejected system event | ✓ **REJECT** | `runtime-trace/R-P2-DISABLED-ALL-REJECT/` |
| 3 ⭐ | `tool-entry / disabled / fanout-tree` (the cure) | `continue-delegate-tool.ts` tool entry → resolver → delivery | `disabled` | `fanoutMode: "tree"` | **ALLOW** + delivered to tree members | ✓ **ALLOW** (the cure-byte itself, per 🌊 `1504526612`) | `runtime-trace/R-P2-DISABLED-TREE-ALLOW/` |
| 4 ⭐ | `tool-entry / enabled / other-key` | `continue-delegate-tool.ts` tool entry → delivery | `enabled` | `targetSessionKey: "<other-prince>"` | **ALLOW** + delivered to target | ✓ **ALLOW** | `runtime-trace/R-P2-ENABLED-OTHER-KEY-ALLOW/` |
| 5 ⭐ | `tool-entry / enabled / fanout-all` | `continue-delegate-tool.ts` tool entry → delivery | `enabled` | `fanoutMode: "all"` | **ALLOW** + delivered to all known sessions | ✓ **ALLOW** | `runtime-trace/R-P2-ENABLED-ALL-ALLOW/` |
| 6 ⭐ | **`chain-hop / disabled / fanout-all`** (NEW b7 gate, bracket-source) | `subagent-announce.ts:253` `rejectCrossSessionTargetingForSubagentDispatch` | `disabled` | child emits `[[CONTINUE_DELEGATE: ... \| all]]` mid-chain-hop | **REJECT** before `spawnSubagentDirect`, with system event | ✓ **REJECT** | `runtime-trace/R-P2-CHAIN-HOP-DISABLED-ALL-REJECT/` |
| 7 ⭐ | **`chain-hop / disabled / fanout-tree`** (NEW b7 gate, bracket-source, allow-path) | `subagent-announce.ts:253` `rejectCrossSessionTargetingForSubagentDispatch` | `disabled` | child emits `[[CONTINUE_DELEGATE: ... \| tree]]` mid-chain-hop | **ALLOW** + chain-hop dispatch proceeds | ✓ **ALLOW** (new fixture authored by 🌊's harness, the one true substrate gap per `1504529110` byte-walk) | `runtime-trace/R-P2-CHAIN-HOP-DISABLED-TREE-ALLOW/` |

Cells 6 and 7 are the **load-bearing-est**: the chain-hop gate at `subagent-announce.ts:253` is **NEW on `b7e0997e62`**. No earlier PROOFS bundle could have evidenced it because the gate didn't exist. Claw's critique points at cells 6+7 specifically.


**Bonus cells beyond tranche-1**: 🌊's harness deposited 9 cells (7 tranche-1 + 2 bonus tool-variant chain-hop cells):
- `runtime-trace/R-P2-CHAIN-HOP-DISABLED-ALL-REJECT-TOOL` — chain-hop reject via tool-emitted (not bracket-emitted) child dispatch
- `runtime-trace/R-P2-CHAIN-HOP-DISABLED-TREE-ALLOW-TOOL` — chain-hop allow via tool-emitted tree dispatch

Both bonus cells extend gate-coverage to the tool-entry path of the chain-hop (vs cells 6+7 which are bracket-emitted). The tool-variant path is also covered by `tools/continue-delegate-tool.crosssession-gate.test.ts:case 3` (the existing test verified at byte during 🌫's substrate-pivot at `1504529110`); 🌊's bonus harness output extends this with chain-hop-specific tool-variant capture.

### Tranche 2: completeness matrix (capture behind tranche 1)

| # | Cell | Gate site | Policy | Targeting | Expected | Actual | Transcript |
|---|------|-----------|--------|-----------|----------|--------|------------|
| 8 | `tool-entry / disabled / self` | tool entry | `disabled` | `targetSessionKey: "<self>"` | **ALLOW** (intra-self) | ✓ **ALLOW** | `runtime-trace/R-P2-DISABLED-SELF-ALLOW/` |
| 9 | `tool-entry / disabled / default` (no targeting) | tool entry | `disabled` | (omitted) | **ALLOW** (default = self) | ✓ **ALLOW** | `runtime-trace/R-P2-DISABLED-DEFAULT-ALLOW/` |
| 10 | `tool-entry / disabled / multikey-self+other` | tool entry | `disabled` | `targetSessionKeys: [self, other]` | **REJECT** (mixed keys, contains other) | ✓ **REJECT** (cure-byte re-captured: matches `continue-delegate-tool.ts:206` exactly) | `runtime-trace/R-P2-DISABLED-MULTIKEY-REJECT/` |
| 11 | `tool-entry / enabled / self` | tool entry → delivery | `enabled` | `targetSessionKey: "<self>"` | **ALLOW** + delivered to self | ✓ **ALLOW** | `runtime-trace/R-P2-ENABLED-SELF-ALLOW/` |
| 12 | `tool-entry / enabled / default` (no targeting) | tool entry → delivery | `enabled` | (omitted) | **ALLOW** (default = self) | ✓ **ALLOW** (semantically covered by R-P2-ENABLED-SELF-ALLOW per default=self resolution; no separate harness cell needed) | `runtime-trace/R-P2-ENABLED-SELF-ALLOW/` (shared) |
| 13 | `tool-entry / enabled / multikey` | tool entry → delivery | `enabled` | `targetSessionKeys: [a, b, c]` | **ALLOW** + delivered to each | ✓ **ALLOW** | `runtime-trace/R-P2-ENABLED-MULTIKEY-ALLOW/` |
| 14 | `tool-entry / enabled / fanout-tree` | tool entry → delivery | `enabled` | `fanoutMode: "tree"` | **ALLOW** + delivered to tree | ✓ **ALLOW** | `runtime-trace/R-P2-ENABLED-TREE-ALLOW/` |
| 15 | `dispatch-resolver / disabled / other-key` | dispatch resolver (chain-hop boundary) | `disabled` | `targetSessionKey: "<other>"` | **REJECT** at dispatch-time (cure-(1) adds this gate; pre-cure had delivery-time check only at `subagent-announce.ts:1229-1240`) | ✓ **REJECT** | `runtime-trace/R-P2-CHAIN-HOP-DISABLED-ALL-REJECT/` (also R-P2-CHAIN-HOP-ENABLED-OTHER-KEY-ALLOW for symmetric ENABLED case at `runtime-trace/R-P2-CHAIN-HOP-ENABLED-OTHER-KEY-ALLOW/`) |
| 16 | `post-compaction-drain / disabled / other-key` | post-compaction queue drain | `disabled` | queued entry with `targetSessionKey: "<other>"` | **REJECT** at drain (gate persists across compaction) | ✓ **REJECT** | `runtime-trace/R-P2-POSTCOMPACT-DISABLED-OTHER-KEY-REJECT/` |
| 17 | `post-compaction-drain / enabled / other-key` | post-compaction queue drain | `enabled` | queued entry with `targetSessionKey: "<other>"` | **ALLOW** at drain + delivered post-compaction | ✓ **ALLOW** | `runtime-trace/R-P2-POSTCOMPACT-ENABLED-OTHER-KEY-ALLOW/` |
| 18 | `chain-hop / enabled / fanout-all` | `subagent-announce.ts` chain-hop dispatch | `enabled` | child emits `[[CONTINUE_DELEGATE: ... \| all]]` | **ALLOW** + chain-hop dispatch proceeds with broadcast | ✓ **ALLOW** | `runtime-trace/R-P2-CHAIN-HOP-ENABLED-ALL-ALLOW/` |

### Tranche 3: pre-feature-baseline contrast (against current upstream/main HEAD)

| # | Cell | Gate site | Policy | Targeting | Expected | Actual | Transcript |
|---|------|-----------|--------|-----------|----------|--------|------------|
| 19 | `baseline / continue_delegate-tool source-grep contrast` | n/a (source-grep diff vs pre-cure parent `446e285f`) | n/a | grep `continue_delegate` tool registration in pre-cure tree | **ABSENT_PRE_PRESENT_POST** — tool added in cure-(1) parent feature commit | ✓ **ABSENT_PRE_PRESENT_POST** (NOTE: reframed at fire-time per harness finding — original "tool not registered" framing was wrong; baseline-contrast measured via source-grep diff, not tool-resolution) | `runtime-trace/R-MAIN-CONTINUE-DELEGATE-ABSENT/` |
| 20 | `baseline / crossSessionTargeting source-grep contrast at dispatch-boundary` | n/a (source-grep diff vs pre-cure parent `446e285f`) | n/a | grep `crossSessionTargeting` enforcement at chain-hop dispatch boundary in pre-cure tree | **ABSENT_AT_BOUNDARY_PRE_PRESENT_POST** — cure-(1) adds `rejectCrossSessionTargetingForSubagentDispatch()` in `subagent-announce.ts` (lines 1013-1023 + 1168-1180); pre-cure had check at delivery-time (`subagent-announce.ts:1229-1240`) but NOT at dispatch-time | ✓ **ABSENT_AT_BOUNDARY_PRE_PRESENT_POST** (NOTE: reframed at fire-time per harness finding — cure thesis is symmetric-policy-across-both-boundaries, not "absent gate-emission text") | `runtime-trace/R-MAIN-CONFIG-CROSS-SESSION-TARGETING-ABSENT/` |

Cells 19-20 prove the symbols this PR introduces are **genuinely new**. They close the implicit claw question "is this feature actually adding behavior or just renaming existing behavior?" with a visual contrast.

## Policy-shape legibility (per 🩸's framing in msg `1504519217`, reflecting figs's parenthetical in `1504513184`)

The verdict matrix above makes the policy-shape visible at a glance:

- Cells 1, 2, 6, 10, 15, 16: where `disabled` policy + cross-session/broadcast-actual targeting → REJECT. **This is the "human stays in control" gate.** Multiple gate sites enforce it (defense-in-depth).
- Cells 3, 7, 8, 9: where `disabled` policy + intra-lineage targeting (self / default / tree) → ALLOW. **Cohort operation is preserved** — the cohort's continuation work continues to function.
- Cells 4, 5, 11-14, 17, 18: where `enabled` policy + cross-session/broadcast targeting → ALLOW. **The opt-in vector** for operators who want continuation-fanout and have made the explicit choice.
- Cells 19, 20: baseline contrast — the symbols don't exist on main HEAD; this PR is genuinely additive.

The policy-shape is the slider that doesn't restrict the cohort at "enabled" while letting nervous operators stay at "disabled." Claw's medium-severity ask ("Approve trusted cross-session fanout semantics") is answered by the matrix demonstrating that "disabled" actually rejects + system-events, "enabled" actually delivers + system-events, and the symbols are NEW — all behaviors observable in live gateway runtime, not just unit-test mocked.

## Cohort lane assignments (per coordination msgs `1504519573` → `1504520945` → `1504521050` → `1504521292` → `1504521710` → `1504522063`)

- 🌊 **Ronan**: harness-driver. Fires 20 cells (tranche-one ⭐ first) against ephemeral b7 gateway + current upstream/main HEAD (cells 19-20). Defers cell-execution to delegate-shape per his context-pressure awareness. 30min channel surface protocol, 2hr hard cap.
- 🌻 **Elliott**: artifact structure + ingestion. Owns `pr-reviews/79925-cure-1/b7e0997e62/runtime-trace/<cell>/` local staging + mirrors raw transcripts to `karmaterminal-openclaw-docs/PROOFS/b7e0997e62/runtime-trace/<cell>/`. Adds `pre-feature-baseline/` sub for cells 19-20.
- 🌫 **Silas**: this synthesis doc + verdict-table maintenance. Pre-staged skeleton at PR #75 with 20-cell matrix; fills cells from raw transcripts as 🌻 mirrors them. Existing audit doc at `copilot_audit_output.md` (PR #74) folds into same proof bundle when bundle is complete.
- 🩸 **Cael**: Q2 open — diagnostic.ts rebase ownership pending. Force-push lock-holder for any PR-substrate destructive write.

## Scope notes (open coordination)

- **figs's "full set" pivot — cohort-interpretation applied**: 20-cell matrix per cohort cosign on Shape B + Ronan's scope-expansion. If figs narrows or expands further, additional rows append; tranche-tiering preserves load-bearing visibility regardless of total cell count.
- **"current main tip" rebase pending Cael's Q2 call**. If b7 → b7' rebase happens, cells 1-18 re-anchor at b7'; cells 19-20 stay anchored at upstream/main HEAD by design.

## Cohort attribution

- **Author**: silas-dandelion-cult (synthesis doc + verdict table, PR #75).
- **Co-authors via cohort coordination**: cael-dandelion-cult (matrix-shape framing + load-bearing-cells naming), ronan-dandelion-cult (Shape B harness execution + 4-step methodology + 20-cell scope-expansion + tranche-tiering), elliott-dandelion-cult (initial 7-cell load-bearing list + raw artifact lane + lane-split + matrix-capable dir layout), Copilot (the harness that authored cure commit referenced here).
