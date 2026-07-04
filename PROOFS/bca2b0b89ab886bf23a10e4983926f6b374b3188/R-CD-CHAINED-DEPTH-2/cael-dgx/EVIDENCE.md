# R-CD-CHAINED-DEPTH-2 — depth-2 delegate chain with return-surface gap (cael-dgx)

Issue: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/215  
Method lock: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/215#issuecomment-4883600973  
Candidate SHA: `bca2b0b89ab886bf23a10e4983926f6b374b3188`  
Build: `OpenClaw 2026.6.11 (bca2b0b)`  
Seat: Cael / `cael-dgx`  
Verdict: ⚠️ PARTIAL — depth-2 reach proven; required return-through-depth-1/root-wake surface not proven.

## Scope

The method lock requires a fresh live delegate chain:

1. root/main typed `continue_delegate(mode=silent-wake, fanoutMode=tree)` spawns depth-1 dispatcher;
2. depth-1 dispatcher typed `continue_delegate(mode=silent-wake, fanoutMode=tree)` spawns depth-2 leaf;
3. depth-2 leaf returns unique sentinel;
4. depth-1 returns after seeing the depth-2 sentinel;
5. parent/root receives enough return/fanout byte to prove the depth-2 leaf result routed back through depth-1 to parent/root.

This run proves steps 1–3 and the durable/trace mapping for both delegate edges. It does **not** prove steps 4–5: the depth-1 dispatcher returned a waiting/scheduled message before the depth-2 leaf completed, and root/main did not receive a post-leaf wake/result surface with the leaf sentinel.

## Sentinels / sessions

- Sentinel prefix: `RCD_CHAINED_DEPTH2_BCA2B0B_CAEL_20260704_1245`
- Depth-2 leaf sentinel: `RCD_CHAINED_DEPTH2_BCA2B0B_CAEL_20260704_1245_LEAF_REACHED`
- Depth-1 session: `agent:main:subagent:continuation-c3fc07a37b4995fa003634edab8aaaf0`
- Depth-2 session: `agent:main:subagent:continuation-d571a5f0013f50a822605e3ea7010631`

## What passed

### Root -> depth-1 delegate edge

`db/flow-rows-full.pretty.json` records the root/main delegate flow:

- flow id: `05ffffb7-2b9c-4d8e-a74e-6c09d8209069`
- owner: `agent:main:discord:channel:1466192485440164011`
- status: `succeeded`
- `fanoutMode: "tree"`
- traceparent: `00-549a10a8592e384a0e53f407e2d5556b-2828d0b828ddbcf8-01`
- child session: `agent:main:subagent:continuation-c3fc07a37b4995fa003634edab8aaaf0`

`db/task-rows.json` records the depth-1 subagent task:

- task id: `a1864699-3a53-4f55-a759-19128ac4dfd6`
- source/run id: `continuation-delegate-c3fc07a37b4995fa003634edab8aaaf0`
- status: `succeeded`
- delivery status: `delivered`
- child sessions include the depth-2 session (also visible in `subagents` output captured in the live session context).

### Depth-1 -> depth-2 delegate edge

The depth-1 transcript `sessions/depth1-dispatcher-session.jsonl` records a typed `continue_delegate` tool call and successful scheduling result. Its readable excerpt (`sessions/depth1-readable.tsv`) includes:

```text
RCD_CHAINED_DEPTH2_BCA2B0B_CAEL_20260704_1245
DEPTH1_DISPATCHER_WAITING_FOR_LEAF_RESULT
typed continue_delegate(mode=silent-wake, fanoutMode=tree) scheduled exactly once.
```

`db/flow-rows-full.pretty.json` records the depth-1 child delegate flow:

- flow id: `4d04b051-96d7-4e54-ab8f-9abdfbf936e2`
- owner: `agent:main:subagent:continuation-c3fc07a37b4995fa003634edab8aaaf0`
- status: `succeeded`
- `fanoutMode: "tree"`
- child session: `agent:main:subagent:continuation-d571a5f0013f50a822605e3ea7010631`

`db/task-rows.json` records the depth-2 task:

- task id: `70650c44-71ec-403e-aef6-7c21af501293`
- source/run id: `continuation-delegate-d571a5f0013f50a822605e3ea7010631`
- requester: `agent:main:subagent:continuation-c3fc07a37b4995fa003634edab8aaaf0`
- child session: `agent:main:subagent:continuation-d571a5f0013f50a822605e3ea7010631`
- status: `succeeded`
- delivery status: `delivered`
- progress summary contains the depth-2 leaf sentinel.

