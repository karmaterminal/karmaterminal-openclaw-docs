# PR #129388 final isolated three-row refire

## Outcome

Status: **TROUBLE; required outcome not met**.

Exact Project-81 run
[33008913520](https://github.com/karmaterminal/karmaterminal-openclaw-docs/actions/runs/33008913520)
executed only the three authorized rows on runtime
`0c033c46c6365929c669bb7eff60a58ec914dbdd` and reviewed harness
`85a783f4ef0352e64b37748f4164d5fdee96ceb4`. All three HMAC-validated
authorities are `PARTIAL-candidate`, so the required all-PASS result is absent.

| Row | Signed verdict | Classification |
|---|---|---|
| `R-CD-2` | `PARTIAL-candidate` | Product recurrence: typed call completed, but dispatch/fire still lack the originating `openclaw.tool.execution` parent |
| `R-CD-CHAINED-DEPTH-2` | `PARTIAL-candidate` | Isolated-fixture infrastructure: nested spawn rejected at product default `maxSpawnDepth=1` |
| `R-CD-TOKEN` | `PARTIAL-candidate` | Isolated-fixture infrastructure: raw-final origin completed, but its nested delegate was rejected at `maxSpawnDepth=1` |

The workflow conclusion is `failure`. No row was retried, no candidate envelope
was promoted, and no artifact was folded into the corpus.

Acceptance path: **focused-only plus named Project-81 live run
`33008913520`**. Mode-B, Gate 3g, a monolithic local suite, and
Crabbox/Testbox were not used or claimed.

## Named-ref contract

The unchanged safe lane was published before any candidate evidence. The
executed workflow head remained the reviewed harness commit; the final
report-only successor changes no workflow, harness, scenario, manifest,
`PROOFS/`, or product byte.

| Category | Required ref | Resolved SHA | Local | Tracking | Server | Equality / use |
|---|---|---|---|---|---|---|
| Product/runtime composite | `karmaterminal/openclaw:codeagent/129388-runtime-composite-final-cures@0c033c46c6365929c669bb7eff60a58ec914dbdd` | `0c033c46c6365929c669bb7eff60a58ec914dbdd` | `0c033c46c6365929c669bb7eff60a58ec914dbdd` | `0c033c46c6365929c669bb7eff60a58ec914dbdd` | `0c033c46c6365929c669bb7eff60a58ec914dbdd` | local = tracking = server; tracked-clean |
| Safe lane, pre-evidence/executed | `karmaterminal/karmaterminal-openclaw-docs:codeagent/129388-final-three-row-refire` | `85a783f4ef0352e64b37748f4164d5fdee96ceb4` | `85a783f4ef0352e64b37748f4164d5fdee96ceb4` | `85a783f4ef0352e64b37748f4164d5fdee96ceb4` | `85a783f4ef0352e64b37748f4164d5fdee96ceb4` | unchanged branch published; local = tracking = server |
| CI/workflow | `.github/workflows/project81-k6-proof.yml` from exact safe-lane ref | `85a783f4ef0352e64b37748f4164d5fdee96ceb4` | `85a783f4ef0352e64b37748f4164d5fdee96ceb4` | `85a783f4ef0352e64b37748f4164d5fdee96ceb4` | `85a783f4ef0352e64b37748f4164d5fdee96ceb4` | run head equal; blob `c08b7b5556e604feb62b981b3c41dfec4cb013ea`, SHA-256 `6b7cb215cc64ae250c748561e9023f2b602bdf7e3fafa3b9532d1a65703d8c1a` |
| Presentation | `karmaterminal/openclaw:codeagent/85651-upstream-1ba243c8-gates@4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | local = tracking = server; read-only |
| Docs/proof harness base | `karmaterminal/karmaterminal-openclaw-docs@85a783f4ef0352e64b37748f4164d5fdee96ceb4` | `85a783f4ef0352e64b37748f4164d5fdee96ceb4` | `85a783f4ef0352e64b37748f4164d5fdee96ceb4` | `85a783f4ef0352e64b37748f4164d5fdee96ceb4` | `85a783f4ef0352e64b37748f4164d5fdee96ceb4` | local = harness tracking = harness server |
| Failed predecessor evidence | `karmaterminal/karmaterminal-openclaw-docs@dc6bffc8f55692a9fc6131d67c77a4e9b116a4ed`; run `32981265676`; artifact `9612027467` | `dc6bffc8f55692a9fc6131d67c77a4e9b116a4ed` | `dc6bffc8f55692a9fc6131d67c77a4e9b116a4ed` | N/A (immutable commit/run/artifact) | `dc6bffc8f55692a9fc6131d67c77a4e9b116a4ed` | local = server; predecessor ZIP SHA-256 `0505d580b8a59da3b8c81a8fde417fadd779e08faf004dc5c1bf113904523794` |

Machine receipt:
`receipts/129388-final-three-row-refire/named-refs.json`.

## Exact runtime and isolated gateway

| Check | Receipt |
|---|---|
| Host/tooling | Ronan `aarch64`; Node `v25.9.0`; k6 `v2.0.0` |
| Source | Tracked-clean exact checkout `0c033c46c6365929c669bb7eff60a58ec914dbdd`; tree `aa2cf494b7a859dbcdfaf33a279830033d2c6f36` |
| Dependencies | Same-host `node_modules`; dependency clone `2f9b9b7a90988190a149208cbbad68558d1d7daa`; package, workspace, and lock bytes equal; no install or reconciliation in the linked worktree |
| Build identity | `dist/build-info.json` commit `0c033c46...`, SHA-256 `35fae0fa29607c7801082a374d58ead0daa1cf39350489f201a3dd43431fc329`; CLI `OpenClaw 2026.8.1 (0c033c4)` |
| Stable dist | 12,145 files; SHA-256 `df69f1f13969f71a5ce6c6e363daa2689f924e2f1b33bce325683356807ea453` before smoke, after smoke, after row traffic, and after shutdown |
| Isolation | Separate private config, state, SQLite databases, workspace, home, logs, token file, and disposable sessions; zero live/prior sessions copied |
| Auth route | One OpenAI OAuth profile copied into the isolated shared state DB; profile id withheld and fingerprinted; zero auth runtime-state rows before and after smoke |
| Service | `openclaw-proof-129388-final-three-row-refire.service`; final prefire PID/PGID/SID `160460`; loopback `127.0.0.1:19892` and `[::1]:19892` only |
| OTel | `diagnostics-otel`; direct `http://otel.dandelion.cult:4318`; `http/protobuf`; traces on; metrics/logs off; `captureContent=false`; sample `1.0`; service `ronan-isolated-129388-0c033c46` |
| Readiness | Final prefire `PASS-candidate`; authenticated health/status; continuation defaults present; raw-final-text seat |
| Model smoke | One actual OpenAI model call returned the exact bounded sentinel; private result SHA-256 `cbcd88178c7214befc4ddc1fc9557197520b9738bdc207a791c8b393579d56a6` |
| Tempo smoke | 24 traces under the unique service before dispatch; root names include `openclaw.model.usage`; HTTP 200 |
| Backend honesty | Tempo omitted `totalBlocks`; retained as `partial`, `complete=false`, `countAuthority=false` |

The first readiness probe classified a local setup fault before model traffic:
Control UI was disabled, so `/status` returned 404. Enabling that isolated
surface caused the non-restarting transient unit to exit cleanly; the same named
unit was relaunched and the final readiness receipt passed. A first smoke client
invocation was likewise rejected before gateway/model traffic because
`minimal` thinking is unsupported for `openai/gpt-5.6-sol`; the one actual
model call used supported `low` thinking.

The remaining isolated-fixture mistake was not covered by seat readiness:
`agents.defaults.subagents.maxSpawnDepth` was omitted. Product therefore used
its documented default `1`, while Ronan's proof profile requires `5`. This
deterministically invalidated the two rows that need a nested spawn.

Machine receipt:
`receipts/129388-final-three-row-refire/isolated-prefire.json`.

## Project-81 workflow and artifact

| Field | Value |
|---|---|
| Run | [33008913520](https://github.com/karmaterminal/karmaterminal-openclaw-docs/actions/runs/33008913520) |
| Workflow head | `85a783f4ef0352e64b37748f4164d5fdee96ceb4` |
| Product/runtime input | `0c033c46c6365929c669bb7eff60a58ec914dbdd` |
| Conclusion | `failure` |
| Artifact | ID `9622119639`, `project81-k6-proof-33008913520`, 99 files |
| Artifact ZIP SHA-256 | `dbeb2af72e45e2d1a857f8d7ba09f42bddd046c2750c4d6b086579f1c39cbb08` |
| Extracted checksum-manifest SHA-256 | `107f98ff4f00290aebd44a8913587aec71c7d6ec0b737d2dc39c29574a419c7c` |
| Harness provenance | Matrix `20260826T200923Z-85a783f4ef03-71d35f5f`; identity verified; runner SHA-256 `0cbe17db11c17f6487c6a96aeb61866dcdde5121fe5407f19c323dc6092873d3` |
| Workflow seat readiness | `PASS-candidate`; SHA-256 `36527a9920d7788dc09d0471785b30a2ea3c410d0d971622eb87ec218c3ec34c` |

The workflow YAML was read at the exact executed ref. Every supplied input name
exists there, and every copied row manifest/scenario matches both
`runner-metadata.json` and the immutable Git blob at `85a783f4...`.

All three row receipts independently validate with
`hmac-sha256-gateway-token-v1`. No `candidate-run-result.json` was emitted:
R-CD-2 retains pending trace receipts, while the other two rows have nonzero
effective exits.

Machine receipt:
`receipts/129388-final-three-row-refire/project81-run-33008913520.json`.

## Row classifications

### `R-CD-2` — product recurrence

The signed authority is `PARTIAL-candidate`,
`missing-continuation-topology`, SHA-256
`c67150f8c0c38dcaf29118ef7377ec53ab760f85671ba2b4affce4d648de82aa`.

Behavior completed:

- the isolated transcript contains one successful typed
  `continue_delegate` tool result;
- the durable child task is `succeeded`/`delivered`;
- direct journal evidence records one spawn and one enrichment return;
- the row-bound `continuation.delegate.dispatch` and
  `continuation.delegate.fire` are on one trace/chain with status OK.

Direct Tempo inspection after workflow completion still found no
`openclaw.tool.execution` span for the row's typed call. The dispatch parent is
an `openclaw.run` span. The same process later emitted a correctly parented
`openclaw.tool.execution` span for the depth-2 row, excluding blanket exporter
absence or simple late arrival.

This repeats predecessor run `32981265676` (receipt SHA-256
`94fa0439efa6a28cf5e17ba51d64910566f73a204715499f11f4b62289c2db05`).
The final-cure integration test manually constructs the delegate tool span for
its round trip and composes a real wrapped typed tool only for
`continue_work`; it does not exercise the live Codex app-server
`continue_delegate` route.

Owner boundary:

```text
Codex item/tool/call
  -> OpenClaw dynamic-tool request controller
  -> wrapped tool.execution.started child context
  -> continue_delegate dispatch traceparent
  -> continuation.delegate.dispatch
  -> continuation.delegate.fire
```

Exact upstream Codex `0.149.1` source at
`ff29a44391deccde0aba0f8390337d7f3c319ea4` confirms Codex emits one
dynamic-tool request and waits for OpenClaw's response; span ownership remains
in OpenClaw.

Issue update:
[karmaterminal/openclaw#1251](https://github.com/karmaterminal/openclaw/issues/1251#issuecomment-5430773327).

### `R-CD-CHAINED-DEPTH-2` — infrastructure-invalidated

The signed authority is `PARTIAL-candidate`,
`missing-or-invalid-task-ledger`, SHA-256
`5d43a418ed594dcc0739879d438e4cbc435c4e690b2a785ccff5af7342e863fd`.

The root typed dispatch has the correct tool-parented trace. Its depth-1 task
then succeeded and delivered, but its required grandchild spawn was rejected:

```text
sessions_spawn is not allowed at this depth
(current depth: 1, max: 1; agents.defaults.subagents.maxSpawnDepth).
```

No grandchild task exists, so exact depth 2, both returns, frozen child/root
targets, and structured root consumption cannot be evaluated. This is not a
recurrence of the predecessor producer bug: run `32981265676` did establish
real depth 2 and both returns before stopping on the old prose-ack proxy.

Issue update:
[#119](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/119#issuecomment-5430773486).

### `R-CD-TOKEN` — infrastructure-invalidated

The signed authority is `PARTIAL-candidate`,
`incomplete-or-nonunique-lifecycle`, SHA-256
`410ed60b4b1e2d2b730000ebc18317c23dac0550bcf8573c98586cc9ea4cd2ab`.

Exact candidate/runtime identity, raw-final-text, disposable-origin, prompt
injection, and send acceptance gates passed. One origin task exists and is
`succeeded`/`delivered`; its terminal bracket was parsed and armed a delegate.
That depth-2 spawn then hit the same `maxSpawnDepth=1` rejection. The durable
ledger therefore contains zero delegate tasks, no normal origin return, and no
root-substituted return; the rejected dispatch span is status ERROR.

Predecessor run `32981265676` had one durable delegate and a root-substituted
return. This run stops earlier and does not evaluate the final origin-owner
cure.

Issue updates:
[#103](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/103#issuecomment-5430773661)
and
[karmaterminal/openclaw#1054](https://github.com/karmaterminal/openclaw/issues/1054#issuecomment-5430773777).

## Backend disposition

Every row's `backend-status.json` is `partial`, `complete=false`, and
`countAuthority=false` because Tempo's HTTP-200 responses omitted
`totalBlocks`. No zero was interpreted as absence. This backend limitation is
independent from:

- R-CD-2's directly observed wrong parent topology;
- the depth-2 and token rows' durable `maxSpawnDepth` rejection;
- the HMAC authorities' non-PASS verdicts.

## Direct review

No Explore agent, task agent, code-review agent, Opus, autoreview, or other AI
subagent was used.

Direct inspection covered the exact workflow bytes, all three scenarios and
manifests, result resolver/validator contracts, signed receipts, copied-source
digests, run artifact, predecessor artifact, isolated state DB, agent
transcripts, Codex rollouts, raw unit journal, direct Tempo search/trace JSON,
the tool wrapper and diagnostic child-context owner, the OTel continuation
adapter, the Codex dynamic-tool request controller, adjacent tests, and exact
upstream Codex protocol/runtime source.

No docs harness or product source was repaired in this lane. The two fixture
reds have a deterministic configuration cause, but the independent R-CD-2
product recurrence requires a product successor and regression at the live
Codex composition boundary. The workorder therefore requires STOP rather than
a redispatch.

## Cleanup

- Only `openclaw-proof-129388-final-three-row-refire.service` was stopped.
  PID/PGID/SID `160460` is absent, the transient unit is unloaded, and port
  `19892` is free.
- Live prince `openclaw-gateway.service` remained active with PID `2272093`,
  start ticks `50957076`, and config SHA-256
  `541f1838b549ccf53199a5b00f3607bf05588c7721577c3efd6b0fd446ee799f`.
- Foreign held proof service `openclaw-proof-a0aa4ec-hold.service` remained
  active with PID `2498654`, start ticks `51871376`, and both listeners on
  `19891`.
- Candidate dist remains
  `df69f1f13969f71a5ce6c6e363daa2689f924e2f1b33bce325683356807ea453`;
  the product worktree is tracked-clean.
- Private ZIPs, raw journals, direct Tempo captures, transcripts, and isolated
  SQLite state remain outside the repository.
- `PROOFS/`, `PROOFS/INDEX.json`, `.github/`, `tools/k6-proofs/`, docs `main`,
  product branches, and presentation remain untouched.
- No PR was opened; no issue was closed.

Machine receipt:
`receipts/129388-final-three-row-refire/cleanup.json`.

## Exact dispatch

```bash
gh workflow run project81-k6-proof.yml \
  --repo karmaterminal/karmaterminal-openclaw-docs \
  --ref codeagent/129388-final-three-row-refire \
  -f rows=R-CD-2,R-CD-CHAINED-DEPTH-2,R-CD-TOKEN \
  -f candidate_sha=0c033c46c6365929c669bb7eff60a58ec914dbdd \
  -f runtime_build_sha=0c033c46c6365929c669bb7eff60a58ec914dbdd \
  -f dry_run=false \
  -f 'runner_labels_json=["self-hosted","ronan"]' \
  -f gateway_ws=ws://127.0.0.1:19892 \
  -f session_selector=main \
  -f seat_name=ronan-isolated-129388 \
  -f seat_class=raw-final-text \
  -f create_disposable_sessions=true \
  -f metrics_push=false \
  -f otel_service_name=ronan-isolated-129388-0c033c46 \
  -f gateway_unit=openclaw-proof-129388-final-three-row-refire.service \
  -f 'tempo_traceql={ resource.service.name="ronan-isolated-129388-0c033c46" }' \
  -f 'loki_logql={service_name="ronan-isolated-129388-0c033c46"}'
```

## Fold handoff

**Blocked.** Do not fold this artifact, update docs main/index, move
presentation, close issues, or treat either infrastructure-invalidated row as a
product verdict. A successor must first:

1. repair R-CD-2 at the live Codex dynamic-tool/tool-span composition boundary
   with a deterministic rejected-SHA control;
2. provision the isolated proof profile with
   `agents.defaults.subagents.maxSpawnDepth=5`;
3. run a newly authorized exact-row refire.
