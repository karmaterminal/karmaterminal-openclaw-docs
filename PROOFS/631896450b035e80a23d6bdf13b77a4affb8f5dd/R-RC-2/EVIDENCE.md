# R-RC-2 evidence — 5292af40 Project 81 corpus

- **Aggregate state:** `honest_limit`
- **Push / corpus SHA:** `5292af40d0ad5303b85a678f6e629503a8725848`
- **Fresh 5292 proof-source SHA:** `5292af40d0ad5303b85a678f6e629503a8725848`
- **Seeded/carried corpus:** `46872994e4cae80830c381cb49456e8c77583d7e`
- **Issue links:** karmaterminal/karmaterminal-openclaw-docs#373
- **Review note:** Do not fold as clean PASS. Cael observed logs/evidence as HONEST-LIMIT-candidate while generated run-result/summary converted to PASS-candidate with evidence:null; tracked in #373. Ronan produced PASS-candidate, but aggregate remains honest_limit pending review.

## Seat artifacts

| Seat | Run-result verdict | Evidence object | Run-result path |
|---|---:|---:|---|
| cael | `PASS-candidate` | `false` | `PROOFS/631896450b035e80a23d6bdf13b77a4affb8f5dd/artifacts/cael/p81-cael-live-resume7-20260709T033337Z/out/e08f696618da57e7267a2148578fa4ab0d8b0d01/R-RC-2/cael/20260709T033547Z-r-rc-2/run-result.json` |
| ronan | `PASS-candidate` | `false` | `PROOFS/631896450b035e80a23d6bdf13b77a4affb8f5dd/artifacts/ronan/p81-ronan-live-e08f696-20260709T032347Z/artifacts/e08f696618da57e7267a2148578fa4ab0d8b0d01/R-RC-2/ronan/20260709T033645Z-r-rc-2/run-result.json` |

## Notes

- Raw/redacted k6 output, row logs, report receipts, and generated `run-result.json` files are preserved under `artifacts/`.
- These are live-candidate artifacts: candidate states still require human fold review before becoming canonical PASS rows.
- This row is intentionally represented as `honest_limit` in the aggregate manifest despite generated PASS-candidate files, because the live log/evidence mismatch is the subject of #373.

## Fresh 5292 closeout

| Run | Seat | Verdict | k6 exit | Review | Run-result path |
|---|---|---:|---:|---|---|
| `28996296021` | cael | `PASS-candidate` | `0` | `ready-for-human-review` | `PROOFS/631896450b035e80a23d6bdf13b77a4affb8f5dd/artifacts/fresh-5292/actions/28996296021/20260709T053639Z-cael-dgx-4122681/5292af40d0ad5303b85a678f6e629503a8725848/R-RC-2/cael/20260709T053641Z-r-rc-2/run-result.json` |
| `28996297280` | ronan | `PASS-candidate` | `0` | `ready-for-human-review` | `PROOFS/631896450b035e80a23d6bdf13b77a4affb8f5dd/artifacts/fresh-5292/actions/28996297280/20260709T053739Z-ronan-dgx-4172683/5292af40d0ad5303b85a678f6e629503a8725848/R-RC-2/ronan/20260709T053742Z-r-rc-2/run-result.json` |

**5292 interpretation:** Fresh console evidence shows request_compaction rejected by context_threshold on both seats; fold as honest_limit despite generated PASS summaries.
