# R-CD-4 EVIDENCE — `continue_delegate(targetSessionKey)` cross-session targeted return

**Row**: R-CD-4 — cross-session targeted return via targetSessionKey
**Owner**: 🌊 Ronan (undertow-seat)
**CANDIDATE_SHA**: `077b261dd820d16a2667369e3006c4efdd6b0ef0`
**Seat**: ronan (spark-ecdf / dgx)

## Fire
- **fire_utc**: ~2026-06-16T00:12:56Z
- **mode**: normal
- **delegateIndex**: 3, delegatesThisTurn: 3
- **targetSessionKey**: `agent:main:main`
- **fire_response**:
```json
{"status":"scheduled","mode":"normal","delaySeconds":5,"delegateIndex":3,"delegatesThisTurn":3,"targetSessionKey":"agent:main:main","traceparent":"00-6ae2c84ec654f35825593513403fb146-4d2cb9b50084c77d-01"}
```

## Registration + cross-session-routing proof
`status: "scheduled"` with `targetSessionKey: "agent:main:main"` echoed in the fire_response = `continue_delegate(targetSessionKey=...)` REGISTERED + functional on `077b261dd820d16a2667369e3006c4efdd6b0ef0`. The dispatch consumes the delegate from the parent group-channel session but routes the return-payload to `agent:main:main` (the cross-session target) — verified on dispatch (parent does NOT receive the literal-string as channel-announce; `agent:main:main` receives it as inbound).

## Return / Tempo
Trace ID `6ae2c84ec654f35825593513403fb146`. delegate_return_payload.txt + journal (delegate-spawned + cross-session routing lines) + turn_trace.json captured post-dispatch.

## Verdict
✅ **PASS (fire-side)** — `continue_delegate(targetSessionKey="agent:main:main")` registered + scheduled + target-echoed on deployed `077b261dd820d16a2667369e3006c4efdd6b0ef0`. Matches prior-cycle R-CD-4 baseline (1de29746f0).

## DISPATCH-SIDE CONFIRMED (full-PASS)
- **spawn**: `17:15:10.990 [continuation:delegate-spawned] hop=3/200 mode=normal ...task=R-CD-4 PROOF (continue_delegate targetSessionKey cross-session targeted return)`
- **return**: `17:15:27.584 R-CD-4 PROOF: continue_delegate cross-session targetSessionKey-routing verified at 077b261dd8... return targeted to agent:main:main.` (routed to the agent:main:main cross-session target, not the dispatching channel)
- **Tempo trace**: `6ae2c84ec654f35825593513403fb146` (turn_trace.json)
- ✅ **FULL PASS** — targetSessionKey cross-session targeted return verified end-to-end on deployed 077b261dd8; return routed to agent:main:main.
