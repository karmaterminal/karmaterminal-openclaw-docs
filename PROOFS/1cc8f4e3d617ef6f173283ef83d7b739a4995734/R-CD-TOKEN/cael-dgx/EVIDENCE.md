# R-CD-TOKEN — bracket `CONTINUE_DELEGATE` fallback spawns child and returns sentinel (cael-dgx)

Issue: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/236

Candidate SHA: `bca2b0b89ab886bf23a10e4983926f6b374b3188`
Seat: Cael / `cael-dgx`
Build: `OpenClaw 2026.6.11 (bca2b0b)`
Verdict: ✅ PASS

## Expected byte lock

This row proves the fallback bracket/token surface for `continue_delegate`: terminal `[[CONTINUE_DELEGATE: ...]]` text is parsed from finalized assistant output, schedules/spawns a child subagent, and the child result returns to the parent with the requested sentinel. This is not typed `continue_delegate()` tool-form evidence.

## Source token surface

The source assistant text was:

```text
R-CD-TOKEN source marker: `RCD_TOKEN_BCA2B0B_CAEL_20260704_0932`

[[CONTINUE_DELEGATE: Return exactly this sentinel and nothing else: RCD_TOKEN_BCA2B0B_CAEL_20260704_0932_CHILD_RETURNED]]
```

Saved as `source-token-surface.txt`. No typed `continue_delegate()` tool call was used for this row.

## Parser receipt

`journal-delegate-lines.txt` shows the bracket parser path:

```text
[continuation/signal] [continuation:trace] payload-scan: count=2 bracketIdx=0 [0]text=true [1]text=true session=agent:main:discord:channel:1466192485440164011
[continuation/signal] [continuation:trace] bracket-parse: kind=delegate delayMs=default session=agent:main:discord:channel:1466192485440164011
[continuation/signal] [continuation:trace] effective-signal: origin=bracket kind=delegate session=agent:main:discord:channel:1466192485440164011
```

## Delegate/task receipts

`flow-runs.json` records the parent continuation delegate flow:

```text
flow_id: 38fc5365-8b31-43ea-962f-8c3651716303
status: succeeded
created_at: 1783182683713
ended_at: 1783182687170
```

`task-runs.json` records the spawned subagent task:

```text
task_id: ad5b18d7-6858-4b2f-a06d-dc2c57b04092
runtime: subagent
requester_session_key: agent:main:discord:channel:1466192485440164011
child_session_key: agent:main:subagent:05645cb7-59b6-4371-af2f-6e96d9c6a783
parent_flow_id: 38fc5365-8b31-43ea-962f-8c3651716303
status: succeeded
delivery_status: delivered
progress_summary: RCD_TOKEN_BCA2B0B_CAEL_20260704_0932_CHILD_RETURNED
```

The child CLI task row also succeeded and completed.

## Child result / return sentinel

The child returned exactly:

```text
RCD_TOKEN_BCA2B0B_CAEL_20260704_0932_CHILD_RETURNED
```

Receipts:

- `child-result-receipt.txt` — parent-side result event receipt.
- `child-trajectory-sentinel-excerpts.jsonl` — child trajectory entries showing `assistantTexts:["RCD_TOKEN_BCA2B0B_CAEL_20260704_0932_CHILD_RETURNED"]` and final status success.
- `child-session-sentinel-excerpts.jsonl` — child session excerpt search receipt.

The parent also announced receipt in Discord; the canonical proof byte is the task row + child trajectory + parent receipt, not the chat announcement.

## Journal evidence

`journal-delegate-lines.txt` shows child execution and return:

```text
[agent/embedded] ... sessionKey=agent:main:subagent:05645cb7-59b6-4371-af2f-6e96d9c6a783
[continuation/signal] ... session=agent:main:subagent:05645cb7-59b6-4371-af2f-6e96d9c6a783
RCD_TOKEN_BCA2B0B_CAEL_20260704_0932_CHILD_RETURNED
[subagent-chain-hop] Accumulated 46487 tokens from agent:main:subagent:05645cb7-59b6-4371-af2f-6e96d9c6a783 to parent chain cost
```

## Tempo traces

Machine-readable Tempo trace JSON is saved at:

```text
tempo/trace-delegate-dispatch-child-30ed6e3e34825ef465f1a0c368cdee73.json
tempo/trace-source-turn-25d84d10f6d8fd96309b8fc7141fafa4.json
```

`tempo/trace-delegate-dispatch-child-summary.jsonl` includes the delegate dispatch span and child model run:

```json
{"name":"continuation.delegate.dispatch","startTimeUnixNano":"1783182683563000000","attrs":{"delay.ms":"0","chain.step.remaining":"199","delegate.delivery":"immediate","delegate.mode":"normal","chain.id":"e328f063-df88-482d-b719-c06a3efb444d"}}
{"name":"openclaw.harness.run","startTimeUnixNano":"1783182684062000000","attrs":{"openclaw.harness.id":"openclaw","openclaw.provider":"github-copilot","openclaw.model":"gpt-5.5","openclaw.outcome":"completed"}}
```

The source-turn trace is included for the parent generation / message-tool context around the emitted bracket token.

## Supporting receipts

- `source-token-surface.txt` — exact finalized assistant text containing source marker + bracket delegate token.
- `journal-delegate-lines.txt`, `journal-window.txt`, `journal-marker-lines.txt` — parser, spawn, child, and return journal receipts.
- `flow-runs.json` — parent flow row.
- `task-runs.json` — subagent/child task rows.
- `child-result-receipt.txt` — parent-side child result receipt.
- `child-trajectory-sentinel-excerpts.jsonl` — child trajectory success/sentinel receipt.
- `child-session-sentinel-excerpts.jsonl` — child session sentinel grep receipt.
- `tempo/trace-delegate-dispatch-child-30ed6e3e34825ef465f1a0c368cdee73.json` — machine-readable delegate/child trace.
- `tempo/trace-delegate-dispatch-child-summary.jsonl` — extracted delegate/child trace summary.
- `tempo/trace-source-turn-25d84d10f6d8fd96309b8fc7141fafa4.json` — source-turn trace.
- `tempo/trace-source-turn-summary.jsonl` — extracted source-turn trace summary.
- `version.txt` — deployed build receipt.

## Verdict

✅ PASS — terminal bracket `[[CONTINUE_DELEGATE: ...]]` fallback was parsed as `origin=bracket kind=delegate`, spawned a subagent, the child executed the sentinel task, and the sentinel returned/delivered to the parent.
