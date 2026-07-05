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
