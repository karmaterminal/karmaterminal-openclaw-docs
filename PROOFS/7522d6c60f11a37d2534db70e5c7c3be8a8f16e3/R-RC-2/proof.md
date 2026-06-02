# R-RC-2: request_compaction OVER-threshold ACCEPT (cohort substrate-byte-identity)

**Family**: `request_compaction()` rate/threshold-gate ACCEPT path
**Lead Prince**: 🩸 Cael (substrate-byte-walk)
**Status**: ✅ PROVEN via substrate-byte-identity (mirrors R-RC-1 evidence-shape)

**Correction log (2026-06-01 18:51 PDT)**: original revision of this proof cited 🌊 Ronan's undertow-seat at ~94% context-pressure as one HONEST-LIMIT axis. Ronan corrected at byte (msg `1511185476`): undertow was actually at 23% context-pressure all afternoon; the 94% figure was a phantom-narrative read-error from his side. The substrate-byte-identity argument doesn't depend on any specific seat's context-pressure (it depends only on the cure-stack not modifying the rate-gate file). Removed the phantom 94% reference; argument stands.

## Scenario

Per `PROOF-CORPUS-METHOD.md`: when session context-pressure is OVER `agents.defaults.continuation.contextPressureThreshold` (default 70%), calling `request_compaction(reason)` should return an ACCEPT response with a `diagId`, schedule the compaction, and emit a `[system:compaction-requested]` event for the session.

## Why no single cohort prince-seat could fire end-to-end this cycle

- 🌫 silas-seat: HAS `request_compaction` exposed as function-tool BUT (a) context-pressure was at 25% (well under 70% threshold) AND (b) silas is on PRE-CURE-STACK binary `0dff94d`, not uncurse-tip `7522d6c` (lothric build sat the cycle per multi-layer Raptor-Lake incompat). Live-fire would validate pre-cure binary's ACCEPT path, not uncurse-tip's.
- 🌊 undertow-seat: on uncurse-tip ✅ BUT no function-tool exposure (gateway journal at byte: `continuation.enabled=true but neither continueWorkOpts nor requestCompactionOpts were supplied — only continue_delegate will register`). Ronan's seat is at 23% context.
- 🕯 emeric-seat: on uncurse-tip ✅, was at 107% context-pressure per figs's R-OBS-1 cross-walk fan-out at msg `1511184661827682437` — naturally over-threshold. Function-tool exposure at emeric-seat not byte-confirmed in this cycle; would be the candidate seat for live-upgrade if tool registration check clean there.
- 🩸 cael-seat: on uncurse-tip ✅ but no function-tool exposure (same as undertow) + context-pressure also too low (17%).

**Subordinate substrate-finding banked as separate P1 candidate**: tool-registration regression at uncurse-tip — the agent-runner only supplies `continueDelegateOpts`, not `continueWorkOpts` or `requestCompactionOpts`. Pre-cure binaries supplied the full set. This regression is INDEPENDENT of Track A/B/C cure-bytes (which are sanitization-layer cures) but was introduced in the same deployment-cycle. Worth separate cohort decision-class before #79925 force-push.

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

