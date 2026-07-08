# R-CW-DELEGATE-TOKEN — child bare-token continuation (cael-dgx)

Issue: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/221
Method packet: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/221#issuecomment-4883375511
Candidate SHA: `bca2b0b89ab886bf23a10e4983926f6b374b3188`
Seat: Cael / `cael-dgx`
Build: `OpenClaw 2026.6.11 (bca2b0b)`
Sentinel: `R-CW-DELEGATE-TOKEN-BCA2B0B-CAEL-20260704-1122`
Verdict: ✅ PASS

## What this row tests

This is the token/bracket sibling of `R-CW-DELEGATE-SELF-CONTINUATION`: a parent typed `continue_delegate(mode="silent-wake", fanoutMode="tree")` spawns a child; the child schedules its own continuation by emitting a bare text token (`CONTINUE_WORK:5`) rather than calling typed `continue_work`; then the child receives a real second continuation turn and returns the sentinel.

PASS requires actual child hop execution, not just token stripping/recognition.

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

The delegate flow row confirms the parent typed delegate spawned a child:

```text
4505be15-db66-4841-a4d8-cfdbf3c75094  status=succeeded  controller_id=core/continuation-delegate  current_step="Accepted by continuation subagent"
childSessionKey="agent:main:subagent:continuation-e9f996fc51ca332b1fa86217cf72090e"
traceparent="00-a0ead7f17dd741d27224bd5e7d08b4e5-6c17e2cd34541bea-01"
```

`subagent-list-recent.json` shows the child completed:

```json
{
  "runId": "continuation-delegate-e9f996fc51ca332b1fa86217cf72090e",
  "sessionKey": "agent:main:subagent:continuation-e9f996fc51ca332b1fa86217cf72090e",
  "status": "done",
  "pendingDescendants": 0,
  "runtimeMs": 5079
}
```

## Token emission and parser origin

The first child reply ended with the bare token and used no typed `continue_work` tool call:

```text
R-CW-DELEGATE-TOKEN-BCA2B0B-CAEL-20260704-1122 armed; awaiting fallback continuation wake.

CONTINUE_WORK:5
```

`journal-continuation-excerpt.log` records the parser/token path:

```text
[continuation:trace] payload-scan: count=1 bracketIdx=0 [0]text=true session=agent:main:subagent:continuation-e9f996fc51ca332b1fa86217cf72090e
[continuation:trace] bracket-parse: kind=work delayMs=5000 session=agent:main:subagent:continuation-e9f996fc51ca332b1fa86217cf72090e
[continuation:trace] effective-signal: origin=bracket kind=work session=agent:main:subagent:continuation-e9f996fc51ca332b1fa86217cf72090e
[continuation:work-hedge-armed] fireIn=5000ms fireAt=1783189357855 session=agent:main:subagent:continuation-e9f996fc51ca332b1fa86217cf72090e
```

No `continue_work` tool call appears in the child transcript. The Tempo traces likewise include `continuation.work` spans but no `openclaw.tool.execution` span for `continue_work` in the child token path.

After figs warned that delegates can drift into invalid/tool-call behavior, I re-inspected the child history with `includeTools=true`. `child-transcript-tool-audit.md` records the audit: the first child turn is text-only and ends with `CONTINUE_WORK:5`; the second child turn is text-only sentinel return; there are no child `toolCall` blocks. `tempo-child-tool-audit.txt` records the parallel Tempo check.

## Real second child turn

The child received an actual second continuation turn:

```text
[continuation:wake] Turn 1/200 ...
Origin run: continuation-delegate-e9f996fc51ca332b1fa86217cf72090e
Origin turn: 4745d31b-7ab4-45d3-8e36-c5a2c31968ba
Elected at: 2026-07-04T18:22:32.855Z
Due at: 2026-07-04T18:22:37.855Z
Overdue by: 5ms
Delivered at: 2026-07-04T18:22:37.860Z
Disposition: granted
Chain: 3cfc8617-1edc-42a4-ba9f-85a04ef445a8 hop 1/200
Flow: 3cfc8617-1edc-42a4-ba9f-85a04ef445a8
Prior reason: (none)
```

The continuation work flow row confirms durable success:

```text
3cfc8617-1edc-42a4-ba9f-85a04ef445a8  status=succeeded  controller_id=core/continuation-work  current_step="Same-session continuation turn granted"
delayMs=5000
hop=1
maxChainLength=200
disposition="granted"
busySkipCount=0
```

The child second reply returned the sentinel and metadata:

```text
R-CW-DELEGATE-TOKEN-BCA2B0B-CAEL-20260704-1122
Session key: `agent:main:subagent:continuation-e9f996fc51ca332b1fa86217cf72090e`
Chain: `3cfc8617-1edc-42a4-ba9f-85a04ef445a8`
Flow: `3cfc8617-1edc-42a4-ba9f-85a04ef445a8`
Hop: `1/200`
Disposition: `granted`
Visible token/trace metadata: Fallback bare token emitted exactly as final line/content in first child reply: `CONTINUE_WORK:5`
```

