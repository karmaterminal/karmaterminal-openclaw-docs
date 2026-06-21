# R-OBS-2 — Tempo trace-tree visualization + parent-child span hierarchy export — rune-rog-ally seat

**Verdict: ✅ PASS** — full parent-child span hierarchy exported from Tempo for a live continuation chain on the deployed fix.

- **Seat:** `rune-rog-ally` (ASUS ROG Ally Z1 Extreme, 16GB CachyOS x86_64)
- **Ship SHA:** `93ace21341bf13a08f9bf75791f8ac70cf9542a5`
- **Trace-id:** `9327d6531a29ebb9ad56e2ffba70a24f` (Tempo: `http://tempo.dandelion.cult/api/traces/9327d6531a29ebb9ad56e2ffba70a24f`)
- **Source fire:** the R-CW-DELEGATE-SELF-CONTINUATION delegate-child self-continuation (2026-06-21 01:09:59–01:10:20 PDT)
- **Artifacts:** `span_hierarchy_tree.txt` (the exported parent-child tree), `selfcont_trace.json` (the full 32-span Tempo trace JSON, in the R-CW-DELEGATE-SELF-CONTINUATION row dir)

## The exported span hierarchy (32 spans, parent-child tree)

```
- openclaw.message.processed                          ← the originating turn (fired continue_delegate)
  - openclaw.harness.run
    - openclaw.run                                    ← parent turn
      - openclaw.context.assembled
      - openclaw.model.call  ×N / openclaw.tool.execution ×N
    - openclaw.message.delivery
  - continuation.delegate.dispatch                    ← the continue_delegate spawn
    - openclaw.harness.run
      - openclaw.run                                  ← the CHILD's hop-1 turn (nested under dispatch)
        - openclaw.context.assembled
        - openclaw.model.call ×N / openclaw.tool.execution ×N
  - continuation.work                                 ← the child's continue_work election
```

This demonstrates the load-bearing parent-child stitching figs's 2026-05-16 traces-as-load-bearing directive requires: the originating turn → `continuation.delegate.dispatch` → the child's nested `openclaw.run` → `continuation.work`, all in one trace-tree. The span hierarchy is byte-extracted (parentSpanId references resolve into the tree above), not screenshot-only.

## Disposition

PASS. The Tempo trace-tree for a live continuation chain on the deployed ship SHA exports cleanly with full parent-child span hierarchy. Stone-axis-substrate-of-record-witness shape: the trace IS the durable record of the continuation behavior, and its hierarchy is exported + byte-stitched here.
