# R-CD-2 evidence

- **Canonical state:** `partial`
- **Corpus identity:** `c3a0e5a314ecbf572911d4b2e84595bd06f64d69`
- **Runtime executed:** `46f4d2115700d574501bb3c4763abf6b2ba977fe` (continuation plus separately disclosed PR #121204 runtime fixes)
- **Harness:** `51a6f65b625d3dbe347f44df19c914acdd2bc488`
- **Primary run:** [32231533500](https://github.com/karmaterminal/karmaterminal-openclaw-docs/actions/runs/32231533500) on Ronan
- **Candidate verdict:** `FAIL-candidate`
- **Review status:** `ready-for-human-review`

## Review

The candidate envelope says FAIL-candidate, but human review found that the harness treated successful phase=end replayInvalid safety metadata as execution failure. Folded partial; tracked by docs issue #514.

## Evidence

- [`PROOFS/c3a0e5a314ecbf572911d4b2e84595bd06f64d69/artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CD-2/ronan/20260819T081419Z-r-cd-2-dfc27553/run-result.json`](../artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CD-2/ronan/20260819T081419Z-r-cd-2-dfc27553/run-result.json)
- [`PROOFS/c3a0e5a314ecbf572911d4b2e84595bd06f64d69/artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CD-2/ronan/20260819T081419Z-r-cd-2-dfc27553/candidate-run-result.json`](../artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CD-2/ronan/20260819T081419Z-r-cd-2-dfc27553/candidate-run-result.json)
- [`PROOFS/c3a0e5a314ecbf572911d4b2e84595bd06f64d69/artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CD-2/ronan/20260819T081419Z-r-cd-2-dfc27553/r-cd-2-authoritative-receipt.json`](../artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CD-2/ronan/20260819T081419Z-r-cd-2-dfc27553/r-cd-2-authoritative-receipt.json)
- [`PROOFS/c3a0e5a314ecbf572911d4b2e84595bd06f64d69/artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CD-2/ronan/20260819T081419Z-r-cd-2-dfc27553/runner-metadata.json`](../artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CD-2/ronan/20260819T081419Z-r-cd-2-dfc27553/runner-metadata.json)
- [`PROOFS/c3a0e5a314ecbf572911d4b2e84595bd06f64d69/artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CD-2/ronan/20260819T081419Z-r-cd-2-dfc27553/row-manifest.json`](../artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CD-2/ronan/20260819T081419Z-r-cd-2-dfc27553/row-manifest.json)
- [`PROOFS/c3a0e5a314ecbf572911d4b2e84595bd06f64d69/artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CD-2/ronan/20260819T081419Z-r-cd-2-dfc27553/seat-readiness.json`](../artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CD-2/ronan/20260819T081419Z-r-cd-2-dfc27553/seat-readiness.json)
- [`PROOFS/c3a0e5a314ecbf572911d4b2e84595bd06f64d69/artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CD-2/ronan/20260819T081419Z-r-cd-2-dfc27553/gateway-journal.log`](../artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CD-2/ronan/20260819T081419Z-r-cd-2-dfc27553/gateway-journal.log)
- [`PROOFS/c3a0e5a314ecbf572911d4b2e84595bd06f64d69/artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CD-2/ronan/20260819T081419Z-r-cd-2-dfc27553/gateway-journal-capture.json`](../artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CD-2/ronan/20260819T081419Z-r-cd-2-dfc27553/gateway-journal-capture.json)
- [`PROOFS/c3a0e5a314ecbf572911d4b2e84595bd06f64d69/artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CD-2/ronan/20260819T081419Z-r-cd-2-dfc27553/gateway-journal-redaction.json`](../artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CD-2/ronan/20260819T081419Z-r-cd-2-dfc27553/gateway-journal-redaction.json)
- [`PROOFS/c3a0e5a314ecbf572911d4b2e84595bd06f64d69/artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CD-2/ronan/20260819T081419Z-r-cd-2-dfc27553/evidence.jsonl`](../artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CD-2/ronan/20260819T081419Z-r-cd-2-dfc27553/evidence.jsonl)
- [`PROOFS/c3a0e5a314ecbf572911d4b2e84595bd06f64d69/artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CD-2/ronan/20260819T081419Z-r-cd-2-dfc27553/evidence-redaction.json`](../artifacts/run-32231533500/46f4d2115700d574501bb3c4763abf6b2ba977fe/R-CD-2/ronan/20260819T081419Z-r-cd-2-dfc27553/evidence-redaction.json)
- Harness authority follow-up: [karmaterminal-openclaw-docs#514](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/514)
