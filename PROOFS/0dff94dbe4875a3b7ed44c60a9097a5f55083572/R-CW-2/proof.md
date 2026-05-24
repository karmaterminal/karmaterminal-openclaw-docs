# R-CW-2: delaySeconds=0 clamped to minDelayMs (5s)

**Family**: `continue_work()`
**Lead Prince**: 🩸 Cael
**Status**: ✅ PROVEN on `0dff94dbe4875a3b7ed44c60a9097a5f55083572`
**Trace ID**: `5056554f07cadf29089368be2d309644` (shared with R-CW-1, same chain)
**Fired at**: 2026-05-24 ~13:18 PDT (cael-prince, ARM64)

## Scenario

Same gateway as R-CW-1 (`0dff94dbe48`, cael-seat). `minDelayMs: 5000` in continuation config.
This row tests that requesting `delaySeconds=0` is clamped UP to the configured minimum, not allowed to fire immediately.

## Command

```
continue_work(delaySeconds=0, reason="R-CW-2 proof row RE-FIRE: delaySeconds=0 clamp test")
```

## Expected

- Tool response `delaySeconds` field is `5` (clamped from 0)
- Tool response includes a `note` field explaining the clamp
- The wake fires at 5s, not 0s

## Observed

- Tool response: `{"status":"scheduled","delaySeconds":5,"note":"Requested 0s, clamped to 5s by continuation config.","traceparent":"00-5056554f07cadf29089368be2d309644-34e3d5d9c35a8fd2-01"}` ✅
- The clamp is explicit in the response: `delaySeconds: 5` (not 0), `note: "Requested 0s, clamped to 5s by continuation config."`
- Tempo span `continuation.work` for this call shows `delay.ms: 5000` (clamped value, not 0) ✅
- Chain.id `019e59c2-8bca-752c-b748-8f83425138a6` propagates from R-CW-1

## Verdict

✅ **PROVEN** — minDelayMs enforcement works at scheduling time, transparently surfaced to caller via `note` field.

## Artifacts

- `trace.json` — shared with R-CW-1 (same continuation chain)
