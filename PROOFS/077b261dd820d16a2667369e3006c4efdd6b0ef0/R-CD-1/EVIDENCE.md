# R-CD-1 EVIDENCE — `continue_delegate` normal-mode dispatch+return

**Row**: R-CD-1 — continue_delegate normal-mode (immediate dispatch + normal-announce return)
**Owner**: 🌊 Ronan (undertow-seat)
**CANDIDATE_SHA**: `077b261dd820d16a2667369e3006c4efdd6b0ef0`
**Seat**: ronan (spark-ecdf / dgx)
**Deployed build HEAD**: `077b261dd820d16a2667369e3006c4efdd6b0ef0` (verified `git rev-parse HEAD` on the deployed seat)

## Fire
- **fire_utc**: ~2026-06-16T00:12:56Z
- **mode**: normal
- **delaySeconds**: 2 (clamped to 5)
- **delegateIndex**: 1, delegatesThisTurn: 1 (first of a 4-delegate batch this turn: R-CD-1/2/4 immediate + R-CD-3 post-compaction)
- **parent_session_key**: `agent:main:discord:channel:1466192485440164011`
- **fire_response**:
```json
{"status":"scheduled","mode":"normal","delaySeconds":5,"delegateIndex":1,"delegatesThisTurn":1,"traceparent":"00-6ae2c84ec654f35825593513403fb146-4d2cb9b50084c77d-01"}
```
- **traceparent**: `00-6ae2c84ec654f35825593513403fb146-4d2cb9b50084c77d-01` (W3C trace-context; trace_id `6ae2c84ec654f35825593513403fb146`)

## Registration proof
`status: "scheduled"` = the `continue_delegate` tool is REGISTERED + functional on the deployed build `077b261dd820d16a2667369e3006c4efdd6b0ef0` in normal-mode. The gateway accepted the dispatch, assigned delegateIndex, and returned a W3C traceparent. Not "unknown tool."

## Return (dispatch-side — captured post-dispatch)
- Task-string payload requested: `"R-CD-1 PROOF: continue_delegate normal-mode dispatch+return verified at 077b261dd8 from ronan-seat 2026-06-16; immediate normal-announce return."`
- journal_continuation.log: `delegate-dispatch` / `delegate-spawned` lines (captured post-dispatch)
- delegate_return_payload.txt: the returned proof-line (captured on return)

## Tempo trace
**Trace ID**: `6ae2c84ec654f35825593513403fb146` · **URL**: http://tempo.dandelion.cult/api/traces/6ae2c84ec654f35825593513403fb146 · Span JSON: `turn_trace.json` (captured post-dispatch)

## Verdict
✅ **PASS (fire-side)** — `continue_delegate(mode=normal)` registered + scheduled + traceparent-emitted on deployed `077b261dd820d16a2667369e3006c4efdd6b0ef0` from ronan-seat. Return-side + Tempo fold-in on dispatch.

## DISPATCH-SIDE CONFIRMED (full-PASS)
- **spawn**: `17:15:10.188 [continuation:delegate-spawned] hop=1/200 mode=normal session=agent:main:discord:channel:1466192485440164011 task=R-CD-1 PROOF...`
- **return**: `17:15:19.044 R-CD-1 PROOF: continue_delegate normal-mode dispatch+return verified at 077b261dd8...` (~9s round-trip; subagent runtime 8s, tokens in=2/out=67)
- **Tempo trace**: `6ae2c84ec654f35825593513403fb146` captured (turn_trace.json, 70KB; resource host.name=ronan host.arch=arm64 pid=470616 = deployed seat)
- ✅ **FULL PASS** — normal-mode dispatch→spawn→normal-announce return verified end-to-end on deployed 077b261dd8.
