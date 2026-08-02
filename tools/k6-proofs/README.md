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
- Run `node tools/k6-proofs/scripts/seat-readiness-preflight.mjs` before treating row output as proof-standard. A version/env/gateway mismatch is `PARTIAL-candidate`, not product failure.
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

### R-CW-5: isolated typed-tool fixture

`continue_work` is deliberately unavailable through the gateway/MCP loopback,
so `r-cw-5-cost-cap-reject.js` stays a fail-closed scaffold.  Run the
process-local exact-candidate fixture instead; it calls the same typed callback
that a real embedded attempt receives, uses a disposable session store and
worktree, and never changes a running gateway or fleet config:

```bash
node tools/k6-proofs/scripts/run-cost-cap-fixture.mjs \
  --source-dir <exact-candidate-worktree> \
  --candidate-sha <40-char-sha> \
  --artifact-dir <empty-private-directory> --cap 100 --json
```

The receipt and fail-closed contract are documented in
[`docs/R-CW-5-ISOLATED-TOOL-SURFACE.md`](docs/R-CW-5-ISOLATED-TOOL-SURFACE.md).
The result is a reviewed `PASS-candidate`, never an automatic corpus fold.

### R-CW-6: isolated max-chain fixture

The max-chain row uses the same safe execution class but an independent
boundary: it imports the production `checkContinuationBudget`, drives two
accepted elections and the first rejected election through
`scheduleContinuationWorkBatch`, persists and reloads the at-limit chain
state, repeats rejection through `scheduleContinuationWork`, enters the real
`runAgentAttempt` path and invokes the registered production `continue_work`
tool executor, and runs the exact candidate's delegate
dispatch boundary at the same selected maximum plus the candidate's committed
regression suite. It does not infer chain behavior from the R-CW-5
cost-cap fixture or mutate fleet config/state:

Before proofs, the detached worktree must declare exact `pnpm@<semver>` in its
committed `package.json` (an optional `+sha...` suffix is accepted). The runner
checks `pnpm --version`, requires that exact semantic version, runs
`pnpm install --frozen-lockfile --prefer-offline --ignore-scripts`, and then
requires candidate-lock bytes, `.modules.yaml` package-manager metadata,
candidate-contained virtual-store metadata, and local `tsx`/`vitest` realpaths
to align. This is **not hermetic host-toolchain or cryptographic provenance
proof**: the host-resolved `pnpm` is version-checked and the resulting tree is
verified for lockfile/tree/version alignment.

```bash
node tools/k6-proofs/scripts/run-max-chain-fixture.mjs \
  --source-dir <exact-candidate-worktree> \
  --candidate-sha <40-char-sha> \
  --artifact-dir <empty-private-directory> \
  --max-chain-length 3 --json
```

See
[`docs/R-CW-6-ISOLATED-MAX-CHAIN.md`](docs/R-CW-6-ISOLATED-MAX-CHAIN.md).
The result is review-required and never an automatic canonical fold.

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

- [`docs/PROOF-RUN-METHOD.md`](docs/PROOF-RUN-METHOD.md) is the short GATES/proof-round entrypoint: row enumeration, dry-run/live run shape, bootstrap workflow anchor, and the #331 receipt boundary.

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

If k6 is missing, the version differs, continuation is disabled/missing, required env is absent, or gateway health/status is unreachable, treat row output as `PARTIAL-candidate` / setup failure until the seat is fixed. Do not fold it as product behavior evidence. Use `--no-gateway` only for offline docs/schema checks; live proof rows need a checked gateway and live continuation rows need continuation enabled.

### 2. Preflight check

The supported live preflight never guesses a session key. By default it selects
and validates model selection for a session returned by `sessions.list` before
calling `tools.effective` with that exact key. Metadata verification records only
`session-verified`; preparation becomes complete only after that read-only probe
succeeds. Set
`OPENCLAW_PREFLIGHT_CREATE_DISPOSABLE_SESSION=true` to use the explicit
`agents.list` → `models.list` → `sessions.create` → `sessions.list`
create-and-verify path instead. Neither path dispatches a continuation or fires
a proof row; session resolution or inventory failure is explicit `NO-VERDICT`.

