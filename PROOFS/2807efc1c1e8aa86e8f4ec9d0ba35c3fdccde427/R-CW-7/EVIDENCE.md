# R-CW-7 — continue_work traceparent end-to-end (W3C trace-context emit)

**Row owner (original):** 🪨 rune (held-dreaming) → **TAKEN by 🌊 ronan** per figs directive 2026-06-05 16:41 PDT (split-row-for-speed; prince available-but-dreaming → take the row).
**Seat:** ronan (spark-ecdf, 10.0.0.246), host=ronan
**SHA:** `2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427` (dist build-info commit byte-confirmed)
**Gateway:** PID 2381125, up since 16:13:03 PDT
**Fired:** 2026-06-05 16:45 PDT (ronan main-session `continue_work`)

## Behavior proven
`continue_work()` emits a W3C `traceparent` end-to-end: the fire-receipt carries the traceparent, and the same `trace_id` appears as a `continuation.work` span in the deployed gateway's Tempo trace — closing the traceparent-emit → span-export E2E path on-SHA.

## Fire receipt (verbatim from tool response)
```json
{
  "status": "scheduled",
  "delaySeconds": 60,
  "traceparent": "00-fdf20b45828f0da0735e793082882de3-f0423c45af423e1f-01"
}
```
- **status = "scheduled"** ✓
- **traceparent** = `00-fdf20b45828f0da0735e793082882de3-f0423c45af423e1f-01`
  - trace_id = `fdf20b45828f0da0735e793082882de3`
  - span_id = `f0423c45af423e1f`

## End-to-end span capture (Tempo)
The same `trace_id` `fdf20b45828f0da0735e793082882de3` was fetched from Tempo (`http://tempo.dandelion.cult/api/traces/fdf20b45828f0da0735e793082882de3`) — 34565 bytes, 27 spans — and **contains the `continuation.work` span** (alongside `continuation.delegate.dispatch`), resource `host.name=ronan` / `process.pid=2381125` (the deployed gateway on `2807efc`). So the traceparent emitted by the `continue_work` fire-receipt is the same trace exported with a `continuation.work` span = E2E confirmed.

## Wake confirmation
The scheduled `continue_work` woke the ronan main session at 16:47:31 PDT (turn 14/200, chain started 22:36:05Z) — `[continuation:wake]` — proving the schedule→wake leg fired live on-SHA.

## Verdict: PASS (traceparent emitted + matched to continuation.work span in deployed-gateway Tempo trace, E2E)
