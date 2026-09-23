# R-OBS-STATUS — candidate fire evidence

- presented product SHA: `3821eaef72677c78f450ae9956cb582a22ba4cba`
- executed runtime SHA: `1baff536afa549fea75660403c453bbd265352c0` (composite carrier; `exact_product_runtime = false`)
- docs/harness SHA: `45d301cb87c2e57634daf2fb78c7613d6afbc018`
- seat: `ronan`
- run id: `20260920T144356Z-r-obs-status-743bccb7`
- candidate verdict: `PASS-candidate`
- canonical state: `pass`
- authority: automated candidate fire — **not** independently reviewed, **not** foldable
- trace status: `unknown`
- public receipt: [`PUBLIC-REVIEW.json`](PUBLIC-REVIEW.json)
- private row artifacts sha256: `f248b81ce5922f52aaf75b2d000e0a1fd82bd8af383c59e64518d9684ac676c4` (20 files, retained on the seat, not published)

This row was fired once by `tools/k6-proofs/scripts/run-proofs.sh --live` against the deployed
composite runtime. The verdict is a candidate outcome; per the canonical method a candidate verdict
is never a folded verdict and requires independent review before promotion.
