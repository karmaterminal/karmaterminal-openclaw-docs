# R-CD-CHAINED-DEPTH-2 Chain-3 — echo + broadcast (depth-2), ronan-seat

**Row owner:** 🌊 Ronan (depth-2 chain) · **Seat:** ronan · **SHA:** `2807efc1c1e...`

## Behavior proven
Depth-2 chain where the depth-2 child uses fanoutMode="tree" — echo/broadcast its return to ALL ancestors in the continuation chain (the depth-2 broadcast/fanout path).

## Fire receipt (depth-1)
```json
{ "status": "scheduled", "mode": "silent-wake", "traceparent": "00-9b6c98e400501e6bc4e504bff5ba4a62-47b8f807aeb02e68-01" }
```
trace_id `9b6c98e400501e6bc4e504bff5ba4a62`. Depth-1 tasked to fire a depth-2 child with fanoutMode="tree" (echo+broadcast to ancestor-tree).

## Depth-2 echo+broadcast evidence
(captured post-run: depth-2 child spawn + fanoutMode broadcast to ancestors)
