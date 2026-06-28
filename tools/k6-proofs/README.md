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

- [Grafana k6](https://grafana.com/docs/k6/latest/get-started/installation/) installed on the run seat. The proof-standard expectation is `v2.0.0` unless a row issue explicitly says otherwise.
- A running OpenClaw gateway on the local seat.
- Run `node tools/k6-proofs/scripts/seat-readiness-preflight.mjs` before treating row output as proof-standard. A version/env/gateway mismatch is `HONEST-LIMIT-candidate`, not product failure.
- Environment variables:
  - `OPENCLAW_GATEWAY_WS` — WebSocket URL (default: `ws://127.0.0.1:18789`)
  - `OPENCLAW_GATEWAY_TOKEN` — operator auth token (**required, never in source**)
  - `OPENCLAW_SESSION_KEY` — target session key (default: `main`)
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

- k6 binary path and version, compared to the documented expectation (`v2.0.0` by default)
- gateway health/status reachability shape
- candidate SHA validity, seat name/class, and coarse session scope
- required env-var presence as booleans only
- whether the check is safe to run concurrently

If k6 is missing, the version differs, required env is absent, or gateway health/status is unreachable, treat row output as `HONEST-LIMIT-candidate` / setup failure until the seat is fixed. Do not fold it as product behavior evidence. Use `--no-gateway` only for offline docs/schema checks; live proof rows need a checked gateway.

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
- `r-cd-2-silent-wake`
- `r-cd-4-target-session-key`
- `r-cd-chained-depth-2`
- `r-cw-1`
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

## Metrics and dashboard contract

Public-safe visualization fields for Project 81 live in [`METRICS.md`](./METRICS.md). Treat that file as the contract for Grafana / Prometheus / postprocess ingestion: candidate outcome, `proof_failures`, duration, receipt status, and review-pending state are allowed; tokens, session keys, prompts, nonces, raw events, and raw responses are not.

## Design principles

### Manifest-driven scenarios (data/logic separation)

Row-specific configuration lives in **manifests** (`tools/k6-proofs/manifests/*.json`), not hardcoded in scenario logic. Scenarios load their manifest at init time via `OPENCLAW_ROW_MANIFEST` env var.

Manifests use `${ENV_VAR:-default}` placeholders resolved at runtime — no secrets or seat-specific values baked into source.

Manifests follow the schema defined by #100 (foundation): `openclaw.k6.proof-row-manifest.v1`.

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
| R-CD-2 | `r-cd-2-silent-wake` | typed-tool | PASS-candidate when dispatch/session-events observed and no channel delivery appears |
| R-CD-4 | `r-cd-4-target-session-key` | typed-tool | Candidate; verify target-vs-parent session events, not `tasks.list` |
| R-CD-CHAINED-DEPTH-2 | `r-cd-chained-depth-2` | typed-tool | Candidate; verify nonce-correlated chain return on subscribed session stream |
| R-CD-COLLECTION-ON-COLLAPSE | planned `r-cd-collection-on-collapse` | typed-tool | Scaffold; A→B→C detached-intermediate collapse with root collection + no-orphan guard |
| R-CD-MODEL-DEFAULT | planned `r-cd-model-default` | mixed | Scaffold; tool + bracket/token no-override inheritance contrast row |
| R-CD-MODEL-TOOL | planned `r-cd-model-tool` | typed-tool | Scaffold; explicit model override request byte must match observed child model byte |
| R-CD-MODEL-TOKEN | planned `r-cd-model-token` | bracket-token | Scaffold; bracket `model=` modifier parse + observed child model byte |
| R-CD-MODEL-CHAINED-ALT | planned `r-cd-model-chained-alt` | typed-tool | Scaffold; depth-2 delegate observes explicit alternate model |
| R-CW-1 | `r-cw-1` | typed-tool | Candidate; continue_work schedule + wake |
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

# Validate every PROOFS/<sha>/ that has a manifest; legacy short-SHA dirs are skipped
node tools/k6-proofs/scripts/validate-corpus.mjs --all

# Validate PROOFS/INDEX.json consistency vs the manifest it points to
node tools/k6-proofs/scripts/validate-corpus.mjs --index

# Machine-readable
node tools/k6-proofs/scripts/validate-corpus.mjs --index --json

# Validate row-manifest scenario registry status vs runnable scenario files
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs

# Validate workflow scenario choices and row-manifest scenario alignment
node tools/k6-proofs/scripts/check-scenario-alignment.mjs
```

Checks: JSON parse, schema sanity (`openclaw.proofs.index.v1` /
`openclaw.proofs.manifest.v1`), every declared `evidence_doc` and `rows[].dir`
exists, no orphan row dirs, INDEX `rollup` tallies match the manifest `rows[].state`
counts, manifest `capture_sha` matches its directory name, and no stale
`pending_push` / `upload-blame` / `TODO-UPLOAD` wording. Exit code is non-zero
on any failure; the script never mutates corpus data.

`check-manifest-scenarios.mjs` is the row-harness registry check: runnable
manifests must point at an existing `tools/k6-proofs/scenarios/*.js`; rows with
no runnable file must say `scenario.status` is `scaffold` or `construct-only`.

## Coordination

- Epic: [#106](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/106)
- Row issue: [#103](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/103)
- Foundation: [#100](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/100) (artifact layout by Emeric)
- Coordinator: @silas-dandelion-cult
- Project: [karmaterminal project 81](https://github.com/orgs/karmaterminal/projects/81)
