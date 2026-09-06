# Execution status

`REVIEW_CANDIDATE`

An exact-product canary attempted five PARTIAL rows. Independent review found
all five evidence packets sufficient for PASS.

Exactly these rows moved PARTIAL to PASS:

- `R-CD-1`
- `R-CD-4`
- `R-CD-CHAINED-DEPTH-2`
- `R-CD-MODEL-TOOL`
- `R-CD-SILENT`

`R-CD-TOKEN` and `R-RC-2` remain PARTIAL. The six MISSING rows and one FAIL
row are unchanged. Final rollup: 29 PASS / 2 PARTIAL / 1 FAIL / 6 MISSING.
