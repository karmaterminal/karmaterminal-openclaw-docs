# R-CD-MODEL-TOOL evidence — 46872994 safe assembly corpus

- **Aggregate state:** `pass`
- **Push / corpus SHA:** `5292af40d0ad5303b85a678f6e629503a8725848`
- **Proof-source SHA:** `e08f696618da57e7267a2148578fa4ab0d8b0d01`
- **Issue links:** karmaterminal/karmaterminal-openclaw-docs#367
- **Review note:** First Cael/Ronan k6 rows were partial because the child/model byte was not observed; Cael's gemini rerun now supplies the child runtime model byte and return payload. #367 remains preserved as method friction.

## Seat artifacts

| Seat | Run-result verdict | Evidence object | Run-result path |
|---|---:|---:|---|
| cael | `PARTIAL-candidate` | `false` | `PROOFS/5292af40d0ad5303b85a678f6e629503a8725848/artifacts/cael/p81-cael-live-resume-20260709T030548Z/out/e08f696618da57e7267a2148578fa4ab0d8b0d01/R-CD-MODEL-TOOL/cael/20260709T030724Z-r-cd-model-tool/run-result.json` |
| ronan | `PARTIAL-candidate` | `false` | `PROOFS/5292af40d0ad5303b85a678f6e629503a8725848/artifacts/ronan/p81-ronan-live-e08f696-20260709T032347Z/artifacts/e08f696618da57e7267a2148578fa4ab0d8b0d01/R-CD-MODEL-TOOL/ronan/20260709T032615Z-r-cd-model-tool/run-result.json` |

## Notes

- Raw/redacted k6 output, row logs, report receipts, and generated `run-result.json` files are preserved under `artifacts/`.
- These are live-candidate artifacts: candidate states still require human fold review before becoming canonical PASS rows.

## Manual closeout review (post-merge)

This row remains `partial`. The preserved Cael and Ronan k6 artifacts show the parent turn scheduled the model-override delegate, but neither seat captured the required child model byte/return payload. Because the row explicitly guards against echo-based false PASS, it should not be manually upgraded without a fresh child runtime model receipt proving the requested delegate model was actually observed. This is related to the model override issue family tracked from `R-CD-MODEL-*` / karmaterminal/openclaw#1103 and docs issue #367.

## Gemini rerun closeout receipt (post-merge)

A fresh Cael live rerun used known-good alternate model `github-copilot/gemini-3.1-pro-preview` and produced the missing child model byte/return payload.

Artifact root copied into corpus:

- `artifacts/cael/p81-cael-model-tool-gemini-20260709T042513Z/`

Manual receipts:

- `manual-receipts/cael-gemini-model-tool-evidence.json`
- `manual-receipts/cael-gemini-model-tool-review.json`
- `manual-receipts/MANUAL-REVIEW.md`

The k6 console evidence object records `requested_model_byte="github-copilot/gemini-3.1-pro-preview"`, `child_model_byte="github-copilot/gemini-3.1-pro-preview"`, `model_matches=true`, `return_payload=true`, `parent_scheduled_sentinel=true`, and `child_session_observed=true`. The generated summary/run-result still say `PARTIAL-candidate` because the postprocessor missed this evidence JSON line; the preserved console verdict and manual review supply the row receipt. The aggregate row state is upgraded to `pass`.
