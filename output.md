# R-CD-TOKEN normal-origin return observer cure

## Verdict

**Owner: docs harness.** Product SHA
`0c033c46c6365929c669bb7eff60a58ec914dbdd` emitted the normal origin
assistant event required by the row. The rejected harness accepted only a
user/system event carrying a textual `[Inter-session message]` header, but the
product intentionally suppresses that internal announce input from the public
display projection. The later assistant event is public and carries the exact
run and message-sequence identities needed for authority.

Implementation checkpoint
`476ee9346495e9db991539fdc3c10bb34474ed9c` is pushed with local, tracking,
and server equality. The exact frozen run remains `PARTIAL-candidate`; this
lane performed no live refire and does not retroactively promote artifact
`9624150623`.

Bound issue: #103.

## Named refs

The pre-evidence identity receipt is
`receipts/129388-token-return-observer-cure/named-refs.md`.

| Category | Named ref | Resolved SHA | Local | Tracking | Server | Verdict |
|---|---|---|---|---|---|---|
| Docs/base | `karmaterminal/karmaterminal-openclaw-docs@fd4d323bc396c044890dd732b7d10c7ad346415e` | `fd4d323bc396c044890dd732b7d10c7ad346415e` | same | safe lane initially published at same | commit object same | equal before evidence |
| Safe lane implementation | `karmaterminal/karmaterminal-openclaw-docs:codeagent/129388-token-return-observer-cure` | `476ee9346495e9db991539fdc3c10bb34474ed9c` | same | same | same | equal and pushed |
| Product/runtime evidence | `karmaterminal/openclaw:codeagent/129388-runtime-composite-final-cures` | `0c033c46c6365929c669bb7eff60a58ec914dbdd` | same | same | same | equal, read-only |
| CI/workflow | Focused harness tests only | N/A | N/A | N/A | N/A | focused-only; no live dispatch |
| Presentation | `karmaterminal/openclaw:codeagent/85651-upstream-1ba243c8-gates` | `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | same | same | same | equal, read-only |
| Docs/proof ref | Immutable run `33014309397` head | `96c0e1b59c205696806ae50cc659a08f4b79fd3d` | commit object same | source branch has advanced | run head same; source branch has advanced | immutable run identity exact; mutable branch not credited |
| Run/artifact | Run `33014309397`, artifact `9624150623` | `96c0e1b59c205696806ae50cc659a08f4b79fd3d` | run head object same | N/A | Actions run head same | equal |

## Product versus observer classification

The exact product paths were inspected read-only.

1. `sessions.messages.subscribe` is a live-only subscription. Its schema has no
   replay cursor, while emitted `session.message` payloads carry `messageSeq`,
   message metadata, and `runId`.
2. Normal continuation delivery derives the requester turn id as
   `announce:v1:<child session>:<child run>`.
3. The public display projection intentionally hides the inter-session
   `subagent_announce` user input. It still emits the origin assistant reply.
4. The preserved run ordering is delegate result, then the origin's normal
   `Continuation completed with result` assistant turn, then a later root
   result. The subscriber was active before both later events.
5. The old parser rejected the origin event solely because its role was
   `assistant` and it had no textual provenance header. This is classification
   1 from the workorder: product emitted the normal return event, but the docs
   observer correlated the wrong projection.

No product issue was filed. No private log or transcript text was admitted as
PASS authority.

## Repaired invariant and composition boundary

**Invariant:** after the disposable origin's initial-run cursor, exactly one
public assistant `session.message` on that origin must contain the exact nonce
sentinel and have run id
`announce:v1:<accepted delegate child session>:<accepted delegate run>`.
Neither the stale bracket-bearing origin response nor the later root response
may substitute.

The owning composition boundary is:

`sessions.create` -> `sessions.send` -> fully paginated stable `tasks.list` ->
origin `sessions.messages.subscribe` -> initial-origin `sessions.get` cursor ->
public assistant event -> row evidence classifier -> HMAC-signed row receipt ->
candidate envelope.

The observer subscribes before taking the cursor snapshot, buffers live events
while the snapshot is pending, and derives the cursor only from assistant
messages owned by the initial origin run. That closes both gaps:

- an event arriving after task terminal but within the settle window remains
  eligible;
- an event arriving before the cursor response remains eligible if its
  sequence is newer than the initial origin run.

Any rejected cursor snapshot, missing cursor, buffer overflow, duplicate normal
return, missing event, wrong target, wrong nonce, conflicting run identity, or
stale sequence withholds PASS.

## Exact artifact negative and successor

The deterministic fixture is
`tools/k6-proofs/tests/fixtures/r-cd-token-run-33014309397.json`.
It freezes run/artifact identity, source digests, the original public
`delegate_return_observed=false` result, subscription/event ordinals,
transcript sequence relationships, and accepted-child run composition.
Private session, task, run, message, nonce, attempt, trace, and chain values are
replaced with deterministic aliases.

The artifact did not persist raw websocket payloads. The fixture therefore
combines the exact artifact's public evidence with the preserved origin
transcript's relational projection and source digests. It does not infer a
historical PASS: `frozenPublicEvidence` remains `PARTIAL-candidate`.

| Control | Receipt |
|---|---|
| Rejected harness | `96c0e1b59c205696806ae50cc659a08f4b79fd3d` |
| Rejected parser blob | `46aad0fb67df07af4e1724c26d14bef31130a378` |
| Negative command | `node --test tools/k6-proofs/scripts/__tests__/r-cd-token-contract.test.mjs` with the byte-identical rejected parser |
| Negative result | exit `1`; exact normal-origin assertion received `actual: null` |
| Negative log SHA-256 | `8a12618f87c764396780df540f619247ad1d6f8f29a24f91a8c5bc45b566e607` |
| Successor implementation | `476ee9346495e9db991539fdc3c10bb34474ed9c` |
| Successor parser blob | `0cc06b653e14c14d92bb4cf781462f93df6eb7af` |
| Successor result | the same exact-run assertion passes |

The fixture proves these distinct projections:

| Event | Public relation | Disposition |
|---|---|---|
| Initial origin response | origin session, initial origin run, sequence `2`, bracket embeds sentinel | reject as stale cursor/run |
| Normal origin return | origin session, accepted-child announce run, sequence `3`, exact sentinel once | accept exactly once |
| Later root result | root session, nested announce run, sequence `5`, exact sentinel | reject as root substitution |

## Regression coverage

The focused tests cover:

- exactly one normal return bound to the disposable origin;
- zero root-substituted acceptance;
- return arrival after delegate terminal and within settle;
- wrong session, wrong nonce, wrong/contradictory run, stale cursor, duplicate
  return, root-only return, log-only text, and missing public event;
- raw-final seat, task-ledger pagination/stability, accepted-child lineage,
  trace/reason binding, signed receipt, and candidate-envelope requirements;
- private identifier removal and k6/service-log sanitization;
- interruption as structured non-retriable `PARTIAL-candidate`;
- manifest/scenario, workflow, matrix, telemetry, and proof-closure contracts.

| Recovery concern | Disposition |
|---|---|
| Persistence | The bounded observer is intentionally in-memory; persistent authority is the sanitized evidence plus HMAC-signed receipt and candidate envelope. |
| Rollback | Reverting the implementation returns the exact fixture assertion to `actual: null`; no success fallback exists. |
| Restart/recovery | An interrupted websocket attempt writes the existing non-retriable interruption packet; this lane adds no retry or restart inference. |
| Partial failure | Subscription/cursor rejection, missing public event, or event-buffer overflow remains non-PASS. |
| Nearest sibling | `R-CD-CHAINED-DEPTH-2` already uses direct session/run/message-sequence authority; `R-CD-2` remains lifecycle-based and unchanged. |
| Alternate seat path | `message-body` and unknown surfaces remain `PARTIAL-candidate`. |

## Validation

Acceptance path: **focused-only**. No Mode-B run, Gate 3g fallback, live gateway
dispatch, or monolithic product suite was used.

Focused command:

```bash
node --check tools/k6-proofs/scenarios/r-cd-token-bracket-delegate.js
node --test --test-concurrency=1 \
  tools/k6-proofs/scripts/__tests__/r-cd-token-contract.test.mjs \
  tools/k6-proofs/scripts/__tests__/r-cd-token-authoritative-receipt.test.mjs \
  tools/k6-proofs/scripts/__tests__/r-cd-token-runner-contract.test.mjs \
  tools/k6-proofs/scripts/__tests__/r-cd-token-interruption.test.mjs \
  tools/k6-proofs/scripts/__tests__/candidate-run-result.test.mjs \
  tools/k6-proofs/scripts/__tests__/sanitize-k6-artifacts.test.mjs \
  tools/k6-proofs/scripts/__tests__/continuation-row-contract.test.mjs \
  tools/k6-proofs/scripts/__tests__/matrix-continuation-contract.test.mjs \
  tools/k6-proofs/scripts/__tests__/continuation-acceptance-matrix.test.mjs \
  tools/k6-proofs/scripts/__tests__/harness-provenance-runner.test.mjs \
  tools/k6-proofs/scripts/__tests__/proof-harness-closure-contract.test.mjs
