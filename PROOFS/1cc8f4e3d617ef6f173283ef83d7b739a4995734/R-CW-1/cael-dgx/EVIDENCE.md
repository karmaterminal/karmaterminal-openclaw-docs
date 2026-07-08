# R-CW-1 — typed `continue_work()` schedules and wakes same session (cael-dgx)

Issue: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/229

Candidate SHA: `bca2b0b89ab886bf23a10e4983926f6b374b3188`
Seat: Cael / `cael-dgx`
Build: `OpenClaw 2026.6.11 (bca2b0b)`
Verdict: ✅ PASS

## Expected byte lock

This row proves typed `continue_work()` accepted a same-session continuation election, persisted a TaskFlow/flow row, emitted continuation work trace spans, and released/woke the parent session at the due time.

## Source tool receipt

`source-tool-receipt.json` records the typed tool call shape:

```json
{
  "tool": "continue_work",
  "reason": "R-CW-1 proof marker RCW1_BCA2B0B_CAEL_20260704_1009_TYPED_TOOL: typed continue_work same-session election, package after wake if granted",
  "delaySeconds": 5,
  "receipt": {
    "status": "scheduled",
    "delaySeconds": 5
  }
}
```

## Wake receipt

The continuation wake envelope was:

```text
Flow: f0ce36d5-dfb7-4314-90ad-c945f95a4569
Chain: 8ea6db6e-2355-4374-8875-718dc12358a0 hop 1/200
Elected at: 2026-07-04T17:09:27.680Z
Due at: 2026-07-04T17:09:32.708Z
Delivered at: 2026-07-04T17:09:32.725Z
Disposition: granted
Prior reason: R-CW-1 proof marker RCW1_BCA2B0B_CAEL_20260704_1009_TYPED_TOOL: typed continue_work same-session election, package after wake if granted
```

The wake turn also emitted a Discord receipt noting the granted flow; saved as `discord-wake-note-receipt.json`.

## Flow row

`flow-runs.json` records the durable continuation work row:

```json
{
  "flow_id": "f0ce36d5-dfb7-4314-90ad-c945f95a4569",
  "status": "running",
  "current_step": "Released to continuation wake scheduler",
  "state_json": {
    "kind": "continuation_work",
    "sessionKey": "agent:main:discord:channel:1466192485440164011",
    "hop": 1,
    "delayMs": 5000,
    "electedAt": 1783184967680,
    "dueAt": 1783184972708,
    "chainId": "8ea6db6e-2355-4374-8875-718dc12358a0",
    "traceparent": "00-862f9731c3ab97cbe637067481247514-beac046ba056dc6f-01",
    "releasedAt": 1783184972712
  }
}
```

The row was read while the granted wake turn was still active, so SQLite still showed `status=running`; the wake envelope and journal `continuation:work-wake` line prove the grant/execution.

## Journal evidence

`journal-work-lines.txt` shows the full park/arm/fire/wake path:

```text
[continuation:work-parked-on-turn-end] ... hop=1 reasonCategory=follow-up-work
[continuation/work-dispatch] [continuation:work-hedge-armed] fireIn=4996ms fireAt=1783184972708 ...
[continuation/work-dispatch] [continuation:work-hedge-fired] ...
[continuation/work-dispatch] [continuation:work-wake] hop=1/200 session=agent:main:discord:channel:1466192485440164011 reasonCategory=follow-up-work
```

`journal-marker-lines.txt` contains the proof marker in the same window.

## Tempo traces

Machine-readable Tempo trace JSON is saved at:

```text
tempo/trace-source-work-862f9731c3ab97cbe637067481247514.json
tempo/trace-work-fire-614f85df8a95982fda79d663c1b54522.json
```

`tempo/trace-source-work-summary.jsonl` includes typed tool execution and continuation scheduling:

```json
{"name":"openclaw.tool.execution","startTimeUnixNano":"1783184962238000000","attrs":{"openclaw.toolName":"continue_work","openclaw.tool.source":"core","gen_ai.tool.name":"continue_work","openclaw.tool.params.kind":"object"}}
{"name":"continuation.work","startTimeUnixNano":"1783184967681000000","attrs":{"delay.ms":"5000","chain.step.remaining":"199","chain.id":"8ea6db6e-2355-4374-8875-718dc12358a0","reason.present":true,"reason.length":"136","reason.hash":"8c020cfd4cb06949"}}
```

`tempo/trace-work-fire-summary.jsonl` includes the release/fire span:

```json
{"name":"continuation.work.fire","startTimeUnixNano":"1783184972724000000","attrs":{"chain.id":"8ea6db6e-2355-4374-8875-718dc12358a0","chain.step.remaining":"199","delay.ms":"5000","fire.deferred_ms":"5044","reason.present":true,"reason.length":"136","reason.hash":"8c020cfd4cb06949"}}
```

## Supporting receipts

- `source-tool-receipt.json` — typed `continue_work()` scheduling receipt.
- `wake-receipt.txt` — continuation wake envelope.
- `flow-runs.json` — durable continuation work row.
- `journal-work-lines.txt`, `journal-window.txt`, `journal-marker-lines.txt` — journal park/arm/fire/wake receipts.
- `discord-wake-note-receipt.json` — visible post-wake status receipt.
- `tempo/trace-source-work-862f9731c3ab97cbe637067481247514.json` — machine-readable source/tool/schedule trace.
- `tempo/trace-source-work-summary.jsonl` — extracted source trace summary.
- `tempo/trace-work-fire-614f85df8a95982fda79d663c1b54522.json` — machine-readable fire trace.
- `tempo/trace-work-fire-summary.jsonl` — extracted fire trace summary.
- `tempo/candidate-traces.txt` and Tempo search JSON files — trace discovery receipts.
- `version.txt` — deployed build receipt.

## Verdict

✅ PASS — typed `continue_work()` scheduled same-session work, persisted a flow row, emitted `continuation.work` and `continuation.work.fire` spans, and granted a same-session continuation wake at hop 1.
