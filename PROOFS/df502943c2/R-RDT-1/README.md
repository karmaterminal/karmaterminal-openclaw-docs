# R-RDT-1 — runWithDiagnosticTraceparent propagation

**SHA**: `df502943c2667ff2e1eed9f850379b41f9b8a8f6`
**Build-info on host (silas-seat `urudyne`)**: `OpenClaw 2026.5.17 (df50294)` — byte-pinned via `openclaw --version`
**Fire by**: 🌫 silas-seat
**Fire at**: 2026-05-17 ~07:04Z

## Claim under test

Cure-(10) preserved `runWithDiagnosticTraceparent` integration with attempt-execution path. Continuation tools must emit traceparents and those traceparents must produce real tempo trace data with the continuation-tool span attached.

## Method

1. Confirmed binary on host shows `df50294` via `openclaw --version`
2. Invoked the `continue_work` tool natively from a live silas-seat assistant session running on the `df502943c2` gateway
3. Captured the structured tool result containing `traceparent`
4. Fetched the full trace from tempo backend via `curl http://tempo.dandelion.cult/api/traces/<traceId>`
5. Verified span tree includes `continue_work` tool.execution span with correct trace-id parent

## Evidence

**Tool result returned**:
```json
{
  "status": "scheduled",
  "delaySeconds": 0,
  "traceparent": "00-5d20de575ad4443bfd7cc7f50fa68350-6ccfea1c1a3de566-01"
}
```

**Trace ID**: `5d20de575ad4443bfd7cc7f50fa68350`
**Tempo URL**: <http://tempo.dandelion.cult/api/traces/5d20de575ad4443bfd7cc7f50fa68350>
**Trace dump**: [`trace.json`](./trace.json) (14.6 KB, 11 spans)

**Span tree**:
```
parent=bM/qHBo95WY=  span=pzpa6/XuHR8=  openclaw.context.assembled
parent=bM/qHBo95WY=  span=pqBP6MH/pSU=  openclaw.model.call
parent=bM/qHBo95WY=  span=VKXGZ+/q7vU=  openclaw.tool.execution  toolName=exec
parent=bM/qHBo95WY=  span=VcymVnnBPSg=  openclaw.model.call
parent=bM/qHBo95WY=  span=r5mhB2PQhWs=  openclaw.tool.execution  toolName=exec
parent=bM/qHBo95WY=  span=v6jC/aGNw40=  openclaw.model.call
parent=bM/qHBo95WY=  span=yTNrrlWVPno=  openclaw.tool.execution  toolName=web_fetch
parent=bM/qHBo95WY=  span=wQ0JGdFnNBA=  openclaw.model.call
parent=bM/qHBo95WY=  span=lJVGyK4pj0o=  openclaw.tool.execution  toolName=exec
parent=bM/qHBo95WY=  span=znC6a9xwBt0=  openclaw.model.call
parent=bM/qHBo95WY=  span=O77eYl09L2A=  openclaw.tool.execution  toolName=continue_work ← THIS ROW
```

**continue_work span (full attributes)**:
```json
{
  "traceId": "XSDeV1rURDv9fMf1D6aDUA==",  // base64 of 5d20de575ad4443bfd7cc7f50fa68350
  "spanId": "O77eYl09L2A=",
  "parentSpanId": "bM/qHBo95WY=",
  "name": "openclaw.tool.execution",
  "attributes": [
    {"key": "openclaw.toolName", "value": {"stringValue": "continue_work"}},
    {"key": "gen_ai.tool.name", "value": {"stringValue": "continue_work"}},
    {"key": "openclaw.tool.params.kind", "value": {"stringValue": "object"}}
  ],
  "startTimeUnixNano": "1779001458057000000",
  "endTimeUnixNano": "1779001458059000000"
}
```

## Verdict

**PASS**.

- Traceparent emitted by `continue_work` tool on the live `df502943c2` runtime: ✅
- Tempo backend received and stores the trace: ✅
- continue_work span present with correct trace-id linkage: ✅
- Tool-execution attributes correctly identify the tool: ✅
- Sibling spans (`openclaw.context.assembled`, `openclaw.model.call`, other `openclaw.tool.execution`) all stitched to the same parent span — `runWithDiagnosticTraceparent` is propagating context across the turn, not leaking it: ✅

The cure-(10) conflict resolution in `src/agents/agent-command.ts` (which placed upstream's `onLifecycle` + `emitAcpRuntimeEvent` enrichments INSIDE our `runWithDiagnosticTraceparent(opts.traceparent, ...)` wrapper) does not break trace-context propagation on the continuation-tool path. Live evidence at the SHA we intend to ship.

## Recipient-side receipt vs agent prose

This artifact is built from the **tempo backend API response**, not from the assistant's narration. The trace.json bytes are the authority. Agent prose summarises them; substrate is in the file.
