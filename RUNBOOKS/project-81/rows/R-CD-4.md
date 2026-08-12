# R-CD-4 row runbook

## Status

Runnable scenario exists, but live safety metadata still needs tightening before unattended live use.

- Manifest: `tools/k6-proofs/manifests/r-cd-4.json`
- Scenario: `tools/k6-proofs/scenarios/r-cd-4-target-session-key.js`
- Workflow choice: `r-cd-4-target-session-key`
- Live safety: not yet declared in manifest

## Purpose

Exercise `continue_delegate` with `targetSessionKey`: the delegate return should land in the specified target session, not the dispatching parent.

## Commands

Dry path:

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN=*** \
  ./scripts/run-proofs.sh --dry-run R-CD-4 <candidate-sha>
```

Live candidate run only after target session is explicitly chosen:

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN=*** \
OPENCLAW_SESSION_KEY=<dispatching-session-key> \
OPENCLAW_TARGET_SESSION_KEY=<target-session-key> \
OPENCLAW_ROW_MANIFEST="$PWD/manifests/r-cd-4.json" \
OPENCLAW_CANDIDATE_SHA=<candidate-sha> \
  k6 run scenarios/r-cd-4-target-session-key.js 2>&1 | tee /tmp/r-cd-4-k6.log
```

## k6 covers

- Dispatch request includes target session configuration.
- Target and parent session streams are monitored for nonce-correlated delivery.
- Candidate evidence distinguishes target delivery from parent delivery.

## Manual collection still needed

- Save raw k6 stdout and summary.
- Save target and parent session event receipts.
- Save child transcript if available.
- Fetch Tempo trace JSON for emitted trace id.
- Capture TaskFlow/session rows only as supporting context; do not require `tasks.list` as the primary proof surface.

## Fold guidance

PASS requires target receipt and no parent receipt for the return. Before unattended runner use, add `liveRunSafety` to the manifest with `requiresTargetSessionKey=true` and `sameSessionConcurrencySafe=false`.

## Disposable parent/target mode

For repeatability, prefer disposable parent and target sessions instead of using the live coordination session:

```bash
cd tools/k6-proofs
OPENCLAW_CREATE_DISPOSABLE_SESSIONS=true \
OPENCLAW_MIN_DELEGATE_DELAY_MS=5000 \
  ./scripts/run-proofs.sh --live --out-dir /tmp/k6-proof-runs R-CD-4 <candidate-sha>
```

The scenario creates two sessions with `sessions.create`, subscribes to both, sends the dispatch prompt to the disposable parent, and asks that parent to call `continue_delegate(mode="silent-wake", targetSessionKey=<disposable-target>)`. Evidence includes created session keys, dispatch acceptance, target return/wake, and absence of parent return/wake.

## Repeatability note — 2026-07-05 disposable mode

Disposable parent/target mode was validated with three consecutive live runs:

```bash
OPENCLAW_CREATE_DISPOSABLE_SESSIONS=true \
OPENCLAW_MIN_DELEGATE_DELAY_MS=5000 \
  ./scripts/run-proofs.sh --live --out-dir /tmp/p81-rcd4-disposable-repeat R-CD-4 71a1dfff040000ce8862d30d0587ebee044a23b3
```

Results:

```text
run=1 rc=0 verdict=PASS-candidate failures=0 duration_avg=8955ms  evidence=parent_created/target_created/tool_accepted/agent_turn/return_target true, return_parent false
run=2 rc=0 verdict=PASS-candidate failures=0 duration_avg=12435ms evidence=parent_created/target_created/tool_accepted/agent_turn/return_target true, return_parent false
run=3 rc=0 verdict=PASS-candidate failures=0 duration_avg=14636ms evidence=parent_created/target_created/tool_accepted/agent_turn/return_target true, return_parent false
```

This makes the positive targeted-return row mechanically repeatable as `PASS-candidate`. The older guard-side proof for invalid `fanoutMode + targetSessionKey` remains valid but is a different row shape; this scenario now covers the positive targeted-return path.

## Authority note (WO-1217)

Silent-wake delivery authority is the shared post-run collector over the
payload-free gateway journal line:

`[continuation:targeted-return] Delivered to <target> from <child>`

Transcript `session.message` / `sessions.get` `TARGET-RECEIVED` text is
diagnostic only and cannot promote PASS. The collector binds exact
target/parent/child/window and publishes fingerprint fields only.

