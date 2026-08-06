# PREFLIGHT evidence

- **Product:** `009e4554627451313acab5e39d895beaae155be7`
- **Original harness:** `9fcf215674720803840d15efa93bd925180135b9`
- **Selected execution harness:** `9fcf215674720803840d15efa93bd925180135b9`
- **Configuration SHA-256:** `002e5564bdfe03972e9a4ba851043900a8df6d99d9447b3e979ba381bcc69d0e`
- **Selected attempt:** `PREFLIGHT/cael/20260802T011907Z-preflight-9d687f3c`
- **Terminal classification:** `PASS-candidate`
- **Harness verdict:** `null`
- **Canonical publication state:** `pass`
- **Source row issue:** `karmaterminal/karmaterminal-openclaw-docs#101`

## Fold decision

The selected k6 log reports 3/3 checks and both thresholds satisfied, and `seat-readiness.json` reports `PASS-candidate`. This is a disclosed human fold only: `run-result.json` has `verdict: null` and `verdictSource: none`; no `candidate-run-result.json` exists. Routing-envelope validation was withheld by the `PREFLIGHT`/`preflight` row-ID mismatch.

## Selected evidence

- `PREFLIGHT/cael/20260802T011907Z-preflight-9d687f3c/row-manifest.json`
- `PREFLIGHT/cael/20260802T011907Z-preflight-9d687f3c/run-result.json`
- `PREFLIGHT/cael/20260802T011907Z-preflight-9d687f3c/candidate-run-result-validation.error.log`
- `PREFLIGHT/cael/20260802T011907Z-preflight-9d687f3c/seat-readiness.json`
- `PREFLIGHT/cael/20260802T011907Z-preflight-9d687f3c/evidence.jsonl`
- `PREFLIGHT/cael/20260802T011907Z-preflight-9d687f3c/k6.log`

## Attempt provenance

- `PREFLIGHT/cael/20260802T003428Z-preflight-f06d71d8` (preserved retry/prior provenance)
- `PREFLIGHT/cael/20260802T003452Z-preflight-f8eb8e89` (preserved retry/prior provenance)
- `PREFLIGHT/cael/20260802T011837Z-preflight-2068be9d` (preserved retry/prior provenance)
- `PREFLIGHT/cael/20260802T011907Z-preflight-9d687f3c` (selected)

Only the terminal-matrix selection is folded. Every other attempt remains immutable provenance and is neither deleted nor overwritten.
