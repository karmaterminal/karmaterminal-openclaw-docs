# R-CW-2 row runbook

## Status

- Manifest: `tools/k6-proofs/manifests/r-cw-2.json`
- Scenario: `tools/k6-proofs/scenarios/r-cw-2-immediate-wake.js`
- Live safety: `k6-runnable`
- Same-session concurrency: unsafe; prefer `OPENCLAW_CREATE_DISPOSABLE_SESSION=true`.

## Purpose

Exercise `continue_work(delaySeconds=0)`: the tool result must schedule an immediate continuation wake, and the detector must not count harness prompt echo as proof.

## Commands

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN=*** \
OPENCLAW_CREATE_DISPOSABLE_SESSION=true \
  ./scripts/run-proofs.sh --live --out-dir /tmp/k6-proof-runs R-CW-2 <candidate-sha>
```

## k6 covers

- Dispatching `sessions.send` accepted.
- Agent emits `CW2-SCHEDULED <nonce>` only after the `continue_work` tool result reports scheduled.
- Continuation wake emits `CW2-WOKE <nonce>` after the scheduled sentinel.
- Harness prompt echo is ignored and cannot satisfy the wake check by itself.

## Manual collection still needed

- Preserve `k6.log`, `evidence.jsonl`, summary JSON, and `run-result.json`.
- Fetch/commit Tempo trace JSON when a trace id is emitted, or explicitly accept trace-missing as review debt.

## Fold guidance

Fold only after confirming the wake sentinel came from the continuation turn and not from the initial harness prompt. Run serially per target session.

## 2026-07-07 smoke note

Disposable-session smoke on `ronan` accepted dispatch and observed `CW2-SCHEDULED`, but did not observe `CW2-WOKE` within the k6 window. R-CW-1 showed the same disposable-session schedule-only shape. Treat this as a partial/diagnostic result, not a row-fixture failure and not a PASS. Canonical PASS still requires the wake sentinel from a target session that services self-elected continuation wakes.
