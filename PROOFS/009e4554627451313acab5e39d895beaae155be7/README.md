# Cael exact-SHA certification rerun

This corpus records the Cael-only certification rerun of OpenClaw product
`009e4554627451313acab5e39d895beaae155be7` with accepted proof harness
`9fcf215674720803840d15efa93bd925180135b9`.

## Terminal result

| Classification | Rows |
|---|---:|
| PASS-candidate | 27 |
| FAIL-candidate | 2 |
| HONEST-LIMIT-candidate | 0 |
| NO-VERDICT | 9 |
| **Total** | **38** |

The two product failures are `R-CW-5` and `R-CW-6`. `R-CW-5` rejected the
over-budget hop but left durable work behind. `R-CW-6` failed closed across
runtime, durable recovery, and typed-tool maximum-chain surfaces.

No `PARTIAL` result is promoted to a terminal classification. The nine
`NO-VERDICT` rows retain their row-specific missing-authority reasons in
`terminal-matrix.tsv`.

## Authority

- `terminal-matrix.tsv` and `terminal-matrix.json` are the human- and
  machine-readable 38-row denominator.
- `proofs-manifest.json` records exact identities, aggregate counts, and the
  matrix checksum.
- `INDEX.json` is the corpus-local discovery index.
- `runtime-restoration-receipt.json` records the final healthy gateway,
  zero-restart, and byte-restored configuration state.
- `harness-suite-410.log` records the exact harness preflight result:
  `379/379 + 31/31 = 410/410`.
- Row directories contain sanitized runner artifacts. Repeated row
  directories are preserved as retry provenance; the matrix selects the
  terminal attempt.
- `SHA256SUMS` covers all published files except itself.

The run used only Cael. It did not redeploy OpenClaw, rerun Doctor, move a
protected ref, or use another prince.
