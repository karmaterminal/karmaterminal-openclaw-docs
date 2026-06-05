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
