# R-CW-TOKEN — bare `CONTINUE_WORK:N` fallback schedules and wakes (cael-dgx)

Issue: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/237

Candidate SHA: `bca2b0b89ab886bf23a10e4983926f6b374b3188`
Seat: Cael / `cael-dgx`
Build: `OpenClaw 2026.6.11 (bca2b0b)`
Verdict: ✅ PASS

## Expected byte lock

This row proves the fallback token surface for `continue_work`: a terminal bare `CONTINUE_WORK:N` in finalized assistant text is parsed into a same-session continuation work election, scheduled, and later delivered as a wake. This is not tool-form evidence.

## Source token surface

The source assistant turn ended with the bare token:

```text
Taking `R-CW-TOKEN` next. I’ll test the bare fallback token path exactly, with marker `RCW_TOKEN_BCA2B0B_CAEL_20260704_0917`, and I’ll only claim it if the parser/scheduler/wake byte fires from the token surface.

RCW_TOKEN_BCA2B0B_CAEL_20260704_0917 fire marker.

CONTINUE_WORK:5
```

This exact text is saved in `source-token-surface.txt`. No typed `continue_work()` tool call was made in this source turn.

## Wake receipt

The token-produced flow was:

```text
Flow: 417397ce-f39e-4c1d-892b-fa576dd01515
Chain: 81c5854a-a4ec-4b37-ac38-40b2e834d53e hop 2/200
Elected at: 2026-07-04T16:16:47.703Z
Due at: 2026-07-04T16:16:52.748Z
Delivered at: 2026-07-04T16:16:52.756Z
Disposition: granted
Prior reason: (none)
```

The absence of a typed reason is expected for the bare fallback token path; the source text carried the marker and terminal token, and the generated flow has `reasonCategory=unknown` in journal lines.

## Wake marker executed

On the wake turn, the agent emitted the required marker:

```text
RCW_TOKEN_BCA2B0B_CAEL_20260704_0917_WAKE_EXECUTED
```

Discord receipt: `wake-executed-marker-receipt.json`, message `1523000144130216006`.

## Flow rows

`flow-runs.json` includes the token-produced continuation row:

```json
{
  "flow_id": "417397ce-f39e-4c1d-892b-fa576dd01515",
  "status": "running",
  "current_step": "Released to continuation wake scheduler",
  "state_json": {
    "kind": "continuation_work",
    "hop": 2,
    "delayMs": 5000,
    "electedAt": 1783181807703,
    "dueAt": 1783181812748,
    "chainId": "81c5854a-a4ec-4b37-ac38-40b2e834d53e",
    "releasedAt": 1783181812752
  }
}
```

The row was read while the wake turn was still active, so SQLite still showed `status=running`; the separate continuation wake envelope and Discord marker receipt prove the wake was granted and executed. The journal also records the wake at 09:16:52.

A preceding row, `71dfbc70-114f-4acf-9983-df7a8ea38e9d`, is the parent continuation wake that gave the agent a turn in which to emit the token; it is retained in `flow-runs.json` for chain context and is not the row under claim.

## Journal evidence

`journal-token-continuation-lines.txt` shows the token row scheduling and wake:

```text
Jul 04 09:16:47 [continuation:work-parked-on-turn-end] ... hop=2 reasonCategory=unknown
Jul 04 09:16:47 [continuation/work-dispatch] [continuation:work-hedge-armed] fireIn=4996ms fireAt=1783181812748 ...
Jul 04 09:16:52 [continuation/work-dispatch] [continuation:work-hedge-fired] ...
Jul 04 09:16:52 [continuation/work-dispatch] [continuation:work-wake] hop=2/200 ... reasonCategory=unknown
```

## Tempo trace

Machine-readable Tempo trace JSON is saved at:

```text
tempo/trace-token-wake-161188a44d7b1f3bfe885b4b243e672f.json
```

`tempo/trace-token-wake-summary.jsonl` contains the `continuation.work` span for the token row:

```json
{"name":"continuation.work","startTimeUnixNano":"1783181807704000000","attrs":{"delay.ms":"5000","chain.step.remaining":"198","chain.id":"81c5854a-a4ec-4b37-ac38-40b2e834d53e"}}
```

The parent wake trace is also included for chain context:

```text
tempo/trace-parent-wake-6a705ab942082d20b11af5320774c5e8.json
```

## Supporting receipts

- `source-token-surface.txt` — final assistant text containing the marker and terminal bare `CONTINUE_WORK:5` token.
- `wake-receipt.txt` — continuation wake envelope for `417397ce-f39e-4c1d-892b-fa576dd01515`.
- `wake-executed-marker-receipt.json` — Discord receipt for `RCW_TOKEN_BCA2B0B_CAEL_20260704_0917_WAKE_EXECUTED`.
- `discord-token-claim-receipt.json` — Discord receipt for the post-wake packaging note.
- `flow-runs.json` — SQLite flow rows for the parent wake and token-produced wake.
- `journal-token-continuation-lines.txt`, `journal-window.txt`, `journal-marker-lines.txt` — journal window/search receipts.
- `tempo/trace-token-wake-161188a44d7b1f3bfe885b4b243e672f.json` — machine-readable trace for the token continuation work span.
- `tempo/trace-token-wake-summary.jsonl` — extracted trace summary.
- `tempo/trace-parent-wake-6a705ab942082d20b11af5320774c5e8.json` — parent turn trace retained for chain context.
- `tempo/continuation-work-traces.txt` — trace id search receipt.
- `version.txt` — deployed build receipt.

## Verdict

✅ PASS — the terminal bare `CONTINUE_WORK:5` fallback produced a continuation work row and a granted wake; the wake turn executed and emitted `RCW_TOKEN_BCA2B0B_CAEL_20260704_0917_WAKE_EXECUTED`.
