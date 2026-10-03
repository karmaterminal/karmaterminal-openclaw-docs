---
name: k6-proofs
description: Author or change a k6 proof row (row manifest plus k6 scenario under tools/k6-proofs) for the OpenClaw continuation proof corpus. Use when adding a row, writing or fixing a scenario or row manifest, naming its metrics, wiring nonce, redaction and both-forms (tool + token) receipts, or validating and first-firing a new row, for example 'add an R-CW row', 'write the k6 scenario for R-CD-4' or 'check-manifest-scenarios fails'. Keeps new rows on the manifest-driven WebSocket harness and passing its offline catalog checks. For dispatching, triaging or publishing a whole corpus use openclaw-dev:run-k6-proofs from the scribe-prince-shared marketplace instead.
---

# k6 PROOFS Skill

## Purpose
Build, run, and maintain k6 proof-row scenarios for the OpenClaw continuation feature behavioral corpus. This skill enables any prince or coding agent to create new proof scripts, run them against the fleet, and capture evidence for the PROOFS corpus.

This file is the single k6 authoring skill. Paths below are relative to the root of
`karmaterminal/karmaterminal-openclaw-docs`. `tools/k6-proofs/README.md` stays the reference
for running rows, and `tools/k6-proofs/CONTRIBUTING-ROWS.md` the checklist for a row PR.

## Where things live

| Need | Where |
| --- | --- |
| Author or change a row: manifest, scenario, row docs | this skill, under `tools/k6-proofs/` |
| Row PR checklist and the evidence files a row dir needs | `tools/k6-proofs/CONTRIBUTING-ROWS.md` |
| Row registry, pipeline and mandates in one parse | `tools/k6-proofs/k6-proofs-pipeline.xml` |
| Corpus method and fold rules | `RUNBOOKS/PROOF-CORPUS-METHOD.md` |
| Dispatch from this repo | `.github/workflows/k6-proof.yml` (one row), `.github/workflows/project81-k6-proof.yml` (row lists, self-hostable) |
| Run, triage and publish a corpus | `openclaw-dev:run-k6-proofs` in the `karmaterminal/scribe-prince-shared` marketplace |
| Runner and config workflow glue for the frond's seats | `karmaterminal/openclaw-bootstrap`: its `project81-k6/` directory, `scripts/project81-k6-proof/run.sh` and its own `project81-k6-proof.yml` workflow |

The last two repositories are private to the frond; the paths in their rows are paths in those
repositories, not here. Loaders reach this file two ways: `.agents/skills/k6-proofs/SKILL.md` is a
pointer to it (OpenClaw and other `.agents/skills` readers), and `.claude/skills/k6-proofs` is a
symlink to this directory (Claude Code).

## Components

### Infrastructure (resolve per seat before proof-standard runs)
- **k6** — proof-standard expectation is `v2.0.0`; run `node tools/k6-proofs/scripts/seat-readiness-preflight.mjs --json` on the target seat before folding evidence.
- **Prometheus** — metrics store for candidate rows; set `OPENCLAW_PROOFS_PROMETHEUS_BASE_URL` / `OPENCLAW_PROOFS_PROMETHEUS_RW_URL` for non-fleet runs (fleet default: `prometheus.dandelion.cult`).
- **Grafana** — dashboards (contract in `tools/k6-proofs/METRICS.md`; JSON in `tools/k6-proofs/dashboards/k6-proofs.json`).
- **Loki** — log aggregation for nonce-correlated journal receipts; set `OPENCLAW_PROOFS_LOKI_BASE_URL` for non-fleet runs.
- **Tempo** — distributed tracing; a public-safe trace projection is the proof surface for continuation spans; set `OPENCLAW_PROOFS_TEMPO_BASE_URL` for non-fleet runs.
- **Alloy / OTel Collector** — forwards logs and traces from seats into Loki/Tempo.

### Repo Structure
```
tools/k6-proofs/
├── README.md                       — reference for running rows + runnable scenario list
├── CONTRIBUTING-ROWS.md            — row PR checklist
├── row-manifest.schema.json        — row manifest schema (openclaw.k6.proof-row-manifest.v1)
├── run-proof.sh                    — runner for workflow-runnable scenario basenames
├── lib/
│   ├── gateway-ws.js               — WS helpers, request tracking, nonce/redaction boundary
│   └── manifest-loader.js          — row-manifest loading + env placeholder resolution
├── manifests/                      — row manifests (broader than runnable scenario coverage)
├── scenarios/                      — k6 scenarios currently promoted to runnable
├── scripts/                        — seat preflight, catalog checks, evidence writer, postprocessor, corpus validator
├── dashboards/                     — Grafana dashboard JSON
├── docs/                           — golden path / safety / regression-trap notes
└── skill/
    └── SKILL.md                    — this skill

.agents/skills/k6-proofs/SKILL.md   — pointer to this skill for .agents/skills loaders
.claude/skills/k6-proofs            — symlink to tools/k6-proofs/skill/ for Claude Code
tools/k6-proofs/k6-proofs-pipeline.xml — structured one-shot decision tree
```

