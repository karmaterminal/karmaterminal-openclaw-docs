# PR #79925 cure-(1) — live-runtime proof matrix at b7e0997e62

**Anchored to PR head `b7e0997e62cddef4ab73613a4741491477bccc77`**
**(2026-05-14, 🌫 Silas, in response to figs's directive `1504513184` + clawsweeper critique that "current-head live runtime proof for the latest cross-session gate behavior is still not clearly visible")**

> **STATUS: SKELETON.** Awaiting transcript drops from 🌊 Ronan's harness (per cohort coordination msgs `1504519571` → `1504519693` → `1504519868` → `1504520945` → `1504521292`). Cells will be filled with verdicts + transcript links as raw transcripts land at `PROOFS/b7e0997e62/runtime-trace/<cell>/`.
>
> **Note on scope**: figs's pivot at `1504520746` ("gather full set", "overwhelm them with evidence") is open with cohort interpretation pending (msg `1504521382` flag, awaiting figs refinement). This skeleton starts with the 7 load-bearing transition cells per 🌻 Elliott + 🌊 Ronan + 🌫 Silas's converged Shape B vote. If figs confirms "full set" = wider matrix (~50-60 cells per 🩸 Cael's `2 config × 7 targeting × 6 gate-sites` framing), this skeleton expands to additional rows; existing 7 cells remain valid as load-bearing subset.
>
> **Note on substrate SHA**: figs's pivot also asks for "updates to current main tip", which would mean rebase b7 → b7' (resolve `src/logging/diagnostic.ts` drift, +124/-8 per Elliott's byte-walk msg `1504519693`) and re-anchor proofs at b7'. Q2 (rebase ownership) open with 🩸 Cael. If b7' lands, this skeleton + PR re-anchor cleanly.

## Provenance

- **Anchored to**: `b7e0997e62` (PR #79925 head on `karmaterminal/openclaw:frond-scribe-claude/20260509/narrow-surgery-tight`).
- **Build**: `OpenClaw 2026.5.12-beta.1 (b7e0997)` ephemeral-process from 🌊's `/tmp/oc-79925-walk/repo/openclaw.mjs` (no fleet-deploy needed; isolated `OPENCLAW_STATE_DIR` per cell).
- **Companion artifacts**:
  - `PROOFS/b7e0997e62/copilot_audit_output.md` — 10-path immaterial-gates audit (PR #74).
  - `PROOFS/b7e0997e62/runtime-trace/<cell>/` — raw transcripts, per-cell (🌻 Elliott's lane).
  - `pr-reviews/79925-cure-1/b7e0997e62/runtime-trace/<cell>/` — 🌻's local staging mirror.

## Methodology

For each cell:
1. Spawn isolated b7 gateway process with policy-config baked in (`crossSessionTargeting:disabled` or `enabled`).
2. Drive the cell's continuation flow via openclaw CLI (continuation tool / bracket / chain-hop, per cell shape).
3. Capture: (a) gateway debug-log slice showing decision trace, (b) tempo/otel spans if reachable, (c) commands-run.txt with exact invocation, (d) verdict (REJECT with system event / ALLOW with delivery confirmation).
4. Tear down isolated state between cells to avoid cross-contamination.

Per 🌊's plan (msg `1504521292`).

## Verdict matrix — 7 load-bearing cells

Each cell verifies a specific gate-site decision at b7e0997e62 head, under a specific policy. Load-bearing = the cell's verdict is the difference between cure-shipped-honest and cure-shipped-broken. (Trivial-allow cells like `disabled+self+default` are covered by unit tests + audit table; not duplicated here.)

| # | Cell | Gate site | Policy | Targeting | Expected | Actual | Transcript |
|---|------|-----------|--------|-----------|----------|--------|------------|
| 1 | `tool-entry / disabled / other-key` | `continue-delegate-tool.ts` tool entry | `crossSessionTargeting: "disabled"` | `targetSessionKey: "<other-prince>"` | **REJECT** with policy-rejected system event | _pending_ | _pending_ |
| 2 | `tool-entry / disabled / fanout-all` | `continue-delegate-tool.ts` tool entry | `crossSessionTargeting: "disabled"` | `fanoutMode: "all"` | **REJECT** with policy-rejected system event | _pending_ | _pending_ |
| 3 | `tool-entry / disabled / fanout-tree` (the cure) | `continue-delegate-tool.ts` tool entry → through resolver to delivery | `crossSessionTargeting: "disabled"` | `fanoutMode: "tree"` | **ALLOW** + delivered to tree members | _pending_ | _pending_ |
| 4 | `tool-entry / enabled / other-key` | `continue-delegate-tool.ts` tool entry → delivery | `crossSessionTargeting: "enabled"` | `targetSessionKey: "<other-prince>"` | **ALLOW** + delivered to target with trusted system event | _pending_ | _pending_ |
| 5 | `tool-entry / enabled / fanout-all` | `continue-delegate-tool.ts` tool entry → delivery | `crossSessionTargeting: "enabled"` | `fanoutMode: "all"` | **ALLOW** + delivered to all known sessions on host | _pending_ | _pending_ |
| 6 | **`chain-hop / disabled / fanout-all`** (the new b7 gate) | `subagent-announce.ts:253` `rejectCrossSessionTargetingForSubagentDispatch` | `crossSessionTargeting: "disabled"` | child emits `[[CONTINUE_DELEGATE: ... \| all]]` mid-chain-hop | **REJECT** before `spawnSubagentDirect`, with system event explaining rejection + task name | _pending_ | _pending_ |
| 7 | **`chain-hop / disabled / fanout-tree`** (the new b7 gate, allow-path) | `subagent-announce.ts:253` `rejectCrossSessionTargetingForSubagentDispatch` | `crossSessionTargeting: "disabled"` | child emits `[[CONTINUE_DELEGATE: ... \| tree]]` mid-chain-hop | **ALLOW** + chain-hop dispatch proceeds to next sub-agent | _pending_ | _pending_ |

Cells 6 and 7 are the **load-bearing-est**: the chain-hop gate at `subagent-announce.ts:253` is **NEW on `b7e0997e62`**. No earlier PROOFS bundle could have evidenced it because the gate didn't exist. Claw's critique ("current-head live runtime proof for the latest cross-session gate behavior is still not clearly visible") points at cells 6+7 specifically.

## Policy-shape legibility (per 🩸's framing in msg `1504519217`, reflecting figs's parenthetical in `1504513184`)

The verdict matrix above makes the policy-shape visible at a glance:

- Cells 1, 2, 6: where `disabled` policy + cross-session-actual targeting → REJECT. **This is the "human stays in control" gate.** Operators who get spooked about internal-messages-as-prompt-injection can leave `crossSessionTargeting: disabled` (the default) and lose nothing functional.
- Cells 3, 7: where `disabled` policy + intra-lineage tree targeting → ALLOW. **The cure that this PR ships.** Tree-fanout returns produced under default policy were silently dropped at the inner delivery-time gate; now they route through the resolver correctly.
- Cells 4, 5: where `enabled` policy + cross-session targeting → ALLOW. **The opt-in vector** for operators who want continuation-fanout and have made the explicit choice.

The policy-shape is the slider that doesn't restrict the cohort at "enabled" while letting nervous operators stay at "disabled." Claw's medium-severity ask ("Approve trusted cross-session fanout semantics") is answered by the matrix demonstrating that "disabled" actually rejects + system-events, and "enabled" actually delivers + system-events — both behaviors observable in live gateway runtime, not just unit-test mocked.

## Cohort lane assignments (per coordination msgs `1504519573` → `1504520945` → `1504521050` → `1504521292`)

- 🌊 **Ronan**: harness-driver. Fires 7 cells against ephemeral b7 gateway, captures raw artifacts per cell. Defers cell-execution to delegate-shape per his context-pressure awareness (msg `1504521292`).
- 🌻 **Elliott**: artifact structure + ingestion. Owns `pr-reviews/79925-cure-1/b7e0997e62/runtime-trace/<cell>/` local staging + mirrors raw transcripts to `karmaterminal-openclaw-docs/PROOFS/b7e0997e62/runtime-trace/<cell>/`.
- 🌫 **Silas**: this synthesis doc + verdict-table maintenance. Pre-stages skeleton (now), fills cells from raw transcripts as 🌻 mirrors them. Existing audit doc at `copilot_audit_output.md` (PR #74) folds into same proof bundle when bundle is complete.
- 🩸 **Cael**: Q2 open — diagnostic.ts rebase ownership pending. Force-push lock-holder for any PR-substrate destructive write.

## Scope notes

- **figs's "full set" pivot still pending refinement** (msg `1504521382` flag → figs response). If figs confirms wider matrix (~50-60 cells), additional rows append below; existing 7 cells remain valid as load-bearing subset of full matrix.
- **"current main tip" rebase pending Cael's Q2 call**. If b7 → b7' rebase happens, this doc + raw transcripts re-anchor to b7'; existing skeleton structure scales unchanged.

## Cohort attribution (synthesis doc, this file)

- **Author**: silas-dandelion-cult.
- **Co-authors via cohort coordination**: cael-dandelion-cult (matrix-shape framing), ronan-dandelion-cult (Shape B harness execution + 4-step methodology), elliott-dandelion-cult (7-cell load-bearing list + raw artifact lane + lane-split), Copilot (the harness that authored cure commit referenced here).
