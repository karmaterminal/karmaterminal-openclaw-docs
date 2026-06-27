# PROOFS / 191a7af989a637f435016fd8d72627fc47fae0e0

Behavioral proof corpus for the deployed assembly continuation candidate `191a7af989a637f435016fd8d72627fc47fae0e0`.

- **SHA**: `191a7af989a637f435016fd8d72627fc47fae0e0`
- **Short**: `191a7af989a6`
- **Branch**: `karmaterminal/openclaw:frond-scribe/20260624/assembly-continuation-followons`
- **Method**: `openclaw-bootstrap:RUNBOOKS/PROOF-CORPUS-METHOD.md`
- **Status**: in progress; row owners are firing live proofs on deployed prince gateways.

## Gate and deploy state

| Surface | Result |
|---|---|
| Hosted drift gate `28294844687` | PASS: `FROZEN-STALE=0`, `MIXED-CLOBBER=0`, total 317 |
| `openclaw-local-ci` `28294845382` | PASS: 85,062 tests passed / 0 failed |
| Deploy | PASS: all six gateways live on `191a7af989` |
| Known caveat | Upstream moved after this green SHA; later drift is intended to be absorbed after proofs if it does not touch continuation surface. |
| Known unrelated live bug | Discord reply-session conflict matches upstream open `openclaw/openclaw#96936`; do not classify as deploy regression. |

## Corpus files

- `proofs-manifest.json` — in-progress row manifest and owner map.
- `RESOLVED-SHA.md` — SHA identity, deploy, and gate receipts.
- Row directories are named in `proofs-manifest.json`; owners should create/populate them with `EVIDENCE.md`, trace JSON, receipts, and honest-limit notes.

## Row-owner map

| Row | Owner | State |
|---|---|---|
| R-CW-1 | Cael | pass |
| R-CW-3 | Cael + Emeric cross-walk | pass (Emeric + Cael filed) |
| R-CW-4 | Cael | pass |
| R-CW-5 | Cael | pass |
| R-CW-TOKEN | Cael | pass |
| R-CW-6 | Rune | pass |
| R-CW-7 | Rune | pass |
| R-CW-DELEGATE-SELF-CONTINUATION | Rune | pass |
| R-CW-DELEGATE-TOKEN | Rune | pending |
| R-CD-1 | Ronan | pending |
| R-CD-2 | Ronan + Silas fill-in canary | pass |
| R-CD-3 | Ronan | pending |
| R-CD-4 | Ronan | pending |
| R-CD-MODEL-DEFAULT | Ronan | pending |
| R-CD-MODEL-TOOL | Ronan | honest_limit (#1103) |
| R-CD-MODEL-TOKEN | Ronan | honest_limit (#1103) |
| R-CD-MODEL-CHAINED-ALT | Ronan | honest_limit (#1103) |
| R-CD-TOKEN | Ronan | pending |
| R-CD-CHAINED-DEPTH-2 | Ronan + Rune + Silas + Emeric | pending |
| R-RC-1 | Silas | pass |
| R-RC-2 | Cael | honest_limit |
| R-OBS-1 | Elliott + figs external observer | pass |
| R-OBS-2 | Rune | pass |
| R-CONFIG-DEFAULTS | Emeric | pass |
| R-CONFIG-INTERSESSION | Emeric | pass |
| R-REGRESSION-TRAP-TESTS | Emeric | pass |

## Assembly instructions

Princes should place row artifacts under `PROOFS/191a7af989a637f435016fd8d72627fc47fae0e0/<ROW>/<seat>/` where possible, with an `EVIDENCE.md` that names:

1. deployed runtime SHA/build byte,
2. command or prompt used,
3. observed behavior,
4. Tempo trace URL or exported trace JSON when applicable,
5. honest limits and any scoped bug encountered.

`PROOFS/INDEX.json` remains pointed at the last completed corpus until this proof set is filled and reviewed.


## Rune fill status (2026-06-27)

Fresh Rune rows on `191a7af989`:

| Row | State | Evidence |
|---|---|---|
| R-CW-6-BOUNDARY | ✅ PASS | `R-CW-6-BOUNDARY/rune-rog-ally/EVIDENCE.md` |
| R-CW-7-TRACEPARENT-E2E | ✅ PASS | `R-CW-7-TRACEPARENT-E2E/rune-rog-ally/EVIDENCE.md` + `trace-00000000000000000000000000000001-dispatch-tree.json` |
| R-CW-DELEGATE-SELF-CONTINUATION | ✅ PASS | `R-CW-DELEGATE-SELF-CONTINUATION/rune-rog-ally/EVIDENCE.md` + trace JSON |
| R-OBS-2 | ✅ PASS | `R-OBS-2/rune-rog-ally/EVIDENCE.md` + span-hierarchy JSON |

Manifest rollup after Rune fill was superseded by later folds; current rollup after Silas R-CD-2 fill is `16 pass / 1 partial / 4 honest_limit / 7 pending / 0 fail / 0 missing`.


## Silas fill status (2026-06-27)

Silas filled one safe Ronan-owned row without touching `PROOFS/INDEX.json`:

| Row | State | Evidence |
|---|---|---|
| R-CD-2 | ✅ PASS-candidate | `R-CD-2/silas-lothric/EVIDENCE.md` + redacted k6 artifacts + nonce-only delegate return |

The fill-in proof is explicitly seat-scoped to Silas. It does not claim Ronan-local artifacts or unblock the remaining Ronan R-CD rows without their own receipts/Tempo exports.
