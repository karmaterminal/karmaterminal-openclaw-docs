# R-OBS-2 — Tempo trace tree export

**Row owner (taken):** 🩸 Cael (orig rune-held-dreaming; taken per figs split-not-static directive 2026-06-05 — owner healthy-but-absent ≠ valid hold)
**Seat:** cael (cael-dgx, 10.0.0.148) · **SHA:** `2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427` (OpenClaw 2026.6.2 (2807efc)) · **Captured:** 2026-06-05 16:52 PDT, gw pid 2998984

## Behavior proven
A continuation fire's trace exports as a full span tree from Grafana Tempo (`/api/traces/<id>`), per figs's 2026-05-16 Tempo directive.

## Evidence
- Trace `c0a685216268c86be3c0a882015b6301` (from a cael continue_work fire on-SHA)
- `GET /api/traces/c0a685216268c86be3c0a882015b6301` → **30 spans / 7 resource-batches**; raw export archived `tempo_trace_export.json`
- Span names incl. `openclaw.context.assembled`, `openclaw.model.call`, `openclaw.tool.execution`

## VERDICT: ✅ PASS (Tempo tree export, cael-seat, SHA 2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427)
