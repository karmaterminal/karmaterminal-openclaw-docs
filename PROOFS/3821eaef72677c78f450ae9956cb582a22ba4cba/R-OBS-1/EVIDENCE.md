# R-OBS-1 — candidate fire evidence

- presented product SHA: `3821eaef72677c78f450ae9956cb582a22ba4cba`
- executed runtime SHA: `1baff536afa549fea75660403c453bbd265352c0` (composite carrier; `exact_product_runtime = false`)
- docs/harness SHA: `45d301cb87c2e57634daf2fb78c7613d6afbc018`
- seat: `ronan`
- run id: `20260920T144241Z-r-obs-1-743bccb7`
- candidate verdict: `FAIL-candidate`
- canonical state: `fail`
- authority: automated candidate fire — **not** independently reviewed, **not** foldable
- trace status: `unknown`
- public receipt: [`PUBLIC-REVIEW.json`](PUBLIC-REVIEW.json)
- private row artifacts sha256: `27c33e8d00a110262908e757e593140a29fbbf1225e679671cf97ebd3ae772aa` (20 files, retained on the seat, not published)

- pending receipts: none recorded

This row was fired once by `tools/k6-proofs/scripts/run-proofs.sh --live` against the deployed
composite runtime. The verdict is a candidate outcome; per the canonical method a candidate verdict
is never a folded verdict and requires independent review before promotion.
