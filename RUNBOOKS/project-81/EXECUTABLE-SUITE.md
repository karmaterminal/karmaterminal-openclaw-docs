# Project 81 executable k6 suite quickstart

Goal: give a reviewer or maintainer a small, repeatable path from a normal OpenClaw checkout to a candidate proof bundle.

This quickstart intentionally covers only unattended `k6-runnable` rows. Rows marked `orchestration-required` stay out of the broad suite until a reviewed fixture exists.

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

This excludes static preflight and any `orchestration-required` rows. As of this catalog, it prints the 16-row broad live suite:

```text
R-CD-1,R-CD-2,R-CD-4,R-CD-CHAINED-DEPTH-2,R-CD-MODEL-CHAINED-ALT,R-CD-MODEL-DEFAULT,R-CD-MODEL-TOKEN,R-CD-MODEL-TOOL,R-CD-TOKEN,R-CONFIG-defaults,R-CW-1,R-CW-4,R-CW-DELEGATE-SELF-CONTINUATION,R-CW-TOKEN,R-OBS-status,R-RC-1
```

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

Each row emits `row-manifest.json`, `runner-metadata.json`, `k6.log`, `evidence-lines.log`, `evidence.jsonl`, `run-result.json`, metrics files, and summary files when available.

## 7. Review before folding

A broad-suite run creates candidate artifacts, not a final canonical proof fold by itself.

Before folding:

```bash
node scripts/summarize-review-debt.mjs --run-root <run-root>
node scripts/validate-corpus.mjs --current
node scripts/check-manifest-scenarios.mjs
node scripts/check-scenario-alignment.mjs
```

Fetch Tempo trace JSON when a row records a non-null trace id. If a row records `traceId: null`, treat trace JSON as unavailable review debt or an honest limit; do not invent a fetchable trace.

## Held rows

These rows are intentionally excluded from the broad unattended suite:

- `R-CD-3` — post-compaction seam lifecycle; staging is proven, full seam is captured as review addenda when naturally observed.
- `R-CD-COLLECTION-ON-COLLAPSE` — detached intermediate/root collection semantics need reviewed fixture.
- `R-CW-5` — cost-cap config mutation requires backup/restore and explicit confirmation.
- `R-CW-6` — max-chain config mutation/restart requires backup/restore and explicit confirmation.
- `R-RC-2` — request_compaction accept path mutates session context and must be serialized under human-confirmed fixture.
