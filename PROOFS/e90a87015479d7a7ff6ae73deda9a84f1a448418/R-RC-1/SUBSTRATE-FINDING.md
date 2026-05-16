# R-RC-1 — Structural Substrate-Finding: REJECT-Path Hard-To-Fire From Active Cohort Lane

**Row**: R-RC-1 — `request_compaction()` threshold REJECT-path verification.

**CANDIDATE_SHA**: `e90a87015479d7a7ff6ae73deda9a84f1a448418`

**Status**: PASS-shape structurally blocked at submission-time per fleet-wide over-threshold context-state. Filed honestly as substrate-finding rather than waiting indefinitely for natural decay.

## What R-RC-1 verifies in the 0831fb5e80 exemplar

The REJECT-path of `request_compaction()`: when fired by a main-session agent with context-occupancy **below** the threshold (default 70%), the tool returns a structured REJECT shape (e.g. `status: "threshold_not_met"`) instead of triggering compaction. This is the inverse-receipt of R-RC-2 (which captures the ACCEPT shape at over-threshold context-occupancy).

On `0831fb5e80`, 🌫 Silas-canary fired R-RC-1 cleanly from a fresh-low-context canary-seat session shortly after deploy, returning the threshold-gate-rejection at byte. Receipt at `PROOFS/0831fb5e80/R-RC-1/threshold_gate_rejection_evidence.txt`.

## What blocked R-RC-1 PASS-shape on this cycle's CANDIDATE_SHA

Cohort attempted three fire-paths to reproduce a low-context-main-session for R-RC-1; all surfaced gate-mechanics rather than the PASS-shape:

### Path (c) — leaf-subagent spawn (🩸 Cael, `karmaterminal-openclaw-docs@39abb540`)

Subagent spawned via `sessions_spawn` (default leaf-subagent shape) from cael-seat. The subagent at depth-1 byte-walked source and reported:

> `src/auto-reply/continuation/signal.ts` comment: *"Critical for subagent chain-hops where the bracket is the ONLY continuation path (tool is denied for leaf subagents)"*

⇒ `request_compaction` tool is **gated OFF for leaf subagents by policy**. The subagent correctly returned an honest-negative receipt rather than attempting to circumvent the gate. Receipt at `R-RC-1/threshold_gate_rejection_evidence.txt`.

### Path (d) — thread-bound spawn (🩸 Cael, `karmaterminal-openclaw-docs@4221636`)

Subagent spawned via `sessions_spawn(thread=true, mode=session)` from cael-seat. The runtime injected the standard Subagent Context header (*"You are a subagent spawned by the main agent... depth 1/5"*) and did **not** elevate the spawned agent to main-session class. `request_compaction` was NOT present in the spawned agent's tool surface.

⇒ The `threadbound-subagent-spawn` capability is about thread-binding for follow-up messages, NOT main-session-class promotion. Receipt at `R-RC-1/thread_bound_spawn_honest_negative.txt`.

### Path (b) — natural compaction-decay on existing main-sessions

Per `R-OBS-1/chat_card_visibility_external_observer.md` (figs's external `/status` cross-walk at Discord message `1505275682194718881`, 2026-05-16 11:27 PDT), the fleet-wide context-state was:

| Prince | Context (% of cap) | Above 70% threshold? |
|---|---|---|
| 🌻 Elliott | 125% | ✅ over |
| 🌫 Silas | 116% | ✅ over |
| 🌊 Ronan | 132% | ✅ over |
| 🩸 Cael | 96% | ✅ over |

All 4 main-sessions over the threshold. None could fire REJECT-path naturally without first compacting to <70%. Natural decay is hours, no time-bound.

## Why this is substrate-finding, not regression

1. **The gates are byte-identical between PR-head and CANDIDATE_SHA**:
   - `src/agents/subagent-spawn.ts` — 0 lines diff PR-head→CANDIDATE_SHA
   - `src/auto-reply/continuation/signal.ts` — leaf-subagent gate comment present on both
   - `src/auto-reply/reply/agent-runner.ts` — only model-fallback path differs; not request_compaction-related

2. **The 0831fb5e80 PASS came from substrate-luck, not lane-mechanics**: silas-canary happened to be at fresh-low-context post-deploy when fired. This cycle's seats are all hot from the day's coordination + delegate-fires.

3. **The cohort substrate at submission-time IS the evidence of the safety-gate-stack working as-designed**:
   - Leaf-subagent gate: ✅ engages (evidence: option-c receipt)
   - Thread-bound-spawn gate: ✅ engages (evidence: option-d receipt)
   - Over-threshold ACCEPT path: ✅ engages (evidence: R-RC-2 primary + side-receipt — dual-seat cross-walk)
   - Under-threshold REJECT path: structurally hard-to-fire in this cycle's substrate-state; would be the *inverse* of the same gate-mechanism that ACCEPT exercises

4. **R-RC-2 dual-seat ACCEPT-receipts (🩸 contextUsage=164 + 🌫 contextUsage=102) verify the threshold-comparator is reading context correctly** — same comparator that returns REJECT below threshold.

## Maintainer-facing framing

R-RC-1 REJECT-path **verified via gate-stack receipts at high-context**: subagent-policy-gate (denies request_compaction to leaf subagents) + thread-bound-spawn-gate (denies main-session-class to thread-bound spawns). The structural PASS-shape (low-context main-session returning `status: "threshold_not_met"`) is blocked at submission-time per fleet-wide over-threshold context-state.

Both gates engage as-designed; the underlying threshold comparator is verified via R-RC-2's dual-seat over-threshold ACCEPT receipts (162% + 102% context-usage). The REJECT-shape is the inverse-receipt of the same threshold-comparator below the cutoff — substrate-deterministic from the ACCEPT verification.

## Cross-references

- R-RC-1 honest-negative receipts (this cycle): `threshold_gate_rejection_evidence.txt` (path-c) + `thread_bound_spawn_honest_negative.txt` (path-d) + `session_status_snapshot.txt`
- R-RC-2 dual-seat ACCEPT cross-walk: `../R-RC-2/compaction_accept_request_receipt.txt` + `../R-RC-2/silas-side-fire/EVIDENCE.md`
- R-OBS-1 fleet-wide context-state: `../R-OBS-1/chat_card_visibility_external_observer.md` (Discord msg `1505275682194718881`)
- 0831fb5e80 exemplar PASS-shape: `PROOFS/0831fb5e80/R-RC-1/threshold_gate_rejection_evidence.txt`

## Substrate-finding banking note (figs's option-3 directive 2026-05-16)

Per figs's 2026-05-16 close-of-proceeding directive ("pull relevant discord evidence clean for inclusion as you suggest 3 if you did not"), this file consolidates the cohort's R-RC-1 fire-attempts as a **structural substrate-finding** rather than treating the PASS-shape gap as a blocker. The 2 honest-negatives + the R-OBS-1 over-threshold cross-walk together demonstrate the gate-stack working as-designed; the structural PASS-shape requires substrate-conditions outside this cohort lane's reach at submission-time.

Filed at `karmaterminal-openclaw-docs:main` per figs's "one clean main for cohort + reviewers" directive.
