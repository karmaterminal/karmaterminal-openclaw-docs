# R-OBS-status row runbook

## Status

Runnable. Read-only gateway observer/status receipt row.

- Manifest: `tools/k6-proofs/manifests/r-obs-status.json`
- Scenario: `tools/k6-proofs/scenarios/r-obs-status.js`
- Workflow choice: `r-obs-status`
- Live safety: `k6-runnable`

## Purpose

Prove the proof harness can collect an observer/status receipt from the target gateway without firing continuation tools or mutating state.

## Commands

Runner dry path:

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN=*** \
  ./scripts/run-proofs.sh --dry-run R-OBS-status <candidate-sha>
```

Live read-only smoke:

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN=*** \
OPENCLAW_SESSION_KEY=<target-session-key> \
  ./scripts/run-proofs.sh --live R-OBS-status <candidate-sha> \
  2>&1 | tee /tmp/r-obs-status-k6.log
```

Direct k6 form:

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN=*** \
OPENCLAW_SESSION_KEY=<target-session-key> \
OPENCLAW_ROW_MANIFEST="$PWD/manifests/r-obs-status.json" \
OPENCLAW_CANDIDATE_SHA=<candidate-sha> \
  k6 run scenarios/r-obs-status.js 2>&1 | tee /tmp/r-obs-status-k6.log
```

## k6 covers

- WebSocket connect/auth accepted.
- Gateway `status` request accepted.
- Redacted observer receipt printed as `R_OBS_STATUS_EVIDENCE`.
- Summary JSON verdict is `PASS-candidate` when `proof_failures=0`.

## Manual collection still needed

- Save `/tmp/r-obs-status-k6.log`.
- Save `tools/k6-proofs/r-obs-status-summary.json` if generated; move it into the candidate artifact directory, do not leave it untracked at repo root.
- If the status payload includes a traceparent/trace id, fetch Tempo JSON and store it under `PROOFS/<sha>/R-OBS-status/<seat>/tempo/`.
- If no trace id is emitted, record that explicitly; for status-only rows this is a receipt limitation, not automatically a product failure.

## Fold guidance

This row is read-only. It can support observability/readiness claims, not continuation behavior claims.
