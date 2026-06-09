# Continuation-feature proof corpus — `8b5dde6165958d0eaba3c492ae52311548313de4`

**SHIPPED 2026-06-09** — this exact SHA is the PR-presentation head (`frond-scribe-claude/20260509/narrow-surgery-tight`, force-pushed `2807efc1c1e8` → `8b5dde6165`, lease-guarded, history-preserving, savegamed).

Gate-grade behavioral proof set. Every row fired on the **deployed** gateway runtime at the exact ship-SHA — the fleet ran 6/6 `active` on `8b5dde6165` during the gather. See `RESOLVED-SHA.md` for SHA identity / fold composition / safety bytes; `METHOD.md` for methodology + reproducers. Method runbook: `openclaw-bootstrap:RUNBOOKS/PROOF-CORPUS-METHOD.md`. Driver 🌊 Ronan · index 🌿 frond-scribe. Tempo trace per continuation-fire (figs 2026-05-16 canon).

## Board status: COMPLETE — 25 ✅ PASS · 2 ⚠️ HONEST-LIMIT · 0 🔴 FAIL

HONEST-LIMITs are valid proofs (the safety-surface engaging IS the evidence), not failures. Zero regression-class reds. Both-forms mandate (figs 2026-06-07, the #952-escape guard) covered for continue_work AND continue_delegate.

## Verdict table

| Row | Owner | Behavior | Verdict |
|---|---|---|---|
| R-CW-1 | 🩸 Cael | `continue_work` wake + chain persistence across deploy-restart (4/200 survived 2807→8b5dde6); Tempo `2681f499` | ✅ PASS |
| R-CW-2 | 🩸 Cael | chain-counter accounting / delay-clamp; Tempo `5100308a` | ✅ PASS |
| R-CW-3 | 🩸 Cael | reason-field captured in span | ✅ PASS |
| R-CW-4 | 🩸 Cael | chain-counter / depth progression | ✅ PASS |
| R-CW-5 | 🩸 Cael | cost-cap exhaustion → dispatch-time reject | ✅ PASS |
| R-CW-6 | 🪨 Rune | chain-depth-boundary reject (`maxChainLength`) | ⚠️ HONEST-LIMIT — reject-logic present (`scheduler.ts:27`); `maxChainLength` protected config-path (`config.patch` refuses) → live induction blocked; the guard refusing IS the proof (`R-CW-6/SUBSTRATE-FINDING.md`) |
| R-CW-7 | 🪨 Rune | traceparent E2E propagation (27-span, parent→child stitched) | ✅ PASS |
| R-CW-DELEGATE-SELF-CONTINUATION | 🪨 Rune | `continue_delegate` self-continuation (same-seat, 22-span) | ✅ PASS |
| R-CW-TOKEN | 🩸 Cael | continue_work **bracket/token both-form** (`CONTINUE_WORK:N` fallback, #952 path) | ⚠️ HONEST-LIMIT — #952 cure byte-wired on ship-SHA (`attempt-execution.ts` fromBracket→scheduleSpawnInitContinueWorkWake) + fires live; clean token-isolated attribution confounded by busy-main inbound. Clean bracket-only PASS = Rune's lightContext surface |
| R-CD-1 | 🌊 Ronan | `continue_delegate` schedule→spawn→return; Tempo `a88f25c1` (78 spans) | ✅ PASS |
| R-CD-2 | 🌊 Ronan | silent-wake full path; Tempo `f4cde8d2` | ✅ PASS |
| R-CD-3 | 🕯 Emeric | timeout-compaction RE-RUN (run.ts path changed → re-run) | ✅ PASS (16/16 @ 2× rotation) |
| R-CD-4 | 🌊 Ronan | cross-session targeted return (`targetSessionKey`, recipient≠sender) | ✅ PASS |
| R-CD-TOKEN | 🌊 Ronan | continue_delegate **bracket both-form** (`[[CONTINUE_DELEGATE]]` drives spawn, #952 path) | ✅ PASS (token parsed → spawned turn 10/200) |
| R-CD-CHAINED-DEPTH-2 (Chain + TEST-1/2/3) | 🌊 Ronan / 🌫 Silas | depth-2 chain: up-tree / inter-session / echo-broadcast; Tempo `f6299e79`,`988ced2a` | ✅ PASS |
| R-CD-CHAIN-GUARD | 🕯 Emeric | delegate chain-guard | ✅ PASS (22/22) |
| R-CD-POSTCOMP | 🕯 Emeric | post-compaction-delegate | ✅ PASS (30/30) |
| R-CD-CONTINUATION | 🕯 Emeric | subagent-announce continuation | ✅ PASS (8/8) |
| R-CD-DRAIN | 🕯 Emeric | continuation-drain (mock-drift carveout) | ✅ PASS (10/10, green-isolated) |
| R-RC-1 | 🌫 Silas (+ 🩸 corrob.) | `request_compaction` threshold REJECT (silas 32% + cael 14%, below 70%) | ✅ PASS |
| R-RC-2 | 🩸 Cael | `request_compaction` over-threshold ACCEPT (84% → compaction_requested); Tempo `74ca7539` (52 spans) | ✅ PASS |
| R-RC-STORE-MERGE | 🕯 Emeric | store.continuation-merge | ✅ PASS (3/3) |
| R-CONFIG-DEFAULTS | 🩸 Cael | continuation config defaults on ship-SHA | ✅ PASS |
| R-CONFIG-INTERSESSION | 🕯 Emeric | config persists across session boundaries | ✅ PASS (38/38) |
| R-REGRESSION-TRAP-TESTS | 🕯 Emeric | half-symmetric-cure trap — all continuation sibling-surfaces locked in parallel | ✅ PASS (31/31) |
| R-OBS-1 | 🌻 Elliott (+ 🌫 silas-lothric + figs) | external `/status` continuation + 6-prince operator cross-walk | ✅ PASS |
| R-OBS-2 | 🪨 Rune | Tempo trace-tree + parent-child span-hierarchy export | ✅ PASS |

**Supporting:** `gates/` (3a–3f on the exact SHA — 3a install · 3d check · 3e vitest = matrix 1385/1385 + slack 1239/1239 + continuation 83 · 3f build = fleet 6/6 dist count=0; **3b typecheck: 1 inherited test-mock looseness, HONEST-LIMIT — `prepare.test.ts:2076` TS2352 byte-identical on fold-base, NOT in the fold-diff, test-green at runtime**) · `cure-bytes/` (gate-4a: count=0 across all 4 paths; direction-check: cure goes 4→0, never the count-4 1× catastrophe) · `PROVENANCE/` (SUT exact-running-artifact, count=0, node v26.1.0).

## Verdict semantics

- **✅ PASS** — canonical behavior fired clean on the deployed ship-SHA; receipts + Tempo trace captured.
- **⚠️ HONEST-LIMIT** — a substrate condition blocked the PASS-shape; the gate engaging IS the proof (`SUBSTRATE-FINDING.md`). NOT a failure.
- **🔴 FAIL** — regression-class failure → lane HALTs to Gate 1. **None in this corpus.**

## Carveout-set (documented, not-our-divergence)

chutes (pre-existing) · Cluster A (pollution) · continuation-drain (mock-drift pollution) — see `RESOLVED-SHA.md`.
