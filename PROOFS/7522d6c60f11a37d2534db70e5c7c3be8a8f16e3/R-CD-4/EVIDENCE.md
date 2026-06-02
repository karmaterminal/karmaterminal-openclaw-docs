# R-CD-4 EVIDENCE — `continue_delegate(targetSessionKey)` cross-session-routed

**Row**: R-CD-4 — cross-session targeted return via `targetSessionKey`
**Owner**: 🌊 Ronan (undertow-seat)
**CANDIDATE_SHA**: `7522d6c60f11a37d2534db70e5c7c3be8a8f16e3`
**Seat**: ronan-undertow (spark-ecdf, 10.0.0.246)
**Gateway version**: `OpenClaw 2026.5.31 (7522d6c)`

## Fire
- **fire_utc**: 2026-06-02T01:37:00Z
- **mode**: normal (with explicit `targetSessionKey`)
- **targetSessionKey**: `agent:main:discord:channel:1466192485440164011`
- **fire_response**: `{"status":"scheduled","mode":"normal","delaySeconds":0,"targetSessionKey":"agent:main:discord:channel:1466192485440164011"}` — `targetSessionKey` echoed in response (the distinguishing field vs R-CD-1)

## Return (cross-session routing verified)
- **return_utc**: 2026-06-02T01:37:47Z
- **delegate_session_key**: `agent:main:subagent:9a9c161d-0501-41ca-891b-d39e9f198a33`
- **delegate_session_id**: `b3831fe6-2eaa-4f18-8bfc-e2da963fb80e`
- **runtime**: 5s
- **tokens**: in=6, out=154
- **hop**: 11/200
- **payload routed to**: `agent:main:discord:channel:1466192485440164011` (matches `targetSessionKey`)

## Key behavior verified
- **`targetSessionKey` in fire-response**: gateway accepted explicit cross-session target and echoed it
- **Return-event payload contains target session-key**: confirms routing logic landed payload at named target session, not default routing
- **Hop counter increments**: 11/200 — same chain-tracking semantic as normal mode

## Tempo trace
**Status**: ⚠️ NOT CAPTURED (same as R-CD-1/2/3 — observability stack down, related to `#854`). Journal evidence substitutes.

## Verdict
✅ **PASS** — `continue_delegate({targetSessionKey: ...})` from undertow-seat at CANDIDATE_SHA `7522d6c60f` schedules + spawns + returns to explicitly named target session. Cure-bytes do not regress the cross-session-routing path.