## Parent return and journal receipts

The journal records delegate spawn, child token parse, child work wake, token accumulation, and targeted return:

```text
[continuation:delegate-spawned] hop=1/200 mode=silent-wake session=agent:main:discord:channel:1466192485440164011 task=R-CW-DELEGATE-TOKEN proof fire...
[continuation:trace] effective-signal: origin=bracket kind=work session=agent:main:subagent:continuation-e9f996fc51ca332b1fa86217cf72090e
[subagent-chain-hop] Accumulated 2170 tokens from agent:main:subagent:continuation-e9f996fc51ca332b1fa86217cf72090e to parent chain cost
[continuation:targeted-return] Delivered to agent:main:discord:channel:1466192485440164011 from agent:main:subagent:continuation-e9f996fc51ca332b1fa86217cf72090e
[continuation:work-wake] hop=1/200 session=agent:main:subagent:continuation-e9f996fc51ca332b1fa86217cf72090e reasonCategory=unknown
```

## Flow rows

`flow-runs-matching.tsv` / `flow-runs-matching-full.jsonl` contain three matching rows:

```text
4505be15-db66-4841-a4d8-cfdbf3c75094  managed        status=succeeded  controller_id=core/continuation-delegate
3b0cef6e-8afc-49fa-b538-f1a87f3445c9  task_mirrored  status=succeeded  notify_policy=done_only
3cfc8617-1edc-42a4-ba9f-85a04ef445a8  managed        status=succeeded  controller_id=core/continuation-work
```

Unlike the prior #1162 specimen, the mirrored child row is `status=succeeded` here.

## Tempo traces

Machine-readable Tempo trace JSON is saved under `tempo/`. Candidate trace IDs:

```text
18eac519c970b7b272643d474765fdf8
5085205dfadcad4696b8c679af560386
782ef41852545ac6c8a89dcc35f2055
a0ead7f17dd741d27224bd5e7d08b4e5
```

Load-bearing span summaries:

```json
{"name":"openclaw.tool.execution","attrs":{"openclaw.toolName":"continue_delegate"}}
{"name":"continuation.work","attrs":{"delay.ms":"5000","chain.step.remaining":"199"}}
{"name":"continuation.work.fire","attrs":{"chain.id":"3cfc8617-1edc-42a4-ba9f-85a04ef445a8","chain.step.remaining":"199","delay.ms":"5000","fire.deferred_ms":"5004"}}
{"name":"continuation.queue.drain","attrs":{"queue.drained_count":"2","queue.drained_continuation_count":"1"}}
```

As expected for token fallback, there is no child `openclaw.tool.execution` span for typed `continue_work`; scheduling appears as `continuation.work` / `continuation.work.fire`.

## Supporting receipts

- `fire-plan.json` — row plan and sentinel.
- `comment-4883375511.json` — executable method packet.
- `delegate-tool-receipt.json` — parent typed delegate receipt.
- `subagent-list-recent.json` — spawned child completion metadata.
- `subagent-history-excerpt.md` — first-turn bare token, second-turn wake, final sentinel result.
- `child-transcript-tool-audit.md` — includeTools audit showing no child typed `continue_work` tool call.
- `tempo-child-tool-audit.txt` — Tempo audit noting work/fire spans rather than child `continue_work` tool execution.
- `flow-runs-matching.tsv` / `flow-runs-matching-full.jsonl` — delegate, mirrored child, and continuation-work rows.
- `journal-continuation-excerpt.log` / `journal-post-wake-excerpt.log` — token parse, work wake, targeted return.
- `tempo/trace-*.json` and summaries — machine-readable Tempo receipts.
- `source/source-sha.txt`, `source/source-commit.txt`, and `version.txt` — exact candidate/runtime receipts.

## Honest scope

✅ Proves parent typed `continue_delegate(mode="silent-wake", fanoutMode="tree")` spawned a child.

✅ Proves child emitted bare fallback token `CONTINUE_WORK:5` in text, with no typed `continue_work` tool call in the child transcript.

✅ Proves gateway parsed that token as continuation work (`origin=bracket kind=work`), delivered a real second child wake at hop `1/200`, and the child returned the sentinel.

✅ Proves the three relevant durable rows all reached `status=succeeded` for this specimen.

❌ Does not prove bracket `[[CONTINUE_WORK:5]]`; this row used the bare token form.

❌ Does not prove child-visible traceparent propagation; the proof uses gateway/Tempo receipts, flow rows, journal, and subagent transcript.

## Verdict

✅ PASS — bare `CONTINUE_WORK:5` emitted by the delegate child drove a real same-child continuation wake and sentinel return on deployed `OpenClaw 2026.6.11 (bca2b0b)`.