`R-RC-1` uses a stronger boundary: after disposable-session verification and
subscription, it sends one bounded benign no-tools preparation turn, binds the
top-level `runId` returned by `sessions.send` to the matching successful
lifecycle `end`, and only then calls `tools.effective` for that exact session.
Its stages are public-safe (`session-verified`, `runtime-run-accepted`,
`runtime-lifecycle-complete`, `tools-effective-complete`) and never expose the
session key, prompt, or run ID. The later request-compaction proof turn remains
distinct and retains its invocation/result binding.

```bash
OPENCLAW_GATEWAY_TOKEN="***" \
OPENCLAW_ROW_MANIFEST="tools/k6-proofs/manifests/preflight.example.json" \
  k6 run tools/k6-proofs/scenarios/preflight.js
```

Use the row-list runner when you need the same bounded journal and artifact
layout as a live proof run:

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN="***" ./scripts/run-proofs.sh --live \
  --docs-ref "$(git rev-parse HEAD)" preflight <candidate-sha>
```

### 3. Run an existing scenario (manifest-driven)

Scenario names are **basenames without `.js`**, matching `run-proof.sh` and the
GitHub Actions workflow choices. Current workflow-runnable basenames are:

- `preflight`
- `r-cd-1-typed-delegate`
- `r-cd-2-silent-wake`
- `r-cd-3-post-compaction`
- `r-cd-4-target-session-key`
- `r-cd-collection-on-collapse`
- `r-cw-5`
- `r-cw-6`
- `r-cw-multi-collapse`
- `r-cd-chained-depth-2`
- `r-cd-silent`
- `r-cd-model-default`
- `r-cd-model-tool`
- `r-cd-model-chained-alt`
- `r-cd-model-token`
- `r-cd-token-bracket-delegate`
- `r-cd-return-overlap`
- `r-config-defaults`
- `r-config-intersession`
- `r-cw-1-tool-schedule-wake`
- `r-cw-2-immediate-wake`
- `r-cw-3-reason-telemetry`
- `r-cw-4-chain-depth`
- `r-cw-7`
- `r-cw-delegate-child-live`
- `r-cw-delegate-token`
- `r-cw-multi`
- `r-cw-delegate-self-continuation`
- `r-cw-token-bracket`
- `r-obs-status`
- `r-regression-trap-tests`
- `r-trace-redaction-1121`
- `r-obs-2`
- `r-rc-1`
- `r-rc-2-delegate-request-compaction`
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
  are present in the session transcript (`R-CONFIG-DEFAULTS`).

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

## Public-safe runner artifacts

Live `run-proofs.sh` executions keep the raw k6 log and extracted evidence only
in transient files while trace correlation runs. Before the row directory is
finalized, the runner removes nonce, session-key, run/idempotency identifiers,
raw task/prompt/message fields, and captured event payloads recursively. It
writes sanitized `k6.log`, `evidence.jsonl`, `evidence-lines.log`, and nested
`run-result.json.evidence`, plus `evidence-redaction.json` describing the
redaction boundary. Runner metadata records only whether a session was
configured; it never persists the session key.

An empty or unsanitizable evidence stream is a postprocess failure, not a
successful proof with missing artifacts. Trace and correlation paths in
`run-result.json` are artifact basenames rather than local run-directory paths.

## Tempo trace receipts

When a live row emits a `trace_id`, `run-proofs.sh` attempts to fetch the
matching Tempo trace from `OPENCLAW_PROOFS_TEMPO_BASE_URL` / `TEMPO_BASE_URL` (fleet default `http://tempo.dandelion.cult`)
and saves only its public-safe projection beside the candidate run artifacts
as `tempo-trace-<trace>.json`; raw Tempo/OTLP responses are never public proof artifacts.
For trace-required tool rows whose primary `trace_id` is null, the collector
instead searches by seat service, tool fingerprint, and an evidence-derived
bounded dispatch window. It accepts exactly one candidate, fails closed on
zero or multiple candidates, and saves a public-safe projection containing
only proof topology plus allowlisted telemetry attributes, together with a
deterministic correlation receipt containing the exact query window. Fetch or
correlation failures are kept non-fatal by default and leave
`tempo-trace-json` review-pending. Set `OPENCLAW_PROOFS_K6_TEMPO_REQUIRED=true`
only when a missing trace JSON should fail the run.

