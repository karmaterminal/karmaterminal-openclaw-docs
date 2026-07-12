# R-OBS-status row runbook

## Status

Runnable, non-mutating exact-candidate contract row for #1172. The runner
fetches `src/status/status-text.ts` from `karmaterminal/openclaw` at the
supplied immutable candidate SHA, then k6 extracts the candidate-owned
`formatStatusTextContinuationLine` function, and executes two public-safe
cases: an active continuation state renders the line; an all-zero clean session
omits it. It does not fire continuation tools, access session data, or mutate
gateway/session state.

- Manifest: `tools/k6-proofs/manifests/r-obs-status.json`
- Scenario: `tools/k6-proofs/scenarios/r-obs-status.js`
- Workflow choice: `r-obs-status`
- Live safety: `k6-runnable`

## Purpose

Prove the exact `#1172` predicate, not merely that the gateway's unrelated
`status` RPC is healthy. The candidate-owned formatter is the source of truth:

- `chainCount: 1` must render `🔄 Continuation: chain 1/8`.
- A clean all-zero state must return `undefined`, so no continuation row is
  included in status text.

The public evidence carries only the candidate SHA, fetched-source SHA-256,
prefetch result, and the two Boolean predicate results. It never contains source
text, session IDs, prompts, gateway tokens, or a status payload.

## Commands

Runner dry path:

```bash
cd tools/k6-proofs
  ./scripts/run-proofs.sh --dry-run R-OBS-status <candidate-sha>
```

Live exact-candidate contract:

```bash
cd tools/k6-proofs
  ./scripts/run-proofs.sh --live --out-dir /tmp/k6-proof-runs R-OBS-status <candidate-sha>
```

Direct k6 form:

```bash
cd tools/k6-proofs
OPENCLAW_ROW_MANIFEST="$PWD/manifests/r-obs-status.json" \
OPENCLAW_CANDIDATE_SHA=<candidate-sha> \
  k6 run scenarios/r-obs-status.js 2>&1 | tee /tmp/r-obs-status-k6.log
```

## k6 covers

- Immutable GitHub raw-source fetch at the supplied candidate SHA.
- SHA-256 receipt for that fetched source.
- Candidate-owned formatter extraction; extraction failure is a BAD_PROOF.
- One active-state positive assertion and one clean-session negative assertion.
- `PASS-candidate` only when all four checks pass; otherwise `BAD_PROOF`.

## Superseded harness evidence

Run `29209315618` / artifact `8264676243` is retained as BAD_PROOF harness
evidence. Its `status_payload: {}` came from the gateway `status` transport
probe, so it established only that the RPC responded; it did not establish the
`#1172` active-line versus clean-session-absence contract. It must not be
folded as an R-OBS-status submission.

## Fold guidance

One complete fresh exact-SHA artifact bundle may support the narrow #1172
status-rendering claim after human review. It is not a continuation scheduling,
delivery, or tracing proof.
