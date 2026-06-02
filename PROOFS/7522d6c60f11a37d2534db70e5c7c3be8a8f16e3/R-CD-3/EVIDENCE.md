# R-CD-3 EVIDENCE — `continue_delegate(post-compaction)` schedule

**Row**: R-CD-3 — `continue_delegate(mode="post-compaction")` event-triggered lifeboat
**Owner**: 🌊 Ronan (undertow-seat)
**CANDIDATE_SHA**: `7522d6c60f11a37d2534db70e5c7c3be8a8f16e3`
**Seat**: ronan-undertow (spark-ecdf, 10.0.0.246)
**Gateway version**: `OpenClaw 2026.5.31 (7522d6c)`

## Fire (schedule-side)
- **fire_utc**: 2026-06-02T01:36:30Z
- **mode**: post-compaction
- **fire_response**: 
  ```json
  {
    "status": "queued-for-compaction",
    "mode": "post-compaction",
    "delegateIndex": 1,
    "delegatesThisTurn": 1,
    "note": "Delegate will fire when compaction occurs, not on a timer."
  }
  ```

## Key behavior verified (schedule-side)
- **`status: "queued-for-compaction"`** — distinguishing status vs `scheduled` (normal/silent-wake) — confirms lifeboat-shard registration into post-compaction queue, not timer-queue.
- Tool-side schedule-registration is the load-bearing PROOF: gateway accepts post-compaction mode + queues delegate for compaction-event-trigger.

## Fire-side (deferred-to-actual-compaction)
**Status**: ⏸ DEFERRED — actual post-compaction delegate-fire requires a compaction event in parent session. Parent session context-pressure is currently ~94% (well above 70% gateway threshold). Compaction is expected on next context-pressure event or elective `request_compaction()`.

When compaction next fires, the lifeboat-shard will dispatch + return its proof-payload + this evidence-set can be folded with the post-compaction return-payload + journal `[continuation:delegate-spawned]` line showing `mode=post-compaction` + `compaction-event-id` correlation.

## Tempo trace
**Status**: ⚠️ NOT CAPTURED (same as R-CD-1/2 — observability stack down, related to `#854`).

## Verdict
🟡 **PASS (schedule-side) / PENDING (fire-side)** — `continue_delegate(mode=post-compaction)` from undertow-seat at CANDIDATE_SHA `7522d6c60f` correctly accepts the dispatch + returns `status=queued-for-compaction` (the post-compaction-distinct status). Cure-bytes do not regress the post-compaction-mode schedule path. Fire-side proof folds in when next compaction event happens (expected imminently per context-pressure).