For trace-required `continue_delegate` rows, the runner does not trust a
missing or first-match trace ID. It derives the public-safe runtime fingerprint
from the committed prompt template and evidence nonce, searches Tempo by
`reason.hash` + `reason.length` + delegate mode, requires exactly one trace,
and validates that the originating `continue_delegate` tool span plus
`continuation.delegate.fire` and `continuation.delegate.dispatch` share valid,
distinct IDs and one chain. The public-safe trace projection and
`continuation-trace-correlation.json` are saved beside the row artifacts; raw
task text and `traceparent` are not persisted in the correlation receipt.

Portable endpoint env vars for reviewer/fork runs:

- `OPENCLAW_PROOFS_TEMPO_BASE_URL` (or legacy `TEMPO_BASE_URL`) — Tempo query base URL for trace fetches.
- `OPENCLAW_PROOFS_LOKI_BASE_URL` (or legacy `LOKI_BASE_URL`) — Loki base URL for scenarios that probe log infra.
- `OPENCLAW_PROOFS_PROMETHEUS_BASE_URL` — Prometheus query base URL.
- `OPENCLAW_PROOFS_PROMETHEUS_RW_URL` (or legacy `K6_PROMETHEUS_RW_SERVER_URL`) — Prometheus remote-write endpoint for `run-proof.sh`.

The dandelion.cult URLs are defaults for our fleet, not requirements for the methodology.

Manual fetch:

```bash
node tools/k6-proofs/scripts/fetch-tempo-trace.mjs \
  --run-dir /tmp/k6-proof-runs/<sha>/<row>/<seat>/<run-id>
```

For `R-CW-3`, automate the repeatable reason-telemetry/redaction review after
fetching the trace:

```bash
node tools/k6-proofs/scripts/review-r-cw-3-reason-telemetry.mjs \
  --run-dir /tmp/k6-proof-runs/<sha>/R-CW-3/<seat>/<run-id> \
  --tempo-trace /tmp/k6-proof-runs/<sha>/R-CW-3/<seat>/<run-id>/tempo-trace-<trace>.json
```

The helper writes `r-cw-3-reason-telemetry-review.json`, passes only when the
run saw dispatch/schedule/wake, Tempo contains safe `reason.present`,
`reason.length`, and `reason.hash` attributes, and the raw `RAW-RCW3-*` reason
sentinel / `k6-proof-R-CW-3-redaction` prefix are absent from the trace. It is a
review artifact, not a Gateway action.

When reviewing an existing candidate-run bundle, summarize pending review receipts
before attempting Tempo fetches:

```bash
node tools/k6-proofs/scripts/summarize-review-debt.mjs \
  --run-root RUNBOOKS/project-81/candidate-runs/<sha>/<run-id>
```

For `tempo-trace-json`, the summary distinguishes rows with a fetchable `traceId`
from rows where `traceId` is null. Null trace ids cannot be fetched from Tempo;
those rows need either a rerun with trace emission or an explicit fold decision
accepting trace-missing as an honest review limit.

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
- `requiresTargetSessionKey`: whether `OPENCLAW_SESSION_KEY` must be set explicitly. The row-list runner never invents or falls back to a session key.
- `requiresCandidateSha`: whether `OPENCLAW_CANDIDATE_SHA` must be present and a 40-character hex SHA before the row can run.
- `requiresExternalAgentOrToolInvocation`: whether k6 REST/WS alone is insufficient and an agent/tool invocation is part of the proof path.
- `sameSessionConcurrencySafe`: `false` means the runner serializes the row per `(rowId, target session)` and fails closed if another run already holds that lock.
- `expectedArtifactClass`: the highest candidate class the row should emit before review, for example `PASS-candidate`, `PARTIAL-candidate`, or `construct-only`. `HONEST-LIMIT-candidate` is reserved for `R-RC-2` below-threshold refusal.
- `requiredReceipts`: the review receipts that must exist before folding.
- `foldRequiresReview`: always `true`; generated artifacts are candidates, never final proof verdicts.

