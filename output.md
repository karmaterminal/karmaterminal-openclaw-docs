# PR #129388 deterministic depth/token fixture cure and refire

## Outcome

Status: **TROUBLE; fixture cure proven, required row outcome not met**.

The reusable Project-81 fixture contract now provisions explicit
`agents.defaults.subagents.maxSpawnDepth=5`, resolves each selected row's
minimum depth from its manifest, records configured/effective/required depth,
and stops the matrix before k6 or model traffic when depth is missing,
malformed, unknown, below the selected-row requirement, or different from an
explicit isolated-profile expectation.

Exact row-only run
[33014309397](https://github.com/karmaterminal/karmaterminal-openclaw-docs/actions/runs/33014309397)
executed only `R-CD-CHAINED-DEPTH-2,R-CD-TOKEN` from docs/workflow SHA
`96c0e1b59c205696806ae50cc659a08f4b79fd3d` against runtime
`0c033c46c6365929c669bb7eff60a58ec914dbdd`. Its workflow readiness receipt
proves configured/effective/required depth `5/5/2`, and direct durable review
proves both rows formed real root-to-child-to-grandchild lineage with two
succeeded/delivered tasks.

Both HMAC-valid row authorities are nevertheless `PARTIAL-candidate`:

| Row | Authority | Classification |
|---|---|---|
| `R-CD-CHAINED-DEPTH-2` | `PARTIAL-candidate` | Real depth 2 completed, but the depth-1 recovery never emitted the exact `CHILD-DONE` result, so no admissible task-ledger/root structured-consumption receipt formed; the trace also lacked the originating typed-tool span |
| `R-CD-TOKEN` | `PARTIAL-candidate` | Exactly one disposable origin task and one origin-owned depth-2 delegate task succeeded/delivered, but the bounded session-message observer did not bind the required normal origin return |

No row was retried. No `R-CD-2`, backend-disposition, `R-CW-6`, or corpus-wide
traffic was dispatched. Nothing was folded into `PROOFS/`.

Acceptance path: **focused-only plus named Project-81 live run `33014309397`**.
Mode-B, Gate 3g, a monolithic local suite, and Crabbox/Testbox were not used or
claimed.

## Named-ref contract

The unchanged lane was first published at report head
`98d2f8c4d5bce0e626bb286c0bf50ef4744cfcd7`. The fixture successor was then
committed and published before runtime evidence; local, tracking, and server
were equal at `96c0e1b59c205696806ae50cc659a08f4b79fd3d` when the workflow was
dispatched.

| Category | Named ref | Resolved SHA | Local | Tracking | Server | Use |
|---|---|---|---|---|---|---|
| Product/base runtime | `karmaterminal/openclaw:codeagent/129388-runtime-composite-final-cures` | `0c033c46c6365929c669bb7eff60a58ec914dbdd` | same | same | same | exact runtime/build |
| Safe lane at evidence | `karmaterminal/karmaterminal-openclaw-docs:codeagent/129388-depth-token-fixture-refire` | `96c0e1b59c205696806ae50cc659a08f4b79fd3d` | same | same | same | fixture code and row dispatch |
| CI/workflow | `.github/workflows/project81-k6-proof.yml` at the safe-lane evidence ref | `96c0e1b59c205696806ae50cc659a08f4b79fd3d` | same | same | same | run head; blob `0c9ef45da6aa3ce08b1c3e3381b0255324258e68`, SHA-256 `5cc7d7c2e599393082836267cbf6ffecf5e1e91e2d4a681434cc14424ccaef7a` |
| Presentation | `karmaterminal/openclaw:codeagent/85651-upstream-1ba243c8-gates` | `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | same | same | same | read-only |
| Docs/proof reviewed harness | `karmaterminal/karmaterminal-openclaw-docs:codeagent/129388-depth-ack-harness-cure` | `85a783f4ef0352e64b37748f4164d5fdee96ceb4` | same | same | same | ancestor of the successor |

Machine receipt:
`receipts/129388-depth-token-fixture-refire/named-refs.json`.

## Fixture invariant and deterministic controls

The owning composition boundary is:

```text
selected workflow rows
  -> committed row manifests
  -> continuation-depth contract
  -> isolated config provisioner
  -> exact runtime config
  -> seat-readiness receipt
  -> run-proofs pre-dispatch gate
  -> k6 scenario
```

Nested live rows now declare
`continuationRequirements.requiredSpawnDepth=2`. Rows without a declaration
resolve to product default requirement `1`. The fixed isolated profile is
`5`, which is also the exact runtime schema ceiling.

Controls:

| Control | Result |
|---|---|
| Rejected harness `85a783f4...`, omitted depth | Negative test failed because old readiness returned `0` instead of required reject `2` |
| Successor, exact omitted/default shape | `PARTIAL-candidate`, configured `null`, effective `1`, required `2`; exit `2` |
| Successor, explicit depth `1` | rejected before traffic |
| Successor, explicit profile depth `5` | `PASS-candidate`, configured/effective/required `5/5/2` |
| Nearest non-nested sibling `R-CD-2`, omitted depth | remains valid at effective/required `1/1` |
| Malformed explicit depth | fails closed as `configured-depth-malformed` |
| Unreadable/unknown config | fails closed as `configured-depth-unknown` |
| Unknown selected row | fails instead of silently resolving to `1` |
| Generated config receipt | records only selected rows and depth numbers; canary token, private workspace, profile id, and paths are absent |
| Matrix dispatch after failed nested preflight | runner exits as harness infrastructure with `rowsExecuted:0`; fake k6 dispatch marker is absent |

The provisioner writes the private config at mode `0600`, refuses in-place
source rewrites, validates an existing depth before replacement, writes through
temporary files, and emits a separate public-safe receipt. Ordinary fleet
defaults are not modified.

Focused validation:

```bash
node --test --test-concurrency=1 \
  tools/k6-proofs/scripts/__tests__/continuation-depth-contract.test.mjs \
  tools/k6-proofs/scripts/__tests__/depth-preflight-rejected-sha-control.test.mjs \
  tools/k6-proofs/scripts/__tests__/seat-readiness.test.mjs

node --test --test-concurrency=1 \
  tools/k6-proofs/scripts/__tests__/harness-provenance-runner.test.mjs \
  tools/k6-proofs/scripts/__tests__/continuation-row-contract.test.mjs \
  tools/k6-proofs/scripts/__tests__/r-cd-token-runner-contract.test.mjs \
  tools/k6-proofs/scripts/__tests__/matrix-continuation-contract.test.mjs \
  tools/k6-proofs/scripts/__tests__/check-proof-row-manifests.test.mjs \
  tools/k6-proofs/scripts/__tests__/sanitize-k6-artifacts.test.mjs \
  tools/k6-proofs/scripts/__tests__/proof-harness-closure-contract.test.mjs

node tools/k6-proofs/scripts/check-manifest-scenarios.mjs --repo-root "$PWD"
node tools/k6-proofs/scripts/check-scenario-alignment.mjs --repo-root "$PWD"
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs --repo-root "$PWD"
node tools/k6-proofs/scripts/check-telemetry-contracts.mjs --repo-root "$PWD"
node tools/k6-proofs/scripts/validate-corpus.mjs --current
```

The two serialized Node test commands passed 19 and 60 tests respectively.
All named catalog, scenario, telemetry, and current-corpus validators passed.
No local full suite was used as an acceptance signal.

Machine receipt:
`receipts/129388-depth-token-fixture-refire/fixture-controls.json`.

## Fresh isolated runtime

The final proof root was fresh and private. It used:

| Check | Receipt |
|---|---|
| Host/tooling | Ronan `aarch64`; Node `v25.9.0`; k6 `v2.0.0` |
| Product | tracked-clean `0c033c46c6365929c669bb7eff60a58ec914dbdd`; tree `aa2cf494b7a859dbcdfaf33a279830033d2c6f36` |
| Dependencies | same-host symlink to clone `2f9b9b7a90988190a149208cbbad68558d1d7daa`; package, lock, and workspace hashes equal; no install in the linked worktree |
| Build | `dist/build-info.json` commit `0c033c46...`, SHA-256 `35fae0fa29607c7801082a374d58ead0daa1cf39350489f201a3dd43431fc329`; CLI `OpenClaw 2026.8.1 (0c033c4)` |
| Dist | 12,145 files; deterministic file-hash rollup `83c7f3a93042c2aa031740c7efec1bb7926922c0bacc45c7032b3859b6ed4ce2` before and after traffic/shutdown |
| Isolation | separate config, state database, workspace, home, logs, token file, and session transcripts |
| Auth | one fingerprint-matched OpenAI OAuth profile; profile id withheld; zero copied auth runtime state, sessions, tasks, flows, or ACP state |
| Config | SHA-256 `6d304601bf40f2943a411561675504c9a423f6f75c24fd3a45756064e65d714d`; explicit depth `5` |
| Service | `openclaw-proof-129388-depth-token-refire.service`; final proof PID `234961`, start ticks `58777066`; loopback-only port `19892` |
| OTel | direct `http://otel.dandelion.cult:4318`; `http/protobuf`; traces on; metrics/logs off; `captureContent=false`; sample `1`; service `ronan-isolated-129388-depth-token-0c033c46` |
| Final readiness | local receipt SHA-256 `1ecd4cc3152d49ad4e38f2849d94f522617e0fec03ab23e5c74b9ffe569c08e3`; `PASS-candidate`, depth `5/5/2` |
| Model smoke | one `low`-thinking `openai/gpt-5.6-sol` call in the final root returned the exact bounded sentinel |
| Tempo smoke | HTTP 200; 13 traces; only the unique service; roots include `openclaw.model.usage` |

Two pretraffic/setup failures are preserved rather than hidden:

1. The first base template used unsupported
   `discovery.wideArea.enabled`; exact config validation rejected it before
   service/model traffic, and the key was removed.
2. A discarded first root seeded its auth database one directory above the
   runtime-owned `$OPENCLAW_STATE_DIR/state/openclaw.sqlite`. Its one bounded
   `low`-thinking request reached OpenAI without authorization and returned
   HTTP 401. No proof row ran there. The unit was stopped, port `19892` was
   freed, that root was never reused, and the final root was created afresh at
   the exact owner path. The final root's auth-list gate saw exactly one profile
   before launch.

Machine receipt:
`receipts/129388-depth-token-fixture-refire/isolated-prefire.json`.

## Exact row-only workflow and artifact

```bash
gh workflow run project81-k6-proof.yml \
  --repo karmaterminal/karmaterminal-openclaw-docs \
  --ref codeagent/129388-depth-token-fixture-refire \
  -f rows=R-CD-CHAINED-DEPTH-2,R-CD-TOKEN \
  -f candidate_sha=0c033c46c6365929c669bb7eff60a58ec914dbdd \
  -f runtime_build_sha=0c033c46c6365929c669bb7eff60a58ec914dbdd \
  -f expected_max_spawn_depth=5 \
  -f dry_run=false \
  -f 'runner_labels_json=["self-hosted","ronan"]' \
  -f gateway_ws=ws://127.0.0.1:19892 \
  -f session_selector=main \
  -f seat_name=ronan-isolated-129388-depth-token \
  -f seat_class=raw-final-text \
  -f create_disposable_sessions=true \
  -f metrics_push=false \
  -f otel_service_name=ronan-isolated-129388-depth-token-0c033c46 \
  -f gateway_unit=openclaw-proof-129388-depth-token-refire.service
```

| Field | Value |
|---|---|
| Run | [33014309397](https://github.com/karmaterminal/karmaterminal-openclaw-docs/actions/runs/33014309397) |
| Workflow head | `96c0e1b59c205696806ae50cc659a08f4b79fd3d` |
| Runtime | `0c033c46c6365929c669bb7eff60a58ec914dbdd` |
| Provenance row selection | exactly `R-CD-CHAINED-DEPTH-2,R-CD-TOKEN` |
| Workflow conclusion | `failure` |
| Artifact | `9624150623`, `project81-k6-proof-33014309397`, 70 files |
| ZIP SHA-256 | `a1d7064a247f8cdbd91eea2d40c37ec474ab3cae7e01bc2a75739eb5da84a894` |
| Extracted checksum-manifest SHA-256 | `00e56a9130b443c3d66ef046e289fcb433a979318118eee008349de55f3981c4` |
| Workflow readiness | `PASS-candidate`; SHA-256 `eb084ef8420cf67a70ee0b6a53987a5de2344ffe4172af40b6e7aa0deaaf4989`; depth `5/5/2` |

### `R-CD-CHAINED-DEPTH-2`

Signed authority:

- verdict `PARTIAL-candidate`;
- failure `missing-or-invalid-task-ledger`;
- SHA-256 `f8ae84a3a1615826bb6098828a347df0263e1481dfa00dad0474ea5f8d2e7ba4`;
- HMAC validation `valid:true`.

Supplemental direct database/log review, which does not override the authority,
proved:

- exactly two distinct task/run identities;
- root child-session fingerprint equals the leaf requester's fingerprint;
- both tasks are `succeeded` and `delivered`, with no task error;
- exact first result is `CHILD-WAITING`;
- exact leaf result is `GRANDCHILD-DONE`;
- recovery wakes fired, but no exact `CHILD-DONE` result was frozen;
- no structured `heartbeat_respond` acceptance was logged;
- Tempo correlation withheld because the matched trace lacked the originating
  typed `continue_delegate` tool span.

Thus real depth 2 and both durable task deliveries occurred, but the required
recovered child return and later structured root consumption did not.

### `R-CD-TOKEN`

Signed authority:

- verdict `PARTIAL-candidate`;
- failure `incomplete-or-nonunique-lifecycle`;
- SHA-256 `84276d46fc7c2468328ca4b1a7ea295d03011c97ae09f4df2dc2cae0063b5e6a`;
- HMAC validation `valid:true`.

The bounded evidence proves raw-final parsing, one disposable origin task, one
origin-child-owned delegate task, fully paginated stable task snapshots, two
distinct task/run identities, and both tasks `succeeded`/`delivered`. Tempo
proves one dispatch and one fire on the same trace/chain with no typed-tool
origin.

Private runtime logs show the leaf result, the origin's normal
`Continuation completed with result` turn, and the later root result. The
bounded `sessions.messages.subscribe` receipt did not bind that return:
`delegate_return_observed=false`, and both return session hashes are null.
Therefore the required one normal-origin return/zero-substitution authority is
absent and cannot be inferred from logs.

### Predecessor comparison

Rejected run `33008913520`/artifact `9622119639` remains immutable. Its ZIP
SHA-256 is
`dbeb2af72e45e2d1a857f8d7ba09f42bddd046c2750c4d6b086579f1c39cbb08`.
That run's omitted config resolved to depth `1`, leaving both target rows with
zero depth-2 delegate tasks. The successor's workflow readiness is `5/5/2` and
both rows have two succeeded/delivered lineage-bound tasks. This proves the
fixture cure while preserving the successor behavioral reds.

Every Tempo interaction remains `partial`, `complete:false`, and
`countAuthority:false` because HTTP-200 responses omit `totalBlocks`. No zero
was interpreted as absence.

Machine receipt:
`receipts/129388-depth-token-fixture-refire/project81-run-33014309397.json`.

## Cleanup

- Only `openclaw-proof-129388-depth-token-refire.service` was stopped.
- Final PID `234961` is absent, the transient unit is unloaded, no process
  references the final private root, and port `19892` has zero listeners.
- Live `openclaw-gateway.service` remains PID `2272093`, start ticks
  `50957076`, config SHA-256
  `541f1838b549ccf53199a5b00f3607bf05588c7721577c3efd6b0fd446ee799f`.
- Foreign `openclaw-proof-a0aa4ec-hold.service` remains PID `2498654`, start
  ticks `51871376`, with both loopback listeners on `19891`.
- Candidate dist rollup is unchanged at
  `83c7f3a93042c2aa031740c7efec1bb7926922c0bacc45c7032b3859b6ed4ce2`;
  the product worktree is tracked-clean.
- Private logs, transcripts, databases, raw Tempo responses, and artifact ZIPs
  remain outside the repository.
- Product, presentation, docs main, `PROOFS/`, and `PROOFS/INDEX.json` were not
  modified. No PR was opened and no issue was closed.

Machine receipt:
`receipts/129388-depth-token-fixture-refire/cleanup.json`.

## Fold handoff

**Blocked.** The fixture regression is cured, but neither required row has a
`PASS-candidate` signed authority. Do not fold this artifact, update docs
main/index, move presentation, close #103/#119, or retry either row without a
new workorder that owns the remaining behavioral/observation boundaries.
