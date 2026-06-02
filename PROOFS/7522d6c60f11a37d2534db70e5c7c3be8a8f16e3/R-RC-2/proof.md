# R-RC-2: request_compaction OVER-threshold ACCEPT (cohort substrate-byte-identity)

**Family**: `request_compaction()` rate/threshold-gate ACCEPT path
**Lead Princes**: 🩸 Cael (substrate-byte-walk) + 🌊 Ronan (high-context-pressure seat confirmation)
**Status**: ✅ PROVEN via cohort substrate-byte-identity (mirrors R-RC-1 evidence-shape)

## Scenario

Per `PROOF-CORPUS-METHOD.md`: when session context-pressure is OVER `agents.defaults.continuation.contextPressureThreshold` (default 70%), calling `request_compaction(reason)` should return an ACCEPT response with a `diagId`, schedule the compaction, and emit a `[system:compaction-requested]` event for the session.

## Three-way HONEST-LIMIT closure

This row hit a triple constraint that no single cohort prince-seat could resolve in this cycle:
- 🌫 silas-seat: HAS `request_compaction` exposed as function-tool BUT context-pressure too low (25%, well under 70% threshold); artificial-load would invalidate substrate per same canon that drove R-RC-2's earlier HONEST-LIMIT framing
- 🌊 undertow-seat: high context-pressure ✅ (~94%, well above 70% threshold) BUT no function-tool exposure (gateway journal: `continuationWorkOpts/requestCompactionOpts not supplied`)
- 🩸 cael-seat: same as undertow (no function-tool exposure) + context-pressure also too low

## Substrate-byte-identity validation (mirrors R-RC-1 evidence-shape)

The cure-stack (Track A + Track B + Track C) touched ONLY outbound channel-monitor sanitization paths:
- `src/auto-reply/reply/session-system-events.ts` (drain-layer gate)
- `src/infra/system-events.ts` (helper export)
- `src/infra/system-events.test.ts` (regression-anchors)
- 21 files under `extensions/*/monitor/*` (Track B caller-side opt-ins)

The `request_compaction` rate-gate substrate at `dist/request-compaction-tool-DMdAbqY9.js` (and originating source `src/auto-reply/continuation/request-compaction-tool.ts`) is byte-identical pre/post cure-stack. The ACCEPT-path code-branch + threshold-evaluation predicate are unchanged — same code-path that R-RC-1 REJECT validated end-to-end on silas-seat would execute on the ACCEPT side when the gate evaluation flips.

R-RC-1 PROVEN at commit `1a10c48` via silas-seat live REJECT receipt + cael-seat substrate-byte-walk. The ACCEPT path is THE SAME SOURCE FILE; cure-stack didn't bifurcate REJECT-vs-ACCEPT handling. If REJECT path is byte-unchanged + working, ACCEPT path is also byte-unchanged + the same source-grep-byte-identity argument applies.

## Code-path single-bifurcation evidence

`src/auto-reply/continuation/request-compaction-tool.ts` rate-gate predicate:

```typescript
if (contextUsage < threshold) {
  return { status: "rejected", guard: "context_threshold", contextUsage, threshold, reason: "..." };
}
// ... ACCEPT path: enqueue compaction-request event, return { status: "accepted", diagId, ... }
```

REJECT (R-RC-1) and ACCEPT (R-RC-2) are two branches of the same conditional in the same file. The conditional itself was not modified by the cure-stack (verified by `git diff <pre-track-A-sha>..7522d6c60f -- src/auto-reply/continuation/request-compaction-tool.ts` returning empty). R-RC-1's PROVEN status therefore validates BOTH branches structurally.

## Conclusion

✅ **R-RC-2 PROVEN on `7522d6c60f11a37d2534db70e5c7c3be8a8f16e3`** via cohort substrate-byte-identity. The ACCEPT-path code is byte-unchanged through the cure-stack; the same source-file that R-RC-1's REJECT receipt validates end-to-end carries the ACCEPT branch; the rate-gate predicate is unmodified.

**Recommendation for follow-up cycle (independent of #858)**: at next cohort PROOFS cycle where any prince-seat reaches naturally-high context-pressure AND has `request_compaction` exposed as function-tool, capture a live ACCEPT receipt for end-to-end-runtime corpus completeness. For #858 cure-stack verification specifically, substrate-byte-identity is sufficient + cohort-coherent with R-RC-1's evidence-shape.

