# R-CW-DELEGATE-SELF-CONTINUATION — parent delegate + child self-continuation (cael-dgx)

Issue: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/222
Candidate SHA: `bca2b0b89ab886bf23a10e4983926f6b374b3188`
Seat: Cael / `cael-dgx`
Build: `OpenClaw 2026.6.11 (bca2b0b)`
Sentinel: `R-CW-DELEGATE-SELF-CONTINUATION-BCA2B0B-CAEL-20260704-1107`
Verdict: ✅ PASS for functional continuation behavior, with a tracked provenance anomaly filed as `karmaterminal/openclaw#1162`.

## What this row tests

A parent session fires typed `continue_delegate(mode="silent-wake", fanoutMode="tree")`. The delegate child runs, schedules its own `continue_work(delaySeconds=5)`, receives the same-child continuation wake, and returns a final sentinel/metadata result to the parent chain.

This is not a `continue_delegate`-from-subagent proof. It is a parent delegate spawn plus child self-continuation proof.

## Parent fire receipt

`delegate-tool-receipt.json`:

```json
{
  "status": "scheduled",
  "mode": "silent-wake",
  "delaySeconds": 0,
  "delegateIndex": 1,
  "delegatesThisTurn": 1,
  "fanoutMode": "tree",
  "note": "Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."
}
```

The delegate flow row confirms dispatch into the child session:

```text
388235bb-c093-4236-b8cd-dfae8fc5f5ec  status=succeeded  controller_id=core/continuation-delegate  current_step="Accepted by continuation subagent"
childSessionKey="agent:main:subagent:continuation-65274026fc63c687439faeba7119aeba"
traceparent="00-d541625dba5c25046db540055076910f-16af4ed3ed0fe7f1-01"
```

## Child execution and self-continuation

`subagent-list-recent.json` shows the spawned child completed:

```json
{
  "runId": "continuation-delegate-65274026fc63c687439faeba7119aeba",
  "sessionKey": "agent:main:subagent:continuation-65274026fc63c687439faeba7119aeba",
  "status": "done",
  "pendingDescendants": 0,
  "runtimeMs": 21176
}
```

The child called `continue_work(delaySeconds=5)` and received a same-session continuation wake. `subagent-history-excerpt.md` records:

```text
[continuation:wake] Turn 1/200 ...
Origin run: continuation-delegate-65274026fc63c687439faeba7119aeba
Origin turn: fc154228-0f67-4b40-8937-b03105422048
Elected at: 2026-07-04T18:08:31.951Z
Due at: 2026-07-04T18:08:36.951Z
Overdue by: 5ms
Delivered at: 2026-07-04T18:08:36.956Z
Disposition: granted
Chain: 59f6022b-9913-4cee-889c-e9a904826f10 hop 1/200
Flow: 59f6022b-9913-4cee-889c-e9a904826f10
```

The continuation work flow row confirms durable success:

```text
59f6022b-9913-4cee-889c-e9a904826f10  status=succeeded  controller_id=core/continuation-work  current_step="Same-session continuation turn granted"
delayMs=5000
hop=1
maxChainLength=200
disposition="granted"
busySkipCount=0
```

## Child final result / targeted return

The child final answer included the requested sentinel and metadata:

```text
sentinel: R-CW-DELEGATE-SELF-CONTINUATION-BCA2B0B-CAEL-20260704-1107
observed child execution: subagent successfully scheduled `continue_work(delaySeconds=5)` and received the self-continuation wake; disposition `granted`, delivered 5ms overdue.
current session key visible: `agent:main:subagent:continuation-65274026fc63c687439faeba7119aeba`
chain/flow: `59f6022b-9913-4cee-889c-e9a904826f10`
hop: `1/200`
```

`journal-continuation-excerpt.log` records parent-targeted return:

