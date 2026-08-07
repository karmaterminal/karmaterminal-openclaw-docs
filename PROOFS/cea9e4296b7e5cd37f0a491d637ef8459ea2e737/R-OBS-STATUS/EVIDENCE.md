# R-OBS-STATUS — reviewed exact-cea9e42 source-contract carry

- **Owner / reviewer:** 🌻 Elliott / 🌿 frond-scribe (independent byte review)
- **State:** `pass` — immutable source-contract / unchanged-surface carry
- **Candidate SHA:** `cea9e4296b7e5cd37f0a491d637ef8459ea2e737` (`cea9e42`)
- **Workflow:** [`29220056391`](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/29220056391)
- **Artifact:** [`8267864274`](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/29220056391/artifacts/8267864274)
- **Review disposition:** fold-ready; no Tempo trace is required for this source-contract row.

## Reviewed receipt

The retained raw receipt lives at
`elliott/20260713T024226Z-r-obs-status/` and records:

- `k6ExitCode=0`, `postprocessExitCode=0`, and `effectiveExitCode=0`;
- immutable source fetch from `karmaterminal/openclaw:src/status/status-text.ts`;
- `source_fetch_ok=true` with SHA-256
  `6704a2cce3d1c9f620f7c7cbe09f626d45c4232199a809575bf505d958860dcd`;
- the continuation line is present for an active continuation;
- the line is absent for a clean session.

This is intentionally classified as a formatter/source contract, not a
continuation-runtime trace claim. `trace_id:null` is therefore not a missing
receipt for this row.

## Raw receipt inventory

- `run-result.json` — verdict and review metadata
- `evidence.jsonl` and `r-obs-status-summary.json` — public-safe source receipt
- `row-manifest.json` — dispatched row contract
- `seat-readiness.json` — deployed candidate identity

> **Proof-bar correction (figs, 2026-07-13):** Historical `1cc8f4…` static receipts are retained as provenance/harness evidence only. They do **not** establish exact-`cea9e42` current behavior coverage after intervening work; this row is therefore uncovered. No refire is authorized by this classification.
