# R-CD-TOKEN — candidate fire evidence

- presented product SHA: `3821eaef72677c78f450ae9956cb582a22ba4cba`
- executed runtime SHA: `1baff536afa549fea75660403c453bbd265352c0` (composite carrier; `exact_product_runtime = false`)
- docs/harness SHA: `45d301cb87c2e57634daf2fb78c7613d6afbc018`
- seat: `ronan`
- run id: `20260920T143418Z-r-cd-token-743bccb7`
- candidate verdict: `PARTIAL-candidate`
- canonical state: `partial`
- authority: automated candidate fire — **not** independently reviewed, **not** foldable
- trace status: `not-applicable`
- public receipt: [`PUBLIC-REVIEW.json`](PUBLIC-REVIEW.json)
- private row artifacts sha256: `6a4b94680c167b5a3c115453609e4bc6d237b574dd69bda8112de05a9f7ea83a` (6 files, retained on the seat, not published)

- pending receipts: raw-final-text-origin, parser-detected, queue-identity, child-spawned, child-completed, parent-return-event, tempo-trace-json, continuation-trace-correlation

This row was fired once by `tools/k6-proofs/scripts/run-proofs.sh --live` against the deployed
composite runtime. The verdict is a candidate outcome; per the canonical method a candidate verdict
is never a folded verdict and requires independent review before promotion.
