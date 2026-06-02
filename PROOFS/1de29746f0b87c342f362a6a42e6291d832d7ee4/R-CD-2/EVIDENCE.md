# R-CD-2 EVIDENCE — `continue_delegate(silent-wake)` full-path

**Row**: R-CD-2 — `continue_delegate(mode="silent-wake")` schedule → spawn → silent return → parent wake
**Owner**: 🌊 Ronan (undertow-seat)
**CANDIDATE_SHA**: `1de29746f0b87c342f362a6a42e6291d832d7ee4`
**Seat**: ronan-undertow (spark-ecdf)
**Gateway version**: `OpenClaw 2026.5.31 (1de2974)`

## Fire
- **fire_utc**: 2026-06-02T11:20:27Z
- **mode**: silent-wake
- **delaySeconds**: 8
- **delegateIndex**: 2, delegatesThisTurn: 2
- **parent_session_key**: `agent:main:discord:channel:1466192485440164011`
- **fire_response**: see `fire_response.json`

## Spawn (journal evidence)
```
04:20:35.352 [continuation/delegate-dispatch] [continue_delegate] Consuming 1 tool delegate(s)
04:20:35.517 [continuation/delegate-dispatch] [continuation:delegate-spawned] hop=8/200 mode=silent-wake task=[PROOF R-CD-2 / 1de29746f0] ...
```

## Return + silent enrichment (journal evidence)
- **return_utc**: 2026-06-02T11:20:37Z
- **delegate_session_key**: `agent:main:subagent:07ba5f63-87dc-4e09-aacf-8b348c9c5943`
- **runId**: `e4d31c59-a3b5-4546-b184-076980975dd3`
- **runtime**: 2s (1620ms wall)
- **tokens**: in=6, out=84, total=90 / prompt_cache=34.4k
- **payload** (see `delegate_return_payload.txt`):
  ```
  R-CD-2 PROOF: continue_delegate silent-wake path verified at CANDIDATE_SHA 1de29746f0b87c342f362a6a42e6291d832d7ee4 from undertow-seat 2026-06-02
  ```

## Critical silent-wake distinguishing log line
```
04:20:37.831 [continuation/announce] [continuation:enrichment-return] Delivered to agent:main:discord:channel:1466192485440164011 from agent:main:subagent:07ba5f63-...
```
This `enrichment-return` line is the canonical silent-wake signature: payload delivered as internal context (no discord visible post), triggering parent-turn-fire for synthesis. Contrast normal-mode (R-CD-1) where payload announces to channel.

## Chain-cost accounting
```
04:20:37.828 [subagent-chain-hop] Accumulated 90 tokens from agent:main:subagent:07ba5f63-... to parent chain cost
```
Chain depth: `hop=8/200`.

## Tempo trace
**Status**: ⚠️ NOT YET CAPTURED. Trace-ID derivable from subagent jsonl traceId header (parallel to R-CD-1 shape). Fold-in pending.

## Verdict
✅ **PASS** — `continue_delegate(mode=silent-wake)` from undertow-seat at CANDIDATE_SHA `1de29746f0` schedules + spawns + returns silently AND triggers parent wake (verified by post-yield parent-turn observation; this EVIDENCE.md was authored in the wake-triggered turn). Behavior matches prior cycle baseline.
