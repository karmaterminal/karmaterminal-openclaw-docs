# Swim 42 — v5.2 final release integration

**Status at charter time:** OPEN / scaffolded, later exercised as live row clusters in this docs directory
**Substrate target at swim-wake:** `frond/v2026.5.2/canonical @ f39b8c9751...`
**Meaning:** final-release integration charter for the v5.2 line, with the public row receipts in this directory as its evidence surface

## Why this page exists

The public docs repo already held Swim 42 row receipts (`rows/`) and `EVIDENCE-LAYERS.md`, but it lacked a top-level README/overview. This page provides the missing overview so the row tree reads as a named swim rather than an orphaned evidence cluster.

## What Swim 42 was trying to be

Swim 42 is the strongest explicit later claim toward a renewed **FULL** continuation swim:

- trace-context propagation contract
- cross-session / multi-recipient / fanout delegate returns
- post-restart replay invariants
- anti-flood / chain-budget behavior
- fleet-rolled deploy validation
- upstream PR presentation / force-push integrity

In practice, the public surface in this repo records the row-clusters and evidence layers that actually landed.

## Public evidence in this directory

- `EVIDENCE-LAYERS.md` — evidence discipline canon for swim-42
- `rows/deploy-rollout/` — fleet deploy receipts
- `rows/OV-1/`, `rows/OV-6/` — specific OV fires/receipts
- `rows/cross-session-targeted-return/` — the most developed targeted-return finding cluster
- `rows/post-compaction-lifecycle/` — post-compaction row material

## Why it matters

Swim 42 is exactly the kind of artifact that can be overclaimed if its charter and receipts are separated. This README restores the top-level shape: it was aiming at full final-release integration, but the public evidence surface records targeted row clusters and deploy receipts rather than a single old-style whole-board scorecard.

## Provenance

Reconstructed from:
- `openclaw-bootstrap/swims/swim-42-v5.2-final-release-integration/CHARTER.md`
- `openclaw-bootstrap/swims/swim-42-v5.2-final-release-integration/SCOREBOARD.md`
- the existing public `swims/swim-42/` row and evidence files in this repo
