# R-OBS-2 — Tempo trace-tree + parent-child span hierarchy export (rune-rog-ally on 8cafdcd)

**Target SHA**: `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6` · **Prince**: 🪨 Rune (assigned, method-doc line 94 — per figs's 2026-05-16 traces-as-load-bearing directive)
**Status**: PASS (parent-child span hierarchy captured + exported from the deployed ship-current runtime)

## Scenario
R-OBS-2 captures the Tempo trace-tree (parent→child span hierarchy) for a continuation fire on the deployed `8cafdcd`, exported as JSON to the corpus. Proves the OTel instrumentation renders a full parent-child span hierarchy on the shipped bytes.

## The span hierarchy (parent→child tree, exported)
`span_hierarchy_trace.json` (the `077c78ce` fire) + `fresh_capture_3d242e3d_trace.json` (a fresh re-capture via Emeric's method, indexed first-try) — both host.name=rune, runtime 8cafdcd. The hierarchy:
```
openclaw.continuation
└── continuation.delegate.dispatch    (the R-CD primitive span)
openclaw.harness.run → openclaw.run
    ├── openclaw.context.assembled
    ├── openclaw.model.call (×2)
    └── openclaw.tool.execution
```

## Capability note (the centralized-ingress finding — corrects the DGX/ARM "honest-limited" model)
The trace-JSON export is NOT k3s-equipped-seats-only. The centralized Tempo ingress `tempo.dandelion.cult`→`10.0.0.99` (port 80, NOT raw :3200/:3100 ClusterIP) aggregates the whole fleet's traces and is reachable from rune-rog-ally (figs's 2026-06-17 "non-standard port" catch). So R-OBS-2 trace-tree export is fleet-wide-capable. The earlier "no local Tempo" honest-limit was an untested assumption — corrected; the JSON is captured (twice).

## Verdict: PASS
Parent-child span hierarchy captured + exported from deployed `8cafdcd` (host-pinned rune-rog-ally), the trace-tree JSON committed (two captures). The centralized-ingress capability finding is the row's bonus: trace-JSON is fleet-wide via the ingress, not seat-axis-limited.
