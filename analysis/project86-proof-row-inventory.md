# Project 86 proof-row catalog and issue inventory

Docs base: `abe1f9f0749d849b01da4e5d354c205ecffac946`  
Reference corpus: `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203`  
Candidate placeholder: `<FINAL_CANDIDATE_SHA>`

## Denominator reconciliation

| Surface | Count | Meaning |
|---|---:|---|
| Manifest entries | 38 | Total committed catalog; every entry has an issue draft below. |
| Canonical reference rows | 35 | Exact `required_rows`, row-directory, and rollup denominator in the reference corpus. |
| Runnable manifests | 36 | All except scaffolded R-CW-5 and R-CW-6 isolated fixtures. |
| Runner `--live-suite` | 34 | Runnable `k6-runnable` classifications; excludes the fixtures and static companions R-CW-5A/R-CW-6A. |
| Scenario files | 35 | Includes live scenarios, static validators, support/legacy aliases, and fail-closed scaffolds. |
| Live k6 / fixture / static / support | 22 / 2 / 13 / 1 | Execution-class split across all 38 manifest entries. |

The 38-entry catalog reconciles as **35 reference-required rows + `preflight` support + `R-CW-5A`/`R-CW-6A` static companions**. The canonical reference rollup is **35 = 2 pass + 32 partial + 1 fail + 0 honest_limit**. Nothing is omitted because it is static, fixture-backed, support-only, or historically incomplete.

## Catalog commands recorded

- `node tools/k6-proofs/scripts/list-runnable-rows.mjs --all` - 36 row ids: 33 canonical runnable rows plus preflight, R-CW-5A, and R-CW-6A.
- `node tools/k6-proofs/scripts/list-runnable-rows.mjs --live-suite` - 34 row ids: runnable k6-runnable classifications, including offline/static canonical validators and preflight; excludes R-CW-5/R-CW-6 fixtures and R-CW-5A/R-CW-6A.
- `node tools/k6-proofs/scripts/check-manifest-scenarios.mjs` - PASS: 38 manifests; 35 scenario files.
- `node tools/k6-proofs/scripts/check-scenario-alignment.mjs` - PASS: workflow choices, scenario files, and manifest registry align.
- `node tools/k6-proofs/scripts/check-proof-row-manifests.mjs` - PASS: 35 proof rows, 38 manifest entries, no missing manifests; R-CW-5A and R-CW-6A are manifest-only rows and preflight is support.
- `node tools/k6-proofs/scripts/validate-corpus.mjs --current --json` - PASS: 4 index checks and 10 current-SHA checks; rollup total 35 = pass 2 + partial 32 + fail 1 + honest_limit 0.

## Row matrix

| Row | Scope | Class | Status | Scenario | Manifest |
|---|---|---|---|---|---|
| preflight | manifest-only support | support | runnable | `preflight` | `tools/k6-proofs/manifests/preflight.example.json` |
| R-CD-1 | reference-required | live k6 | runnable | `r-cd-1-typed-delegate` | `tools/k6-proofs/manifests/r-cd-1.json` |
| R-CD-2 | reference-required | live k6 | runnable | `r-cd-2-silent-wake` | `tools/k6-proofs/manifests/r-cd-2.json` |
| R-CD-3 | reference-required | live k6 | runnable | `r-cd-3-post-compaction` | `tools/k6-proofs/manifests/r-cd-3.json` |
| R-CD-4 | reference-required | live k6 | runnable | `r-cd-4-target-session-key` | `tools/k6-proofs/manifests/r-cd-4.json` |
| R-CD-CHAINED-DEPTH-2 | reference-required | live k6 | runnable | `r-cd-chained-depth-2` | `tools/k6-proofs/manifests/r-cd-chained-depth-2.json` |
| R-CD-COLLECTION-ON-COLLAPSE | reference-required | static validator | runnable | `static-corpus-row-validator` | `tools/k6-proofs/manifests/r-cd-collection-on-collapse.json` |
| R-CD-MODEL-CHAINED-ALT | reference-required | live k6 | runnable | `r-cd-model-chained-alt` | `tools/k6-proofs/manifests/r-cd-model-chained-alt.json` |
| R-CD-MODEL-DEFAULT | reference-required | live k6 | runnable | `r-cd-model-default` | `tools/k6-proofs/manifests/r-cd-model-default.json` |
| R-CD-MODEL-TOKEN | reference-required | live k6 | runnable | `r-cd-model-token` | `tools/k6-proofs/manifests/r-cd-model-token.json` |
| R-CD-MODEL-TOOL | reference-required | live k6 | runnable | `r-cd-model-tool` | `tools/k6-proofs/manifests/r-cd-model-tool.json` |
| R-CD-RETURN-OVERLAP | reference-required | static validator | runnable | `r-cd-return-overlap` | `tools/k6-proofs/manifests/r-cd-return-overlap.json` |
| R-CD-SILENT | reference-required | live k6 | runnable | `r-cd-silent` | `tools/k6-proofs/manifests/r-cd-silent.json` |
| R-CD-TOKEN | reference-required | live k6 | runnable | `r-cd-token-bracket-delegate` | `tools/k6-proofs/manifests/r-cd-token.json` |
| R-CONFIG-DEFAULTS | reference-required | live k6 | runnable | `r-config-defaults` | `tools/k6-proofs/manifests/r-config-defaults.json` |
| R-CONFIG-INTERSESSION | reference-required | live k6 | runnable | `r-config-intersession` | `tools/k6-proofs/manifests/r-config-intersession.json` |
| R-CW-1 | reference-required | live k6 | runnable | `r-cw-1-tool-schedule-wake` | `tools/k6-proofs/manifests/r-cw-1.json` |
| R-CW-2 | reference-required | live k6 | runnable | `r-cw-2-immediate-wake` | `tools/k6-proofs/manifests/r-cw-2.json` |
| R-CW-3 | reference-required | live k6 | runnable | `r-cw-3-reason-telemetry` | `tools/k6-proofs/manifests/r-cw-3.json` |
| R-CW-4 | reference-required | live k6 | runnable | `r-cw-4-chain-depth` | `tools/k6-proofs/manifests/r-cw-4.json` |
| R-CW-5 | reference-required | isolated fixture | scaffold | `r-cw-5-cost-cap-reject` | `tools/k6-proofs/manifests/r-cw-5.json` |
| R-CW-5A | manifest-only static companion | static validator | runnable | `static-corpus-row-validator` | `tools/k6-proofs/manifests/r-cw-5a-static.json` |
| R-CW-6 | reference-required | isolated fixture | scaffold | `r-cw-6-max-chain-length` | `tools/k6-proofs/manifests/r-cw-6.json` |
| R-CW-6A | manifest-only static companion | static validator | runnable | `static-corpus-row-validator` | `tools/k6-proofs/manifests/r-cw-6a-static.json` |
| R-CW-7 | reference-required | static validator | runnable | `static-corpus-row-validator` | `tools/k6-proofs/manifests/r-cw-7.json` |
| R-CW-DELEGATE-CHILD-LIVE | reference-required | static validator | runnable | `static-corpus-row-validator` | `tools/k6-proofs/manifests/r-cw-delegate-child-live.json` |
| R-CW-DELEGATE-SELF-CONTINUATION | reference-required | live k6 | runnable | `r-cw-delegate-self-continuation` | `tools/k6-proofs/manifests/r-cw-delegate-self.json` |
| R-CW-DELEGATE-TOKEN | reference-required | static validator | runnable | `static-corpus-row-validator` | `tools/k6-proofs/manifests/r-cw-delegate-token.json` |
| R-CW-MULTI-COLLAPSE | reference-required | static validator | runnable | `static-corpus-row-validator` | `tools/k6-proofs/manifests/r-cw-multi-collapse.json` |
| R-CW-MULTI | reference-required | static validator | runnable | `static-corpus-row-validator` | `tools/k6-proofs/manifests/r-cw-multi.json` |
| R-CW-TOKEN | reference-required | live k6 | runnable | `r-cw-token-bracket` | `tools/k6-proofs/manifests/r-cw-token.json` |
| R-OBS-1 | reference-required | live k6 | runnable | `r-obs-1` | `tools/k6-proofs/manifests/r-obs-1.json` |
| R-OBS-2 | reference-required | static validator | runnable | `r-obs-2` | `tools/k6-proofs/manifests/r-obs-2.json` |
| R-OBS-STATUS | reference-required | static validator | runnable | `r-obs-status` | `tools/k6-proofs/manifests/r-obs-status.json` |
| R-RC-1 | reference-required | live k6 | runnable | `r-rc-1-threshold-reject` | `tools/k6-proofs/manifests/r-rc-1.json` |
| R-RC-2 | reference-required | live k6 | runnable | `r-rc-2-delegate-request-compaction` | `tools/k6-proofs/manifests/r-rc-2.json` |
| R-REGRESSION-TRAP-TESTS | reference-required | static validator | runnable | `r-regression-trap-tests` | `tools/k6-proofs/manifests/r-regression-trap-tests.json` |
| R-TRACE-REDACTION-1121 | reference-required | static validator | runnable | `r-trace-redaction-1121` | `tools/k6-proofs/manifests/r-trace-redaction-1121.json` |

## Global execution and landing rules

Run committed automation first. If it does not execute the behavior, use the documented old/manual form and collect the same named receipts. Continue independent rows unless an exact-SHA, gateway-wide, unsafe-mutation, or redaction failure is explicitly declared a halt-state. Only R-RC-2 has a permitted HONEST_LIMIT, narrowly limited to a structured below-threshold `request_compaction` toolResult.

Each prince commits only `PROOFS/<FINAL_CANDIDATE_SHA>/<ROW>/<SEAT>/...` directly to docs `main`. Row executors do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

## Proposed issues

### [Project 86] preflight: Run proof-seat readiness preflight

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **preflight** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **support**
- Manifest: `tools/k6-proofs/manifests/preflight.example.json`
- Scenario: `tools/k6-proofs/scenarios/preflight.js`
- Contract: Authenticate/read-only gateway inventory plus seat-readiness contract: health/status, sessions.list, tools.effective, k6 version/path, env presence, and candidate metadata. Offline mode validates manifest shape without gateway traffic.
- Suggested owner/seat class: Any gateway operator proof seat; no live assignment.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Run and retain public-safe seat readiness before interpreting behavior.
- Run on the host whose hostname is the intended <SEAT>; run-proofs.sh normalizes OPENCLAW_SEAT_NAME to hostname.
- OPENCLAW_GATEWAY_TOKEN is present in the environment; never write its value.

Same-session concurrency safe: **true**. The manifest permits concurrency, but use a disposable/isolated session when the row can compact or alter session-local state.

## Run the committed automation first

```bash
cd tools/k6-proofs && \
K6_PROOF_OUT_DIR=/tmp/project86-proof-runs \
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
./scripts/run-proofs.sh --live preflight <FINAL_CANDIDATE_SHA>
```

This command is instantiated from `tools/k6-proofs/docs/PROOF-RUN-METHOD.md:95-109 (row-list live command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.

Seat resolution: `run-proofs.sh` overwrites `OPENCLAW_SEAT_NAME` with the executing host's `hostname`. Run on the host intended by `<SEAT>`; use the resolved hostname in the committed artifact subtree.


## Required receipts

- `manifest-loaded`
- `k6-summary`
- `seat-readiness`

## Required artifacts

- `seat-readiness.json`
- `row-manifest.json`
- `runner-metadata.json`
- `run-result.json`
- `k6.log`
- `evidence.jsonl`
- `evidence-lines.log`
- `evidence-redaction.json`
- `gateway-journal.log`
- `gateway-journal-capture.json`
- `gateway-journal-redaction.json`
- `k6-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/preflight/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/README.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/proofs-manifest.json`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/101 (manifest.issue)

## Verdict contract

- **PASS:** PASS-candidate means the seat/tooling/gateway readiness contract passed; it is support evidence and not a behavioral proof row.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/preflight.js`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

Run the direct manifest-driven preflight with ./tools/k6-proofs/run-proof.sh preflight after exporting candidate, seat, session, and gateway-token environment. If the wrapper still does not execute, manually verify gateway health/status, sessions.list, tools.effective, k6 v2.0.0, continuation config, and exact deployed SHA, then record a public-safe readiness receipt.

## Failure routing and landing

The default failure scope is **all live rows on the affected seat**. Stop live rows on this seat for candidate/runtime mismatch, unavailable gateway, disabled continuation, missing required credentials, or failed redaction boundary. Static validators and isolated fixtures may continue.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CD-1: Prove typed continue_delegate schedule, spawn, and return

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CD-1** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **live k6**
- Manifest: `tools/k6-proofs/manifests/r-cd-1.json`
- Scenario: `tools/k6-proofs/scenarios/r-cd-1-typed-delegate.js`
- Contract: Typed continue_delegate() schedule/spawn/return. Fires a delegate with a nonce-only child task, observes task ledger entry and parent return.
- Suggested owner/seat class: silas-lothric; gateway operator seat with a coordinated disposable session.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- Run and retain public-safe seat readiness before interpreting behavior.
- Run on the host whose hostname is the intended <SEAT>; run-proofs.sh normalizes OPENCLAW_SEAT_NAME to hostname.
- OPENCLAW_GATEWAY_TOKEN is present in the environment; never write its value.
- Acquire the runner lock and run no other continuation row against the same session.

Same-session concurrency safe: **false**. Serialize this row under the runner lock and do not overlap another continuation row on the same target session.

## Run the committed automation first

```bash
cd tools/k6-proofs && \
K6_PROOF_OUT_DIR=/tmp/project86-proof-runs \
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
./scripts/run-proofs.sh --live R-CD-1 <FINAL_CANDIDATE_SHA>
```

This command is instantiated from `tools/k6-proofs/docs/PROOF-RUN-METHOD.md:95-109 (row-list live command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.

Seat resolution: `run-proofs.sh` overwrites `OPENCLAW_SEAT_NAME` with the executing host's `hostname`. Run on the host intended by `<SEAT>`; use the resolved hostname in the committed artifact subtree.


## Required receipts

- `seat-readiness`
- `tool-invoke-accepted`
- `delegate-scheduled-sentinel`
- `parent-return-event`
- `trace-id`

## Required artifacts

- `seat-readiness.json`
- `row-manifest.json`
- `runner-metadata.json`
- `run-result.json`
- `k6.log`
- `evidence.jsonl`
- `evidence-lines.log`
- `evidence-redaction.json`
- `gateway-journal.log`
- `gateway-journal-capture.json`
- `gateway-journal-redaction.json`
- `r-cd-1-typed-delegate-summary.json`
- `gateway-events.ndjson`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CD-1/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-1`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-1/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-1/comparators/elliott-legion/20260719T191334Z-r-cd-1`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/103 (manifest.issue)

## Verdict contract

- **PASS:** Permitted after the committed behavior is observed and all required receipts are present: seat-readiness, tool-invoke-accepted, delegate-scheduled-sentinel, parent-return-event, trace-id. Human review is still required before canonical fold.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/r-cd-1-typed-delegate.js`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

