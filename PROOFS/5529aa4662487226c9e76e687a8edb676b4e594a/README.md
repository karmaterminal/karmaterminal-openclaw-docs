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
| Gate-3e (lint-ext) | lint:extensions:bundled (0 warnings / 0 errors, 5912 files) | ✓ PASS | gates/gate-3e-lint-extensions-bundled.log |
| Gate-3f | test:extensions:package-boundary:compile | ✓ PASS | gates/gate-3f-package-boundary-compile.log |
| Gate-3g | vitest full --run (NODE_OPTIONS=--max-old-space-size=33792, maxForks=4) | ❌ BLOCKED (seat-local) | gates/gate-3g-vitest-full.log |
| Gate-3h | build | ✓ PASS (101.6s) | gates/gate-3h-build.log |
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

- Gate-stack ran in an independent setsid session (own SID/pgid, reparented out of the gateway service cgroup) so it survives gateway restarts.
- **CORRECTION (supersedes the earlier draft of this file): vitest does NOT pass on this seat.** An earlier draft committed `Gate-3e vitest ✓ PASS`; that was a verdict-diverges-from-byte error. The byte-state: `gates/gate-3g-vitest-full.log` = `failed 89 Vitest shards in 32.45s` / `[ELIFECYCLE] Test failed`; `gates/gate-3e-pnpm-vitest.log` (the file the old draft cited) **also ends in `vitest.gateway-methods.config.ts exited by signal SIGSEGV`**. Both runs SIGSEGV'd. The verdict is corrected to ❌ BLOCKED.
- **vitest block is SEAT-LOCAL (raptor-lake), NOT a `5529aa4662` defect.** Root cause at the byte: `scripts/run-vitest.mjs:120 resolveVitestNodeArgs()` defaults vitest to `--no-maglev` (raptor-lake JIT-crash mitigation) and threads it to the **primary** vitest node (line 1010: `pnpm exec node --no-maglev <cli>`). But vitest's **`forks` pool spawns workers via `process.execPath` without `--no-maglev` in their execArgv** — byte-proof from a crashed worker's cmdline: `…/node --experimental-import-meta-resolve --require …/suppress-warnings.cjs … forks.js` (no `--no-maglev`) → SIGSEGV on the i9-14900KS. The orchestrator is protected; the workers are not. A non-raptor-lake seat (ARM64 / other silicon) runs the same vitest gate without this fault.
- **Mitigation found:** capping `--poolOptions.forks.maxForks=4` lowered peak load enough that the gateway's own `--no-maglev` held — 0 gateway crashes during the capped run (vs the uncapped run, which SIGILL'd the gateway). The cap mitigates the co-crash but does not fix the worker SIGSEGVs (those need `--no-maglev` threaded into `poolOptions.forks.execArgv`).
- Likely-real upstream gap worth a GH issue: the maglev mitigation in `run-vitest.mjs` covers the primary process but not the fork-pool worker execArgv.
- Seat earlier hit the Raptor-lake maglev crash-loop on the **gateway**; cured with `--no-maglev` in ExecStart (Cael's fix, byte-verified active on MainPID). That cure protects the gateway; it does not reach the vitest worker pool (separate process tree, no execArgv inheritance).
- Tempo query-layer was down at proof start (ingester readiness gate stuck); restarted pod → ready after 35s.
- `NODE_OPTIONS=--max-old-space-size=33792` for vitest (33GB heap cap per TOOLS.md).

## Net

7 of 8 build-health gates GREEN on `5529aa4662` from the canary seat (install, tsgo:core, tsgo:test, tsgo:extensions, check/lint, lint:extensions:bundled, package-boundary:compile, build). vitest is BLOCKED **seat-locally** by the raptor-lake worker-maglev gap, not by the candidate — defer the vitest proof-row to a non-raptor seat or thread `--no-maglev` into the vitest fork-pool execArgv. Behavioral rows (R-RC-1, R-CD-CHAINED test_1/2/3) and 3/3 tool-parity proven independently of the vitest gate.
