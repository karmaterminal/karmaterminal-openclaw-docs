# R-CW-3 row runbook

## Status

- Manifest: `tools/k6-proofs/manifests/r-cw-3.json`
- Scenario: `tools/k6-proofs/scenarios/r-cw-3-reason-telemetry.js`
- Live safety: `k6-runnable`
- Expected artifact class: `HONEST-LIMIT-candidate` until Tempo trace JSON is fetched and reviewed.

## Purpose

Exercise `continue_work` reason telemetry/redaction. k6 proves the schedule/wake path and keeps the raw reason sentinel out of public artifacts; a reviewer must inspect Tempo JSON to assert that safe reason attrs are present and the raw reason is absent.

## Commands

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN=*** \
OPENCLAW_CREATE_DISPOSABLE_SESSION=true \
  ./scripts/run-proofs.sh --live --out-dir /tmp/k6-proof-runs R-CW-3 <candidate-sha>
```

## k6 covers

- Dispatching `sessions.send` accepted.
- Agent emits `CW3-SCHEDULED <nonce>` only after `continue_work` reports scheduled.
- Continuation wake emits `CW3-WOKE <nonce>`.
- Public k6 evidence drops the raw reason field/sentinel rather than committing it.

## Manual collection still needed

- Fetch Tempo trace JSON for the emitted trace id when available.
- Verify the trace has safe reason telemetry attributes and does not contain the raw reason sentinel.
- If trace fetch/emission is unavailable, keep the run as `HONEST-LIMIT-candidate`; do not overclaim PASS.

## Fold guidance

R-CW-3 is not an unattended PASS row. The runner may execute it safely, but canonical fold requires explicit Tempo/redaction review.

## 2026-07-07 smoke note

Disposable-session smoke on `ronan` accepted dispatch and observed `CW3-SCHEDULED`, but did not observe `CW3-WOKE` within the k6 window. This is partial only. Even with a wake, R-CW-3 remains `HONEST-LIMIT-candidate` until Tempo trace JSON is fetched/reviewed for safe reason attrs present and raw reason absent.
