# R-CD-SILENT row runbook

## Status

- Manifest: `tools/k6-proofs/manifests/r-cd-silent.json`
- Scenario: `tools/k6-proofs/scenarios/r-cd-silent.js`
- Live safety: `k6-runnable`
- Same-session concurrency: unsafe; prefer `OPENCLAW_CREATE_DISPOSABLE_SESSION=true`.

## Purpose

Exercise `continue_delegate(mode="silent")`: the child return should land in the parent session's internal context without producing channel-visible child delivery.

## Commands

Dry path:

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN=*** \
  ./scripts/run-proofs.sh --dry-run R-CD-SILENT <candidate-sha>
```

Live candidate run:

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN=*** \
OPENCLAW_CREATE_DISPOSABLE_SESSION=true \
  ./scripts/run-proofs.sh --live --out-dir /tmp/k6-proof-runs R-CD-SILENT <candidate-sha>
```

## k6 covers

- Dispatching agent turn accepted.
- Agent emits `RCDS-SCHEDULED <nonce>` only after `continue_delegate(mode="silent")` reports scheduled.
- The child task receives a child-only `SILENTCHILD-*` token that is not included in the later follow-up prompt.
- A delayed follow-up asks the parent to report the silent delegate return from internal context.
- The row fails if the child-only token appears in channel-delivery evidence.

## Manual collection still needed

- Review the generated artifact directory and exact manifest.
- Fetch/commit Tempo trace JSON when a trace id is emitted, or explicitly accept trace-missing as review debt.
- Check transcript/session receipts if the candidate will be folded into canonical PROOFS.

## Fold guidance

A PASS-candidate requires dispatch accepted, scheduled sentinel, follow-up accepted, child-token readback from parent internal context, and no child-token channel delivery. Fold only after trace/session receipts are reviewed.

## 2026-07-07 smoke note

`/tmp/p81-rcd-silent-smoke2` produced `PASS-candidate` on `ronan` with `OPENCLAW_CREATE_DISPOSABLE_SESSION=true`: dispatch accepted, scheduled sentinel observed, child completion observed on the internal stream, follow-up accepted, parent read back the child-only token, and no child-token channel-delivery-shaped event fired. Trace id was null, so trace review remains debt.
