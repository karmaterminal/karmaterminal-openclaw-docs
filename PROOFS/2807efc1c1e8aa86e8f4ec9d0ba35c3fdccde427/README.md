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
| R-CW-3 | 🩸 cael + 🕯 emeric x-walk | ⏳ in-flight | reason-field in continuation-dispatch span (capturing from wake trace) |
| R-CW-4 | 🩸 cael | ⏳ in-flight | chain.step.remaining decrement (capturing from wake trace) |
| R-CW-5 | 🩸 cael | ⏳ pending | cost-cap exhaustion → dispatch reject (likely HONEST-LIMIT: can't force 500k cap cleanly at submission) |
| R-CW-6 / R-CW-7 | 🪨 rune | ⏳ | — |
| R-CW-DELEGATE-SELF-CONTINUATION | 🪨 rune + x-walk | ⏳ | — |
| R-CD-1/2/3/4 + R-CD-CHAINED-DEPTH-2 | 🌊 ronan | ⏳ | — |
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
