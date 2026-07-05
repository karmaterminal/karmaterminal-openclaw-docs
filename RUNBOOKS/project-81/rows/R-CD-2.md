# R-CD-2 row runbook

## Status

Runnable live continuation row.

- Manifest: `tools/k6-proofs/manifests/r-cd-2.json`
- Scenario: `tools/k6-proofs/scenarios/r-cd-2-silent-wake.js`
- Workflow choice: `r-cd-2-silent-wake`
- Live safety: `k6-runnable`, same-session concurrency unsafe

## Purpose

Exercise `continue_delegate(mode="silent-wake")`: a dispatching session asks the agent to fire a silent-wake delegate; the delegate returns silently and wakes/enriches the parent without channel delivery.

## Commands

Dry path:

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN=*** \
  ./scripts/run-proofs.sh --dry-run R-CD-2 <candidate-sha>
```

Live candidate run:

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN=*** \
OPENCLAW_SESSION_KEY=<target-session-key> \
  ./scripts/run-proofs.sh --live --out-dir /tmp/k6-proof-runs R-CD-2 <candidate-sha>
```

Direct k6 form:

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN=*** \
OPENCLAW_SESSION_KEY=<target-session-key> \
OPENCLAW_ROW_MANIFEST="$PWD/manifests/r-cd-2.json" \
OPENCLAW_CANDIDATE_SHA=<candidate-sha> \
  k6 run scenarios/r-cd-2-silent-wake.js 2>&1 | tee /tmp/r-cd-2-k6.log
```

## k6 covers

- Dispatch request accepted via gateway/session path.
- Parent/session events are watched for nonce-correlated wake/return.
- No-channel-delivery expectation is tracked as part of the candidate evidence.
- Optional `tasks.list` context may be captured, but absence is not a failure by itself.

## Manual collection still needed

- Save raw k6 stdout and generated summary.
- Save exact manifest used.
- Save parent session transcript/events showing wake/enrichment.
- Save child/delegate transcript if available.
- Fetch and commit Tempo trace JSON for any emitted trace id.
- Preserve gateway journal lines for `continuation.delegate.dispatch`, child spawn, queue drain, and return/wake when available.

## Fold guidance

PASS requires dispatch accepted, parent wake/return observed, no visible channel delivery from the silent delegate, and trace/session receipts reviewed. Run serially per target session.

## Repeatability note — 2026-07-05 live lane test

A live run against the Discord-bound `#sprites` session produced a useful `PARTIAL-candidate` artifact:

- `sessions.send` accepted and triggered the dispatching agent turn.
- The agent reached the tool surface and fired `continue_delegate(mode="silent-wake")`.
- The runner artifact bundle was written under `/tmp/p81-rcd2-live-test1/.../R-CD-2/...`.
- The old detector closed too early on the dispatching agent's initial `session.message` and treated a live channel/chat event containing the harness nonce as a silent-mode violation.

Chop applied after that test: the scenario now distinguishes the dispatching agent turn from a delayed parent wake candidate, emits a parseable `R_CD_2_EVIDENCE` line, and tracks dispatch-channel events separately from delegate-return channel delivery.

Manual work still remaining for a folded PASS:

- Prefer a throwaway/non-Discord target session for repeated live runs so harness injection does not surprise the coordination room.
- Fetch/commit Tempo trace JSON when a trace id is emitted.
- Confirm the delayed parent wake corresponds to the delegate return, not only the dispatching agent's initial turn.

## Repeatability note — 2026-07-05 non-Discord `main` test

After the first detector chop, a live run against `OPENCLAW_SESSION_KEY=main` produced a cleaner artifact but still `PARTIAL-candidate`:

- `sessions.send` accepted.
- delayed `session.message` after the 5s wake gate was observed.
- no delegate-return channel delivery was observed (`channel_message_observed=false`).
- `dispatch_channel_message_observed=true` was tracked separately and did not fail the row.
- `agent_turn_observed=false` only because this target session emitted generic `agent` events rather than an early `session.message` before the delayed wake.

Chop applied after that test: generic `agent` lifecycle events after `sessions.send` now count as dispatch-agent activity, and a delayed parent wake candidate also implies the agent turn occurred. This should make the row's remaining PASS/partial boundary about the delegate return evidence, not about which event flavor the target session emits.

## Disposable target-session mode

For repeatability testing, prefer a disposable non-Discord session so the harness does not inject proof prompts into `#sprites` or depend on the active main lane's unrelated event traffic:

```bash
cd tools/k6-proofs
OPENCLAW_CREATE_DISPOSABLE_SESSION=true \
OPENCLAW_MIN_DELEGATE_DELAY_MS=5000 \
  ./scripts/run-proofs.sh --live --out-dir /tmp/k6-proof-runs R-CD-2 <candidate-sha>
```

The scenario creates a session via `sessions.create`, subscribes to that created key, then runs the normal `sessions.send` / `continue_delegate(mode="silent-wake")` path against the disposable key. Artifact evidence includes `session_created`, `created_session_key`, and the final `sessionKey` actually used.

## Repeatability note — 2026-07-05 disposable mode

Disposable mode was validated with three consecutive live runs using:

```bash
OPENCLAW_CREATE_DISPOSABLE_SESSION=true \
OPENCLAW_MIN_DELEGATE_DELAY_MS=5000 \
  ./scripts/run-proofs.sh --live --out-dir /tmp/p81-rcd2-disposable-repeat R-CD-2 71a1dfff040000ce8862d30d0587ebee044a23b3
```

Results:

```text
run=1 rc=0 verdict=PASS-candidate failures=0 duration_avg=9084ms  evidence=session_created/tool_accepted/agent_turn/parent_wake true, channel_message false
run=2 rc=0 verdict=PASS-candidate failures=0 duration_avg=7230ms  evidence=session_created/tool_accepted/agent_turn/parent_wake true, channel_message false
run=3 rc=0 verdict=PASS-candidate failures=0 duration_avg=14359ms evidence=session_created/tool_accepted/agent_turn/parent_wake true, channel_message false
```

This makes the row mechanically repeatable as a `PASS-candidate` without touching the live Discord room. Remaining manual fold work is trace/session receipt review, not execution of the scenario itself.