```

Result: `133/133` pass, serialized. Log SHA-256:
`c2ba3ceb7e124590017ceeadfc6d7d7c97248c8bf12bc5d01cb72e8caa98bcc7`.

Catalog commands:

```bash
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs
node tools/k6-proofs/scripts/check-scenario-alignment.mjs
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs
node tools/k6-proofs/scripts/check-telemetry-contracts.mjs
node tools/k6-proofs/scripts/validate-corpus.mjs --current
git diff --check
```

Catalog log SHA-256:
`c1b221445c3d2463baedc2127a3de8f475f231f6330f8b339b5f0f2ffa908614`.

## Public safety and scope

Direct review covered the complete changed parser, scenario lifecycle, signed
resolver/validator, candidate-envelope caller, manifest, frozen fixture, and
the adjacent `R-CD-CHAINED-DEPTH-2` message-sequence and `R-CD-2` lifecycle
authorities. No unresolved correctness or scope finding remained.

The behavioral implementation checkpoint changes 11 files, `+653/-34`.
The separate pre-evidence named-ref receipt adds one file and 11 lines.

| Behavioral path | + | - |
|---|---:|---:|
| `tools/k6-proofs/README.md` | 9 | 0 |
| `tools/k6-proofs/lib/r-cd-token-authoritative-receipt.mjs` | 23 | 1 |
| `tools/k6-proofs/lib/r-cd-token-contract.js` | 125 | 9 |
| `tools/k6-proofs/manifests/r-cd-token.json` | 7 | 6 |
| `tools/k6-proofs/scenarios/r-cd-token-bracket-delegate.js` | 120 | 11 |
| `tools/k6-proofs/scripts/__tests__/candidate-run-result.test.mjs` | 4 | 0 |
| `tools/k6-proofs/scripts/__tests__/proof-harness-closure-contract.test.mjs` | 22 | 0 |
| `tools/k6-proofs/scripts/__tests__/r-cd-token-authoritative-receipt.test.mjs` | 10 | 0 |
| `tools/k6-proofs/scripts/__tests__/r-cd-token-contract.test.mjs` | 163 | 7 |
| `tools/k6-proofs/scripts/__tests__/r-cd-token-runner-contract.test.mjs` | 7 | 0 |
| `tools/k6-proofs/tests/fixtures/r-cd-token-run-33014309397.json` | 163 | 0 |

Raw private runtime logs, databases, transcripts, tokens, and identifiers remain
outside the repository. The sanitized fixture rejects the known private nonce,
session fragments, run fragments, and UUID shapes, and the repository sanitizer
tests pass.

Product, presentation, docs main, `PROOFS/`, `PROOFS/INDEX.json`, and the
runtime were not modified. No PR was opened, no live proof was fired, no
automatic retry was armed, and #103 was not closed.

Machine receipt:
`receipts/129388-token-return-observer-cure/regression.json`.

## R-CD-TOKEN-only refire handoff

After review, refire **only** `R-CD-TOKEN` against product
`0c033c46c6365929c669bb7eff60a58ec914dbdd`, using the same isolated
raw-final-text profile and the final server-equal safe-lane branch:

```bash
gh workflow run project81-k6-proof.yml \
  --repo karmaterminal/karmaterminal-openclaw-docs \
  --ref codeagent/129388-token-return-observer-cure \
  -f rows=R-CD-TOKEN \
  -f candidate_sha=0c033c46c6365929c669bb7eff60a58ec914dbdd \
  -f runtime_build_sha=0c033c46c6365929c669bb7eff60a58ec914dbdd \
  -f expected_max_spawn_depth=5 \
  -f dry_run=false \
  -f 'runner_labels_json=["self-hosted","ronan"]' \
  -f gateway_ws="ws://127.0.0.1:${REVIEWED_ISOLATED_PORT}" \
  -f session_selector=main \
  -f seat_name="${REVIEWED_ISOLATED_SEAT}" \
  -f seat_class=raw-final-text \
  -f create_disposable_sessions=true \
  -f metrics_push=false \
  -f otel_service_name="${REVIEWED_ISOLATED_SERVICE}" \
  -f gateway_unit="${REVIEWED_ISOLATED_UNIT}"
```

Do not reuse run `33014309397`, retry automatically, fire
`R-CD-CHAINED-DEPTH-2`, or fold the corpus. A successful refire must produce one
signed normal-origin return with
`originReturnMessageSeq > originReturnCursor`,
`exactlyOneNormalOriginReturn=true`, and `rootSubstitutedReturn=false`.
