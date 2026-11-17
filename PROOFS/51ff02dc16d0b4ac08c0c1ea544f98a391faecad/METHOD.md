# Method

Canonical process: `RUNBOOKS/PROOF-CORPUS-METHOD.md` in openclaw-bootstrap (read at `6c69972432f0cb4d310e3a4f3317cea4284aeaab`), plus the frond's `run-k6-proofs` and `build-openclaw-proof-corpus` skills. Where this lane's workorder differs from the runbook (for example, it asks for a docs PR rather than a direct fold, and does not repoint `PROOFS/INDEX.json`), the workorder governs.

## Shape: mirror the prior live corpus on a live gateway

Per 🕯's dispatch spec (Discord msg 1572215081729658963):

- Rows hit emeric's **live** fleet gateway over `gateway_ws` = `ws://127.0.0.1:18789`. The Actions runner runs on emeric, so this is localhost. There is no separate proof unit, so the run proves the same runtime and state shape the fleet serves. `gateway_unit` = `openclaw-gateway`.
- `session_selector` = `agent:main:proof-disposable-ab5a30ea`, a lane-unique scratch selector (scope `main-agent-session`, not the prince's room session). `create_disposable_sessions=true`.
- `openclaw_alt_model` is unset for the main run. The three alt-model rows (`R-CD-MODEL-TOOL`, `R-CD-MODEL-TOKEN`, `R-CD-MODEL-CHAINED-ALT`) are held out of it and fired once, in a separate slice, with `openclaw_alt_model=openai/gpt-5.6-sol`. That is the fully qualified model all three prior emeric corpora recorded (`f15237ec`, `08c37a15`, `293c977f`: `requested_model_byte` = `openai/gpt-5.6-sol`). On emeric it is in the model allowlist and is not the default model (default provider: `github-copilot`). Booleans only were read; no config contents were printed.
- `required_max_spawn_depth=2`, `expected_max_spawn_depth=5` (emeric `agents.defaults.subagents.maxSpawnDepth` = 5), `seat_name=emeric`, `runner_labels_json=["self-hosted","emeric"]`, `metrics_push=false`.

## Binding: candidate_sha = runtime_sha = ab5a30ea

The workorder named `candidate_sha=51ff02dc…` and `runtime_sha=ab5a30ea…`. Those inputs cannot fire, because four fail-closed gates require candidate == runtime:

1. `project81-k6-proof.yml`: "runtime_sha must exactly equal candidate_sha when dry_run=false".
2. `seat-readiness-preflight.mjs`: note `candidate-runtime-sha-mismatch`, so the receipt is never sealed.
3. `target-readiness.mjs:454`: receipt validation rejects `candidateSha !== runtimeSha`.
4. `run-proofs.sh` R-CD-TOKEN pre-dispatch build-identity gate: PARTIAL-candidate with no dispatch.

Readiness also requires the gateway's own `buildId` to contain the runtime SHA prefix (`target-readiness.mjs:312`), so the runtime binding must be `ab5a30ea`.

The rows were therefore fired with `candidate_sha` = `runtime_sha` = `ab5a30ea79b776f149e24b1fccab9e79b0a5d299`. They are published here at the presented slice SHA `51ff02dc`, with `exact_target_execution=false`. This is the `PROOFS/3821eaef…` composite-carrier precedent: its METHOD reads "candidate_sha must equal the deployed runtime build … which is why the composite SHA appears as the execution identity while this corpus is published at the presented continuation SHA". No gate was weakened. The fork was surfaced to the cohort as a TROUBLE receipt before any row fired.

## Pre-fire checks (2026-11-17, before any row fired)

- **Seat.** On emeric: `build-info.commit` == `ab5a30ea…`, `HEAD` == `ab5a30ea…`, clean, 17 package dists. `openclaw-gateway.service` active, `NRestarts=0`, `/health` 200. `diagnostics-otel` is bundled (`dist/extensions/diagnostics-otel/index.js`) and enabled (`plugins.entries.diagnostics-otel.enabled=true`, `diagnostics.otel` present with `enabled=true`). k6 v2.0.0 at `~/bin/k6`.
- **Observability.** Tempo `/ready` was briefly `503` ("ingester … waiting for 15s after being ready") and then `ready` on three consecutive reads. Tempo search returned emeric's `emeric-prince` traces from the preceding minute. Loki and Prometheus were ready, and OTLP intake on `otel.dandelion.cult:4318` answered 200.
- **Harness at docs `9ba5518b`.**
  - `node --test tools/k6-proofs/scripts/__tests__/*.test.mjs`: 976/979. The 3 failures are the known pre-existing `PROOFS/INDEX.json` drift reds (`current-corpus-active-scope` ×2, `harness-provenance-runner` "a mutated proof corpus cannot produce a candidate verdict"), unchanged since docs `7ca06bdb`.
  - `node --test tools/k6-proofs/tests/*.test.mjs`: 349/349.
  - `bash -n run-proofs.sh`: OK. `git diff --check`: clean.
  - The workflow's own catalog checks passed: `check-manifest-scenarios` (43 manifests, 36 scenarios), `check-scenario-alignment` and `check-proof-row-manifests`.
- **Dry runs** with the full live input set, both `success` at docs `9ba5518b`: live-suite [44077455307](https://github.com/karmaterminal/karmaterminal-openclaw-docs/actions/runs/44077455307) (34 entries: PREFLIGHT + 33 rows) and the alt slice [44077499825](https://github.com/karmaterminal/karmaterminal-openclaw-docs/actions/runs/44077499825) (3 rows, `OPENCLAW_ALT_MODEL=openai/gpt-5.6-sol`).
- **Product subnetwork.** A code-path-to-proof-predicate map at `51ff02dc` is in `SUBNETWORK-MAP.md`, together with its GitNexus receipt and tooling-gap disclosure.

## Firing rules

- `dispatch_allocation` in `proofs-manifest.json` is the only firing authority. Each row fires once; a consumed or possibly consumed row is not refired silently.
- Runner output is candidate evidence only, and no row is promoted. Every non-PASS row is classified (product / harness / infra / seat) against its last same-row PASS, which is diagnostic provenance only.
- `live-suite` resolves to PREFLIGHT + 33 rows. `R-CW-5/5A/6/6A` are orchestration-required and excluded by design, so 33 is the honest live denominator. Four required rows are not fired by this lane: `R-CD-RECIPIENT-AUTHORITY` (its manifest is only on open docs#620), `R-CD-RETURN-COVENANT-AUTHORITY` (not in live-suite; its control restarts a disposable gateway), `R-CW-5` and `R-CW-6` (fixtures). They stay `missing`.
- The six `static-corpus-row-validator` rows (`R-CD-COLLECTION-ON-COLLAPSE`, `R-CW-7`, `R-CW-DELEGATE-CHILD-LIVE`, `R-CW-DELEGATE-TOKEN`, `R-CW-MULTI`, `R-CW-MULTI-COLLAPSE`) validate pinned historical captures (🌊's ruling A). They are not live execution at this SHA.

## Fire attempts (2026-11-17): blocked at readiness, nothing fired

| run | inputs | result |
|---|---|---|
| [44082334447](https://github.com/karmaterminal/karmaterminal-openclaw-docs/actions/runs/44082334447) | live, PREFLIGHT + 30 rows as one 433-character `rows` list | `failure` with **0 jobs**. The `rows` input is interpolated into the workflow `concurrency.group`, and a list this long overflows it, so GitHub rejected the run before creating a job. Nothing ran. (Workflow defect: the full non-alt live list cannot be dispatched as one run.) |
| [44082522523](https://github.com/karmaterminal/karmaterminal-openclaw-docs/actions/runs/44082522523) | live, batch A (PREFLIGHT + 15 rows) | `failure` at **Authenticated target readiness**: `PARTIAL-candidate`, notes `gateway-auth-rejected`, `configured/effective-depth-unknown`, `configured/effective-continuation-unready`, `runtime-sha-not-observed`. Every note after the first follows from the refused connect. **Run Project 81 proof suite: skipped.** No row dispatched. |

Both ran workflow `project81-k6-proof.yml` at docs `9ba5518bdb079da3c3c75961fd8cd26be040eb1e` with `candidate_sha` = `runtime_sha` = `ab5a30ea79b776f149e24b1fccab9e79b0a5d299`.

**Diagnosis (read-only, on emeric).**

- The same readiness preflight, run from the runner's own checkout at `9ba5518b` with a dummy token, gives the identical notes. So the repository secret's value is not the cause.
- A direct connect probe with the readiness identity `{id:"cli", mode:"cli"}` got `NOT_PAIRED` "device identity required".
- With the scenarios' identity `{id:"gateway-client", mode:"backend"}` it got `hello-ok`: role `operator`, `config.get` available, `buildId` containing `ab5a30ea79b7`.
- emeric's `gateway.auth.mode` is `"none"`. Only that mode string and key names were read. The token value was never read or printed.
- At `ab5a30ea`, `sharedAuthOk` is true only for auth method `token`, `password` or `trusted-proxy` (`src/gateway/server/ws-connection/auth-context.ts:105-108`). A device-less operator that is not the local backend client needs `sharedAuthOk` (`connect-policy.ts:69-98`, `role-policy.ts:14-16`). Mode `none` yields method `"none"`, so readiness cannot pass on this gateway with any token.

**Classification.** This is a seat prerequisite / harness-compatibility blocker, not a product finding.

- The previous emeric corpora fired on isolated token-auth proof gateways (`f15237ec`, `08c37a15`, `293c977f`).
- `3821eaef` fired on ronan's live gateway, which authenticated by token.
- This is the first attempt on a live gateway configured `auth.mode=none`.

**Remedies, none of which this lane may take:**

1. 🕯 switches emeric's live gateway to token auth (its config already carries a token). That is a config change plus a restart. The repository secret does not hold emeric's token either, so the fire would then go through the operator-supplied token path (`run-proofs.sh --live` on emeric; the `3821eaef` precedent) or need a secret change.
2. A reviewed docs change lets readiness authenticate as the local backend client on a loopback target. That changes the signed receipt's authentication claim.
3. An isolated token-auth proof gateway at `ab5a30ea` on emeric (the `f15237ec` shape). This contradicts the live-gateway spec and needs a stage-only deploy.

On a refire, the row list must also be split into dispatches of under ~350 characters, or the workflow's concurrency group must stop embedding `rows`.
