# R-CD-CHAINED-DEPTH-2 — depth-2 delegate chain with depth-1 post-leaf return (cael-dgx)

Issue: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/215  
Method lock: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/215#issuecomment-4883600973  
Candidate SHA: `bca2b0b89ab886bf23a10e4983926f6b374b3188`  
Build: `OpenClaw 2026.6.11 (bca2b0b)`  
Seat: Cael / `cael-dgx`  
Verdict: ✅ PASS — superseding rerun `RCD_CHAINED_DEPTH2_BCA2B0B_CAEL_20260704_1403` proves the missing depth-1 post-leaf return surface.

## Scope

The method lock requires a fresh live delegate chain:

1. root/main typed `continue_delegate(mode=silent-wake, fanoutMode=tree)` spawns depth-1 dispatcher;
2. depth-1 dispatcher typed `continue_delegate(mode=silent-wake, fanoutMode=tree)` spawns depth-2 leaf;
3. depth-2 leaf returns a unique sentinel;
4. depth-1 returns after seeing the depth-2 sentinel;
5. parent/root receives enough return/fanout byte to prove the depth-2 leaf result routed back through depth-1 to parent/root.

The first captured run `RCD_CHAINED_DEPTH2_BCA2B0B_CAEL_20260704_1245` proved depth reached but not the return surface. It is preserved in the original row receipts and `non-proof/`/old receipts. The later rerun `RCD_CHAINED_DEPTH2_BCA2B0B_CAEL_20260704_1403` was planned with a depth-1 `continue_work` wake fallback and proves the full method.

## Passing rerun: sentinels / sessions

- Rerun prefix: `RCD_CHAINED_DEPTH2_BCA2B0B_CAEL_20260704_1403`
- Depth-2 leaf sentinel: `RCD_CHAINED_DEPTH2_BCA2B0B_CAEL_20260704_1403_LEAF_REACHED`
- Depth-1 final sentinel: `RCD_CHAINED_DEPTH2_BCA2B0B_CAEL_20260704_1403_DEPTH1_SAW_LEAF_AND_RETURNED`
- Root/main session: `agent:main:discord:channel:1466192485440164011`
- Depth-1 session: `agent:main:subagent:continuation-da93564939a220c4c9b2c91518a429da`
- Depth-2 session: `agent:main:subagent:continuation-10a07b0e2f691340cdf0c14924294a95`
- Depth-2 session id/run id from leaf: `84f84bd4-156e-462e-a0cc-161dfc63ab20`
- Shared trace id: `50bc5319a8b0f6afed56282aeddb5950`

Passing rerun receipts live under:

```text
rerun-1403-pass/
```

## What passed in rerun 1403

### Root -> depth-1 delegate edge

`rerun-1403-pass/db/flow-rows-concise.json` records the root/main delegate flow:

- flow id: `499e768e-cfc1-461a-a2db-a92782e4cb59`
- owner: `agent:main:discord:channel:1466192485440164011`
- controller: `core/continuation-delegate`
- status: `succeeded`
- `delayMs: 0`
- `fanoutMode: "tree"`
- child session: `agent:main:subagent:continuation-da93564939a220c4c9b2c91518a429da`
- traceparent: `00-50bc5319a8b0f6afed56282aeddb5950-739e2ee3afd998f5-01`

`rerun-1403-pass/db/task-rows-concise.json` records the depth-1 task:

- source/run id: `continuation-delegate-da93564939a220c4c9b2c91518a429da`
- requester: `agent:main:discord:channel:1466192485440164011`
- child session: `agent:main:subagent:continuation-da93564939a220c4c9b2c91518a429da`
- status: `succeeded`
- delivery status: `delivered`

### Depth-1 -> depth-2 delegate edge

Depth-1 transcript `rerun-1403-pass/sessions/depth1-session.jsonl` records a typed `continue_delegate` call with:

```json
{
  "delaySeconds": 0,
  "mode": "silent-wake",
  "fanoutMode": "tree"
}
```

The depth-1 schedule receipt was:

```text
continue_delegate.status=scheduled
mode=silent-wake
delaySeconds=0
delegateIndex=1
delegatesThisTurn=1
fanoutMode=tree
```

`rerun-1403-pass/db/flow-rows-concise.json` records the depth-1 child delegate flow:

- flow id: `cbb307e9-8291-426c-bfa3-ebddf3c1a956`
- owner: `agent:main:subagent:continuation-da93564939a220c4c9b2c91518a429da`
- controller: `core/continuation-delegate`
- status: `succeeded`
- `delayMs: 0`
- `fanoutMode: "tree"`
- child session: `agent:main:subagent:continuation-10a07b0e2f691340cdf0c14924294a95`

### Depth-2 leaf reached

`rerun-1403-pass/sessions/depth2-leaf-session.jsonl` records the depth-2 response:

```text
RCD_CHAINED_DEPTH2_BCA2B0B_CAEL_20260704_1403_LEAF_REACHED session=agent:main:subagent:continuation-10a07b0e2f691340cdf0c14924294a95 sessionId=84f84bd4-156e-462e-a0cc-161dfc63ab20
```

`rerun-1403-pass/db/task-rows-concise.json` records the leaf task:

