# Project 81 proof-run method

This is the short entrypoint for a GATES / PR-presentation proof round that uses the Project 81 k6 harness instead of ad-hoc chat receipts.

The goal is repeatability:

1. choose a candidate SHA,
2. enumerate proof rows from the committed catalog,
3. run existing rows or add one new row with a manifest + scenario,
4. collect candidate artifacts, report output, and public-safe observability receipts,
5. fold reviewed evidence into `PROOFS/<candidate-sha>/`, and
6. keep `PROOFS` SHA equal to the PR-presentation SHA.

This document complements:

- `tools/k6-proofs/README.md` — command reference for the local harness;
- `tools/k6-proofs/CONTRIBUTING-ROWS.md` — row authoring details;
- `tools/k6-proofs/k6-proofs-pipeline.xml` — machine-readable pipeline map;
- `openclaw-bootstrap:RUNBOOKS/PROOF-CORPUS-METHOD.md` — canonical proof-corpus procedure;
- `openclaw-bootstrap:RUNBOOKS/PR-DRIFT-CURE-GATES-RUNBOOK.md` and `RUNBOOKS/PR-PRESENTATION-RUNBOOK.md` — GATES / SHA discipline;
- `openclaw-bootstrap:.github/workflows/project81-k6-proof.yml` — workflow-dispatch wrapper.

## Non-negotiables

- Do not fold candidate output as canonical `PASS` until a human/prince review confirms the artifacts.
- Do not print or commit `OPENCLAW_GATEWAY_TOKEN`, provider tokens, prompts, raw nonces, raw WebSocket events, or private session keys.
- Do not count message-tool body text as a continuation token proof. Token rows must record the exact originating surface.
- Keep the proof target explicit: `OPENCLAW_CANDIDATE_SHA=<40-char-sha>`.
- For PR-presentation/GATES work, the proof SHA must be the SHA that will be presented. If the code changes, rerun or explicitly classify the drift.
- `HONEST_LIMIT` is allowed when the substrate blocks the canonical PASS shape and that condition is the evidence. Do not relabel it as PASS.

## Local proof round shape

Run from the docs repo root:

```bash
cd karmaterminal-openclaw-docs
```

### 1. Confirm the row catalog

```bash
node tools/k6-proofs/scripts/list-runnable-rows.mjs --all
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs
node tools/k6-proofs/scripts/check-scenario-alignment.mjs
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs
node tools/k6-proofs/scripts/validate-corpus.mjs --current
```

The “all” denominator includes `preflight`; the live-suite denominator may be smaller when it excludes static/support rows. Record which denominator you cite.

### 2. Offline artifact smoke

Use this before live rows to confirm the candidate artifact pipeline can produce a candidate-only report without gateway access:

```bash
rm -rf /tmp/p81-k6-golden-path
node tools/k6-proofs/scripts/postprocess-k6-summary.mjs \
  --manifest tools/k6-proofs/manifests/preflight.example.json \
  --summary tools/k6-proofs/examples/k6-summary.preflight.example.json \
  --out-root /tmp/p81-k6-golden-path
```

Expected class: `PASS-candidate`, `candidateOnly:true`. This is a harness smoke, not a live product proof.

### 3. Seat readiness

For live rows, run a seat readiness preflight before interpreting proof output:

```bash
OPENCLAW_CANDIDATE_SHA=<40-char-sha> \
OPENCLAW_SEAT_NAME=<seat> \
OPENCLAW_SESSION_KEY=<scratch-or-disposable-session> \
OPENCLAW_GATEWAY_TOKEN=*** \
node tools/k6-proofs/scripts/seat-readiness-preflight.mjs --json
```

A missing k6 binary/version mismatch, disabled continuation config, missing required env, or unreachable gateway is `HONEST_LIMIT-candidate` / setup failure until fixed.

### 4. Dry-run the selected set

For a full catalog dry-run:

```bash
cd tools/k6-proofs
K6_PROOF_OUT_DIR=/tmp/p81-proof-dryrun \
OPENCLAW_CANDIDATE_SHA=<40-char-sha> \
./scripts/run-proofs.sh --dry-run all <40-char-sha>
```

Dry-run output should enumerate rows, report skips, and emit `report.html` plus `report-receipt.json` under `K6_PROOF_OUT_DIR`.

For a focused live-suite dry-run, use the row list helper and pass the resulting comma-separated list to `run-proofs.sh`.

### 5. Run live rows

Prefer scratch/disposable sessions for rows that support them. Do not use a live Discord channel session for broad proof runs unless the row explicitly requires that surface.

