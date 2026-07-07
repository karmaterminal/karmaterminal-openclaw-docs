# R-RC-1 row runbook

## Status

Runnable local k6 scenario exists.

- Manifest: `tools/k6-proofs/manifests/r-rc-1.json`
- Scenario: `tools/k6-proofs/scenarios/r-rc-1.js`
- Workflow choice: `r-rc-1`
- Live safety: `k6-runnable`; same-session concurrency unsafe; prefer disposable session.

## Purpose

Verify the `request_compaction` rejection path. A below-threshold or inventory-only session must return a structured rejection instead of triggering compaction. The rejection is the proof receipt.

## Commands

Dry path:

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN=*** \
  ./scripts/run-proofs.sh --dry-run R-RC-1 <candidate-sha>
```

Live candidate run:

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN=*** \
OPENCLAW_SESSION_KEY=<target-session-key> \
OPENCLAW_CREATE_DISPOSABLE_SESSION=true \
OPENCLAW_ROW_MANIFEST="$PWD/manifests/r-rc-1.json" \
OPENCLAW_CANDIDATE_SHA=<candidate-sha> \
  ./run-proof.sh r-rc-1 --summary-export /tmp/r-rc-1-k6-summary.json \
    2>&1 | tee /tmp/r-rc-1-k6.log
```

## k6 covers

- Creates or uses a target session.
- Drives an agent turn that calls typed `request_compaction`.
- Observes `RC1-REJECTED <nonce> GUARD context_threshold ...` after the tool result.
- Fails if the row returns `RC1-NOT-REJECTED` or no rejection sentinel appears.

## Receipt nuances

Disposable sessions may be inventory-only for context accounting. In that case the rejection reason may be:

```text
Context usage is unknown for this session; request_compaction is unavailable on inventory-only paths.
```

This is still a valid rejection-path receipt when `guard=context_threshold`. A main-session/direct-tool companion receipt can provide numeric `contextUsage < threshold` when needed.

## Manual collection still needed

- Save raw k6 stdout and generated summary JSON.
- Save session transcript excerpt showing the request_compaction tool result and final sentinel.
- Preserve seat-readiness and live-run-guard receipts.
- No Tempo trace is expected on the synchronous reject path unless the runtime emits one; do not require an internal Tempo URL for this reject-only row.

## Fold guidance

PASS-candidate requires `tool-invoke-rejected` with `guard=context_threshold` and no compaction side effect. If the tool rejects for another guard, fold as PARTIAL with the exact guard/reason.
