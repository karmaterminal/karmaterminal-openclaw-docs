# R-CW-5: cost-cap exhaustion → dispatch-time reject — ⚠️ RE-CLASSIFIED: PROVABLE (method noted, was wrongly "honest-limit")

Seat: cael (🩸) / cael-dgx · Build: OpenClaw 2026.6.2 (2807efc)

## ⚠️ CORRECTION (figs directive 2026-06-05 `1512615687`)
The earlier "structurally-blocked / forcing-500k-is-wasteful / HONEST-LIMIT" framing below was **WRONG** — a methodological oversight. **R-CW-5 IS cheaply provable.** The cost-cap is a **config value** (`agents.defaults.continuation.costCapTokens`), not a fixed 500k you must accumulate against. You do NOT burn 500k tokens of real work — you **temporarily LOWER the cap.**

## METHOD (figs canon — note for any future proof-spawn from this corpus)
> *"typically we have in the past set the cost cap really low to trip it in like 2-3 continue delegates. then set it back up to normal again once we're done testing."*

Concretely:
1. Set `agents.defaults.continuation.costCapTokens` to a tiny value (low enough to trip after ~2-3 `continue_delegate`/`continue_work` dispatches).
2. Fire 2-3 continuations → the chain's accumulated cost exceeds the lowered cap → **dispatch-time REJECT fires** → capture the reject receipt + the cost-cap rejection reason/trace = the proof.
3. **RESTORE** `costCapTokens` to normal (500000 on cael-dgx) immediately after — do NOT leave the cap lowered.

⚠️ Safety: this is a reversible config-change that MUST be restored. Do it in a STABLE window (not near auto-compaction) so the restore step is guaranteed to run — a compaction mid-test could otherwise leave the lowered cap in place.

## Canonical behavior (unchanged)
continue_work / continue_delegate dispatch is rejected when the chain's accumulated cost exceeds `costCapTokens`. The gate exists + is enforced; cure-source byte-identical between assembly `2807efc1c1e` and presentation-head `9d07233` (#923 touches only the L627 inventory-warn, NOT chain-cost gating) → NOT a cure-regression.

## Current status: ⏳ CAPTURABLE (not honest-limit) — pending a stable-window capture
R-CW-5 is re-classed from "genuine honest-limit" to **"provable via the lower-the-cap method, pending capture in a stable (non-near-compaction) window."** Whoever takes it (cael or rune, post-compaction): lower the cap, trip in 2-3 dispatches, capture the reject, restore. That converts R-CW-5 from the last open honest-limit to a clean ✅ PASS — closing the corpus's last genuinely-takeable row.

## Maintainer framing (corrected)
"R-CW-5 (cost-cap dispatch-reject): gate exists + enforced, byte-identical vs presentation-head (NOT cure-regression). PROVABLE via temporarily lowering `costCapTokens` to trip in 2-3 dispatches then restoring (figs method `1512615687`) — re-classed from honest-limit to capturable-pending-stable-window. The prior 'forcing 500k is wasteful' framing was a methodological oversight: you lower the CAP, you don't accumulate the cost."
