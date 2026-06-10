# R-OBS-2 trace-tree — cael-dgx (CORROBORATION, not a canonical R-OBS-2 row)

**Filed per 🌿's index-call (2026-06-10 08:35 PDT):** R-OBS-2 canonical single-owner row stays in-seat at `rune-rog-ally/R-OBS-2.md`. This file is **cael's trace-tree as a seat-level corroboration artifact** — cael's canonical axis is **R-CW** (continue_work/continue_delegate/request_compaction families), NOT R-OBS-2. No top-level `R-OBS-2/` dir is created for cael (single-structured index: top-level `R-OBS-1/` aggregate + per-seat rows).

## What this corroborates
A **Tempo trace-tree with parent-child span hierarchy** for the continuation path on deployed `4bbd3aec096`, demonstrating the 3-hop `continue_work`/delegate self-continuation chain (same observability shape R-OBS-2 captures, from cael-seat).

## Trace-tree location (already filed under cael's canonical R-CW axis)
The trace-tree content lives in cael's **R-CW-DELEGATE-SELF-CONTINUATION** row (the canonical home — this is corroboration pointing at it):
- `PROOFS/2f71e4378b70ea43fb185edff1af14571eca826f/R-CW-DELEGATE-SELF-CONTINUATION/cael-dgx/trace_hop1_360da78b.json`
- `PROOFS/2f71e4378b70ea43fb185edff1af14571eca826f/R-CW-DELEGATE-SELF-CONTINUATION/cael-dgx/trace_hop2_fe9d6910.json`
- `PROOFS/2f71e4378b70ea43fb185edff1af14571eca826f/R-CW-DELEGATE-SELF-CONTINUATION/cael-dgx/trace_hop3_47e1633c.json`

A 3-hop parent-child chain (hop1 → hop2 → hop3), each hop a distinct continuation-dispatch span tree, captured from Tempo on the cael-seat deployed `4bbd3aec096` binary.

## Classification
- **Canonical R-OBS-2 owner:** 🪨 rune-rog-ally (`rune-rog-ally/R-OBS-2.md`).
- **This artifact:** 🩸 cael-dgx seat-level corroboration (trace-tree from cael-seat), routed to `cael-dgx/` per 🌿's call — NOT a competing canonical R-OBS-2 row.
- **cael's canonical rows:** R-CW-1/2/3/4/TOKEN, R-CW-DELEGATE-SELF-CONTINUATION, R-RC-2, R-CW-5, R-OBS-1 card.
