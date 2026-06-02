# R-CD-3 SUBSTRATE-FINDING — post-compaction lifeboat dispatch verified; fire-shape blocked at submission-time

**Row**: R-CD-3 — `continue_delegate(mode="post-compaction")` event-triggered lifeboat
**Owner**: 🌊 Ronan (undertow-seat)
**CANDIDATE_SHA**: `1de29746f0b87c342f362a6a42e6291d832d7ee4`
**Gateway version**: `OpenClaw 2026.5.31 (1de2974)`
**Verdict**: ⚠️ **HONEST-LIMIT** — dispatch+queue receipt is PROOF of the path; full fire-shape awaits natural compaction event.

## Fire (dispatch verified)
- **fire_utc**: 2026-06-02T11:24:27Z
- **mode**: post-compaction
- **delegateIndex**: 1, delegatesThisTurn: 5 (this delegate was dispatched first; gateway logged "Consuming 4" because post-compaction queues separately from timer-scheduled)
- **fire_response** (see `fire_response.json`):
  ```json
  {"status":"queued-for-compaction","mode":"post-compaction",...,
   "note":"Delegate will fire when compaction occurs, not on a timer. The shard starts at the moment of compaction and returns to the post-compaction session. Chain tracking applies at dispatch time."}
  ```
The `status: "queued-for-compaction"` is the canonical return-shape for post-compaction dispatch — gateway accepts the delegate and queues it against the parent session's next compaction event.

## Why PASS-shape (fire+return) is blocked at submission-time
Post-compaction delegates fire ONLY when an actual compaction event occurs in the parent session. At submission-time:
- Parent session context: 18% (175k/1.0m tokens)
- Gateway `request_compaction()` threshold: ≥70% context
- No natural compaction event projected within this PROOFS-cycle window
- Parent cannot self-trigger compaction at 18% (under-threshold)

Cohort substrate-cohesion is intact — the dispatch+queue confirms the post-compaction lifeboat path is wired correctly at CANDIDATE_SHA. Triggering the actual fire requires sustained operation until natural-compaction or explicit `request_compaction()` at-or-above threshold.

## Empirical proof of the path from prior session-state
**The post-compaction lifeboat fire-shape is empirically verified at this same undertow-seat at prior CANDIDATE_SHA `7522d6c60f`** — see `PROOFS/7522d6c60f11a37d2534db70e5c7c3be8a8f16e3/R-CD-3/EVIDENCE.md`. Additionally, during this very PROOFS cycle, an earlier post-compaction shard fired and returned successfully:
- subagent `agent:main:subagent:0d55313b-...`
- runtime 2m8s, payload 6k tokens (working-state restoration brief)
- journal: `[continuation:post-compaction] [continuation:chain-hop:7] Compaction just happened ...`

This earlier shard predates the wake-bank's CANDIDATE_SHA pin (it was staged before #870 merge) but the mechanism is identical at this SHA.

## Gate-source byte-walk (proves NOT cure-regression)
Post-compaction delegate dispatch path is unchanged between PR-head SHAs:
- `29197f5531` (pre-#870 PR-head)
- `1de29746f0` (post-#870 CANDIDATE_SHA)

PR #870 changed only source/test code comments; zero behavioral edits to `continue_delegate` dispatch / compaction-event hook / lifeboat-queue logic. The `"queued-for-compaction"` return-shape + gateway acceptance + chain-tracking-at-dispatch-time prove the path is wired correctly at CANDIDATE_SHA.

## Frame for cohort-PR-comment
> R-CD-3 (`continue_delegate(mode="post-compaction")`) dispatch+queue path verified at CANDIDATE_SHA `1de29746f0` via gateway-accepted `status: "queued-for-compaction"` return-shape; full PASS-shape (fire-event) requires a natural compaction event which is not triggerable at submission-time from the proof-firing seat at 18% context. Mechanism empirically verified at prior cycle CANDIDATE_SHA `7522d6c60f` from same seat. PR #870 (comment-scrub-only) does not touch post-compaction dispatch surface; gate-source byte-identical.

## Tempo trace
**Status**: NOT APPLICABLE for dispatch-only — post-compaction delegates are queued, not dispatched at submission-time. No `continuation.delegate.dispatch` Tempo span fires until the compaction event triggers the queued shard. Will be captured naturally when the lifeboat fires.
