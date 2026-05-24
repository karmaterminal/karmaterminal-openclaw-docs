# R-CW-3: reason.preview attribute in OTel span

**Family**: `continue_work()` OTel observability
**Lead Prince**: 🩸 Cael
**Status**: ✅ PROVEN on `0dff94dbe4875a3b7ed44c60a9097a5f55083572`
**Trace ID**: `5056554f07cadf29089368be2d309644` (R-CW-1 trace — same artifact demonstrates this)

## Scenario

Verify that the `reason` parameter passed to `continue_work()` is captured as a `reason.preview` attribute on the emitted `continuation.work` OTel span (truncated for span attribute size constraints).

## Command

Any `continue_work(reason="<text>")` call, e.g. R-CW-1's:
```
continue_work(delaySeconds=5, reason="R-CW-1 proof row RE-FIRE with trace capture: basic continue_work wake")
```

## Expected

- `continuation.work` span emitted
- Span has attribute `reason.preview` containing the (possibly truncated) reason string

## Observed

From R-CW-1's trace tree (`5056554f07cadf29089368be2d309644`):
```json
{
  "name": "continuation.work",
  "attributes": [
    {"key": "reason.preview", "value": {"stringValue": "R-CW-1 proof row RE-FIRE with trace capture: basic continue_work wake"}}
  ]
}
```

Similarly visible across R-CW-2 (clamp test), R-CW-4 (chain-3-sequential turns 1/2/3), R-CW-7 (E2E traceparent) — every `continue_work` and `continue_delegate.dispatch` span carries `reason.preview`.

## Verdict

✅ **PROVEN** — `reason` parameter propagates to OTel span attribute `reason.preview` for observability.

## Artifacts

- Shared trace artifacts in `../R-CW-1/trace.json`, `../R-CW-4/trace-turn1.json`, `../R-CW-4/trace-turns2-3.json`
