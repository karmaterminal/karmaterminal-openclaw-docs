# R-CONFIG-INTERSESSION evidence — 5292af40 Project 81 corpus

- **Aggregate state:** `pass`
- **Push / corpus SHA:** `5292af40d0ad5303b85a678f6e629503a8725848`
- **Fresh 5292 proof-source SHA:** `5292af40d0ad5303b85a678f6e629503a8725848`
- **Seeded/carried corpus:** `46872994e4cae80830c381cb49456e8c77583d7e`
- **Issue links:** karmaterminal/karmaterminal-openclaw-docs#369
- **Review note:** First k6 run was partial on both Cael/Ronan for config read/cross-session bytes; manual path-scoped receipts now close the row. #369 remains preserved as method friction.

## Seat artifacts

| Seat | Run-result verdict | Evidence object | Run-result path |
|---|---:|---:|---|
| cael | `PARTIAL-candidate` | `false` | `PROOFS/ffcfeee2dedebb2e8ba68be5c03efc8771aa15c3/artifacts/cael/p81-cael-live-resume3-20260709T031523Z/out/e08f696618da57e7267a2148578fa4ab0d8b0d01/R-CONFIG-INTERSESSION/cael/20260709T031526Z-r-config-intersession/run-result.json` |
| ronan | `PARTIAL-candidate` | `false` | `PROOFS/ffcfeee2dedebb2e8ba68be5c03efc8771aa15c3/artifacts/ronan/p81-ronan-live-e08f696-20260709T032347Z/artifacts/e08f696618da57e7267a2148578fa4ab0d8b0d01/R-CONFIG-INTERSESSION/ronan/20260709T033044Z-r-config-intersession/run-result.json` |

## Notes

- Raw/redacted k6 output, row logs, report receipts, and generated `run-result.json` files are preserved under `artifacts/`.
- These are live-candidate artifacts: candidate states still require human fold review before becoming canonical PASS rows.

## Manual closeout receipt (post-merge)

Manual path-scoped config receipts were added after the first corpus merge:

- `manual-receipts/cael-cross-session-targeting.json`
- `manual-receipts/ronan-cross-session-targeting.json`
- `manual-receipts/MANUAL-REVIEW.md`

These receipts supply `crossSessionTargeting="enabled"` from `agents.defaults.continuation.crossSessionTargeting` for Cael and Ronan without exposing secrets or mutating config. The aggregate row state is upgraded to `pass`; the original k6 partial artifacts and #369 remain preserved as method friction.

## Fresh 5292 closeout

Fresh k6 read-path attempts are preserved in failed-run logs; the row is closed by the fresh path-scoped config receipts listed above.

**5292 interpretation:** Fresh path-scoped config receipts show crossSessionTargeting="enabled" after deploy; the k6 read-path failure is preserved as harness friction.