Run the direct manifest-driven scenario with OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA>, OPENCLAW_SEAT_NAME=<SEAT>, OPENCLAW_SESSION_KEY=<SESSION_KEY>, OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-cd-1.json, and ./tools/k6-proofs/run-proof.sh r-cd-1-typed-delegate. If that still does not execute the behavior, perform the manifest's typed-tool/token/read-only surface manually in a coordinated disposable session and collect the same named receipts from session history, the bounded sanitized gateway journal, and public-safe Tempo output. Do not copy prompt bodies into the issue or artifacts.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CD-2: Prove silent-wake delegate lifecycle and no channel delivery

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CD-2** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **live k6**
- Manifest: `tools/k6-proofs/manifests/r-cd-2.json`
- Scenario: `tools/k6-proofs/scenarios/r-cd-2-silent-wake.js`
- Contract: continue_delegate(mode='silent-wake') full path. Fires a delegate that returns silently and triggers a fresh parent turn without channel output.
- Suggested owner/seat class: cael-dgx; gateway operator seat with a coordinated disposable session.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- Run and retain public-safe seat readiness before interpreting behavior.
- Run on the host whose hostname is the intended <SEAT>; run-proofs.sh normalizes OPENCLAW_SEAT_NAME to hostname.
- OPENCLAW_GATEWAY_TOKEN is present in the environment; never write its value.
- OPENCLAW_SESSION_KEY resolves explicitly to <SESSION_KEY>; no main-session fallback.
- Acquire the runner lock and run no other continuation row against the same session.

Same-session concurrency safe: **false**. Serialize this row under the runner lock and do not overlap another continuation row on the same target session.

## Run the committed automation first

```bash
cd tools/k6-proofs && \
K6_PROOF_OUT_DIR=/tmp/project86-proof-runs \
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
./scripts/run-proofs.sh --live R-CD-2 <FINAL_CANDIDATE_SHA>
```

This command is instantiated from `tools/k6-proofs/docs/PROOF-RUN-METHOD.md:95-109 (row-list live command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.

Seat resolution: `run-proofs.sh` overwrites `OPENCLAW_SEAT_NAME` with the executing host's `hostname`. Run on the host intended by `<SEAT>`; use the resolved hostname in the committed artifact subtree.


## Required receipts

- `seat-readiness`
- `send-run-lifecycle`
- `typed-delegate-topology`
- `row-scoped-authoritative-receipt`
- `no-channel-delivery`
- `tempo-trace-json`

## Required artifacts

- `seat-readiness.json`
- `row-manifest.json`
- `runner-metadata.json`
- `run-result.json`
- `k6.log`
- `evidence.jsonl`
- `evidence-lines.log`
- `evidence-redaction.json`
- `gateway-journal.log`
- `gateway-journal-capture.json`
- `gateway-journal-redaction.json`
- `r-cd-2-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CD-2/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-2`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-2/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-2/comparators/elliott-legion/20260719T191521Z-r-cd-2`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/119 (manifest.issue)

## Verdict contract

