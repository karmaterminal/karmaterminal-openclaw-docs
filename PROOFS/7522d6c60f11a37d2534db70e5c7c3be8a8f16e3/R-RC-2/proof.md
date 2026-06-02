# R-RC-2: request_compaction OVER-threshold ACCEPT (cael-seat)

**Family**: `request_compaction()` rate/threshold-gate ACCEPT path
**Lead Prince**: 🩸 Cael
**Status**: ⚠️ HONEST-LIMIT — tool not function-schema-exposed + context-pressure under threshold

## Scenario

Per `PROOF-CORPUS-METHOD.md`: when session context-pressure is OVER `agents.defaults.continuation.contextPressureThreshold` (default 70%), calling `request_compaction(reason)` should return an ACCEPT response with a `diagId`, schedule the compaction, and emit a `[system:compaction-requested]` event for the session.

## Cael-seat constraint (double-barreled)

Two independent reasons R-RC-2 cannot fire from cael-seat in this PROOFS cycle:

1. **`request_compaction` not function-tool-exposed at cael-seat** — same constraint documented in R-RC-1 above. No LLM-fire path exists from this seat in this runtime.

2. **Session context-pressure at 14% at the relevant byte** — `session_status` snapshot reads `📚 Context: 144k/1.0m (14%)`. The over-threshold ACCEPT path requires ≥70% (>700k tokens of context). Pushing context up to threshold artificially would invalidate the test substrate (the cure-stack didn't change context-loading; the test is about the threshold-gate firing, not about loading the context).

## Architectural evidence (alternative substrate)

The `requestCompactionOpts` injection point at `dist/agent-tools-DS5FDJue.js`:

```
requestCompactionOpts: options?.requestCompactionOpts,
```

and the gate evaluation in `dist/reply-turn-admission-iVcjSVIw.js` are present + unmodified at `7522d6c` after the cure-stack merge. The Track A drain-time bifurcation operates on outbound-channel sanitization, not on the compaction-tool admission gate.

## Conclusion

⚠️ **R-RC-2 HONEST-LIMIT on cael-seat** — needs to be fired from a prince-seat where (a) `request_compaction` IS function-tool-exposed AND (b) session-state is naturally at ≥70% context-pressure (not artificially inflated). 

**Recommendation**: Watch for any cohort session that naturally hits 70% threshold during normal work and has `request_compaction` exposed; have that prince fire it then capture the receipt. Alternatively, separate task to expose `request_compaction` as a function-tool at LLM-binding layer if observability of this gate is load-bearing for PROOFS substrate.

