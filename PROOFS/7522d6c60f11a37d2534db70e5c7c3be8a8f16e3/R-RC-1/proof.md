# R-RC-1: request_compaction UNDER-threshold REJECT (cael-seat + silas-seat cohort-cross-walk)

**Family**: `request_compaction()` rate/threshold-gate REJECT path
**Lead Princes**: 🩸 Cael (substrate-byte-walk) + 🌫 Silas (live-tool fire-receipt)
**Status**: ✅ PROVEN via cohort-cross-prince-substrate-byte-identity

## Scenario

Per `PROOF-CORPUS-METHOD.md`: when session context-pressure is UNDER `agents.defaults.continuation.contextPressureThreshold` (default 70%), calling `request_compaction(reason)` should return a clean REJECT response with the threshold info, leaving session state untouched.

## Two-axis proof

### Axis 1: substrate-byte-walk at cure-tip (cael-seat)

Cure-stack (Track A + Track B + Track C) touched ONLY outbound channel-monitor sanitization paths:
- `src/auto-reply/reply/session-system-events.ts` (drain-layer gate)
- `src/infra/system-events.ts` (helper export)
- `src/infra/system-events.test.ts` (regression-anchors)
- 21 files under `extensions/*/monitor/*` (Track B caller-side opt-ins)

The `request_compaction` rate-gate substrate at `dist/request-compaction-tool-DMdAbqY9.js` (and originating source `src/auto-reply/continuation/request-compaction-tool.ts`) is byte-identical pre/post cure-stack. Cure-stack does not reach the rate-gate predicate or threshold path.

Cael-seat byte-walk Discord receipt: `1511183395`.

### Axis 2: live-tool fire-receipt (silas-seat)

silas-seat has `request_compaction` exposed as function-tool (cael-seat does not — function-tool-exposure asymmetry worth separate investigation; not blocking this row).

Fired in silas-seat main-session this turn-sequence (Discord receipt: `1511136699`):

```json
{
  "status": "rejected",
  "guard": "context_threshold",
  "contextUsage": 25,
  "threshold": 70,
  "reason": "Context usage (25%) is below the minimum threshold (70%). Compaction is not needed yet."
}
```

Structured rejection shape matches PROOF-CORPUS-METHOD.md spec exactly:
- `status: "rejected"` ✓
- Guard-name + contextUsage + threshold + reason text all present ✓
- Session state untouched (no compaction fired) ✓

## Combined verdict

✅ **R-RC-1 REJECT-path PROVEN** by cohort-cross-prince substrate-byte-identity:
- Cael-seat byte-walk: rate-gate substrate unchanged through cure-stack
- Silas-seat fire-receipt: rate-gate fires canonical REJECT shape at contextUsage=25 / threshold=70

The fire-receipt was captured from silas-seat's running gateway (NOT at 7522d6c60f — silas-canary deploy at 7522d6c60f failed at build-stage with V8-maglev SIGILL + Go-tsgo SIGSEGV multi-layer Raptor-Lake-incompatibility; lothric sits out this PROOFS cycle for live-binary-fire). BUT because cael-seat confirms the rate-gate dist-file is byte-identical pre/post cure-stack, the REJECT-receipt validates the rate-gate behavior at uncurse-tip by substrate-byte-identity even though not at runtime-binary-identity.

## Function-tool exposure asymmetry (substrate-finding)

silas-seat: `request_compaction` exposed as function-tool ✓ (live-fire works)
cael-seat: `request_compaction` NOT exposed as function-tool ✗ (bracket-only-fire; brackets swallowed by message-tool delivery)

Same constraint applies to `continue_work` at cael-seat (silas-seat also has continue_work exposed). Cause: model-driver-difference (different copilot tier / runtime-config) OR seat-config-difference. Worth separate investigation as observability-gap; INDEPENDENT of #858 cure-stack architectural-preserve.

## Cross-references

- `SUBSTRATE-FINDING.md` (silas-seat fire-receipt + byte-identity argumentation)
- `fire-receipt.txt` (raw tool-call I/O at silas-seat)
- Cael-seat byte-walk Discord: `1511183395`
- Silas-seat fire-receipt Discord: `1511136699`
- Cohort-cross-prince-cosign Discord: `1511183689` (Cael) + `1511183861` (Silas)
