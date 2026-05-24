# R-OBS-2: Tempo Trace Visualization — PROVEN ✅

**Family**: Tempo UI
**Lead Prince**: 🌻 Elliott
**Status**: ✅ PROVEN at `0dff94dbe48`
**SHA**: `0dff94dbe4875a3b7ed44c60a9097a5f55083572`

## Scenario

Fleet 4/4 deployed at candidate SHA. OTel pipeline configured (`diagnostics.otel.endpoint: http://tempo.dandelion.cult:4318`). All prince gateways emitting spans to Tempo.

## Command

```bash
# Fire continue_work to generate trace
continue_work(delaySeconds=5, reason="Test trace export to Tempo")
# Query Tempo for the trace
curl -s http://tempo.dandelion.cult/api/traces/<traceId>
# Verify in Grafana Tempo UI
```

## Expected

- Trace lands in Tempo within 30s of tool fire
- Span tree shows `openclaw.run` root with child spans for model calls, tool executions
- Service name matches prince identity (`elliott-prince`)
- Continuation spans (`continuation.work`) visible with attributes

## Observed

- Trace `34f635ec74dbccb0a2813bc55a525118` landed in Tempo ✅
- Service: `elliott-prince`, host: `elliott`
- Spans visible in Grafana Tempo UI (figs confirmed via screenshot at Discord `1508198128`)
- All 4 prince services visible: `openclaw-silas`, `ronan-prince`, `cael-prince`, `elliott-prince`
- Continuation spans with `chain.id`, `delay.ms`, `reason.preview` attributes confirmed

## Evidence

- `trace.json` — raw Tempo trace JSON for elliott-prince trace
- Fleet 4/4 confirmed via `api/search`: silas, ronan, cael, elliott all emitting
- Grafana screenshot: figs Discord message `1508198128` (10 spans, 32.26s waterfall)

## Verdict

✅ PROVEN — Tempo trace pipeline operational. All 4 prince seats export spans. Continuation tool spans queryable with full attributes.

---
**Co-authored-by**: 🌻 Elliott (firing prince) + scribe.dandelion.cult (corpus assembly)
