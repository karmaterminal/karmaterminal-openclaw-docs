# PROOFS — Silas (canary) seat behavioral cross-walk

**SHA:** `5529aa4662487226c9e76e687a8edb676b4e594a`
**Seat:** silas (canary, lothric, 10.0.0.100)
**Date:** 2026-06-12 22:28–22:32 PDT
**Build:** OpenClaw 2026.6.2 (5529aa4)

## Verdict Table

| Row | Shape | Verdict | Evidence |
|-----|-------|---------|----------|
| Gate-3a | pnpm install (frozen-lockfile) | ✓ PASS | gates/gate-3a-pnpm-install.log |
| Gate-3b | tsgo:core | ✓ PASS | gates/gate-3b-pnpm-tsgo.log |
| Gate-3c | tsgo:test | ✓ PASS | gates/gate-3c-pnpm-tsgo-test.log |
| Gate-3d | check (lint) | ✓ PASS | gates/gate-3d-pnpm-check.log |
| Gate-3e | vitest full --run (NODE_OPTIONS=--max-old-space-size=33792) | ✓ PASS | gates/gate-3e-pnpm-vitest.log |
| Gate-3f | build | ✓ PASS | gates/gate-3f-pnpm-build.log |
| R-RC-1 | request_compaction threshold-REJECT (21% < 70%) | ✓ PASS | R-RC-1/ |
| R-CD-CHAINED test_1 | Depth-2 chained continue_delegate (outer depth-1 → inner depth-2, uptree return, silent-wake) | ✓ PASS | R-CD-CHAINED-DEPTH-2/test_1_uptree_silent_wake/ |
| R-CD-CHAINED test_2 | Inter-session return (targetSessionKey/targetSessionKeys cross-session, fanoutMode tree/all) | ✓ PASS | R-CD-CHAINED-DEPTH-2/test_2_intersession_return/ |
| R-CD-CHAINED test_3 | Echo + channel-broadcast (fanoutMode=all, drainsContinuationDelegateQueue tool-parity) | ✓ PASS | R-CD-CHAINED-DEPTH-2/test_3_echo_broadcast/ |

## Tool-Parity Confirmation

All 3 of 3 continuation/compaction tools registered + live on main-session prince:
- `request_compaction` — fired, threshold-rejection proven (structured guard, not error)
- `continue_delegate` — fired, depth-2 chain proven (outer → inner, receipts on disk)
- `continue_work` — registered in toolset

## Tempo Trace

Trace ID: `50c7ab1821d79f0a05a631256b3d8f08`
Saved: `R-CD-CHAINED-DEPTH-2/turn_trace.json` (79,584 bytes)
Source: `tempo.dandelion.cult` (k3s pod, restarted during proofs run to clear ingester readiness gate)

## Notes

- Gate-stack ran via `systemd-run --user --scope` (independent lifecycle, survives gateway restarts).
- Seat experienced Raptor-lake maglev JIT crash-loop during initial proof attempt; cured with `--no-maglev` in ExecStart (Cael's fix). Gates completed cleanly after cure.
- Tempo query-layer was down at proof start (ingester readiness gate stuck); restarted pod → ready after 35s.
- `NODE_OPTIONS=--max-old-space-size=33792` for vitest (33GB heap cap per TOOLS.md).
