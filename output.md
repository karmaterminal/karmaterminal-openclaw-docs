# PR #129388 exact five-row proof refire

## Outcome

All five requested rows have reviewed candidate verdicts against exact product
`6aca9d1d9294376d0466cc8cc608ba731220aab9`. The process-local `R-CW-6`
fixture is `PASS-candidate`. The four live rows remain honest
`PARTIAL-candidate` results: two product behavior gaps, one product telemetry
topology gap, and one observability-infrastructure completeness limit. No
candidate artifact was folded into the corpus.

Acceptance path:
`project81-32956764849+focused-fixture`, with the affected chained row refired
alone in run `32958479691` after its harness artifact repair. This was not a
Mode-B broad-CI run and no monolithic local full suite was used.

## Named-ref identity gate

The unchanged safe lane was published at the required docs SHA before evidence.
Repairs discovered by the exact rejected run were then published as successor
workflow refs. The report-only final commit does not change executed harness
bytes; final local/tracking/server equality is asserted in the completion
receipt.

| Category | Named ref | Resolved SHA | Equality and disposition |
|---|---|---|---|
| Product/runtime composite | `karmaterminal/openclaw@6aca9d1d9294376d0466cc8cc608ba731220aab9` | `6aca9d1d9294376d0466cc8cc608ba731220aab9` | Local, tracking, and server equal; exact runtime under proof |
| Pure continuation source | `karmaterminal/openclaw@0281b08a720757fc9af0dcc8b7e6e9567a57a38f` | `0281b08a720757fc9af0dcc8b7e6e9567a57a38f` | Local, tracking, and server equal; ancestor of composite |
| Safe lane, unchanged pre-fire | `karmaterminal/karmaterminal-openclaw-docs:codeagent/129388-five-row-refire` | `371a6538a06fec939ad7e27bd788b9d8543edffa` | Local, tracking, and server equal before first evidence |
| Safe lane, identity repair | same branch | `ef850a6943bda22a863c7608c07d707b0b8a49ff` | Local, tracking, and server equal; corrected four-row matrix ref |
| Safe lane, structural-event repair | same branch | `a1b52de161185efcd4e503e9b1e962e76c67a7b0` | Local, tracking, and server equal; chained row-only refire ref |
| CI/workflow, required exact run | `.github/workflows/project81-k6-proof.yml@371a6538a06fec939ad7e27bd788b9d8543edffa` | `371a6538a06fec939ad7e27bd788b9d8543edffa` | Run `32953471393` `headSha` equals exact required docs ref |
| Presentation | `karmaterminal/openclaw:codeagent/85651-upstream-1ba243c8-gates` | `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | Local, tracking, and server equal; protected and untouched |
| Docs/proof | `karmaterminal/karmaterminal-openclaw-docs@371a6538a06fec939ad7e27bd788b9d8543edffa` | `371a6538a06fec939ad7e27bd788b9d8543edffa` | Exact proof base; corpus and `PROOFS/INDEX.json` untouched |

## Isolated gateway and runtime identity

The preferred port `127.0.0.1:19891` was already owned by unrelated held proof
PID `2498654`; that process was never signaled or modified. This lane used
loopback fallback `127.0.0.1:19892`.

| Check | Receipt |
|---|---|
| Host | `ronan`, `aarch64`, Node `v25.9.0`, k6 `v2.0.0` |
| Exact source | Tracked-clean checkout at `6aca9d1d9294376d0466cc8cc608ba731220aab9` |
| Same-host dependencies | Dependency clone at the same SHA; manifest, lockfile, workspace file, and installed-lock bytes equal |
| Build info | `dist/build-info.json` commit `6aca9d1d...`; SHA-256 `d1701dd17a9f7ee39108e85aaef126c08137a2df68b8ae623757040185890e88` |
| Stable dist | 12,147 files; SHA-256 `9a7aebc51654bbeb65fdc475208620d00d76a348f9a90f4cabe5f6d05c720530` before traffic, after model smoke, and after all proofs |
| Isolation | Separate private config, state DB, workspace, home, logs, launcher, PID/process group, and transient user service |
| Final proof process | Unit `openclaw-proof-129388-five-row-refire.service`; PID/PGID/SID `3134870`; loopback listeners only |
| Provider readiness | Only the shared credential-store row and OpenAI OAuth route were copied read-only into isolated state; isolated `auth.sharedStore` ownership was set locally; no live sessions or auth runtime state were copied |
| Model smoke | Exact sentinel returned through the isolated gateway; provider `openai`; configured model fingerprint SHA-256 `d2d984177eae0cdb89850b821b48454ddc748b18e59253c17a9300c06c185061` |
| Telemetry | `diagnostics-otel` enabled; endpoint `http://otel.dandelion.cult:4318`; `http/protobuf`; traces on; metrics/logs off; `captureContent=false`; service `ronan-isolated-129388-6aca9d1d` |
| Readiness | `PASS-candidate`; authenticated health/status reachable; continuation chain, delegate, and cost defaults present; seat class `raw-final-text` |
| Live prince | PID `2272093`, start ticks `50957076`, config SHA-256 `541f1838b549ccf53199a5b00f3607bf05588c7721577c3efd6b0fd446ee799f`; active and unchanged throughout |

