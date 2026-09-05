# Final proof closure wave after presentation advance

This is the executable staging packet for `openclaw/openclaw#129388` after the
visible presentation advanced to `43c8fb88` and became dirty against upstream.
It does not move presentation, absorb upstream, deploy product, or accept
current `dbf5795b...` evidence as proof of the pending successor.

## Frozen current state

```text
canonical pure/corpus  5035aac3a96df18f0a5d5a5c3e91a516a32daf32
pure tree              5ff71a670d75022c45e0ecaf9ecddcf57d2a33a2
structural checkpoint  5112637f92033f25276a7925d3c209d5da2f593a
current runtime        dbf5795bd5dd406f586575d883a7878288e591ad
runtime class          deployment composite, not final product
rollup                 21 PASS / 7 PARTIAL / 1 FAIL / 9 MISSING
```

`CLOSURE-WAVE-LEDGER.json` is the restart-safe row authority. Run:

```bash
SHA=5035aac3a96df18f0a5d5a5c3e91a516a32daf32
node tools/k6-proofs/scripts/check-final-proof-closure-ledger.mjs \
  --ledger "PROOFS/$SHA/CLOSURE-WAVE-LEDGER.json" \
  --index PROOFS/INDEX.json \
  --manifest "PROOFS/$SHA/proofs-manifest.json"
```

## Immediate wave on current docs/pure bytes

These actions are executable now because they do not claim final-successor
behavior:

```bash
SHA=5035aac3a96df18f0a5d5a5c3e91a516a32daf32
node tools/k6-proofs/scripts/validate-corpus.mjs --current --strict
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs
node tools/k6-proofs/scripts/check-scenario-alignment.mjs
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs

node --test \
  tools/k6-proofs/scripts/__tests__/request-compaction-receipt.test.mjs \
  tools/k6-proofs/scripts/__tests__/r-rc-2-honest-limit-policy.test.mjs \
  tools/k6-proofs/scripts/__tests__/candidate-run-result.test.mjs \
  tools/k6-proofs/scripts/__tests__/final-proof-closure-ledger.test.mjs
```

No canonical acceptance row may fire on `dbf5795b...` in this wave. It is not
the pending final successor and receipts cannot be reused across changed
behavior.

## Successor admission gate

Before any command below:

```bash
test "$FINAL_SUCCESSOR_SHA" != 5035aac3a96df18f0a5d5a5c3e91a516a32daf32
test "$FINAL_SUCCESSOR_SHA" != dbf5795bd5dd406f586575d883a7878288e591ad
test "$(git rev-parse "$FINAL_PRODUCT_CHECKOUT^{commit}")" = "$FINAL_SUCCESSOR_SHA"
test "$(git status --porcelain --untracked-files=no)" = ""
test "$(git ls-remote "$PRODUCT_REMOTE" "$FINAL_SUCCESSOR_REF" | awk '{print $1}')" = \
  "$FINAL_SUCCESSOR_SHA"
test "$(git ls-remote "$DOCS_REMOTE" "$APPROVED_DOCS_REF" | awk '{print $1}')" = \
  "$APPROVED_DOCS_SHA"
```

Require six exact deployment/readiness receipts naming the final successor.
If runtime carries a distinct reviewed ancillary composite, freeze that SHA,
tree, patch identities, and materiality separately. The canonical corpus path
and candidate fields remain the pure final-successor SHA.

For every live row:

```bash
export OPENCLAW_CANDIDATE_SHA="$FINAL_SUCCESSOR_SHA"
export OPENCLAW_RUNTIME_BUILD_SHA="$FINAL_RUNTIME_SHA"
export OPENCLAW_CREATE_DISPOSABLE_SESSION=true
export OPENCLAW_SEAT_NAME="$SELECTED_SEAT"
export K6_PROOF_OUT_DIR="$PRIVATE_OUT_ROOT"

./tools/k6-proofs/scripts/run-proofs.sh --live \
  --docs-ref "$APPROVED_DOCS_SHA" \
  "$ROW_ID" "$FINAL_SUCCESSOR_SHA"
```

Run one row per command with a new session, nonce, and run directory. A
semantic non-PASS is terminal. An infrastructure retry requires a separately
classified retained attempt and explicit new-attempt authority.

## Five live PARTIAL controls

### `LIVE-R-CD-1`

Rejected base: parent send accepted, but no authoritative scheduled task,
child, return, or trace.

Successor: one typed `continue_delegate` call creates exactly one task and
child, returns once to the parent, and emits the correlated tool/dispatch/fire
trace.

### `LIVE-R-CD-4`

Use two newly-created disposable sessions. Success requires exactly one child
return at the target session and zero corresponding return at the parent.
Bind target, requester, child, task, and trace identities.

### `LIVE-R-CD-CHAINED-DEPTH-2`

Run Chain-1, Chain-2, and Chain-3 serially in one disposable root. Do not
advance until the preceding child/task receipt exists. Success requires child
and grandchild task identities plus one root-bound return on the same chain.

### `LIVE-R-CD-MODEL-TOOL`

Preflight the requested model on the selected seat. Success requires one typed
delegate, one task/child, requested model equal to observed child runtime
model, one return, and one trace. Model self-report is auxiliary only.

### `LIVE-R-CD-SILENT`

Success requires one silent delegate completion and one internal parent return
with zero channel delivery. Absence of visible channel output is not itself
proof.

## Mandatory FAIL repair control

### `LIVE-R-CD-2`

Before refire, replay one deterministic ordered event packet through the
terminal parser and resolver:

```text
agent:start
continue_delegate toolResult status=scheduled mode=silent-wake
assistant session.message exact terminal sentinel
agent:end for the same run
wake lifecycle
quiet no-channel window
```

