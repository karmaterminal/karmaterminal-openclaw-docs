# R-CW-TOKEN — evidence at `b27a262`

- **verdict:** `PASS-candidate`
- **scenario:** `r-cw-token-bracket`
- **classification:** `k6-runnable`
- **candidate SHA:** `b27a2624ed333b0f3a613893968d2e555d90fce1`
- **seat:** cael (self-hosted)
- **run:** project81-k6-proof `31329925997`, `dry_run=false`

## Artifacts

`cael/20260809T191131Z-r-cw-token-7f675e5a/`
- `candidate-run-result-validation.json`
- `candidate-run-result.json`
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
- `r-cw-token-bracket-summary.json`
- `row-manifest.json`
- `row-scenario.js`
- `run-result.json`
- `runner-metadata.json`
- `seat-readiness.json`

```json
{
 "row": "R-CW-TOKEN",
 "candidateSha": "b27a2624ed333b0f3a613893968d2e555d90fce1",
 "manifest_loaded": true
}
```

## What this does not prove

- Not controlled against an upstream-naive runtime; a failure here is not yet attributed.
- Partial verdicts mean evidence capture was incomplete (`rawPersisted: false`), not that an assertion failed.
- Static-corpus rows validate the published packet, so they reflect corpus state, not runtime behaviour.
