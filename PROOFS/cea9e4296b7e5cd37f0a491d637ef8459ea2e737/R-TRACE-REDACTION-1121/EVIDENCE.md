<!-- exact-cea9e42-seed -->
> **Exact-cea9e42 state: pass carry.** This row is outside the Codex result-classification repair surface. Its exact-4afd receipt is retained as an explicit unchanged-surface carry pending final closeout.

# R-TRACE-REDACTION-1121 evidence — 5292af40 Project 81 corpus

- **Aggregate state:** `pass`
- **Push / corpus SHA:** `5292af40d0ad5303b85a678f6e629503a8725848`
- **Fresh 5292 proof-source SHA:** `5292af40d0ad5303b85a678f6e629503a8725848`
- **Seeded/carried corpus:** `46872994e4cae80830c381cb49456e8c77583d7e`
- **Issue links:** none

## Seat artifacts

| Seat | Run-result verdict | Evidence object | Run-result path |
|---|---:|---:|---|
| cael | `PASS-candidate` | `true` | `PROOFS/4afd560feb5102627a68a2f6a8bc545dabcfcfdc/artifacts/cael/p81-cael-live-resume7-20260709T033337Z/out/e08f696618da57e7267a2148578fa4ab0d8b0d01/R-TRACE-REDACTION-1121/cael/20260709T033602Z-r-trace-redaction-1121/run-result.json` |
| ronan | `PASS-candidate` | `true` | `PROOFS/4afd560feb5102627a68a2f6a8bc545dabcfcfdc/artifacts/ronan/p81-ronan-live-e08f696-20260709T032347Z/artifacts/e08f696618da57e7267a2148578fa4ab0d8b0d01/R-TRACE-REDACTION-1121/ronan/20260709T033705Z-r-trace-redaction-1121/run-result.json` |

## Notes

- Raw/redacted k6 output, row logs, report receipts, and generated `run-result.json` files are preserved under `artifacts/`.
- These are live-candidate artifacts: candidate states still require human fold review before becoming canonical PASS rows.

## Fresh 5292 closeout

No fresh Gateway rerun is used for this row. It is corpus-dependent/static and carried from the `46872994e4cae80830c381cb49456e8c77583d7e` seed under the 5292 full-copy tree.

## Exact-cea9e42 reviewed static-carry receipt (Elliott)

- **Workflow:** [`29220564218`](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/29220564218)
- **Artifact:** [`8268015808`](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/29220564218/artifacts/8268015808)
- **Candidate / current proof SHA:** `cea9e4296b7e5cd37f0a491d637ef8459ea2e737`
- **Immutable static evidence SHA:** `1cc8f4e3d617ef6f173283ef83d7b739a4995734`
- **Review disposition:** fold-ready unchanged-source carry; Tempo is not applicable to this static source/test contract.

The public-safe receipt in `elliott/20260713T025703Z-r-trace-redaction-1121/`
records successful k6/postprocess/effective exits and all six committed contract
predicates: pass heading, safe attributes, no-preview contract, raw-reason
guard, test pass, and source surface. It explicitly reports the historical
`sourceEvidenceSha`, so it does not misrepresent static evidence as a fresh
runtime/trace observation.
