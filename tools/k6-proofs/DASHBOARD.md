# k6 PROOFS Metrics Dashboard Specification (v1)

This dashboard tracks the execution outcomes of Project 81 candidate runs, providing visibility into the public-safe k6 PROOFS metrics contract in `METRICS.md`. The committed dashboard JSON is the Prometheus/metric-contract view; static `row-result.json` artifacts remain the source format that post-processing and future exporters derive from.

## 1. Panel List

The dashboard consists of 10 panels designed to monitor run outcomes, performance durations, required artifacts (receipts), and human-review bottlenecks. 

### Panel 1: Global Outcome Summary
* **Title:** Overall Run Outcomes
* **Viz Type:** Stat (Multiple gauges/numbers)
* **Fields Read:** `outcome`
* **Group By:** `outcome`
* **Purpose:** High-level view of how many runs are `PASS-candidate`, `HONEST-LIMIT-candidate`, or `FAIL-candidate`.

### Panel 2: Outcome Distribution by Seat
* **Title:** Outcomes per Seat
* **Viz Type:** Bar Chart (Stacked)
* **Fields Read:** `outcome`
* **Group By:** `seat`, `outcome`
* **Purpose:** Identifies which active seats (e.g., silas, ronan-dgx, rune) are failing or passing candidate proofs.

### Panel 3: Candidate SHA Leaderboard
* **Title:** Pass Rate by Candidate SHA
* **Viz Type:** Table
* **Fields Read:** `outcome`, `runId` (count)
* **Group By:** `candidateSha`
* **Purpose:** Answers which candidate SHAs have run and what their success rate looks like.

### Panel 4: Human Review Queue (Candidate-Only Folds)
* **Title:** Pending Corpus Folds (Review Required)
* **Viz Type:** State Timeline (or filtered Table)
* **Fields Read:** `candidateOnly`, `foldRequiresReview`, `generatedAt`
* **Group By:** `rowId`, `candidateSha`
* **Purpose:** Highlights specific rows where `candidateOnly == true` and `foldRequiresReview == true` that require human sign-off before being folded into the corpus.

### Panel 5: Proof Failures by Tool Surface
* **Title:** Proof Failure Hotspots
* **Viz Type:** Bar Chart
* **Fields Read:** `metrics.proofFailures` (sum/avg)
* **Group By:** `toolSurface` or `scenario`
* **Purpose:** Pinpoints where `proof_failures` are occurring across different tool surfaces.

### Panel 6: Run Duration Trends
* **Title:** Duration over Time
* **Viz Type:** Timeseries
* **Fields Read:** `metrics.durationMs`, `generatedAt`
* **Group By:** `seat`, `candidateSha`
* **Purpose:** Tracks run latency (long runs) across different seats over time.

### Panel 7: Timeouts and Longest Runs
* **Title:** Timeout & Performance Outliers
* **Viz Type:** Table
* **Fields Read:** `metrics.durationMs`, `runId`
* **Group By:** `rowId`, `failureClass` (sort by `durationMs` desc)
* **Purpose:** Isolates runs that timed out or ran exceptionally long.

### Panel 8: Missing Required Receipts
* **Title:** Missing Required Receipts
* **Viz Type:** Table
* **Fields Read:** `receipts[].status`, `receipts[].required`, `receipts[].name`
* **Group By:** `rowId`, `receipts[].name`
* **Purpose:** Filters for `receipts[].required == true` and `receipts[].status == missing` to surface runs missing critical artifacts.

### Panel 9: Scenario Check Reliability
* **Title:** Average Checks Rate by Scenario
* **Viz Type:** Bar Chart (Horizontal)
* **Fields Read:** `metrics.checksRate`
* **Group By:** `scenario`
* **Purpose:** Shows how reliably scenarios are passing their internal assertions (checksRate 0..1).

