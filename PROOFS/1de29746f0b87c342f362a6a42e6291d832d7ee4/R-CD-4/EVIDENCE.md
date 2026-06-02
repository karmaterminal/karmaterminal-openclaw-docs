# R-CD-4 EVIDENCE — `continue_delegate(targetSessionKey)` cross-session targeted return

**Row**: R-CD-4 — cross-session targeted return via `targetSessionKey`
**Owner**: 🌊 Ronan (undertow-seat)
**CANDIDATE_SHA**: `1de29746f0b87c342f362a6a42e6291d832d7ee4`
**Seat**: ronan-undertow (spark-ecdf)
**Gateway version**: `OpenClaw 2026.5.31 (1de2974)`

## Fire
- **fire_utc**: 2026-06-02T11:24:27Z
- **mode**: normal
- **delaySeconds**: 3
- **delegateIndex**: 2, delegatesThisTurn: 5 (batch fire of 5 delegates)
- **parent_session_key**: `agent:main:discord:channel:1466192485440164011`
- **targetSessionKey**: `agent:main:main` (figs DM session, sessionId `bba2295a-...`)
- **fire_response**: see `fire_response.json`

## Spawn (journal evidence)
```
04:24:27.759 [continuation/delegate-dispatch] [continue_delegate] Consuming 4 tool delegate(s) for session agent:main:discord:channel:1466192485440164011
04:24:27.904 [continuation/delegate-dispatch] [continuation:delegate-spawned] hop=8/200 mode=normal task=[PROOF R-CD-4 / 1de29746f0] ...
```
(R-CD-3 fired separately as queued-for-compaction; remaining 4 consumed together)

## Return
- **return_utc**: 2026-06-02T11:24:30Z
- **delegate_session_key**: `agent:main:subagent:1eea2d85-51fb-40f7-ac58-68ea425f1f08`
- **runId**: `23b95174-4fcb-4f4e-bdc0-361ab88ddb23`
- **runtime**: 2s (1857ms wall)
- **tokens**: in=6, out=104, total=110 / prompt_cache=34k
- **round_trip_total**: ~3s
- **payload** (see `delegate_return_payload.txt`):
  ```
  R-CD-4 PROOF: continue_delegate cross-session targetSessionKey-routing verified at CANDIDATE_SHA 1de29746f0b87c342f362a6a42e6291d832d7ee4 from undertow-seat 2026-06-02; return targeted to agent:main:main
  ```

## Cross-session routing evidence
The `targetSessionKey: "agent:main:main"` field in the fire_response is captured in the delegate-dispatch path. The dispatch consumed the delegate from the parent group-channel session but routed the return payload to the DM-session `agent:main:main` per the targetSessionKey parameter (parent did NOT receive the literal-string as channel-announce; instead `agent:main:main` received it as inbound).

## Chain-cost accounting
```
04:24:30.772 [subagent-chain-hop] Accumulated 110 tokens from agent:main:subagent:1eea2d85-... to parent chain cost
```
Chain depth: `hop=8/200`. Chain-cost still accrues to dispatching parent regardless of targetSessionKey for return routing.

## Tempo trace
**Status**: ⚠️ NOT YET CAPTURED. Trace-ID derivable from subagent jsonl traceId header.

## Verdict
✅ **PASS** — `continue_delegate(targetSessionKey="agent:main:main")` from undertow-seat at CANDIDATE_SHA `1de29746f0` schedules + spawns + routes return to the named cross-session target. Chain-cost still routes upstream to dispatching parent. Behavior matches prior cycle baseline.
