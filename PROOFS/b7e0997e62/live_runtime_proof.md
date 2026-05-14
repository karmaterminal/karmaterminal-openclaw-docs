# PR #79925 cure-(1) — live-runtime proof matrix at b7e0997e62

**Anchored to PR head `b7e0997e62cddef4ab73613a4741491477bccc77`**
**(2026-05-14, 🌫 Silas, in response to figs's directive `1504513184` + clawsweeper critique that "current-head live runtime proof for the latest cross-session gate behavior is still not clearly visible")**

> **STATUS: SKELETON.** Awaiting transcript drops from 🌊 Ronan's harness (per cohort coordination msgs `1504519571` → `1504519693` → `1504519868` → `1504520945` → `1504521292` → `1504522744`). Cells will be filled with verdicts + transcript links as raw transcripts land at `PROOFS/b7e0997e62/runtime-trace/<cell>/` (🌻 Elliott's lane).
>
> **Scope (cohort-converged via Ronan `1504522744` re-lock + Silas withdrawal of fold-pivot at `1504525053`)**: **7 load-bearing transition cells** captured against b7 with vitest-with-capture substrate (Ronan's substrate-shape pivot at `1504522166`). figs's "overwhelm with evidence + accuracy/clarity-of-presentation" directive read as *presentation-directive* (verdict-table at-a-glance reads as evidence-overwhelm shape) not cell-count-directive. If figs narrows or expands further, additional rows append.
>
> **Companion artifact**: `PROOFS/b7e0997e62/copilot_audit_output.md` (PR #74) stays as audit-doc against b7. No diagnostic.ts/main rebase fold (cohort decision per Elliott `1504519693` + Ronan `1504522334` + Silas withdrawal of original fold-pivot).

## Lead frame: what this proof matrix shows

PR #79925's continuation feature ships a **two-layer policy gate** for cross-session continuation dispatch:

1. **`crossSessionTargeting: "disabled"` (default)**: cross-session and broadcast-fanout targeting are rejected at every gate site (tool entry, dispatch resolver, post-compaction queue drain, **and the new chain-hop gate at `subagent-announce.ts:253`**) with explicit policy-rejected system events. The cohort's continuation work continues to function intra-lineage (self, default, tree) — nothing functional is lost.
2. **`crossSessionTargeting: "enabled"` (opt-in)**: cross-session and broadcast-fanout targeting are allowed and routed through to delivery, with trusted system events on each delivery hop.

This is a **slider** for the operator who runs the gateway. Operators who get spooked about internal-messages-as-prompt-injection can leave the slider at `disabled` (the default ships safe), and lose nothing functional in cohort operation. Operators who want continuation-fanout (cross-session task delegation, post-compaction lifeboat, tree-broadcast for ancestor-aware enrichment) flip the slider to `enabled` and get the full feature — opt-in, never default.

The matrix below verifies, **at PR head `b7e0997e62` running with vitest-with-capture against the b7 binary's actual gate-site functions**, that each load-bearing transition actually enforces this slider correctly. The 7 cells are the **load-bearing transitions** — the cells whose verdicts are the difference between the cure shipping honestly and the cure shipping broken. (Trivial-allow cells like `disabled+self+default` are covered by unit tests + audit table; not duplicated here.)

## Provenance

- **Anchored to**: `b7e0997e62` (PR #79925 head on `karmaterminal/openclaw:frond-scribe-claude/20260509/narrow-surgery-tight`).
- **Substrate**: `OpenClaw 2026.5.12-beta.1 (b7e0997)` ephemeral-process from 🌊's `/tmp/oc-79925-walk/repo/openclaw.mjs`, driven via vitest with `--reporter=verbose` + log-capture per cell, isolated `OPENCLAW_STATE_DIR` per cell. Substrate-honesty: this is the highest-fidelity substrate available within the cohort's resource window — actual b7 binary, actual gate-site functions, actual decision-traces captured. It is NOT a fully-running gateway with model-emitted bracket-source dispatches; the gap between vitest-driven invocation and end-to-end-model-emitted is acknowledged. Cohort assessment: that gap is smaller than the value of capturing this evidence at b7 head within claw's response window.
- **Companion artifacts**:
  - `PROOFS/b7e0997e62/copilot_audit_output.md` — 10-path immaterial-gates audit (PR #74). Stays as audit-doc against b7.
  - `PROOFS/b7e0997e62/runtime-trace/<cell>/` — raw transcripts, per-cell (🌻 Elliott's lane).
  - `pr-reviews/79925-cure-1/b7e0997e62/runtime-trace/<cell>/` — 🌻's local staging mirror.

## Methodology

For each cell:
1. Spawn isolated b7 gateway process with policy-config baked in (`crossSessionTargeting:disabled` or `enabled`).
2. Drive the cell's continuation flow via vitest harness against b7 binary's actual gate-site functions, with log-capture per cell.
3. Capture: (a) gateway debug-log slice showing decision trace, (b) tempo/otel spans if reachable, (c) commands-run.txt with exact invocation, (d) verdict (REJECT with system event / ALLOW with delivery confirmation).
4. Tear down isolated state between cells to avoid cross-contamination.

Per 🌊's plan (`1504521292`) + substrate-shape pivot (`1504522166`).

## Verdict matrix — 7 load-bearing transition cells

| # | Cell | Gate site | Policy | Targeting | Expected | Actual | Transcript |
|---|------|-----------|--------|-----------|----------|--------|------------|
| 1 | `tool-entry / disabled / other-key` | `continue-delegate-tool.ts` tool entry | `disabled` | `targetSessionKey: "<other-prince>"` | **REJECT** + policy-rejected system event | _pending_ | _pending_ |
| 2 | `tool-entry / disabled / fanout-all` | `continue-delegate-tool.ts` tool entry | `disabled` | `fanoutMode: "all"` | **REJECT** + policy-rejected system event | _pending_ | _pending_ |
| 3 | `tool-entry / disabled / fanout-tree` (the cure) | `continue-delegate-tool.ts` tool entry → resolver → delivery | `disabled` | `fanoutMode: "tree"` | **ALLOW** + delivered to tree members | _pending_ | _pending_ |
| 4 | `tool-entry / enabled / other-key` | `continue-delegate-tool.ts` tool entry → delivery | `enabled` | `targetSessionKey: "<other-prince>"` | **ALLOW** + delivered to target | _pending_ | _pending_ |
| 5 | `tool-entry / enabled / fanout-all` | `continue-delegate-tool.ts` tool entry → delivery | `enabled` | `fanoutMode: "all"` | **ALLOW** + delivered to all known sessions | _pending_ | _pending_ |
| 6 | **`chain-hop / disabled / fanout-all`** (NEW b7 gate) | `subagent-announce.ts:253` `rejectCrossSessionTargetingForSubagentDispatch` | `disabled` | child emits `[[CONTINUE_DELEGATE: ... \| all]]` mid-chain-hop | **REJECT** before `spawnSubagentDirect`, with system event | _pending_ | _pending_ |
| 7 | **`chain-hop / disabled / fanout-tree`** (NEW b7 gate, allow-path) | `subagent-announce.ts:253` `rejectCrossSessionTargetingForSubagentDispatch` | `disabled` | child emits `[[CONTINUE_DELEGATE: ... \| tree]]` mid-chain-hop | **ALLOW** + chain-hop dispatch proceeds | _pending_ | _pending_ |

Cells 6 and 7 are the **load-bearing-est**: the chain-hop gate at `subagent-announce.ts:253` is **NEW on `b7e0997e62`**. No earlier PROOFS bundle could have evidenced it because the gate didn't exist. Claw's critique points at cells 6+7 specifically.

## Policy-shape legibility (per 🩸's framing in msg `1504519217`, reflecting figs's parenthetical in `1504513184`)

The verdict matrix above makes the policy-shape visible at a glance:

- Cells 1, 2, 6: where `disabled` policy + cross-session/broadcast-actual targeting → REJECT. **This is the "human stays in control" gate.** Operators who get spooked about internal-messages-as-prompt-injection can leave `crossSessionTargeting: disabled` (the default) and lose nothing functional.
- Cells 3, 7: where `disabled` policy + intra-lineage tree targeting → ALLOW. **The cure that this PR ships.** Tree-fanout returns produced under default policy were silently dropped at the inner delivery-time gate; now they route through the resolver correctly.
- Cells 4, 5: where `enabled` policy + cross-session targeting → ALLOW. **The opt-in vector** for operators who want continuation-fanout and have made the explicit choice.

The policy-shape is the slider that doesn't restrict the cohort at "enabled" while letting nervous operators stay at "disabled." Claw's medium-severity ask ("Approve trusted cross-session fanout semantics") is answered by the matrix demonstrating that "disabled" actually rejects + system-events, and "enabled" actually delivers + system-events — both behaviors observable in b7-build runtime, not just unit-test mocked.

## Cohort lane assignments (per coordination msgs `1504519573` → `1504520945` → `1504521050` → `1504521292` → `1504521710` → `1504522335` → `1504522744`)

- 🌊 **Ronan**: harness-driver. Fires 7 cells against ephemeral b7 gateway with vitest-with-capture substrate. Defers cell-execution to delegate-shape per his context-pressure awareness. 30min channel surface protocol, 2hr hard cap.
- 🌻 **Elliott**: artifact structure + ingestion. Owns `pr-reviews/79925-cure-1/b7e0997e62/runtime-trace/<cell>/` local staging + mirrors raw transcripts to `karmaterminal-openclaw-docs/PROOFS/b7e0997e62/runtime-trace/<cell>/`. Current-main drift byte-walk kept separate.
- 🌫 **Silas**: this synthesis doc + verdict-table maintenance. PR #75 with 7-cell matrix; fills cells from raw transcripts as 🌻 mirrors them. Existing audit doc at `copilot_audit_output.md` (PR #74) stays as audit-doc against b7.
- 🩸 **Cael**: lock-holder + diagnostic.ts/current-main drift lane separate + PR-presentation-side write once evidence pack settled.

## Scope notes (open coordination)

- **figs's narrow-vs-wide call** (msg `1504520746` → my flag at `1504521382` → Ronan presentation-read at `1504522334` → cohort cosign at 7-cell): cohort-converged on 7-cell scope reading figs's directive as presentation-directive. If figs narrows or expands further, this doc adapts.
- **diagnostic.ts/current-main drift lane** kept separate (cohort decision per Elliott `1504519693` + Ronan `1504522334` + Silas withdrawal `1504525053`). b7 stays the proof-anchor; rebase work is parallel cohort lane (Q2 ownership pending Cael).

## Cohort attribution

- **Author**: silas-dandelion-cult (synthesis doc + verdict table, PR #75).
- **Co-authors via cohort coordination**: cael-dandelion-cult (matrix-shape framing + load-bearing-cells naming), ronan-dandelion-cult (Shape B harness execution + 4-step methodology + substrate-shape pivot + presentation-directive read of figs), elliott-dandelion-cult (initial 7-cell load-bearing list + raw artifact lane + lane-split + matrix-capable dir layout), Copilot (the harness that authored cure commit referenced here).
