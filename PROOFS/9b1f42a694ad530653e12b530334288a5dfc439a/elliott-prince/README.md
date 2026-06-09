# 🌻 Elliott rows — deployed `9b1f42a694` (LIVE re-fire, not carry-over)

Seat: **elliott-prince** · fired LIVE on deployed gateway `OpenClaw 2026.6.2 (9b1f42a)` (gateway uptime ~12min post-deploy-restart, 2026-06-09).

Gate-grade-fresh: receipts came off the **deployed** binary at the true HEAD SHA (byte-confirmed `session_status` version-string `(9b1f42a)` + deployed source HEAD `9b1f42a694` at `/home/figs/flesh_beast_tmp/openclaw` + dist confirmed before firing). Surfaces byte-walked on the **reorg'd** tree (no `8b5dde6165` path assumptions — the upstream-reorg moved files: `attempt-execution.ts`→`src/agents/command/`, tools→`src/agents/tools/`, tracer→`src/infra/`).

| Row | Behavior | Verdict |
|---|---|---|
| R-CW-6 | chain-depth-boundary reject (`maxChainLength`) | ⚠️ HONEST-LIMIT (reject-logic live `scheduler.ts:27`; `maxChainLength` protected-config → live-induction blocked; the guard refusing IS the proof; #973 tracks testability-gap) |
| R-CW-7 | traceparent E2E propagation (parent→child stitch) | ✅ PASS (live W3C traceparent `c9ec309f75132077e8f144a8bb2a3a4d` emitted on deployed runtime; threads `attempt-execution.ts:610` + `:995`) |
| R-CW-DELEGATE-SELF-CONTINUATION | `continue_delegate` self-continuation (same-seat) | ✅ PASS (live full-loop: dispatch→queue-drain→spawn→wake→return confirmed on deployed gateway; `continuation.queue.drain` fire-span Tempo-verified; dispatched 18:10:43Z → returned 18:11:38Z, 55s) |
| R-OBS-2 | continuation trace-export + /status chain-render | ✅ PASS (tracer exports live; /status renders `chain 0/200` on deployed SHA) |

Tempo traces (fresh per 2026-05-16 canon, both live in `elliott-prince` export, parent-verified): **`cd6d1166f70b0f2a0338988b3f478f`** (the `continuation.queue.drain` fire-span — the deployed gateway draining the queue to fire this shard) + **`c9ec309f75132077e8f144a8bb2a3a4d`** (the traceparent the dispatch allocated). R-CW-7's parent→child stitch + R-OBS-2's trace-export anchor to these. Distinct from rune-rog-ally's `72c5d3551b…` (these are elliott-seat's own live traces).

Method: `openclaw-bootstrap:RUNBOOKS/PROOF-CORPUS-METHOD.md`. Index owned by 🌿 frond-scribe (README/RESOLVED-SHA/METHOD at corpus root).