When `OPENCLAW_ROW_MANIFEST` is set, `run-proof.sh` calls `scripts/live-run-guard.mjs` before invoking k6. The guard fails closed if required token/session/SHA env is absent, if the manifest's live/static classification contradicts its scenario status, or if a same-session unsafe row is already running against the same target session.

The guard **computes** the lock identity; it never takes the lock itself. `--json` and `--shell` report `lockRequired`, `lockRequiredReason` (`manifest-declared` / `caller-override` / `none`) and two lock paths; the caller is responsible for actually holding them — `run-proof.sh` holds `lockPath` on fd 9, and any other caller must wrap its whole run in `flock`. Reporting a lock is not owning one.

- `lockPath` (`/tmp/openclaw-k6-proof-*.lock`) is keyed on `(rowId, target session)` and excludes a second run of **that row** against that session.
- `sessionLockPath` (`/tmp/openclaw-k6-session-*.lock`) is keyed on the **target session** alone and excludes any *other* continuation row against that session.

Callers that must honour both obligations nest them session-outer then row-inner — always in that order, so the acquisition order is global and cannot deadlock:

```bash
flock --nonblock --conflict-exit-code 75 "$K6_PROOF_SESSION_LOCK_PATH" \
  flock --nonblock --conflict-exit-code 75 "$K6_PROOF_LOCK_PATH" \
    ./scripts/run-proofs.sh --live --docs-ref "$DOCS_REF" <ROW> <SHA>
```

`--require-lock` lets a caller escalate a row whose manifest declares `sameSessionConcurrencySafe: true` but whose proof-round contract overrides it to serialized (for example `R-RC-2`). It can only **add** a lock requirement, never remove one, and sets `lockRequiredReason` to `caller-override` so the escalation is visible in the emitted variables.

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
- **message-body seat** (ronan-dgx default): bracket killed → PARTIAL-candidate

This is **declared in the manifest before the run**, not a post-hoc excuse. The `seatClassExpectation` block in `r-cd-token.json` states the expected outcome per seat class.

## Row coverage

`live-suite` currently resolves to 34 unattended rows. This table is generated from the manifest floor, but the outcome column is intentionally conservative: offline rows validate committed packets, and partial rows do not become accepted-path proofs just because they are runnable.

