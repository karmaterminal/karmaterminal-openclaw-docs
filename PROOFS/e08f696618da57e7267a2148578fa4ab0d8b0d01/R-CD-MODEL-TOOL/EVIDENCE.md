# R-CD-MODEL-TOOL evidence — e08f696 live P81 run

- **Aggregate state:** `partial`
- **Candidate SHA:** `e08f696618da57e7267a2148578fa4ab0d8b0d01`
- **Issue links:** karmaterminal/karmaterminal-openclaw-docs#367
- **Review note:** Partial on both Cael/Ronan: parent scheduled, child/model byte not fully observed in live row output. Tracked in #367.

## Seat artifacts

| Seat | Run-result verdict | Evidence object | Run-result path |
|---|---:|---:|---|
| cael | `PARTIAL-candidate` | `false` | `PROOFS/e08f696618da57e7267a2148578fa4ab0d8b0d01/artifacts/cael/p81-cael-live-resume-20260709T030548Z/out/e08f696618da57e7267a2148578fa4ab0d8b0d01/R-CD-MODEL-TOOL/cael/20260709T030724Z-r-cd-model-tool/run-result.json` |
| ronan | `PARTIAL-candidate` | `false` | `PROOFS/e08f696618da57e7267a2148578fa4ab0d8b0d01/artifacts/ronan/p81-ronan-live-e08f696-20260709T032347Z/artifacts/e08f696618da57e7267a2148578fa4ab0d8b0d01/R-CD-MODEL-TOOL/ronan/20260709T032615Z-r-cd-model-tool/run-result.json` |

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
