# R-CONFIG-INTERSESSION evidence — e08f696 live P81 run

- **Aggregate state:** `pass`
- **Candidate SHA:** `e08f696618da57e7267a2148578fa4ab0d8b0d01`
- **Issue links:** karmaterminal/karmaterminal-openclaw-docs#369
- **Review note:** First k6 run was partial on both Cael/Ronan for config read/cross-session bytes; manual path-scoped receipts now close the row. #369 remains preserved as method friction.

## Seat artifacts

| Seat | Run-result verdict | Evidence object | Run-result path |
|---|---:|---:|---|
| cael | `PARTIAL-candidate` | `false` | `PROOFS/e08f696618da57e7267a2148578fa4ab0d8b0d01/artifacts/cael/p81-cael-live-resume3-20260709T031523Z/out/e08f696618da57e7267a2148578fa4ab0d8b0d01/R-CONFIG-INTERSESSION/cael/20260709T031526Z-r-config-intersession/run-result.json` |
| ronan | `PARTIAL-candidate` | `false` | `PROOFS/e08f696618da57e7267a2148578fa4ab0d8b0d01/artifacts/ronan/p81-ronan-live-e08f696-20260709T032347Z/artifacts/e08f696618da57e7267a2148578fa4ab0d8b0d01/R-CONFIG-INTERSESSION/ronan/20260709T033044Z-r-config-intersession/run-result.json` |

## Notes

- Raw/redacted k6 output, row logs, report receipts, and generated `run-result.json` files are preserved under `artifacts/`.
- These are live-candidate artifacts: candidate states still require human fold review before becoming canonical PASS rows.

## Manual closeout receipt (post-merge)

Manual path-scoped config receipts were added after the first corpus merge:

- `manual-receipts/cael-cross-session-targeting.json`
- `manual-receipts/ronan-cross-session-targeting.json`
- `manual-receipts/MANUAL-REVIEW.md`

These receipts supply `crossSessionTargeting="enabled"` from `agents.defaults.continuation.crossSessionTargeting` for Cael and Ronan without exposing secrets or mutating config. The aggregate row state is upgraded to `pass`; the original k6 partial artifacts and #369 remain preserved as method friction.