| Row | Scenario | Surface | Expected outcome |
|-----|----------|---------|------------------|
| PREFLIGHT | `preflight` | websocket/read-only inventory | PASS-candidate only after listed or disposable session preparation; setup gaps are NO-VERDICT |
| R-CD-1 | `r-cd-1-typed-delegate` | websocket/typed-tool | PASS-candidate; runnable candidate requiring row review |
| R-CD-2 | `r-cd-2-silent-wake` | websocket/typed-tool | PASS-candidate; runnable candidate requiring row review |
| R-CD-3 | `r-cd-3-post-compaction` | websocket/typed-tool | PARTIAL-candidate until a real lifeboat return proves PASS |
| R-CD-4 | `r-cd-4-target-session-key` | websocket/typed-tool | PASS-candidate; runnable candidate requiring row review |
| R-CD-CHAINED-DEPTH-2 | `r-cd-chained-depth-2` | websocket/typed-tool | PASS-candidate; runnable candidate requiring row review |
| R-CD-COLLECTION-ON-COLLAPSE | `static-corpus-row-validator` | offline/read-only | PASS-candidate; static committed-packet validator, no fresh gateway behavior |
| R-CD-MODEL-CHAINED-ALT | `r-cd-model-chained-alt` | websocket/typed-tool | PASS-candidate; runnable candidate requiring row review |
| R-CD-MODEL-DEFAULT | `r-cd-model-default` | websocket/mixed | PASS-candidate; runnable candidate requiring row review |
| R-CD-MODEL-TOKEN | `r-cd-model-token` | websocket/bracket-token | PASS-candidate; runnable candidate requiring row review |
| R-CD-MODEL-TOOL | `r-cd-model-tool` | websocket/typed-tool | PASS only from nonce-bound child model-call telemetry; bound mismatch FAIL; missing/ambiguous telemetry NO-VERDICT |
| R-CD-RETURN-OVERLAP | `r-cd-return-overlap` | offline/read-only | PASS-candidate; static committed-packet validator, no fresh gateway behavior |
| R-CD-SILENT | `r-cd-silent` | websocket/typed-tool | PASS-candidate; runnable candidate requiring row review |
| R-CD-TOKEN | `r-cd-token-bracket-delegate` | websocket/bracket-token | PASS-candidate; runnable candidate requiring row review |
| R-CONFIG-INTERSESSION | `r-config-intersession` | websocket/read-only | PASS-candidate; runnable candidate requiring row review |
| R-CONFIG-DEFAULTS | `r-config-defaults` | websocket/read-only | PASS-candidate; runnable candidate requiring row review |
| R-CW-1 | `r-cw-1-tool-schedule-wake` | websocket/typed-tool | PASS-candidate; runnable candidate requiring row review |
| R-CW-2 | `r-cw-2-immediate-wake` | websocket/typed-tool | PASS-candidate; runnable candidate requiring row review |
| R-CW-3 | `r-cw-3-reason-telemetry` | websocket/typed-tool | PARTIAL-candidate until reason telemetry/redaction review closes |
| R-CW-4 | `r-cw-4-chain-depth` | websocket/typed-tool | PASS-candidate; runnable candidate requiring row review |
| R-CW-5 | `run-cost-cap-fixture.mjs` | process-local/typed-tool | PARTIAL-candidate; exact-candidate fixture, review required before fold |
| R-CW-6 | `run-max-chain-fixture.mjs` | process-local/typed-tool | PASS-candidate component evidence; manual-only exact-candidate fixture, review required before fold |
| R-CW-7 | `static-corpus-row-validator` | offline/read-only | PASS-candidate; static committed-packet validator, no fresh gateway behavior |
| R-CW-DELEGATE-CHILD-LIVE | `static-corpus-row-validator` | offline/read-only | PASS-candidate; static committed-packet validator, no fresh gateway behavior |
| R-CW-DELEGATE-SELF-CONTINUATION | `r-cw-delegate-self-continuation` | websocket/typed-tool | PASS-candidate; runnable candidate requiring row review |
| R-CW-DELEGATE-TOKEN | `static-corpus-row-validator` | offline/read-only | PASS-candidate; static committed-packet validator, no fresh gateway behavior |
| R-CW-MULTI | `static-corpus-row-validator` | offline/read-only | PASS-candidate; static committed-packet validator, no fresh gateway behavior |
| R-CW-MULTI-COLLAPSE | `static-corpus-row-validator` | offline/read-only | PASS-candidate; static committed-packet validator, no fresh gateway behavior |
| R-CW-TOKEN | `r-cw-token-bracket` | websocket/bracket-token | PASS-candidate; runnable candidate requiring row review |
| R-OBS-1 | `r-obs-1` | websocket/typed-tool | PASS-candidate; runnable candidate requiring row review |
| R-OBS-2 | `r-obs-2` | offline/read-only | PASS-candidate; static committed-packet validator, no fresh gateway behavior |
| R-OBS-STATUS | `r-obs-status` | github-source-contract/#1172 | PASS-candidate; runnable exact-SHA status-line contract requiring row review |
| R-RC-1 | `r-rc-1-threshold-reject` | websocket/typed-tool | PASS-candidate only after explicit model/runtime preparation and an invocation-bound context_threshold toolResult; setup gaps are NO-VERDICT |
| R-RC-2 | `r-rc-2-delegate-request-compaction` | websocket/typed-tool | HONEST-LIMIT-candidate; reaches safe threshold/staging path, accepted compaction remains fixture-gated |
| R-REGRESSION-TRAP-TESTS | `r-regression-trap-tests` | offline/read-only | PASS-candidate; static committed-packet validator, no fresh gateway behavior |
| R-TRACE-REDACTION-1121 | `r-trace-redaction-1121` | offline/read-only | PASS-candidate; static committed-packet validator, no fresh gateway behavior |

