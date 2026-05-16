# Chain-3-RETRY — PASS in isolated-fire turn (ordering-classification CONFIRMED at byte)

**Seat**: ronan (spark-ecdf, 10.0.0.246)
**CANDIDATE_SHA**: e90a87015479d7a7ff6ae73deda9a84f1a448418
**Binary**: OpenClaw 2026.5.17 (e90a870)
**Fire timestamp**: 2026-05-16 ~11:29 PDT
**Mode**: silent (depth-1) + depth-2 echo+cross-channel
**delaySeconds**: 3
**Fire-isolation**: own turn, `delegatesThisTurn=1`, no R-CD-3 in scope, no other concurrent fan-out

## Tool fire (depth-1)

```json
{
  "status": "scheduled",
  "mode": "silent",
  "delaySeconds": 3,
  "delegateIndex": 1,
  "delegatesThisTurn": 1,
  "traceparent": "00-e64b07e20d9b1b638ad176c28f441a10-4d0968b45a144e5b-01"
}
```

## Journal evidence (gateway log)

```
11:29:33 [continuation:delegate-spawned] Tool delegate turn 9/200: Chain-3-RETRY proof fire (depth-1)
11:29:49 Chain-3-RETRY depth-1 complete (depth-2 scheduled, evidence written)
11:29:49 [continuation:delegate-spawned] hop=1/200 mode=silent (depth-2 child)
11:29:55 [tools] message failed: Ambiguous Discord recipient "1473320126433464465" (depth-2 child first attempt)
11:30:01 ✅ Discord message sent to channel 1473320126433464465 (msg id 1505276137943859311)
11:30:01 ✅ Payload file written to depth-2-payload.txt
11:30:01 Chain-3-RETRY depth-2 echo+cross-channel test OK
```

## Cross-channel echo proof

Depth-2 leaf successfully posted to discord `#1473320126433464465` (heartbeat channel) — message id `1505276137943859311`. Text: `R-CD-CHAINED-DEPTH-2 Chain-3-retry depth-2 echo+cross-channel OK ronan`.

(Self-correction note: depth-2 leaf hit `Ambiguous Discord recipient` on first attempt because target was passed as bare `1473320126433464465`; correct prefix `channel:1473320126433464465` per discord-tool documentation. Recovered and sent successfully. Not a Chain-3 path failure — depth-2 leaf's own self-recovery from a tool-input error.)

## Depth-1 EVIDENCE

See `depth-1-EVIDENCE.json` — captures depth-2 traceparent + depth-2 schedule response + echo_channel_target.

## Verdict at byte

✅ **Chain-3 PASSES in isolated-fire turn.**

depth-1 spawned, depth-2 child spawned, depth-2 leaf posted cross-channel echo to heartbeat + wrote payload file.

## Ordering-classification CONFIRMED at byte (combined with Chain-2-RETRY)

Original Chain-2/Chain-3 fires (in 7-in-1-turn fan-out at 11:08:30) were forbidden by `activeChildren=5 >= maxChildren=5` gate in `src/agents/subagent-spawn.ts:813-820`. Both Chain-2-RETRY (11:22) and Chain-3-RETRY (11:29) in isolated turns at `activeChildren=0` fire-window pass clean end-to-end.

**Final classification verified across both retries**: ordering condition (per-session `maxChildrenPerAgent=5` saturation in 7-in-1-turn batch), NOT regression, NOT environmental. Source-files byte-identical PR-head → CANDIDATE_SHA per 🌿's `1505272930`.
