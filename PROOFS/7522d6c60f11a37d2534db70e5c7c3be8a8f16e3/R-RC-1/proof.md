# R-RC-1: request_compaction UNDER-threshold REJECT (uncurse-tip evidence)

**Family**: `request_compaction()` rate/threshold-gate REJECT path
**Lead Prince**: 🩸 Cael (substrate-byte-walk)
**Status**: ✅ PROVEN at uncurse-tip via substrate-byte-walk (single at-SHA axis) + 🟨 BRIDGE-AXIS from pre-cure binary substrate (see `SUBSTRATE-BYTE-IDENTITY-BRIDGE.md`)
**⚠️ Limitation**: NO live at-SHA fire-receipt captured this cycle — blocked by agent-runner tool-registration regression at uncurse-tip (see `FINDINGS/agent-runner-continuation-tool-regression.md`).

## Scenario

Per `PROOF-CORPUS-METHOD.md`: when session context-pressure is UNDER `agents.defaults.continuation.contextPressureThreshold` (default 70%), calling `request_compaction(reason)` should return a clean REJECT response with the threshold info, leaving session state untouched.

## At-SHA evidence axis: substrate-byte-walk (cael-seat)

Cure-stack (Track A + Track B + Track C) touched ONLY outbound channel-monitor sanitization paths:
- `src/auto-reply/reply/session-system-events.ts` (drain-layer gate)
- `src/infra/system-events.ts` (helper export)
- `src/infra/system-events.test.ts` (regression-anchors)
- 21 files under `extensions/*/monitor/*` (Track B caller-side opt-ins)

The `request_compaction` rate-gate substrate at `src/auto-reply/continuation/request-compaction-tool.ts` (and built artifact `dist/request-compaction-tool-DMdAbqY9.js`) is byte-identical pre-cure vs uncurse-tip. Cure-stack does not reach the rate-gate predicate or threshold path.

Cael-seat byte-walk Discord receipt: `1511183395`.

## Cross-SHA bridge axis (substrate-byte-identity)

See `SUBSTRATE-BYTE-IDENTITY-BRIDGE.md` in this row directory. Silas-seat fired live `request_compaction` REJECT receipts on pre-cure binary `0dff94d` at two context-load levels (25% + 47%); those receipts validate the rate-gate semantics that uncurse-tip inherits unchanged via the byte-identity argument. The fires are located at `PROOFS/0dff94dbe4875a3b7ed44c60a9097a5f55083572/2026-06-01-cohort-cycle-bridge-fires/R-RC-1-silas-direct-fire/`.

## Why no live at-SHA fire-receipt

The agent-runner tool-registration regression at uncurse-tip means `request_compaction` is not exposed as a function-tool from main-session at any prince-seat deployed at `7522d6c60f`. See `FINDINGS/agent-runner-continuation-tool-regression.md`. Closing this gap requires the regression-cure to land + re-fire from a seat at `7522d6c+regression-cure`.

## Verdict (honest at byte)

- **Source-file-semantics**: ✅ PROVEN at uncurse-tip via byte-walk that cure-stack does not modify the rate-gate path.
- **Runtime-fire-equivalence**: 🟨 INFERRED via byte-identity bridge from pre-cure binary live-fire — not directly observed at uncurse-tip.
- **Verdict-class**: PROVEN-by-construction-not-by-observation at uncurse-tip. Live at-SHA observation blocked by separate regression.