`PREFLIGHT` remains a readiness row; its default listed-session path is
read-only and its opt-in disposable path changes only session control-plane
state. The runner also performs seat-readiness before live runs. Neither
readiness surface promotes a cap row.

`R-CW-5` and `R-CW-6` are also excluded from `--live-suite`: they are process-local, fixture-gated cap rows rather than unattended WebSocket rows. `R-CW-5A` and `R-CW-6A` are their static source/harness boundary checks; they emit only `construct-only`, never runtime R-CW-5/6 PASS evidence.

### R-CW-5 isolated cost-cap fixture

`tools/k6-proofs/scripts/run-cost-cap-fixture.mjs` is the safe runnable
component fixture for `R-CW-5`. It requires a clean exact-candidate source
worktree and its committed `pnpm-lock.yaml`, then creates a disposable
candidate worktree and runs `pnpm install --frozen-lockfile --prefer-offline`
there. It never trusts or mutates source `node_modules`, and writes only to an explicit artifact directory. It evaluates the exact
production `checkContinuationBudget` module at below/equal/over cap, then
runs the production dispatcher boundary suite to prove the over-cap hop does
not spawn and its flow is failed. Finally, it creates a short-lived detached
worktree of that exact candidate and exercises `runAgentAttempt` with the real
typed `continue_work` capture surface, a disposable session already at the
cost cap, and a zero-durable-work assertion. The temporary worktree is removed
before the result is emitted. It records readiness and cleanup receipts.

This is an equivalent runtime-level fixture, not a live-fleet-gateway
promotion: it does not create a gateway or modify fleet config/state. It
closes the prior static-only gap by covering the real typed tool capture and
post-turn scheduler path, but the row remains `PASS-candidate` pending human
review and corpus fold.

#### Runtime trace packet

The fixture is deliberately anchored at the exact candidate rather than a
copy of its cap predicate. On `6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d`,
GitNexus maps `checkContinuationBudget` to three direct callers:
`dispatchToolDelegates`, `dispatchStagedPostCompactionDelegates`, and
`scheduleContinuationWork`. Its impact walk also reaches child-queue drain
and delegate recovery paths. This is why the fixture covers both the
production predicate and the dispatcher boundary; a change to the shared
check has a continuation-wide blast radius, not only a single k6 row.

Capture the trace packet against the candidate before reviewing a run:

```bash
gitnexus query --repo openclaw-6ee7eca \
  'checkContinuationBudget accumulatedChainTokens cost cap'
gitnexus context --repo openclaw-6ee7eca checkContinuationBudget
gitnexus impact --repo openclaw-6ee7eca checkContinuationBudget
```

The expected component receipt shape at `--cap 100` is `99: allow`,
`100: allow`, `101: cost-capped`, plus dispatcher assertions for over-cap
no-spawn and failed-flow persistence, and a typed-tool receipt that confirms
two exhausted elections create no durable continuation work. A component
PASS-candidate never reclassifies the live row as PASS without review.

### R-CW-6 isolated max-chain fixture

