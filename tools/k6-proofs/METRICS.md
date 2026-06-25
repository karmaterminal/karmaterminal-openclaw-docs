# k6 PROOFS metrics contract

This document defines the **public-safe** metric/data contract for Project 81 k6 PROOFS visualization work.

It is intentionally narrow: dashboards should summarize proof-run health for row / seat / SHA review without exposing gateway credentials, prompts, raw responses, unredacted events, private paths, session keys, or nonce-bearing payload bodies.

## Scope

This contract covers the k6 harness under `tools/k6-proofs/` and the candidate artifacts it writes under:

```text
PROOFS/<candidate-sha>/<row-id>/<seat>/k6-run-<timestamp>/
```

The first Grafana dashboard should answer:

- Which rows / seats / SHAs have candidate runs?
- Which runs are `PASS-candidate`, `HONEST-LIMIT-candidate`, or `FAIL-candidate`?
- Where did `proof_failures` occur?
- Which runs timed out or took unusually long?
- Which required receipts are present / missing?
- Which runs are still candidate-only and need human review before corpus fold?

## Public-safety boundary

Allowed metric labels are low-cardinality and non-secret:

- `row_id` — proof row, for example `R-CD-1`
- `seat` — coarse seat id, for example `ronan-dgx` or `silas`
- `candidate_sha` — 40-char source SHA under test
- `scenario` — k6 scenario name, for example `r-cd-1-typed-delegate`
- `tool_surface` — `typed-tool`, `bracket-token`, etc.
- `transport` — `websocket`, etc.
- `outcome` — `PASS-candidate`, `HONEST-LIMIT-candidate`, `FAIL-candidate`
- `candidate_only` — `true` / `false`
- `fold_requires_review` — `true` / `false`
- `receipt_name` — manifest receipt id, for example `tool-invoke-accepted`
- `receipt_required` — `true` / `false`
- `receipt_status` — `present`, `missing`, or `unknown`
- `failure_class` — coarse class such as `none`, `threshold`, `missing-receipt`, `timeout`, `auth`, `transport`, `redaction-gate`, `postprocess`

Do **not** put these values in metric labels, logs intended for public artifacts, or dashboard annotations:

- gateway tokens / Authorization headers
- raw env dumps
- session keys or internal session ids
- prompt bodies, delegate task bodies, nonces, or nonce-bearing child replies
- raw request / response bodies
- raw WebSocket events
- unredacted error payloads
- local absolute paths outside the committed artifact path
- hostnames or IPs that are not already public-safe in the artifact corpus

If a field is useful for debugging but not public-safe, store it only in private scratch, not in committed `PROOFS/` artifacts or exported metrics.

## Artifact JSON fields

`tools/k6-proofs/scripts/postprocess-k6-summary.mjs` writes `row-result.json`. Dashboard ingestion should treat this as the stable summary source for v1.

Minimum v1 shape:

```json
{
  "schema": "openclaw.k6.proof-row-result.v1",
  "runId": "k6-run-20260623T225500Z",
  "generatedAt": "2026-06-23T22:55:00.000Z",
  "rowId": "R-CD-1",
  "candidateSha": "793621a...",
  "seat": "ronan-dgx",
  "outcome": "PASS-candidate",
  "reason": "k6 checks passed and proof_failures is zero; receipts still need human review",
  "candidateOnly": true,
  "foldRequiresReview": true,
  "metrics": {
    "proofFailures": 0,
    "checksRate": 1,
    "durationMs": 43127
  },
  "receipts": [
    { "name": "tool-invoke-accepted", "required": true, "status": "present" },
    { "name": "task-ledger-entry", "required": true, "status": "present" },
    { "name": "parent-return-event", "required": false, "status": "present" }
  ],
  "failureClass": "none"
}
```

Current post-processor output is smaller than this ideal v1 shape. The next harness patch should add `metrics`, `receipts`, and `failureClass` to `row-result.json` by deriving them from the manifest and k6 summary / evidence summary. Until then, dashboards can still ingest `outcome`, `rowId`, `candidateSha`, `seat`, `runId`, `candidateOnly`, and `foldRequiresReview`.

## Prometheus metric names

If ingestion uses Prometheus remote-write, OTLP-to-Prometheus, or a postprocess push step, use these metric names.

### `openclaw_proofs_k6_run_total`

Counter. One sample per run.

