# R-CW-2 — typed `continue_work(delaySeconds=0)` immediate wake + chain counter (cael-dgx)

Issue: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/230

Candidate SHA: `bca2b0b89ab886bf23a10e4983926f6b374b3188`
Seat: Cael / `cael-dgx`
Build: `OpenClaw 2026.6.11 (bca2b0b)`
Verdict: ✅ PASS

## Expected byte lock

This row proves typed `continue_work(delaySeconds=0)` accepted a same-session election, persisted a continuation work row, emitted `continuation.work` and `continuation.work.fire` spans with `delay.ms=0`, and granted an immediate same-session wake with correct chain accounting (`hop 1/200`, `chain.step.remaining=199`).

## Source tool receipt

`source-tool-receipt.json` records the typed tool call:

```json
{
  "tool": "continue_work",
  "reason": "R-CW-2 proof marker RCW2_BCA2B0B_CAEL_20260704_1015_IMMEDIATE: typed continue_work delaySeconds=0 immediate same-session wake and chain counter",
  "delaySeconds": 0,
  "receipt": {
    "status": "scheduled",
    "delaySeconds": 0
  }
}
```

## Wake receipt

`wake-receipt.txt` records the continuation wake envelope:

```text
Flow: e2683c8c-1d4b-44c2-974d-95f03d1ef47b
Chain: 85f98bf9-b9c3-493a-b8e2-2a21c6d557a5 hop 1/200
Elected at: 2026-07-04T17:15:10.987Z
Electing turn finalized at: 2026-07-04T17:15:11.013Z
Due at: 2026-07-04T17:15:11.013Z
Delivered at: 2026-07-04T17:15:11.019Z
Disposition: granted
```

`dueAt` equals the finalized election time, and delivery landed 6ms overdue, proving immediate scheduling.

## Flow row

`flow-runs.json` records the durable continuation row:

```json
{
  "flow_id": "e2683c8c-1d4b-44c2-974d-95f03d1ef47b",
  "status": "running",
  "current_step": "Released to continuation wake scheduler",
  "state_json": {
    "kind": "continuation_work",
    "hop": 1,
    "delayMs": 0,
    "dueAt": 1783185311013,
    "chainId": "85f98bf9-b9c3-493a-b8e2-2a21c6d557a5",
    "traceparent": "00-92f2a184a3dfce5fcf6f3ffccadce14c-4e51c82b1e96123d-01",
    "releasedAt": 1783185311015
  }
}
```

The row was captured while the granted wake turn was active, so SQLite still showed `status=running`; the wake envelope and journal `continuation:work-wake` line prove granted execution.

## Journal evidence

`journal-work-lines.txt` shows the immediate park/arm/wake path:

```text
[continuation:work-parked-on-turn-end] ... hop=1 reasonCategory=follow-up-work
[continuation/work-dispatch] [continuation:work-idle-retry-fired] trigger=reply-run-ended waitMs=24 ...
[continuation/work-dispatch] [continuation:work-hedge-armed] fireIn=59998ms fireAt=1783185371015 ...
[continuation/work-dispatch] [continuation:work-wake] hop=1/200 session=agent:main:discord:channel:1466192485440164011 reasonCategory=follow-up-work
```

## Tempo traces

Machine-readable Tempo trace JSON is saved at:

```text
tempo/trace-source-work-92f2a184a3dfce5fcf6f3ffccadce14c.json
tempo/trace-work-fire-9143f2730f7add73f5d972d71c848bcc.json
```

`tempo/trace-source-work-summary.jsonl` includes typed tool execution and scheduling:

```json
{"name":"openclaw.tool.execution","startTimeUnixNano":"1783185306915000000","attrs":{"openclaw.toolName":"continue_work","openclaw.tool.source":"core","gen_ai.tool.name":"continue_work","openclaw.tool.params.kind":"object"}}
{"name":"continuation.work","startTimeUnixNano":"1783185310987000000","attrs":{"delay.ms":"0","chain.step.remaining":"199","chain.id":"85f98bf9-b9c3-493a-b8e2-2a21c6d557a5","reason.present":true,"reason.length":"143","reason.hash":"b8c0498d2357390f"}}
```

`tempo/trace-work-fire-summary.jsonl` includes the immediate fire span:

```json
{"name":"continuation.work.fire","startTimeUnixNano":"1783185311018000000","attrs":{"chain.id":"85f98bf9-b9c3-493a-b8e2-2a21c6d557a5","chain.step.remaining":"199","delay.ms":"0","fire.deferred_ms":"31","reason.present":true,"reason.length":"143","reason.hash":"b8c0498d2357390f"}}
```

## Supporting receipts

- `source-tool-receipt.json` — typed `continue_work(delaySeconds=0)` scheduling receipt.
- `wake-receipt.txt` — continuation wake envelope.
- `flow-runs.json` — durable continuation work row.
- `journal-work-lines.txt`, `journal-window.txt`, `journal-marker-lines.txt` — journal park/arm/fire/wake receipts.
- `discord-wake-note-receipt.json` — visible post-wake status receipt.
- `tempo/trace-source-work-92f2a184a3dfce5fcf6f3ffccadce14c.json` — machine-readable source/tool/schedule trace.
- `tempo/trace-source-work-summary.jsonl` — extracted source trace summary.
- `tempo/trace-work-fire-9143f2730f7add73f5d972d71c848bcc.json` — machine-readable fire trace.
- `tempo/trace-work-fire-summary.jsonl` — extracted fire trace summary.
- `tempo/candidate-traces.txt` and Tempo search JSON files — trace discovery receipts.
- `version.txt` — deployed build receipt.

## Verdict

✅ PASS — typed `continue_work(delaySeconds=0)` scheduled immediate same-session work, persisted a flow row, emitted `continuation.work` and `continuation.work.fire` spans with `delay.ms=0`, and granted a same-session hop 1/200 wake with `chain.step.remaining=199`.
