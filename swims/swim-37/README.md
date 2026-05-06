# Swim 37 — pre-ship validation of `feature/context-pressure-squashed`

**Status in source artifact**: ACTIVE scaffold / deploy-gate era  
**Candidate**: `karmaterminal/openclaw:feature/context-pressure-squashed`  
**Baseline tag**: `v2026.4.21`
**Provenance class**: `bootstrap-pointer` — public surface evacuated from `karmaterminal/openclaw-bootstrap` (e.g. `swims/swim-NN-…/`, `SWIM/history/`); bootstrap remains the source-of-truth body for this swim. See `swims/README.md` for the full provenance-class definitions and `swims/HISTORY.md` for the archive-surface map.


## Status

This page preserves Swim 37 as a **historical pre-ship validation artifact** recovered from `openclaw-bootstrap`.

It is not a tiny OV cluster. The bootstrap charter explicitly says stabilization / pre-ship swims run the **whole declared board** unless a real blocker exists.

## Load-bearing idea

Swim 37 sharpened an operational truth that later mattered a lot:

> **the swim is the deploy**

The charter treats the sequenced deploy to all four princes, with traces visible and behavior exercised against the declared board, as the case itself.

## Why Swim 37 matters

Swim 37 helps bridge the historical full-board era to the later substrate-era verification language. The companion feature-coverage map explicitly tries to make the continuation feature readable as a **feature map by title alone**, including:
- continuation primitives
- OTEL / diagnostics
- session delivery queue
- chain budget
- cross-session routing
- drain / permission gating
- tool registry
- static guards
- config schema

That makes Swim 37 one of the clearest surviving statements of what a continuation swim was trying to certify at ship time.

## Source surfaces

- `openclaw-bootstrap/swims/swim-37/CHARTER.md`
- `openclaw-bootstrap/swims/swim-37/FEATURE-COVERAGE.md`
- `openclaw-bootstrap/swims/swim-37/CASES.md`

## Provenance

Recovered from `openclaw-bootstrap/swims/swim-37/`.