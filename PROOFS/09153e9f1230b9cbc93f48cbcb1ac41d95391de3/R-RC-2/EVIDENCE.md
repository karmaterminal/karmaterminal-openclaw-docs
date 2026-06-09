# R-RC-2 — `request_compaction` ACCEPT at ≥threshold (over-70% context)

**Row owner:** 🩸 Cael
**Seat:** cael (10.0.0.148; DGX Spark GB10, ARM64, 128GB)
**Exact ship-SHA:** `8b5dde6165958d0eaba3c492ae52311548313de4` (deployed, byte-verified — `openclaw --version` = OpenClaw 2026.6.2 (8b5dde6))
**Captured:** 2026-06-09 ~06:55 PDT (live deployed-runtime fire)
**Reproof of:** the ACCEPT-arm of the volitional-compaction threshold gate — `request_compaction` ACCEPTS at contextUsage ABOVE the 70% threshold (complements 🌫 Silas's R-RC-1 REJECT-arm at 32%).

## Behavior proven

`request_compaction(reason)` invoked at context-usage ABOVE the `context_threshold` guard ACCEPTS the request: returns `status=compaction_requested` with a volitional trigger, a compactionRequestId, and a traceparent, and enqueues compaction to run after the turn. This is the ACCEPT-path that was *pending-above-threshold* in the prior corpus (the addendum row there was REJECT-only at low context). Here the live deployed `8b5dde6` runtime exercised the full ACCEPT branch end-to-end — the fire genuinely triggered cael-seat's compaction (not a dry-run; working state carried across the seam via a post-compaction delegate).

## Receipt (verbatim from tool response)

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

## Field-by-field gate-verification

- **status = "compaction_requested"** ✓ — explicit ACCEPT verdict (NOT "rejected"; the over-threshold branch taken)
- **trigger = "volitional"** ✓ — agent-elected compaction (the continuation-tool ACCEPT surface)
- **contextUsage = 84** ✓ — measured usage ABOVE the 70% threshold (so ACCEPT is correct)
- **compactionRequestId = "cmp-mq6pq4s4-ZGSJ1g"** ✓ — request issued + tracked
- **traceparent** ✓ — emitted (ACCEPT path creates trace context; REJECT path does not — the two arms differ exactly here)
- **enqueued** ✓ — `note` confirms compaction enqueued to run post-turn + staged post-compaction delegates dispatch

## Both-arms coverage on deployed `8b5dde6165`

- **REJECT-arm:** 🌫 Silas R-RC-1 @ 32% ctx + 🩸 Cael corroboration @ 14% ctx (post-compaction) — clean structured rejection below threshold.
- **ACCEPT-arm:** 🩸 Cael (this row) @ 84% ctx — clean acceptance above threshold, trace emitted, compaction triggered.
- Together: the `request_compaction` context_threshold gate proven in BOTH directions on the live deployed ship-SHA (figs's both-paths directive satisfied).

## Verdict: ✅ PASS

The `request_compaction` ACCEPT-path fires-as-designed on the deployed `8b5dde6165` runtime at above-threshold context — volitional trigger, request issued, trace emitted, compaction enqueued.
