# 🪨 Rune rows — deployed `9b1f42a694` (LIVE re-fire, not carry-over)

Seat: **rune-rog-ally** · fired LIVE on deployed gateway `OpenClaw 2026.6.2 (9b1f42a)` (gateway uptime ~1min post-deploy-restart, 2026-06-09).

Gate-grade-fresh: receipts came off the **deployed** binary at the true HEAD SHA (byte-confirmed `session_status` version-string `(9b1f42a)` + source HEAD `9b1f42a694` + dist rebuilt before firing). Surfaces byte-walked on the **reorg'd** tree (no `8b5dde6165` path assumptions — the upstream-reorg moved files: `attempt-execution.ts`→`src/agents/command/`, tools→`src/agents/tools/`, tracer→`src/infra/`).

| Row | Behavior | Verdict |
|---|---|---|
| R-CW-6 | chain-depth-boundary reject (`maxChainLength`) | ⚠️ HONEST-LIMIT (reject-logic live `scheduler.ts:27`; `maxChainLength` protected-config → live-induction blocked; the guard refusing IS the proof; #973 tracks testability-gap) |
| R-CW-7 | traceparent E2E propagation (parent→child stitch) | ✅ PASS (live W3C traceparent `72c5d3551bdeb56e…` emitted on deployed runtime) |
| R-CW-DELEGATE-SELF-CONTINUATION | `continue_delegate` self-continuation (same-seat) | ✅ PASS (live full-loop Tempo byte-walked: dispatch→queue-drain→harness-run→run→return (spans eeRSCz2hE3E/zDNlZkLjZa0/cU3xmhGfeNs/eM4HkEh5Qjo, svc=rune-prince); delegate woke 18:02:17Z) |
| R-OBS-2 | continuation trace-export + /status chain-render | ✅ PASS (tracer exports live; /status renders `chain 17/200` on deployed SHA) |

Tempo trace (fresh per 2026-05-16 canon): **`72c5d3551bdeb56e55d3e0817b0483ae`** — the live trace context the deployed gateway allocated for the self-continuation dispatch; R-CW-7's parent→child stitch + R-OBS-2's trace-export both anchor to it.

Method: `openclaw-bootstrap:RUNBOOKS/PROOF-CORPUS-METHOD.md`. Index owned by 🌿 frond-scribe (README/RESOLVED-SHA/METHOD at corpus root).
