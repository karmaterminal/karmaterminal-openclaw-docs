# Chain-2-RETRY — PASS in isolated-fire turn (ordering-classification CONFIRMED at byte)

**Seat**: ronan (spark-ecdf, 10.0.0.246)
**CANDIDATE_SHA**: e90a87015479d7a7ff6ae73deda9a84f1a448418
**Binary**: OpenClaw 2026.5.17 (e90a870)
**Fire timestamp**: 2026-05-16 ~11:22 PDT
**Mode**: silent
**delaySeconds**: 3
**targetSessionKey**: agent:main:discord:channel:1473320126433464465 (heartbeat — cross-session)
**Fire-isolation**: own turn, `delegatesThisTurn=1`, no R-CD-3 in scope, no other concurrent fan-out

## Tool fire (depth-1)

```json
{
  "status": "scheduled",
  "mode": "silent",
  "delaySeconds": 3,
  "delegateIndex": 1,
  "delegatesThisTurn": 1,
  "targetSessionKey": "agent:main:discord:channel:1473320126433464465",
  "traceparent": "00-69586b47ef094d9a3bd6e17b5cc28b10-81dea7604b5082cf-01"
}
```

## Journal evidence (gateway log)

```
11:23:00.790 [continue_delegate] Consuming 1 tool delegate(s) for session sprites
11:23:01.835 (subagent spawned)
11:23:25.674 [continue_delegate] Consuming 1 tool delegate(s) for session subagent:4283a673
11:23:25      Depth-2 child fired: continue_delegate scheduled (delaySeconds=3, mode=silent), traceparent 00-69586b47...69c3893824f5e092-01
11:23:26.040 [continuation:delegate-spawned] hop=1/200 mode=silent
11:23:33.837 [continuation:enrichment-return] Delivered to subagent:4283a673 from subagent:1c3af25d
11:23:34.761 [continuation:targeted-return] Delivered to agent:main:discord:channel:1473320126433464465 from subagent:4283a673
```

## Depth-2 payload (written by depth-2 leaf child)

```
$ cat /tmp/proofs-ronan/R-CD-CHAINED-DEPTH-2/Chain-2-RETRY/depth-2-payload.txt
R-CD-CHAINED-DEPTH-2 Chain-2-retry depth-2 OK inter-session
```

## Depth-1 EVIDENCE (written by depth-1 child)

See `depth-1-EVIDENCE.json` — captures depth-2 traceparent + depth-2 schedule response + dispatching/return-target session metadata.

## Verdict at byte

✅ **Chain-2 PASSES in isolated-fire turn.**

depth-1 spawned, depth-2 child spawned, depth-2 leaf wrote payload, inter-session targeted-return Delivered to heartbeat session per `[continuation:targeted-return]` log line at 11:23:34.

## Ordering-classification CONFIRMED at byte

Original Chain-2 fire (in 7-in-1-turn fan-out at 11:08:30) was forbidden because `activeChildren=5 >= maxChildren=5` in `src/agents/subagent-spawn.ts:813-820`. Chain-2-RETRY in isolated turn at activeChildren=0 fire-window passes clean end-to-end.

**Classification verified**: ordering condition (per-session `maxChildrenPerAgent=5` saturation in 7-in-1-turn batch), NOT regression, NOT environmental. Source-files byte-identical PR-head → CANDIDATE_SHA per 🌿's `1505272930`.