`tools/k6-proofs/scripts/run-max-chain-fixture.mjs` is the safe manual-only
component fixture for `R-CW-6`; it is intentionally outside the generic k6
runner and `--live-suite`. It requires a clean exact-candidate source
worktree, detached candidate worktree, exact fixed `pnpm@<semver>` declaration,
and aligned installed dependency tree; it refuses tags/ranges, package-manager
version mismatch, lockfile/tree/metadata mismatch, virtual-store escape,
indirect source dependencies, reused or symlinked artifact paths, wrong SHAs,
and dirty tracked source. The production predicate, durable scheduler, temporary session
store recovery, typed `continue_work` registration/executor path, TaskFlow no-spawn check, and
selected-max delegate dispatch boundary all run inside one detached disposable candidate
worktree without a gateway or fleet mutation. The fixture first requires the
candidate's committed `package.json` and `pnpm-lock.yaml`, runs `pnpm install
--frozen-lockfile --prefer-offline --ignore-scripts` inside that detached worktree,
checks the installed virtual-store lock bytes/SHA-256, `.modules.yaml`
package-manager and virtual-store metadata, and invokes
only its absolute `node_modules/.bin/tsx` and `node_modules/.bin/vitest`
binaries; source-tree `node_modules` is ignored. Before the final result is
written, candidate SHA/tracked-state checks run immediately after install and
again after all proof surfaces, and every
receipt is checked to exclude private paths and
secret/session/environment/process-output fields. The host PATH `pnpm` is
version-checked rather than hermetically attested, so this is explicit
lockfile/tree/version alignment—not a cryptographic or hermetic host-toolchain
claim.

At the default maximum `3`, the required receipt shape is attempted hop `2`:
allow, attempted hop `3`: allow, attempted hop `4`: `chain-capped`. The
rejected election must leave the durable flow count and chain count unchanged;
the persisted count must reload as `3` and remain capped. The disposable
worktree/state must be removed and `public-artifact-safety.json` must pass
before `fixture-result.json` can say `PASS-candidate`. See
[`docs/R-CW-6-ISOLATED-MAX-CHAIN.md`](docs/R-CW-6-ISOLATED-MAX-CHAIN.md).

Future manifests may again be `scaffold`, `construct-only`, or `orchestration-required`. Such rows are tracked, but not workflow-runnable until a matching scenario exists and the manifest is promoted to `scenario.status="runnable"` plus `liveRunSafety.classification="k6-runnable"`.

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

# Same, escalating a contract-overridden row to serialized, as shell exports to eval
node tools/k6-proofs/scripts/live-run-guard.mjs --manifest tools/k6-proofs/manifests/r-rc-2.json --shell --require-lock

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

### Repository-root contract for catalog validators (#495)

`check-manifest-scenarios.mjs`, `check-scenario-alignment.mjs`, and
`check-proof-row-manifests.mjs` share one repository-root contract
(`tools/k6-proofs/lib/repo-root.mjs`) and join `tools/k6-proofs` exactly once.
The root is resolved in this order:

1. `--repo-root <dir>`;
2. `OPENCLAW_PROOFS_REPO_ROOT`;
3. the nearest ancestor-or-self of the working directory containing
   `tools/k6-proofs`.

Because of rule 3, running a validator from the repository root, from
`tools/k6-proofs`, or from `tools/k6-proofs/scripts` inspects the same files and
produces identical output and exit status. Standing outside any harness is an
explicit contract error, never a silently empty catalog.

### Immutable harness identity for live matrices (#496)

`scripts/run-proofs.sh` runs the three catalog validators as a preflight before
any row executes. The validators run with the gateway token and session material
stripped from their environment (unproven harness code must never see live
credentials), and their captured output is scrubbed of local filesystem
locations before it is published as `catalog-preflight.log`. A preflight failure
is classified as harness infrastructure: the runner writes one
`harness-control-receipt.json` under the artifact root, executes no rows,
synthesizes no per-row verdict, and exits `78`. Only validated values reach that
receipt — rejected operator input is recorded as `malformed`, never echoed.

A live run additionally refuses to fire unless an approved docs/harness ref is
supplied through `--docs-ref <40-hex>` or `OPENCLAW_PROOFS_DOCS_REF`, and:

- the ref is a 40-character lowercase SHA;
- repository `HEAD` equals that ref;
- every tracked file under `tools/k6-proofs`, `PROOFS`, and `.github` hashes to
  the blob recorded in that commit — the proof corpus is included because static
  rows read it, so a locally modified corpus must not be able to produce a
  candidate verdict;
- every selected runnable row's manifest and scenario are tracked at that exact
  commit with matching bytes.

The tree check hashes working-tree bytes with `git hash-object` and compares them
to `git ls-tree` of the approved commit. `git status` is deliberately not used:
it consults the index, so an `assume-unchanged` or `skip-worktree` entry could
hide a modified shared library that a scenario imports.

Verification runs in ordered stages so that no unproven byte is executed and no
catalog is parsed before it is validated:

1. **byte-only identity** — ref shape, `HEAD` equality, candidate SHA shape,
   repository identity, and the full tracked-tree hash comparison. No manifest is
   parsed here.
2. **immutable snapshot** — every consumed tree (`tools/k6-proofs`, `PROOFS`,
   `.github`) is extracted with `git archive` into a private temporary directory,
   and the runner then hands execution to that extract's own `run-proofs.sh`
   with `exec`, before any credential is loaded or any external tool is invoked.
   Every harness component (the runner itself, the catalog validators, seat
   readiness, k6, scenarios and their imports, the evidence/receipt helpers) and
   every corpus byte a static row reads therefore comes from bytes that cannot
   change once the matrix has started. Nothing is symlinked back to the
   operator's checkout. The re-executed copy proves it really is the snapshot's
   own runner, that the snapshot is a distinct tree from the checkout, and that
   the snapshot matches the approved ref, before trusting any of it.
3. **catalog preflight** — the three validators run from the snapshot under
   `env -i` with a minimal allowlist.
4. **row selection and contract binding** — `all` expansion and the per-row
   manifest/scenario digest freeze, on a catalog the validators have approved. A
   selected row with no manifest at the approved ref fails closed rather than
   being silently skipped.

The gateway token, the deployed runtime stamp and the session key are all
resolved only inside the verified snapshot runner, after those stages complete.
The bootstrap phase — the copy of the runner the operator invoked — parses
arguments, resolves roots, verifies bytes, extracts the snapshot and hands off.
It reads no credential and invokes no product tooling, though it does of course
use `git`, `jq`, `tar` and coreutils to do that work. A gateway token already
exported by the caller is inherited by that process by construction and cannot be
dropped from inside the same script.

The handoff is authenticated rather than trusted: the re-executed process must be
the snapshot's own runner, the snapshot must be a distinct tree outside the
checkout, and it must carry an unguessable ownership sentinel written by the
process that created it. A claimed snapshot failing any of those checks is never
adopted, and therefore never becomes eligible for cleanup.

The tree comparison is repeated before each row against both the snapshot and the
operator's checkout. The snapshot side proves the executing bytes are still the
approved ones; the checkout side reports that the operator's tree has drifted
from the ref the matrix is bound to. Either fails closed as infrastructure.

Failure receipts and provenance carry only validated values; the snapshot path,
the checkout path, the artifact root and `$HOME` are replaced with placeholders
in any captured text that becomes a public artifact.

All identity `git` calls run with `--no-replace-objects` / `GIT_NO_REPLACE_OBJECTS=1`
and with ambient `GIT_DIR`/`GIT_WORK_TREE`-style overrides cleared, so a
`refs/replace/*` entry cannot make `rev-parse` and `cat-file` describe different
trees.

The ref is resolved and frozen once at startup; ambient `HEAD` is never re-read
after rows have run. Because k6 and the scenario read the working tree at row
time, the frozen digests are re-asserted immediately before capture and again
immediately before k6 executes, and the copied artifacts are checked against
them — a mid-matrix mutation fails closed as infrastructure rather than
producing a receipt for unapproved source. `OPENCLAW_ROW_MANIFEST` points at the
verified copy in the run directory, not at the mutable worktree manifest.

The runner then writes a public-safe `harness-provenance.json` (matrix id, docs
ref, repository identity, candidate SHA, runtime identity receipt, runner script
digest, row selection with per-row manifest/scenario digests, start time) before
the first row fires, plus an immutable per-matrix copy at
`harness-provenance/<matrixId>.json` so a reused artifact root cannot lose the
provenance of rows an earlier matrix wrote. Every `runner-metadata.json` records
`docsRef`, `repository`, `matrixId`, `manifestPath`/`manifestSha256`, and
`scenarioPath`/`scenarioSha256`. The exact scenario source travels with each
receipt as `row-scenario.js`, and the candidate routing envelope is withheld
unless those values bind to the approved ref and the copied manifest/scenario
bytes.

Set `OPENCLAW_PROOFS_DOCS_REPOSITORY=<owner>/<repo>` when the checkout has no
public remote; only a real remote (or that override) is accepted, so a local
clone path can never reach a public receipt.

## Coordination

- Epic: [#106](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/106)
- Row issue: [#103](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/103)
- Foundation: [#100](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/100) (artifact layout by Emeric)
- Coordinator: @silas-dandelion-cult
- Project: [karmaterminal project 81](https://github.com/orgs/karmaterminal/projects/81)
