# R-CW-3 evidence

- **Canonical state:** `pass`
- **Corpus identity:** `c3a0e5a314ecbf572911d4b2e84595bd06f64d69`
- **Runtime executed:** `46f4d2115700d574501bb3c4763abf6b2ba977fe` (continuation plus separately disclosed PR #121204 runtime fixes)
- **Harness:** `51a6f65b625d3dbe347f44df19c914acdd2bc488`
- **Primary run:** [32231533500](https://github.com/karmaterminal/karmaterminal-openclaw-docs/actions/runs/32231533500) on Ronan
- **Candidate verdict:** `PARTIAL-candidate`
- **Review status:** `review-pending`

## Review

The full-suite candidate was partial because its shared trace contained three continue_work tool spans. Folded pass from focused run 32230009131 on the same runtime, which produced one reason-bound tool/work/fire topology and public Tempo JSON.

## Evidence

- [`PROOFS/c3a0e5a314ecbf572911d4b2e84595bd06f64d69/artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CW-3/ronan/20260819T082122Z-r-cw-3-dfc27553/run-result.json`](../artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CW-3/ronan/20260819T082122Z-r-cw-3-dfc27553/run-result.json)
- [`PROOFS/c3a0e5a314ecbf572911d4b2e84595bd06f64d69/artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CW-3/ronan/20260819T082122Z-r-cw-3-dfc27553/runner-metadata.json`](../artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CW-3/ronan/20260819T082122Z-r-cw-3-dfc27553/runner-metadata.json)
- [`PROOFS/c3a0e5a314ecbf572911d4b2e84595bd06f64d69/artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CW-3/ronan/20260819T082122Z-r-cw-3-dfc27553/row-manifest.json`](../artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CW-3/ronan/20260819T082122Z-r-cw-3-dfc27553/row-manifest.json)
- [`PROOFS/c3a0e5a314ecbf572911d4b2e84595bd06f64d69/artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CW-3/ronan/20260819T082122Z-r-cw-3-dfc27553/seat-readiness.json`](../artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CW-3/ronan/20260819T082122Z-r-cw-3-dfc27553/seat-readiness.json)
- [`PROOFS/c3a0e5a314ecbf572911d4b2e84595bd06f64d69/artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CW-3/ronan/20260819T082122Z-r-cw-3-dfc27553/gateway-journal.log`](../artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CW-3/ronan/20260819T082122Z-r-cw-3-dfc27553/gateway-journal.log)
- [`PROOFS/c3a0e5a314ecbf572911d4b2e84595bd06f64d69/artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CW-3/ronan/20260819T082122Z-r-cw-3-dfc27553/gateway-journal-capture.json`](../artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CW-3/ronan/20260819T082122Z-r-cw-3-dfc27553/gateway-journal-capture.json)
- [`PROOFS/c3a0e5a314ecbf572911d4b2e84595bd06f64d69/artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CW-3/ronan/20260819T082122Z-r-cw-3-dfc27553/gateway-journal-redaction.json`](../artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CW-3/ronan/20260819T082122Z-r-cw-3-dfc27553/gateway-journal-redaction.json)
- [`PROOFS/c3a0e5a314ecbf572911d4b2e84595bd06f64d69/artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CW-3/ronan/20260819T082122Z-r-cw-3-dfc27553/evidence.jsonl`](../artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CW-3/ronan/20260819T082122Z-r-cw-3-dfc27553/evidence.jsonl)
- [`PROOFS/c3a0e5a314ecbf572911d4b2e84595bd06f64d69/artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CW-3/ronan/20260819T082122Z-r-cw-3-dfc27553/evidence-redaction.json`](../artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CW-3/ronan/20260819T082122Z-r-cw-3-dfc27553/evidence-redaction.json)
- Tempo trace: [`PROOFS/c3a0e5a314ecbf572911d4b2e84595bd06f64d69/artifacts/supplemental-run-32230009131/R-CW-3/ronan/20260819T080116Z-r-cw-3-291e594f/tempo-trace-60f95d264a74.json`](../artifacts/supplemental-run-32230009131/R-CW-3/ronan/20260819T080116Z-r-cw-3-291e594f/tempo-trace-60f95d264a74.json)
- Correlation receipt: [`PROOFS/c3a0e5a314ecbf572911d4b2e84595bd06f64d69/artifacts/supplemental-run-32230009131/R-CW-3/ronan/20260819T080116Z-r-cw-3-291e594f/continuation-trace-correlation.json`](../artifacts/supplemental-run-32230009131/R-CW-3/ronan/20260819T080116Z-r-cw-3-291e594f/continuation-trace-correlation.json)
- Harness authority follow-up: [karmaterminal-openclaw-docs#514](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/514)