## How to Build a New Proof Row

A row is a manifest (the declaration of record) plus the k6 scenario it names. Write the
manifest first; scenarios read it at init time.

### 1. Identify the Row
Check `tools/k6-proofs/k6-proofs-pipeline.xml`, `tools/k6-proofs/CONTRIBUTING-ROWS.md`, and the Project-81 issue for the row definition:
- Row name (e.g., `R-CD-2`)
- Expected behavior
- Owner assignment
- Required evidence shape

Claim the labelled Project-81 issue before doing row work.

### 2. Write the Row Manifest
Copy the closest existing manifest to `tools/k6-proofs/manifests/<row>.json`, for example
`tools/k6-proofs/manifests/r-cw-2.json` for a typed-tool WebSocket row.
- `schema` is `openclaw.k6.proof-row-manifest.v1`; the shape and required fields are in
  `tools/k6-proofs/row-manifest.schema.json`. `review.candidateOnly` and
  `review.foldRequiresReview` are always `true`.
- Seat, SHA and session values are `${ENV_VAR:-default}` placeholders. No secrets, ever.
- `scenario.status` is `runnable`, with `scenario.file` set to the scenario's basename under
  `tools/k6-proofs/scenarios/`. A row whose scenario does not exist yet is `scaffold` (the planned
  basename goes in `scenario.expectedFile`) or `construct-only` (no file at all), and
  `liveRunSafety.classification` `k6-runnable` requires `runnable`.
- A live row fills `liveRunSafety`: `foldRequiresReview` is always `true`, and every
  `requiredReceipts` entry except `seat-readiness` must name an `expectedReceipts` entry.
- A row whose required receipts include a telemetry receipt also declares `telemetryContract`
  (`tools/k6-proofs/docs/CONTINUATION-TELEMETRY-REMEDY-ROWS.md`).

### 3. Write the Scenario
Name it after the row in lowercase with hyphens, usually with what it proves
(`tools/k6-proofs/scenarios/r-cd-2-silent-wake.js` proves R-CD-2), and start from the closest
existing scenario, not a blank file:

| Row surface | Start from |
| --- | --- |
| typed-tool over WebSocket | `tools/k6-proofs/scenarios/r-cw-2-immediate-wake.js` (manifest `tools/k6-proofs/manifests/r-cw-2.json`) |
| bracket/token over WebSocket | `tools/k6-proofs/scenarios/r-cw-token-bracket.js` (manifest `tools/k6-proofs/manifests/r-cw-token.json`) |
| read-only over WebSocket | `tools/k6-proofs/scenarios/r-config-defaults.js` (manifest `tools/k6-proofs/manifests/r-config-defaults.json`) |
| offline, over committed receipts | set `scenario.file` to `static-corpus-row-validator.js` and add a validator for the row to the `validators` map in `tools/k6-proofs/scenarios/static-corpus-row-validator.js`, which fails any row it has no validator for; `tools/k6-proofs/manifests/r-cw-7.json` and `validateRcw7` are the example |
| cap exhaustion (R-CW-5, R-CW-6) | not a k6 scenario; see Caps-Test Procedure below |

Every scenario keeps these properties; the gateway and nonce rules are for live rows:
- **Manifest-driven.** Load config with `loadManifestFromEnv()` and `validateManifest()` from
  `tools/k6-proofs/lib/manifest-loader.js`; `OPENCLAW_ROW_MANIFEST` selects the manifest.
- **Gateway over WebSocket (live rows).** `k6/ws` with `connectFrame()`, `RequestTracker` and
  `nonce()` from `tools/k6-proofs/lib/gateway-ws.js`. The target comes from `OPENCLAW_GATEWAY_WS`
  and the token only from `OPENCLAW_GATEWAY_TOKEN`. Responses are
  `{ type: "res", id, payload?, error? }`, not `{ result }`.
- **Redacted.** Store event payloads only through `redactEvent()`; the post-processor refuses
  evidence that carries raw `events` without `redacted_events`.
