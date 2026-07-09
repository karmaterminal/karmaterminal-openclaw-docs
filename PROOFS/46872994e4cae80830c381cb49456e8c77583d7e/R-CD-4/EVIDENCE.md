# R-CD-4 evidence — 46872994 safe assembly corpus

- **Aggregate state:** `pass`
- **Push / corpus SHA:** `46872994e4cae80830c381cb49456e8c77583d7e`
- **Proof-source SHA:** `e08f696618da57e7267a2148578fa4ab0d8b0d01`
- **Issue links:** karmaterminal/karmaterminal-openclaw-docs#366
- **Review note:** Initial Cael unattended all-run needed OPENCLAW_CREATE_DISPOSABLE_SESSIONS=true; resumed Cael and Ronan both produced PASS-candidate evidence after the disposable-session env workaround.

## Seat artifacts

| Seat | Run-result verdict | Evidence object | Run-result path |
|---|---:|---:|---|
| cael | `PARTIAL-candidate` | `false` | `PROOFS/46872994e4cae80830c381cb49456e8c77583d7e/artifacts/cael/p81-cael-live-20260709T030352Z/out/e08f696618da57e7267a2148578fa4ab0d8b0d01/R-CD-4/cael/20260709T030444Z-r-cd-4/run-result.json` |
| cael | `PASS-candidate` | `true` | `PROOFS/46872994e4cae80830c381cb49456e8c77583d7e/artifacts/cael/p81-cael-live-resume-20260709T030548Z/out/e08f696618da57e7267a2148578fa4ab0d8b0d01/R-CD-4/cael/20260709T030551Z-r-cd-4/run-result.json` |
| ronan | `PASS-candidate` | `true` | `PROOFS/46872994e4cae80830c381cb49456e8c77583d7e/artifacts/ronan/p81-ronan-live-e08f696-20260709T032347Z/artifacts/e08f696618da57e7267a2148578fa4ab0d8b0d01/R-CD-4/ronan/20260709T032444Z-r-cd-4/run-result.json` |

## Notes

- Raw/redacted k6 output, row logs, report receipts, and generated `run-result.json` files are preserved under `artifacts/`.
- These are live-candidate artifacts: candidate states still require human fold review before becoming canonical PASS rows.
