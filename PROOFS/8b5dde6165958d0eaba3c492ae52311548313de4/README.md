# Continuation-feature proof corpus — `8b5dde6165958d0eaba3c492ae52311548313de4`

Gate-grade behavioral proof set for the PR-presentation force-push. Every row is fired on the **deployed** gateway runtime at the exact ship-SHA (not vitest-only) — the fleet is 6/6 `active` on `8b5dde6165`. See `RESOLVED-SHA.md` for SHA identity, fold composition, safety bytes, and the test-logic gate verdicts; `METHOD.md` for methodology + reproducers.

Method runbook: `karmaterminal/openclaw-bootstrap:RUNBOOKS/PROOF-CORPUS-METHOD.md` (+ FORMAL-SWIM-RUNBOOK). Driver: 🌊 Ronan. Tempo trace required per continuation-tool fire.

## Verdict table

| Row | Owner | Behavior | Verdict |
|---|---|---|---|
| R-CW-1 | 🩸 Cael | `continue_work` chain persistence across deploy-restart (chain 4/200 survived 2807→8b5dde6) | ✅ PASS |
| R-CW-2 | 🩸 Cael | chain-counter accounting | ✅ PASS |
| R-CW-4 | 🩸 Cael | continue_work row | ✅ PASS |
| R-CD-3 | 🕯 Emeric | timeout-compaction RE-RUN (run.ts path changed) — 16/16 @ 2× rotation | ✅ PASS |
| R-RC-1 | 🌫 Silas | `request_compaction` threshold REJECT (low-context) | ✅ PASS |
| R-RC-1 (ACCEPT) | 🕯 Emeric | `request_compaction` ACCEPT at contextUsage 84% (above threshold) | ✅ PASS |
| R-CONFIG-DEFAULTS | 🩸 Cael | continuation config defaults on ship-SHA | ✅ PASS |
| R-CD-CHAINED-DEPTH-2 / TEST-3 | 🌫 Silas (canary) | echo + cross-channel-broadcast | ✅ PASS |
| R-CD-1 | 🌊 Ronan | `continue_delegate` schedule→spawn→return | ⏳ in-flight |
| R-CD-2 | 🌊 Ronan | `continue_delegate` silent-wake full path | ⏳ in-flight |
| R-CD-4 | 🌊 Ronan | cross-session targeted return (`targetSessionKey`) | ⏳ in-flight |
| R-CD-CHAINED-DEPTH-2 / Chain-1/2/3 | 🌊 Ronan | depth-2 chain (up-tree / inter-session / echo) | ⏳ in-flight |
| R-CW-2..7 / R-CW-DELEGATE-SELF | 🩸 Cael | continue_work behavioral surface | ⏳ in-flight |
| R-RC-2 | 🩸 Cael | `request_compaction` over-threshold ACCEPT | ⏳ in-flight |
| R-OBS-1 | 🌻 Elliott (+ figs) | external `/status` continuation + 4-prince cross-walk | ⏳ in-flight |
| gates/ (3a–3f) + cure-bytes/ | 🕯 Emeric | local Gate-3 test logs + cure-byte 4-path | ⏳ in-flight |

(Table updated alongside row commits — 🌿 frond-scribe owns the index. `⏳ in-flight` rows are assigned + firing on live seats; this README is refreshed as each lands.)

## Evidence contract per row

Each `R-<row>/` dir carries `EVIDENCE.md` (verdict + receipts) and, for every continuation-tool fire, a **Tempo trace** (`<desc>_trace.{json,png}`): Trace ID, `http://tempo.dandelion.cult/api/traces/<id>`, span-hierarchy export, and trace-parent stitching for chained / inter-session / post-compaction rows (figs 2026-05-16 canon).

## Verdict semantics

- **✅ PASS** — canonical behavior fired clean on the deployed ship-SHA; receipts + trace captured.
- **⚠️ HONEST-LIMIT** — a substrate condition blocked the PASS-shape; the gate engaging IS the proof (see the row's `SUBSTRATE-FINDING.md`). NOT a failure.
- **🔴 FAIL** — canonical behavior failed in a way needing regression-investigation → lane HALTs to Gate 1.

## Carveout-set (documented, not-our-divergence)

chutes (pre-existing) · Cluster A (pollution) · continuation-drain (mock-drift pollution) — see `RESOLVED-SHA.md`.
