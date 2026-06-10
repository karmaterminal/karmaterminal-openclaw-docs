# R-OBS-2 — Tempo trace-tree visualization + parent-child span hierarchy export

**SHA (deployed):** `4bbd3aec096545992d6535f4ba96c3bd71414ed3`
**Seat:** rune-rog-ally · **Owner:** 🪨 Rune (stone-axis substrate-of-record-witness)
**Verdict:** ✅ PASS
**Captured:** 2026-06-10 ~04:46 PDT (LIVE trace from deployed gateway `OpenClaw 2026.6.2 (4bbd3ae)`)

## Behavior under test
Per figs's 2026-05-16 traces-as-load-bearing directive: capture the actual Grafana Tempo trace-tree for a continuation fire on the deployed runtime, exporting the parent-child span hierarchy (the visualization that proves OTel span-stitching is intact end-to-end).

## Source trace
`http://tempo.dandelion.cult/api/traces/e24be71c248340247251119fb1070348` → HTTP 200, **54 spans**, service.name=`rune-prince`, deployed `4bbd3aec096`. Raw trace JSON exported alongside this row: `R-OBS-2_trace_e24be71c.json` (61571 bytes).

## Parent-child span hierarchy (the exported tree)
Reconstructed from the live Tempo trace via span/parentSpan linkage:

```
openclaw.message.processed              span=V4FddKgVXCY=   (ROOT — dispatching turn processed)
├─ openclaw.harness.run                 span=2rGXs9zun5U=   (parent V4FddKgVXCY=)
│  └─ openclaw.run                      span=00rB4b60gK4=   (parent 2rGXs9zun5U=)   ← DISPATCHING TURN
│     ├─ openclaw.context.assembled     span=UbXFTMinAFo=
│     ├─ openclaw.model.call            ×N (dispatching turn's model calls)
│     └─ openclaw.tool.execution        ×N (dispatching turn's exec/curl/write/message)
└─ continuation.delegate.dispatch       span=jwouDSghcZk=   (parent V4FddKgVXCY=)   ← THE DISPATCH
   └─ openclaw.harness.run              span=+VWgT4BbTy8=   (parent jwouDSghcZk=)    ← DELEGATE SPAWN
      └─ openclaw.run                   span=M5jkpnbcK3k=   (parent +VWgT4BbTy8=)    ← DELEGATE EXEC
         └─ openclaw.context.assembled  span=0LpgmWN+0is=   (parent M5jkpnbcK3k=)
```

## What the tree proves (substrate-witness reading)
- **Two-branch stitch under one root**: the dispatching turn (`harness.run 2rGXs9zun5U= → run 00rB4b60gK4=`) and the dispatched delegate (`harness.run +VWgT4BbTy8= → run M5jkpnbcK3k=`) are BOTH children of the same root trace, with the delegate branch rooted at `continuation.delegate.dispatch jwouDSghcZk=`.
- **The continuation boundary is span-stitched, not severed**: `continuation.delegate.dispatch` is the direct parent of the delegate's `harness.run`, which parents the delegate's `run`. The OTel context flows dispatch → spawn → exec with intact parent-child links — exactly the multi-span parent-stitching figs's directive made load-bearing (departure from the 0831fb5e80 exemplar which tracked stitching as separate follow-up).

## Span-kind census (54 spans total)
```
openclaw.tool.execution     : 26
openclaw.model.call         : 18
openclaw.harness.run        :  2   (dispatching turn + delegate)
openclaw.run                :  2   (dispatching turn + delegate)
openclaw.context.assembled  :  2   (dispatching turn + delegate)
openclaw.message.delivery   :  2
openclaw.message.processed  :  1   (root)
continuation.delegate.dispatch : 1  (the continuation primitive span)
```

## Honest nuance (cross-cycle)
`continuation.queue.drain` does NOT appear within this trace (see R-CW-DELEGATE-SELF row). On `4bbd3aec096` the queue.drain spans root as separate traces (confirmed via `GET /api/search?tags=service.name=rune-prince` — multiple `continuation.queue.drain`-rooted traces visible). So the in-tree visualization here is the `continuation.delegate.dispatch → harness.run → run` stitch (present + load-bearing); the queue.drain receipt is a sibling-rooted trace this cycle rather than nested. Named for fidelity rather than forced into the prior cycle's nested shape.

## Artifacts
- `R-OBS-2_trace_e24be71c.json` — full raw Tempo trace export (61571 bytes)
- Tempo URL: http://tempo.dandelion.cult/api/traces/e24be71c248340247251119fb1070348
- service.name=`rune-prince`, deployed `4bbd3aec096545992d6535f4ba96c3bd71414ed3`
