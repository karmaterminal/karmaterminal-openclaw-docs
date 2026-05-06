# Swim 5 — generation guard and chain-hop enforcement

**Date**: 2026-03-05
**Builds referenced**: `8a76e62fc`, `80ea0a366`, `fec5e4bfc`
**Result shape**: historical scorecard with live guard and chain findings
**Provenance class**: `appendix/branch-native` — backed by surviving in-tree or RFC-history evidence on the openclaw fork (or recovered from the `ronan/rfc-evidence-appendix` frozen branch). See `swims/README.md` for the full provenance-class definitions and `swims/HISTORY.md` for the archive-surface map.


## Status

This page preserves historical continuation evidence recovered from `openclaw-bootstrap` archive material.

It is historical evidence, not the current validation cycle.

## What this swim established

- generation-guard preemption was proven live after the `isDelegateWake` fix
- chain-hop tracking and `maxChainLength` enforcement were exercised through repeated live runs
- `sessions_spawn` and bracket-based chain hops were shown to have different bounding behavior

## Key historical results

### Test 5-0 — Generation Guard
- happy-path timer fire: PASS
- preemption initially failed under a misclassified delegate wake
- root cause was traced to `isDelegateWake` misclassification
- fix landed in `8a76e62fc`
- round-3 rerun confirmed timer cancellation after a real inbound message

### Test 5-1 / 5-6 — Chain-hop bounds
- early runs showed reliable chain dispatch but incomplete enforcement
- later build `fec5e4bfc` confirmed the hard cap live:
  - hop 1 ✅
  - hop 2 ✅
  - hop 3 ✅
  - hop 4 ✅
  - hop 5 ❌ rejected at the chain limit

## Why this matters historically

Swim 5 is one of the earliest strong proofs that continuation timing and chain accounting were not just design claims — they were exercised against live gateway behavior and refined through real failures.

## Source artifacts

Recovered from `openclaw-bootstrap`:
- `SWIM/history/SWIM5-STATUS.md`