### Panel 10: Failure Classifications
* **Title:** Failure Class Breakdown
* **Viz Type:** Pie Chart / Donut
* **Fields Read:** count of occurrences
* **Group By:** `failureClass`
* **Purpose:** Categorizes failures into buckets: `none`, `threshold`, `checks`, `missing-receipt`, `timeout`, `auth`, `transport`, `redaction-gate`, `postprocess`.

---

## Field vocabulary (v1 = JSON artifact, camelCase)

**Important:** #110 defines two distinct vocabularies, and v1 uses only the first:

- **`row-result.json` artifact fields = camelCase** (`rowId`, `candidateSha`, `candidateOnly`, `foldRequiresReview`, `metrics.proofFailures`, `metrics.durationMs`, `outcome`, `seat`, `runId`, `scenario`, `toolSurface`, `transport`, `failureClass`, `receipts[].name/required/status`). **v1 reads these** via the Infinity static-JSON source, so all panel Fields-Read / Group-By above use camelCase.
- **Prometheus label names = snake_case** (`row_id`, `candidate_sha`, `tool_surface`, `failure_class`, `receipt_name`, ...). These are the *public-safe label allowlist* for a future metrics-exporter path — **not present in the v1 JSON artifact.** Do not group v1 panels by these snake_case names; they would query non-existent keys and render empty.

The current post-processor writes `toolSurface`, `transport`, top-level `failureClass`, `metrics.*`, and `receipts[]` into `row-result.json`; v1 dashboards should read those camelCase artifact fields directly. The snake_case names remain reserved for a future Prometheus/exporter path.

---

## 2. Redaction Guarantees

This dashboard operates **strictly** within the public-safe bounds established by the v1 k6 PROOFS metrics contract. 

**Guarantee:** No forbidden fields are extracted, processed, or visualized in this dashboard. 
* **Used:** Only low-cardinality, public-safe artifact fields / future labels are permitted (`rowId`/`row_id`, `seat`, `candidateSha`/`candidate_sha`, `scenario`, `toolSurface`/`tool_surface`, `transport`, `outcome`, `candidateOnly`/`candidate_only`, `foldRequiresReview`/`fold_requires_review`, `receipts[].name`/`receipt_name`, `receipts[].required`/`receipt_required`, `receipts[].status`/`receipt_status`, `failureClass`/`failure_class`).
* **Forbidden (Excluded):** No tokens, auth headers, env dumps, session keys/ids, prompt bodies, delegate task bodies, nonces, raw request/response bodies, raw WS events, unredacted errors, private absolute paths, or non-public hostnames/IPs are present in the underlying `row-result.json` contract or queried by these panels.

---

## Automated versus manual receipt semantics

The dashboard reads normalized `receipts[]` from `row-result.json`; it does **not** inspect raw Tempo/Loki/journal/gateway artifacts. `receipt_status="present"` means the postprocessor saw an explicit public-safe receipt signal in the k6 summary (or a narrow legacy heuristic matched). `missing` means the summary explicitly reported absence. `unknown` means the receipt still requires manual byte review; panels must render it as incomplete/pending, not as present.

Candidate outcome and receipt completeness are separate signals: `PASS-candidate` only means the k6 checks/proof failure counters passed for the run. Canonical proof folding still requires human review of required receipts and redaction safety.

## 3. Data Ingestion (V1 Architecture)

The v1 architecture has two explicit layers:

* **Artifact source:** `row-result.json` artifacts generated by `postprocess-k6-summary.mjs`. These are the review objects committed under candidate run directories and include `metrics`, `receipts`, and `failureClass` when produced by the current manifest-driven postprocessor.
* **Dashboard source:** the committed Grafana dashboard (`dashboards/k6-proofs.json`) queries the normalized `openclaw_proofs_k6_*` metric family defined in `METRICS.md`. An exporter or remote-write bridge should map `row-result.json` fields to those metric names and labels.

A future static-JSON/Infinity dashboard may read `row-result.json` directly, but the committed dashboard must stay aligned with the metric names in `METRICS.md` so it does not silently render generic k6 runner metrics instead of proof-row health.