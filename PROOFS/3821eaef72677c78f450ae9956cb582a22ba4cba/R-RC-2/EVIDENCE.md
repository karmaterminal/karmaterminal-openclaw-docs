# R-RC-2 — candidate fire evidence

- presented product SHA: `3821eaef72677c78f450ae9956cb582a22ba4cba`
- executed runtime SHA: `1baff536afa549fea75660403c453bbd265352c0` (composite carrier; `exact_product_runtime = false`)
- docs/harness SHA: `45d301cb87c2e57634daf2fb78c7613d6afbc018`
- seat: `ronan`
- run id: `20260920T144422Z-r-rc-2-743bccb7`
- candidate verdict: `HONEST-LIMIT-candidate`
- canonical state: `honest_limit`
- authority: automated candidate fire — **not** independently reviewed, **not** foldable
- trace status: `missing`
- public receipt: [`PUBLIC-REVIEW.json`](PUBLIC-REVIEW.json)
- private row artifacts sha256: `893482d9307e808b1c3e4462ac23d1b4c5b6912baf2a31d1e21874939f99a62a` (23 files, retained on the seat, not published)

- pending receipts: continuation-trace-correlation, tempo-trace-json

This row was fired once by `tools/k6-proofs/scripts/run-proofs.sh --live` against the deployed
composite runtime. The verdict is a candidate outcome; per the canonical method a candidate verdict
is never a folded verdict and requires independent review before promotion.
