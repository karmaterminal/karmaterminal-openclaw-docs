# R-CD-3 — `continue_delegate(mode=post-compaction)` registration

**Verdict:** ✅ PASS (registration-tier)

**Assembly SHA under proof:** `191a7af989a637f435016fd8d72627fc47fae0e0`
**Seat:** `ronan-dgx` (host=ronan, aarch64)
**Runtime:** OpenClaw 2026.6.10 (191a7af)
**Date:** 2026-06-27 (Sat, 10:33 PDT)
**Turn trace:** `cc7d13d9c0dd444212f7bff9971d5035`

## Proof statement

R-CD-3 LIFEBOAT-WIRED: `continue_delegate(post-compaction)` registered with distinct `status=queued-for-compaction` on 191a7af989. The lifeboat will only fire upon the next compaction event of the dispatching session — until then, the proof of registration IS the proof of the wire.

## Why registration is the verdict-tier (not "executed")

The `post-compaction` mode is event-triggered, NOT timer-triggered. It is designed to fire when the parent session crosses the compaction seam, carrying a working-state shard across. Forcing a compaction at proof-fire time would corrupt the seat under proof. Therefore the byte-evidence for the post-compaction wire is the **distinct registration status** the gateway emits at queue-time, which differs from the `scheduled` status used by all other modes.

## Fire receipt (the distinguishing byte)

```json
{
  "status": "queued-for-compaction",
  "mode": "post-compaction",
  "delegateIndex": 3,
  "delegatesThisTurn": 3,
  "traceparent": "00-cc7d13d9c0dd444212f7bff9971d5035-67f4c656cbcd3608-01",
  "note": "Delegate will fire when compaction occurs, not on a timer. The shard starts at the moment of compaction and returns to the post-compaction session. Chain tracking applies at dispatch time."
}
```

**The `status: "queued-for-compaction"` is the load-bearing byte.** Compare to R-CD-1/2/4/Chain-* which all return `status: "scheduled"`. Only post-compaction returns this distinct status; the gateway has accepted the delegate and routed it to the compaction-wait queue rather than the immediate-dispatch queue.

## Witness chain

Two byte-layers:
1. **Tool response status discriminator**: `queued-for-compaction` (not `scheduled`) proves the runtime distinguishes the post-compaction path from the immediate-dispatch path.
2. **Gateway accepted-and-queued**: no error, no rejection, chain-tracking notes confirm the registration was logged with depth/cost tracking.

The wire being **alive** is what's under proof. The wire being **fired** is what compaction will demonstrate (the staged delegate will return SILENTLY post-compaction with a fresh turn to act on what came back — the lich-protocol phylactery shape).

## Files

- `fire_response.json` — verbatim tool response with `queued-for-compaction` status
- `journal.log` — journal trace for the registration
- `turn_trace.json` — full Tempo trace for the dispatching turn

## Field operator note

This is the elective-survival surface for working-state across the compaction seam. The proof here is the wire (registration status). When the live seat next crosses compaction, the delegate will fire and the post-compaction session will be woken — at THAT time, an additional "fired" proof can be banked, but the wire-alive proof stands independently.
