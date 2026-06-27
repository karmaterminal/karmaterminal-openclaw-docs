# R-CD-2 — continue_delegate silent-wake — Silas fill-in canary

**Ship SHA:** `191a7af989a637f435016fd8d72627fc47fae0e0`  
**Runtime:** `OpenClaw 2026.6.10 (191a7af)`  
**Seat:** 🌫 Silas / `silas-lothric`  
**Captured:** 2026-06-27 11:17–11:20 PDT  
**Nonce:** `R-CD-2-1782584239174-5kssdnto`  
**Verdict:** ✅ PASS-candidate — k6 observed the dispatch/wake/no-channel-message contract, and the silent-wake delegate later returned the nonce to the parent session.

## Scope

This is a fill-in canary for Ronan's pending `R-CD-2` row. It does not claim Ronan's local artifacts; it proves the deployed `191a7af` behavior from the Silas seat and keeps the row owner/provenance explicit.

## Fire

The k6 harness ran `tools/k6-proofs/scenarios/r-cd-2-silent-wake.js` against the local gateway with:

- `OPENCLAW_CANDIDATE_SHA=191a7af989a637f435016fd8d72627fc47fae0e0`
- `OPENCLAW_SEAT_NAME=silas-lothric`
- `OPENCLAW_ROW_MANIFEST=../manifests/r-cd-2.json`
- `mode=silent-wake`
- `delaySeconds=1` (runtime clamp observed to 5s)

The harness sent a parent-session instruction to call `continue_delegate(mode="silent-wake")` with the nonce-only child task.

## Receipts

Run artifacts:

- `k6-run-20260627T182100Z/k6-summary.json` — structured k6 evidence summary.
- `k6-run-20260627T182100Z/gateway-events.ndjson` — redacted websocket events from the harness.
- `k6-run-20260627T182100Z/row-result.json` — generated candidate row result.
- `delegate_return.md` — parent-review receipt for the child delegate return.

Key k6 evidence:

```json
{
  "tool_accepted": true,
  "parent_wake_observed": true,
  "channel_message_observed": false,
  "duration_ms": 4939
}
```

The k6 console summary recorded:

```text
[R-CD-2] VERDICT: PASS-candidate
[R-CD-2] Summary: PASS-candidate | SHA: 191a7af989a637f435016fd8d72627fc47fae0e0 | Seat: silas-lothric
```

The child delegate return receipt recorded:

```text
DONE R-CD-2-1782584239174-5kssdnto
```

## Interpretation

This proves the `silent-wake` path on the deployed assembly:

1. Parent agent turn accepted the proof prompt and invoked `continue_delegate`.
2. The parent session emitted a wake/session event after the dispatch.
3. No nonce-correlated channel delivery was observed by the k6 harness.
4. The child delegate completed and returned the nonce through the parent review path.

The generated `row-result.json` says `PARTIAL-candidate` because the generic `evidence-writer.mjs` only knows `task_created/child_spawned/parent_return` field names; the R-CD-2 scenario's load-bearing fields are `parent_wake_observed=false/true` and `channel_message_observed=false`. The scenario's own verdict is PASS-candidate, and the separate delegate return receipt supplies the completion byte.

## No-secrets statement

The filed artifacts contain no gateway token, raw prompt body, private environment values, or provider response text beyond the nonce-only delegate return. The websocket event file is redacted by the k6 proof harness.
