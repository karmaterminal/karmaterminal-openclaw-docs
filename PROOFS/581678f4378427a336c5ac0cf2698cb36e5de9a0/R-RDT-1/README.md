# R-RDT-1 — runWithDiagnosticTraceparent propagation

**SHA**: `581678f4378427a336c5ac0cf2698cb36e5de9a0`
**Build-info on host**: `OpenClaw 2026.5.17 (581678f)`, builtAt `2026-05-17T23:03:08.758Z`
**Fire by**: 🌫 silas-seat (`urudyne`)

## Claim under test

Cure-(12) preserves diagnostic traceparent propagation: `runWithDiagnosticTraceparent` still parses a W3C traceparent and runs the callback within the frozen diagnostic trace context so downstream continuation/tool execution can parent spans correctly.

## Method

1. Confirmed live `/status` build pin: `OpenClaw 2026.5.17 (581678f)`.
2. Confirmed deployed `dist/build-info.json` commit is `581678f4378427a336c5ac0cf2698cb36e5de9a0`.
3. Located deployed bundle `dist/diagnostic-trace-context-5yrj1tXL.js`.
4. Byte-extracted the `runWithDiagnosticTraceparent` function and export map.
5. Fired a live `continue_delegate(mode="silent")` proof shard carrying dispatch traceparent `00-3e4bd3525b8470e3c94c8b5997d93c0a-83476a411435882b-01`, exercising the diagnostic trace propagation path from the deployed runtime.

## Evidence

Full bundle context: [`deployed-bundle-context.txt`](./deployed-bundle-context.txt).

Key region:

```javascript
function runWithDiagnosticTraceparent(traceparent, callback) {
  if (!parseDiagnosticTraceparent(traceparent)?.spanId) return callback();
  return runWithDiagnosticTraceContext(createDiagnosticTraceContext({ traceparent }), callback);
}
export { getActiveDiagnosticTraceContext as a, freezeDiagnosticTraceContext as i, createDiagnosticTraceContext as n, runWithDiagnosticTraceContext as o, formatDiagnosticTraceparent as r, runWithDiagnosticTraceparent as s, createChildDiagnosticTraceContext as t };
```

Live-fire trace ID: `3e4bd3525b8470e3c94c8b5997d93c0a`.

## Verdict

✅ Diagnostic traceparent seam preserved at cure-(12) deploy SHA.
✅ Function export remains present in deployed bundle.
✅ Live delegate dispatch supplies a deployed-runtime traceparent receipt.

## proofs-SHA == push-SHA invariant

`581678f4378427a336c5ac0cf2698cb36e5de9a0` (build-info.json) == `581678f4378427a336c5ac0cf2698cb36e5de9a0` (cure-(12) ship candidate at proofs-fire time).
