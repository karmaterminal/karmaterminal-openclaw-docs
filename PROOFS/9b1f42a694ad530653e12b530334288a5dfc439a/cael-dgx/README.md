# cael-dgx — continuation proof rows, LIVE on deployed 9b1f42a694

**Owner:** 🩸 Cael | **Deployed binary:** `OpenClaw 2026.6.2 (9b1f42a)` — source HEAD `9b1f42a694ad530653e12b530334288a5dfc439a` | **Gateway restart (deploy landing):** 2026-06-09 11:14:52 PDT

figs's direct (b)-path ask (`1513958943`): gate-grade-fresh receipts on the DEPLOYED head (clawsweeper flagged the carry-over stale). NOT carry-over — `9b1f42a694` is a big upstream-reorg (lane files moved); rows fired LIVE on the deployed binary.

## Reorg'd continuation-primitive paths (deployed byte-confirm)
- `attempt-execution.ts` → `src/agents/command/` (blob `f7b4723f`)
- continuation bracket-parse → `src/auto-reply/tokens.ts` (`e5de316c`)
- `request-compaction-tool.ts` → `src/agents/tools/` (`70fd0955`)
- `continue-delegate-tool.ts` → `src/agents/tools/` (`df28d232`)
- `scheduler.ts` → `src/auto-reply/continuation/` (`d048ed37`)

## Row verdicts
| Row | Verdict | Evidence |
|---|---|---|
| R-CW-1/2/3 | ✅ LIVE | `continue_work()` fired; Tempo span `cce0fa55…` (chain.id `e82c675e…`, chain.step.remaining 176, reason.preview, STATUS_OK) + journal work-wake hop=24/200 |
| R-CW-4 | ✅ LIVE | chain.step.remaining=176 + hop=N/200 journal (cross-session independent hop-counters) |
| R-CW-5 | ✅ gate + ⚠️ honest-limit | cost-cap gate byte-confirmed live (`config.ts:87`, 500k); forcing 500k-exhaustion in-window not inducible |
| R-CW-TOKEN | ✅ wiring + token-flow observed | `tokens.ts:515` regex + `attempt-execution.ts:925` scheduleSpawnInitContinueWorkWake via fromBracket; token-flow `f84dd575` registered; clean isolated drive = quiet-seat upgrade |
| R-RC-2 | ✅ guard-live + ⚠️ honest-limit | live guard REJECT@29% (proves guard live on deployed binary); ACCEPT needs ≥70% (won't pad to game); tool-blob `70fd0955` byte-identical to prior-cycle 84%-ACCEPT proof |

Byte-honest: real fires where substrate allows, honest-limit (with live-gate byte-confirm) where it doesn't.
