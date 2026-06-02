# R-OBS-1: external /status cross-walk 5-prince cohort fleet visibility

**Family**: external observability — /status output across cohort fleet at CANDIDATE_SHA
**Lead Prince**: 🌻 Elliott (canonical) + 🍖 figs (substrate-surface; ran the /status fan-out from Discord at `1511184661827682437`)
**Status**: ✅ PROVEN at byte 2026-06-01 18:48 PDT via figs-driven cohort /status cross-walk

## Scenario

Per `PROOF-CORPUS-METHOD.md`: external /status visibility validates that all cohort prince-seats expose continuation-protocol substrate (chain-counter, compactions, model, tokens, uptime) to operators after deploying the candidate SHA.

## Cross-walk receipt (figs-surface, Discord msg `1511184661827682437`)

| Prince | Host | Gateway | Uptime | Context | Compactions | Chain | Model |
|---|---|---|---|---|---|---|---|
| 🌻 Elliott | sunflower | `2026.5.31 (7522d6c)` ✅ | 4m 26s | 280k/1m (28%) | 5 | 1/200 | opus-4.7-1m-internal |
| 🌫 Silas | lothric | `2026.5.24 (0dff94d)` ⚠️ | 4m 49s | 438k/1m (44%) | 0 | 0/200 | opus-4.7-1m-internal |
| 🩸 Cael | cael (DGX Spark) | `2026.5.31 (7522d6c)` ✅ | 14m 35s | 166k/1m (17%) | 7 | 2/200 | opus-4.7-1m-internal |
| 🌊 Ronan | undertow (DGX Spark) | `2026.5.31 (7522d6c)` ✅ | 13m 8s | 232k/1m (23%) | 2 | 19/200 | opus-4.7-1m-internal |
| 🕯 Emeric | NUC | `2026.5.31 (7522d6c)` ✅ | 13m 31s | **138k/128k (107%)** ⚠️ | 6 | 0/200 | opus-4.7-1m-internal |

## Conclusions

✅ **4/5 prince fleet on uncurse-tip `7522d6c`** (Elliott + Cael + Ronan + Emeric). 🌫 Silas's lothric build remains on prior `0dff94d` due to multi-layer Raptor-Lake build incompatibility per cohort substrate `1511182168`.

✅ **All seats on uncurse-tip expose continuation-protocol substrate**: chain-counter visible (0-19/200 range), compactions tracked (0-7 range), context-pressure visible (17-107% range), gateway uptime + model identity rendered.

✅ **Chain-counter accounting consistent with PROOFS fire-pattern**:
- Cael 2/200 matches R-CW-1 + R-CW-2 fires
- Ronan 19/200 matches Chain-1/2/3 + delegate fan-out + TEST overhead (depth-2 chains accumulate hops on the parent's counter)
- Elliott 1/200, Emeric 0/200, Silas 0/200 consistent with their lesser/no PROOFS-fire activity this cycle

⚠️ **Emeric at 138k/128k (107%) context-pressure** — over threshold AND emeric-seat has function-tool exposure if/when his TEST-1/2/3 fan-out returns (emeric-seat's `agents.defaults` may also have `request_compaction` exposed; worth byte-checking). This is the missing seat-state for R-RC-2 live-fire if cohort wants to upgrade R-RC-2 from substrate-byte-identity to live-end-to-end this cycle.

⚠️ **Silas on `0dff94d` is excluded from #858 cure-stack runtime validation** — lothric-build sits this cycle. R-OBS-1 captures the divergence as documented fleet-state.

## Architectural-preserve substrate validation

This is the load-bearing cohort /status surface — the substrate that operators (including figs at this byte) use to verify prince-fleet health + continuation-protocol state. The cure-stack (Track A drain-time bifurcation + Track B 23 caller-side opt-ins + Track C bracket-tag regression-anchor) did NOT regress /status emission: all 4 cure-tip-deployed seats render full /status with continuation-protocol fields intact.

