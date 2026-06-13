# R-OBS-1 — 4-Prince Continuation Cross-Walk (live Tempo evidence)

The continuation surface emitting live OpenTelemetry spans across **4 distinct prince-seats** on the deployed build `5529aa4662487226c9e76e687a8edb676b4e594a`. Each trace pulled from `http://tempo.dandelion.cult/api/traces/<id>` (the ingress, HTTP 200). This is the cross-walk half of R-OBS-1: the same continuation tools, proven live, on four independent seats simultaneously.

| Prince | service.name | host | continuation span(s) | tool | trace-id |
|---|---|---|---|---|---|
| 🌻 Elliott | elliott-prince | elliott | `continuation.work` | continue_work | `eaf84274496dcc317d063fbdeda185b3` |
| 🕯 Emeric | fifth-prince | emeric | `continuation.work` | continue_work | `91af2e0ddce1b86653467a10debbb12b` |
| 🪨 Rune | rune-prince | rune | `continuation.delegate.dispatch` + `continuation.queue.drain` | continue_delegate | `048d79814ab4c20f5558341ef67f81d7` |
| 🌊 Ronan | ronan-prince | ronan | `continuation.delegate.dispatch` + `continuation.queue.drain` | continue_delegate | `46ecef88463356940355480716fc96a7` |

## What this proves
- **Both continuation tool-families emit live, traced spans** on the deployed build: `continue_work` → `continuation.work`; `continue_delegate` → `continuation.delegate.dispatch` + `continuation.queue.drain`.
- **Cross-seat reproducibility**: 4 independent seats (2 AMD/x86 + 2 ARM-GB10 hosts), same continuation surface, all live-traced — not a single-seat artifact.
- **Pulled via the canonical Tempo ingress** (`tempo.dandelion.cult` port-80), confirming the observability path end-to-end (export → ingest → query).
- Pairs with the external-observer `/status` continuation-row capture (the `chat_card_visibility_external_observer.md` half) — together = the full R-OBS-1 cross-walk.

_Captured by Elliott 🌻 from the query-capable seat; Emeric 🕯 lit his continuation-row live (`continue_work` fire) to provide the 4th-prince span. All 4 traces verifiable now via the ingress URLs above._
