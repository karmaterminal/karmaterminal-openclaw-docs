# R-RC-1 row runbook

## Status

Runnable local k6 scenario exists.

- Manifest: `tools/k6-proofs/manifests/r-rc-1.json`
- Scenario: `tools/k6-proofs/scenarios/r-rc-1-threshold-reject.js`
- Workflow choice: `r-rc-1-threshold-reject`
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
  ./run-proof.sh r-rc-1-threshold-reject --summary-export /tmp/r-rc-1-k6-summary.json \
    2>&1 | tee /tmp/r-rc-1-k6.log
```

## k6 covers

- Creates or uses a target session.
- Drives an agent turn that calls typed `request_compaction`.
- Confirms `request_compaction` is present in the disposable session's effective tool inventory.
- Fetches the session transcript and binds the current row nonce to the assistant's `request_compaction` tool-call ID.
- Accepts only the `role=toolResult`, `toolName=request_compaction` receipt with that exact tool-call ID.
- Requires structured `status=rejected` and `guard=context_threshold`.
- Treats the assistant's `RC1-RESULT-OBSERVED <nonce>` sentinel as diagnostic only; sentinel prose can never satisfy the row.
- Fails closed if a prior valid result exists but the current nonce has no matching call/result pair.

## Receipt nuances

Disposable sessions may be inventory-only for context accounting. In that case the rejection reason may be:

```text
Context usage is unknown for this session; request_compaction is unavailable on inventory-only paths.
```

This is still a valid rejection-path receipt when `guard=context_threshold`. A main-session/direct-tool companion receipt can provide numeric `contextUsage < threshold` when needed.

## Manual collection still needed

- Save raw k6 stdout and generated summary JSON.
- Save the session transcript excerpt showing the nonce-bearing request_compaction tool call, its matching toolCallId result, and final sentinel.
- Preserve seat-readiness and live-run-guard receipts.
- No Tempo trace is expected on the synchronous reject path unless the runtime emits one. Preserve an explicit trace-unavailable receipt; do not let a Tempo span substitute for the nonce-bound typed call/result chain.

## Fold guidance

PASS-candidate requires `tool-invoke-rejected` with `guard=context_threshold` and no compaction side effect. If the tool rejects for another guard, fold as PARTIAL with the exact guard/reason.
