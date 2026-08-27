# R-CW-MULTI — typed same-turn continue_work fan-out folded-active behavior (cael-dgx)

Issue: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/239

Candidate SHA: `bca2b0b89ab886bf23a10e4983926f6b374b3188`
Seat: Cael / `cael-dgx`
Build: `OpenClaw 2026.6.11 (bca2b0b)`
Verdict: ✅ PASS — observed fanout/collapse semantics

## Expected byte lock

Clarified after figs directive + frond-scribe correction: this row documents same-turn multi-`continue_work` fanout with wake-collapse semantics. Expected accepted behavior:

- one source turn creates N distinct elections / durable rows;
- the first due row may grant a wake;
- later rows that mature while that wake turn is active may fold into the active turn as `folded-active`;
- only actual fresh wakes emit wake markers; folded rows must not get invented markers.

This run created three distinct durable rows in one source turn. A granted as the wake turn; B and C matured while the A wake turn was active and were consumed as `folded-active`. Per figs's directive, this is treated as the clarified observed fanout/collapse semantics, not an automatic product bug or FAIL.

## Fire

Marker base:

```text
RCW_MULTI_BCA2B0B_CAEL_20260704_0846
```

Typed tool receipts in `source-tool-receipts.jsonl`:

```jsonl
{"reason":"RCW_MULTI_BCA2B0B_CAEL_20260704_0846_A typed multi-continue_work proof election A; expected distinct wake marker A_WAKE if fan-out works","delaySeconds":5,"receipt":{"status":"scheduled","delaySeconds":5}}
{"reason":"RCW_MULTI_BCA2B0B_CAEL_20260704_0846_B typed multi-continue_work proof election B; expected distinct wake marker B_WAKE if fan-out works","delaySeconds":10,"receipt":{"status":"scheduled","delaySeconds":10}}
{"reason":"RCW_MULTI_BCA2B0B_CAEL_20260704_0846_C typed multi-continue_work proof election C; expected distinct wake marker C_WAKE if fan-out works","delaySeconds":15,"receipt":{"status":"scheduled","delaySeconds":15}}
```

## Observed durable rows

`flow-runs-final.json` shows three rows were captured from one source turn:

| submarker | flow id | delay | durable disposition |
| --- | --- | ---: | --- |
| A | `2e235f25-326b-4ebe-aab5-1b7c5cc154fd` | 5000ms | `granted` / `Same-session continuation turn granted` |
| B | `ee8fd1ff-73a7-447c-a0de-75e8377a6950` | 10000ms | `folded-active` / `folded-into-active-turn: matured while a later turn was active` |
| C | `78efa76f-e2ca-42df-b1f7-42e88ce36728` | 15000ms | `folded-active` / `folded-into-active-turn: matured while a later turn was active` |

Key bytes:

```text
2e235f25-326b-4ebe-aab5-1b7c5cc154fd | succeeded | Same-session continuation turn granted | disposition=granted
ee8fd1ff-73a7-447c-a0de-75e8377a6950 | succeeded | folded-into-active-turn: matured while a later turn was active | disposition=folded-active
78efa76f-e2ca-42df-b1f7-42e88ce36728 | succeeded | folded-into-active-turn: matured while a later turn was active | disposition=folded-active
```

## Wake markers

A produced a fresh wake and emitted the marker:

```text
RCW_MULTI_BCA2B0B_CAEL_20260704_0846_A_WAKE
```

Discord receipt: `discord-wake-marker-receipt.json`, message `1522992066345570544`.

B and C did **not** emit wake markers. They were delivered as system continuation notes with `Disposition: folded-active`, and the agent intentionally did not invent `B_WAKE` / `C_WAKE` markers.

## Journal evidence

`journal-continuation-lines.txt` shows the sequence:

```text
08:46:29 three work-parked-on-turn-end rows, hop=1/2/3
08:46:34 continuation:work-wake hop=1/200
08:46:44 continuation:work-folded-active flowId=ee8fd1ff-73a7-447c-a0de-75e8377a6950 hop=2
08:46:44 continuation:work-folded-active flowId=78efa76f-e2ca-42df-b1f7-42e88ce36728 hop=3
```

## Tempo trace

Machine-readable Tempo trace JSON is saved at:

```text
tempo/trace-958e0b039d3d1aa2da887f956f976c0.json
```

`tempo/trace-summary.jsonl` shows all three typed `continue_work` tool executions and three `continuation.work` spans in the source turn:

```json
{"name":"openclaw.tool.execution","startTimeUnixNano":"1783179966674000000","attrs":{"openclaw.toolName":"message"}}
{"name":"openclaw.tool.execution","startTimeUnixNano":"1783179971785000000","attrs":{"openclaw.toolName":"continue_work"}}
{"name":"openclaw.tool.execution","startTimeUnixNano":"1783179978590000000","attrs":{"openclaw.toolName":"continue_work"}}
{"name":"openclaw.tool.execution","startTimeUnixNano":"1783179984673000000","attrs":{"openclaw.toolName":"continue_work"}}
{"name":"continuation.work","startTimeUnixNano":"1783179989453000000","attrs":{"delay.ms":"5000","chain.step.remaining":"199","chain.id":"3bb8e24a-c1e1-4bbd-af77-968a1f03c744","reason.length":"136","reason.hash":"38a5479553965882"}}
{"name":"continuation.work","startTimeUnixNano":"1783179989459000000","attrs":{"delay.ms":"10000","chain.step.remaining":"198","chain.id":"3bb8e24a-c1e1-4bbd-af77-968a1f03c744","reason.length":"136","reason.hash":"4b19c50095202bdb"}}
{"name":"continuation.work","startTimeUnixNano":"1783179989463000000","attrs":{"delay.ms":"15000","chain.step.remaining":"197","chain.id":"3bb8e24a-c1e1-4bbd-af77-968a1f03c744","reason.length":"136","reason.hash":"4eee335b7284831c"}}
```

The trace confirms three elections were captured. The durable rows/journal show that only A became a fresh wake; B/C collapsed into the active turn.

## Bug classification

No separate `karmaterminal/openclaw` bug was filed from this row. figs noted that wake collapse may be expected with recent changes (for example overlapping fan-in wakes should collapse when waking). frond-scribe opened docs#246 `R-CD-RETURN-OVERLAP` for the silent-return + waking-return overlap gap. This row is therefore classified as PASS for observed fanout/collapse semantics: same-turn multiple rows are captured, and overlapping later wakes fold into the active wake turn rather than producing invented extra wake markers.

## Supporting receipts

- `source-tool-receipts.jsonl` — three typed `continue_work` scheduling receipts from one source turn.
- `flow-runs-final.json` — durable A/B/C rows and dispositions.
- `wake-and-folded-receipts.txt` — system wake/folded note transcription.
- `discord-wake-marker-receipt.json` — A wake marker delivery receipt.
- `journal-continuation-lines.txt`, `journal-window.txt`, `journal-marker-lines.txt` — journal window and continuation/folded lines.
- `tempo/trace-958e0b039d3d1aa2da887f956f976c0.json` — machine-readable trace for the source/wake turn.
- `tempo/trace-summary.jsonl` — extracted trace summary.
- `tempo/continue-work-traces.txt` — trace id search receipt.
- `version.txt` — deployed build receipt.

## Verdict

✅ PASS — observed fanout/collapse semantics. N=3 rows captured from one source turn; A granted and emitted `A_WAKE`; B/C matured while the A wake turn was active and folded into that active turn. No B/C wake markers were invented.
