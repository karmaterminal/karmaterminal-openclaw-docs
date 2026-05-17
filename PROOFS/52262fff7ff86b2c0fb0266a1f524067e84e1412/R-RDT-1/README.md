# R-RDT-1 — runWithDiagnosticTraceparent propagation

**SHA**: `52262fff7ff86b2c0fb0266a1f524067e84e1412`
**Build-info on host**: `OpenClaw 2026.5.17 (52262ff)`, builtAt `2026-05-17T19:03:53.295Z`
**Fire by**: 🌫 silas-seat (`urudyne`)
**Re-fire of cure-(10)**: re-fired at ship-SHA to confirm preservation through cure-(11) rebase + UNION-T-3 fold.

## Claim under test

Cure-(11) preserves cure-(10)'s diagnostic-traceparent propagation seam: the `runWithDiagnosticTraceparent` function in `diagnostic-trace-context.ts` continues to parse and freeze a traceparent into an AsyncLocalStorage-backed context, allowing downstream callsites (continuation dispatch, tool execution) to access the active diagnostic trace via `getActiveDiagnosticTraceContext`.

## Method

1. Confirmed `build-info.json` on live host shows `52262fff7ff86b2c0fb0266a1f524067e84e1412`.
2. Located deployed bundle: `dist/diagnostic-trace-context-5yrj1tXL.js`.
3. Byte-extracted the `runWithDiagnosticTraceparent` function definition.
4. Confirmed the function shape: parse traceparent → bail if no span ID → run callback within frozen trace context.
5. Cross-checked it's still exported under the canonical short letter (`s`) in the module's export map.

## Evidence

### Bundle byte-extract (recipient-side from deployed dist)

File: `dist/diagnostic-trace-context-5yrj1tXL.js`. Full context: [`deployed-bundle-context.txt`](./deployed-bundle-context.txt) (11 lines).

Key region:

```javascript
function runWithDiagnosticTraceContext(trace, callback) {
  return getDiagnosticTraceScopeState().storage.run(freezeDiagnosticTraceContext(trace), callback);
}
function runWithDiagnosticTraceparent(traceparent, callback) {
  if (!parseDiagnosticTraceparent(traceparent)?.spanId) return callback();
  return runWithDiagnosticTraceContext(createDiagnosticTraceContext({ traceparent }), callback);
}
//#endregion
export { getActiveDiagnosticTraceContext as a, freezeDiagnosticTraceContext as i, createDiagnosticTraceContext as n, runWithDiagnosticTraceContext as o, formatDiagnosticTraceparent as r, runWithDiagnosticTraceparent as s, createChildDiagnosticTraceContext as t };
```

The function shape is byte-identical to cure-(10) `df502943c2` byte-extract (bundle filename rotated from `diagnostic-trace-context-CGtZbWfx.js` → `diagnostic-trace-context-5yrj1tXL.js`, but source preserved).

### Live-fire trace propagation

The R-LSTC-1 live-fire `continue_delegate` dispatched with traceparent `00-3e37d7fc571ddd7613643ef4f08a9769-120632bed26043d1-01` exercises this seam: the delegate-spawn path passes the traceparent through `runWithDiagnosticTraceparent`, parents the child `openclaw.run` span under the dispatch span, and surfaces the propagation in the tempo span tree (parent-child relationship across the dispatch boundary).

Recipient-side trace IDs (`3e37d7fc571ddd7613643ef4f08a9769`) confirm the seam runtime-load-bearing on v7.

## Verdict

✅ Adoption preserved through cure-(11) rebase and v7 squash + UNION-T-3 fold.
✅ Function byte-shape unchanged from cure-(10).
✅ Live-fire propagation confirmed via R-LSTC-1 trace.

## proofs-SHA == push-SHA invariant

`52262fff7ff86b2c0fb0266a1f524067e84e1412` (build-info.json) == `52262fff7ff86b2c0fb0266a1f524067e84e1412` (PR #79925 head at proofs-fire time).
