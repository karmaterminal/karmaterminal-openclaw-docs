# R-CONFIG-DEFAULTS evidence — 46872994 safe assembly corpus

- **Aggregate state:** `pass`
- **Push / corpus SHA:** `46872994e4cae80830c381cb49456e8c77583d7e`
- **Proof-source SHA:** `e08f696618da57e7267a2148578fa4ab0d8b0d01`
- **Issue links:** karmaterminal/karmaterminal-openclaw-docs#368
- **Review note:** First k6 run was partial on both Cael/Ronan for config read/default bytes; manual path-scoped receipts now close the row. #368 remains preserved as method friction.

## Seat artifacts

| Seat | Run-result verdict | Evidence object | Run-result path |
|---|---:|---:|---|
| cael | `PARTIAL-candidate` | `false` | `PROOFS/46872994e4cae80830c381cb49456e8c77583d7e/artifacts/cael/p81-cael-live-resume2-20260709T031258Z/out/e08f696618da57e7267a2148578fa4ab0d8b0d01/R-CONFIG-DEFAULTS/cael/20260709T031405Z-r-config-defaults/run-result.json` |
| ronan | `PARTIAL-candidate` | `false` | `PROOFS/46872994e4cae80830c381cb49456e8c77583d7e/artifacts/ronan/p81-ronan-live-e08f696-20260709T032347Z/artifacts/e08f696618da57e7267a2148578fa4ab0d8b0d01/R-CONFIG-DEFAULTS/ronan/20260709T033022Z-r-config-defaults/run-result.json` |

## Notes

- Raw/redacted k6 output, row logs, report receipts, and generated `run-result.json` files are preserved under `artifacts/`.
- These are live-candidate artifacts: candidate states still require human fold review before becoming canonical PASS rows.

## Manual closeout receipt (post-merge)

Manual path-scoped config receipts were added after the first corpus merge:

- `manual-receipts/cael-continuation-config.json`
- `manual-receipts/ronan-continuation-config.json`
- `manual-receipts/MANUAL-REVIEW.md`

These receipts supply `enabled`, `maxChainLength`, `maxDelegatesPerTurn`, and `costCapTokens` from `agents.defaults.continuation` for Cael and Ronan without exposing secrets or mutating config. The aggregate row state is upgraded to `pass`; the original k6 partial artifacts and #368 remain preserved as method friction.
