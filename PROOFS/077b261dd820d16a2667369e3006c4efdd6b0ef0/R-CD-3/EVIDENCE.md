# R-CD-3 EVIDENCE — `continue_delegate | post-compaction` lifeboat

**Row**: R-CD-3 — continue_delegate post-compaction lifeboat (fires-at-compaction, not on a timer)
**Owner**: 🌊 Ronan (undertow-seat)
**CANDIDATE_SHA**: `077b261dd820d16a2667369e3006c4efdd6b0ef0`
**Seat**: ronan (spark-ecdf / dgx)

## Fire
- **fire_utc**: ~2026-06-16T00:12:56Z
- **mode**: post-compaction
- **delegateIndex**: 4, delegatesThisTurn: 4
- **fire_response**:
```json
{"status":"queued-for-compaction","mode":"post-compaction","delegateIndex":4,"delegatesThisTurn":4,"traceparent":"00-6ae2c84ec654f35825593513403fb146-4d2cb9b50084c77d-01"}
```

## Registration proof
`status: "queued-for-compaction"` = `continue_delegate(mode=post-compaction)` REGISTERED + functional on `077b261dd820d16a2667369e3006c4efdd6b0ef0`. The post-compaction mode is distinct from the timer-based modes: it stages the delegate to fire at the NEXT compaction event (not on a delaySeconds timer), returning the working-state-survival shard to the post-compaction session.

## Return / Tempo
Trace ID `6ae2c84ec654f35825593513403fb146`. Fires at the next compaction seam — delegate_return_payload.txt captured when compaction occurs (the lifeboat fires + returns the proof-line to the post-compaction session).

## Verdict
✅ **PASS (fire-side)** — `continue_delegate(mode=post-compaction)` registered + queued-for-compaction on deployed `077b261dd820d16a2667369e3006c4efdd6b0ef0`. Return fires at the compaction seam.

## DISPATCH STATUS
post-compaction lifeboat is STAGED (queued-for-compaction, fire-side PASS). Return fires at the next compaction seam → delegate_return_payload.txt + the post-compaction-session return captured when compaction occurs. Fire-side registration proof complete on deployed 077b261dd8.

## Trace JSON (fire-side saved; return-side fires at compaction)
- **turn_trace_fireside.json**: the batch trace `6ae2c84ec654f35825593513403fb146` (R-CD-3 was fired in the same turn-batch as R-CD-1/2/4, delegateIndex=4, `queued-for-compaction`) — this carries R-CD-3's **fire-side dispatch span** (the queue-for-compaction registration), saved IN the corpus per the trace-JSON-not-link mandate.
- **Return-side**: post-compaction is event-driven, not timer-driven — R-CD-3's RETURN span (the lifeboat firing at the compaction seam) is produced WHEN the next compaction occurs. Its trace JSON + delegate_return_payload.txt land at that seam (captured then, dropped into this dir). Until compaction fires, there is no return-span to fetch — that's the nature of the post-compaction mode, not a gap-by-omission.
- **Status**: fire-side trace JSON saved ✅; return-side trace pending the next compaction event (will be appended).

## Post-compaction return — byte-honest finding at the 18:13 PDT seam (2026-06-15)
A real compaction occurred this session at **18:13:04 PDT** (journal: `[compaction] rotated active transcript after compaction` + `[context-pressure:fire] post-compaction band=0 ratio=3% tokens=25k/1000k`). This was the seam where R-CD-3's staged post-compaction delegate was expected to fire its return.

**Byte-honest result: NO post-compaction delegate fire/release was recorded at this seam** (journal window 18:12–18:20 shows the compaction-rotation + context-pressure fire, but no R-CD-3 delegate spawn/release/return). The post-compaction reservation was staged in the *pre-compaction* working state of an earlier turn; it did not survive/fire across THIS compaction seam — consistent with the reservation living in working state the summary did not carry forward.

**Interpretation (not over-claimed):** R-CD-3's FIRE-SIDE is proven (the delegate was accepted + `queued-for-compaction`, dispatch span in `turn_trace_fireside.json`). The RETURN-SIDE did not auto-fire at the observed seam — so the end-to-end post-compaction *return* is **NOT proven** on this seat this session. Recorded as a partial: fire-side ✅, return-side UNPROVEN-AT-OBSERVED-SEAM (honest, not forced).

**Control-test cross-check (registration is healthy):** a journal warning fired at 18:05:51 (`continuation.enabled=true but neither continueWorkOpts nor requestCompactionOpts were supplied — only continue_delegate will register`). To avoid carrying that as a stale alarm, I ran the empirical control case: called `continue_work(30s)` on this live deployed seat → `status:scheduled` (traceparent `8a9322faa6635c8beaf2418c6735a257`). The tool dispatches → it IS registered on the live main-session runner. The 18:05:51 warning was the catalog/inventory-build code path (which the warning text itself names as a legitimate non-live path), NOT a live tool-registration regression on `077b261dd8`. continue_work + (separately verified) request_compaction guard-reject both work on this seat.
