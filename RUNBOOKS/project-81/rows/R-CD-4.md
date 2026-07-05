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
