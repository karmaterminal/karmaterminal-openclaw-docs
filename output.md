# PR #129388 final authority harness cure

## Verdict

**Owner: docs harness.** Corrected run `33026448492` exercised the intended
product behavior at runtime SHA
`5d79066ea4926c69fcf7ac8376688a0babbf7797`, but all three rows remained
`PARTIAL-candidate` because their authority observers rejected public evidence
that the product had emitted or durably projected.

This branch repairs those three observation contracts without changing product
code, the proof corpus, the protected presentation branch, or any existing run
artifact. Run `33026448492` remains an immutable historical partial; only a new
exact three-row refire may produce successor signed receipts.

Branch:
`codeagent/129388-final-authority-harness-cure`

Base:
`a10dbd095432c22b94fac243fbffe3f0d8a1339d`

## Failure classification and cure

### R-CD-2: accepted run to unique continuation trace

The gateway's `sessions.send` response exposes the accepted run ID but does not
expose its OTel trace ID. The rejected resolver nevertheless required
`accepted_send_trace_id`, so it rejected the exact public Tempo trace
`f4d5476b8de870bd6f90982de569060e`, which contains one
`openclaw.tool.execution(continue_delegate)` followed by one
`continuation.delegate.dispatch` and one `continuation.delegate.fire`.

The collector already fails closed when its nonce-derived reason query returns
zero or multiple traces and validates the exact tool/dispatch/fire topology.
It now records one of two explicit trace-binding sources:

- `sessions-send-response` when a response trace exists;
- `unique-reason-bound-trace` when the response omits it and the collector
  selects exactly one nonce/reason-bound trace.

The signed resolver still requires the accepted send-run fingerprint, row-nonce
fingerprint, exact trace identity, one typed tool span, one dispatch/fire chain,
and silent-wake mode. Unknown source, wrong run, wrong nonce, wrong trace,
multiple traces, or multiple tool spans cannot PASS.

### R-CD-CHAINED-DEPTH-2: current recovered task ledger

The public task records from the corrected run were completed and delivered,
but the observer required the row nonce to occur exactly once in each full task
prompt. The actual deterministic instructions legitimately repeated the same
nonce seven times in the depth-1 prompt and twice in the depth-2 prompt.

The observer also required the pre-recovery
`CHILD-WAITING ... CHILD-DELEGATE-SCHEDULED CHILD-WAKE-SCHEDULED` marker after
the product cure had advanced the terminal task state to `CHILD-DONE`.

The receipt now requires:

- the same nonce at least once in both full `tasks.get` prompts;
- exactly two distinct tasks and run IDs;
- root -> child -> grandchild ownership;
- both tasks completed and delivered after dispatch;
- depth-1 `lastToolName=continue_work`;
- exactly one final `CHILD-DONE <nonce>`;
- exactly one final `GRANDCHILD-DONE <nonce>`.

Repeated use of one exact row nonce is accepted; duplicate tasks, duplicate
runs, duplicate terminal markers, stale/wrong nonce, wrong ownership, wrong
depth, or pre-dispatch records remain rejected.

### R-CD-TOKEN: public transcript recovery

The normal origin return was durably present as a public assistant transcript
message with the exact run ID
`announce:v1:<accepted delegate child>:<accepted delegate run>`, but it occurred
before the observer's origin subscription was accepted. The live event parser
correctly rejected that pre-subscription event and the scenario had no durable
recovery path.

The scenario now reuses public `sessions.get` snapshots to recover the exact
post-origin-cursor assistant message. The durable parser requires:

- the disposable origin session;
- the exact nonce sentinel once;
- the exact accepted delegate child/run announce ID;
- a message sequence newer than the initial origin-run cursor;
- public assistant content, not a hidden inter-session input or private log;
- observation time at or after the public message timestamp.

Live and transcript observations are deduplicated by message sequence. A second
distinct matching return remains a duplicate failure. Polling stops after the
one bound return; wrong session, wrong run, stale cursor, root-only result,
private-log-only evidence, missing return, or duplicate return remains
non-PASS.

## Exact-run regression fixture

`tools/k6-proofs/tests/fixtures/final-authority-run-33026448492.json` is a
sanitized projection of the three rejected authority shapes from run
`33026448492`.

Private session keys, run IDs, task IDs, and row nonce are replaced. The public
Tempo trace identity and public-safe send/nonce fingerprints are retained. The
fixture proves:

1. R-CD-2 binds the trace only through the unique nonce/reason collector path.
2. Depth accepts the completed two-task ledger with repeated same-nonce prompt
   use and final recovery markers.
3. Token's live parser rejects the pre-subscription message while public
   transcript recovery accepts the exact same post-cursor return.

The fixture contains no UUID-shaped private identifier.

## Validation

Full proof-harness contract suite:

```bash
node --test \
  tools/k6-proofs/scripts/__tests__/*.test.mjs \
  tools/k6-proofs/tests/*.test.mjs
```

Result: `517/517` pass.

Static and catalog checks:

```bash
node --check tools/k6-proofs/scenarios/r-cd-token-bracket-delegate.js
node --check tools/k6-proofs/scripts/collect-continuation-trace.mjs
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs
node tools/k6-proofs/scripts/check-scenario-alignment.mjs
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs
node tools/k6-proofs/scripts/check-telemetry-contracts.mjs
node tools/k6-proofs/scripts/validate-corpus.mjs --current
git diff --check
```

All pass. The current corpus validator correctly reports the pre-refire state as
acceptance-incomplete; this lane does not rewrite or promote that corpus.

## Scope and public safety

No private gateway token, session key, task ID, run ID, transcript, database
row, or raw private log was committed. The isolated runtime and its private
state remain outside this repository.

No live proof was fired, no automatic retry was armed, no product issue was
closed, and no presentation branch moved.

## Refire handoff

After this branch is committed, pushed, server-equal, and the isolated unit
again passes readiness and exact-model smoke, refire exactly:

- `R-CD-2`
- `R-CD-CHAINED-DEPTH-2`
- `R-CD-TOKEN`

against:

- product/runtime
  `5d79066ea4926c69fcf7ac8376688a0babbf7797`;
- isolated depth `5`;
- the reviewed isolated gateway unit and unique OTel service;
- this server-equal docs branch head.

There is no automatic retry after a behavioral red. Fold the 38-row corpus only
after all three new HMAC-signed authorities independently return
`PASS-candidate`.
