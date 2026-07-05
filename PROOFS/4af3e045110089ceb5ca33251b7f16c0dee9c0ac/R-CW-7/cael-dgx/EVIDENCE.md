# R-CW-7 — explicit traceparent row: public surface unavailable, runtime-context trace linkage observed (cael-dgx)

Issue: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/220  
Method packet: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/220#issuecomment-4883507771  
Candidate SHA: `bca2b0b89ab886bf23a10e4983926f6b374b3188`  
Seat: Cael / `cael-dgx`  
Build: `OpenClaw 2026.6.11 (bca2b0b)`  
Sentinel: `R-CW-7-BCA2B0B-CAEL-20260704-1209`  
Verdict: ⚠️ THIN / executed-invalid for the row as written

## Why this is THIN, not PASS

The docs#220 method packet asks the parent to call typed `continue_delegate(..., traceparent="00-bca2b0b89ab886bf23a10e4983926f6b-5eeda11d5eeda11d-01")` if the current tool surface exposes `traceparent`.

On deployed `bca2b0b`, the model-facing public tool surface does **not** expose `traceparent`. Source/schema receipts included in `schema/` show:

- `packages/gateway-protocol/src/schema/agent.ts` marks `traceparent` as an `internalProtocolField(...)`.
- `agent.schema.test.ts` asserts the public generated schema omits `traceparent`.
- `continuation-tools-registration.test.ts` pins the model-facing `continue_delegate` descriptor keys to exactly `task, delaySeconds, mode, targetSessionKey, targetSessionKeys, fanoutMode, model`.
- `continue-delegate-tool.test.ts` asserts diagnostic `traceparent` is not exposed as a model-facing parameter.

So the deterministic parent-supplied W3C traceparent requested by the row cannot be supplied through the public typed tool surface. That means this specimen cannot be called a PASS for “explicit parent-supplied traceparent.”

## What was executed

After the schema check, Cael fired an ordinary typed delegate to observe whether runtime-context trace propagation still works across the child session boundary:

```text
R-CW-7 proof fire for docs#220 / candidate bca2b0b89ab886bf23a10e4983926f6b374b3188.
Sentinel: R-CW-7-BCA2B0B-CAEL-20260704-1209.
Return exactly: sentinel, child session key if visible, and any visible traceparent/tool metadata. Do not call continue_work, do not emit continuation tokens, and do not spawn further children.
```

Tool receipt:

```json
{
  "status": "scheduled",
  "mode": "silent-wake",
  "delaySeconds": 0,
  "delegateIndex": 1,
  "delegatesThisTurn": 1,
  "fanoutMode": "tree"
}
```

## Durable flow row

`flow-runs-matching-full.jsonl` contains the matching delegate row:

```text
aef84e7c-6c88-4ccb-aeed-e2568082a9df  status=succeeded  kind=continuation_delegate  childSessionKey=agent:main:subagent:continuation-3cba348646a6c9936feb44612bb96421
```

The row preserved a runtime-derived traceparent:

```text
aef84e7c-6c88-4ccb-aeed-e2568082a9df	00-0cf17ea0b7eab7a5e998f6a581e7b5bf-3569b6c969809c0e-01	agent:main:subagent:continuation-3cba348646a6c9936feb44612bb96421	continuation_delegate	tree	true
```

## Child transcript / no accidental continuation

`subagent-list-recent.json` shows the child completed:

```json
{
  "runId": "continuation-delegate-3cba348646a6c9936feb44612bb96421",
  "sessionKey": "agent:main:subagent:continuation-3cba348646a6c9936feb44612bb96421",
  "status": "done",
  "runtimeMs": 16185,
  "model": "github-copilot/gpt-5.5"
}
```

Child reply:

```text
R-CW-7-BCA2B0B-CAEL-20260704-1209

child session key: agent:main:subagent:continuation-3cba348646a6c9936feb44612bb96421

visible traceparent/tool metadata: none visible
```

Fresh `sessions_history(..., includeTools=true)` inspection showed only the child task and one child text reply; there were no child tool calls, no `continue_work`, no `CONTINUE_WORK`, and no nested delegate.

## Journal receipts

`journal-continuation-excerpt.log` records delegate spawn, child no-token scan, sentinel return, token accumulation, and targeted parent return:

```text
[continuation:delegate-spawned] hop=2/200 mode=silent-wake session=agent:main:discord:channel:1466192485440164011 task=R-CW-7 proof fire...
[continuation:trace] effective-signal: origin=none kind=none session=agent:main:subagent:continuation-3cba348646a6c9936feb44612bb96421
R-CW-7-BCA2B0B-CAEL-20260704-1209
child session key: agent:main:subagent:continuation-3cba348646a6c9936feb44612bb96421
visible traceparent/tool metadata: none visible
[subagent-chain-hop] Accumulated 41094 tokens from agent:main:subagent:continuation-3cba348646a6c9936feb44612bb96421 to parent chain cost
[continuation:targeted-return] Delivered to agent:main:discord:channel:1466192485440164011 from agent:main:subagent:continuation-3cba348646a6c9936feb44612bb96421
```

## Tempo trace

Machine-readable Tempo trace JSON is saved under `tempo/`.

Runtime-derived trace ID:

```text
0cf17ea0b7eab7a5e998f6a581e7b5bf
```

`trace-0cf17ea0b7eab7a5e998f6a581e7b5bf.json` shows the ordinary delegate path stayed under the runtime context trace:

```json
{"name":"openclaw.tool.execution","attrs":{"openclaw.toolName":"continue_delegate","openclaw.tool.source":"core","gen_ai.tool.name":"continue_delegate"}}
{"name":"continuation.delegate.dispatch","attrs":{"delegate.delivery":"immediate","delegate.mode":"silent-wake","chain.id":"67146ffa-e4e0-4c1d-a710-8081e83d31b8"}}
{"name":"openclaw.harness.run","attrs":{"openclaw.channel":"webchat","openclaw.model":"gpt-5.5"}}
{"name":"openclaw.run","attrs":{"openclaw.channel":"webchat","openclaw.trigger":"user"}}
{"name":"continuation.queue.drain","attrs":{"queue.drained_count":"2","queue.drained_continuation_count":"1"}}
```

This is useful evidence that runtime-context trace linkage exists across the delegate/child path, but it is **not** the deterministic explicit-traceparent PASS shape requested by the row.

## Honest scope

✅ Proves the ordinary typed delegate still spawned and returned successfully on deployed `bca2b0b`.

✅ Proves a runtime-derived traceparent was stored on the durable delegate row and visible in Tempo linkage for parent tool execution, delegate dispatch, child run, and queue drain.

✅ Proves the child did not self-continue or emit token fallback.

⚠️ Does **not** prove the public model-facing typed tool can supply a deterministic W3C traceparent; deployed `bca2b0b` intentionally omits that field from the public schema.

⚠️ Does **not** satisfy docs#220’s explicit traceparent method as written.

## Verdict

⚠️ THIN — executed ordinary delegate; runtime-context trace linkage observed; explicit parent-supplied traceparent is not available through the public typed tool surface on deployed `bca2b0b`.

No `karmaterminal/openclaw` bug was filed from this specimen: after figs clarified that public `traceparent` exposure was intentionally removed, the observed runtime-context propagation appears to work. If the row owner wants an internal/backend harness for deterministic traceparent injection, that should be a separate explicitly-approved method, not an improvised public-tool proof.
