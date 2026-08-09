# R-CD-TOKEN — evidence at `b27a262`

- **verdict:** `NO-VERDICT`
- **scenario:** `r-cd-token-bracket-delegate`
- **classification:** `k6-runnable`
- **candidate SHA:** `b27a2624ed333b0f3a613893968d2e555d90fce1`
- **seat:** cael (self-hosted)
- **run:** project81-k6-proof `31329925997`, `dry_run=false`

## Artifacts

`cael/20260809T190508Z-r-cd-token-7f675e5a/`
- `build-identity-gate.json`
- `row-manifest.json`
- `row-scenario.js`
- `run-result.json`
- `runner-metadata.json`

## What this does not prove

- Not controlled against an upstream-naive runtime; a failure here is not yet attributed.
- Partial verdicts mean evidence capture was incomplete (`rawPersisted: false`), not that an assertion failed.
- Static-corpus rows validate the published packet, so they reflect corpus state, not runtime behaviour.
