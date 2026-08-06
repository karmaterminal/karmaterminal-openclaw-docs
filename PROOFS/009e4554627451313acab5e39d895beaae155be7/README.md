# Cael exact-SHA certification rerun

This corpus records the Cael-only certification of OpenClaw product
`009e4554627451313acab5e39d895beaae155be7`. The original 36 selected rows use harness
`9fcf215674720803840d15efa93bd925180135b9`; corrected `R-CW-5` and `R-CW-6` selections use the
scribe-approved recertification harness
`627ee3396b658b38a131bb573a89e126faa9cf3c`.

## Terminal result

| Classification | Rows |
|---|---:|
| PASS-candidate | 29 |
| FAIL-candidate | 0 |
| HONEST-LIMIT-candidate | 0 |
| NO-VERDICT | 9 |
| **Total** | **38** |

`R-CW-5` and `R-CW-6` now pass corrected database-first fixtures. Their
prior attempts remain preserved as harness-invalid provenance. OpenClaw
#1204 and #1203 remain provisional issue provenance, not proven product
regressions.

`PREFLIGHT` remains `PASS-candidate` only as a disclosed human fold from
the exact k6 log (3/3 checks and both thresholds passed) and
`seat-readiness.json` (`outcome: PASS-candidate`). Its `run-result.json`
has `verdict: null`, no `candidate-run-result.json` exists, and routing
envelope validation was withheld by the `PREFLIGHT`/`preflight` row-ID
mismatch.

## Authority

- `terminal-matrix.tsv` and `terminal-matrix.json` are the 38-row denominator.
- `proofs-manifest.json` declares canonical rows and per-row execution harnesses.
- Every row root contains `EVIDENCE.md`.
- `cael-recertification-preflight.json` records the fail-closed product,
  build, harness, health, and config identity checks.
- `harness-suite-410.log` preserves the original harness validation:
  `379/379 + 31/31 = 410/410`.
- `SHA256SUMS` covers every corpus file except itself.

All retries remain provenance; only terminal-matrix selections are folded.
The recertification ran only on Cael without deploy, Doctor, config mutation,
gateway restart, assembly, presentation movement, or root-index promotion.
