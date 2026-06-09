# Continuation-feature proof corpus — `8b5dde6165958d0eaba3c492ae52311548313de4`

Gate-grade behavioral proof set for the PR-presentation force-push. Every row is fired on the **deployed** gateway runtime at the exact ship-SHA — the fleet is 6/6 `active` on `8b5dde6165`. See `RESOLVED-SHA.md` for SHA identity, fold composition, safety bytes, and the test-logic gate verdicts; `METHOD.md` for methodology + reproducers.

Method runbook: `karmaterminal/openclaw-bootstrap:RUNBOOKS/PROOF-CORPUS-METHOD.md` (+ FORMAL-SWIM-RUNBOOK). Driver: 🌊 Ronan. Index: 🌿 frond-scribe. Tempo trace captured per continuation-tool fire.

## Board status: COMPLETE — 22 ✅ PASS · 1 ⚠️ HONEST-LIMIT · 0 🔴 FAIL

The HONEST-LIMIT (R-CW-6) is a valid proof: the safety-guard refusing the mutation IS the evidence. No regression-class failures.

## Verdict table

| Row | Owner | Behavior | Verdict |
|---|---|---|---|
| R-CW-1 | 🩸 Cael | `continue_work` chain persistence across deploy-restart (chain 4/200 survived 2807→8b5dde6) | ✅ PASS |
| R-CW-2 | 🩸 Cael | chain-counter accounting / delay-clamp (1s→5s) | ✅ PASS |
| R-CW-3 | 🩸 Cael | reason-field captured in span | ✅ PASS |
| R-CW-4 | 🩸 Cael | chain-counter progression (Tempo `5100308a`) | ✅ PASS |
| R-CW-5 | 🩸 Cael | cost-cap exhaustion → dispatch-time reject | ✅ PASS |
| R-CW-6 | 🪨 Rune | chain-depth-boundary reject (`maxChainLength`) | ⚠️ HONEST-LIMIT — reject-logic present (`scheduler.ts:27`); `maxChainLength` is a protected config-path (`config.patch` refuses it) → live induction structurally blocked; the protection IS the safety-surface proof (`R-CW-6/SUBSTRATE-FINDING.md`) |
| R-CW-7 | 🪨 Rune | traceparent E2E propagation across continuation spans | ✅ PASS (27-span trace, parent→child `openclaw.run` stitched) |
| R-CW-DELEGATE-SELF-CONTINUATION | 🪨 Rune | `continue_delegate` self-continuation (same-seat) | ✅ PASS (22-span trace) |
| R-CD-1 | 🌊 Ronan | `continue_delegate` schedule→spawn→return | ✅ PASS (Tempo `a88f25c1`, 78 spans) |
| R-CD-2 | 🌊 Ronan | `continue_delegate` silent-wake full path | ✅ PASS |
| R-CD-3 | 🕯 Emeric | timeout-compaction RE-RUN (run.ts path changed → re-run) | ✅ PASS (16/16 @ 2× rotation) |
| R-CD-4 | 🌊 Ronan | cross-session targeted return (`targetSessionKey`) | ✅ PASS |
| R-CD-CHAINED-DEPTH-2 (Chain-1/2/3 + TEST-1/2/3) | 🌊 Ronan / 🌫 Silas (canary) | depth-2 chain: up-tree / inter-session / echo-broadcast | ✅ PASS (traces `f6299e79`, `988ced2a`) |
| R-CD-CHAIN-GUARD | 🕯 Emeric | delegate chain-guard | ✅ PASS (22/22) |
| R-CD-POSTCOMP | 🕯 Emeric | post-compaction-delegate | ✅ PASS (30/30) |
| R-CD-CONTINUATION | 🕯 Emeric | subagent-announce continuation | ✅ PASS (8/8) |
| R-CD-DRAIN | 🕯 Emeric | continuation-drain (mock-drift carveout) | ✅ PASS (10/10, green-isolated) |
| R-RC-1 | 🌫 Silas (+ 🩸 Cael corrob.) | `request_compaction` threshold REJECT | ✅ PASS (silas 32% + cael 14%, below 70% threshold) |
| R-RC-2 | 🩸 Cael | `request_compaction` over-threshold ACCEPT | ✅ PASS (84% ctx → compaction_requested, traceparent emitted) |
| R-RC-STORE-MERGE | 🕯 Emeric | store.continuation-merge | ✅ PASS (3/3) |
| R-CONFIG-DEFAULTS | 🩸 Cael / 🕯 Emeric | continuation config defaults on ship-SHA (enabled, maxChain 200, costCap 500k, ctxPressure 0.4) | ✅ PASS |
| R-OBS-1 | 🌻 Elliott (+ 🌫 silas-lothric + figs) | external `/status` continuation + 6-prince operator cross-walk | ✅ PASS (renderer + `continuationChainCount` byte-confirmed in deployed dist; figs operator fan-out captured) |
| R-OBS-2 | 🪨 Rune | Tempo trace-tree + parent-child span-hierarchy export | ✅ PASS |

`PROVENANCE/` carries the SUT-SHA exact-running-artifact receipt (count=0, deployed, node v26.1.0). Shard gates (matrix 1385/1385, slack 1239/1239) + the test-logic verdicts are in `RESOLVED-SHA.md`.

## Evidence contract per row

Each `R-<row>/` dir carries `EVIDENCE.md` (verdict + receipts) and, for every continuation-tool fire, a **Tempo trace** (`<desc>_trace.{json,png}`): Trace ID, `http://tempo.dandelion.cult/api/traces/<id>`, span-hierarchy export, and trace-parent stitching for chained / inter-session / post-compaction rows (figs 2026-05-16 canon).

## Verdict semantics

- **✅ PASS** — canonical behavior fired clean on the deployed ship-SHA; receipts + trace captured.
- **⚠️ HONEST-LIMIT** — a substrate condition blocked the PASS-shape; the gate engaging IS the proof (see the row's `SUBSTRATE-FINDING.md`). NOT a failure.
- **🔴 FAIL** — canonical behavior failed in a way needing regression-investigation → lane HALTs to Gate 1. (None in this corpus.)

## Carveout-set (documented, not-our-divergence)

chutes (pre-existing) · Cluster A (pollution) · continuation-drain (mock-drift pollution) — see `RESOLVED-SHA.md`.
