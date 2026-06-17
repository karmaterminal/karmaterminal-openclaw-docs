# R-OBS-2 — Tempo trace-tree + parent-child span hierarchy export (rune canonical-owner)

**Row:** R-OBS-2 (🪨 Rune assigned, per method-doc line 94: "Tempo trace-tree visualization + parent-child span hierarchy export" per figs's 2026-05-16 traces-as-load-bearing directive). rune-rog-ally seat, ship-current `8cafdcd`.

## The span hierarchy (parent→child tree)
`span_hierarchy_trace.json` = the OTLP trace for a live `continue_delegate` fire on `8cafdcd`, pulled from the centralized Tempo ingress (`https://tempo.dandelion.cult/api/traces/077c78cef402e4f5495777a99c64ccd3`). The parent-child hierarchy:
```
openclaw.continuation                       (root — the continuation primitive)
└── continuation.delegate.dispatch          (the R-CD dispatch span)
openclaw.harness.run
└── openclaw.run
    ├── openclaw.context.assembled
    ├── openclaw.model.call  (×2)
    └── openclaw.tool.execution
```
7 spans total, 3 batches. Host-pinned: `host.name=rune`, `process.pid=1260958` (== gateway MainPID), `host.arch=amd64`, runtime `8cafdcd`.

## Capability note (corrects the "DGX/ARM honest-limited" model)
The trace-JSON export is NOT k3s-equipped-seats-only. The **centralized Tempo ingress** `tempo.dandelion.cult` → `10.0.0.99` (https:443 `-k`, or http:80) aggregates the whole fleet's traces and is reachable from rune-rog-ally (figs's 2026-06-17 "non-standard port" catch — it's the ingress, not the raw `:3200`/`:3100` k3s ClusterIP). Plus 🕯 emeric can cross-pull ANY seat's trace from the centralized collector. So R-OBS-2 trace-tree export is fleet-wide-capable, not seat-axis-limited. **Earlier honest-limit ("rune-rog-ally has no Tempo") was an untested assumption — corrected; the JSON is captured.**

## Cert
RUN is the cert: trace pulled live from the deployed `8cafdcd` runtime's own dispatch, parent-child hierarchy intact, host-pinned to this seat.

## Fresh re-capture (Emeric's byte-confirmed method, current-byte)
Re-verified the Tempo capture works robustly on rune-rog-ally per 🕯's method (`1516704318`): fired a fresh `continue_delegate` (traceparent `00-3d242e3d641799b7fa50f2a6319938b6-…`), pulled the trace from `http://tempo.dandelion.cult/api/traces/3d242e3d641799b7fa50f2a6319938b6` — **indexed at attempt 1, 7020 bytes, host.name=rune**. `fresh_capture_3d242e3d_trace.json` committed as the current-byte. DNS `tempo.dandelion.cult`→`10.0.0.99` resolves on the ROG seat; the method works first-try. Confirms rune-rog-ally is trace-captured, not honest-limited — twice over (this fresh capture + the original `077c78ce` dispatch-span capture).
