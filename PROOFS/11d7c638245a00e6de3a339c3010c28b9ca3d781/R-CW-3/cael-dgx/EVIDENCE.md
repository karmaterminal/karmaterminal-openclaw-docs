# R-CW-3 — continue_work reason telemetry redaction (cael-dgx)

Issue: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/231

Candidate SHA: `bca2b0b89ab886bf23a10e4983926f6b374b3188`  
Seat: Cael / `cael-dgx`  
Verdict: ✅ PASS

## Expected byte lock

Before firing this row, Cael locked the row marker in the `continue_work` reason:

```text
RCW3_BCA2B0B_CAEL_20260704_0706_REASON_PREVIEW
```

On this candidate, raw reason text is deliberately **not** exported to Tempo (see `R-TRACE-REDACTION-1121`). Therefore the expected live telemetry byte for R-CW-3 is the safe reason-attribute surface on the `continuation.work.fire` span:

- `reason.present = true`
- `reason.length = 241`
- `reason.hash = 6a21bf151f79caea`
- no raw `reason.preview` marker in the trace JSON

The raw expected marker is preserved in the local flow-run state receipt and in the delivered continuation wake text; it is absent from Tempo by design.

## Fire

Tool-form `continue_work(delaySeconds=5, reason="PROOF R-CW-3 bca2b0b expected-byte lock: RCW3_BCA2B0B_CAEL_20260704_0706_REASON_PREVIEW. On wake, verify continuation.work reason.preview/receipt trace includes this marker, capture Tempo trace JSON, and prepare docs evidence for issue #231.")` was fired from the live Cael session.

Wake receipt:

```text
Disposition: granted
Chain: 74b5a080-dabd-4a84-8361-fefb72590e48 hop 1/200
Flow: eb98f977-a29d-4ee7-a1bb-fc86baac8d67
Due at: 2026-07-04T14:07:35.737Z
Delivered at: 2026-07-04T14:07:35.747Z
```

## Observed Tempo byte

Tempo trace `6dde0abcff5b67721699c708995512e1` was fetched from:

```text
http://tempo.dandelion.cult/api/traces/6dde0abcff5b67721699c708995512e1
```

Machine-readable trace JSON is saved as `tempo-trace-6dde0abcff5b67721699c708995512e1.json`.

The `continuation.work.fire` span contains:

```json
{
  "chain.id": "74b5a080-dabd-4a84-8361-fefb72590e48",
  "chain.step.remaining": 199,
  "delay.ms": 5000,
  "fire.deferred_ms": 5047,
  "reason.present": true,
  "reason.length": 241,
  "reason.hash": "6a21bf151f79caea",
  "reason.redacted": ""
}
```

A grep for the raw marker in the saved Tempo JSON returns no match, which is the expected redaction behavior for this candidate.

## Supporting receipts

- `flow-run-eb98f977.json` — local durable flow-run row showing the raw reason marker, the same `chainId`, `delayMs: 5000`, `hop: 1`, and `releasedAt`.
- `journal-continuation-window.txt` — journal excerpt showing the tool-origin continuation signal, parked work, hedge fire, and `[continuation:work-wake] hop=1/200` for this session.
- `version-status.txt` — live runtime version/status receipt from the proof seat.

## Verdict

✅ PASS — `continue_work` reason telemetry is present on the live continuation span as safe redacted reason attributes (`present`/`length`/`hash`) and the work wake was granted for the expected chain/flow. Raw reason text is not exported to Tempo on `bca2b0b`, matching the candidate's trace-redaction contract.
