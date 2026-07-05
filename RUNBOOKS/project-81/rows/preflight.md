# preflight row runbook

## Status

Runnable. Non-mutating readiness/inventory row.

- Manifest: `tools/k6-proofs/manifests/preflight.example.json`
- Scenario: `tools/k6-proofs/scenarios/preflight.js`
- Workflow choice: `preflight`
- Live safety: `static-preflight-only`

## Purpose

Verify the k6 harness can authenticate to the target gateway and collect basic inventory before live proof rows run.

## Commands

Dry/offline golden path:

```bash
rm -rf /tmp/p81-k6-golden-path
node tools/k6-proofs/scripts/postprocess-k6-summary.mjs \
  --manifest tools/k6-proofs/manifests/preflight.example.json \
  --summary tools/k6-proofs/examples/k6-summary.preflight.example.json \
  --out-root /tmp/p81-k6-golden-path
```

Runner dry path:

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN=*** \
  ./scripts/run-proofs.sh --dry-run preflight <candidate-sha>
```

Live k6 path when a gateway inventory receipt is desired:

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN=*** \
OPENCLAW_SESSION_KEY=<target-session-key> \
OPENCLAW_ROW_MANIFEST="$PWD/manifests/preflight.example.json" \
OPENCLAW_CANDIDATE_SHA=<candidate-sha> \
  k6 run scenarios/preflight.js 2>&1 | tee /tmp/preflight-k6.log
```

## k6 covers

- WebSocket connect/auth succeeds.
- `sessions.list` accepted.
- `tools.effective` accepted for the target session.
- Redacted inventory evidence is printed as `PREFLIGHT_EVIDENCE`.

## Manual collection still needed

- Save raw k6 stdout.
- Save generated summary JSON if using `handleSummary`/postprocess path.
- Save `seat-readiness.json` for live fold candidates.
- If folded into corpus, keep it as candidate evidence; preflight alone is not a product behavior proof.

## Fold guidance

Use as setup/readiness evidence. Failures are usually `HONEST-LIMIT` / environment setup candidates, not product failures.