- **Nonce per fire (live rows).** A fresh `nonce()` and idempotency key for every fire. Where the
  row prompts an agent, ignore harness prompt echoes, so a sentinel only counts when the agent
  produced it.
- **Single VU, serialized.** `shared-iterations` with one VU and one iteration, a `maxDuration`,
  and, over WebSocket, a socket timeout that closes the connection.
- **Metrics.** A `proof_failures` Counter with threshold `count==0`, plus a duration Trend named
  after the row (`R-CW-2` → `r_cw_2_duration`). See Custom Metrics Naming below.
- **Candidate verdicts.** `PASS-candidate`, `PARTIAL-candidate` or `FAIL-candidate`, plus
  `HONEST-LIMIT-candidate` or `construct-only` where the manifest's
  `liveRunSafety.expectedArtifactClass` declares one. Nothing a scenario writes is a final
  verdict, and folds go through review.

### 4. Check It Offline
From the repository root, with no gateway and no secrets:
```bash
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs
node tools/k6-proofs/scripts/check-scenario-alignment.mjs
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs
node tools/k6-proofs/scripts/check-telemetry-contracts.mjs
node --test tools/k6-proofs/scripts/__tests__/*.test.mjs
```

To make a runnable row dispatchable from `.github/workflows/k6-proof.yml`, add its scenario
basename to that workflow's `scenario` choices; `check-scenario-alignment.mjs` rejects a choice
that has no scenario file.

### 5. Run It
Before any command below, export the environment from `tools/k6-proofs/README.md`, "Seat
readiness / version preflight", and keep that shell through step 6. Every command here reads it:
the preflight signs its receipt over these values with the token, and the evidence writer accepts
that receipt only while the same values, the token included, are still set. One-command
`VAR=value` prefixes drop them between commands, and with `OPENCLAW_GATEWAY_WS` unset most
scenarios connect to `ws://127.0.0.1:18789`, which need not be the gateway the receipt checked.
```bash
# From the repository root, with the README's placeholders filled in
export OPENCLAW_GATEWAY_TOKEN="***"
export OPENCLAW_GATEWAY_WS="ws://127.0.0.1:<isolated-port>"
export OPENCLAW_GATEWAY_UNIT="<isolated-unit>"
export OPENCLAW_SEAT_NAME="<seat>"
export OPENCLAW_SESSION_KEY="<target-session>"
export OPENCLAW_CANDIDATE_SHA="<40-char-sha>"
export OPENCLAW_RUNTIME_SHA="<40-char-runtime-sha>"   # what the gateway runs; must equal the candidate
export OPENCLAW_DOCS_SHA="<40-char-docs-sha>"
export OPENCLAW_SELECTED_ROWS="R-CW-2"
export OPENCLAW_REQUIRED_MAX_SPAWN_DEPTH="2"
export OPENCLAW_EXPECTED_MAX_SPAWN_DEPTH="<expected-depth>"
export OPENCLAW_ROW_MANIFEST="$PWD/tools/k6-proofs/manifests/r-cw-2.json"

# Seat readiness on the firing seat; keep the receipt for step 6
node tools/k6-proofs/scripts/seat-readiness-preflight.mjs --json > /tmp/seat-readiness.json

# Fail-closed guard; run-proof.sh runs it again before k6
node tools/k6-proofs/scripts/live-run-guard.mjs --manifest "$OPENCLAW_ROW_MANIFEST" --json

# Full runner path; use a promoted scenario basename
./tools/k6-proofs/run-proof.sh r-cw-2-immediate-wake 2>&1 | tee /tmp/r-cw-2-output.txt
```
A preflight mismatch is setup state, not product evidence.

`OPENCLAW_ROW_MANIFEST` is absolute on purpose. The guard reads it from the working directory, but
`tools/k6-proofs/lib/manifest-loader.js` prefixes a relative value with `../` and k6 opens it from
`tools/k6-proofs/scenarios/`, so a path written from the repository root is not found.

### 6. Commit Evidence
After a successful run on the target SHA, in the same shell:
```bash
node tools/k6-proofs/scripts/evidence-writer.mjs \
  --input /tmp/r-cw-2-output.txt \
  --row R-CW-2 \
  --seat "$OPENCLAW_SEAT_NAME" \
  --sha "$OPENCLAW_CANDIDATE_SHA" \
  --seat-readiness /tmp/seat-readiness.json \
  --manifest "$OPENCLAW_ROW_MANIFEST"
# Review the candidate run directory, add public-safe trace/log receipts, then fold intentionally.
```

