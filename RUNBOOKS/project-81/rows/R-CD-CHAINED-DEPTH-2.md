# R-CD-CHAINED-DEPTH-2 row runbook

## Status

Runnable scenario exists, but live safety metadata still needs tightening before unattended live use.

- Manifest: `tools/k6-proofs/manifests/r-cd-chained-depth-2.json`
- Scenario: `tools/k6-proofs/scenarios/r-cd-chained-depth-2.js`
- Workflow choice: `r-cd-chained-depth-2`
- Live safety: not yet declared in manifest

## Purpose

Exercise a depth-2 delegate chain: parent → child → grandchild → return path. This corresponds to the manual proof rows where a child fires its own delegate and the root observes the nonce-correlated chain result.

## Commands

Dry path:

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN=*** \
  ./scripts/run-proofs.sh --dry-run R-CD-CHAINED-DEPTH-2 <candidate-sha>
```

Live candidate run:

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN=*** \
OPENCLAW_SESSION_KEY=<target-session-key> \
OPENCLAW_ROW_MANIFEST="$PWD/manifests/r-cd-chained-depth-2.json" \
OPENCLAW_CANDIDATE_SHA=<candidate-sha> \
  k6 run scenarios/r-cd-chained-depth-2.js 2>&1 | tee /tmp/r-cd-chained-depth-2-k6.log
```

## k6 covers

- Parent dispatch accepted.
- Child session/turn observed.
- Grandchild spawn/return path is nonce-correlated where events expose it.
- Candidate evidence looks for parent receipt of the chained return.

## Manual collection still needed

- Save raw k6 stdout and summary.
- Save parent, child, and grandchild session transcripts/events.
- Save gateway journal lines for delegate dispatch/spawn/fanout/drain.
- Fetch Tempo trace JSON and preserve trace summary for the chain.
- Preserve any flow/task rows showing chain state and child session keys.

## Fold guidance

PASS requires parent→child→grandchild correlation and root/parent receipt of the final return. If the scenario observes only spawn but not final root receipt, fold as PARTIAL with exact missing surface.

Before unattended runner use, add `liveRunSafety` with external tool invocation required and same-session concurrency unsafe.