- **PASS:** PASS-candidate is permitted only through the row-scoped authoritative receipt joining accepted send/run lifecycle, typed delegate topology, no channel delivery, and the public-safe Tempo projection.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/r-cd-2-silent-wake.js`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

Run the direct manifest-driven scenario with OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA>, OPENCLAW_SEAT_NAME=<SEAT>, OPENCLAW_SESSION_KEY=<SESSION_KEY>, OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-cd-2.json, and ./tools/k6-proofs/run-proof.sh r-cd-2-silent-wake. If that still does not execute the behavior, perform the manifest's typed-tool/token/read-only surface manually in a coordinated disposable session and collect the same named receipts from session history, the bounded sanitized gateway journal, and public-safe Tempo output. Do not copy prompt bodies into the issue or artifacts.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CD-3: Prove the post-compaction delegate lifeboat

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CD-3** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **live k6**
- Manifest: `tools/k6-proofs/manifests/r-cd-3.json`
- Scenario: `tools/k6-proofs/scenarios/r-cd-3-post-compaction.js`
- Contract: Stage continue_delegate(mode=post-compaction), then call request_compaction. PASS requires the post-compaction lifeboat return; a structured below-threshold refusal remains PARTIAL.
- Suggested owner/seat class: ronan-dgx; gateway operator seat with a coordinated disposable session.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- Run and retain public-safe seat readiness before interpreting behavior.
- Run on the host whose hostname is the intended <SEAT>; run-proofs.sh normalizes OPENCLAW_SEAT_NAME to hostname.
- OPENCLAW_GATEWAY_TOKEN is present in the environment; never write its value.
- A coordinated high-context session is needed for accepted compaction; below-threshold execution remains PARTIAL.

Same-session concurrency safe: **true**. The manifest permits concurrency, but use a disposable/isolated session when the row can compact or alter session-local state.

## Run the committed automation first

```bash
cd tools/k6-proofs && \
K6_PROOF_OUT_DIR=/tmp/project86-proof-runs \
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
./scripts/run-proofs.sh --live R-CD-3 <FINAL_CANDIDATE_SHA>
```

This command is instantiated from `tools/k6-proofs/docs/PROOF-RUN-METHOD.md:95-109 (row-list live command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.

Seat resolution: `run-proofs.sh` overwrites `OPENCLAW_SEAT_NAME` with the executing host's `hostname`. Run on the host intended by `<SEAT>`; use the resolved hostname in the committed artifact subtree.


## Required receipts

- `dispatch-accepted`
- `delegate-staging-requested`
- `compaction-requested`
- `threshold-refusal-or-lifeboat`

## Required artifacts

- `seat-readiness.json`
- `row-manifest.json`
- `runner-metadata.json`
- `run-result.json`
- `k6.log`
- `evidence.jsonl`
- `evidence-lines.log`
- `evidence-redaction.json`
- `gateway-journal.log`
- `gateway-journal-capture.json`
- `gateway-journal-redaction.json`
- `r-cd-3-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CD-3/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-3`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-3/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-3/comparators/elliott-legion/20260719T191755Z-r-cd-3`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/119 (manifest.issue)

## Verdict contract

- **PASS:** Permitted after the committed behavior is observed and all required receipts are present: dispatch-accepted, delegate-staging-requested, compaction-requested, threshold-refusal-or-lifeboat. Human review is still required before canonical fold.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/r-cd-3-post-compaction.js`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

Run the direct manifest-driven scenario with OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA>, OPENCLAW_SEAT_NAME=<SEAT>, OPENCLAW_SESSION_KEY=<SESSION_KEY>, OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-cd-3.json, and ./tools/k6-proofs/run-proof.sh r-cd-3-post-compaction. If that still does not execute the behavior, perform the manifest's typed-tool/token/read-only surface manually in a coordinated disposable session and collect the same named receipts from session history, the bounded sanitized gateway journal, and public-safe Tempo output. Do not copy prompt bodies into the issue or artifacts.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CD-4: Prove targeted cross-session delegate return

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CD-4** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **live k6**
- Manifest: `tools/k6-proofs/manifests/r-cd-4.json`
- Scenario: `tools/k6-proofs/scenarios/r-cd-4-target-session-key.js`
- Contract: continue_delegate with targetSessionKey: delegate return lands in a SPECIFIED target session, not the dispatching session. Cross-session targeted delivery.
- Suggested owner/seat class: rune; gateway operator seat with a coordinated disposable session.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- Run and retain public-safe seat readiness before interpreting behavior.
- Run on the host whose hostname is the intended <SEAT>; run-proofs.sh normalizes OPENCLAW_SEAT_NAME to hostname.
- OPENCLAW_GATEWAY_TOKEN is present in the environment; never write its value.
- Acquire the runner lock and run no other continuation row against the same session.

Same-session concurrency safe: **false**. Serialize this row under the runner lock and do not overlap another continuation row on the same target session.

## Run the committed automation first

```bash
cd tools/k6-proofs && \
K6_PROOF_OUT_DIR=/tmp/project86-proof-runs \
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
./scripts/run-proofs.sh --live R-CD-4 <FINAL_CANDIDATE_SHA>
```

This command is instantiated from `tools/k6-proofs/docs/PROOF-RUN-METHOD.md:95-109 (row-list live command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.

Seat resolution: `run-proofs.sh` overwrites `OPENCLAW_SEAT_NAME` with the executing host's `hostname`. Run on the host intended by `<SEAT>`; use the resolved hostname in the committed artifact subtree.


## Required receipts

- `seat-readiness`
- `parent-session-created`
- `target-session-created`
- `dispatch-accepted`
- `child-session-identity`
- `target-return-event`
- `no-parent-return`
- `trace-id`

## Required artifacts

- `seat-readiness.json`
- `row-manifest.json`
- `runner-metadata.json`
- `run-result.json`
- `k6.log`
- `evidence.jsonl`
- `evidence-lines.log`
- `evidence-redaction.json`
- `gateway-journal.log`
- `gateway-journal-capture.json`
- `gateway-journal-redaction.json`
- `r-cd-4-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CD-4/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-4`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-4/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-4/comparators/elliott-legion/20260719T191806Z-r-cd-4`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/119 (manifest.issue)

## Verdict contract

- **PASS:** Permitted after the committed behavior is observed and all required receipts are present: seat-readiness, parent-session-created, target-session-created, dispatch-accepted, child-session-identity, target-return-event, no-parent-return, trace-id. Human review is still required before canonical fold.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/r-cd-4-target-session-key.js`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

Run the direct manifest-driven scenario with OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA>, OPENCLAW_SEAT_NAME=<SEAT>, OPENCLAW_SESSION_KEY=<SESSION_KEY>, OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-cd-4.json, and ./tools/k6-proofs/run-proof.sh r-cd-4-target-session-key. If that still does not execute the behavior, perform the manifest's typed-tool/token/read-only surface manually in a coordinated disposable session and collect the same named receipts from session history, the bounded sanitized gateway journal, and public-safe Tempo output. Do not copy prompt bodies into the issue or artifacts.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CD-CHAINED-DEPTH-2: Prove parent-child-grandchild delegate return

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CD-CHAINED-DEPTH-2** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **live k6**
- Manifest: `tools/k6-proofs/manifests/r-cd-chained-depth-2.json`
- Scenario: `tools/k6-proofs/scenarios/r-cd-chained-depth-2.js`
- Contract: Depth-2 delegate chain: parent→child→grandchild→return path. Three sub-tests: (1) up-tree silent-wake, (2) inter-session return, (3) echo+broadcast via fanoutMode.
- Suggested owner/seat class: ronan-dgx; gateway operator seat with a coordinated disposable session.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- Run and retain public-safe seat readiness before interpreting behavior.
- Run on the host whose hostname is the intended <SEAT>; run-proofs.sh normalizes OPENCLAW_SEAT_NAME to hostname.
- OPENCLAW_GATEWAY_TOKEN is present in the environment; never write its value.
- Acquire the runner lock and run no other continuation row against the same session.
- Fire the nested delegate subtests sequentially, never in parallel.

Same-session concurrency safe: **false**. Serialize this row under the runner lock and do not overlap another continuation row on the same target session.

## Run the committed automation first

```bash
cd tools/k6-proofs && \
K6_PROOF_OUT_DIR=/tmp/project86-proof-runs \
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
./scripts/run-proofs.sh --live R-CD-CHAINED-DEPTH-2 <FINAL_CANDIDATE_SHA>
```

This command is instantiated from `tools/k6-proofs/docs/PROOF-RUN-METHOD.md:95-109 (row-list live command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.

Seat resolution: `run-proofs.sh` overwrites `OPENCLAW_SEAT_NAME` with the executing host's `hostname`. Run on the host intended by `<SEAT>`; use the resolved hostname in the committed artifact subtree.


## Required receipts

- `seat-readiness`
- `parent-dispatch-accepted`
- `child-spawns`
- `child-fires-grandchild`
- `grandchild-spawns`
- `grandchild-returns`
- `parent-receives-chain-return`
- `trace-id`

## Required artifacts

- `seat-readiness.json`
- `row-manifest.json`
- `runner-metadata.json`
- `run-result.json`
- `k6.log`
- `evidence.jsonl`
- `evidence-lines.log`
- `evidence-redaction.json`
- `gateway-journal.log`
- `gateway-journal-capture.json`
- `gateway-journal-redaction.json`
- `r-cd-chained-depth-2-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CD-CHAINED-DEPTH-2/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-CHAINED-DEPTH-2`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-CHAINED-DEPTH-2/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-CHAINED-DEPTH-2/comparators/elliott-legion/20260719T191939Z-r-cd-chained-depth-2`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/119 (manifest.issue)

## Verdict contract

- **PASS:** Permitted after the committed behavior is observed and all required receipts are present: seat-readiness, parent-dispatch-accepted, child-spawns, child-fires-grandchild, grandchild-spawns, grandchild-returns, parent-receives-chain-return, trace-id. Human review is still required before canonical fold.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/r-cd-chained-depth-2.js`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

Run the direct manifest-driven scenario with OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA>, OPENCLAW_SEAT_NAME=<SEAT>, OPENCLAW_SESSION_KEY=<SESSION_KEY>, OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-cd-chained-depth-2.json, and ./tools/k6-proofs/run-proof.sh r-cd-chained-depth-2. If that still does not execute the behavior, perform the manifest's typed-tool/token/read-only surface manually in a coordinated disposable session and collect the same named receipts from session history, the bounded sanitized gateway journal, and public-safe Tempo output. Do not copy prompt bodies into the issue or artifacts.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CD-COLLECTION-ON-COLLAPSE: Prove root collection after intermediate collapse

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CD-COLLECTION-ON-COLLAPSE** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **static validator**
- Manifest: `tools/k6-proofs/manifests/r-cd-collection-on-collapse.json`
- Scenario: `tools/k6-proofs/scenarios/static-corpus-row-validator.js`
- Contract: Static validator for committed A→B→delayed-C collection-on-collapse proof receipts.
- Suggested owner/seat class: cael-dgx; offline reviewer seat with k6 v2.0.0 and the committed reference corpus.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- The committed reference packet under PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203 is present for validator input.

Same-session concurrency safe: **true**. The manifest permits concurrency, but use a disposable/isolated session when the row can compact or alter session-local state.

## Run the committed automation first

```bash
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-cd-collection-on-collapse.json \
k6 run tools/k6-proofs/scenarios/static-corpus-row-validator.js
```

This command is instantiated from `tools/k6-proofs/skill/SKILL.md:129-139 (direct k6 scenario command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.


## Required receipts

- `collection-collapse-artifacts`
- `root-collection-after-intermediate-finalized`

## Required artifacts

- `static-corpus-row-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CD-COLLECTION-ON-COLLAPSE/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-COLLECTION-ON-COLLAPSE`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-COLLECTION-ON-COLLAPSE/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-COLLECTION-ON-COLLAPSE/comparators/elliott-legion/20260719T192053Z-r-cd-collection-on-collapse`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/119 (manifest.issue)

## Verdict contract

- **PASS:** A validator PASS proves only that the committed reference/source packet satisfies the static contract. It is not fresh final-candidate behavioral PASS; fresh manual candidate receipts are still required for that claim.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS. Static automation that passes while fresh candidate behavior remains unexecuted is still incomplete for the candidate behavior claim.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/static-corpus-row-validator.js`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/README.md`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

The committed automation validates the reference packet rather than fresh candidate behavior. Run it first, then replay the documented old/manual behavior from PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-COLLECTION-ON-COLLAPSE/EVIDENCE.md against <FINAL_CANDIDATE_SHA>, using tools/k6-proofs/manifests/r-cd-collection-on-collapse.json as the receipt checklist and tools/k6-proofs/scenarios/static-corpus-row-validator.js as the validator contract. Capture fresh sanitized candidate receipts; do not claim the reference packet as candidate execution.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CD-MODEL-CHAINED-ALT: Prove alternate model propagation at delegate depth two

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CD-MODEL-CHAINED-ALT** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **live k6**
- Manifest: `tools/k6-proofs/manifests/r-cd-model-chained-alt.json`
- Scenario: `tools/k6-proofs/scenarios/r-cd-model-chained-alt.js`
- Contract: Depth-1 delegate schedules a depth-2 continue_delegate with explicit alternate model; depth-2 reports observed model/provider.
- Suggested owner/seat class: cael-dgx; gateway operator seat with a coordinated disposable session.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- Run and retain public-safe seat readiness before interpreting behavior.
- Run on the host whose hostname is the intended <SEAT>; run-proofs.sh normalizes OPENCLAW_SEAT_NAME to hostname.
- OPENCLAW_GATEWAY_TOKEN is present in the environment; never write its value.
- Acquire the runner lock and run no other continuation row against the same session.
- Use a seat with both requested models available; upstream model-forwarding issue karmaterminal/openclaw#1103 may affect the row.

Same-session concurrency safe: **false**. Serialize this row under the runner lock and do not overlap another continuation row on the same target session.

## Run the committed automation first

```bash
cd tools/k6-proofs && \
K6_PROOF_OUT_DIR=/tmp/project86-proof-runs \
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
./scripts/run-proofs.sh --live R-CD-MODEL-CHAINED-ALT <FINAL_CANDIDATE_SHA>
```

This command is instantiated from `tools/k6-proofs/docs/PROOF-RUN-METHOD.md:95-109 (row-list live command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.

Seat resolution: `run-proofs.sh` overwrites `OPENCLAW_SEAT_NAME` with the executing host's `hostname`. Run on the host intended by `<SEAT>`; use the resolved hostname in the committed artifact subtree.


## Required receipts

- `seat-readiness`
- `dispatch-accepted`
- `depth-1-child-observed`
- `depth-1-scheduled-inner`
- `depth-2-child-observed`
- `depth-2-model-byte`
- `return-payload`

## Required artifacts

- `seat-readiness.json`
- `row-manifest.json`
- `runner-metadata.json`
- `run-result.json`
- `k6.log`
- `evidence.jsonl`
- `evidence-lines.log`
- `evidence-redaction.json`
- `gateway-journal.log`
- `gateway-journal-capture.json`
- `gateway-journal-redaction.json`
- `r-cd-model-chained-alt-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CD-MODEL-CHAINED-ALT/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-MODEL-CHAINED-ALT`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-MODEL-CHAINED-ALT/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-MODEL-CHAINED-ALT/comparators/elliott-legion/20260719T192055Z-r-cd-model-chained-alt`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/140 (manifest.issue)
- https://github.com/karmaterminal/openclaw/issues/1103 (manifest/scenario source reference)

## Verdict contract

- **PASS:** Permitted after the committed behavior is observed and all required receipts are present: seat-readiness, dispatch-accepted, depth-1-child-observed, depth-1-scheduled-inner, depth-2-child-observed, depth-2-model-byte, return-payload. Human review is still required before canonical fold.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/r-cd-model-chained-alt.js`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

Run the direct manifest-driven scenario with OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA>, OPENCLAW_SEAT_NAME=<SEAT>, OPENCLAW_SESSION_KEY=<SESSION_KEY>, OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-cd-model-chained-alt.json, and ./tools/k6-proofs/run-proof.sh r-cd-model-chained-alt. If that still does not execute the behavior, perform the manifest's typed-tool/token/read-only surface manually in a coordinated disposable session and collect the same named receipts from session history, the bounded sanitized gateway journal, and public-safe Tempo output. Do not copy prompt bodies into the issue or artifacts.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CD-MODEL-DEFAULT: Prove default delegate model inheritance in both forms

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CD-MODEL-DEFAULT** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **live k6**
- Manifest: `tools/k6-proofs/manifests/r-cd-model-default.json`
- Scenario: `tools/k6-proofs/scenarios/r-cd-model-default.js`
- Contract: Default provider/model inheritance for continue_delegate tool and bracket/token forms when no override is supplied.
- Suggested owner/seat class: cael-dgx; gateway operator seat with a coordinated disposable session.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- Run and retain public-safe seat readiness before interpreting behavior.
- Run on the host whose hostname is the intended <SEAT>; run-proofs.sh normalizes OPENCLAW_SEAT_NAME to hostname.
- OPENCLAW_GATEWAY_TOKEN is present in the environment; never write its value.
- Acquire the runner lock and run no other continuation row against the same session.

Same-session concurrency safe: **false**. Serialize this row under the runner lock and do not overlap another continuation row on the same target session.

## Run the committed automation first

```bash
cd tools/k6-proofs && \
K6_PROOF_OUT_DIR=/tmp/project86-proof-runs \
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
./scripts/run-proofs.sh --live R-CD-MODEL-DEFAULT <FINAL_CANDIDATE_SHA>
```

This command is instantiated from `tools/k6-proofs/docs/PROOF-RUN-METHOD.md:95-109 (row-list live command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.

Seat resolution: `run-proofs.sh` overwrites `OPENCLAW_SEAT_NAME` with the executing host's `hostname`. Run on the host intended by `<SEAT>`; use the resolved hostname in the committed artifact subtree.


## Required receipts

- `seat-readiness`
- `dispatch-accepted`
- `child-session-observed`
- `child-model-byte`
- `return-payload`
- `parent-model-byte`

## Required artifacts

- `seat-readiness.json`
- `row-manifest.json`
- `runner-metadata.json`
- `run-result.json`
- `k6.log`
- `evidence.jsonl`
- `evidence-lines.log`
- `evidence-redaction.json`
- `gateway-journal.log`
- `gateway-journal-capture.json`
- `gateway-journal-redaction.json`
- `r-cd-model-default-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CD-MODEL-DEFAULT/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-MODEL-DEFAULT`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-MODEL-DEFAULT/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-MODEL-DEFAULT/comparators/elliott-legion/20260719T192144Z-r-cd-model-default`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/140 (manifest.issue)

## Verdict contract

- **PASS:** Permitted after the committed behavior is observed and all required receipts are present: seat-readiness, dispatch-accepted, child-session-observed, child-model-byte, return-payload, parent-model-byte. Human review is still required before canonical fold.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/r-cd-model-default.js`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

Run the direct manifest-driven scenario with OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA>, OPENCLAW_SEAT_NAME=<SEAT>, OPENCLAW_SESSION_KEY=<SESSION_KEY>, OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-cd-model-default.json, and ./tools/k6-proofs/run-proof.sh r-cd-model-default. If that still does not execute the behavior, perform the manifest's typed-tool/token/read-only surface manually in a coordinated disposable session and collect the same named receipts from session history, the bounded sanitized gateway journal, and public-safe Tempo output. Do not copy prompt bodies into the issue or artifacts.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CD-MODEL-TOKEN: Prove bracket-token delegate model override

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CD-MODEL-TOKEN** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **live k6**
- Manifest: `tools/k6-proofs/manifests/r-cd-model-token.json`
- Scenario: `tools/k6-proofs/scenarios/r-cd-model-token.js`
- Contract: continue_delegate bracket/token form parses and forwards model=<provider/model> to the delegate child.
- Suggested owner/seat class: cael-dgx; raw-final-text scanner-capable gateway seat with disposable sessions.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- Run and retain public-safe seat readiness before interpreting behavior.
- Run on the host whose hostname is the intended <SEAT>; run-proofs.sh normalizes OPENCLAW_SEAT_NAME to hostname.
- OPENCLAW_GATEWAY_TOKEN is present in the environment; never write its value.
- Acquire the runner lock and run no other continuation row against the same session.
- Declare a raw-final-text scanner-capable seat before firing; message-body delivery cannot prove the token path.

Same-session concurrency safe: **false**. Serialize this row under the runner lock and do not overlap another continuation row on the same target session.

## Run the committed automation first

```bash
cd tools/k6-proofs && \
K6_PROOF_OUT_DIR=/tmp/project86-proof-runs \
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
./scripts/run-proofs.sh --live R-CD-MODEL-TOKEN <FINAL_CANDIDATE_SHA>
```

This command is instantiated from `tools/k6-proofs/docs/PROOF-RUN-METHOD.md:95-109 (row-list live command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.

Seat resolution: `run-proofs.sh` overwrites `OPENCLAW_SEAT_NAME` with the executing host's `hostname`. Run on the host intended by `<SEAT>`; use the resolved hostname in the committed artifact subtree.


## Required receipts

- `seat-readiness`
- `dispatch-accepted`
- `bracket-parse-origin`
- `bracket-model-modifier`
- `child-session-observed`
- `child-model-byte`
- `return-payload`

## Required artifacts

- `seat-readiness.json`
- `row-manifest.json`
- `runner-metadata.json`
- `run-result.json`
- `k6.log`
- `evidence.jsonl`
- `evidence-lines.log`
- `evidence-redaction.json`
- `gateway-journal.log`
- `gateway-journal-capture.json`
- `gateway-journal-redaction.json`
- `r-cd-model-token-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CD-MODEL-TOKEN/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-MODEL-TOKEN`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-MODEL-TOKEN/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-MODEL-TOKEN/comparators/elliott-legion/20260719T192207Z-r-cd-model-token`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/140 (manifest.issue)

## Verdict contract

- **PASS:** Permitted after the committed behavior is observed and all required receipts are present: seat-readiness, dispatch-accepted, bracket-parse-origin, bracket-model-modifier, child-session-observed, child-model-byte, return-payload. Human review is still required before canonical fold.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/r-cd-model-token.js`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

Run the direct manifest-driven scenario with OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA>, OPENCLAW_SEAT_NAME=<SEAT>, OPENCLAW_SESSION_KEY=<SESSION_KEY>, OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-cd-model-token.json, and ./tools/k6-proofs/run-proof.sh r-cd-model-token. If that still does not execute the behavior, perform the manifest's typed-tool/token/read-only surface manually in a coordinated disposable session and collect the same named receipts from session history, the bounded sanitized gateway journal, and public-safe Tempo output. Do not copy prompt bodies into the issue or artifacts.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CD-MODEL-TOOL: Prove typed delegate model override

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CD-MODEL-TOOL** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **live k6**
- Manifest: `tools/k6-proofs/manifests/r-cd-model-tool.json`
- Scenario: `tools/k6-proofs/scenarios/r-cd-model-tool.js`
- Contract: continue_delegate typed tool form forwards an explicit model override to the delegate child.
- Suggested owner/seat class: cael-dgx; gateway operator seat with a coordinated disposable session.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- Run and retain public-safe seat readiness before interpreting behavior.
- Run on the host whose hostname is the intended <SEAT>; run-proofs.sh normalizes OPENCLAW_SEAT_NAME to hostname.
- OPENCLAW_GATEWAY_TOKEN is present in the environment; never write its value.
- Acquire the runner lock and run no other continuation row against the same session.
- Use a seat with the requested model available; authoritative requested/observed mismatch is FAIL, not PARTIAL.
- Upstream model-forwarding issue karmaterminal/openclaw#1103 may affect the row.

Same-session concurrency safe: **false**. Serialize this row under the runner lock and do not overlap another continuation row on the same target session.

## Run the committed automation first

```bash
cd tools/k6-proofs && \
K6_PROOF_OUT_DIR=/tmp/project86-proof-runs \
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
./scripts/run-proofs.sh --live R-CD-MODEL-TOOL <FINAL_CANDIDATE_SHA>
```

This command is instantiated from `tools/k6-proofs/docs/PROOF-RUN-METHOD.md:95-109 (row-list live command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.

Seat resolution: `run-proofs.sh` overwrites `OPENCLAW_SEAT_NAME` with the executing host's `hostname`. Run on the host intended by `<SEAT>`; use the resolved hostname in the committed artifact subtree.


## Required receipts

- `seat-readiness`
- `dispatch-accepted`
- `requested-model-byte`
- `child-session-observed`
- `child-model-byte`
- `return-payload`

## Required artifacts

- `seat-readiness.json`
- `row-manifest.json`
- `runner-metadata.json`
- `run-result.json`
- `k6.log`
- `evidence.jsonl`
- `evidence-lines.log`
- `evidence-redaction.json`
- `gateway-journal.log`
- `gateway-journal-capture.json`
- `gateway-journal-redaction.json`
- `r-cd-model-tool-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CD-MODEL-TOOL/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-MODEL-TOOL`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-MODEL-TOOL/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-MODEL-TOOL/comparators/elliott-legion/20260719T192305Z-r-cd-model-tool`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/140 (manifest.issue)
- https://github.com/karmaterminal/openclaw/issues/1103 (manifest/scenario source reference)

## Verdict contract

- **PASS:** Permitted after the committed behavior is observed and all required receipts are present: seat-readiness, dispatch-accepted, requested-model-byte, child-session-observed, child-model-byte, return-payload. Human review is still required before canonical fold.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/r-cd-model-tool.js`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

Run the direct manifest-driven scenario with OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA>, OPENCLAW_SEAT_NAME=<SEAT>, OPENCLAW_SESSION_KEY=<SESSION_KEY>, OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-cd-model-tool.json, and ./tools/k6-proofs/run-proof.sh r-cd-model-tool. If that still does not execute the behavior, perform the manifest's typed-tool/token/read-only surface manually in a coordinated disposable session and collect the same named receipts from session history, the bounded sanitized gateway journal, and public-safe Tempo output. Do not copy prompt bodies into the issue or artifacts.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CD-RETURN-OVERLAP: Prove no delegate-return loss during overlap

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CD-RETURN-OVERLAP** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **static validator**
- Manifest: `tools/k6-proofs/manifests/r-cd-return-overlap.json`
- Scenario: `tools/k6-proofs/scenarios/r-cd-return-overlap.js`
- Contract: Offline/static validator for committed silent plus silent-wake delegate return overlap receipts in the current PROOFS corpus; proves collection/no-loss, not isolated wake causality.
- Suggested owner/seat class: cael-dgx; offline reviewer seat with k6 v2.0.0 and the committed reference corpus.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- The committed reference packet under PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203 is present for validator input.

Same-session concurrency safe: **true**. The manifest permits concurrency, but use a disposable/isolated session when the row can compact or alter session-local state.

## Run the committed automation first

```bash
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-cd-return-overlap.json \
k6 run tools/k6-proofs/scenarios/r-cd-return-overlap.js
```

This command is instantiated from `tools/k6-proofs/skill/SKILL.md:129-139 (direct k6 scenario command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.


## Required receipts

- `overlap-artifacts`
- `collection-no-loss`

## Required artifacts

- `r-cd-return-overlap-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CD-RETURN-OVERLAP/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-RETURN-OVERLAP`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-RETURN-OVERLAP/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-RETURN-OVERLAP/comparators/elliott-legion/20260719T192608Z-r-cd-return-overlap`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/246 (manifest.issue)

## Verdict contract

- **PASS:** A validator PASS proves only that the committed reference/source packet satisfies the static contract. It is not fresh final-candidate behavioral PASS; fresh manual candidate receipts are still required for that claim.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS. Static automation that passes while fresh candidate behavior remains unexecuted is still incomplete for the candidate behavior claim.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/r-cd-return-overlap.js`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/README.md`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

The committed automation validates the reference packet rather than fresh candidate behavior. Run it first, then replay the documented old/manual behavior from PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-RETURN-OVERLAP/EVIDENCE.md against <FINAL_CANDIDATE_SHA>, using tools/k6-proofs/manifests/r-cd-return-overlap.json as the receipt checklist and tools/k6-proofs/scenarios/r-cd-return-overlap.js as the validator contract. Capture fresh sanitized candidate receipts; do not claim the reference packet as candidate execution.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CD-SILENT: Prove silent delegate completion stays off-channel

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CD-SILENT** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **live k6**
- Manifest: `tools/k6-proofs/manifests/r-cd-silent.json`
- Scenario: `tools/k6-proofs/scenarios/r-cd-silent.js`
- Contract: Typed continue_delegate(mode='silent') proof. Fires a silent delegate, waits for child internal completion, then asks the parent to report the silent child token from internal context while checking no child channel delivery occurred.
- Suggested owner/seat class: cael-dgx; gateway operator seat with a coordinated disposable session.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- Run and retain public-safe seat readiness before interpreting behavior.
- Run on the host whose hostname is the intended <SEAT>; run-proofs.sh normalizes OPENCLAW_SEAT_NAME to hostname.
- OPENCLAW_GATEWAY_TOKEN is present in the environment; never write its value.
- Acquire the runner lock and run no other continuation row against the same session.

Same-session concurrency safe: **false**. Serialize this row under the runner lock and do not overlap another continuation row on the same target session.

## Run the committed automation first

```bash
cd tools/k6-proofs && \
K6_PROOF_OUT_DIR=/tmp/project86-proof-runs \
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
./scripts/run-proofs.sh --live R-CD-SILENT <FINAL_CANDIDATE_SHA>
```

This command is instantiated from `tools/k6-proofs/docs/PROOF-RUN-METHOD.md:95-109 (row-list live command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.

Seat resolution: `run-proofs.sh` overwrites `OPENCLAW_SEAT_NAME` with the executing host's `hostname`. Run on the host intended by `<SEAT>`; use the resolved hostname in the committed artifact subtree.


## Required receipts

- `seat-readiness`
- `dispatch-accepted`
- `delegate-scheduled-sentinel`
- `child-completion-observed`
- `followup-accepted`
- `parent-internal-context-observed`
- `no-channel-delivery`

## Required artifacts

- `seat-readiness.json`
- `row-manifest.json`
- `runner-metadata.json`
- `run-result.json`
- `k6.log`
- `evidence.jsonl`
- `evidence-lines.log`
- `evidence-redaction.json`
- `gateway-journal.log`
- `gateway-journal-capture.json`
- `gateway-journal-redaction.json`
- `r-cd-silent-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CD-SILENT/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-SILENT`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-SILENT/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-SILENT/comparators/elliott-legion/20260719T192610Z-r-cd-silent`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/119 (manifest.issue)

## Verdict contract

- **PASS:** Permitted after the committed behavior is observed and all required receipts are present: seat-readiness, dispatch-accepted, delegate-scheduled-sentinel, child-completion-observed, followup-accepted, parent-internal-context-observed, no-channel-delivery. Human review is still required before canonical fold.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/r-cd-silent.js`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

Run the direct manifest-driven scenario with OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA>, OPENCLAW_SEAT_NAME=<SEAT>, OPENCLAW_SESSION_KEY=<SESSION_KEY>, OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-cd-silent.json, and ./tools/k6-proofs/run-proof.sh r-cd-silent. If that still does not execute the behavior, perform the manifest's typed-tool/token/read-only surface manually in a coordinated disposable session and collect the same named receipts from session history, the bounded sanitized gateway journal, and public-safe Tempo output. Do not copy prompt bodies into the issue or artifacts.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CD-TOKEN: Prove terminal bracket continue_delegate end to end

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CD-TOKEN** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **live k6**
- Manifest: `tools/k6-proofs/manifests/r-cd-token.json`
- Scenario: `tools/k6-proofs/scenarios/r-cd-token-bracket-delegate.js`
- Contract: Terminal [[CONTINUE_DELEGATE:...]] path from an isolated raw-final-text child; joins a runner-owned attempt to exactly one origin task, one token-scheduled delegate, completion, return, and Tempo topology.
- Suggested owner/seat class: elliott-legion; raw-final-text scanner-capable gateway seat with disposable sessions.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- Run and retain public-safe seat readiness before interpreting behavior.
- Run on the host whose hostname is the intended <SEAT>; run-proofs.sh normalizes OPENCLAW_SEAT_NAME to hostname.
- OPENCLAW_GATEWAY_TOKEN is present in the environment; never write its value.
- Acquire the runner lock and run no other continuation row against the same session.
- Candidate and deployed runtime must be the same exact 40-character SHA.
- Use a disposable raw-final-text origin; message-body or unknown seat classes remain PARTIAL without dispatch.

Same-session concurrency safe: **false**. Serialize this row under the runner lock and do not overlap another continuation row on the same target session.

## Run the committed automation first

```bash
cd tools/k6-proofs && \
K6_PROOF_OUT_DIR=/tmp/project86-proof-runs \
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
./scripts/run-proofs.sh --live R-CD-TOKEN <FINAL_CANDIDATE_SHA>
```

This command is instantiated from `tools/k6-proofs/docs/PROOF-RUN-METHOD.md:95-109 (row-list live command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.

Seat resolution: `run-proofs.sh` overwrites `OPENCLAW_SEAT_NAME` with the executing host's `hostname`. Run on the host intended by `<SEAT>`; use the resolved hostname in the committed artifact subtree.


## Required receipts

- `exact-candidate-runtime-identity`
- `attempt-state`
- `raw-final-text-origin`
- `prompt-injected`
- `parser-detected`
- `queue-identity`
- `child-spawned`
- `child-completed`
- `parent-return-event`
- `tempo-trace-json`
- `continuation-trace-correlation`

## Required artifacts

- `seat-readiness.json`
- `row-manifest.json`
- `runner-metadata.json`
- `run-result.json`
- `k6.log`
- `evidence.jsonl`
- `evidence-lines.log`
- `evidence-redaction.json`
- `gateway-journal.log`
- `gateway-journal-capture.json`
- `gateway-journal-redaction.json`
- `r-cd-token-bracket-delegate-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CD-TOKEN/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-TOKEN`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-TOKEN/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CD-TOKEN/comparators/elliott-legion/20260719T192737Z-r-cd-token`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/103 (manifest.issue)

## Verdict contract

- **PASS:** PASS-candidate is permitted only through the row-scoped authoritative receipt on an exact-SHA raw-final-text disposable attempt with one parser/queue/child/return identity and valid Tempo topology.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/r-cd-token-bracket-delegate.js`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

Run the direct manifest-driven scenario with OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA>, OPENCLAW_SEAT_NAME=<SEAT>, OPENCLAW_SESSION_KEY=<SESSION_KEY>, OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-cd-token.json, and ./tools/k6-proofs/run-proof.sh r-cd-token-bracket-delegate. If that still does not execute the behavior, perform the manifest's typed-tool/token/read-only surface manually in a coordinated disposable session and collect the same named receipts from session history, the bounded sanitized gateway journal, and public-safe Tempo output. Do not copy prompt bodies into the issue or artifacts.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CONFIG-DEFAULTS: Prove continuation bootstrap defaults

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CONFIG-DEFAULTS** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **live k6**
- Manifest: `tools/k6-proofs/manifests/r-config-defaults.json`
- Scenario: `tools/k6-proofs/scenarios/r-config-defaults.js`
- Contract: Read-only continuation config defaults via direct authenticated operator config.get RPC.
- Suggested owner/seat class: elliott-legion; gateway operator seat with a coordinated disposable session.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- Run and retain public-safe seat readiness before interpreting behavior.
- Run on the host whose hostname is the intended <SEAT>; run-proofs.sh normalizes OPENCLAW_SEAT_NAME to hostname.
- OPENCLAW_GATEWAY_TOKEN is present in the environment; never write its value.

Same-session concurrency safe: **true**. The manifest permits concurrency, but use a disposable/isolated session when the row can compact or alter session-local state.

## Run the committed automation first

```bash
cd tools/k6-proofs && \
K6_PROOF_OUT_DIR=/tmp/project86-proof-runs \
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
./scripts/run-proofs.sh --live R-CONFIG-DEFAULTS <FINAL_CANDIDATE_SHA>
```

This command is instantiated from `tools/k6-proofs/docs/PROOF-RUN-METHOD.md:95-109 (row-list live command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.

Seat resolution: `run-proofs.sh` overwrites `OPENCLAW_SEAT_NAME` with the executing host's `hostname`. Run on the host intended by `<SEAT>`; use the resolved hostname in the committed artifact subtree.


## Required receipts

- `seat-readiness`
- `config-read`
- `continuation-values`

## Required artifacts

- `seat-readiness.json`
- `row-manifest.json`
- `runner-metadata.json`
- `run-result.json`
- `k6.log`
- `evidence.jsonl`
- `evidence-lines.log`
- `evidence-redaction.json`
- `gateway-journal.log`
- `gateway-journal-capture.json`
- `gateway-journal-redaction.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CONFIG-DEFAULTS/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CONFIG-DEFAULTS`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CONFIG-DEFAULTS/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CONFIG-DEFAULTS/comparators/elliott-legion/20260719T192739Z-r-config-defaults`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/104 (manifest.issue)

## Verdict contract

- **PASS:** Permitted after the committed behavior is observed and all required receipts are present: seat-readiness, config-read, continuation-values. Human review is still required before canonical fold.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/r-config-defaults.js`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

Run the direct manifest-driven scenario with OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA>, OPENCLAW_SEAT_NAME=<SEAT>, OPENCLAW_SESSION_KEY=<SESSION_KEY>, OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-config-defaults.json, and ./tools/k6-proofs/run-proof.sh r-config-defaults. If that still does not execute the behavior, perform the manifest's typed-tool/token/read-only surface manually in a coordinated disposable session and collect the same named receipts from session history, the bounded sanitized gateway journal, and public-safe Tempo output. Do not copy prompt bodies into the issue or artifacts.

## Failure routing and landing

The default failure scope is **live continuation rows on the affected seat**. A disabled/missing continuation substrate or candidate/runtime mismatch halts dependent live rows on this seat; independent static/fixture rows continue.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CONFIG-INTERSESSION: Prove cross-session continuation configuration

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CONFIG-INTERSESSION** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **live k6**
- Manifest: `tools/k6-proofs/manifests/r-config-intersession.json`
- Scenario: `tools/k6-proofs/scenarios/r-config-intersession.js`
- Contract: Read-only continuation cross-session targeting config receipt via direct authenticated operator config.get RPC.
- Suggested owner/seat class: elliott-legion; gateway operator seat with a coordinated disposable session.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- Run and retain public-safe seat readiness before interpreting behavior.
- Run on the host whose hostname is the intended <SEAT>; run-proofs.sh normalizes OPENCLAW_SEAT_NAME to hostname.
- OPENCLAW_GATEWAY_TOKEN is present in the environment; never write its value.

Same-session concurrency safe: **true**. The manifest permits concurrency, but use a disposable/isolated session when the row can compact or alter session-local state.

## Run the committed automation first

```bash
cd tools/k6-proofs && \
K6_PROOF_OUT_DIR=/tmp/project86-proof-runs \
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
./scripts/run-proofs.sh --live R-CONFIG-INTERSESSION <FINAL_CANDIDATE_SHA>
```

This command is instantiated from `tools/k6-proofs/docs/PROOF-RUN-METHOD.md:95-109 (row-list live command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.

Seat resolution: `run-proofs.sh` overwrites `OPENCLAW_SEAT_NAME` with the executing host's `hostname`. Run on the host intended by `<SEAT>`; use the resolved hostname in the committed artifact subtree.


## Required receipts

- `seat-readiness`
- `config-read`
- `cross-session-targeting`

## Required artifacts

- `seat-readiness.json`
- `row-manifest.json`
- `runner-metadata.json`
- `run-result.json`
- `k6.log`
- `evidence.jsonl`
- `evidence-lines.log`
- `evidence-redaction.json`
- `gateway-journal.log`
- `gateway-journal-capture.json`
- `gateway-journal-redaction.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CONFIG-INTERSESSION/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CONFIG-INTERSESSION`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CONFIG-INTERSESSION/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CONFIG-INTERSESSION/comparators/elliott-legion/20260719T192743Z-r-config-intersession`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/121 (manifest.issue)

## Verdict contract

- **PASS:** Permitted after the committed behavior is observed and all required receipts are present: seat-readiness, config-read, cross-session-targeting. Human review is still required before canonical fold.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/r-config-intersession.js`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

Run the direct manifest-driven scenario with OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA>, OPENCLAW_SEAT_NAME=<SEAT>, OPENCLAW_SESSION_KEY=<SESSION_KEY>, OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-config-intersession.json, and ./tools/k6-proofs/run-proof.sh r-config-intersession. If that still does not execute the behavior, perform the manifest's typed-tool/token/read-only surface manually in a coordinated disposable session and collect the same named receipts from session history, the bounded sanitized gateway journal, and public-safe Tempo output. Do not copy prompt bodies into the issue or artifacts.

## Failure routing and landing

The default failure scope is **live continuation rows on the affected seat**. A disabled/missing continuation substrate or candidate/runtime mismatch halts dependent live rows on this seat; independent static/fixture rows continue.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CW-1: Prove typed continue_work schedule and wake

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CW-1** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **live k6**
- Manifest: `tools/k6-proofs/manifests/r-cw-1.json`
- Scenario: `tools/k6-proofs/scenarios/r-cw-1-tool-schedule-wake.js`
- Contract: Typed continue_work() tool-form schedule + wake. Fires continue_work with a reason, observes the scheduled work entry and wake event on the session.
- Suggested owner/seat class: silas-lothric; gateway operator seat with a coordinated disposable session.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- Run and retain public-safe seat readiness before interpreting behavior.
- Run on the host whose hostname is the intended <SEAT>; run-proofs.sh normalizes OPENCLAW_SEAT_NAME to hostname.
- OPENCLAW_GATEWAY_TOKEN is present in the environment; never write its value.
- Acquire the runner lock and run no other continuation row against the same session.

Same-session concurrency safe: **false**. Serialize this row under the runner lock and do not overlap another continuation row on the same target session.

## Run the committed automation first

```bash
cd tools/k6-proofs && \
K6_PROOF_OUT_DIR=/tmp/project86-proof-runs \
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
./scripts/run-proofs.sh --live R-CW-1 <FINAL_CANDIDATE_SHA>
```

This command is instantiated from `tools/k6-proofs/docs/PROOF-RUN-METHOD.md:95-109 (row-list live command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.

Seat resolution: `run-proofs.sh` overwrites `OPENCLAW_SEAT_NAME` with the executing host's `hostname`. Run on the host intended by `<SEAT>`; use the resolved hostname in the committed artifact subtree.


## Required receipts

- `seat-readiness`
- `tool-invoke-accepted`
- `continue-work-tool-result-scheduled`
- `work-woke-event`
- `trace-id`

## Required artifacts

- `seat-readiness.json`
- `row-manifest.json`
- `runner-metadata.json`
- `run-result.json`
- `k6.log`
- `evidence.jsonl`
- `evidence-lines.log`
- `evidence-redaction.json`
- `gateway-journal.log`
- `gateway-journal-capture.json`
- `gateway-journal-redaction.json`
- `r-cw-1-tool-schedule-wake-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CW-1/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-1`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-1/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-1/comparators/elliott-legion/20260719T192746Z-r-cw-1`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/117 (manifest.issue)

## Verdict contract

- **PASS:** Permitted after the committed behavior is observed and all required receipts are present: seat-readiness, tool-invoke-accepted, continue-work-tool-result-scheduled, work-woke-event, trace-id. Human review is still required before canonical fold.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/r-cw-1-tool-schedule-wake.js`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

Run the direct manifest-driven scenario with OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA>, OPENCLAW_SEAT_NAME=<SEAT>, OPENCLAW_SESSION_KEY=<SESSION_KEY>, OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-cw-1.json, and ./tools/k6-proofs/run-proof.sh r-cw-1-tool-schedule-wake. If that still does not execute the behavior, perform the manifest's typed-tool/token/read-only surface manually in a coordinated disposable session and collect the same named receipts from session history, the bounded sanitized gateway journal, and public-safe Tempo output. Do not copy prompt bodies into the issue or artifacts.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CW-2: Prove immediate continue_work wake

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CW-2** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **live k6**
- Manifest: `tools/k6-proofs/manifests/r-cw-2.json`
- Scenario: `tools/k6-proofs/scenarios/r-cw-2-immediate-wake.js`
- Contract: Typed continue_work(delaySeconds=0) immediate wake proof. Requires an explicit scheduled sentinel and a continuation wake sentinel, while ignoring harness prompt echoes.
- Suggested owner/seat class: ronan-dgx; gateway operator seat with a coordinated disposable session.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- Run and retain public-safe seat readiness before interpreting behavior.
- Run on the host whose hostname is the intended <SEAT>; run-proofs.sh normalizes OPENCLAW_SEAT_NAME to hostname.
- OPENCLAW_GATEWAY_TOKEN is present in the environment; never write its value.
- Acquire the runner lock and run no other continuation row against the same session.

Same-session concurrency safe: **false**. Serialize this row under the runner lock and do not overlap another continuation row on the same target session.

## Run the committed automation first

```bash
cd tools/k6-proofs && \
K6_PROOF_OUT_DIR=/tmp/project86-proof-runs \
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
./scripts/run-proofs.sh --live R-CW-2 <FINAL_CANDIDATE_SHA>
```

This command is instantiated from `tools/k6-proofs/docs/PROOF-RUN-METHOD.md:95-109 (row-list live command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.

Seat resolution: `run-proofs.sh` overwrites `OPENCLAW_SEAT_NAME` with the executing host's `hostname`. Run on the host intended by `<SEAT>`; use the resolved hostname in the committed artifact subtree.


## Required receipts

- `seat-readiness`
- `dispatch-accepted`
- `continue-work-tool-result-scheduled`
- `immediate-wake-event`
- `prompt-echo-filtered`

## Required artifacts

- `seat-readiness.json`
- `row-manifest.json`
- `runner-metadata.json`
- `run-result.json`
- `k6.log`
- `evidence.jsonl`
- `evidence-lines.log`
- `evidence-redaction.json`
- `gateway-journal.log`
- `gateway-journal-capture.json`
- `gateway-journal-redaction.json`
- `r-cw-2-immediate-wake-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CW-2/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-2`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-2/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-2/comparators/elliott-legion/20260719T193020Z-r-cw-2`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/117 (manifest.issue)

## Verdict contract

- **PASS:** Permitted after the committed behavior is observed and all required receipts are present: seat-readiness, dispatch-accepted, continue-work-tool-result-scheduled, immediate-wake-event, prompt-echo-filtered. Human review is still required before canonical fold.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/r-cw-2-immediate-wake.js`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

Run the direct manifest-driven scenario with OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA>, OPENCLAW_SEAT_NAME=<SEAT>, OPENCLAW_SESSION_KEY=<SESSION_KEY>, OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-cw-2.json, and ./tools/k6-proofs/run-proof.sh r-cw-2-immediate-wake. If that still does not execute the behavior, perform the manifest's typed-tool/token/read-only surface manually in a coordinated disposable session and collect the same named receipts from session history, the bounded sanitized gateway journal, and public-safe Tempo output. Do not copy prompt bodies into the issue or artifacts.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CW-3: Prove continue_work reason telemetry and redaction

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CW-3** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **live k6**
- Manifest: `tools/k6-proofs/manifests/r-cw-3.json`
- Scenario: `tools/k6-proofs/scenarios/r-cw-3-reason-telemetry.js`
- Contract: continue_work reason telemetry/redaction partial candidate. k6 proves schedule+wake and keeps the raw reason out of public artifacts; Tempo JSON review must verify safe reason attrs present and raw reason absent before a PASS fold.
- Suggested owner/seat class: ronan-dgx; gateway operator seat with a coordinated disposable session.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- Run and retain public-safe seat readiness before interpreting behavior.
- Run on the host whose hostname is the intended <SEAT>; run-proofs.sh normalizes OPENCLAW_SEAT_NAME to hostname.
- OPENCLAW_GATEWAY_TOKEN is present in the environment; never write its value.
- Acquire the runner lock and run no other continuation row against the same session.

Same-session concurrency safe: **false**. Serialize this row under the runner lock and do not overlap another continuation row on the same target session.

## Run the committed automation first

```bash
cd tools/k6-proofs && \
K6_PROOF_OUT_DIR=/tmp/project86-proof-runs \
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
./scripts/run-proofs.sh --live R-CW-3 <FINAL_CANDIDATE_SHA>
```

This command is instantiated from `tools/k6-proofs/docs/PROOF-RUN-METHOD.md:95-109 (row-list live command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.

Seat resolution: `run-proofs.sh` overwrites `OPENCLAW_SEAT_NAME` with the executing host's `hostname`. Run on the host intended by `<SEAT>`; use the resolved hostname in the committed artifact subtree.


## Required receipts

- `seat-readiness`
- `dispatch-accepted`
- `continue-work-tool-result-scheduled`
- `work-woke-event`
- `public-artifact-raw-reason-absent`
- `tempo-trace-json`
- `reason-telemetry-redaction-review`

## Required artifacts

- `seat-readiness.json`
- `row-manifest.json`
- `runner-metadata.json`
- `run-result.json`
- `k6.log`
- `evidence.jsonl`
- `evidence-lines.log`
- `evidence-redaction.json`
- `gateway-journal.log`
- `gateway-journal-capture.json`
- `gateway-journal-redaction.json`
- `r-cw-3-reason-telemetry-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CW-3/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-3`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-3/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-3/comparators/elliott-legion/20260719T193152Z-r-cw-3`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/117 (manifest.issue)

## Verdict contract

- **PASS:** The scenario itself remains PARTIAL-candidate. PASS is permitted only after the reason-telemetry review confirms safe reason.present/length/hash attributes and proves raw reason bytes absent.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/r-cw-3-reason-telemetry.js`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

Run the direct manifest-driven scenario with OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA>, OPENCLAW_SEAT_NAME=<SEAT>, OPENCLAW_SESSION_KEY=<SESSION_KEY>, OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-cw-3.json, and ./tools/k6-proofs/run-proof.sh r-cw-3-reason-telemetry. If that still does not execute the behavior, perform the manifest's typed-tool/token/read-only surface manually in a coordinated disposable session and collect the same named receipts from session history, the bounded sanitized gateway journal, and public-safe Tempo output. Do not copy prompt bodies into the issue or artifacts.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CW-4: Prove three-hop continue_work chain depth

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CW-4** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **live k6**
- Manifest: `tools/k6-proofs/manifests/r-cw-4.json`
- Scenario: `tools/k6-proofs/scenarios/r-cw-4-chain-depth.js`
- Contract: Chain depth hop counter: fires continue_work 3× in sequence, verifies hop increments from 1/200 → 3/200 in traced responses.
- Suggested owner/seat class: ronan-dgx; gateway operator seat with a coordinated disposable session.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- Run and retain public-safe seat readiness before interpreting behavior.
- Run on the host whose hostname is the intended <SEAT>; run-proofs.sh normalizes OPENCLAW_SEAT_NAME to hostname.
- OPENCLAW_GATEWAY_TOKEN is present in the environment; never write its value.
- Acquire the runner lock and run no other continuation row against the same session.

Same-session concurrency safe: **false**. Serialize this row under the runner lock and do not overlap another continuation row on the same target session.

## Run the committed automation first

```bash
cd tools/k6-proofs && \
K6_PROOF_OUT_DIR=/tmp/project86-proof-runs \
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
./scripts/run-proofs.sh --live R-CW-4 <FINAL_CANDIDATE_SHA>
```

This command is instantiated from `tools/k6-proofs/docs/PROOF-RUN-METHOD.md:95-109 (row-list live command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.

Seat resolution: `run-proofs.sh` overwrites `OPENCLAW_SEAT_NAME` with the executing host's `hostname`. Run on the host intended by `<SEAT>`; use the resolved hostname in the committed artifact subtree.


## Required receipts

- `seat-readiness`
- `hop-1-accepted`
- `hop-2-accepted`
- `hop-3-accepted`
- `final-done`

## Required artifacts

- `seat-readiness.json`
- `row-manifest.json`
- `runner-metadata.json`
- `run-result.json`
- `k6.log`
- `evidence.jsonl`
- `evidence-lines.log`
- `evidence-redaction.json`
- `gateway-journal.log`
- `gateway-journal-capture.json`
- `gateway-journal-redaction.json`
- `r-cw-4-chain-depth-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CW-4/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-4`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-4/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-4/comparators/elliott-legion/20260719T193747Z-r-cw-4`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/117 (manifest.issue)

## Verdict contract

- **PASS:** Permitted after the committed behavior is observed and all required receipts are present: seat-readiness, hop-1-accepted, hop-2-accepted, hop-3-accepted, final-done. Human review is still required before canonical fold.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/r-cw-4-chain-depth.js`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

Run the direct manifest-driven scenario with OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA>, OPENCLAW_SEAT_NAME=<SEAT>, OPENCLAW_SESSION_KEY=<SESSION_KEY>, OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-cw-4.json, and ./tools/k6-proofs/run-proof.sh r-cw-4-chain-depth. If that still does not execute the behavior, perform the manifest's typed-tool/token/read-only surface manually in a coordinated disposable session and collect the same named receipts from session history, the bounded sanitized gateway journal, and public-safe Tempo output. Do not copy prompt bodies into the issue or artifacts.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CW-5: Prove continue_work cost-cap rejection in the isolated fixture

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CW-5** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **isolated fixture**
- Manifest: `tools/k6-proofs/manifests/r-cw-5.json`
- Scenario: `tools/k6-proofs/scenarios/r-cw-5-cost-cap-reject.js`
- Contract: Cost-cap exhaustion uses a disposable exact-candidate typed-tool fixture; continue_work is intentionally not externally invocable through the gateway loopback.
- Suggested owner/seat class: ronan-dgx; source-capable isolated fixture seat with a clean exact-candidate worktree and pinned pnpm.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- Acquire the runner lock and run no other continuation row against the same session.
- Use a clean exact-candidate source worktree and a new empty private artifact directory.
- Use the exact pnpm/lockfile dependency state required by the fixture; never reuse source node_modules.

Same-session concurrency safe: **false**. Serialize this row under the runner lock and do not overlap another continuation row on the same target session.

## Run the committed automation first

```bash
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
node tools/k6-proofs/scripts/run-cost-cap-fixture.mjs \
  --source-dir <EXACT_CANDIDATE_WORKTREE> \
  --candidate-sha <FINAL_CANDIDATE_SHA> \
  --artifact-dir <EMPTY_PRIVATE_ARTIFACT_DIR> --cap 100 --json
```

This command is instantiated from `tools/k6-proofs/docs/R-CW-5-ISOLATED-TOOL-SURFACE.md:40-47`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.


## Required receipts

- `fixture-readiness`
- `boundary-matrix`
- `typed-tool-surface`
- `dispatch-boundary-suite`
- `cleanup`

## Required artifacts

- `fixture-readiness.json`
- `boundary-matrix.json`
- `typed-tool-surface.json`
- `dispatch-boundary-suite.json`
- `cleanup.json`
- `fixture-result.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CW-5/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-5`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-5/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-5/comparators/elliott-legion/20260719T194733Z-r-cw-5`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/117 (manifest.issue)

## Verdict contract

- **PASS:** Permitted after the committed behavior is observed and all required receipts are present: fixture-readiness, boundary-matrix, typed-tool-surface, dispatch-boundary-suite, cleanup. Human review is still required before canonical fold.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS. A source/toolchain/setup mismatch before authoritative fixture execution is setup debt, not product failure.
- **FAIL:** Use FAIL-fixture/FAIL-candidate when the exact-candidate fixture executes and any required production boundary, no-spawn, recovery, cleanup, or public-safety assertion fails.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/R-CW-5-ISOLATED-TOOL-SURFACE.md`
- `tools/k6-proofs/README.md`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

Do not use the fail-closed k6 scaffold or mutate a live gateway. Follow the five production-surface steps in tools/k6-proofs/docs/R-CW-5-ISOLATED-TOOL-SURFACE.md inside a clean exact-candidate disposable worktree, then preserve every fixture receipt and cleanup result.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CW-5A: Validate the static R-CW-5 source and harness boundary

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CW-5A** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **static validator**
- Manifest: `tools/k6-proofs/manifests/r-cw-5a-static.json`
- Scenario: `tools/k6-proofs/scenarios/static-corpus-row-validator.js`
- Contract: Offline source/harness contract check for R-CW-5; cannot establish live cap exhaustion.
- Suggested owner/seat class: ronan-dgx; offline reviewer seat with k6 v2.0.0 and the committed reference corpus.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- The committed reference packet under PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203 is present for validator input.

Same-session concurrency safe: **true**. The manifest permits concurrency, but use a disposable/isolated session when the row can compact or alter session-local state.

## Run the committed automation first

```bash
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-cw-5a-static.json \
k6 run tools/k6-proofs/scenarios/static-corpus-row-validator.js
```

This command is instantiated from `tools/k6-proofs/skill/SKILL.md:129-139 (direct k6 scenario command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.


## Required receipts

- `static-source-harness-evidence`
- `non-live-boundary`

## Required artifacts

- `static-corpus-row-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CW-5A/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/README.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/proofs-manifest.json`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/117 (manifest.issue)

## Verdict contract

- **PASS:** Not permitted as a runtime row PASS. Successful automation emits construct-only/non-live-boundary evidence.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS. Static automation that passes while fresh candidate behavior remains unexecuted is still incomplete for the candidate behavior claim.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/static-corpus-row-validator.js`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/README.md`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

The committed automation validates the reference packet rather than fresh candidate behavior. Run it first, then replay the documented old/manual behavior from PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/proofs-manifest.json against <FINAL_CANDIDATE_SHA>, using tools/k6-proofs/manifests/r-cw-5a-static.json as the receipt checklist and tools/k6-proofs/scenarios/static-corpus-row-validator.js as the validator contract. Capture fresh sanitized candidate receipts; do not claim the reference packet as candidate execution.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CW-6: Prove max-chain rejection and recovery in the isolated fixture

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CW-6** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **isolated fixture**
- Manifest: `tools/k6-proofs/manifests/r-cw-6.json`
- Scenario: `tools/k6-proofs/scenarios/r-cw-6-max-chain-length.js`
- Contract: The max-chain boundary uses a disposable exact-candidate runtime fixture; continue_work is intentionally not externally invocable through the gateway loopback.
- Suggested owner/seat class: ronan-dgx; source-capable isolated fixture seat with a clean exact-candidate worktree and pinned pnpm.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- Acquire the runner lock and run no other continuation row against the same session.
- Use a clean exact-candidate source worktree and a new empty private artifact directory.
- Use the exact pnpm/lockfile dependency state required by the fixture; never reuse source node_modules.

Same-session concurrency safe: **false**. Serialize this row under the runner lock and do not overlap another continuation row on the same target session.

## Run the committed automation first

```bash
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
node tools/k6-proofs/scripts/run-max-chain-fixture.mjs \
  --source-dir <EXACT_CANDIDATE_WORKTREE> \
  --candidate-sha <FINAL_CANDIDATE_SHA> \
  --artifact-dir <EMPTY_PRIVATE_ARTIFACT_DIR> \
  --max-chain-length 3 --json
```

This command is instantiated from `tools/k6-proofs/docs/R-CW-6-ISOLATED-MAX-CHAIN.md:67-75`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.


## Required receipts

- `fixture-readiness`
- `boundary-matrix`
- `runtime-boundary`
- `durable-state-recovery`
- `typed-tool-surface`
- `dispatch-boundary-suite`
- `cleanup`
- `public-artifact-safety`

## Required artifacts

- `fixture-readiness.json`
- `boundary-matrix.json`
- `runtime-boundary.json`
- `durable-state-recovery.json`
- `typed-tool-surface.json`
- `dispatch-boundary-suite.json`
- `cleanup.json`
- `public-artifact-safety.json`
- `fixture-result.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CW-6/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-6`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-6/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-6/comparators/elliott-legion/20260719T194807Z-r-cw-6`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/117 (manifest.issue)

## Verdict contract

- **PASS:** Permitted after the committed behavior is observed and all required receipts are present: fixture-readiness, boundary-matrix, runtime-boundary, durable-state-recovery, typed-tool-surface, dispatch-boundary-suite, cleanup, public-artifact-safety. Human review is still required before canonical fold.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS. A source/toolchain/setup mismatch before authoritative fixture execution is setup debt, not product failure.
- **FAIL:** Use FAIL-fixture/FAIL-candidate when the exact-candidate fixture executes and any required production boundary, no-spawn, recovery, cleanup, or public-safety assertion fails.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/R-CW-6-ISOLATED-MAX-CHAIN.md`
- `tools/k6-proofs/README.md`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

Do not use the fail-closed k6 scaffold or patch/restart a gateway. Follow the exact-candidate runtime, recovery, typed-tool, dispatcher, cleanup, and public-artifact-safety steps in tools/k6-proofs/docs/R-CW-6-ISOLATED-MAX-CHAIN.md.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CW-6A: Validate the static R-CW-6 source and harness boundary

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CW-6A** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **static validator**
- Manifest: `tools/k6-proofs/manifests/r-cw-6a-static.json`
- Scenario: `tools/k6-proofs/scenarios/static-corpus-row-validator.js`
- Contract: Offline source/harness contract check for R-CW-6; cannot establish the process-local runtime boundary receipt.
- Suggested owner/seat class: ronan-dgx; offline reviewer seat with k6 v2.0.0 and the committed reference corpus.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- The committed reference packet under PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203 is present for validator input.

Same-session concurrency safe: **true**. The manifest permits concurrency, but use a disposable/isolated session when the row can compact or alter session-local state.

## Run the committed automation first

```bash
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-cw-6a-static.json \
k6 run tools/k6-proofs/scenarios/static-corpus-row-validator.js
```

This command is instantiated from `tools/k6-proofs/skill/SKILL.md:129-139 (direct k6 scenario command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.


## Required receipts

- `static-source-harness-evidence`
- `non-runtime-boundary`

## Required artifacts

- `static-corpus-row-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CW-6A/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/README.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/proofs-manifest.json`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/117 (manifest.issue)

## Verdict contract

- **PASS:** Not permitted as a runtime row PASS. Successful automation emits construct-only/non-live-boundary evidence.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS. Static automation that passes while fresh candidate behavior remains unexecuted is still incomplete for the candidate behavior claim.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/static-corpus-row-validator.js`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/README.md`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

The committed automation validates the reference packet rather than fresh candidate behavior. Run it first, then replay the documented old/manual behavior from PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/proofs-manifest.json against <FINAL_CANDIDATE_SHA>, using tools/k6-proofs/manifests/r-cw-6a-static.json as the receipt checklist and tools/k6-proofs/scenarios/static-corpus-row-validator.js as the validator contract. Capture fresh sanitized candidate receipts; do not claim the reference packet as candidate execution.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CW-7: Prove continuation traceparent propagation

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CW-7** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **static validator**
- Manifest: `tools/k6-proofs/manifests/r-cw-7.json`
- Scenario: `tools/k6-proofs/scenarios/static-corpus-row-validator.js`
- Contract: Static validator for committed runtime traceparent propagation source/test receipts.
- Suggested owner/seat class: ronan-dgx; offline reviewer seat with k6 v2.0.0 and the committed reference corpus.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- The committed reference packet under PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203 is present for validator input.

Same-session concurrency safe: **true**. The manifest permits concurrency, but use a disposable/isolated session when the row can compact or alter session-local state.

## Run the committed automation first

```bash
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-cw-7.json \
k6 run tools/k6-proofs/scenarios/static-corpus-row-validator.js
```

This command is instantiated from `tools/k6-proofs/skill/SKILL.md:129-139 (direct k6 scenario command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.


## Required receipts

- `traceparent-propagation-artifacts`
- `traceparent-propagation-tests`

## Required artifacts

- `static-corpus-row-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CW-7/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-7`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-7/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-7/comparators/elliott-legion/20260719T193844Z-r-cw-7`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/220 (manifest.issue)

## Verdict contract

- **PASS:** A validator PASS proves only that the committed reference/source packet satisfies the static contract. It is not fresh final-candidate behavioral PASS; fresh manual candidate receipts are still required for that claim.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS. Static automation that passes while fresh candidate behavior remains unexecuted is still incomplete for the candidate behavior claim.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/static-corpus-row-validator.js`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/README.md`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

The committed automation validates the reference packet rather than fresh candidate behavior. Run it first, then replay the documented old/manual behavior from PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-7/EVIDENCE.md against <FINAL_CANDIDATE_SHA>, using tools/k6-proofs/manifests/r-cw-7.json as the receipt checklist and tools/k6-proofs/scenarios/static-corpus-row-validator.js as the validator contract. Capture fresh sanitized candidate receipts; do not claim the reference packet as candidate execution.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CW-DELEGATE-CHILD-LIVE: Prove live continue_work hop two in a delegate child

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CW-DELEGATE-CHILD-LIVE** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **static validator**
- Manifest: `tools/k6-proofs/manifests/r-cw-delegate-child-live.json`
- Scenario: `tools/k6-proofs/scenarios/static-corpus-row-validator.js`
- Contract: Static validator for committed delegate-child self-continuation hop1/hop2 receipts.
- Suggested owner/seat class: ronan-dgx; offline reviewer seat with k6 v2.0.0 and the committed reference corpus.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- The committed reference packet under PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203 is present for validator input.

Same-session concurrency safe: **true**. The manifest permits concurrency, but use a disposable/isolated session when the row can compact or alter session-local state.

## Run the committed automation first

```bash
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-cw-delegate-child-live.json \
k6 run tools/k6-proofs/scenarios/static-corpus-row-validator.js
```

This command is instantiated from `tools/k6-proofs/skill/SKILL.md:129-139 (direct k6 scenario command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.


## Required receipts

- `delegate-child-hop-artifacts`
- `delegate-child-hop2-executed`

## Required artifacts

- `static-corpus-row-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CW-DELEGATE-CHILD-LIVE/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-DELEGATE-CHILD-LIVE`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-DELEGATE-CHILD-LIVE/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-DELEGATE-CHILD-LIVE/comparators/elliott-legion/20260719T193847Z-r-cw-delegate-child-live`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/213 (manifest.issue)

## Verdict contract

- **PASS:** A validator PASS proves only that the committed reference/source packet satisfies the static contract. It is not fresh final-candidate behavioral PASS; fresh manual candidate receipts are still required for that claim.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS. Static automation that passes while fresh candidate behavior remains unexecuted is still incomplete for the candidate behavior claim.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/static-corpus-row-validator.js`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/README.md`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

The committed automation validates the reference packet rather than fresh candidate behavior. Run it first, then replay the documented old/manual behavior from PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-DELEGATE-CHILD-LIVE/EVIDENCE.md against <FINAL_CANDIDATE_SHA>, using tools/k6-proofs/manifests/r-cw-delegate-child-live.json as the receipt checklist and tools/k6-proofs/scenarios/static-corpus-row-validator.js as the validator contract. Capture fresh sanitized candidate receipts; do not claim the reference packet as candidate execution.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CW-DELEGATE-SELF-CONTINUATION: Prove delegate self-continuation

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CW-DELEGATE-SELF-CONTINUATION** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **live k6**
- Manifest: `tools/k6-proofs/manifests/r-cw-delegate-self.json`
- Scenario: `tools/k6-proofs/scenarios/r-cw-delegate-self-continuation.js`
- Contract: Fires continue_delegate that internally calls continue_work — proves hop-2 woke inside a delegate child session. The delegate dispatches, the child fires its own continue_work, and the hop-2 turn executes.
- Suggested owner/seat class: ronan-dgx; gateway operator seat with a coordinated disposable session.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- Run and retain public-safe seat readiness before interpreting behavior.
- Run on the host whose hostname is the intended <SEAT>; run-proofs.sh normalizes OPENCLAW_SEAT_NAME to hostname.
- OPENCLAW_GATEWAY_TOKEN is present in the environment; never write its value.
- Acquire the runner lock and run no other continuation row against the same session.

Same-session concurrency safe: **false**. Serialize this row under the runner lock and do not overlap another continuation row on the same target session.

## Run the committed automation first

```bash
cd tools/k6-proofs && \
K6_PROOF_OUT_DIR=/tmp/project86-proof-runs \
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
./scripts/run-proofs.sh --live R-CW-DELEGATE-SELF-CONTINUATION <FINAL_CANDIDATE_SHA>
```

This command is instantiated from `tools/k6-proofs/docs/PROOF-RUN-METHOD.md:95-109 (row-list live command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.

Seat resolution: `run-proofs.sh` overwrites `OPENCLAW_SEAT_NAME` with the executing host's `hostname`. Run on the host intended by `<SEAT>`; use the resolved hostname in the committed artifact subtree.


## Required receipts

- `seat-readiness`
- `delegate-accepted`
- `child-continue-work-accepted`
- `child-hop-2-woke`
- `parent-return`

## Required artifacts

- `seat-readiness.json`
- `row-manifest.json`
- `runner-metadata.json`
- `run-result.json`
- `k6.log`
- `evidence.jsonl`
- `evidence-lines.log`
- `evidence-redaction.json`
- `gateway-journal.log`
- `gateway-journal-capture.json`
- `gateway-journal-redaction.json`
- `r-cw-delegate-self-continuation-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CW-DELEGATE-SELF-CONTINUATION/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-DELEGATE-SELF-CONTINUATION`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-DELEGATE-SELF-CONTINUATION/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-DELEGATE-SELF-CONTINUATION/comparators/elliott-legion/20260719T193850Z-r-cw-delegate-self-continuation`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/118 (manifest.issue)

## Verdict contract

- **PASS:** Permitted after the committed behavior is observed and all required receipts are present: seat-readiness, delegate-accepted, child-continue-work-accepted, child-hop-2-woke, parent-return. Human review is still required before canonical fold.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/r-cw-delegate-self-continuation.js`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

Run the direct manifest-driven scenario with OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA>, OPENCLAW_SEAT_NAME=<SEAT>, OPENCLAW_SESSION_KEY=<SESSION_KEY>, OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-cw-delegate-self.json, and ./tools/k6-proofs/run-proof.sh r-cw-delegate-self-continuation. If that still does not execute the behavior, perform the manifest's typed-tool/token/read-only surface manually in a coordinated disposable session and collect the same named receipts from session history, the bounded sanitized gateway journal, and public-safe Tempo output. Do not copy prompt bodies into the issue or artifacts.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CW-DELEGATE-TOKEN: Prove bare-token continue_work in a delegate child

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CW-DELEGATE-TOKEN** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **static validator**
- Manifest: `tools/k6-proofs/manifests/r-cw-delegate-token.json`
- Scenario: `tools/k6-proofs/scenarios/static-corpus-row-validator.js`
- Contract: Static validator for committed delegate child bare-token continuation receipts.
- Suggested owner/seat class: ronan-dgx; offline reviewer seat with k6 v2.0.0 and the committed reference corpus.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- The committed reference packet under PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203 is present for validator input.

Same-session concurrency safe: **true**. The manifest permits concurrency, but use a disposable/isolated session when the row can compact or alter session-local state.

## Run the committed automation first

```bash
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-cw-delegate-token.json \
k6 run tools/k6-proofs/scenarios/static-corpus-row-validator.js
```

This command is instantiated from `tools/k6-proofs/skill/SKILL.md:129-139 (direct k6 scenario command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.


## Required receipts

- `delegate-token-artifacts`
- `bare-token-hop2-executed`

## Required artifacts

- `static-corpus-row-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CW-DELEGATE-TOKEN/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-DELEGATE-TOKEN`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-DELEGATE-TOKEN/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-DELEGATE-TOKEN/comparators/elliott-legion/20260719T193916Z-r-cw-delegate-token`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/221 (manifest.issue)

## Verdict contract

- **PASS:** A validator PASS proves only that the committed reference/source packet satisfies the static contract. It is not fresh final-candidate behavioral PASS; fresh manual candidate receipts are still required for that claim.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS. Static automation that passes while fresh candidate behavior remains unexecuted is still incomplete for the candidate behavior claim.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/static-corpus-row-validator.js`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/README.md`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

The committed automation validates the reference packet rather than fresh candidate behavior. Run it first, then replay the documented old/manual behavior from PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-DELEGATE-TOKEN/EVIDENCE.md against <FINAL_CANDIDATE_SHA>, using tools/k6-proofs/manifests/r-cw-delegate-token.json as the receipt checklist and tools/k6-proofs/scenarios/static-corpus-row-validator.js as the validator contract. Capture fresh sanitized candidate receipts; do not claim the reference packet as candidate execution.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CW-MULTI-COLLAPSE: Prove stale continuation election collapse

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CW-MULTI-COLLAPSE** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **static validator**
- Manifest: `tools/k6-proofs/manifests/r-cw-multi-collapse.json`
- Scenario: `tools/k6-proofs/scenarios/static-corpus-row-validator.js`
- Contract: Static validator for committed synthetic stale/new continuation collapse proof receipts.
- Suggested owner/seat class: ronan-dgx; offline reviewer seat with k6 v2.0.0 and the committed reference corpus.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- The committed reference packet under PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203 is present for validator input.

Same-session concurrency safe: **true**. The manifest permits concurrency, but use a disposable/isolated session when the row can compact or alter session-local state.

## Run the committed automation first

```bash
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-cw-multi-collapse.json \
k6 run tools/k6-proofs/scenarios/static-corpus-row-validator.js
```

This command is instantiated from `tools/k6-proofs/skill/SKILL.md:129-139 (direct k6 scenario command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.


## Required receipts

- `multi-collapse-artifacts`
- `stale-superseded-newest-granted-config-restored`

## Required artifacts

- `static-corpus-row-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CW-MULTI-COLLAPSE/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-MULTI-COLLAPSE`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-MULTI-COLLAPSE/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-MULTI-COLLAPSE/comparators/elliott-legion/20260719T193919Z-r-cw-multi-collapse`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/216 (manifest.issue)

## Verdict contract

- **PASS:** A validator PASS proves only that the committed reference/source packet satisfies the static contract. It is not fresh final-candidate behavioral PASS; fresh manual candidate receipts are still required for that claim.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS. Static automation that passes while fresh candidate behavior remains unexecuted is still incomplete for the candidate behavior claim.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/static-corpus-row-validator.js`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/README.md`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

The committed automation validates the reference packet rather than fresh candidate behavior. Run it first, then replay the documented old/manual behavior from PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-MULTI-COLLAPSE/EVIDENCE.md against <FINAL_CANDIDATE_SHA>, using tools/k6-proofs/manifests/r-cw-multi-collapse.json as the receipt checklist and tools/k6-proofs/scenarios/static-corpus-row-validator.js as the validator contract. Capture fresh sanitized candidate receipts; do not claim the reference packet as candidate execution.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CW-MULTI: Prove multiple continue_work elections in one turn

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CW-MULTI** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **static validator**
- Manifest: `tools/k6-proofs/manifests/r-cw-multi.json`
- Scenario: `tools/k6-proofs/scenarios/static-corpus-row-validator.js`
- Contract: Static validator for committed same-turn multi continue_work fanout/collapse receipts.
- Suggested owner/seat class: ronan-dgx; offline reviewer seat with k6 v2.0.0 and the committed reference corpus.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- The committed reference packet under PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203 is present for validator input.

Same-session concurrency safe: **true**. The manifest permits concurrency, but use a disposable/isolated session when the row can compact or alter session-local state.

## Run the committed automation first

```bash
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-cw-multi.json \
k6 run tools/k6-proofs/scenarios/static-corpus-row-validator.js
```

This command is instantiated from `tools/k6-proofs/skill/SKILL.md:129-139 (direct k6 scenario command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.


## Required receipts

- `multi-work-artifacts`
- `fanout-collapse-semantics`

## Required artifacts

- `static-corpus-row-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CW-MULTI/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-MULTI`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-MULTI/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-MULTI/comparators/elliott-legion/20260719T193922Z-r-cw-multi`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/117 (manifest.issue)

## Verdict contract

- **PASS:** A validator PASS proves only that the committed reference/source packet satisfies the static contract. It is not fresh final-candidate behavioral PASS; fresh manual candidate receipts are still required for that claim.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS. Static automation that passes while fresh candidate behavior remains unexecuted is still incomplete for the candidate behavior claim.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/static-corpus-row-validator.js`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/README.md`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

The committed automation validates the reference packet rather than fresh candidate behavior. Run it first, then replay the documented old/manual behavior from PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-MULTI/EVIDENCE.md against <FINAL_CANDIDATE_SHA>, using tools/k6-proofs/manifests/r-cw-multi.json as the receipt checklist and tools/k6-proofs/scenarios/static-corpus-row-validator.js as the validator contract. Capture fresh sanitized candidate receipts; do not claim the reference packet as candidate execution.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-CW-TOKEN: Prove terminal CONTINUE_WORK token execution

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-CW-TOKEN** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **live k6**
- Manifest: `tools/k6-proofs/manifests/r-cw-token.json`
- Scenario: `tools/k6-proofs/scenarios/r-cw-token-bracket.js`
- Contract: Bracket/token CONTINUE_WORK path: lightContext subagent emits bare CONTINUE_WORK token at end-of-turn, hop-2 drives. Proves the token-form continuation works for subagents (the #952 row lineage).
- Suggested owner/seat class: ronan-dgx; light-context subagent-capable gateway seat with disposable sessions.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- Run and retain public-safe seat readiness before interpreting behavior.
- Run on the host whose hostname is the intended <SEAT>; run-proofs.sh normalizes OPENCLAW_SEAT_NAME to hostname.
- OPENCLAW_GATEWAY_TOKEN is present in the environment; never write its value.
- Acquire the runner lock and run no other continuation row against the same session.
- Use a light-context subagent surface capable of auto-delivering terminal token text.

Same-session concurrency safe: **false**. Serialize this row under the runner lock and do not overlap another continuation row on the same target session.

## Run the committed automation first

```bash
cd tools/k6-proofs && \
K6_PROOF_OUT_DIR=/tmp/project86-proof-runs \
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
./scripts/run-proofs.sh --live R-CW-TOKEN <FINAL_CANDIDATE_SHA>
```

This command is instantiated from `tools/k6-proofs/docs/PROOF-RUN-METHOD.md:95-109 (row-list live command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.

Seat resolution: `run-proofs.sh` overwrites `OPENCLAW_SEAT_NAME` with the executing host's `hostname`. Run on the host intended by `<SEAT>`; use the resolved hostname in the committed artifact subtree.


## Required receipts

- `seat-readiness`
- `parent-dispatch-accepted`
- `subagent-spawn-requested`
- `subagent-spawn-accepted`
- `token-emitted-or-stripped`
- `hop-2-executed`
- `parent-return`
- `journal-work-wake-hop-2`
- `tempo-trace`

## Required artifacts

- `seat-readiness.json`
- `row-manifest.json`
- `runner-metadata.json`
- `run-result.json`
- `k6.log`
- `evidence.jsonl`
- `evidence-lines.log`
- `evidence-redaction.json`
- `gateway-journal.log`
- `gateway-journal-capture.json`
- `gateway-journal-redaction.json`
- `r-cw-token-bracket-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-CW-TOKEN/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-TOKEN`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-TOKEN/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-CW-TOKEN/comparators/elliott-legion/20260719T193925Z-r-cw-token`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/118 (manifest.issue)
- https://github.com/karmaterminal/openclaw/issues/952 (manifest/scenario source reference)

## Verdict contract

- **PASS:** Permitted after the committed behavior is observed and all required receipts are present: seat-readiness, parent-dispatch-accepted, subagent-spawn-requested, subagent-spawn-accepted, token-emitted-or-stripped, hop-2-executed, parent-return, journal-work-wake-hop-2, tempo-trace. Human review is still required before canonical fold.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/r-cw-token-bracket.js`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

Run the direct manifest-driven scenario with OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA>, OPENCLAW_SEAT_NAME=<SEAT>, OPENCLAW_SESSION_KEY=<SESSION_KEY>, OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-cw-token.json, and ./tools/k6-proofs/run-proof.sh r-cw-token-bracket. If that still does not execute the behavior, perform the manifest's typed-tool/token/read-only surface manually in a coordinated disposable session and collect the same named receipts from session history, the bounded sanitized gateway journal, and public-safe Tempo output. Do not copy prompt bodies into the issue or artifacts.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-OBS-1: Prove external status visibility for continuation state

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-OBS-1** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **live k6**
- Manifest: `tools/k6-proofs/manifests/r-obs-1.json`
- Scenario: `tools/k6-proofs/scenarios/r-obs-1.js`
- Contract: Session-status-card observability via the session_status tool. Creates a disposable session, asks the agent to call session_status, and verifies build/context/continuation-chain/route visibility by nonce-correlated sentinel.
- Suggested owner/seat class: elliott-legion; gateway operator seat with a coordinated disposable session.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- Run and retain public-safe seat readiness before interpreting behavior.
- Run on the host whose hostname is the intended <SEAT>; run-proofs.sh normalizes OPENCLAW_SEAT_NAME to hostname.
- OPENCLAW_GATEWAY_TOKEN is present in the environment; never write its value.

Same-session concurrency safe: **true**. The manifest permits concurrency, but use a disposable/isolated session when the row can compact or alter session-local state.

## Run the committed automation first

```bash
cd tools/k6-proofs && \
K6_PROOF_OUT_DIR=/tmp/project86-proof-runs \
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
./scripts/run-proofs.sh --live R-OBS-1 <FINAL_CANDIDATE_SHA>
```

This command is instantiated from `tools/k6-proofs/docs/PROOF-RUN-METHOD.md:95-109 (row-list live command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.

Seat resolution: `run-proofs.sh` overwrites `OPENCLAW_SEAT_NAME` with the executing host's `hostname`. Run on the host intended by `<SEAT>`; use the resolved hostname in the committed artifact subtree.


## Required receipts

- `seat-readiness`
- `dispatch-accepted`
- `status-card-sentinel`
- `build-context-chain-route-visible`

## Required artifacts

- `seat-readiness.json`
- `row-manifest.json`
- `runner-metadata.json`
- `run-result.json`
- `k6.log`
- `evidence.jsonl`
- `evidence-lines.log`
- `evidence-redaction.json`
- `gateway-journal.log`
- `gateway-journal-capture.json`
- `gateway-journal-redaction.json`
- `r-obs-1-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-OBS-1/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-OBS-1`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-OBS-1/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-OBS-1/comparators/elliott-legion/20260719T194038Z-r-obs-1`

Declared harness/source links:
- https://github.com/karmaterminal/openclaw/issues/1135 (manifest.issue)

## Verdict contract

- **PASS:** Permitted after the committed behavior is observed and all required receipts are present: seat-readiness, dispatch-accepted, status-card-sentinel, build-context-chain-route-visible. Human review is still required before canonical fold.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/r-obs-1.js`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

Run the direct manifest-driven scenario with OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA>, OPENCLAW_SEAT_NAME=<SEAT>, OPENCLAW_SESSION_KEY=<SESSION_KEY>, OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-obs-1.json, and ./tools/k6-proofs/run-proof.sh r-obs-1. If that still does not execute the behavior, perform the manifest's typed-tool/token/read-only surface manually in a coordinated disposable session and collect the same named receipts from session history, the bounded sanitized gateway journal, and public-safe Tempo output. Do not copy prompt bodies into the issue or artifacts.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-OBS-2: Prove continuation Tempo trace-tree lineage

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-OBS-2** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **static validator**
- Manifest: `tools/k6-proofs/manifests/r-obs-2.json`
- Scenario: `tools/k6-proofs/scenarios/r-obs-2.js`
- Contract: Offline/static validator for committed R-OBS-2 trace-tree/span-tree/span-count artifacts in the current PROOFS corpus.
- Suggested owner/seat class: elliott-legion; offline reviewer seat with k6 v2.0.0 and the committed reference corpus.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- The committed reference packet under PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203 is present for validator input.

Same-session concurrency safe: **true**. The manifest permits concurrency, but use a disposable/isolated session when the row can compact or alter session-local state.

## Run the committed automation first

```bash
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-obs-2.json \
k6 run tools/k6-proofs/scenarios/r-obs-2.js
```

This command is instantiated from `tools/k6-proofs/skill/SKILL.md:129-139 (direct k6 scenario command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.


## Required receipts

- `trace-tree-artifacts`
- `continuation-lineage`

## Required artifacts

- `r-obs-2-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-OBS-2/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-OBS-2`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-OBS-2/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-OBS-2/comparators/elliott-legion/20260719T194143Z-r-obs-2`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/233 (manifest.issue)

## Verdict contract

- **PASS:** A validator PASS proves only that the committed reference/source packet satisfies the static contract. It is not fresh final-candidate behavioral PASS; fresh manual candidate receipts are still required for that claim.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS. Static automation that passes while fresh candidate behavior remains unexecuted is still incomplete for the candidate behavior claim.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/r-obs-2.js`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/README.md`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

The committed automation validates the reference packet rather than fresh candidate behavior. Run it first, then replay the documented old/manual behavior from PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-OBS-2/EVIDENCE.md against <FINAL_CANDIDATE_SHA>, using tools/k6-proofs/manifests/r-obs-2.json as the receipt checklist and tools/k6-proofs/scenarios/r-obs-2.js as the validator contract. Capture fresh sanitized candidate receipts; do not claim the reference packet as candidate execution.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-OBS-STATUS: Prove the exact-SHA status-line source contract

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-OBS-STATUS** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **static validator**
- Manifest: `tools/k6-proofs/manifests/r-obs-status.json`
- Scenario: `tools/k6-proofs/scenarios/r-obs-status.js`
- Contract: Exact-SHA #1172 source contract: active continuation renders a line while a clean all-zero session omits it.
- Suggested owner/seat class: elliott-legion; offline reviewer seat with k6 v2.0.0 and the committed reference corpus.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- The committed reference packet under PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203 is present for validator input.
- The seat must be able to fetch the exact candidate source file declared by the manifest.

Same-session concurrency safe: **true**. The manifest permits concurrency, but use a disposable/isolated session when the row can compact or alter session-local state.

## Run the committed automation first

```bash
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-obs-status.json \
k6 run tools/k6-proofs/scenarios/r-obs-status.js
```

This command is instantiated from `tools/k6-proofs/skill/SKILL.md:129-139 (direct k6 scenario command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.


## Required receipts

- `candidate-source-sha256`
- `active-continuation-line`
- `clean-session-line-absence`

## Required artifacts

- `r-obs-status-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-OBS-STATUS/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-OBS-STATUS`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-OBS-STATUS/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-OBS-STATUS/comparators/elliott-legion/20260719T194146Z-r-obs-status`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/104 (manifest.issue)
- https://github.com/karmaterminal/openclaw/issues/1172 (manifest/scenario source reference)

## Verdict contract

- **PASS:** A validator PASS proves only that the committed reference/source packet satisfies the static contract. It is not fresh final-candidate behavioral PASS; fresh manual candidate receipts are still required for that claim.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS. Static automation that passes while fresh candidate behavior remains unexecuted is still incomplete for the candidate behavior claim.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong. A source-location/transport assumption that never tested the formatter is BAD_PROOF/PARTIAL, not product FAIL.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/r-obs-status.js`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/README.md`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

The committed automation validates the reference packet rather than fresh candidate behavior. Run it first, then replay the documented old/manual behavior from PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-OBS-STATUS/EVIDENCE.md against <FINAL_CANDIDATE_SHA>, using tools/k6-proofs/manifests/r-obs-status.json as the receipt checklist and tools/k6-proofs/scenarios/r-obs-status.js as the validator contract. Capture fresh sanitized candidate receipts; do not claim the reference packet as candidate execution.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-RC-1: Prove below-threshold request_compaction rejection

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-RC-1** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **live k6**
- Manifest: `tools/k6-proofs/manifests/r-rc-1.json`
- Scenario: `tools/k6-proofs/scenarios/r-rc-1-threshold-reject.js`
- Contract: request_compaction below-threshold structured reject via disposable session/inventory-only path
- Suggested owner/seat class: ronan-dgx; gateway operator seat with a coordinated disposable session.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- Run and retain public-safe seat readiness before interpreting behavior.
- Run on the host whose hostname is the intended <SEAT>; run-proofs.sh normalizes OPENCLAW_SEAT_NAME to hostname.
- OPENCLAW_GATEWAY_TOKEN is present in the environment; never write its value.
- Acquire the runner lock and run no other continuation row against the same session.
- Use a disposable low-context session so the synchronous threshold-rejection branch is authoritative.

Same-session concurrency safe: **false**. Serialize this row under the runner lock and do not overlap another continuation row on the same target session.

## Run the committed automation first

```bash
cd tools/k6-proofs && \
K6_PROOF_OUT_DIR=/tmp/project86-proof-runs \
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
./scripts/run-proofs.sh --live R-RC-1 <FINAL_CANDIDATE_SHA>
```

This command is instantiated from `tools/k6-proofs/docs/PROOF-RUN-METHOD.md:95-109 (row-list live command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.

Seat resolution: `run-proofs.sh` overwrites `OPENCLAW_SEAT_NAME` with the executing host's `hostname`. Run on the host intended by `<SEAT>`; use the resolved hostname in the committed artifact subtree.


## Required receipts

- `seat-readiness`
- `tool-registered`
- `tool-invoked`
- `tool-invoke-rejected`

## Required artifacts

- `seat-readiness.json`
- `row-manifest.json`
- `runner-metadata.json`
- `run-result.json`
- `k6.log`
- `evidence.jsonl`
- `evidence-lines.log`
- `evidence-redaction.json`
- `gateway-journal.log`
- `gateway-journal-capture.json`
- `gateway-journal-redaction.json`
- `r-rc-1-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-RC-1/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-RC-1`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-RC-1/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-RC-1/comparators/elliott-legion/20260719T194150Z-r-rc-1`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/422 (manifest.issue)

## Verdict contract

- **PASS:** Permitted after the committed behavior is observed and all required receipts are present: seat-readiness, tool-registered, tool-invoked, tool-invoke-rejected. Human review is still required before canonical fold.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/r-rc-1-threshold-reject.js`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

Run the direct manifest-driven scenario with OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA>, OPENCLAW_SEAT_NAME=<SEAT>, OPENCLAW_SESSION_KEY=<SESSION_KEY>, OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-rc-1.json, and ./tools/k6-proofs/run-proof.sh r-rc-1-threshold-reject. If that still does not execute the behavior, perform the manifest's typed-tool/token/read-only surface manually in a coordinated disposable session and collect the same named receipts from session history, the bounded sanitized gateway journal, and public-safe Tempo output. Do not copy prompt bodies into the issue or artifacts.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-RC-2: Prove accepted request_compaction or the narrow honest limit

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-RC-2** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **live k6**
- Manifest: `tools/k6-proofs/manifests/r-rc-2.json`
- Scenario: `tools/k6-proofs/scenarios/r-rc-2-delegate-request-compaction.js`
- Contract: Parent fires continue_delegate to a child that calls request_compaction. Accepts actual compaction path or structured below-threshold rejection as environmental honest limit.
- Suggested owner/seat class: ronan-dgx; gateway operator seat with a coordinated disposable session.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- Run and retain public-safe seat readiness before interpreting behavior.
- Run on the host whose hostname is the intended <SEAT>; run-proofs.sh normalizes OPENCLAW_SEAT_NAME to hostname.
- OPENCLAW_GATEWAY_TOKEN is present in the environment; never write its value.
- Accepted-path PASS requires a coordinated above-threshold disposable session and complete compaction lifecycle receipts.
- Do not lower shared gateway thresholds or mutate fleet config for this row.

Same-session concurrency safe: **true**. The manifest permits concurrency, but use a disposable/isolated session when the row can compact or alter session-local state.

## Run the committed automation first

```bash
cd tools/k6-proofs && \
K6_PROOF_OUT_DIR=/tmp/project86-proof-runs \
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_RUNTIME_BUILD_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
./scripts/run-proofs.sh --live R-RC-2 <FINAL_CANDIDATE_SHA>
```

This command is instantiated from `tools/k6-proofs/docs/PROOF-RUN-METHOD.md:95-109 (row-list live command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.

Seat resolution: `run-proofs.sh` overwrites `OPENCLAW_SEAT_NAME` with the executing host's `hostname`. Run on the host intended by `<SEAT>`; use the resolved hostname in the committed artifact subtree.


## Required receipts

- `parent-dispatch-accepted`
- `delegate-requested`
- `child-report-observed`
- `threshold-rejection-or-accepted-compaction`
- `trace-id`

## Required artifacts

- `seat-readiness.json`
- `row-manifest.json`
- `runner-metadata.json`
- `run-result.json`
- `k6.log`
- `evidence.jsonl`
- `evidence-lines.log`
- `evidence-redaction.json`
- `gateway-journal.log`
- `gateway-journal-capture.json`
- `gateway-journal-redaction.json`
- `r-rc-2-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-RC-2/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-RC-2`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-RC-2/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-RC-2/comparators/elliott-legion/20260719T194251Z-r-rc-2`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/104 (manifest.issue)

## Verdict contract

- **PASS:** PASS-candidate requires a nonce-bound accepted request_compaction toolResult, compaction start/completion, post-compaction lifeboat return, and a successor sentinel that could not exist before compaction.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** HONEST-LIMIT-candidate is permitted only when a nonce-bound request_compaction toolResult has status rejected, guard context_threshold, and proves context remained below threshold after the delegate child reached the tool. No other missing receipt qualifies.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/r-rc-2-delegate-request-compaction.js`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

Run the direct manifest-driven scenario with OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA>, OPENCLAW_SEAT_NAME=<SEAT>, OPENCLAW_SESSION_KEY=<SESSION_KEY>, OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-rc-2.json, and ./tools/k6-proofs/run-proof.sh r-rc-2-delegate-request-compaction. If that still does not execute the behavior, perform the manifest's typed-tool/token/read-only surface manually in a coordinated disposable session and collect the same named receipts from session history, the bounded sanitized gateway journal, and public-safe Tempo output. Do not copy prompt bodies into the issue or artifacts.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-REGRESSION-TRAP-TESTS: Validate continuation regression trap tests

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-REGRESSION-TRAP-TESTS** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **static validator**
- Manifest: `tools/k6-proofs/manifests/r-regression-trap-tests.json`
- Scenario: `tools/k6-proofs/scenarios/r-regression-trap-tests.js`
- Contract: Offline/static validator for committed continuation sibling-surface regression-trap test receipts in the current PROOFS corpus.
- Suggested owner/seat class: elliott-legion; offline reviewer seat with k6 v2.0.0 and the committed reference corpus.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- The committed reference packet under PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203 is present for validator input.

Same-session concurrency safe: **true**. The manifest permits concurrency, but use a disposable/isolated session when the row can compact or alter session-local state.

## Run the committed automation first

```bash
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-regression-trap-tests.json \
k6 run tools/k6-proofs/scenarios/r-regression-trap-tests.js
```

This command is instantiated from `tools/k6-proofs/skill/SKILL.md:129-139 (direct k6 scenario command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.


## Required receipts

- `regression-trap-artifacts`
- `regression-tests-passed`

## Required artifacts

- `r-regression-trap-tests-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-REGRESSION-TRAP-TESTS/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-REGRESSION-TRAP-TESTS`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-REGRESSION-TRAP-TESTS/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-REGRESSION-TRAP-TESTS/comparators/elliott-legion/20260719T194557Z-r-regression-trap-tests`

Declared harness/source links:
- https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/121 (manifest.issue)

## Verdict contract

- **PASS:** A validator PASS proves only that the committed reference/source packet satisfies the static contract. It is not fresh final-candidate behavioral PASS; fresh manual candidate receipts are still required for that claim.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS. Static automation that passes while fresh candidate behavior remains unexecuted is still incomplete for the candidate behavior claim.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/r-regression-trap-tests.js`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/README.md`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

The committed automation validates the reference packet rather than fresh candidate behavior. Run it first, then replay the documented old/manual behavior from PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-REGRESSION-TRAP-TESTS/EVIDENCE.md against <FINAL_CANDIDATE_SHA>, using tools/k6-proofs/manifests/r-regression-trap-tests.json as the receipt checklist and tools/k6-proofs/scenarios/r-regression-trap-tests.js as the validator contract. Capture fresh sanitized candidate receipts; do not claim the reference packet as candidate execution.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

### [Project 86] R-TRACE-REDACTION-1121: Validate continuation trace-reason redaction

Umbrella: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/451
Project: https://github.com/orgs/karmaterminal/projects/86

## Scope

Execute **R-TRACE-REDACTION-1121** from docs base `abe1f9f0749d849b01da4e5d354c205ecffac946` against OpenClaw candidate `<FINAL_CANDIDATE_SHA>`.

- Execution class: **static validator**
- Manifest: `tools/k6-proofs/manifests/r-trace-redaction-1121.json`
- Scenario: `tools/k6-proofs/scenarios/r-trace-redaction-1121.js`
- Contract: Offline/static validator for committed #1121 trace-redaction contract evidence in the current PROOFS corpus.
- Suggested owner/seat class: elliott-legion; offline reviewer seat with k6 v2.0.0 and the committed reference corpus.
- Live assignment: none; claim this issue before running.

## Dependencies and coordination

- Use docs catalog bytes from abe1f9f0749d849b01da4e5d354c205ecffac946.
- Candidate source/runtime identity is exactly <FINAL_CANDIDATE_SHA>.
- The committed reference packet under PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203 is present for validator input.

Same-session concurrency safe: **true**. The manifest permits concurrency, but use a disposable/isolated session when the row can compact or alter session-local state.

## Run the committed automation first

```bash
OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \
OPENCLAW_SEAT_NAME=<SEAT> \
OPENCLAW_SESSION_KEY=<SESSION_KEY> \
OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/r-trace-redaction-1121.json \
k6 run tools/k6-proofs/scenarios/r-trace-redaction-1121.js
```

This command is instantiated from `tools/k6-proofs/skill/SKILL.md:129-139 (direct k6 scenario command form)`. Keep `OPENCLAW_GATEWAY_TOKEN` in the environment when required; never paste or commit its value. Confirm the actual deployed/runtime SHA equals `<FINAL_CANDIDATE_SHA>` before interpreting behavior.


## Required receipts

- `trace-redaction-contract`
- `trace-redaction-tests-passed`

## Required artifacts

- `r-trace-redaction-1121-summary.json`

Row-owned destination: `PROOFS/<FINAL_CANDIDATE_SHA>/R-TRACE-REDACTION-1121/<SEAT>/`

Reference packet:
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-TRACE-REDACTION-1121`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-TRACE-REDACTION-1121/EVIDENCE.md`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-TRACE-REDACTION-1121/comparators/elliott-legion/20260719T194600Z-r-trace-redaction-1121`

Declared harness/source links:
- https://github.com/karmaterminal/openclaw/issues/1121 (manifest.issue)

## Verdict contract

- **PASS:** A validator PASS proves only that the committed reference/source packet satisfies the static contract. It is not fresh final-candidate behavioral PASS; fresh manual candidate receipts are still required for that claim.
- **PARTIAL:** Use PARTIAL-candidate for setup/readiness failure, context pressure, missing model/trace/lifecycle/authority receipt, inability to invoke compaction, or incomplete evidence. Do not reinterpret missing evidence as PASS. Static automation that passes while fresh candidate behavior remains unexecuted is still incomplete for the candidate behavior claim.
- **FAIL:** Use FAIL-candidate for authoritative contradictory behavior, a violated negative guard, wrong target/model/identity, failed static contract, or a completed invocation that proves the product behavior is wrong.
- **HONEST_LIMIT:** Not permitted for this row. Any incomplete substrate, context pressure, missing lifecycle/trace/model receipt, or inability to invoke compaction is PARTIAL-candidate.

## Backup/manual form

Runbooks:
- `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`
- `tools/k6-proofs/CONTRIBUTING-ROWS.md`
- `tools/k6-proofs/scenarios/r-trace-redaction-1121.js`
- `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/README.md`

If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error:

The committed automation validates the reference packet rather than fresh candidate behavior. Run it first, then replay the documented old/manual behavior from PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203/R-TRACE-REDACTION-1121/EVIDENCE.md against <FINAL_CANDIDATE_SHA>, using tools/k6-proofs/manifests/r-trace-redaction-1121.json as the receipt checklist and tools/k6-proofs/scenarios/r-trace-redaction-1121.js as the validator contract. Capture fresh sanitized candidate receipts; do not claim the reference packet as candidate execution.

## Failure routing and landing

The default failure scope is **this row or its directly affected continuation family**. Escalate to a broader halt only for exact-candidate identity failure, gateway-wide corruption/crash, unsafe state mutation, or a redaction/secrets breach. Otherwise continue independent rows.

1. Run the committed automation first.
2. If automation does not execute the behavior, run the documented old/manual form rather than stopping at the first harness error.
3. If the failure is not a trivial local correction, open an issue in `karmaterminal/openclaw` with candidate SHA, row id, seat, reproduction, sanitized artifacts, suspected blast radius, and whether other rows may continue.
4. Continue independent proof rows unless the finding is explicitly classified as a halt-state.
5. Context pressure, missing lifecycle receipts, or inability to invoke compaction is PARTIAL/incomplete except for the narrowly documented R-RC-2 below-threshold HONEST_LIMIT receipt.
6. Commit only the row-owned artifact subtree directly to docs `main`; do not edit `PROOFS/INDEX.json` or `PROOFS/<FINAL_CANDIDATE_SHA>/proofs-manifest.json`.

Never write secrets, raw tokens, actual session keys, prompt bodies, nonces, raw gateway payloads, or private filesystem paths into the issue or committed artifacts.

---

