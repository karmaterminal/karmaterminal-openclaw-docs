# PROOFS / c06e081f760d723c77bee65464b8920a76d3b523

Behavioral proof corpus for the **v4 fleet candidate** (`frond-scribe/20260611/drift-preview-990-v4`) — the deployed assembly head certifying the changes since the last PR-presentation update: **#990 (3-state continuation classifier) + #996 (`:518` succeeded-exclusion) + drift-corrections**.

- **SHA**: `c06e081f760d723c77bee65464b8920a76d3b523` (`OpenClaw 2026.6.2`)
- **Deploy**: ronan / emeric / elliott / silas live on `c06e081` (byte-confirmed); cael held (dirty-tree, re-fires on cleanup); rune `/new`-pending.
- **Method**: `openclaw-bootstrap:RUNBOOKS/PROOF-CORPUS-METHOD.md` — full row-set, both-forms mandate, Tempo trace per continuation-fire, honest HONEST-LIMITs.

## Summary (2026-06-11, fleet RUN-certifying — updating as rows land)

The #990/#996 continuation surface RUN-certified live on `c06e081` across the deployed seats. Early landings:
- **#996 `:518` fix LIVE in the deployed dist** — byte-confirmed across seats (ronan `work-store-5haSToNg.js:362`, emeric/silas `work-store.ts:534`): the `!decodeWorkState(flow)?.succeeded` exclusion compiled into the running binary.
- **continue_delegate → flow_runs dispatch-path proven live** (ronan flow_runs `953ab2d6` @ 18:48 PDT) — the #990-continuation feature firing end-to-end on v4.

## Verdict table (updating as rows land — each owner fills their own rows at the byte)

| Row | Owner | Verdict | Evidence |
|---|---|---|---|
| R-CW-DELEGATE | 🌊 ronan | ✅ PASS | continue_delegate → fresh `flow_runs` row `953ab2d6` @ 18:48 PDT on deployed `c06e081`; #996 `:518` live in dist line 362 — `ronan-dgx/R-CW-DELEGATE/` |
| PROOF-receipt (boot/continuation/health) | 🕯 emeric | ✅ PASS | boot-clean on v4 fan-restart; #996 live `work-store.ts:534`; flow_runs 479 intact across deploy-seam; RSS 0.64GB — `emeric-nuc/` |
| R-OBS-1 (external `/status` + 4-prince cross-walk) | 🌻 elliott | ⏳ in-flight | `/status` renders continuation surface clean on v4 (`🔄 Continuation: chain 0/200`, build `c06e081`); gathering cross-walk — `elliott-host/R-OBS-1/` |
| (rows for #990 3-state classifier / #996 / grade-ladder) | 🌊 / cohort | ⏳ in-flight | per the runbook + digest `1514800799` |

> Rows land as owners fire them. cael joins on install-dir cleanup (→ 6/6); rune joins on `/new`.

## Tempo trace requirement
Every continuation-tool fire captures the Grafana Tempo trace + span export (figs 2026-05-16 directive).
