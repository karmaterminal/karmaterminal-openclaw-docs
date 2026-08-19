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
- `HONEST_LIMIT` is reserved for `R-RC-2` when a structured live receipt proves `request_compaction` was denied because context pressure remained below threshold. Every other incomplete substrate or receipt condition is `PARTIAL`, never PASS.

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
node tools/k6-proofs/scripts/check-telemetry-contracts.mjs
node tools/k6-proofs/scripts/validate-corpus.mjs --current
```

The four catalog validators share one repository-root contract (#495), so the
same commands produce identical results from `tools/k6-proofs` or
`tools/k6-proofs/scripts`. Use `--repo-root <dir>` or `OPENCLAW_PROOFS_REPO_ROOT`
to point them at an explicit checkout. `run-proofs.sh` runs all four as a
preflight; a failure is harness infrastructure (`harness-control-receipt.json`,
exit 78, zero rows executed), never a per-row product verdict.

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

A missing k6 binary/version mismatch, disabled continuation config, missing required env, or unreachable gateway is `PARTIAL-candidate` / setup failure until fixed.

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
./scripts/run-proofs.sh --live --docs-ref <40-char-docs-sha> R-CD-2,R-CD-4 <40-char-sha>
```

`--docs-ref` (or `OPENCLAW_PROOFS_DOCS_REF`) is mandatory for a live run (#496).
It is resolved and frozen once at startup; the runner refuses to fire unless
repository `HEAD` equals it, tracked bytes under `tools/k6-proofs` are clean, and
every selected runnable row's manifest and scenario are tracked at that exact
commit. A stale, dirty, mixed, or unrecorded harness fails once as infrastructure
(`harness-control-receipt.json`, exit 78) and never synthesizes a row verdict.

An approved run writes `harness-provenance.json` at the artifact root before the
first row fires (matrix id, docs ref, repository, candidate SHA, runtime identity
receipt, runner script digest, row selection and per-row manifest/scenario
digests, start time), keeps an immutable per-matrix copy under
`harness-provenance/<matrix-id>.json`, records `docsRef` / `repository` /
`matrixId` / `manifestSha256` / `scenarioSha256` in every
`runner-metadata.json`, and copies the exact scenario source next to each receipt
as `row-scenario.js`. Because the working tree is what k6 actually reads, the
frozen digests are re-asserted immediately before capture and again immediately
before k6 executes. A candidate routing envelope is withheld unless those values
bind to the approved ref and the copied source bytes.

Each row remains candidate evidence until reviewed and folded.

Every live row also captures the `openclaw-gateway` user journal for the bounded row window. Raw journal bytes remain transient; the artifact contains only `gateway-journal.log`, `gateway-journal-capture.json`, and `gateway-journal-redaction.json`. Correlated continuation/model/tool failures are retained while proof nonces, session keys, authorization material, and unrelated routine lines are removed. Journal access is required by default; set `OPENCLAW_PROOFS_SERVICE_LOG_REQUIRED=false` only when the resulting receipt debt is intentionally retained as PARTIAL.

The runner selects the VU-emitted `VERDICT:` line over a conflicting `handleSummary()` verdict because k6 summary callbacks cannot read mutable VU-local evidence. Any disagreement is retained as `verdict-reconciliation.json`; it is a harness-classification receipt, never a reason to refire the row.

## GitHub Actions wrapper

The bootstrap repo has a workflow-dispatch wrapper for Project 81:

`karmaterminal/openclaw-bootstrap:.github/workflows/project81-k6-proof.yml`

Important inputs:

- `target_prince` — self-hosted runner label (`cael`, `ronan`, `silas`, `elliott`, `emeric`, `rune`);
- `candidate_sha` or `ref` — exact OpenClaw candidate under proof;
- `rows` — comma-separated row ids, default `preflight`;
- `docs_ref` — docs catalog ref, default `main`;
- `session_selector` — scratch selector; avoid channel sessions for broad live rows.
  On gateways with multiple configured agents, use an agent-prefixed selector
  such as `agent:main:main`; disposable proof sessions inherit that owner;
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
node tools/k6-proofs/scripts/check-telemetry-contracts.mjs
node --test tools/k6-proofs/scripts/__tests__/*.test.mjs
```

A row must define:

- row id and scenario basename;
- required env vars and safe defaults;
- live-run safety metadata;
- evidence JSON shape;
- PASS / PARTIAL / FAIL criteria, plus the single `R-RC-2` below-threshold HONEST_LIMIT exception;
- trace/log/report expectations;
- a `telemetryContract` when any required receipt is a telemetry receipt — see
  [`CONTINUATION-TELEMETRY-REMEDY-ROWS.md`](CONTINUATION-TELEMETRY-REMEDY-ROWS.md);
- linked issue and PR.

## Telemetry rebind contract (#1254)

The continuation telemetry census
(`karmaterminal/openclaw#1254`, report `39803b297bd4786db3971eb82a3a7fd0b29bc643`,
product basis `6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955`) established that
accepted continuation entry spans carry no origin, session, turn, or run
identity; that typed-tool spans and accepted-entry spans cannot be causally
joined; that proof traffic carries no durable marker and so cannot be excluded
honestly; that zero-payload and finalization outcomes exist only as log-string
heuristics; and that a degraded backend answers 200 with zero.

A row can therefore execute real behavior and still be impossible to rebind
later. Rows record that gap explicitly rather than implying it is absent:

- the manifest's `telemetryContract` names the spans/attributes the claim rests
  on and whether the product emits them today;
- `row-result.json` carries a `telemetryRebind` block with the unproven rebind
  receipts;
- a row may only claim `rebindable:true` (and the
  `behavioral-and-telemetry-rebindable` pass scope) when origin, session, turn,
  run identity and the proof-run marker are all product-emitted. No committed
  row can today, so every committed row is `behavioral-only`.

Backend degradation is dispositioned by contract: `PARTIAL-candidate` or
`FAIL-candidate`, never a PASS and never a zero-means-absent finding.

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

Loki/Tempo/log pickup is supporting evidence for this sequence. It is not the core blocker. A structured below-threshold refusal remains the sole allowed `HONEST_LIMIT`; any other missing lifecycle receipt is `PARTIAL`, never PASS.

## Portable observability endpoints

Dandelion fleet URLs are defaults, not methodology requirements. External or reviewer runs may set:

- `OPENCLAW_PROOFS_TEMPO_BASE_URL` / `TEMPO_BASE_URL`
- `OPENCLAW_PROOFS_LOKI_BASE_URL` / `LOKI_BASE_URL`
- `OPENCLAW_PROOFS_PROMETHEUS_BASE_URL`
- `OPENCLAW_PROOFS_PROMETHEUS_RW_URL` / `K6_PROMETHEUS_RW_SERVER_URL`
- `OPENCLAW_PROOFS_GRAFANA_BASE_URL`
- `PROOFS_METRICS_OTLP_ENDPOINT`

If no compatible tracing/logging stack exists, record `trace-unavailable` / receipt debt honestly instead of blocking row execution when traces are non-mandatory.
