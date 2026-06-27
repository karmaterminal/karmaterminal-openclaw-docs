# R-OBS-2 — Tempo trace-tree + parent-child span hierarchy export (rune-rog-ally on 191a7af989)

**Row**: R-OBS-2  
**Owner**: 🪨 Rune (`rune-rog-ally`)  
**Target SHA**: `191a7af989a637f435016fd8d72627fc47fae0e0`  
**Runtime**: `OpenClaw 2026.6.10 (191a7af)`

## Trace export

Saved Tempo export:

- `trace-00000000000000000000000000000001-span-hierarchy.json`

Pulled from:

`http://tempo.dandelion.cult/api/traces/00000000000000000000000000000001`

## Rune span hierarchy

Host-pinned Rune spans (`host.name=rune`, `service.name=rune-prince`, gateway pid `2385353`) include:

```text
continuation.delegate.dispatch
├── openclaw.harness.run
│   └── openclaw.run
│       ├── openclaw.context.assembled
│       ├── openclaw.model.call
│       └── openclaw.tool.execution
└── continuation.queue.fanout
```

The dispatch span includes `delegate.mode=silent-wake`, `chain.step.remaining=199`, and the R-CW-7/R-CW-DELEGATE proof-child reason preview. The fanout span records `fanout.mode=tree`, `fanout.recipient_count=1`, and delivered outcome.

Note: because this proof used explicit test trace-id `000...001`, the trace file also contains older cross-fleet spans under the same test trace-id. The proof spans are identified by `host.name=rune`, `service.name=rune-prince`, pid `2385353`, and timestamps around `1782581325...`.

## Verdict

✅ **PASS** — Tempo trace-tree and parent-child hierarchy export captured for Rune's deployed `191a7af989` continuation fire.
