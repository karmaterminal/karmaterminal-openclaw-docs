# Execution status

`REVIEW_CANDIDATE`

An exact-product canary attempted three MISSING rows. Independent review found
two evidence packets sufficient for PASS and one sufficient for PARTIAL.

Exactly these rows moved MISSING to PASS:

- `R-CW-DELEGATE-TOKEN`
- `R-CW-MULTI`

`R-CD-COLLECTION-ON-COLLAPSE` moved MISSING to PARTIAL. `R-CD-TOKEN` and
`R-RC-2` remain PARTIAL. The remaining MISSING rows are exactly
`R-CD-RETURN-COVENANT-AUTHORITY`, `R-CD-RETURN-OVERLAP`, and `R-OBS-2`;
`R-CD-2` remains FAIL. Final rollup: 31 PASS / 3 PARTIAL / 1 FAIL / 3 MISSING.