```bash
cd tools/k6-proofs
K6_PROOF_OUT_DIR=/tmp/p81-proof-live \
OPENCLAW_GATEWAY_WS=ws://127.0.0.1:18789 \
OPENCLAW_GATEWAY_TOKEN=*** \
OPENCLAW_CANDIDATE_SHA=<40-char-sha> \
OPENCLAW_SEAT_NAME=<seat> \
OPENCLAW_CREATE_DISPOSABLE_SESSION=true \
OPENCLAW_CREATE_DISPOSABLE_SESSIONS=true \
./scripts/run-proofs.sh R-CD-2,R-CD-4 <40-char-sha>
```

Each row remains candidate evidence until reviewed and folded.

Every live row also captures the `openclaw-gateway` user journal for the bounded row window. Raw journal bytes remain transient; the artifact contains only `gateway-journal.log`, `gateway-journal-capture.json`, and `gateway-journal-redaction.json`. Correlated continuation/model/tool failures are retained while proof nonces, session keys, authorization material, and unrelated routine lines are removed. Journal access is required by default; set `OPENCLAW_PROOFS_SERVICE_LOG_REQUIRED=false` only when the resulting receipt debt is an intentional honest limit.

## GitHub Actions wrapper

The bootstrap repo has a workflow-dispatch wrapper for Project 81:

`karmaterminal/openclaw-bootstrap:.github/workflows/project81-k6-proof.yml`

Important inputs:

- `target_prince` — self-hosted runner label (`cael`, `ronan`, `silas`, `elliott`, `emeric`, `rune`);
- `candidate_sha` or `ref` — exact OpenClaw candidate under proof;
- `rows` — comma-separated row ids, default `preflight`;
- `docs_ref` — docs catalog ref, default `main`;
- `session_selector` — scratch selector; avoid channel sessions for broad live rows;
- `dry_run` — defaults true;
- `create_disposable_sessions` — recommended true for supported rows;
- `metrics_push` / `metrics_otlp_endpoint` — public-safe metrics export.

Use it to remove manual row-selection and artifact-shape improv. It does not replace GATES judgment or human review of candidate evidence.

## Adding a new row

Minimum patch shape:

1. Add `tools/k6-proofs/manifests/<row>.json`.
2. Add `tools/k6-proofs/scenarios/<scenario>.js` or point to a static validator when the row is corpus-only.
3. Add/update docs for row-specific setup if the scenario has special preconditions.
4. Run:

```bash
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs
node tools/k6-proofs/scripts/check-scenario-alignment.mjs
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs
node --test tools/k6-proofs/scripts/__tests__/*.test.mjs
```

A row must define:

- row id and scenario basename;
- required env vars and safe defaults;
- live-run safety metadata;
- evidence JSON shape;
- PASS / HONEST_LIMIT / FAIL criteria;
- trace/log/report expectations;
- linked issue and PR.

## Accepted-compaction boundary (#331)

For `R-RC-2` / accepted `request_compaction`, “orchestration/receipts” means the live scenario still needs to perform and capture this sequence in an isolated temp Gateway/session:

1. force or construct context usage above the compaction threshold;
2. stage `continue_delegate(mode="post-compaction")` lifeboat state;
3. invoke `request_compaction` through the OpenClaw tool/WebSocket surface;
4. capture accepted receipt with `status:"compaction_requested"` and `compactionRequestId`;
5. observe compaction lifecycle start/completion;
6. verify post-compaction delegate/lifeboat return after the seam;
7. verify a successor sentinel that could not exist before compaction;
8. write cleanup and trace receipts.

Loki/Tempo/log pickup is supporting evidence for this sequence. It is not the core blocker. Until those lifecycle receipts exist, the row must stay `HONEST_LIMIT` at `force-context-budget` rather than PASS.

## Portable observability endpoints

Dandelion fleet URLs are defaults, not methodology requirements. External or reviewer runs may set:

- `OPENCLAW_PROOFS_TEMPO_BASE_URL` / `TEMPO_BASE_URL`
- `OPENCLAW_PROOFS_LOKI_BASE_URL` / `LOKI_BASE_URL`
- `OPENCLAW_PROOFS_PROMETHEUS_BASE_URL`
- `OPENCLAW_PROOFS_PROMETHEUS_RW_URL` / `K6_PROMETHEUS_RW_SERVER_URL`
- `OPENCLAW_PROOFS_GRAFANA_BASE_URL`
- `PROOFS_METRICS_OTLP_ENDPOINT`

If no compatible tracing/logging stack exists, record `trace-unavailable` / receipt debt honestly instead of blocking row execution when traces are non-mandatory.
