# Project 81 executable k6 suite quickstart

Goal: give a reviewer or maintainer a small, repeatable path from a normal OpenClaw checkout to a candidate proof bundle.

This quickstart intentionally covers unattended `k6-runnable` rows. At this catalog floor the unattended suite resolves to 34 rows, but that does **not** mean 34 fresh live behavior captures: the suite includes live WebSocket rows, read-only/status rows, offline static committed-packet validators, and threshold/honest-limit canaries. Rows that still require an accepted-path fixture remain documented as review debt instead of being over-claimed.

## 1. Install k6

Install Grafana k6 using the upstream package for your OS:

- <https://grafana.com/docs/k6/latest/set-up/install-k6/>

Then verify:

```bash
k6 version
```

The proof-standard version expectation is recorded in `tools/k6-proofs/seat-readiness.policy.json`.

## 2. Prepare OpenClaw gateway access

Start or point at an OpenClaw gateway with continuation enabled. Export operator auth through environment variables; never commit tokens.

```bash
export OPENCLAW_GATEWAY_WS="ws://127.0.0.1:18789"
export OPENCLAW_GATEWAY_TOKEN="***"
export OPENCLAW_CANDIDATE_SHA="<40-char deployed OpenClaw SHA>"
export OPENCLAW_SEAT_NAME="<seat-name>"
```

If you run on the same host as OpenClaw and the local config is readable, `run-proofs.sh` can discover `OPENCLAW_GATEWAY_TOKEN` from `~/.openclaw/openclaw.json`; explicit env is clearer for reproducible review.

## 3. Clone the proof catalog

```bash
git clone https://github.com/karmaterminal/karmaterminal-openclaw-docs.git
cd karmaterminal-openclaw-docs/tools/k6-proofs
```

## 4. Print the broad unattended suite

```bash
ROWS="$(node scripts/list-runnable-rows.mjs --live-suite)"
printf '%s\n' "$ROWS"
```

As of this catalog, the resolver prints the following 34-row unattended suite:

```text
preflight,R-CD-1,R-CD-2,R-CD-3,R-CD-4,R-CD-CHAINED-DEPTH-2,R-CD-COLLECTION-ON-COLLAPSE,R-CD-MODEL-CHAINED-ALT,R-CD-MODEL-DEFAULT,R-CD-MODEL-TOKEN,R-CD-MODEL-TOOL,R-CD-RETURN-OVERLAP,R-CD-SILENT,R-CD-TOKEN,R-CONFIG-defaults,R-CONFIG-INTERSESSION,R-CW-1,R-CW-2,R-CW-3,R-CW-4,R-CW-7,R-CW-DELEGATE-CHILD-LIVE,R-CW-DELEGATE-SELF-CONTINUATION,R-CW-DELEGATE-TOKEN,R-CW-MULTI-COLLAPSE,R-CW-MULTI,R-CW-TOKEN,R-OBS-1,R-OBS-2,R-OBS-status,R-RC-1,R-RC-2,R-REGRESSION-TRAP-TESTS,R-TRACE-REDACTION-1121
```

Treat that list as a runnable review queue, not a single proof class. `transport=offline` rows parse committed proof packets; `HONEST-LIMIT-candidate` rows prove the safe reachable canary path when the full behavior needs a fixture.

## GitHub Actions option

The same public catalog also exposes a workflow in this repository:

```text
Actions -> project81-k6-proof
```

Use `rows=live-suite` to resolve the unattended suite from manifests. Dry runs can use `ubuntu-latest`. Live runs need a runner that can reach the target OpenClaw gateway and has k6 installed; set the repository or fork secret `OPENCLAW_GATEWAY_TOKEN` and choose runner labels with `runner_labels_json`, for example `["self-hosted","cael"]`.

## 5. Dry-run row selection

```bash
./scripts/run-proofs.sh --dry-run "$ROWS"
```

Dry-run verifies row discovery and artifact shape without mutating a live session.

## 6. Run the live suite

Use disposable sessions unless you are deliberately proving behavior on a named target session:

```bash
export OPENCLAW_CREATE_DISPOSABLE_SESSION=true
export OPENCLAW_CREATE_DISPOSABLE_SESSIONS=true
./scripts/run-proofs.sh --live "$ROWS"
```

Artifacts are written under `${K6_PROOF_OUT_DIR:-/tmp/k6-proof-runs}`:

```text
<out-dir>/<candidate-sha>/<ROW>/<seat>/<timestamp-row>/
```

Each row emits `row-manifest.json`, `runner-metadata.json`, `k6.log`, `evidence-lines.log`, `evidence.jsonl`, `run-result.json`, metrics files, and summary files when available. A review-complete row also emits `candidate-run-result.json` (`openclaw.k6.candidate-run-result.v1`): a public-safe routing envelope that binds the manifest, candidate SHA, docs ref, row, seat, and run identity. It remains candidate-only (`behaviorProof:false`, `canonicalFoldForbidden:true`); review-pending rows deliberately receive no envelope and remain in the review-debt queue.

## 7. Review before folding

A broad-suite run creates candidate artifacts, not a final canonical proof fold by itself.

Before folding:

```bash
node scripts/summarize-review-debt.mjs --run-root <run-root>
node scripts/validate-corpus.mjs --current
node scripts/check-manifest-scenarios.mjs
node scripts/check-scenario-alignment.mjs
node scripts/check-proof-row-manifests.mjs
```

Fetch Tempo trace JSON when a row records a non-null trace id. If a row records `traceId: null`, treat trace JSON as unavailable review debt or an honest limit; do not invent a fetchable trace.

## Coverage caveats

R-CW-5 and R-CW-6 are intentionally hidden from `live-suite`: their live cap claims remain `orchestration-required` until an isolated fixture can mutate, collect all receipts, restore state, and restart safely where needed. R-CW-5A/R-CW-6A remain outside the suite because they are non-live helpers.

Several rows are runnable only as bounded review candidates:

- `R-CD-3` stages the post-compaction lifeboat and accepts threshold refusal as an honest limit; a naturally accepted compaction seam remains review debt until a fixture drives the over-threshold path.
- `R-RC-2` proves delegated `request_compaction` reaches the child and returns a structured threshold rejection in ordinary disposable sessions; accepted compaction is a separate fixture problem.
- `R-CD-COLLECTION-ON-COLLAPSE` and `R-CW-MULTI-COLLAPSE` are static committed-packet validators. They make historical proof packets mechanically checkable; they do not mutate config or rerun the original live behavior.
- `R-CW-5A` and `R-CW-6A` are static source/harness boundary rows. They emit `construct-only` and cannot be used as live R-CW-5/6 PASS evidence.

If a future PR adds an accepted-compaction or config-mutating live fixture, it must include backup/restore or isolated-temp-state receipts before claiming a fresh live PASS.
