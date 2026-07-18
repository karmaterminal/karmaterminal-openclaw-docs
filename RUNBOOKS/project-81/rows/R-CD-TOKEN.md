# R-CD-TOKEN row runbook

## Status

- Manifest: `tools/k6-proofs/manifests/r-cd-token.json`
- Scenario: `tools/k6-proofs/scenarios/r-cd-token-bracket-delegate.js`
- Live safety: `k6-runnable`
- Same-session concurrency: unsafe. A newly-created disposable origin is mandatory; the row runner forces `OPENCLAW_CREATE_DISPOSABLE_SESSION=true`, and the scenario stops before `sessions.send` unless creation succeeds with a distinct session key.

## Purpose

Bracket/token continue_delegate path for delegate scheduling and return.

## Commands

Dry-run selection:

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN=***   ./scripts/run-proofs.sh --dry-run R-CD-TOKEN <candidate-sha>
```

Live candidate run:

```bash
cd tools/k6-proofs
OPENCLAW_GATEWAY_TOKEN=*** \
OPENCLAW_SESSION_KEY=<target-session-key> \
OPENCLAW_CREATE_DISPOSABLE_SESSION=true \
OPENCLAW_SEAT_CLASS=raw-final-text \
OPENCLAW_CANDIDATE_SHA=<exact-deployed-successor-sha> \
OPENCLAW_RUNTIME_BUILD_SHA=<exact-deployed-successor-sha> \
./scripts/run-proofs.sh --live --out-dir /tmp/r-cd-token-<exact-deployed-successor-sha> R-CD-TOKEN <exact-deployed-successor-sha>
```

When using the GitHub Actions wrapper, include `R-CD-TOKEN` in the `rows` input and keep `create_disposable_sessions=true` for broad slices.

## k6 covers

- Seat readiness and manifest/live-run-guard receipts are preserved beside the row artifacts.
- The scenario drives the row-specific continuation/config path through the gateway/session API.
- The runner records public-safe `k6.log`, `evidence.jsonl`, `evidence-lines.log`, `run-result.json`, summary JSON, row manifest, and metrics artifacts; private acquisition files are transient.
- Before creating an attempt, the runner requires exact 40-character candidate and runtime SHAs and requires them to be equal. Unknown, abbreviated, or mismatched build identity stops before dispatch as `HONEST-LIMIT-candidate`.
- The runner persists a hashed attempt/nonce receipt before k6 starts and traps ordinary `INT`/`TERM`/early-exit interruption into a structured `PARTIAL-candidate` packet with automatic retry forbidden.
- The task ledger is read through every `tasks.list` page. Because the deployed cursor is an offset over a live activity sort, PASS additionally requires at least three identical complete snapshot digests; a repeated task ID within one traversal permanently rejects the attempt. Origin/delegate matching uses a 14-character opaque delegate marker placed first in `signal.task`; the exact production chain-hop/depth-1 wrapper is 63 characters, leaving the complete marker plus three characters of margin inside the public 80-character `TaskSummary.title` bound. Requester/child-session lineage remains mandatory; private raw task text is never compared.
- The return receipt must be a structured `session.message` delivered to the ledger-matched origin child from the ledger-matched delegate child via `sourceTool=subagent_announce`; prompt echoes and unrelated nonce-bearing events do not count.
- PASS-candidate requires a disposable `raw-final-text` origin, one accepted send run, exactly one origin task, exactly one token-scheduled delegate task, successful child settlement, the bound parent return, and one matching public Tempo dispatch/fire topology with no typed `continue_delegate` tool origin.
- The k6 summary remains deliberately `PARTIAL-candidate`; only the HMAC-signed row-scoped resolver may promote the joined lifecycle/build/trace evidence to `PASS-candidate`.
- Message-body or undeclared surface classes stop before dispatch as `HONEST-LIMIT-candidate`; they cannot enter the PASS lane.

## Manual collection still needed

- Preserve the full candidate-run artifact directory, not only the summary JSON.
- Review `run-result.json` for `review.status` and `pendingReceipts`; trace/receipt-marker gaps make the row review-pending, not failed.
- Preserve the signed `r-cd-token-authoritative-receipt.json`, `attempt-state.json`, `runner-metadata.json`, public Tempo JSON, and `continuation-trace-correlation.json` together. No individual file is authoritative alone.
- If the run is interrupted, do **not** automatically replay it. Retain `interruption-receipt.json`; its `unknown-possibly-consumed` state is intentionally non-PASS and non-retriable until an operator reviews the prior attempt.
- For model rows, record the requested model byte and observed child model byte in the fold note.
- For token/bracket rows, record the surface class used (raw final text vs message-body) because scanner availability is the proof boundary.

## Fold guidance

A k6 `PASS-candidate` is review input, not a canonical proof fold. Fold only after checking:

- artifact bundle is from the intended candidate SHA/runtime and those exact 40-character SHAs are equal,
- the signed receipt binds that exact equal build identity and its digest matches `run-result.json`,
- `attempt-state.json` is terminal and bound to the same opaque attempt/nonce fingerprints as the authoritative receipt,
- row manifest is the intended one,
- nonce-correlated evidence is present,
- any `review-pending` receipts are either supplied or explicitly accepted as honest limits,
- no secret material is present in committed artifacts.

## Nuance / caveat

Message-body Discord seats can suppress scanner fallback; use disposable/raw-final-text mode when proving PASS rather than honest-limit.
