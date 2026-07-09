# R-RC-2 evidence — 46872994 safe assembly corpus

- **Aggregate state:** `honest_limit`
- **Push / corpus SHA:** `46872994e4cae80830c381cb49456e8c77583d7e`
- **Proof-source SHA:** `e08f696618da57e7267a2148578fa4ab0d8b0d01`
- **Issue links:** karmaterminal/karmaterminal-openclaw-docs#373
- **Review note:** Do not fold as clean PASS. Cael observed logs/evidence as HONEST-LIMIT-candidate while generated run-result/summary converted to PASS-candidate with evidence:null; tracked in #373. Ronan produced PASS-candidate, but aggregate remains honest_limit pending review.

## Seat artifacts

| Seat | Run-result verdict | Evidence object | Run-result path |
|---|---:|---:|---|
| cael | `PASS-candidate` | `false` | `PROOFS/46872994e4cae80830c381cb49456e8c77583d7e/artifacts/cael/p81-cael-live-resume7-20260709T033337Z/out/e08f696618da57e7267a2148578fa4ab0d8b0d01/R-RC-2/cael/20260709T033547Z-r-rc-2/run-result.json` |
| ronan | `PASS-candidate` | `false` | `PROOFS/46872994e4cae80830c381cb49456e8c77583d7e/artifacts/ronan/p81-ronan-live-e08f696-20260709T032347Z/artifacts/e08f696618da57e7267a2148578fa4ab0d8b0d01/R-RC-2/ronan/20260709T033645Z-r-rc-2/run-result.json` |

## Notes

- Raw/redacted k6 output, row logs, report receipts, and generated `run-result.json` files are preserved under `artifacts/`.
- These are live-candidate artifacts: candidate states still require human fold review before becoming canonical PASS rows.
- This row is intentionally represented as `honest_limit` in the aggregate manifest despite generated PASS-candidate files, because the live log/evidence mismatch is the subject of #373.
