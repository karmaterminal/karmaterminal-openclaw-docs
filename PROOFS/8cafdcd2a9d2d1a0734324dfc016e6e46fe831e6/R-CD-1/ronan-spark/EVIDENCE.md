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

- **Trace ID**: `e1e48382ff688ed235a15c56198ce3a6`
- **Return pending** — the delegate dispatches after this response completes; return evidence will be captured when the round-trip closes (the channel-announce IS the proof of normal-mode return).
- *[To be updated with: subagent-spawn confirmation, return payload, round-trip-closed timestamp, Tempo trace.]*

## Tempo Trace

- **Trace ID**: `e1e48382ff688ed235a15c56198ce3a6`
- **Capture**: pending round-trip — will pull from `http://tempo.dandelion.cult/api/traces/e1e48382ff688ed235a15c56198ce3a6` after the delegate returns.
- *[To be updated with: byte-count, span-count, host-pin verification.]*

## Verdict (fire-side)

✅ **PASS (fire-side)** — `continue_delegate(mode=normal)` registered + scheduled on deployed `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6`. Round-trip closure + Tempo trace pending the delegate's return.

## Both-forms note

This is the **TOOL FORM** of R-CD-1. The BRACKET FORM (`[[CONTINUE_DELEGATE: task]]`) is captured in R-CD-TOKEN (separate row per BOTH-FORMS MANDATE, figs 2026-06-07).
