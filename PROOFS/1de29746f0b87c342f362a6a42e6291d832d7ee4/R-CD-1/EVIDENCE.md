# R-CD-1 EVIDENCE — `continue_delegate(normal-mode)` round-trip

**Row**: R-CD-1 — `continue_delegate()` schedule → spawn → return (normal mode, channel-announce)
**Owner**: 🌊 Ronan (undertow-seat)
**CANDIDATE_SHA**: `1de29746f0b87c342f362a6a42e6291d832d7ee4` (uncurse-tip post-PR #870 comment-scrub merge)
**Seat**: ronan-undertow (spark-ecdf, 10.0.0.246, DGX Spark, 128GB unified)
**Gateway version**: `OpenClaw 2026.5.31 (1de2974)` (confirmed `openclaw --version` post-deploy 26816100078)

## Fire
- **fire_utc**: 2026-06-02T11:20:27Z (parent turn dispatch)
- **mode**: normal
- **delaySeconds**: 5
- **delegateIndex**: 1, delegatesThisTurn: 1
- **parent_session_key**: `agent:main:discord:channel:1466192485440164011`
- **fire_response**: see `fire_response.json`

## Spawn (journal evidence — `journal_continuation.log`)
```
04:20:32.354 [continuation/delegate-dispatch] [continue_delegate] Consuming 1 tool delegate(s)
04:20:32.669 [continuation/delegate-dispatch] [continuation:delegate-spawned] hop=8/200 mode=normal task=[PROOF R-CD-1 / 1de29746f0] ...
```

## Return
- **return_utc**: 2026-06-02T11:20:35Z
- **delegate_session_key**: `agent:main:subagent:a6eb7a48-4441-4d63-a707-54d65800a7e8`
- **delegate_session_id / traceId**: `b928374b-e103-4091-b4cf-ecaddbd947b1`
- **runId**: `29687b98-29b2-4548-9e63-d8a298739604`
- **runtime**: 2s (1620ms wall)
- **tokens**: in=6, out=88, total=94 / prompt_cache=34.4k
- **round_trip_total**: ~8s (fire-to-return-event)
- **payload** (see `delegate_return_payload.txt`):
  ```
  R-CD-1 PROOF: continue_delegate basic spawn-and-return path verified at CANDIDATE_SHA 1de29746f0b87c342f362a6a42e6291d832d7ee4 from undertow-seat 2026-06-02
  ```

## Chain-cost accounting (journal evidence)
```
04:20:35.275 [subagent-chain-hop] Accumulated 94 tokens from agent:main:subagent:a6eb7a48-... to parent chain cost
```
Chain depth from spawn: `hop=8/200` (within 200-hop chain-tracking limit per gateway config).

## Tempo trace
**Status**: ⚠️ NOT YET CAPTURED in this evidence-pass — fetching via `http://tempo.dandelion.cult/api/traces/b928374b-e103-4091-b4cf-ecaddbd947b1` will be filed as `turn_trace.json` in a follow-up commit. Trace-ID derived from the openclaw-trajectory header on the subagent jsonl (`traceId: b928374b-e103-4091-b4cf-ecaddbd947b1`).

**Substitution-pending**: journal `[continuation:delegate-spawned]` + `[subagent-chain-hop]` lines provide functionally-equivalent parent-child-stitching evidence (session-key matches between spawn + return, chain-cost accounting confirms parent received child tokens). Trace fold-in pending observability fetch.

## Verdict
✅ **PASS** — `continue_delegate(mode=normal)` from undertow-seat at CANDIDATE_SHA `1de29746f0` schedules + spawns + returns clean. Behavior matches prior cycle baseline (7522d6c60f). PR #870 comment-scrub delta does not regress the continuation-tool surface.
