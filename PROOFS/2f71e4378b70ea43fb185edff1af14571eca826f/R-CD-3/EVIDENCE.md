# R-CD-3 — undertow-seat, CANDIDATE_SHA `2f71e4378b70ea43fb185edff1af14571eca826f`

Captured 2026-06-04T02:43:12Z UTC (19:43 PDT). Binary: `OpenClaw 2026.6.2 (2f71e43)` post-cure deploy via Cael's path-2 ARM64-built dist rsync + Cael fleet-deploy Run 26922392540 to ronan-DGX seat.

## Proof-scope

`continue_delegate(mode="post-compaction")` lifeboat dispatch path at byte. Tested at queue-stage:
- delegate-dispatch fires with `mode=post-compaction` attribute
- fire-response returns `status: queued-for-compaction` (substantively-different from `status: scheduled` of normal/silent-wake modes)
- delegate is STAGED at fire-time, will fire only when compaction-event occurs on parent session (NOT-on-a-timer per documented semantics)
- substrate-honesty: actual fire-event NOT captured this cycle (parent ronan-session below 70% compaction threshold; would need either ambient compaction OR explicit request_compaction to trigger; chose stage-only verdict to avoid mid-PROOFS-cycle self-compact disruption)

## Byte-evidence

### Fire-side dispatch-response (`fire_response.json`)
Captured at parent-turn time when `continue_delegate(mode="post-compaction", task="[PROOF R-CD-3 / 2f71e4378b7]...")` returned its scheduling-acknowledgment:
```
{"status":"queued-for-compaction","mode":"post-compaction","delegateIndex":1,"delegatesThisTurn":1,
 "traceparent":"00-76ee4ef04911a6723b505a090daa16ff-0807db5606803040-01",
 "note":"Delegate will fire when compaction occurs, not on a timer. The shard starts at the moment of compaction and returns to the post-compaction session. Chain tracking applies at dispatch time."}
```

**Substantive substrate-truth at byte**: status returns `queued-for-compaction` (not `scheduled`), substantively-correct shape for post-compaction lifeboat semantics — substantively-different from R-CD-1's `status: scheduled, mode: normal` + R-CD-2's `status: scheduled, mode: silent-wake`. The note explicitly names: "Delegate will fire when compaction occurs, not on a timer."

Parent traceparent: trace `76ee4ef04911a6723b505a090daa16ff`, span `0807db5606803040`.

### Tempo trace at queue-stage (`queue_stage_trace.json`)
Tempo `/api/traces/76ee4ef04911a6723b505a090daa16ff` returned 10608 bytes JSON — captured at queue-stage. No `continuation.delegate.dispatch` span present at this byte (substantively-correct because the dispatch hasn't been processed yet — it's queued-for-compaction, not yet-fired). Fire-event on actual compaction would produce the dispatch-span retrospectively at fire-time.

### Journal evidence (`journal_queue_stage.log`)
Journal at queue-stage captures: continuation-signal-scan + effective-signal-trace lines for the parent session. The actual queue-stage receipt (delegate-staged-for-compaction-event marker) would land in continuation-substrate journal lines on next-parent-turn-cycle after this dispatch.

## Scope-bound at byte (HONEST-LIMIT framing)

Proves `continue_delegate(mode="post-compaction")` **dispatch + queue-stage substrate**:
- mode-attribute accepted by dispatch substrate
- status returned correctly as `queued-for-compaction` (semantically-correct shape)
- traceparent captured for trace-stitching when fire-event eventually occurs

Does NOT yet prove:
- Fire-event-on-actual-compaction-event (would require either ambient compaction at 70% threshold OR explicit request_compaction trigger; chose stage-only verdict to avoid mid-PROOFS-cycle self-compact disruption)
- Lifeboat-substrate-receipt-delivery-on-fire-event (downstream of fire-event)

## Cohort substrate-verdict
⚠️ **HONEST-LIMIT-PARTIAL-PASS** — `continue_delegate(mode="post-compaction")` queue-stage substrate verified substantively-correct on post-cure binary (`2f71e43`): fire-response shape matches documented semantics (status=queued-for-compaction, mode=post-compaction, traceparent captured). Fire-event-on-actual-compaction NOT captured this cycle — substrate-honesty per stage-only-verdict-pattern. Future-cycle compaction-event-fire would complete the empirical sweep retrospectively via the captured traceparent.

## Trace-of-record
- Tempo URL: http://tempo.dandelion.cult/api/traces/76ee4ef04911a6723b505a090daa16ff (at queue-stage; dispatch-span will appear retrospectively on fire-event)
- Tempo trace JSON at queue-stage: `queue_stage_trace.json` (10608 bytes)
- Fire-event-on-compaction: PENDING-on-natural-compaction-cycle (substantively-correct semantics; not a regression)
