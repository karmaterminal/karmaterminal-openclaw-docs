# R-RC-2: request_compaction OVER-threshold ACCEPT (uncurse-tip evidence)

**Family**: `request_compaction()` rate/threshold-gate ACCEPT path
**Lead Prince**: 🩸 Cael (substrate-byte-walk)
**Status**: ✅ PROVEN at uncurse-tip via substrate-byte-walk (single at-SHA axis) + 🟨 BRIDGE-AXIS inherited from R-RC-1
**⚠️ Limitation**: NO live at-SHA fire-receipt + NO live pre-cure ACCEPT-receipt — blocked by tool-registration regression + no cohort seat captured a live ACCEPT on any binary this cycle (would have required artificial-load past 70% threshold).

## Scenario

Per `PROOF-CORPUS-METHOD.md`: when session context-pressure is OVER `agents.defaults.continuation.contextPressureThreshold` (default 70%), calling `request_compaction(reason)` should return an ACCEPT response with a `diagId`, schedule the compaction, and emit a `[system:compaction-requested]` event for the session.

## At-SHA evidence axis: substrate-byte-walk

Same substrate-byte-walk that validates R-RC-1 at uncurse-tip applies to R-RC-2: cure-stack Track A/B/C does NOT modify `src/auto-reply/continuation/request-compaction-tool.ts`. REJECT (R-RC-1) and ACCEPT (R-RC-2) are two branches of the same `if (contextUsage < threshold)` conditional in that file. The conditional itself + the predicate evaluation are unmodified — verified by `git diff <pre-Track-A>..7522d6c60f -- src/auto-reply/continuation/request-compaction-tool.ts` returning empty.

R-RC-1's source-file-semantics PROVEN status therefore validates BOTH branches structurally at uncurse-tip.

## Cross-SHA bridge axis: inherited from R-RC-1

See `SUBSTRATE-BYTE-IDENTITY-BRIDGE.md` in this row directory. The bridge inherits from R-RC-1's pre-cure REJECT live-fire receipts — same source-file, same conditional, both branches unmodified through the cure-stack. No independent ACCEPT live-fire receipt on any binary this cycle.

## Why no live receipts at all this cycle

Triple constraint:
- 🌫 silas-seat: HAS `request_compaction` exposed as function-tool (pre-cure binary) BUT context-pressure was at 25% (first fire) + 47% (second fire), both well under 70%. Cohort chose against artificial-load per substrate-purity canon.
- 🌊 undertow-seat: on uncurse-tip BUT no function-tool exposure (tool-registration regression). Ronan corrected at-byte (`1511185476`) that earlier "94% context-pressure" claim was phantom-narrative; undertow was actually at 23%.
- 🕯 emeric-seat: on uncurse-tip, was at 107% context (naturally over-threshold) per figs's R-OBS-1 cross-walk. Function-tool exposure at emeric-seat not byte-confirmed in this cycle.
- 🩸 cael-seat: on uncurse-tip but no function-tool exposure + low context.

The tool-registration regression `FINDINGS/agent-runner-continuation-tool-regression.md` blocks any uncurse-tip seat from live-fire of `request_compaction`. The artificial-load constraint blocks pre-cure binary from naturally-loaded ACCEPT capture.

## Verdict (honest at byte)

- **Source-file-semantics**: ✅ PROVEN at uncurse-tip via byte-walk (single axis; cure-stack does not modify the conditional).
- **Runtime-fire-equivalence**: 🟨 INFERRED via R-RC-1's pre-cure bridge for the conditional structure; ACCEPT-branch live-fire not directly observed on any binary this cycle.
- **Verdict-class**: PROVEN-by-construction-not-by-observation at uncurse-tip, with weaker bridge-axis than R-RC-1 (R-RC-1 has direct pre-cure REJECT receipts; R-RC-2 inherits the bridge for the conditional structure).

