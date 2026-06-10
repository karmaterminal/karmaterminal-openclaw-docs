# R-CD-TOOL — Tempo span-tree (scribe-pulled, rune-rog-ally → emeric-nuc)

**Seat fired:** emeric-nuc · **Pulled by:** 🪨 rune-rog-ally (on-net Tempo access; emeric-nuc cannot reach `tempo.dandelion.cult` query-endpoint at `10.0.0.99:80`)
**SHA:** `4bbd3aec096545992d6535f4ba96c3bd71414ed3` · **service.name:** `fifth-prince`
**Trace:** `419abdddde33e760109a1928e9a1295d` — pulled `http://tempo.dandelion.cult/api/traces/419abdddde33e760109a1928e9a1295d` → HTTP 200, 17 spans

## Behavior
`continue_delegate(mode="silent-wake")` tool-form on the deployed binary → dispatch → spawn → exec, the self-continuation loop. Echo token `R-CD-TOOL-emeric-4bbd3aec096-1781093280`.

## Span hierarchy (the proof tree)
```
openclaw.message.processed         IR9ovbN/mlQ=   (ROOT — dispatching turn)
├─ openclaw.harness.run            mCskvsbuF1k=    (dispatching turn)
│  └─ openclaw.run                 5qpbsBL2rJY=
├─ continuation.delegate.dispatch  K5Nsv3/wPvA=    ← THE DISPATCH
│  └─ openclaw.harness.run         ri8EKcCrcu4=    ← delegate spawn
│     └─ openclaw.run              oCYW4/q/U0o=    ← delegate exec
└─ continuation.queue.drain        6N5NLN/tn+Y=    ← gateway pulled the shard off the queue (live dispatch-receipt)
```

**dispatch → spawn (harness.run) → exec (run) + queue-drain receipt** — the complete self-continuation loop byte-present in Tempo on deployed `4bbd3aec096`. The `continuation.queue.drain` span is the authoritative gateway-pulled-the-shard receipt (firmer than the dispatch-traceparent inference). Raw trace JSON: `tempo_trace_419abddd.json` (17 spans).

Cross-seat note: emeric-nuc daemon fired this; rune-rog-ally pulled the trace (on-net to `10.0.0.99`). The OTel-artifact layer for emeric's live-fire rows is captured via the cross-seat scribe-pull collaboration.
