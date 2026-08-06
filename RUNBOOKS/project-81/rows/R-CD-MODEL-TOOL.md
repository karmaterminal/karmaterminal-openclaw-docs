# R-CD-MODEL-TOOL row runbook

## Status

- Manifest: `tools/k6-proofs/manifests/r-cd-model-tool.json`
- Scenario: `tools/k6-proofs/scenarios/r-cd-model-tool.js`
- Live safety: `k6-runnable`
- Same-session concurrency: unsafe unless the manifest explicitly says otherwise; prefer `OPENCLAW_CREATE_DISPOSABLE_SESSION=true`.

## Purpose

Typed continue_delegate with explicit model override. The requested model is deliberately omitted from the child task so the row cannot pass by prompt echo. The only execution authority is the model-call telemetry under the uniquely nonce-correlated child run.

## Commands

Dry-run selection:

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN=***   ./scripts/run-proofs.sh --dry-run R-CD-MODEL-TOOL <candidate-sha>
```

Live candidate run:

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN=*** OPENCLAW_SESSION_KEY=<target-session-key> OPENCLAW_CREATE_DISPOSABLE_SESSION=true \
  ./scripts/run-proofs.sh --live R-CD-MODEL-TOOL <candidate-sha>
```

When using the GitHub Actions wrapper, include `R-CD-MODEL-TOOL` in the `rows` input and keep `create_disposable_sessions=true` for broad slices.

## k6 covers

- Seat readiness and manifest/live-run-guard receipts are preserved beside the row artifacts.
- The scenario drives the row-specific continuation/config path through the gateway/session API.
- The runner records raw `k6.log`, `evidence.jsonl`, `evidence-lines.log`, `run-result.json`, summary JSON, row manifest, and public-safe metrics artifacts.
- The scenario emits no behavioral verdict. PASS/FAIL authority is resolved after Tempo correlation from the child `openclaw.model.call` span.

## Manual collection still needed

- Preserve the full candidate-run artifact directory, not only the summary JSON.
- Review `run-result.json` for `review.status` and `pendingReceipts`; trace/receipt-marker gaps make the row review-pending, not failed.
- Preserve `tempo-trace-*.json`, `continuation-trace-correlation.json`, and `r-cd-model-tool-authoritative-receipt.json`.
- Confirm the authoritative receipt binds one child harness/run and reports exact provider `openai`, model `gpt-5.6-luna`.
- Treat `sessions.list` model fields as selected-model evidence only; they cannot prove which model executed.
- Confirm the child task did not include the requested model string; otherwise the run is echo-contaminated and cannot be folded as PASS.
- For token/bracket rows, record the surface class used (raw final text vs message-body) because scanner availability is the proof boundary.

## Fold guidance

A k6 `PASS-candidate` is review input, not a canonical proof fold. Fold only after checking:

- artifact bundle is from the intended candidate SHA/runtime,
- row manifest is the intended one,
- nonce-correlated evidence is present,
- any `review-pending` receipts are either supplied or explicitly accepted as honest limits,
- no secret material is present in committed artifacts.

## Nuance / caveat

An execution-bound non-Luna model-call span is `FAIL-candidate`. Missing, ambiguous, or incomplete model-call telemetry is `NO-VERDICT`, not PARTIAL or synthetic FAIL. Child prose and selected-model projections remain auxiliary regardless of whether they match Luna.
