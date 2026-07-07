# k6 Proof Harness — continue_delegate rows

Deterministic proof-row fire-and-observe harness for the OpenClaw continuation feature corpus.

## Structure

```
tools/k6-proofs/
├── lib/
│   ├── gateway-ws.js              # WS helpers (frame, connect, nonce, RequestTracker, redaction)
│   └── manifest-loader.js         # Manifest loading, env-var resolution, validation
├── manifests/                    # Row manifests (R-CD, R-CW, R-RC, R-OBS, safety/config rows)
├── scenarios/
│   ├── preflight.js               # Scenario 0: auth + tool inventory check
│   ├── r-cd-*.js                  # continue_delegate rows
│   └── r-cw*.js                   # continue_work rows
├── dashboards/                    # Grafana dashboard JSON
├── docs/                          # Folded row-family docs
└── scripts/                       # evidence writer, postprocessor, corpus validator
```

## Prerequisites

- [Grafana k6](https://grafana.com/docs/k6/latest/get-started/installation/) installed on the run seat. The proof-standard expectation is centralized in [`seat-readiness.policy.json`](seat-readiness.policy.json) (`v2.0.0` unless the policy or row issue explicitly says otherwise).
- A running OpenClaw gateway on the local seat.
- Run `node tools/k6-proofs/scripts/seat-readiness-preflight.mjs` before treating row output as proof-standard. A version/env/gateway mismatch is `HONEST-LIMIT-candidate`, not product failure.
- Environment variables:
  - `OPENCLAW_GATEWAY_WS` — WebSocket URL (default: `ws://127.0.0.1:18789`)
  - `OPENCLAW_GATEWAY_TOKEN` — operator auth token (**required for live rows, never in source**)
  - `OPENCLAW_SESSION_KEY` — target session key (**required explicitly for live rows that set `liveRunSafety.requiresTargetSessionKey=true`**)
  - `OPENCLAW_CANDIDATE_SHA` — 40-char deploy SHA for this proof run
  - `OPENCLAW_SEAT_NAME` — seat identifier (default: `ronan-dgx`)
  - `OPENCLAW_ROW_MANIFEST` — path to row manifest JSON (optional; enables manifest-driven mode)
  - `OPENCLAW_SEAT_CLASS` — `raw-final-text` or `message-body` (default: `message-body`; affects R-CD-TOKEN)
  - `OPENCLAW_EXPECTED_K6_VERSION` — expected k6 version for seat-readiness preflight (default: `v2.0.0`)

## Usage

### 0. Offline golden-path smoke (no gateway, no secrets)

Use this first to verify the candidate artifact pipeline is alive without touching
a live gateway or writing into the canonical corpus:

```bash
rm -rf /tmp/p81-k6-golden-path
node tools/k6-proofs/scripts/postprocess-k6-summary.mjs \
  --manifest tools/k6-proofs/manifests/preflight.example.json \
  --summary tools/k6-proofs/examples/k6-summary.preflight.example.json \
  --out-root /tmp/p81-k6-golden-path
```

See [`docs/GOLDEN-PATH.md`](docs/GOLDEN-PATH.md). Output remains
`PASS-candidate` / review-required and must not be folded automatically.

### 1. Seat readiness / version preflight

Run this before a proof row when the output may be folded or compared across seats:

```bash
OPENCLAW_CANDIDATE_SHA="<40-char-sha>" \
OPENCLAW_SEAT_NAME="<seat>" \
OPENCLAW_SESSION_KEY="<target-session>" \
OPENCLAW_GATEWAY_TOKEN="***" \
  node tools/k6-proofs/scripts/seat-readiness-preflight.mjs --json
```

The helper emits `openclaw.k6.seat-readiness.v1` JSON and never prints secret values. It records:

- k6 binary path and version, compared to the centralized policy expectation (`tools/k6-proofs/seat-readiness.policy.json`; override with `OPENCLAW_EXPECTED_K6_VERSION` or `--expected-k6-version` only when the row issue says so)
- every binary candidate checked (`/home/figs/bin/k6`, common system paths, and `K6_BIN` when set)
- gateway health/status reachability shape
- continuation config readiness from `openclaw config get agents.defaults.continuation --json`, including `enabled=true` and presence of `maxChainLength`, `maxDelegatesPerTurn`, and `costCapTokens`
- candidate SHA validity, seat name/class, and coarse session scope
- required env-var presence as booleans only, plus public-safe purpose strings from the policy
- whether the check is safe to run concurrently

If k6 is missing, the version differs, continuation is disabled/missing, required env is absent, or gateway health/status is unreachable, treat row output as `HONEST-LIMIT-candidate` / setup failure until the seat is fixed. Do not fold it as product behavior evidence. Use `--no-gateway` only for offline docs/schema checks; live proof rows need a checked gateway and live continuation rows need continuation enabled.

### 2. Preflight check

```bash
OPENCLAW_GATEWAY_TOKEN="***" \
OPENCLAW_ROW_MANIFEST="tools/k6-proofs/manifests/preflight.example.json" \
  k6 run tools/k6-proofs/scenarios/preflight.js
```

### 3. Run an existing scenario (manifest-driven)

Scenario names are **basenames without `.js`**, matching `run-proof.sh` and the
GitHub Actions workflow choices. Current workflow-runnable basenames are:

- `preflight`
- `r-cd-1-typed-delegate`
- `r-cd-2-silent-wake`
- `r-cd-4-target-session-key`
- `r-cd-chained-depth-2`
- `r-cd-model-default`
- `r-cd-model-tool`
- `r-cd-model-chained-alt`
- `r-cd-model-token`
- `r-cd-token-bracket-delegate`
- `r-config-defaults`
- `r-cw-1-tool-schedule-wake`
- `r-cw-4-chain-depth`
- `r-cw-delegate-self-continuation`
- `r-cw-token-bracket`
- `r-obs-status`
- `r-rc-1`
- `r-cw`

Example:

```bash
OPENCLAW_GATEWAY_TOKEN="***" \
OPENCLAW_CANDIDATE_SHA="<40-char-sha>" \
OPENCLAW_ROW_MANIFEST="tools/k6-proofs/manifests/r-cd-2.json" \
  ./tools/k6-proofs/run-proof.sh r-cd-2-silent-wake 2>&1 | tee /tmp/r-cd-2-output.txt
```

### 4. Post-process into proof artifacts

```bash
node tools/k6-proofs/scripts/evidence-writer.mjs \
  --input /tmp/r-cd-2-output.txt \
  --row R-CD-2 \
  --seat ronan-dgx \
  --sha <40-char-sha>
```

Writes candidate evidence into `PROOFS/<SHA>/R-CD-2/ronan-dgx/k6-run-<timestamp>/`.

### 5. Recover delayed/session-history receipts

Some rows can produce a non-zero live k6 result while the runtime receipts are
still present in the target session history. Two known shapes:

- the live WebSocket observation window closes before delayed continuation wakes
  land (`R-CW-4`);
- the live parser sees the sentinel but misses numeric/tool-result fields that
  are present in the session transcript (`R-CONFIG-defaults`).

For those rows, `recover-session-receipts.mjs` may emit a supplemental
`PASS-candidate` only when **all required receipts are present** in
`sessions.get` history. This is not an automatic green fold: preserve the
original k6 stdout/summary and the recovery JSON together, and keep the result
as candidate evidence until review.

```bash
OPENCLAW_GATEWAY_TOKEN="***" \
  node tools/k6-proofs/scripts/recover-session-receipts.mjs \
    --row R-CW-4 \
    --session-key <target-session-key> \
    --nonce <row-nonce> \
    --out /tmp/r-cw-4-session-receipts.json
```

## Metrics and dashboard contract

Public-safe visualization fields for Project 81 live in [`METRICS.md`](./METRICS.md). Treat that file as the contract for Grafana / Prometheus / postprocess ingestion: candidate outcome, `proof_failures`, duration, receipt status, and review-pending state are allowed; tokens, session keys, prompts, nonces, raw events, and raw responses are not.

To turn a candidate artifact into the dashboard metric family, export from the
normalized candidate row directory or from a `row-result.json` file:

```bash
node tools/k6-proofs/scripts/export-row-metrics.mjs \
  --run-dir /tmp/k6-proof-runs/<sha>/<row>/<seat>/<run-id> \
  --prometheus-out /tmp/openclaw-proofs-k6.prom \
  --otlp-out /tmp/openclaw-proofs-k6.otlp.json
```

For live fleet ingestion, POST the same public-safe OTLP JSON to the existing
collector endpoint (the collector remote-writes metrics to Prometheus):

```bash
node tools/k6-proofs/scripts/export-row-metrics.mjs \
  --run-dir /tmp/k6-proof-runs/<sha>/<row>/<seat>/<run-id> \
  --push-otlp http://10.0.0.99:4318/v1/metrics
```

The exporter emits only the `openclaw_proofs_k6_*` metric contract: row/seat/SHA,
outcome, duration, proof-failure count, checks rate when present, receipt status,
and review-pending signal. It does not export session keys, prompt bodies, nonces,
raw websocket events, tokens, or local private paths.

## Tempo trace receipts

When a live row emits a `trace_id`, `run-proofs.sh` now attempts to fetch the
matching Tempo JSON from `TEMPO_BASE_URL` (default `http://tempo.dandelion.cult`)
and saves it beside the candidate run artifacts as `tempo-trace-<trace>.json`.
The fetch receipt is stored in `tempo-trace-receipt.json`; fetch failures are
kept non-fatal by default and leave `tempo-trace-json` review-pending. Set
`OPENCLAW_PROOFS_K6_TEMPO_REQUIRED=true` only when a missing trace JSON should
fail the run.

Manual fetch:

```bash
node tools/k6-proofs/scripts/fetch-tempo-trace.mjs \
  --run-dir /tmp/k6-proof-runs/<sha>/<row>/<seat>/<run-id>
```

## HTML run report

`run-proofs.sh` writes a public-safe `report.html` at the selected run output root.
It summarizes row, seat, candidate SHA, PASS/FAIL candidate outcome, review state,
duration, receipt status, and relative artifact directories. Like the metrics
exporter, it intentionally excludes session keys, prompts, nonces, raw events,
raw responses, tokens, and private absolute paths.

To render or refresh a report from an existing output root:

```bash
node tools/k6-proofs/scripts/render-run-report.mjs \
  --root /tmp/k6-proof-runs \
  --out /tmp/k6-proof-runs/report.html
```

The HTML report is a review aid only. It does not promote candidate artifacts into
canonical `PROOFS/**` folds.

## Config-mutating rows and restart containment

Rows that lower continuation limits or restart the gateway must stay `orchestration-required` until their fixture emits the full receipt chain:

1. capture the original config value;
2. apply only the row-local low test value named by the manifest;
3. reload/restart through the configured command;
4. fire the proof;
5. restore the original value even when the proof fails or aborts;
6. reload/restart again and record the restore receipt.

`run-proof.sh` fails closed for `orchestration-required` and `construct-only` manifests when `OPENCLAW_ROW_MANIFEST` is set. A config-mutating row must not become directly k6-runnable until a promotion PR changes the manifest to `scenario.status="runnable"` and `liveRunSafety.classification="k6-runnable"` with the receipt chain above implemented and tested.

The default restart command for fixtures is:

```bash
openclaw gateway restart --safe --wait 10s
```

Override it with `OPENCLAW_GATEWAY_RESTART_CMD` for nonstandard deployments. The command must be self-contained for the target seat; do not bake frond-specific SSH, service, or workflow names into public row logic. If a fixture cannot safely restart/reload through that configured command, it must emit a blocked candidate artifact instead of mutating config.

Cost-cap boundary rows should take their low test value from `OPENCLAW_K6_COST_CAP_TEST_VALUE` when set, with a documented row-local default. They must restore the original cap before emitting a fold-reviewable candidate artifact.

## Design principles

### Manifest-driven scenarios (data/logic separation)

Row-specific configuration lives in **manifests** (`tools/k6-proofs/manifests/*.json`), not hardcoded in scenario logic. Scenarios load their manifest at init time via `OPENCLAW_ROW_MANIFEST` env var.

Manifests use `${ENV_VAR:-default}` placeholders resolved at runtime — no secrets or seat-specific values baked into source.

Manifests follow the schema defined by #100 (foundation): `openclaw.k6.proof-row-manifest.v1`.

### Live-run safety contract

Rows may declare a `liveRunSafety` block so reviewers and runners can tell the difference between static/preflight-only rows, k6-runnable live rows, orchestration-required rows, and construct-only registry entries before any gateway traffic starts.

The block records:

- `classification`: `static-preflight-only`, `k6-runnable`, `orchestration-required`, or `construct-only`.
- `requiresLiveGatewayToken`: whether `OPENCLAW_GATEWAY_TOKEN` must be present before the row can run.
- `requiresTargetSessionKey`: whether `OPENCLAW_SESSION_KEY` must be set explicitly instead of falling back to `main`.
- `requiresCandidateSha`: whether `OPENCLAW_CANDIDATE_SHA` must be present and a 40-character hex SHA before the row can run.
- `requiresExternalAgentOrToolInvocation`: whether k6 REST/WS alone is insufficient and an agent/tool invocation is part of the proof path.
- `sameSessionConcurrencySafe`: `false` means the runner serializes the row per `(rowId, target session)` and fails closed if another run already holds that lock.
- `expectedArtifactClass`: the highest candidate class the row should emit before review, for example `PASS-candidate`, `HONEST-LIMIT-candidate`, or `construct-only`.
- `requiredReceipts`: the review receipts that must exist before folding.
- `foldRequiresReview`: always `true`; generated artifacts are candidates, never final proof verdicts.

When `OPENCLAW_ROW_MANIFEST` is set, `run-proof.sh` calls `scripts/live-run-guard.mjs` before invoking k6. The guard fails closed if required token/session/SHA env is absent, if the manifest's live/static classification contradicts its scenario status, or if a same-session unsafe row is already running against the same target session.

### Redaction boundary

**No secrets in source or public artifacts.** Gateway tokens come from env vars only.

Event payloads are redacted through an allowlist (`redactEvent()` in `lib/gateway-ws.js`) before storing.

The post-processor **refuses** to write public artifacts if evidence contains raw `events` without `redacted_events`. This is a hard gate — scenarios must use the redaction layer.

### Protocol correctness

Gateway WS responses use `{ type: "res", id, payload?, error? }` — NOT `{ result }`.

The `RequestTracker` class maps request IDs to method names for reliable response correlation (responses don't echo method names).

### Continuation observability surfaces

`continue_delegate` proof rows must not require a `tasks.list` row as the primary
spawn receipt. The generic `tasks.list` method reads the TaskFlow / scheduled-task
registry; `continue_delegate` uses the pending-delegate queue and then the
subagent/session run surfaces. A delegate can fire successfully while never writing
a nonce-correlated record to `tasks.list`.

For R-CD rows, prefer these public-safe receipts instead:

- `sessions.send` or `tools.invoke` accepted the dispatch request.
- `sessions.messages.subscribe` emitted `session.message` / agent events for the
  dispatching or target session.
- Nonce-correlated parent/target return events appeared on the subscribed session
  stream.
- `tasks.list` may be kept as optional extra context only; a missing task-ledger
  row is not a delegate failure by itself.

This avoids the false-negative filed in #134, where a live delegate fired but the
scenario failed because it queried the wrong registry surface.


### Seat-class awareness (R-CD-TOKEN)

The bracket scanner fires only on scanned-final-text (terminal position). Seats that route final-text through `message(send)` body kill the scanner.

- **raw-final-text seat**: bracket fires → PASS-candidate
- **message-body seat** (ronan-dgx default): bracket killed → HONEST-LIMIT-candidate

This is **declared in the manifest before the run**, not a post-hoc excuse. The `seatClassExpectation` block in `r-cd-token.json` states the expected outcome per seat class.

## Row coverage

| Row | Scenario | Surface | Expected outcome |
|-----|----------|---------|-----------------|
| preflight | `preflight` | read-only | Candidate; gateway/session/tool inventory check |
| R-CD-1 | `r-cd-1-typed-delegate` | typed-tool | Candidate; continue_delegate schedule/spawn/return path |
| R-CD-2 | `r-cd-2-silent-wake` | typed-tool | PASS-candidate when dispatch/session-events observed and no channel delivery appears |
| R-CD-4 | `r-cd-4-target-session-key` | typed-tool | Candidate; verify target-vs-parent session events, not `tasks.list` |
| R-CD-CHAINED-DEPTH-2 | `r-cd-chained-depth-2` | typed-tool | Candidate; verify nonce-correlated chain return on subscribed session stream |
| R-CD-TOKEN | `r-cd-token-bracket-delegate` | bracket-token | Candidate; terminal `[[CONTINUE_DELEGATE: ...]]` from lightContext/raw final text schedules and returns |
| R-CD-MODEL-DEFAULT | `r-cd-model-default` | typed-tool | Candidate; delegate inherits default provider/model without override |
| R-CD-MODEL-TOOL | `r-cd-model-tool` | typed-tool | Candidate; explicit model override request byte must match observed child model byte |
| R-CD-MODEL-CHAINED-ALT | `r-cd-model-chained-alt` | typed-tool | Candidate; depth-1 delegate schedules depth-2 delegate with explicit alternate model |
| R-CD-MODEL-TOKEN | `r-cd-model-token` | bracket-token | Candidate; bracket `model=` modifier parse + observed child model byte |
| R-CD-COLLECTION-ON-COLLAPSE | planned `r-cd-collection-on-collapse` | typed-tool | Scaffold; A→B→C detached-intermediate collapse with root collection + no-orphan guard |
| R-CONFIG-defaults | `r-config-defaults` | read-only | Candidate; continuation config defaults/readiness check |
| R-CW-1 | `r-cw-1-tool-schedule-wake` | typed-tool | Candidate; continue_work schedule + wake |
| R-CW-4 | `r-cw-4-chain-depth` | typed-tool | Candidate; continue_work chain depth across multiple hops |
| R-CW-DELEGATE-SELF-CONTINUATION | `r-cw-delegate-self-continuation` | typed-tool | Candidate; delegate child self-continuation path |
| R-CW-TOKEN | `r-cw-token-bracket` | bracket-token | Candidate; bare `CONTINUE_WORK:N` from scanned final text drives hop-2 |
| R-OBS-status | `r-obs-status` | read-only | Candidate; gateway status/observer receipt check |
| R-RC-1 | `r-rc-1` | typed-tool | Candidate; request_compaction below-threshold structured rejection |
| R-CW overview | `r-cw` | read-only/infrastructure | Candidate; combined continue_work infrastructure check |

Other manifests may be `scaffold` or `construct-only`: they are tracked rows,
but not workflow-runnable until a matching `tools/k6-proofs/scenarios/<name>.js`
exists and the manifest is promoted to `scenario.status="runnable"`.

## Guardrails

- Child tasks use nonce-only prompts: no file mutation, no external writes.
- Scenarios run single-VU, serialized. Do not run against active sessions without coordination.
- Gateway token must never appear in committed artifacts or source.
- All artifacts are CANDIDATE status; human review promotes to PASS.
- Post-processor refuses unredacted event data.
- No manifest fold without review (per #100 foundation contract).

## Integration & validation

Row PRs go through a contribution checklist + a fold-time validator. See
[`CONTRIBUTING-ROWS.md`](CONTRIBUTING-ROWS.md) for the prince-facing checklist
(claim the issue, run the row, post-process, paste validator output in the PR
body, zero secrets).

The corpus invariants enforced at fold time live in
[`scripts/validate-corpus.mjs`](scripts/validate-corpus.mjs):

```bash
# Validate a single corpus dir (manifest + rollup tally + evidence + dirs)
node tools/k6-proofs/scripts/validate-corpus.mjs --sha <40-char-sha>

# Archival sweep across PROOFS/<sha>/; reports skipped/legacy/failed historical dirs but exits 0 by default
node tools/k6-proofs/scripts/validate-corpus.mjs --all

# Strict archival sweep; exits non-zero if any historical manifest fails current invariants
node tools/k6-proofs/scripts/validate-corpus.mjs --all --strict

# Validate PROOFS/INDEX.json consistency vs the manifest it points to (current-board gate)
node tools/k6-proofs/scripts/validate-corpus.mjs --index
node tools/k6-proofs/scripts/validate-corpus.mjs --current

# Machine-readable
node tools/k6-proofs/scripts/validate-corpus.mjs --index --json

# Validate row-manifest scenario registry status vs runnable scenario files
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs

# Fail-closed live-run safety guard for one manifest
node tools/k6-proofs/scripts/live-run-guard.mjs --manifest tools/k6-proofs/manifests/r-cd-2.json --json

# Validate workflow scenario choices and row-manifest scenario alignment
node tools/k6-proofs/scripts/check-scenario-alignment.mjs

# Export candidate artifact row-result.json files as Prometheus text exposition
node tools/k6-proofs/scripts/export-prometheus-metrics.mjs --root PROOFS --out /tmp/openclaw-proofs-k6.prom
```

Checks: JSON parse, schema sanity (`openclaw.proofs.index.v1` /
`openclaw.proofs.manifest.v1`), every declared `evidence_doc` and `rows[].dir`
exists, no orphan row dirs, INDEX `rollup` tallies match the manifest `rows[].state`
counts, manifest `capture_sha` matches its directory name, and no stale
`pending_push` / `upload-blame` / `TODO-UPLOAD` wording. `--index` / `--current`
are the current-board gates and exit non-zero on failure. `--all` is archival by
default: its JSON includes `archivalFailed` and `archivalSummary` for skipped,
legacy-schema, and failed historical dirs, but it exits 0 unless `--strict` is
supplied. The script never mutates corpus data.

`check-manifest-scenarios.mjs` is the row-harness registry check: runnable
manifests must point at an existing `tools/k6-proofs/scenarios/*.js`; rows with
no runnable file must say `scenario.status` is `scaffold` or `construct-only`.

## Coordination

- Epic: [#106](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/106)
- Row issue: [#103](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/103)
- Foundation: [#100](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/100) (artifact layout by Emeric)
- Coordinator: @silas-dandelion-cult
- Project: [karmaterminal project 81](https://github.com/orgs/karmaterminal/projects/81)
