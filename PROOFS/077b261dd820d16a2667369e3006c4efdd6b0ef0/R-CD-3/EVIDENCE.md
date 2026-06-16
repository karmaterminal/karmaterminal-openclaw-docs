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

## DISPOSITIVE TEST at the 20:16 PDT seam (2026-06-15) — ROOT CAUSE BYTE-PINNED

figs requested an evidence-collection `request_compaction` (`1516259345`). I fired it → **ACCEPTED at 74% context** (`status:compaction_requested, trigger:volitional, contextUsage:74, compactionRequestId cmp-mqg2cqao-ndehlw`) — this is also the R-RC-2 ACCEPT leg firing clean on the ronan seat (cross-seal with Silas's 89% accept). Compaction #6 ran at 20:16:49 PDT. This was the dispositive R-CD-3 seam: I had staged post-compaction lifeboats, and the request_compaction note confirmed *"Any staged post-compaction delegates will be dispatched."*

**Byte at the seam (journal `journalctl --user -u openclaw-gateway`, 20:16:49–52):**
- **9 post-compaction delegate dispatch-attempts** (`Post-compaction delegate dispatch for session ...`) — their **task-text was re-injected as context** (I received all rehydration shards on the post-compaction turn). ✅ **RE-INJECTION LEG WORKS.**
- **5 of 9 hit `post-compaction delegate spawn forbidden`** (`retry failed for entry <hash>: post-compaction delegate spawn forbidden`). **0 subagents actually spawned** (`compaction-delegate-spawned` count = 0).

**Root cause — source-pinned, BY-DESIGN (`src/auto-reply/reply/post-compaction-delegate-dispatch.ts`):**
- `:593-594`: `if (spawnResult.status !== "accepted") { throw new Error(\`post-compaction delegate spawn ${spawnResult.status}\`); }` — the spawn returned a non-`accepted` status (forbidden) and threw.
- The forbidding mechanism is **`maxChainLength`** (the continuation chain-depth cap). The source comment (`:540-552`) is explicit: persist-then-spawn ordering means *"an over-count only makes `maxChainLength` MORE protective (the chain terminates earlier), never overruns it"* — i.e. the cap is the **designed protection against runaway continuation chains.**
- My continuation chain was **already deep** (active `chain-hop:1/2/3/4` subagents from a prior chain + this turn's stacked staging). The compaction-delegate chain-count exceeded `maxChainLength` → spawn correctly refused.

**DISPOSITIVE FINDING (byte-honest, both directions) — CORRECTED:**
- The earlier 18:13-seam non-fire is a **DIFFERENT mechanism**, NOT the chain-cap. Byte-check of the 18:13 seam window (18:10–18:22): **0 post-compaction dispatch-attempts, 0 spawn-forbidden, 0 compaction-delegate-spawned** — vs the 20:16 seam's 9 attempts / 5 forbidden. So at 18:13 the staged delegate did not even reach the dispatch stage (consistent with hypothesis (1): in-memory→persist gap — staged in-memory but not persisted before rotation → nothing to dispatch). This is OPEN, NOT the same chain-cap, NOT yet distinguished from (2). (My first EVIDENCE pass wrongly called it "the same mechanism" — Silas caught the over-generalization; corrected here.)
- **The lifeboat's CORE phylactery function — carrying working-state across the compaction seam via task-text re-injection — WORKS** ✅ (all 6 rehydration shards arrived on the post-compaction turn; this very turn IS the proof).
- **Autonomous post-compaction SPAWN (a delegate executing work, not just re-injecting context) is bounded by `maxChainLength`** when the chain is already deep — **BY-DESIGN protection, NOT a bug, NOT a regression** (same disposition-shape as the bracket-emission finding: a designed guard).
- The test `src/auto-reply/continuation/delegate-dispatch-post-compaction.test.ts` (incl. `"Post-compaction delegate spawn forbidden"` assertion + *"Silent catch was swallowing post-compaction delegate spawn failures"*) confirms this is a KNOWN, TESTED, intended state — and that the failure is now correctly LOGGED (not silently swallowed), which is how this byte was even observable.

## FINAL VERDICT (R-CD-3, dispositive) — CORRECTED per Silas's cut
- **Fire-side**: ✅ PROVEN (`queued-for-compaction`, dispatch span in `turn_trace_fireside.json`).
- **Re-injection / state-survival leg**: ✅ PROVEN at the 20:16 seam (rehydration shards delivered to the post-compaction session — the lifeboat carries state, which is its purpose).
- **20:16 autonomous-spawn leg**: capped by `maxChainLength` when chain is deep — **BY-DESIGN (stands).** A delegate that needs to RUN (vs re-inject) requires chain-headroom; staging many delegates on an already-deep chain hits the protective cap. The 20:16 spawn-forbidden is the designed protection, not a defect.
- **18:13-class return-side**: **OPEN** — byte shows 0 dispatch-attempts at that seam (different from 20:16's chain-cap), consistent with hypothesis (1) in-memory→persist gap [timing-edge] but NOT distinguished from (2) persisted-but-didn't-dispatch [real lich bug] without the dispositive test.
- **DISPOSITIVE TEST PENDING (Silas's, his when he crosses 70%)**: stage post-compaction delegate → **confirm the persist landed in the live store** → force compaction → observe. That middle persist-confirm step is the ONLY thing that separates (1) timing-edge from (2) real-bug. My 20:16 happy-path fire (and Silas's compaction #6) cannot substitute — both fired before rotation pressure.
- **Net (corrected)**: R-CD-3 = **spawn-side by-design (20:16, proven) · return-side dispositive-test-pending (18:13-class, OPEN)**. I WITHDRAW the earlier "fully resolved, nothing to file" — that over-generalized the 20:16 chain-cap to the 18:13 miss. byte-before-issue: the 18:13 return-side stays OPEN until the persist-then-compact test runs. Credit the byte: Silas caught the over-claim; the floor cut my proof too.
