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
- Continuation wake emits `CW3-WOKE <nonce>`; the observer stays open up to 10 minutes because quiet/disposable seats can deliver the elected wake several minutes late under active-lane pressure.
- Public k6 evidence drops the raw reason field/sentinel rather than committing it.

## Review collection still needed

Fetch Tempo trace JSON for the emitted trace id when available, then run the review helper:

```bash
node tools/k6-proofs/scripts/fetch-tempo-trace.mjs \
  --run-dir /tmp/k6-proof-runs/<sha>/R-CW-3/<seat>/<run-id>

node tools/k6-proofs/scripts/review-r-cw-3-reason-telemetry.mjs \
  --run-dir /tmp/k6-proof-runs/<sha>/R-CW-3/<seat>/<run-id> \
  --tempo-trace /tmp/k6-proof-runs/<sha>/R-CW-3/<seat>/<run-id>/tempo-trace-<trace>.json
```

The helper writes `r-cw-3-reason-telemetry-review.json`. It passes only when:

- dispatch, `CW3-SCHEDULED`, and `CW3-WOKE` are all present in the run evidence;
- public k6 evidence says the raw reason sentinel was not preserved;
- Tempo contains safe `reason.present`, `reason.length`, and `reason.hash` attributes;
- Tempo does not contain the raw `RAW-RCW3-*` sentinel or `k6-proof-R-CW-3-redaction` reason prefix.

If trace fetch/emission is unavailable, or the helper exits non-zero, keep the run as `HONEST-LIMIT-candidate` / review-pending; do not overclaim PASS.

## Fold guidance

R-CW-3 is not an unattended PASS row. The runner may execute it safely, but canonical fold requires explicit Tempo/redaction review.

## 2026-07-07 smoke note

Disposable-session smoke on `ronan` accepted dispatch and observed `CW3-SCHEDULED`, but did not observe `CW3-WOKE` within the original short k6 window. A later session-history receipt showed the elected wake landed about eight minutes late and emitted `CW3-WOKE`; the scenario now keeps the observer open for 10 minutes to reduce false PARTIALs from delayed continuation delivery. Even with a wake, R-CW-3 remains `HONEST-LIMIT-candidate` until Tempo trace JSON is fetched/reviewed for safe reason attrs present and raw reason absent.