The first isolated process used the locally configured Nemotron provider and
was insufficient for nested proof prompts. It was stopped by exact unit before
the private provider transition. The live prince gateway and its state were
never restarted, reconfigured, or written.

## Project-81 workflow artifacts

| Run | Workflow SHA | Scope | Conclusion | Artifact | Local checksum-manifest SHA-256 |
|---|---|---|---|---|---|
| [32953471393](https://github.com/karmaterminal/karmaterminal-openclaw-docs/actions/runs/32953471393) | `371a6538a06fec939ad7e27bd788b9d8543edffa` | Required exact four-row slice | `failure` | ID `9601352398`, 101 files | `2569082f1743decbf0edd88ee725d93b3cab7f5d168d82b55792993ce3d898cf` |
| [32956764849](https://github.com/karmaterminal/karmaterminal-openclaw-docs/actions/runs/32956764849) | `ef850a6943bda22a863c7608c07d707b0b8a49ff` | Corrected four-row slice | `failure` | ID `9602685423`, 121 files | `23a568f790f7d7e2b46b6f8938fe349869d01f131af53b15ec503996a6286b91` |
| [32958479691](https://github.com/karmaterminal/karmaterminal-openclaw-docs/actions/runs/32958479691) | `a1b52de161185efcd4e503e9b1e962e76c67a7b0` | Affected `R-CD-CHAINED-DEPTH-2` only | `failure` | ID `9603030118`, 37 files | `93b3d354901aed7b4d4fb695986bc871e62d93a590c48524d20801e44e7f7b30` |

All three uploaded artifacts remain available on GitHub. `failure` is expected
for a workflow containing non-PASS candidate rows; no red was summarized away.

## Reviewed row verdicts

| Row | Final authority | Verdict | Classification and exact gap |
|---|---|---|---|
| `R-CD-2` | Run `32956764849` signed row-scoped receipt | `PARTIAL-candidate` | Product telemetry topology. One unique continuation trace was found for the exact isolated service, but it lacked the originating `continue_delegate` typed-tool span. Failure category: `missing-continuation-topology`. Tempo also returned HTTP 200 without `totalBlocks`, so backend counts were not authoritative. Routed to `karmaterminal/openclaw#1251`. |
| `R-CD-CHAINED-DEPTH-2` | Row-only run `32958479691` | `PARTIAL-candidate` | Product return path. Parent accepted, child and grandchild spawned, both strict descendant sentinels arrived, depth-1 recovery wake scheduled, max depth was 2, and a distinct typed-tool dispatch/fire trace correlated. The exact root return never arrived before the post-grandchild 120-second window expired. This repeated the corrected matrix result. Routed to `karmaterminal/openclaw#1183`. |
| `R-CD-TOKEN` | Run `32956764849` signed row-scoped receipt | `PARTIAL-candidate` | Product token surface. Candidate/runtime SHAs matched exactly, disposable origin and `raw-final-text` gates passed, and dispatch occurred. The unique origin task completed, but the stable task ledger contained zero delegate tasks and no bound return before the 180-second window expired. Failure category: `incomplete-or-nonunique-lifecycle`; automatic retry was disabled. Routed to `karmaterminal/openclaw#1054`. |
| `R-OBS-BACKEND-DISPOSITION` | Run `32956764849` row result and backend receipt | `PARTIAL-candidate` | Observability infrastructure. Configured Tempo and Loki queries both returned HTTP 200. Tempo omitted `totalBlocks` and `inspectedBytes`; Loki omitted `totalBlocks`. Both interactions therefore remained `partial`, `countAuthority=false`, and zero was explicitly non-authoritative. All five classifier controls, all four row receipts, and all rebind keys passed. Routed to `karmaterminal/openclaw#1254`. |
| `R-CW-6` | Successor process-local fixture | `PASS-candidate` | Exact candidate, pnpm `11.22.0`, max chain 3. All nine artifacts reviewed: direct boundaries, structured `chain-capped`, no-spawn, durable reload/recovery, typed-tool surface, selected delegate boundary, candidate regression, cleanup, and public safety. Checksum-manifest SHA-256 `52fe861ef35e2c2b8c57a2c37ea38df9b9ad6771609e6a7be3f905d61c117597`. |

### Historical same-row comparison

- `R-CD-2`: latest committed `PASS-candidate` found at
  `PROOFS/6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d/.../20260717T102452Z`.
  The current stricter row-scoped authority rejects the missing typed-tool
  topology rather than inheriting that historical pass.
- `R-CD-CHAINED-DEPTH-2`: latest committed pass was
  `20260819T081654Z` under `PROOFS/c3a0e5a314ecbf572911d4b2e84595bd06f64d69`.
  Both exact current executions independently reached depth 2 but missed the
  final ancestor return.
- `R-CD-TOKEN`: latest committed pass was `20260709T055233Z` under
  `PROOFS/ffcfeee2dedebb2e8ba68be5c03efc8771aa15c3`; that historical receipt had
  no current signed raw-final-text lifecycle authority.
- `R-OBS-BACKEND-DISPOSITION`: no committed same-row pass exists.
- `R-CW-6`: the exact rejected-harness fixture at `371a6538...` was the
  deterministic negative control; the same exact product passes on the
  successor fixture.

## Harness repairs and regression completeness

| Invariant and owner | Rejected-SHA negative control | Successor proof | Sibling/recovery coverage |
|---|---|---|---|
| Workflow-to-runner identity: caller seat, external runtime SHA, seat class, unique OTel service, and isolated journal unit must survive composition | Exact run `32953471393` at `371a6538...` showed host runtime identity, overwritten seat, hard-coded trace service, live-unit journal default, and token pre-dispatch withholding | `ef850a69...`; exact seat/runtime gates passed, trace queries named the unique service, and journal receipts named the isolated unit | Token exact-build gate, unsafe TraceQL service rejection, R-CD-2 authority, chained trace authority |
| R-OBS scenario must emit one extractable public record; Loki counting helper must be in module scope | Exact run `32953471393` produced no evidence record and failed public projection | `ef850a69...`; one public-safe record, four proof receipts, complete rebind keys, and honest backend `partial` | k6 inspect/run, extractor, sanitizer, all five disposition controls |
| R-CW-6 in-memory authority is `sessionStore[sessionKey]`, not the stale caller snapshot replaced by persistence | Exact fixture at `371a6538...` failed: stale input count `1` was asserted as `3`; the runtime sibling independently passed | `ef850a69...`: authoritative in-memory `3`, explicit stale input `1`, persisted/reloaded `3` | First-over-limit no-spawn, restart/reload recovery, selected delegate, candidate regression, cleanup, public safety |
| Sanitizer-to-disposition composition must retain payload-free gateway event receipts required by manifests | Run `32956764849` at `ef850a69...` omitted `gateway-events.ndjson`; overlaid tests on exact `ef850a69...` failed for missing projection/file | `a1b52de1...`; row-only artifact contains 393 receipts with exactly `ts`, `kind`, `method`, `event`, `ok`; no required artifact remains missing | Sanitizer rejects payload/identifier leakage; normalizer re-allowlists fields; candidate envelope and backend policy tests |

The first control set was also frozen by overlaying the new contract tests on
exact rejected SHA `371a6538...`: all four failed for their intended invariant.
The successor focused batch passed 171 tests, the full trace-collector file
passed 46 tests, and the R-OBS k6 extraction/sanitization proof emitted exactly
one public record. The gateway-event controls both failed on exact
`ef850a69...` and the successor batch passed 43 tests.

The sanitizer/normalizer defect is filed as current-repository issue #518 and
must remain open until the harness repair is folded. No proof artifact should
be folded from that issue.

## Commands

Required exact workflow dispatch:

```bash
gh workflow run project81-k6-proof.yml \
  --repo karmaterminal/karmaterminal-openclaw-docs \
  --ref codeagent/129388-proof-matrix-provenance \
  -f rows=R-CD-2,R-CD-CHAINED-DEPTH-2,R-CD-TOKEN,R-OBS-BACKEND-DISPOSITION \
  -f candidate_sha=6aca9d1d9294376d0466cc8cc608ba731220aab9 \
  -f dry_run=false \
  -f 'runner_labels_json=["self-hosted","ronan"]' \
  -f gateway_ws=ws://127.0.0.1:19892 \
  -f session_selector=main \
  -f seat_name=ronan-isolated-129388 \
  -f create_disposable_sessions=true \
  -f metrics_push=false
```

Corrected matrix additionally supplied:

```text
runtime_build_sha=6aca9d1d9294376d0466cc8cc608ba731220aab9
seat_class=raw-final-text
otel_service_name=ronan-isolated-129388-6aca9d1d
gateway_unit=openclaw-proof-129388-five-row-refire.service
tempo_traceql={ resource.service.name="ronan-isolated-129388-6aca9d1d" }
loki_logql={service_name="ronan-isolated-129388-6aca9d1d"}
```

Process-local fixture:

```bash
PNPM_CONFIG_STORE_DIR=<lane-private-stable-store> \
XDG_CACHE_HOME=<lane-private-stable-cache> \
node tools/k6-proofs/scripts/run-max-chain-fixture.mjs \
  --source-dir <exact-clean-6aca9d1d-worktree> \
  --candidate-sha 6aca9d1d9294376d0466cc8cc608ba731220aab9 \
  --artifact-dir <new-empty-mode-0700-private-dir> \
  --max-chain-length 3 \
  --json
```

Focused harness gates:

```bash
node --test \
  tools/k6-proofs/scripts/__tests__/backend-disposition-pipeline.test.mjs \
  tools/k6-proofs/scripts/__tests__/collect-continuation-trace.test.mjs \
  tools/k6-proofs/scripts/__tests__/continuation-acceptance-matrix.test.mjs \
  tools/k6-proofs/scripts/__tests__/continuation-row-contract.test.mjs \
  tools/k6-proofs/scripts/__tests__/max-chain-fixture.test.mjs \
  tools/k6-proofs/scripts/__tests__/proof-harness-closure-contract.test.mjs \
  tools/k6-proofs/scripts/__tests__/r-cd-2-authoritative-receipt.test.mjs \
  tools/k6-proofs/scripts/__tests__/r-cd-token-authoritative-receipt.test.mjs \
  tools/k6-proofs/scripts/__tests__/r-cd-token-runner-contract.test.mjs \
  tools/k6-proofs/scripts/__tests__/telemetry-contract.test.mjs

node --test \
  tools/k6-proofs/scripts/__tests__/sanitize-k6-artifacts.test.mjs \
  tools/k6-proofs/scripts/__tests__/backend-disposition-pipeline.test.mjs \
  tools/k6-proofs/scripts/__tests__/candidate-run-result.test.mjs \
  tools/k6-proofs/scripts/__tests__/proof-harness-closure-contract.test.mjs
```

The first R-CW successor invocation resolved pnpm to an inherited deleted
Actions store and exited before creating any artifact. It was classified as
stale-cache infrastructure, not a candidate finding. Only a new lane-local
`PNPM_CONFIG_STORE_DIR` was created; no install or reconciliation ran in a
linked `source/WORKTREES` checkout.

## Cleanup and fold handoff

- Exact isolated PID/PGID/SID `3134870` was stopped through
  `openclaw-proof-129388-five-row-refire.service`; port `19892` is free.
- Live prince PID `2272093` and config hash
  `541f1838b549ccf53199a5b00f3607bf05588c7721577c3efd6b0fd446ee799f`
  remain unchanged and active.
- Foreign proof PID `2498654` remains active on `19891` and untouched.
- Candidate dist hash remains
  `9a7aebc51654bbeb65fdc475208620d00d76a348f9a90f4cabe5f6d05c720530`;
  product tracked state is clean.
- Private workflow downloads, fixture receipts, isolated state, and bounded logs
  are preserved. Disposable fixture worktrees were removed.
- OpenClaw product code, live prince state, presentation, docs main, proof
  corpus, and `PROOFS/INDEX.json` were not modified.
- Supplemental product telemetry rows remain missing by design.
  `codeagent/129388-product-observability-closure` was not used.
- Do not fold these candidate artifacts. Fold the two docs harness repairs only
  after #518 review; product behavior remains owned by
  `karmaterminal/openclaw#1183`, `karmaterminal/openclaw#1054`,
  `karmaterminal/openclaw#1251`, and `karmaterminal/openclaw#1254`.
- No pull request was opened.
