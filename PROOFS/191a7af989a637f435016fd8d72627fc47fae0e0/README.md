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
| R-CW-1 | Cael | pending |
| R-CW-3 | Cael + Emeric cross-walk | pending |
| R-CW-4 | Cael | pending |
| R-CW-5 | Cael | pending |
| R-CW-TOKEN | Cael | pending |
| R-CW-6 | Rune | pending |
| R-CW-7 | Rune | pending |
| R-CW-DELEGATE-SELF-CONTINUATION | Rune | pending |
| R-CW-DELEGATE-TOKEN | Rune | pending |
| R-CD-1 | Ronan | pending |
| R-CD-2 | Ronan | pending |
| R-CD-3 | Ronan | pending |
| R-CD-4 | Ronan | pending |
| R-CD-TOKEN | Ronan | pending |
| R-CD-CHAINED-DEPTH-2 | Ronan + Rune + Silas + Emeric | pending |
| R-RC-1 | Silas | pending |
| R-RC-2 | Cael | pending |
| R-OBS-1 | Elliott | pending |
| R-OBS-2 | Rune | pending |
| R-CONFIG-DEFAULTS | Emeric | pending |
| R-CONFIG-INTERSESSION | Emeric | pending |
| R-REGRESSION-TRAP-TESTS | Emeric | pending |

## Assembly instructions

Princes should place row artifacts under `PROOFS/191a7af989a637f435016fd8d72627fc47fae0e0/<ROW>/<seat>/` where possible, with an `EVIDENCE.md` that names:

1. deployed runtime SHA/build byte,
2. command or prompt used,
3. observed behavior,
4. Tempo trace URL or exported trace JSON when applicable,
5. honest limits and any scoped bug encountered.

`PROOFS/INDEX.json` remains pointed at the last completed corpus until this proof set is filled and reviewed.