The rejected base remains the signed `missing-terminal-sentinel` attempt. The
successor must bind the sentinel to its own run identity rather than a mutable
local lifecycle window.

## Six missing producer rows

The current registered entries for these rows are consumers or scaffolds, not
producer fires. Do not run the static validator and call the result a producer.
Each named producer entrypoint must be implemented, reviewed, and bound to the
final successor before its command becomes executable.

### `PRODUCER-R-CD-COLLECTION-ON-COLLAPSE`

Required entrypoint:

```text
tools/k6-proofs/scenarios/r-cd-collection-on-collapse-producer.js
```

Final command:

```bash
OPENCLAW_ROW_MANIFEST=manifests/r-cd-collection-on-collapse.json \
k6 run scenarios/r-cd-collection-on-collapse-producer.js
```

The producer creates A, detached/session-mode B, and delayed C. It must retain
all task/flow identities and prove C reaches A after B terminalizes, with no
orphan or B-only delivery.

### `PRODUCER-R-CW-7`

Process-local source/test prerequisite:

```bash
node "$FINAL_PRODUCT_CHECKOUT/scripts/run-vitest.mjs" \
  "$FINAL_PRODUCT_CHECKOUT/src/auto-reply/continuation/trace-context-propagation.integration.test.ts" \
  "$FINAL_PRODUCT_CHECKOUT/src/agents/tools/continuation-tools.current-span-traceparent.test.ts" \
  "$FINAL_PRODUCT_CHECKOUT/src/infra/continuation-tracer.test.ts"
```

Then collect one final-successor live parent/child trace and prove W3C
traceparent continuity. Static source tests alone do not close the row.

### `PRODUCER-R-CW-DELEGATE-CHILD-LIVE`

Required entrypoint:

```text
tools/k6-proofs/scenarios/r-cw-delegate-child-live-producer.js
```

The final command is the common live-row command with
`ROW_ID=R-CW-DELEGATE-CHILD-LIVE`. It must use approved owner propagation,
then prove a quiet child schedules and completes a fresh hop-2 turn.

### `PRODUCER-R-CW-DELEGATE-TOKEN`

Required entrypoint:

```text
tools/k6-proofs/scenarios/r-cw-delegate-token-producer.js
```

The child is light-context and must have no typed `continue_work` tool. It
emits a terminal work token; success requires parser origin `bracket`, a
durable work row, and a completed hop-2. Run the typed sibling separately and
retain both forms.

### `PRODUCER-R-CW-MULTI`

Required entrypoint:

```text
tools/k6-proofs/scenarios/r-cw-multi-producer.js
```

One originating turn elects three work requests: default, 60 seconds, and 120
seconds. Retain three distinct flow IDs, elected/due/delivered times, and
outcomes. Observe for at least 130 seconds. One surviving election is FAIL.

### `PRODUCER-R-CW-MULTI-COLLAPSE`

Required process-local entrypoint:

```text
tools/k6-proofs/scripts/run-multi-collapse-fixture.mjs
```

It must seed one newest, one within-grace older, one stale older, and one
running row in isolated state. Success requires newest and within-grace rows
to drive, the stale older row to fold, the running row never to fold, and
byte-identical baseline restoration.

## Authority restart root

`R-CD-RETURN-COVENANT-AUTHORITY` remains a distinct root. Do not bury it under
overlap or generic producer work.

Before the full 24-observation matrix, run exactly one
`allowed-gateway-restart-replay` form through:

```text
prepare -> dispatch/hold -> restart transition -> release -> observe ->
case cleanup -> run cleanup
```

The control must retain privately:

- transition HTTP status and complete response body;
- replacement child stdout and stderr;
- snapshot/restore stage;
- original and replacement PID/start/socket fingerprints;
- the exact point at which current gateway ownership is cleared/reassigned.

Only a signed successful restart control unlocks the full authority matrix.
Only a complete authority receipt unlocks
`CONSUMER-R-CD-RETURN-OVERLAP`.

## R-OBS-2

Run only after all trace-producing rows are terminal. For each producer run:

```bash
node tools/k6-proofs/scripts/collect-continuation-trace.mjs \
  --run-dir "$ROW_RUN_DIR" \
  --manifest "$ROW_RUN_DIR/row-manifest.json" \
  --seat "$ROW_SEAT" \
  --evidence "$PRIVATE_EVIDENCE_JSONL"
```

Then render one observer packet listing every row/run/trace identity. Missing,
degraded, ambiguous, or cross-run traces remain MISSING/PARTIAL; they are not
averaged.

## Product-fix integration matrix

| row | existing lane | integration requirement | refire gate |
|---|---|---|---|
| `R-CD-TOKEN` | `codeagent/1270-completion-owner-propagation@7013c8e8a19f0ecdaab939d8d8cbab429f2404f3` | exact commit/tree included in reviewed final successor | six-seat exact successor deployment |
| `R-RC-2` | `codeagent/129388-rrc2-threshold-log-regression@e008fe0f1bd922211a7cf280827556626da9a341` | accepted product subset included in reviewed final successor; current harness numeric controls included | six-seat exact successor deployment plus low-context child |

`R-CD-TOKEN` must prove one owner-bound token delegate task, child, return, and
trace. `R-RC-2` may finish as HONEST-LIMIT only with the numeric receipt
contract; otherwise it must PASS the accepted compaction path.

## Final fold boundary

Do not mutate docs main or presentation from this wave. Stop after:

1. final successor and runtime identities are frozen;
2. every row has one explicit fire authorization;
3. all producer dependencies are terminal;
4. 37 rows are PASS;
5. only R-RC-2 is either PASS or numeric receipt-backed HONEST-LIMIT;
6. INDEX, manifest, row ledger, server tree, and ClawSweeper agree.
