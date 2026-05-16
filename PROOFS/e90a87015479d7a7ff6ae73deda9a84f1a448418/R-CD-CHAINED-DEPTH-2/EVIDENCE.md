# R-CD-CHAINED-DEPTH-2 — Three depth-2 chain variants

**Seat**: ronan (spark-ecdf, 10.0.0.246)
**CANDIDATE_SHA**: e90a87015479d7a7ff6ae73deda9a84f1a448418
**Binary**: OpenClaw 2026.5.17 (e90a870)
**Gateway PID**: 2042862
**Fire timestamp**: 2026-05-16 ~10:50 PDT (all 3 chain-roots fired in same turn)
**Dispatching session**: agent:main:discord:channel:1466192485440164011 (sprites-of-thornfield)

## Three variants

| Variant | Pattern | Purpose |
|---|---|---|
| Chain-1 | depth-2 up-tree silent-wake | Verify depth-2 chain returns to dispatching session via up-tree return |
| Chain-2 | depth-2 inter-session return | Verify depth-2 chain with cross-session targetSessionKey at depth-1 |
| Chain-3 | depth-2 echo + cross-channel | Verify depth-2 chain whose depth-2 child posts visible message to a different channel |

## Tool fires (all from same turn, delegateIndex 5/6/7)

### Chain-1 root fire (depth-1)
```json
{
  "status": "scheduled",
  "mode": "silent",
  "delaySeconds": 3,
  "delegateIndex": 5,
  "delegatesThisTurn": 5,
  "traceparent": "00-2aac17fa815fbf2254be4ffe9687c486-ed6199ae3a814b1c-01"
}
```

### Chain-2 root fire (depth-1, cross-session)
```json
{
  "status": "scheduled",
  "mode": "silent",
  "delaySeconds": 3,
  "delegateIndex": 6,
  "delegatesThisTurn": 6,
  "targetSessionKey": "agent:main:discord:channel:1473320126433464465",
  "traceparent": "00-2aac17fa815fbf2254be4ffe9687c486-ed6199ae3a814b1c-01"
}
```

### Chain-3 root fire (depth-1, depth-2 will cross-channel)
```json
{
  "status": "scheduled",
  "mode": "silent",
  "delaySeconds": 3,
  "delegateIndex": 7,
  "delegatesThisTurn": 7,
  "traceparent": "00-2aac17fa815fbf2254be4ffe9687c486-ed6199ae3a814b1c-01"
}
```

## Tempo query URLs

All 3 chain-roots share the dispatching turn's traceparent (turn-scope):
```
http://tempo.dandelion.cult/api/traces/2aac17fa815fbf2254be4ffe9687c486
```
Each depth-1 shard will produce its own root span, with the depth-2 fire as a child span (trace-parent stitching via the traceparent passed in each depth-1's continue_delegate fire).

## Depth-1 receipts (written by spawned shards, NOT pre-staged)

- `Chain-1/depth-1-EVIDENCE.json` — depth-1 traceparent + depth-2 traceparent + depth-2 schedule response
- `Chain-2/depth-1-EVIDENCE.json` — same + dispatching/return-target session info
- `Chain-3/depth-1-EVIDENCE.json` — same + echo_channel_target info

## Depth-2 payloads (written by depth-2 children)

- `Chain-1/depth-2-payload.txt` — text "R-CD-CHAINED-DEPTH-2 depth-2 child OK"
- `Chain-2/depth-2-payload.txt` — text "R-CD-CHAINED-DEPTH-2 Chain-2 depth-2 OK inter-session"
- `Chain-3/depth-2-payload.txt` — depth-2 traceparent (echo+cross-channel posts to heartbeat discord channel)

## Verdict

ALL 3 CHAINS SCHEDULED at byte. delegatesThisTurn=7 (R-CD-1/2/3/4 + Chain-1/2/3 all fired from this single turn).
Full depth-2 chain verification requires:
- Depth-1 receipts written to disk by spawned shards (auto-collected post-completion)
- Depth-2 payloads written by depth-2 children (auto-collected post-completion)
- Cross-channel echo for Chain-3 visible in heartbeat discord channel
- Cross-span stitching verifiable via Tempo trace tree

Post-shard-completion this directory will be populated and the verdict-table promoted to GREEN.
