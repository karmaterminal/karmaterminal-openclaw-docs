# R-CW-7 — continue_work() traceparent propagation end-to-end

**Target SHA**: `335acbe43a354486e74c684aaa2e2fe14e9aa8c6` (deployed cael-seat 2026-05-23T07:45 UTC)
**Status**: ✅ PASS (architectural)
**Prince**: 🩸 Cael
**Tempo trace**: [`fd028021621abf2b3ae7fb4b9d78338b`](http://tempo.dandelion.cult/api/traces/fd028021621abf2b3ae7fb4b9d78338b)

## Scenario

W3C `traceparent` should propagate from the `continue_work()` invocation through the wake event, enabling end-to-end trace stitching across the continuation lifecycle. Verifies OTel span-tree reconstruction across asynchronous wake boundaries.

## Command

```
continue_work({
  delaySeconds: 5,
  reason: "R-CW-7 PROOF: traceparent end-to-end propagation"
})
```

## Expected

- OTel span emitted on `continue_work` invocation
- Wake event linked via traceparent to the invocation span
- Tempo trace tree reconstructs the parent→wake→continuation chain via traceparent
- Server-side OTel threading handles traceparent propagation (architectural — not agent-readable as a tool-output string)

## Observed

🩸 Cael (Discord `1507661169`): *"R-CW-7 result: traceparent propagation is ARCHITECTURAL (gateway OTel threading, not agent-readable). the trace chain links parent→child via Tempo span tree. documented as designed-behavior, not a tool-visible string. trace `fd028021621abf2b3ae7fb4b9d78338b`."*

Trace fetched at [`trace-fd028021.json`](./trace-fd028021.json) (22,713 bytes, unedited runtime emission). Span tree visible in Tempo UI shows the linked spans across the wake boundary.

## Behavior verified

✅ OTel span emitted on `continue_work` tool invocation
✅ Wake event span captured in Tempo trace tree
✅ Traceparent propagation handled at gateway/OTel-instrumentation layer (architectural correctness)
✅ Trace tree reconstructs the continuation chain
✅ Designed-behavior: traceparent is NOT a tool-visible string in the agent's substrate; it's automatic at the OTel instrumentation layer

## Substrate-note

This row's PASS is architectural rather than tool-output-visible. The agent calling `continue_work` does not see a `traceparent` field returned in the tool result; instead, the OTel-instrumented gateway code automatically propagates trace context across the wake boundary. This is the canonical design: traceparent is a SUBSTRATE concern (handled by the gateway), not a TOOL concern (handled by the agent). The Tempo span tree is the verifiable artifact.

## Co-fired

Fresh fire on PR #85651 head `335acbe43a354486e74c684aaa2e2fe14e9aa8c6`. No inheritance.
