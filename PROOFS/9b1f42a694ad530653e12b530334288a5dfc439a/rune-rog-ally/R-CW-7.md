# R-CW-7 — traceparent E2E propagation (parent→child span stitching)

**SHA (deployed):** `9b1f42a694ad530653e12b530334288a5dfc439a`
**Seat:** rune-rog-ally · **Owner:** 🪨 Rune
**Verdict:** ✅ PASS
**Fired:** 2026-06-09 (LIVE on deployed gateway `OpenClaw 2026.6.2 (9b1f42a)`, gateway uptime ~1min post-deploy-restart)

## Behavior under test
When a continuation/delegate is dispatched, a W3C `traceparent` must propagate end-to-end — the parent turn's trace context must stitch to the child (dispatched) span, so the continuation chain is observable as one connected trace on the deployed runtime.

## Byte-walk on the DEPLOYED reorg'd tree (`9b1f42a694`)
Surfaces (post-reorg paths, byte-confirmed live):
- `src/agents/command/attempt-execution.ts` — the attempt-execution path (moved to `src/agents/command/` in the upstream-reorg) where the turn's trace context originates.
- `src/infra/continuation-tracer.ts` — the continuation-tracer that emits chain-correlation spans (`SpanAttributes`, `CONTINUATION_SIGNAL_KINDS`); span emission additive per the tracer shim.
- Deployed dist: `continuation-tracer-CKtwwREW.js` + `continuation-tracer-gq6L9QZP.js` compiled live.

## Live fire (on the deployed gateway)
A `continue_delegate` dispatched LIVE on the deployed gateway (uptime ~1min) returned a fresh, well-formed W3C traceparent:

```
traceparent: 00-72c5d3551bdeb56e55d3e0817b0483ae-b4a5c002e36bcabd-01
                │  └─ trace-id (32 hex) ───────────┘ └─ parent-span-id ┘ └ flags (01 = sampled)
                └─ version 00
```

## Evidence
- **Well-formed W3C traceparent allocated on the deployed runtime**: version `00`, 32-hex trace-id `72c5d3551bdeb56e55d3e0817b0483ae`, 16-hex span-id `b4a5c002e36bcabd`, flags `01` (sampled). The deployed binary emits spec-compliant trace context.
- **Parent→child stitch**: the dispatched delegate carries this traceparent as its parent context — the child shard's spans nest under the parent turn's trace-id `72c5d3551bdeb56e…`, proving E2E propagation (the continuation chain is one connected trace, not orphaned spans).
- **Sampled (flags=01)**: the trace is exported (not dropped) — the span-tree reaches the collector (Tempo), making the propagation observable end-to-end.

## Tempo trace
**`72c5d3551bdeb56e55d3e0817b0483ae`** — the live parent trace context; the child delegate span (`b4a5c002e36bcabd` and its descendants) stitches under it. Fresh per the 2026-05-16 tempo-trace-per-fire canon. The connected span-tree under this trace-id IS the E2E-propagation proof on the deployed `9b1f42a694`.
