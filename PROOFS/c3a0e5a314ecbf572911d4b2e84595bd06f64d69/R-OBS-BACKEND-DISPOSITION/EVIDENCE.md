# R-OBS-BACKEND-DISPOSITION evidence

- **Canonical state:** `missing`
- **Corpus identity:** `c3a0e5a314ecbf572911d4b2e84595bd06f64d69`
- **Runtime executed:** `46f4d2115700d574501bb3c4763abf6b2ba977fe` (continuation plus separately disclosed PR #121204 runtime fixes)
- **Harness:** `51a6f65b625d3dbe347f44df19c914acdd2bc488`
- **Primary run:** [32231533500](https://github.com/karmaterminal/karmaterminal-openclaw-docs/actions/runs/32231533500) on Ronan
- **Candidate verdict:** `not-fired`
- **Review status:** `not-fired`

## Review

A degraded telemetry backend produces explicit unavailable/partial evidence plus the keys needed to rebind the same slice later, instead of a zero that reads as absence. Not executed in run 32231533500; retained as an explicit missing row for refinement.

## Evidence

- [`tools/k6-proofs/manifests/r-obs-backend-disposition.json`](../../../tools/k6-proofs/manifests/r-obs-backend-disposition.json)
