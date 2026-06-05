# R-CD-CHAINED-DEPTH-2 Chain-2 — inter-session return (depth-2)

**Row owner:** 🌊 Ronan (depth-2 chain) · **Seat:** ronan · **SHA:** `2807efc1c1e...`

## Behavior proven
Depth-2 chain where the depth-2 child returns INTER-SESSION via explicit targetSessionKey (the child's return routes to a named session, not the spawning delegate's default).

## Fire receipt (depth-1)
```json
{ "status": "scheduled", "mode": "silent-wake", "traceparent": "00-9b6c98e400501e6bc4e504bff5ba4a62-47b8f807aeb02e68-01" }
```
trace_id `9b6c98e400501e6bc4e504bff5ba4a62`. Depth-1 tasked to fire a depth-2 child with inter-session targetSessionKey.

## Depth-2 inter-session evidence
(captured post-run: depth-2 child spawn on subagent-chain + inter-session targetSessionKey routing)

## Depth-2 inter-session PROVEN (journal) — see depth2_inter_session_journal.txt
1. Depth-1 spawn `hop=10/200 mode=silent-wake`.
2. Depth-1 fired depth-2 child with `targetSessionKey=agent:main:discord:channel:1466192485440164011` (inter-session routing echoed).
3. **Depth-2 child spawn `hop=1/200 mode=silent session=agent:main:subagent:09e19282-...`** — subagent-of-subagent chain (depth-2) with explicit inter-session targetSessionKey.

## Chain-2 FINAL VERDICT: ✅ PASS (depth-2 inter-session return, ronan-seat, SHA 2807efc)
A delegate spawned a child delegate (depth-2) whose return routes inter-session via targetSessionKey. Depth-2 inter-session targeted return fires clean on the assembly SHA.