- source/run id: `continuation-delegate-10a07b0e2f691340cdf0c14924294a95`
- requester: `agent:main:subagent:continuation-da93564939a220c4c9b2c91518a429da`
- child session: `agent:main:subagent:continuation-10a07b0e2f691340cdf0c14924294a95`
- status: `succeeded`
- delivery status: `delivered`
- progress summary contains the depth-2 leaf sentinel.

### Depth-1 returned after seeing the leaf

The earlier partial attempt failed because depth-1 returned immediately after scheduling. The rerun explicitly avoided that by scheduling a same-session `continue_work` wake for depth-1 after the leaf schedule receipt:

- depth-1 continuation-work flow: `a697dc24-09b2-4275-8e38-eb581509f3d5`
- owner: `agent:main:subagent:continuation-da93564939a220c4c9b2c91518a429da`
- status: `succeeded`
- reason: `wake depth1 to verify depth2 leaf sentinel and return final proof sentinel`
- delivered/granted after the depth-2 leaf return.

Depth-1 then inspected its child and returned the final proof sentinel:

```text
RCD_CHAINED_DEPTH2_BCA2B0B_CAEL_20260704_1403_DEPTH1_SAW_LEAF_AND_RETURNED

prefix=RCD_CHAINED_DEPTH2_BCA2B0B_CAEL_20260704_1403
leaf_sentinel=RCD_CHAINED_DEPTH2_BCA2B0B_CAEL_20260704_1403_LEAF_REACHED
leaf_observed=true
child_runId=continuation-delegate-10a07b0e2f691340cdf0c14924294a95
child_sessionKey=agent:main:subagent:continuation-10a07b0e2f691340cdf0c14924294a95
child_sessionId=84f84bd4-156e-462e-a0cc-161dfc63ab20
verification_method=subagents.list_once_then_sessions_history_child
proof_status=final_success
```

This final response appears in `rerun-1403-pass/sessions/depth1-session.jsonl` after the continuation-work wake, and root/main observed the same final response in `rerun-1403-pass/main/root-observation.md`.

### Ordering bytes

Ordering from the journal and durable rows:

1. Depth-1 first turn emitted `WAITING_NOT_FINAL ... leaf_observed=false`.
2. Depth-1 spawned depth-2 at `14:03:36`.
3. Depth-2 returned leaf sentinel at `14:03:47`.
4. Depth-1 `continue_work` woke at `14:03:48`.
5. Depth-1 final response containing `DEPTH1_SAW_LEAF_AND_RETURNED` was produced in the wake turn and persisted in the depth-1 session transcript.

So the final depth-1 result happened after the depth-2 leaf result, satisfying the missing return surface.

## Tempo trace

Machine-readable Tempo JSON is saved at:

```text
rerun-1403-pass/tempo/trace-50bc5319a8b0f6afed56282aeddb5950.json
```

`rerun-1403-pass/tempo/trace-summary.json` preserves the span summary. The single trace ties the root delegate, depth-1 delegate, depth-2 run, and depth-1 `continue_work` wake through the same runtime traceparent.

## Preserved earlier partial attempt

The original `RCD_CHAINED_DEPTH2_BCA2B0B_CAEL_20260704_1245` receipts remain in the row directory. That attempt is still useful negative/partial evidence:

- it proved root→depth1 and depth1→depth2 typed delegate edges;
- it proved the depth-2 leaf reached;
- it did **not** prove depth-1 returned after seeing the depth-2 sentinel.

The rerun `1403` supersedes the row verdict because it closes exactly that missing surface.

## Supporting receipts

- `comment-4883600973.json` — method lock from docs#215.
- `rerun-1403-pass/evaluation.json` — machine-readable verdict flags.
- `rerun-1403-pass/runtime-version.txt` and `source/source-sha-status.txt` — build/source receipts.
- `rerun-1403-pass/db/flow-rows*.json` and schemas — durable flow rows.
- `rerun-1403-pass/db/task-rows*.json` and schemas — durable task rows.
- `rerun-1403-pass/sessions/depth1-session.jsonl` — depth-1 typed delegate, wait-not-final first turn, continuation-work wake, child history lookup, final proof sentinel.
- `rerun-1403-pass/sessions/depth2-leaf-session.jsonl` — depth-2 leaf sentinel.
- `rerun-1403-pass/journal/window.log` / `filtered.log` — delegate spawn, leaf return, depth-1 continuation-work wake.
- `rerun-1403-pass/main/root-observation.md` — bounded root/main observation of final depth-1 and depth-2 replies.
- `rerun-1403-pass/tempo/trace-50bc5319a8b0f6afed56282aeddb5950.json` and `trace-summary.json` — machine-readable Tempo receipt.
- original attempt receipts in the row root and `non-proof/` — preserved for audit history.

## Verdict

✅ PASS — rerun `RCD_CHAINED_DEPTH2_BCA2B0B_CAEL_20260704_1403` proves the full depth-2 chain on deployed `OpenClaw 2026.6.11 (bca2b0b)`: root spawned depth-1, depth-1 spawned depth-2 with typed `continue_delegate`, depth-2 returned the leaf sentinel, depth-1 woke after the leaf and returned a final sentinel containing the observed leaf result, and root/main observed that depth-1 final response. Durable flow/task rows, transcripts, journal receipts, and Tempo JSON are preserved.
