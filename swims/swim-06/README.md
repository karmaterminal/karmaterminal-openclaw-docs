# Swim 6 — three-layer continuation canary validation

**Cycle window**: overnight canary cycle on 2026-03-06
**SUT**: three-layer continuation architecture canary
**Build**: `3a03f4658`
**Formation**: 4-node fleet / persistent multi-agent canary
**Result**: 11 PASS · 1 FAIL (fix applied during cycle) · 2 DEFERRED

## Status

This swim is retained as **historical behavioral evidence** for the continuation feature. It predates the public docs-repo era; this page is a recovery of material that previously lived only inside the historical RFC appendix and the frozen evidence branch `ronan/rfc-evidence-appendix` on `karmaterminal/openclaw`.

It is not the current validation cycle; [Swim 41](../swim-41/README.md) and [Swim 42](../swim-42/EVIDENCE-LAYERS.md) are later substrate-era rechecks.

## Summary

Swim 6 was the first documented canary cycle after the three-layer continuation architecture landed. The build under test (`3a03f4658`) validated the shift away from queue-text inference toward typed continuation trigger metadata and explicit post-compaction delegate state.

The cycle exercised 13 scenarios across blind enrichment, queue-drain resistance, return-to-fresh-session behavior, chain-depth enforcement, width enforcement, legacy token hygiene, error handling, and flood behavior. One real correctness defect was found live: **`maxChainLength` was off by one**. That fix was applied during the cycle; the final scorecard therefore records one fail-with-fix-applied rather than a clean all-pass run.

## Detailed scorecard

| Test | Description | Result |
| ---- | ----------- | ------ |
| 6-1 | Blind enrichment | ✅ PASS |
| 6-2 | Queue-drain resistance | ✅ PASS |
| 6-3 | Post-compaction recall | ⏸️ DEFERRED |
| 6-4 | Return-to-fresh-session (3/3 shards) | ✅ PASS |
| 6-5 | Context-pressure lifecycle | ⏸️ DEFERRED |
| 6-6 | 3-hop chain + visible announce | ✅ PASS |
| 6-7 | Chain length enforcement | ❌ FAIL → fixed during cycle |
| 6-7b | Fan-out cap (`maxDelegatesPerTurn`) | ✅ PASS |
| 6-8 | Legacy token hygiene | ✅ PASS |
| 6-9a | Missing file (graceful ENOENT) | ✅ PASS |
| 6-9b | Slow shard (69s, completes independently) | ✅ PASS |
| 6-9c | Empty task (tool-level rejection) | ✅ PASS |
| 6-10 | Flood test / three-layer defense | ✅ PASS |

## Key findings

- **P0 — chain length off-by-one:** `maxChainLength: 10` allowed 12 shards. The canary fix changed the announce-side comparison and unified chain-hop counting across tool and bracket paths.
- **Tolerance closure bug:** generation-guard tolerance was captured too early in a timer closure, so hot-reload changes were not observed at fire time.
- **Width hot-reload gap:** `maxDelegatesPerTurn` originally behaved like a startup-time constant instead of a dynamic config read.
- **Three-layer defense shape:** a flood case showed the value of layered enforcement: tool gate, runner gate, and spawn gate each constrained fan-out.

More detail is preserved in [FINDINGS.md](./FINDINGS.md).

## Why this is in the public evidence repo

Before `karmaterminal-openclaw-docs` existed, historical swim evidence lived in a mix of RFC appendix text, branch-local notes, and frozen evidence branches. Swim 6 was one of the cycles that became hard to point at publicly once the RFC appendix was later trimmed.

This page recovers the scorecard and the key defect/fix narrative into the public evidence surface so the historical continuation test record no longer jumps from early public artifacts straight to much later swims.

## Provenance

Recovered from the historical frozen evidence branch **`ronan/rfc-evidence-appendix`** in `karmaterminal/openclaw`, especially the older `docs/design/continue-work-signal-v2.md` appendix section and the branch-local `SWIM6-FINDINGS.md` file.