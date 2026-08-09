# R-CW-DELEGATE-CHILD-LIVE — evidence at `b27a262`

- **verdict:** `FAIL-candidate`
- **scenario:** `static-corpus-row-validator`
- **classification:** `k6-runnable`
- **candidate SHA:** `b27a2624ed333b0f3a613893968d2e555d90fce1`
- **seat:** cael (self-hosted)
- **run:** project81-k6-proof `31329925997`, `dry_run=false`

> Static corpus validator: compares the COMMITTED packet, which still carried the stale 0921776 corpus at capture time. Not a runtime defect.

## Artifacts

`cael/20260809T191045Z-r-cw-delegate-child-live-7f675e5a/`
- `candidate-run-result-validation.error.log`
- `candidate-run-result-validation.json`
- `evidence-extraction.json`
- `evidence-lines.log`
- `evidence-redaction.json`
- `evidence-redaction.stdout.json`
- `evidence.jsonl`
- `gateway-journal-capture.json`
- `gateway-journal-redaction.json`
- `gateway-journal.log`
- `k6.log`
- `metrics-export.json`
- `openclaw-proofs-k6.otlp.json`
- `openclaw-proofs-k6.prom`
- `row-manifest.json`
- `row-scenario.js`
- `run-result.json`
- `runner-metadata.json`
- `seat-readiness.json`
- `static-corpus-row-summary.json`

```json
{
 "row": "R-CW-DELEGATE-CHILD-LIVE",
 "candidateSha": "b27a2624ed333b0f3a613893968d2e555d90fce1",
 "currentProofSha": "0921776150142c3fd8d517de5c73e1c94732f004",
 "carriedFrom": "0921776150142c3fd8d517de5c73e1c94732f004",
 "manifest_loaded": true
}
```

## What this does not prove

- Not controlled against an upstream-naive runtime; a failure here is not yet attributed.
- Partial verdicts mean evidence capture was incomplete (`rawPersisted: false`), not that an assertion failed.
- Static-corpus rows validate the published packet, so they reflect corpus state, not runtime behaviour.
