# R-CD-MODEL-TOOL row runbook

## Status

- Manifest: `tools/k6-proofs/manifests/r-cd-model-tool.json`
- Scenario: `tools/k6-proofs/scenarios/r-cd-model-tool.js`
- Live safety: `k6-runnable`
- Same-session concurrency: unsafe unless the manifest explicitly says otherwise; prefer `OPENCLAW_CREATE_DISPOSABLE_SESSION=true`.

## Purpose

Typed continue_delegate with explicit model override; child reports its runtime-context model byte. The requested model is deliberately omitted from the child task so the row cannot pass by prompt echo.

## Commands

Dry-run selection:

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN=***   ./scripts/run-proofs.sh --dry-run R-CD-MODEL-TOOL <candidate-sha>
```

Live candidate run:

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN=*** OPENCLAW_SESSION_KEY=<target-session-key> OPENCLAW_CREATE_DISPOSABLE_SESSION=true OPENCLAW_ALT_MODEL=<provider/model>   ./scripts/run-proofs.sh --live R-CD-MODEL-TOOL <candidate-sha>
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
- For model rows, record the requested model byte and observed child runtime-context model byte in the fold note.
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

If the child observes fallback/inherited/UNKNOWN model instead of the requested model, package as HONEST-LIMIT-candidate with mismatch evidence, not pass. A child self-report is only useful when the requested model was not present in the child prompt; otherwise it proves echo, not runtime selection.

## Authority note (WO-1217)

Requires a disposable parent. Authoritative child identity is
`sessions.list { spawnedBy: <parent>, limit: 100 }` pre/post set-diff with
exactly one new child key; provider/model is read from that row. Parent
`sessions.get` must show a nonce-bound normal-mode return via the exact
`MODEL-TOOL-CHILD <nonce> MODEL <provider/model>` marker (paraphrased schedule
acks or generic nonce text do not count). Child self-report is auxiliary and
cannot establish model equality. Direct production DB queries are forbidden as
PASS authority.

