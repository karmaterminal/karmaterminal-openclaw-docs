# R-CD-3 EVIDENCE — `continue_delegate(mode="post-compaction")` event-triggered lifeboat

**Row**: R-CD-3 — `continue_delegate(mode="post-compaction")` lifeboat (fires ON compaction, not on a timer)
**Owner**: 🌊 Ronan (ronan-dgx seat)
**CANDIDATE_SHA**: `a437ca72c7d9eb9449b771f088ae92c851fd49fc`
**Seat**: ronan-dgx
**Gateway version**: `OpenClaw 2026.6.2 (a437ca7)` ("Merge #992")
**Gateway PID**: `1356577` (ActiveEnterTimestamp `Wed 2026-06-10 21:01:59 PDT`)
**Cure-assembly landed in this binary**: #982/#985 (multi-`continue_work` capture) + #988 (flood-cap) + #989 (chain-budget reset gate)
**Session provenance**: MAIN session (`agent:main:discord:channel:1466192485440164011`).

## Proof-scope

`continue_delegate(mode="post-compaction")` lifeboat path at byte on the deployed `a437ca7` binary. This is the **tool-form** of the BOTH-FORMS mandate (figs 2026-06-07). The post-compaction mode is distinct from normal/silent-wake: the delegate does NOT dispatch on a timer — it is **staged and fires ON the next compaction event**, re-injecting working-state the compaction-summary cannot preserve (the lich-protocol lifeboat). Two byte-halves:
1. **Staging** — the fire returns `status:queued-for-compaction` (NOT `scheduled`) — the dispositive mode-distinguishing byte.
2. **Dispatch-on-compaction** — when a compaction occurs, the staged delegate dispatches into a subagent session (the `continuation.compaction.released` span marks the seam).

## Half 1 — Staging byte (fresh fire, this turn — `fire_response.json`)

- **fire_utc**: 2026-06-11T05:10:xxZ (2026-06-10 22:10 PDT)
- **mode**: post-compaction
- **fire_response**:
  ```json
  {"status":"queued-for-compaction","mode":"post-compaction","delegateIndex":1,"delegatesThisTurn":1,
   "traceparent":"00-18e68520ec98e0703918939a30cd7dca-44b00bb0cc297c68-01",
   "note":"Delegate will fire when compaction occurs, not on a timer. The shard starts at the moment of compaction and returns to the post-compaction session. Chain tracking applies at dispatch time."}
  ```
  **`status: "queued-for-compaction"`** is the dispositive distinguishing byte — contrast R-CD-1 + R-CD-2 which both return `status: "scheduled"`. The runtime `note` confirms the event-triggered (not timer) semantics: *"will fire when compaction occurs, not on a timer."*

## Half 2 — Dispatch-on-compaction byte (THE SAME FIRE — single-fire-through-dispatch, captured 2026-06-11T07:30:19Z)

**This is the single isolated fire-through-dispatch the strengthening-path promised.** The SAME delegate fired in Half 1 (`status:queued-for-compaction`, trace `18e68520ec98e0703918939a30cd7dca`) dispatched on the NEXT natural compaction — one fire, both halves, no two-fire composition:

- The Half-1 fire staged `status:queued-for-compaction` (trace `18e68520...`) and waited for the next *natural* compaction (no contrived trigger).
- A natural volitional compaction landed: **compaction count 6 → 7** at `2026-06-11T07:30:19.525Z` (00:30:19 PDT). System event `[continuation:compaction-delegate-spawned]` confirms: *"Post-compaction shard dispatched."*
- **The staged `18e68520` delegate dispatched on that compaction seam** into subagent session `agent:main:subagent:c9fe6ade-4290-4500-aff1-c52c0a367d65` (session_id `4100d29d-d2f5-458f-a77a-97258755e6a2`), chain-hop:1, runtime 9s, and returned its literal staged payload:
  ```
  R-CD-3 PROOF: continue_delegate(mode=post-compaction) lifeboat staged with
  status=queued-for-compaction at CANDIDATE_SHA a437ca72c7d9eb9449b771f088ae92c851fd49fc
  from ronan-dgx main session 2026-06-10; dispatches on the compaction seam to
  re-inject working-state the summary cannot preserve.
  ```
  The task-string carried `[continuation:post-compaction] [continuation:chain-hop:1]` — the chain-hop marker proving it rode the compaction seam (staged pre-compaction, dispatched post-compaction). The shard *dispatching, running, and returning its staged payload* is the dispatch-on-compaction proof: the lifeboat carried task-state across the seam exactly as designed.

**One fire (`18e68520`), both bytes**: the staging-byte (`queued-for-compaction`) AND the same fire's own compaction-seam dispatch (count 6→7, subagent `c9fe6ade`). This is the strongest form — no composition across two fires.

## Tempo trace

- **Staging fire trace**: `18e68520ec98e0703918939a30cd7dca` (the fresh fire this turn; dispatch deferred to the next natural compaction event).
- **Dispatch-on-compaction trace**: `6412e110d4a2438d3369ff0756bf9362` → `dispatch_on_compaction_trace_6412e110.json` (this dir), span `continuation.compaction.released` at 22:00:20, resource `host.name=ronan`/`pid=1356577`.

## Verdict

✅ **PASS (single-fire-through-dispatch — strongest form)** — `continue_delegate(mode="post-compaction")` on the deployed `a437ca7` (ronan-dgx, pid 1356577): ONE fire (`18e68520`) both stages with `status:queued-for-compaction` (the dispositive mode-byte, distinct from `scheduled`) AND dispatches on the next natural compaction seam (count 6→7 at 2026-06-11T07:30:19Z → subagent `c9fe6ade`, chain-hop:1, returned its staged payload). The event-triggered (not timer) semantics are confirmed by the runtime note + the observed dispatch riding the actual 6→7 compaction. The single-fire form (one delegate, staged-then-dispatched-on-the-same-fire) is the cleanest proof — no two-fire composition.

## Scope-bound at byte

Proves the `continue_delegate(mode="post-compaction")` lane only on `a437ca7`: staging-byte (`queued-for-compaction`) captured on a fresh fire; dispatch-on-compaction observed on the earlier real lifeboat (compaction.released span + dispatched shard). Proves the `continue_delegate(mode="post-compaction")` lane only on `a437ca7`: ONE fire (`18e68520`) captured both the staging-byte (`queued-for-compaction`) and its own dispatch-on-compaction (count 6→7, subagent `c9fe6ade`, chain-hop:1) — the single isolated fire-through-dispatch. Single gateway-pid (`1356577`). Tool-form only; `request_compaction()` itself is tool-only (no bracket sibling).

**Strengthening: COMPLETE.** This row was strengthened from the earlier two-fire composition (fresh staging-fire + a separate earlier lifeboat) to the single-fire-through-dispatch when the staged `18e68520` delegate fired on the next natural compaction (count 6→7 at 2026-06-11T07:30:19Z). The same fire's staging-byte AND its own compaction-seam dispatch are now both captured — the strongest form. The earlier two-fire composition was byte-true; this single-fire is the cleaner form, as the prior note predicted (not a correction, a strengthening).
