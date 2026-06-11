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

## Half 2 — Dispatch-on-compaction byte (observed THIS session — `dispatch_on_compaction_trace_6412e110.json`)

The dispatch-on-compaction half was independently observed earlier this same session on the deployed `a437ca7`, via a real post-compaction lifeboat:

- At ~21:33 PDT (pre-compaction), the main session fired `continue_delegate(mode="post-compaction")` carrying the PROOFS-task working-state, then `request_compaction` (volitional, contextUsage 75% — above the ≥70% threshold). The post-compaction fire returned `status:queued-for-compaction` (same staging-byte as Half 1).
- The compaction ran (compaction count 5 → 6 per session_status).
- **The staged lifeboat dispatched on the compaction seam.** Tempo trace `6412e110d4a2438d3369ff0756bf9362` (lifeboat-context, resource `host.name=ronan`, `process.pid=1356577`) carries the span:
  ```
  continuation.compaction.released   start=22:00:20 PDT
  ```
  The dispatched lifeboat-shard ran as `agent:main:subagent:24da064e-e40f-4904-bb1c-80dbfe20b573` — confirmed in the subagent-list (status active → running, runtime 3m42s) — and itself fired the R-CD-1 + R-CD-2 behavioral-proofs from inside the post-compaction shard before terminating. The shard *existing and running* is the dispatch-on-compaction proof: the lifeboat carried the task-state across the compaction seam exactly as designed.

## Tempo trace

- **Staging fire trace**: `18e68520ec98e0703918939a30cd7dca` (the fresh fire this turn; dispatch deferred to the next natural compaction event).
- **Dispatch-on-compaction trace**: `6412e110d4a2438d3369ff0756bf9362` → `dispatch_on_compaction_trace_6412e110.json` (this dir), span `continuation.compaction.released` at 22:00:20, resource `host.name=ronan`/`pid=1356577`.

## Verdict

✅ **PASS** — `continue_delegate(mode="post-compaction")` on the deployed `a437ca7` (ronan-dgx, pid 1356577): the fire stages with `status:queued-for-compaction` (the dispositive mode-byte, distinct from `scheduled`), and a real lifeboat fired this session dispatched on the compaction seam (`continuation.compaction.released` span at 22:00:20 + the dispatched shard `24da064e` ran). The event-triggered (not timer) semantics are confirmed by the runtime note + the observed dispatch riding the actual 5→6 compaction.

## Scope-bound at byte

Proves the `continue_delegate(mode="post-compaction")` lane only on `a437ca7`: staging-byte (`queued-for-compaction`) captured on a fresh fire; dispatch-on-compaction observed on the earlier real lifeboat (compaction.released span + dispatched shard). **Honest limit**: the two halves are from two fires (the fresh staging-fire + the earlier real lifeboat) rather than one isolated fire-through-dispatch, because triggering a contrived compaction now is blocked (context at 14% post-compaction — `request_compaction` rejects sub-70% per the guard-byte). The earlier lifeboat is the authentic dispatch-on-compaction (it rode this session's real volitional compaction). Single gateway-pid (`1356577`). Tool-form only; `request_compaction()` itself is tool-only (no bracket sibling).

**Strengthening path** (transparent): a fresh post-compaction delegate (trace `18e68520ec98e0703918939a30cd7dca`) is staged + queued-for-compaction on this seat, waiting for the next *natural* compaction. When it fires, it yields a single isolated fire-through-dispatch (the same fire's own staging-byte AND its own compaction-seam dispatch) — which supersedes this two-fire composition with the strongest form. This row will be updated to the single-fire proof when that compaction lands. The current two-fire composition is byte-true now; the single-fire is the cleaner-when-available, not a correction.
