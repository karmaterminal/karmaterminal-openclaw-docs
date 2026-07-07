# Project 81 k6 broad live slice — 20260707T194227Z-cael-dgx-2026911

Candidate-run artifacts from GitHub Actions run [`28893688232`](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/28893688232).

This directory is a **candidate-run artifact bundle** under `RUNBOOKS/project-81/candidate-runs/`, not a canonical proof fold under `PROOFS/<sha>/`. The row manifests intentionally keep `foldRequiresReview=true`; reviewers must inspect row evidence before copying anything into canonical row `EVIDENCE.md` files or `proofs-manifest.json`.

## Run bytes

- bootstrap workflow head: `bab7e801bd2e7f5d42be02e1086d0041ff7cd533` (post `openclaw-bootstrap#1276`)
- docs catalog ref at run time: `main` (post `karmaterminal-openclaw-docs#306`)
- OpenClaw candidate/runtime: `1cc8f4e3d617ef6f173283ef83d7b739a4995734` / `OpenClaw 2026.6.11 (1cc8f4e)`
- target seat: `cael-dgx`
- `dry_run=false`
- disposable proof sessions enabled by workflow default
- metrics push enabled

## Outcome

- workflow conclusion: `success`
- live `k6-runnable` rows executed: 16
- PASS-candidate: 16
- FAIL-candidate: 0
- `preflight` row: skipped by live-run guard because its manifest is `static-preflight-only`; the runner still executed seat-readiness preflight and wrote `seat-readiness.json`.
- review-pending rows in generated report: 3 (`R-CD-2`, `R-CD-4`, `R-OBS-status`) due missing trace/receipt review markers, not k6 failures.

## Row verdict rollup

| Row | Verdict | Failures |
| --- | --- | ---: |
| R-CD-1 | PASS-candidate | 0 |
| R-CD-2 | PASS-candidate | 0 |
| R-CD-4 | PASS-candidate | 0 |
| R-CD-CHAINED-DEPTH-2 | PASS-candidate | 0 |
| R-CD-MODEL-CHAINED-ALT | PASS-candidate | 0 |
| R-CD-MODEL-DEFAULT | PASS-candidate | 0 |
| R-CD-MODEL-TOKEN | PASS-candidate | 0 |
| R-CD-MODEL-TOOL | PASS-candidate | 0 |
| R-CD-TOKEN | PASS-candidate | 0 |
| R-CONFIG-defaults | PASS-candidate | 0 |
| R-CW-1 | PASS-candidate | 0 |
| R-CW-4 | PASS-candidate | 0 |
| R-CW-DELEGATE-SELF-CONTINUATION | PASS-candidate | 0 |
| R-CW-TOKEN | PASS-candidate | 0 |
| R-OBS-status | PASS-candidate | 0 |
| R-RC-1 | PASS-candidate | 0 |

## Secret scan note

Before filing, the artifact bundle was scanned for high-risk secret patterns. Matches were limited to public metadata/key names such as `OPENCLAW_GATEWAY_TOKEN` and `"secret": true` presence markers in manifests/readiness receipts; no token value, PAT, authorization header, or private key material was found.