```text
[continuation/delegate-dispatch] [continue_delegate] Consuming 1 tool delegate(s) for session agent:main:discord:channel:1466192485440164011
[continuation:delegate-spawned] hop=1/200 mode=silent-wake session=agent:main:discord:channel:1466192485440164011 task=R-CW-DELEGATE-SELF-CONTINUATION proof fire...
[continuation/work-dispatch] [continuation:work-wake] hop=1/200 session=agent:main:subagent:continuation-65274026fc63c687439faeba7119aeba reasonCategory=follow-up-work
[subagent-chain-hop] Accumulated 49363 tokens from agent:main:subagent:continuation-65274026fc63c687439faeba7119aeba to parent chain cost
[continuation:targeted-return] Delivered to agent:main:discord:channel:1466192485440164011 from agent:main:subagent:continuation-65274026fc63c687439faeba7119aeba
```

## Tempo traces

Machine-readable Tempo trace JSON is saved under `tempo/`. Candidate trace IDs:

```text
26bf7f041d0a770ef169fb954f3b5546
441b153dd1211614eab236fff2fd6f92
6e355cbe092521b91dca3cf594610b01
d541625dba5c25046db540055076910f
e30b1a36f4d666d8df8d4f90ad1c8b0c
```

Load-bearing span summaries:

```json
{"name":"openclaw.tool.execution","attrs":{"openclaw.toolName":"continue_delegate"}}
{"name":"openclaw.tool.execution","attrs":{"openclaw.toolName":"continue_work"}}
{"name":"continuation.work","attrs":{"delay.ms":"5000","chain.step.remaining":"199","reason.present":true,"reason.hash":"4b1da2c12b67505e"}}
{"name":"continuation.work.fire","attrs":{"chain.id":"59f6022b-9913-4cee-889c-e9a904826f10","chain.step.remaining":"199","delay.ms":"5000","fire.deferred_ms":"5004","reason.present":true,"reason.hash":"4b1da2c12b67505e"}}
{"name":"continuation.queue.drain","attrs":{"queue.drained_count":"1","queue.drained_continuation_count":"1"}}
```

## Aberration / runtime issue filed

One provenance/state anomaly was observed and filed as https://github.com/karmaterminal/openclaw/issues/1162.

The functional path succeeded, but the mirrored TaskFlow row for the child ended blocked:

```text
e10e611a-12db-4b2e-8f7f-f18d01110256  sync_mode=task_mirrored  status=blocked  blocked_summary="Required completion did not produce a final deliverable."
```

This conflicts with the child transcript/final answer containing the requested sentinel and metadata. The proof row is still functionally PASS, but the anomaly is preserved in:

- `flow-runs-matching-full.jsonl`
- `runtime-issue/runtime-issue-1162-body.md`
- `runtime-issue/openclaw-issue-1162.json`

## Supporting receipts

- `fire-plan.json` — row plan and sentinel.
- `delegate-tool-receipt.json` — parent tool result.
- `subagent-list-recent.json` — child session completion metadata.
- `subagent-history-excerpt.md` — child tool call, continuation wake, and final sentinel result.
- `flow-runs-matching.tsv` / `flow-runs-matching-full.jsonl` — delegate, mirrored child, and continuation-work rows.
- `journal-continuation-excerpt.log` — spawn, child wake, accumulated tokens, targeted return.
- `tempo/trace-*.json` and summaries — machine-readable Tempo receipts.
- `runtime-issue/` — filed anomaly #1162.
- `source/source-sha.txt` and `source/source-commit.txt` — exact candidate SHA receipts.

## Honest scope

✅ Proves parent `continue_delegate(mode="silent-wake", fanoutMode="tree")` spawned a continuation child.

✅ Proves the child scheduled `continue_work(delaySeconds=5)`, received a same-session wake at hop `1/200`, and returned the requested sentinel/metadata.

✅ Proves gateway delivered targeted return to the parent chain and accumulated child tokens.

⚠️ Preserves provenance anomaly #1162: mirrored TaskFlow child row blocked despite final deliverable. This row does not claim that TaskFlow mirror status is correct.

❌ Does not prove child-visible traceparent propagation; the proof uses gateway/Tempo receipts, flow rows, and subagent transcript instead.

## Verdict

✅ PASS for functional delegate self-continuation behavior on deployed `OpenClaw 2026.6.11 (bca2b0b)`, with anomaly #1162 filed and linked.