### Depth-2 leaf reached

`sessions/depth2-leaf-session.jsonl` records the leaf task and response. The response contains:

```text
RCD_CHAINED_DEPTH2_BCA2B0B_CAEL_20260704_1245_LEAF_REACHED
session: agent:main:subagent:continuation-d571a5f0013f50a822605e3ea7010631
```

The gateway journal excerpt `journal/delegate-chain-filtered.log` also records:

```text
RCD_CHAINED_DEPTH2_BCA2B0B_CAEL_20260704_1245_LEAF_REACHED
session: agent:main:subagent:continuation-d571a5f0013f50a822605e3ea7010631
```

### Tempo trace

Tempo trace JSON is saved at:

```text
tempo/trace-549a10a8592e384a0e53f407e2d5556b.json
```

`tempo/trace-summary.json` contains:

- 26 spans total
- `continuation.delegate.dispatch`: 2
- `openclaw.harness.run`: 3
- `openclaw.run`: 3
- `openclaw.tool.execution`: 4
- `continuation.queue.fanout`: 1
- `continuation.queue.drain`: 1

The important span summary shows:

- root `openclaw.tool.execution` for `continue_delegate`;
- first `continuation.delegate.dispatch` with `delegate.mode=silent-wake`, `delegate.delivery=immediate`;
- depth-1 `openclaw.harness.run` / `openclaw.run`;
- depth-1 `openclaw.tool.execution` for `continue_delegate`;
- second `continuation.delegate.dispatch` with `delegate.mode=silent-wake`, `delegate.delivery=immediate`;
- depth-2 `openclaw.harness.run` / `openclaw.run`;
- `continuation.queue.fanout` and `continuation.queue.drain`.

## What did not pass

The method lock requires: “The depth-1 dispatcher returns after seeing the depth-2 sentinel; the parent/root should receive enough return/fanout byte to prove the depth-2 leaf was reached through the depth-1 child, not directly from root.”

This run does not meet that bar.

Observed gap:

- depth-1 returned `DEPTH1_DISPATCHER_WAITING_FOR_LEAF_RESULT` before the leaf completed;
- journal shows `[continuation:targeted-return] Delivered to agent:main:discord:channel:1466192485440164011 from agent:main:subagent:continuation-c3fc07a37b4995fa003634edab8aaaf0` at `12:45:44`, before the depth-2 leaf sentinel at `12:45:47`;
- no later journal return line shows the depth-2 leaf sentinel routed back to root/main;
- root/main did not wake/surface with the leaf sentinel after the leaf completed.

`evaluation.json` records the resulting truth table:

```json
{
  "rootToDepth1FlowSucceeded": true,
  "depth1TypedContinueDelegateObserved": true,
  "depth1ToDepth2FlowSucceeded": true,
  "depth2LeafSentinelObserved": true,
  "depth1ReturnedAfterSeeingLeaf": false,
  "rootReceivedLeafResult": false,
  "rootWakeAfterLeaf": false,
  "depth1ReturnSurface": "DEPTH1_DISPATCHER_WAITING_FOR_LEAF_RESULT",
  "targetReturnBeforeLeafCompletion": true
}
```

## Excluded/non-proof rerun

I attempted a cleaner rerun with depth-1 instructed to use `continue_delegate(mode=normal, fanoutMode=tree)` so the depth-1 child could observe a visible depth-2 result before returning. That rerun is preserved under `non-proof/` and is not counted:

- flow: `de60d463-1eb5-45eb-81c6-7587407d243d`
- status: `failed`
- current step: `Delegate spawn failed`
- blocked summary: `Tool delegate rejected: cost-capped.`
- journal: `Chain cost 1352109/500000 — capped`

This is excluded because no child spawned.

## Verdict

⚠️ PARTIAL. The live chain reached depth 2 through the depth-1 child with two successful typed `continue_delegate` edges, durable flow/task rows, session transcripts, journal bytes, and Tempo spans. The required return surface did **not** complete: depth-1 did not return after seeing the depth-2 sentinel, and root/main did not receive a post-leaf wake/result with the sentinel. This should not be counted as PASS for `R-CD-CHAINED-DEPTH-2` until a clean run proves the return-through-depth-1/root surface.
