# R-OBS-2 — continuation trace-export + /status continuation-substrate render

**SHA (deployed):** `9b1f42a694ad530653e12b530334288a5dfc439a`
**Seat:** elliott-prince · **Owner:** 🌻 Elliott
**Verdict:** ✅ PASS
**Fired:** 2026-06-09 (LIVE on deployed gateway `OpenClaw 2026.6.2 (9b1f42a)`, gateway uptime ~12min post-deploy-restart)

## Behavior under test
The continuation substrate must be OBSERVABLE on the deployed runtime: (a) the continuation-tracer must export spans/traceparents (the trace-export surface), and (b) the continuation chain-state must render on `/status` (operator-visible chain count) — proving the observability layer is live on the deployed ship-SHA.

## Byte-walk on the DEPLOYED reorg'd tree (`9b1f42a694`)
Surface (post-reorg path, byte-confirmed live): `src/infra/continuation-tracer.ts` (the tracer MOVED to `src/infra/` in the reorg). Exported trace-export API confirmed:

```ts
export const CONTINUATION_SIGNAL_KINDS = [ ... ];          // canonical span signal.kind enumeration (:40)
export type ContinuationSpanName = ...;                    // span-name union (:208)
export type Span = { ... };                                // span emission contract (:237)
// W3C traceparent: "Return a W3C traceparent for the concrete span when the
//   installed exporter ... so child runs attach to exported trace bytes" (:256-258)
```

The tracer shim keeps span emission additive (callers without a configured exporter get the `noopTracer`; a concrete exporter — e.g. OTLP→Tempo — is injected via `setContinuationTracer`).

## Live evidence (on the deployed gateway)
1. **Trace-export live**: the `continue_delegate` fired this session on the deployed gateway produced a real, well-formed W3C traceparent (`00-c9ec309f75132077e8f144a8bb2a3a4d-015d088f874ac070-01`) — the tracer + `formatContinuationTraceparent` ARE exporting on the deployed binary.
2. **Compiled in the deployed dist**: `continuation-tracer-CKtwwREW.js` + `continuation-tracer-gq6L9QZP.js` (18215 bytes, built Jun 9 10:55) present in `dist/`; plugin-sdk type-decl `dist/plugin-sdk/src/infra/continuation-tracer.d.ts` confirms the reorg'd path shipped. **All 8 continuation span-emitters present in the built artifact** (byte-walked in dist, not echo-cited): `emitContinuationQueueDrainSpan`, `emitContinuationDelegateFireSpan`, `emitContinuationDelegateSpan`, `emitContinuationWorkFireSpan`, `emitContinuationWorkSpan`, `emitContinuationFanoutSpan`, `emitContinuationCompactionReleasedSpan`, `emitContinuationDisabledSpan`.
3. **/status continuation-substrate renders**: deployed dist has `status-message.runtime.js` / `status-message-DWwCMo4t.js` (the /status renderer) + chain-render logic in `dist/auto-reply/reply/agent-runner.runtime.js`. Confirmed live: this seat's own `session_status` on the deployed SHA renders `🔄 Continuation: chain 0/200` — the chain-count substrate is operator-visible on the deployed `9b1f42a694`.

## Evidence summary
- Trace-export API present + exporting (real traceparent emitted live) ✓
- Continuation-tracer compiled in deployed dist (×2 chunks + plugin-sdk decl) ✓
- /status renders the continuation chain-count on the deployed runtime (`chain 0/200` visible on elliott-seat) ✓

Both halves of the observability surface (trace-export + /status-render) are live + confirmed on the deployed ship-SHA.

## Tempo traces (both live in `elliott-prince` export, parent-verified)
- **`cd6d1166f70b0f2a0338988b3f478f`** — live `continuation.queue.drain` root span (the deployed tracer exporting a real continuation span to Tempo).
- **`c9ec309f75132077e8f144a8bb2a3a4d`** — the W3C traceparent the deployed tracer/tool allocated + exported (proving `formatContinuationTraceparent` functions).

Fresh per the 2026-05-16 tempo-trace-per-fire canon.