Labels:

- `row_id`
- `seat`
- `candidate_sha`
- `scenario`
- `tool_surface`
- `transport`
- `outcome`
- `candidate_only`
- `fold_requires_review`
- `failure_class`

Value: `1`.

### `openclaw_proofs_k6_proof_failures_total`

Counter or gauge emitted once per run from the k6 `proof_failures` count.

Labels:

- `row_id`
- `seat`
- `candidate_sha`
- `scenario`
- `failure_class`

Value: number of proof failures in the run.

### `openclaw_proofs_k6_duration_ms`

Gauge or histogram. Duration of the proof scenario / normalized run.

Labels:

- `row_id`
- `seat`
- `candidate_sha`
- `scenario`
- `outcome`

Value: duration in milliseconds.

### `openclaw_proofs_k6_checks_rate`

Gauge. k6 `checks.rate` for the run.

Labels:

- `row_id`
- `seat`
- `candidate_sha`
- `scenario`

Value: 0..1.

### `openclaw_proofs_k6_receipt_status`

Gauge. One sample per expected receipt.

Labels:

- `row_id`
- `seat`
- `candidate_sha`
- `run_id`
- `receipt_name`
- `receipt_required`
- `receipt_status`

Value:

- `1` when `receipt_status="present"`
- `0` when `receipt_status="missing"` or `"unknown"`

Keep `run_id` only on receipt metrics where per-run drilling is useful; avoid adding it to high-volume counters.

### `openclaw_proofs_k6_candidate_pending_review`

Gauge. Human review queue signal.

Labels:

- `row_id`
- `seat`
- `candidate_sha`
- `outcome`

Value:

- `1` when `candidateOnly=true` and `foldRequiresReview=true`
- `0` otherwise

## Dashboard v1 panels

The first Grafana dashboard should use built-in panel types only; no plugin is required for v1.

Recommended variables:

- `candidate_sha`
- `row_id`
- `seat`
- `outcome`

Recommended panels:

1. **Candidate outcomes** — count by outcome for selected SHA / row / seat.
2. **Row × seat matrix** — latest outcome per row and seat.
3. **Proof failures** — `proof_failures` by row / seat.
4. **Duration / timeout watch** — p95 or latest `duration_ms` by row / seat.
5. **Receipt completeness** — required receipt present/missing matrix.
6. **Pending human review** — count of candidate-only runs not yet folded.
7. **Recent runs table** — run id, generated time, SHA, row, seat, outcome, failure class.

## Deployment surface

The dashboard PR belongs in `karmaterminal/openclaw-bootstrap`, not this docs repo.

Current deploy surface found by inspection:

- dashboards: `deploy/observability/dashboards/*.json`
- Ansible task: `ansible/roles/openclaw-observability/tasks/dashboards.yml`
- Grafana/Prometheus/OTel values: `deploy/observability/{grafana,prometheus,otel-collector}/values.yaml`

The dashboard should be added as something like:

```text
deploy/observability/dashboards/proofs-k6.json
```

and loaded through the existing dashboard ConfigMap / Grafana sidecar path.

## Open decision: emission path

Pick one before the dashboard PR:

1. **k6 Prometheus remote-write** — direct from k6 run. Good for live run metrics; needs runner config and retention policy.
2. **OTLP collector** — if k6 output can be routed through the existing OTel collector cleanly.
3. **Postprocess push** — derive public-safe metrics from `row-result.json` / `k6-summary.json` after artifact generation and push to a metrics endpoint.
4. **Static artifact ingestion** — dashboard reads generated JSON through a sidecar or exporter. Lowest runtime risk, but more plumbing.

Recommendation for v1: postprocess push or static artifact exporter. It keeps the redaction boundary after `evidence-writer` / postprocess instead of trusting raw k6 runtime streams.

## Review gates before dashboard fold

Before opening the dashboard PR:

- [ ] `row-result.json` includes the stable v1 fields needed above, or the dashboard explicitly documents which fields are not available yet.
- [ ] A sample run can produce public-safe metrics without tokens, session keys, prompts, nonces, raw events, or raw responses.
- [ ] Dashboard labels are bounded and low-cardinality.
- [ ] The dashboard is useful with candidate-only data and does not imply PASS/folded status.
- [ ] The dashboard PR references docs issue #109 and the Project 81 k6 PROOFS lane.
