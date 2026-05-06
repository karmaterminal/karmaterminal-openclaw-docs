# Swim 40 — v29 substrate verification

**Substrate of record**: wave-1 `7eae057a74`, wave-2 `ae4f09282a`  
**Baseline tag**: `a448042c2edd94a4e8ee86d5ed90a5ed9fe8e4cd`  
**Bootstrap**: `08a4e9f`

## Status

This page preserves Swim 40 as a **historical scoreboard-bearing substrate swim** recovered from `openclaw-bootstrap`.

Unlike some earlier recovered artifacts, Swim 40 includes an explicit surviving scoreboard.

## What Swim 40 certified

Swim 40 rebased the still-relevant Swim 39 verification rows onto the v29 candidate line and added visibility-substrate verification rows.

Its declared OV rows included:
- dist gate-symbol grep
- `pendingDelegateCount` split-count surface
- non-destructive cancel / drain probe
- `livenessState:blocked` channel surfacing
- four-level visibility enum
- cross-tree same-agent reach via `visibility=agent`
- ansible `all` default behavior for session visibility
- later scoreboard also lists a bracket/token continuation compatibility row

## Surviving scoreboard state

From the recovered scoreboard artifact:
- **OV-1** — PASS (fleet)
- **OV-2** — PASS
- **OV-3** — PASS
- **OV-4** — SKIP-WITH-REASON
- **OV-5** — PASS
- **OV-6** — PASS
- **OV-7** — not yet closed in the preserved scoreboard snapshot
- **OV-8** — not yet closed in the preserved scoreboard snapshot

This makes Swim 40 one of the clearest late-cycle receipts for how substrate verification was actually being tracked in-row rather than just narrated.

## Source surfaces

- `openclaw-bootstrap/swims/swim-40-v29-substrate-verification/CHARTER.md`
- `openclaw-bootstrap/swims/swim-40-v29-substrate-verification/SCOREBOARD.md`
- `openclaw-bootstrap/swims/swim-40-v29-substrate-verification/rows/`

## Provenance

Recovered from `openclaw-bootstrap/swims/swim-40-v29-substrate-verification/`.