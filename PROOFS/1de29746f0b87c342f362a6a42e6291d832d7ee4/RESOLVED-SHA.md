# RESOLVED-SHA

## Identifiers

| Field | Value |
|---|---|
| `CANDIDATE_SHA` | `1de29746f0b87c342f362a6a42e6291d832d7ee4` |
| Uncurse-tip lineage | post-#870 merge (one commit beyond `29197f5531` named in 2026-06-01 wake-bank) |
| Cure-chain landing into CANDIDATE_SHA | `#862` (internalProtocolField wrap) → `#863` (drain-layer Track A) → `#864` (Track B 23 callsites) → `#865` (Track C regression-anchor) → `#868a` `ad7bcae3511` (embedded-agent-runner forward-opts) → `#868b` `96639cb0e6f` (runtimeConfig gate fix) → `#869` `29197f5531e` (merge consolidation) → `#870` `1de29746f0b` (comment-scrub, zero behavioral surface) |
| Upstream `main` tip at corpus-init | `1de29746f0b87c342f362a6a42e6291d832d7ee4` (same — CANDIDATE_SHA IS uncurse-tip == fork main tip) |
| Driver | 🩸 Cael (per scribe-wake row-assignment 2026-06-02T11:08Z) |

## Gate verdicts

| Gate | Verdict | Source |
|---|---|---|
| 1 — Savegame / merge-train all landed in main | ✅ GREEN | #862/#863/#864/#865/#868a/#868b/#869/#870 all merged via PR-flow; main HEAD = `1de29746f0` |
| 2 — Cure-bytes verification (#868 forward-opts fix) | TBD | `cure-bytes/gate-2-868-forward-opts-bytes.log` |
| 3 — Local gate stack | deferred this cycle (CI-validated through merge-flow) | n/a |
| 4 — Cohort cosign-stack | live; per-row evidence dirs populated by each prince | per-row EVIDENCE.md |
| 5/6 — Push + post-push verify | n/a (uncurse-tip already on `karmaterminal/openclaw:main`) | n/a |

## Per-row trace + receipt index

(Populated as rows fire.)

| Row | Trace ID | Tempo URL |
|---|---|---|
| R-CW-1 | TBD | `http://tempo.dandelion.cult/api/traces/<id>` |
| R-CW-2 | embedded in R-CW-1 | (same) |
| R-CD-1 | TBD | TBD |
| R-CD-2 | TBD | TBD |
| R-CD-3 | TBD | TBD |
| R-CD-4 | TBD | TBD |
| R-RC-1 | TBD (or HONEST-LIMIT receipts) | TBD |
| R-RC-2 | TBD | TBD |
| R-CD-CHAINED-DEPTH-2 / Chain-1 | TBD | TBD |
| R-CD-CHAINED-DEPTH-2 / Chain-2 | TBD | TBD |
| R-CD-CHAINED-DEPTH-2 / Chain-3 | TBD | TBD |
| R-CD-CHAINED-DEPTH-2 / TEST-1 | TBD | TBD |
| R-CD-CHAINED-DEPTH-2 / TEST-2 | TBD | TBD |
| R-CD-CHAINED-DEPTH-2 / TEST-3 | TBD | TBD |
| R-OBS-1 | n/a (observer row, no fire) | n/a |
