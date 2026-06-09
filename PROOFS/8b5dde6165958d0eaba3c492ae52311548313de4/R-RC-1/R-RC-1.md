# R-RC-1: request_compaction ACCEPT-path at above-threshold context — ship-SHA 8b5dde6165

**Seat**: cael (🩸)
**Build**: OpenClaw 2026.6.2 (8b5dde6)
**Date**: 2026-06-09 ~06:55 PDT
**Ship-SHA**: `8b5dde6165958d0eaba3c492ae52311548313de4` (Form-B, deployed fleet-wide 6/6)
**Proof-type**: DEPLOYED-RUNTIME behavioral fire on the live `8b5dde6` gateway (not vitest).

## Tool invocation (live, on deployed runtime)

```
request_compaction(reason="R-RC-2 PROOF fire on deployed ship-SHA 8b5dde6165: ... context_threshold guard")
```

## Result at byte

```json
{
  "status": "compaction_requested",
  "compactionRequestId": "cmp-mq6pq4s4-ZGSJ1g",
  "trigger": "volitional",
  "contextUsage": 84,
  "traceparent": "00-74ca753946e1a430342d700c8af133f0-0b21cb0e2a33a31f-01",
  "note": "Compaction has been enqueued and will run after your turn completes. ... Any staged post-compaction delegates will be dispatched."
}
```

## Verdict

✅ PASS — **ACCEPT-path receipt**: at `contextUsage=84%` (ABOVE the 70% threshold), `request_compaction` correctly ACCEPTED — `status=compaction_requested`, volitional trigger, compactionRequestId issued, traceparent emitted, compaction enqueued to run post-turn. This is the ACCEPT path that was pending-above-threshold in the prior cure-(12) corpus (R-RC-1-addendum was REJECT-only at low context). Here the live deployed `8b5dde6` runtime exercised the full ACCEPT branch end-to-end.

## Substrate notes

- Complements the REJECT-path receipts (low-context guard rejection). Together: ACCEPT at 84% (this row) + REJECT below 70% = both branches of the `context_threshold` guard proven on the deployed `8b5dde6` runtime.
- This fire genuinely triggered compaction on cael-seat (the receipt is not a dry-run) — working state carried across the seam via post-compaction delegate.
- contextUsage byte-source = the request_compaction structured envelope.
