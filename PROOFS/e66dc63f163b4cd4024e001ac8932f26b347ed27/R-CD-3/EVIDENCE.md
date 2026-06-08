# R-CD-3 — continue_delegate(mode="post-compaction") event-triggered lifeboat

**Row owner:** 🌊 Ronan · **Seat:** ronan (spark-ecdf, 10.0.0.246)
**SHA:** `e66dc63f163b4cd4024e001ac8932f26b347ed27` (`OpenClaw 2026.6.2`)
**Deployed gateway:** pid 1581565, restarted 2026-06-08 07:18:28 PDT (fresh, clean)
**Fired:** 2026-06-08 ~07:35 PDT

## Behavior proven
`continue_delegate(mode="post-compaction")`: the lifeboat shard is queued and fires AT a compaction event (not on a timer), returning to the post-compaction session. Tested against the LIVE deployed candidate `e66dc63f`.

## Leg 1 — Stage receipt (THE defining event-triggered distinction, from tool response)
```json
{
  "status": "queued-for-compaction",
  "mode": "post-compaction",
  "delegateIndex": 1,
  "delegatesThisTurn": 1,
  "traceparent": "00-45e5bc5416b86cc65f6b5e18cf01b50d-5fc6851830660d9f-01",
  "note": "Delegate will fire when compaction occurs, not on a timer. The shard starts at the moment of compaction and returns to the post-compaction session. Chain tracking applies at dispatch time."
}
```
- **status = "queued-for-compaction"** ✓ — **THE defining distinction**: NOT "scheduled" (timer) but **queued-for-compaction** (event-triggered). This single byte proves post-compaction mode routes to the compaction-queue, not the timer-schedule. The shard waits for the compaction event.
- **mode = "post-compaction"** ✓
- **traceparent** = `00-45e5bc5416b86cc65f6b5e18cf01b50d-5fc6851830660d9f-01` (trace_id `45e5bc5416b86cc65f6b5e18cf01b50d`)
- **note** confirms the contract verbatim: "Delegate will fire when compaction occurs, not on a timer. The shard starts at the moment of compaction and returns to the post-compaction session."

## Leg 2 — Fire AT compaction
The lifeboat is queued, waiting for a compaction event. The fire-leg completes when a genuine compaction occurs (the fire timing-adjacent to the compaction event, distinct from a timer-delay, is the proof of the lifeboat path).

**Byte-honest note on the fire-leg:** `request_compaction` requires ≥70% context usage (gateway guard). At fire-time this seat was at **24% context** (a compaction earlier this session reset it), so a genuine volitional compaction is NOT available at this moment — and a forced sub-threshold compaction would game the proof, which is the opposite of the certification discipline. The fire-leg captures when a genuine ≥70%-ctx compaction fires on `e66dc63f` (as context climbs through sustained work, or a subsequent genuine compaction).

**⚠️ CORRECTION (byte over my own read — the keeper's discipline, self-caught): the prior-SHA capture does NOT transfer.** I initially noted "the runtime path is unchanged between `2807efc` and `e66dc63f`." **That is byte-FALSE.** `git diff 2807efc..e66dc63f --stat -- src/auto-reply/continuation/` shows **29 files changed, +2272/-848**, including the post-compaction path directly: `post-compaction-release.ts` changed, `scheduler.ts` rewritten (-224), and NEW `work-dispatch.ts` (+389) + `work-store.ts` (+344). The continuation dispatch path was **substantially refactored** between the two SHAs — which is precisely WHY the cohort is re-certifying the runtime-half live on `e66dc63f` rather than trusting the prior capture. The prior-SHA `2807efc` fire-capture is therefore **NOT a valid transfer-of-evidence** for the fire-mechanism on `e66dc63f`. The fire-leg is genuinely uncertified-live until a real ≥70%-ctx compaction fires on this deployed SHA. The **queued-for-compaction routing distinction — the load-bearing proof that post-compaction mode is event-triggered, not a timer — IS certified NOW at the byte** (the fire-receipt + runtime contract note, on the deployed `work-dispatch.ts`/`work-store.ts` path); the fire-leg itself is honestly pending.

## Tempo trace
- trace_id: `45e5bc5416b86cc65f6b5e18cf01b50d` (stage traceparent)
- Fetch: `http://tempo.dandelion.cult/api/traces/45e5bc5416b86cc65f6b5e18cf01b50d`
(captured below)

## R-CD-3 VERDICT: ✅ PARTIAL — queued-for-compaction event-triggered ROUTING certified live; ⏳ fire-at-compaction leg HONEST-PENDING (genuine ≥70%-ctx compaction on e66dc63f; prior-SHA capture does NOT transfer — path refactored)
**Certified live at the byte:** `continue_delegate(mode="post-compaction")` returns **status=queued-for-compaction** (event-triggered, byte-distinct from the timer's "scheduled"), with the runtime contract note confirming "fires when compaction occurs, not on a timer" — on the deployed candidate `e66dc63f` (pid 1581565), exercising the refactored `work-dispatch.ts`/`work-store.ts` queue path. The lifeboat is QUEUED live. This is the load-bearing routing distinction (post-compaction mode is event-triggered, not a timer-schedule), and it is proven on the live deploy.

**Honest-pending (NOT gamed):** the fire-at-compaction leg itself requires a genuine ≥70%-ctx compaction on `e66dc63f`; at 24% ctx that is not available now, and forcing a sub-threshold compaction would be the exact masked-regression class the certification discipline guards against. Because the continuation dispatch path was substantially refactored from `2807efc` (+2272/-848, 29 files), the prior-SHA fire-capture does NOT transfer — the fire-leg is genuinely uncertified-live until a real compaction fires on this SHA. Captures when context climbs through sustained work, or a subsequent genuine compaction. The lifeboat shard carries the working-state and will fire at that event.
