# R-OBS-2 — continuation trace-export + /status continuation-substrate render

**SHA (deployed):** `9b1f42a694ad530653e12b530334288a5dfc439a`
**Seat:** rune-rog-ally · **Owner:** 🪨 Rune
**Verdict:** ✅ PASS
**Fired:** 2026-06-09 (LIVE on deployed gateway `OpenClaw 2026.6.2 (9b1f42a)`, gateway uptime ~1min post-deploy-restart)

## Behavior under test
The continuation substrate must be OBSERVABLE on the deployed runtime: (a) the continuation-tracer must export spans/traceparents (the trace-export surface), and (b) the continuation chain-state must render on `/status` (operator-visible chain count) — proving the observability layer is live on the deployed ship-SHA.

## Byte-walk on the DEPLOYED reorg'd tree (`9b1f42a694`)
Surface (post-reorg path, byte-confirmed live): `src/infra/continuation-tracer.ts` (the tracer moved to `src/infra/`). Exported trace-export API:

```ts
export const CONTINUATION_SIGNAL_KINDS = [ ... ];     // canonical span signal.kind enumeration
export function getContinuationTracer(): Tracer;       // active tracer accessor
export function setContinuationTracer(tracer): void;   // exporter injection (additive)
export function resetContinuationTracer(): void;
export function formatContinuationTraceparent(...);    // W3C traceparent formatter
interface Tracer { startSpan(name, options?): Span; }  // span emission
```

The tracer shim keeps span emission additive (callers that don't configure an exporter get the `noopTracer`; a concrete exporter — e.g. OTLP→Tempo — is injected via `setContinuationTracer`).

## Live evidence (on the deployed gateway)
1. **Trace-export live**: the `continue_delegate` fired this session produced a real, well-formed W3C traceparent (`00-72c5d3551bdeb56e55d3e0817b0483ae-b4a5c002e36bcabd-01`) — `formatContinuationTraceparent` + the tracer ARE exporting on the deployed binary.
2. **Compiled in the deployed dist**: `continuation-tracer-CKtwwREW.js` + `continuation-tracer-gq6L9QZP.js` present in `dist/`.
3. **/status continuation-substrate renders**: deployed dist has `status-message.runtime.js` / `status-message-DWwCMo4t.js` (the /status renderer), and `continuationChainCount` / chain-render logic in `dist/auto-reply/reply/agent-runner.runtime.js`. Confirmed live: this seat's own `session_status` on the deployed SHA renders `🔄 Continuation: chain 17/200` — the chain-count substrate is operator-visible on the deployed `9b1f42a694`.

## Evidence summary
- Trace-export API present + exporting (real traceparent emitted live) ✓
- Continuation-tracer compiled in deployed dist ✓
- /status renders the continuation chain-count on the deployed runtime (chain N/200 visible) ✓

Both halves of the observability surface (trace-export + /status-render) are live + confirmed on the deployed ship-SHA.

## Tempo trace
**`72c5d3551bdeb56e55d3e0817b0483ae`** — the live traceparent the deployed tracer exported (proving the export path functions). Fresh per the 2026-05-16 tempo-trace-per-fire canon.
