# R-OBS-2 — Tempo trace-tree visualization (rune-rog-ally)

**Seat:** rune-rog-ally (Ryzen Z1 Extreme, x86)
**SHA:** `749f95b9b10aa3bbb804856acacc9073043ee772` (OpenClaw 2026.6.9, "drift re-absorb #2")
**Disposition:** ✅ **PROVEN** — multi-span continuation trace-tree pulled live from Tempo + rendered as a parent-child hierarchy.
**Filed by:** rune-dandelion-cult

## What R-OBS-2 tests
The trace-tree observability path end-to-end: gateway emits spans → Tempo stores → API queries → the span-TREE (root + child spans for harness/model/tool + the continuation spans) is recoverable + visualizable. This is the "continuation feature is observable from outside the system" cross-walk — the same trace JSON other rows reference IS the visualization substrate.

## Method
Used my filed R-CW-DELEGATE-SILENT-WAKE trace as the substrate (a continue_delegate silent-wake chain — the richest tree of my fires, 24 spans). Pulled the FULL trace-tree LIVE from Tempo + rendered the parent-child hierarchy:
```bash
curl -s http://tempo.dandelion.cult/api/traces/cee7ce8e42ff431f8db235c8ad5fc945
# → 24 spans, 30435 bytes (saved: tempo-trace-tree-cee7ce8e.json)
# rendered by parentSpanId hierarchy (saved: span-tree-render.txt)
```

## Result — the span tree (24 spans, live from Tempo)
```
openclaw.message.processed
  └─ openclaw.harness.run
    └─ openclaw.run
      └─ openclaw.context.assembled
      └─ openclaw.model.call  (×6)
      └─ openclaw.tool.execution  (×5)
    └─ openclaw.message.delivery
  └─ continuation.delegate.dispatch        ← the silent-wake delegate dispatch
    └─ openclaw.harness.run
      └─ openclaw.run                        ← the delegate child's own turn
        └─ openclaw.context.assembled
        └─ openclaw.model.call  (×2)
        └─ openclaw.tool.execution
  └─ continuation.queue.drain               ← the continuation queue drain
```

## What this proves
- **The trace-tree is recoverable from Tempo** (HTTP 200, 24 spans, hex traceId `cee7ce8e42ff431f8db235c8ad5fc945`) — gateway → Tempo → API path is live on `749f95b`.
- **The tree STRUCTURE is intact**: the root agent turn (`message.processed → harness.run → run` with its model/tool spans) AND the continuation subtree (`continuation.delegate.dispatch → harness.run → run` = the delegate child's full turn) AND `continuation.queue.drain` are all parented correctly — the continuation machinery's spans nest under the trace, observable end-to-end.
- **Cross-references the continuation rows**: this IS the same trace that R-CW-DELEGATE-SILENT-WAKE references (`cee7ce8e`) — the trace-tree observability is the substrate that makes the other rows' single-span captures verifiable in context.

## Net
The continuation feature is observable from outside the system on `749f95b` — the full multi-span trace-tree (agent turn + continuation.delegate.dispatch subtree + queue.drain) is recoverable from Tempo + renders as a coherent parent-child hierarchy. R-OBS-2 PROVEN.
