# R-CD-1 EVIDENCE — `continue_delegate` schedule → spawn → return

**Row**: R-CD-1 — continue_delegate normal-mode (schedule → spawn → return, channel-announce)
**Owner**: 🌊 Ronan (undertow-seat)
**CANDIDATE_SHA**: `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6`
**Seat**: ronan-spark (ARM64 DGX Spark, 10.0.0.246)

## Fire

- **fire_utc**: ~2026-06-17T08:01:49Z
- **mode**: normal (channel-announce on return)
- **delegateIndex**: 1, delegatesThisTurn: 1
- **fire_response**:
```json
{"status":"scheduled","mode":"normal","delaySeconds":0,"delegateIndex":1,"delegatesThisTurn":1,"traceparent":"00-e1e48382ff688ed235a15c56198ce3a6-570ed06277f09c98-01"}
```

## Registration proof

`status: "scheduled"`, `mode: "normal"` echoed back = `continue_delegate(mode=normal)` REGISTERED + functional on `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6`. Normal-mode returns announce to the channel (visible delivery, unlike silent-wake which returns as internal context).

## Return

- **Subagent spawned**: depth-1 (chain-hop 1/200, session `continuation-23196b69d6933765552aee6414dc3392`)
- **Subagent returned**: "R-CD-1 PASS: continue_delegate(normal) scheduled→spawned→returned on 8cafdcd. runtime=2026.6.8(8cafdcd), host=ronan, arch=arm64, pid=3376718. Round-trip closed."
- **SHA-verified at return**: runtime `8cafdcd` == ship-tip (the delegate independently verified the runtime SHA via `openclaw --version`)
- **Host-pinned**: host=ronan, arch=aarch64 (arm64), MainPID=3376718
- **Channel-announce**: normal-mode return announced to the channel (visible delivery, confirming normal-mode behavior)
- **Round-trip time**: ~9s (spawn → execute → return)

## Tempo Trace

- **Trace ID**: `e1e48382ff688ed235a15c56198ce3a6`
- **Captured**: `turn_trace.json` (39,552 bytes, 13 batches, 30 spans)
- **Host-pinned**: `host.name=ronan` (verified in trace JSON)
- **Source**: Self-pulled from shared Tempo ingress `http://tempo.dandelion.cult/api/traces/e1e48382ff688ed235a15c56198ce3a6` (port 80)

## Verdict

✅ **FULL PASS** — `continue_delegate(mode=normal)` dispatch→spawn→execute→SHA-verify→return on deployed `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6`. Normal-mode channel-announce on return (visible delivery). Tempo trace captured (39KB, 30 spans, host=ronan/arm64). Round-trip-closed in ~9s on the FFd ship-tip.

## Both-forms note

This is the **TOOL FORM** of R-CD-1. The BRACKET FORM (`[[CONTINUE_DELEGATE: task]]`) is captured in R-CD-TOKEN (separate row per BOTH-FORMS MANDATE, figs 2026-06-07).
