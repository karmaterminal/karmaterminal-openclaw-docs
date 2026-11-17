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
