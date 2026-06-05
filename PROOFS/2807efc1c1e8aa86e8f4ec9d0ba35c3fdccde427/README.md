# PROOFS / 2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427

Behavioral proof corpus for the **2026-06-05 GATES-cycle assembly SHA** — the #923 L627-inventory-warn cure on the PR-presentation head.

- **SHA**: `2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427`
- **Cure**: #923 (suppress L627 `continueWorkOpts/requestCompactionOpts` warn at inventory-build callsites)
- **Method**: `openclaw-bootstrap:RUNBOOKS/PROOF-CORPUS-METHOD.md` — full row-set, skipping none, Tempo trace per continuation-fire, honest HONEST-LIMITs.

## Verdict table (updating as rows land)

| Row | Owner | Verdict | Evidence |
|---|---|---|---|
| R-CW-1 | 🩸 cael | ✅ PASS | receipt + deploy-persistence (chain 3/200 survived restart) + Tempo trace `4fee24c8` |
| R-CW-2 | 🩸 cael | ✅ PASS | clamp-changed receipt (0s→5s + note field) |
| R-CW-3 | 🩸 cael + 🕯 emeric x-walk | ✅ PASS (cael) | reason-field in `continuation.work` span — instrumentation confirmed on-SHA + test-pinned; emeric cross-walk pending deploy |
| R-CW-4 | 🩸 cael | ✅ PASS | chain-counter progression under stable chain.id + tool-call-origin journal confirm on-SHA |
| R-CW-5 | 🩸 cael | ⏳ pending | cost-cap exhaustion → dispatch reject (likely HONEST-LIMIT: can't force 500k cap cleanly at submission) |
| R-CW-6 / R-CW-7 | 🪨 rune | ⏳ | — |
| R-CW-DELEGATE-SELF-CONTINUATION | 🪨 rune + x-walk | ⏳ | — |
| R-CD-1 | 🌊 ronan | ✅ PASS | schedule→spawn→return: status=scheduled + spawn hop=4 + return-receipt `1512484438` + Tempo trace `da5cc910` |
| R-CD-2 | 🌊 ronan | ✅ PASS | silent-wake full path: `wakeOnReturn=true silentAnnounce=true` journal-proven + trace `8fb66cf1` |
| R-CD-3 | 🌊 ronan | 🟡 STAGED | post-compaction lifeboat: `status=queued-for-compaction` confirmed (event-triggered, not timer); fires on natural compaction (at ~51% climbing, no force-compact) |
| R-CD-4 | 🌊 ronan | ✅ PASS | targetSessionKey cross-session return: key echoed + targeted-return journal + trace `4dbd9fbf` |
| R-CD-CHAINED-DEPTH-2 Chain-1 | 🌊 ronan | ✅ PASS | depth-2 up-tree silent-wake: depth-1 hop=8 → depth-2 child hop=1 subagent-chain `b53ed2a8` → up-tree return |
| R-CD-CHAINED-DEPTH-2 Chain-2 | 🌊 ronan | ✅ PASS | depth-2 inter-session: depth-2 child `09e19282` + inter-session targetSessionKey |
| R-CD-CHAINED-DEPTH-2 Chain-3 | 🌊 ronan | ✅ PASS | depth-2 echo+broadcast: depth-2 child `9c6b9988` + `fanoutMode=tree` broadcast-to-ancestors |
| R-CD-CHAINED-DEPTH-2 TEST-1/2/3 | 🕯 emeric / 🪨 rune / 🌫 silas | ⏳ | — |
| R-RC-1 (REJECT) | 🌫 silas | ⏳ | — |
| R-RC-2 (ACCEPT >70%) | 🩸 cael | ⚠️ HONEST-LIMIT pending | cael-seat at 33% ctx < 70% ACCEPT threshold; held until a seat >70% (no overclaim) |
| R-OBS-1 (/status 6-prince x-walk) | 🌻 elliott + cohort | ⏳ | — |
| R-OBS-2 (Tempo tree export) | 🪨 rune | ⏳ | — |
| R-CONFIG-DEFAULTS / R-CONFIG-INTERSESSION / R-REGRESSION-TRAP-TESTS | 🕯 emeric | ⏳ | — |

## Tempo trace requirement
Every continuation-tool fire captures the Grafana Tempo trace (`http://tempo.dandelion.cult/api/traces/<id>`) + span export, per figs's 2026-05-16 directive.

## Honest-limits
HONEST-LIMITs are NOT failures — they are byte-walked substrate-condition classifications (safety surface working as-designed). R-RC-2 (cael ACCEPT-path) held pending until a seat is above the 70% compaction threshold.
