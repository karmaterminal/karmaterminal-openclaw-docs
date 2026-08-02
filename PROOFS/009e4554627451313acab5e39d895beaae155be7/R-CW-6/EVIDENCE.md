# R-CW-6 evidence

- **Product:** `009e4554627451313acab5e39d895beaae155be7`
- **Original harness:** `9fcf215674720803840d15efa93bd925180135b9`
- **Selected execution harness:** `627ee3396b658b38a131bb573a89e126faa9cf3c`
- **Configuration SHA-256:** `002e5564bdfe03972e9a4ba851043900a8df6d99d9447b3e979ba381bcc69d0e`
- **Selected attempt:** `R-CW-6/cael/fixture-20260802T035356Z-627ee339`
- **Terminal classification:** `PASS-candidate`
- **Harness verdict:** `PASS-candidate`
- **Canonical publication state:** `pass`
- **Provisional product issue:** `karmaterminal/openclaw#1203`

## Fold decision

corrected database-first fixture persisted chain state across SQLite close/reopen and rejected the first over-limit continuation without durable work. The prior selection was harness-invalid because harness `9fcf215674720803840d15efa93bd925180135b9` used retired whole-store JSON session semantics against the database-first product. The corrected selection uses approved harness `627ee3396b658b38a131bb573a89e126faa9cf3c`; karmaterminal/openclaw#1203 remains provisional issue provenance rather than a proven product regression.

## Selected evidence

- `R-CW-6/cael/fixture-20260802T035356Z-627ee339/row-manifest.json`
- `R-CW-6/cael/fixture-20260802T035356Z-627ee339/fixture-result.json`
- `R-CW-6/cael/fixture-20260802T035356Z-627ee339/runtime-boundary.json`
- `R-CW-6/cael/fixture-20260802T035356Z-627ee339/durable-state-recovery.json`
- `R-CW-6/cael/fixture-20260802T035356Z-627ee339/typed-tool-surface.json`
- `R-CW-6/cael/fixture-20260802T035356Z-627ee339/dispatch-boundary-suite.json`
- `R-CW-6/cael/fixture-20260802T035356Z-627ee339/public-artifact-safety.json`

## Attempt provenance

- `R-CW-6/cael/fixture-20260802T015035Z` (preserved retry/prior provenance)
- `R-CW-6/cael/fixture-20260802T035356Z-627ee339` (selected)

Only the terminal-matrix selection is folded. Every other attempt remains immutable provenance and is neither deleted nor overwritten.
