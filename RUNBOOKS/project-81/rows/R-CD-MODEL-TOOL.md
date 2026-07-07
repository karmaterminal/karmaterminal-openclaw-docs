# R-CD-MODEL-TOOL row runbook

## Status

- Manifest: `tools/k6-proofs/manifests/r-cd-model-tool.json`
- Scenario: `tools/k6-proofs/scenarios/r-cd-model-tool.js`
- Live safety: `k6-runnable`
- Same-session concurrency: unsafe unless the manifest explicitly says otherwise; prefer `OPENCLAW_CREATE_DISPOSABLE_SESSION=true`.

## Purpose

Typed continue_delegate with explicit model override; child reports requested model byte.

## Commands

Dry-run selection:

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN=***   ./scripts/run-proofs.sh --dry-run R-CD-MODEL-TOOL <candidate-sha>
```

Live candidate run:

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN=*** OPENCLAW_SESSION_KEY=<target-session-key> OPENCLAW_CREATE_DISPOSABLE_SESSION=true   ./scripts/run-proofs.sh --live R-CD-MODEL-TOOL <candidate-sha>
```

When using the GitHub Actions wrapper, include `R-CD-MODEL-TOOL` in the `rows` input and keep `create_disposable_sessions=true` for broad slices.

## k6 covers

- Seat readiness and manifest/live-run-guard receipts are preserved beside the row artifacts.
- The scenario drives the row-specific continuation/config path through the gateway/session API.
- The runner records raw `k6.log`, `evidence.jsonl`, `evidence-lines.log`, `run-result.json`, summary JSON, row manifest, and public-safe metrics artifacts.
- PASS-candidate requires `proof_failures=0` plus the row-specific sentinel/receipt checks implemented in the scenario.

## Manual collection still needed

- Preserve the full candidate-run artifact directory, not only the summary JSON.
- Review `run-result.json` for `review.status` and `pendingReceipts`; trace/receipt-marker gaps make the row review-pending, not failed.
- Fetch and commit Tempo trace JSON when a trace id is emitted.
- For model rows, record the requested model byte and observed child model byte in the fold note.
- For token/bracket rows, record the surface class used (raw final text vs message-body) because scanner availability is the proof boundary.

## Fold guidance

A k6 `PASS-candidate` is review input, not a canonical proof fold. Fold only after checking:

- artifact bundle is from the intended candidate SHA/runtime,
- row manifest is the intended one,
- nonce-correlated evidence is present,
- any `review-pending` receipts are either supplied or explicitly accepted as honest limits,
- no secret material is present in committed artifacts.

## Nuance / caveat

If the child observes fallback/inherited model instead of the requested model, package as HONEST-LIMIT-candidate with mismatch evidence, not pass.