The writer checks the receipt's signature with `OPENCLAW_GATEWAY_TOKEN`, compares its SHAs,
gateway, unit, selected rows and spawn depths with the values still exported, and compares
`--seat`, `--sha` and `--row` with its seat, candidate and selected rows; any difference rejects
the receipt. The `outcome` the writer puts in `row-result.json` comes only from the delegate
fields `tool_accepted`, `prompt_sent`, `task_created` and `child_spawned`, which R-CW-2 does not
print, so for R-CW-2 it is `FAIL-candidate` whatever the run did; take that row's verdict from the
scenario's `VERDICT:` line, as `tools/k6-proofs/scripts/run-proofs.sh` does. The writer refuses
R-CD-2, which `run-proofs.sh` handles with its own authority context and receipt resolver.

## Key Patterns

### Evidence Correlation
The gateway doesn't expose a REST API for delegate dispatch — delegates fire via the agent's tool surface. The k6 harness verifies infrastructure readiness and captures evidence post-run:
1. **Journal/Loki grep** — query the gateway journal or Loki for the nonce window; do not commit secrets.
2. **Tempo trace pull** — export the public-safe trace projection for the trace id; summarize span tree separately.
3. **Session/event receipt** — use redacted `sessions.messages.subscribe` / response receipts where the row depends on session delivery.

### Both-Forms Mandate
Every continuation row must prove BOTH the typed tool path AND the bracket/token path:
- Tool: `continue_work()` / `continue_delegate()` / `request_compaction()`
- Token: `CONTINUE_WORK` / `CONTINUE_WORK:N` / `[[CONTINUE_DELEGATE: ...]]`

(`request_compaction` is tool-only — no token form.)

### Caps-Test Procedure
R-CW-5 and R-CW-6 hit their boundaries through exact-candidate process-local
fixtures, not live fleet mutation:

1. Run `tools/k6-proofs/scripts/run-cost-cap-fixture.mjs` for R-CW-5 or
   `tools/k6-proofs/scripts/run-max-chain-fixture.mjs` for R-CW-6.
2. Require the row-specific boundary, no-spawn, readiness, and cleanup
   receipts; R-CW-6 additionally requires durable recovery, typed-tool,
   selected delegate-boundary, and public-artifact-safety receipts.
3. Keep the result review-required; never infer a gateway claim or automatic
   corpus fold from the component fixture.

Only a future row whose manifest and runbook explicitly authorize live config
mutation may lower `openclaw.json`; that row must record originals, arm a
failure-safe restore, apply/reload, hit the cap, restore, and verify baseline.

### Custom Metrics Naming
Every scenario counts failures in the shared `proof_failures` Counter, which the exporter turns
into `openclaw_proofs_k6_proof_failures_total` with `row_id`, `seat`, `candidate_sha` and
`scenario` labels (`tools/k6-proofs/METRICS.md`), so row filtering comes from labels.
Row-specific metrics, such as the duration Trend, carry the row name in lowercase with
underscores: `r_cd_1_duration`. Prometheus names allow only `[a-zA-Z0-9_]`, so keep the
hyphenated form for the row id and the underscored form inside metric names. Never put nonces,
session keys or prompt text in a metric name or tag.

## Project Tracking
- **EPIC**: #106
- **Issues**: Project 81 issues in `karmaterminal/karmaterminal-openclaw-docs`, labelled `proofs:k6`, a `proofs:<category>` label (e.g. `proofs:scenario`), a `row:<family>` label (e.g. `row:continue-work`) and `owner:<prince>`
- **Project Board**: [P81](https://github.com/orgs/karmaterminal/projects/81)
- **Row registry**: `tools/k6-proofs/k6-proofs-pipeline.xml`, row manifests, and per-SHA `PROOFS/<sha>/proofs-manifest.json`

Discord is for discussion; the Project-81 board and committed artifacts are the coordination of record.

## Dependencies
- k6 binary present on the target seat at the expected version
- Gateway running on target seat
- Observability stack reachable for the evidence surfaces the row claims

## Maintaining This Skill
Edit this file, not the pointer. When the frontmatter changes, copy it to
`.agents/skills/k6-proofs/SKILL.md` unchanged. Then run
`node tools/k6-proofs/scripts/check-k6-skill.mjs`: it parses both frontmatter blocks with a
line parser and with PyYAML, keeps `description` within 1024 characters with its first sentence
inside 160, checks that both entry points still reach this file, and fails on any repository
path here that does not exist.
