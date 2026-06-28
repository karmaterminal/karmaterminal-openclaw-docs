# R-CW-3 — continue_work reason-field OTel capture (cael-dgx)

**SHA:** `2723dbee783c113cae70e4fb63a4cff9f55402e3`  
**Seat:** Cael / `cael-dgx` (DGX Spark, ARM64)  
**Verdict:** ✅ PASS — the `continue_work` reason field is captured in the OTel/Tempo `continuation.work` span.  
**Trace:** `2723dbee00000000000000000000ca31` (`trace-2723dbee00000000000000000000ca31.json`)

## Fire

Tool-form `continue_work(delaySeconds=5, reason="R-CW-1-R-CW-3-CAEL-2723dbee-unique-1520644643887251639-reason-field-proof")` returned scheduled from the live `OpenClaw 2026.6.10 (2723dbe)` gateway.

Tool receipt saved as `continue_work_receipt.json`:

```json
{
  "status": "scheduled",
  "delaySeconds": 5,
  "traceparent": "00-2723dbee00000000000000000000ca31-1520644643887251-01"
}
```

## Byte

The proof fire used the distinctive reason:

```text
R-CW-1-R-CW-3-CAEL-2723dbee-unique-1520644643887251639-reason-field-proof
```

Saved Tempo JSON `trace-2723dbee00000000000000000000ca31.json` contains the same marker on the dedicated `continuation.work` span:

```json
{
  "delay.ms": 5000,
  "chain.step.remaining": 199,
  "chain.id": "daed0a01-9f91-466c-b404-37a72f12cb95",
  "reason.preview": "R-CW-1-R-CW-3-CAEL-2723dbee-unique-1520644643887251639-reason-field-proof"
}
```

The companion journal excerpt `journal-continuation-window.txt` shows the continuation scheduler emitted `[continuation:work-wake] hop=1/200` for the same session; that wake byte is included only as context for the R-CW-3 telemetry capture. Cael is **not** claiming the `R-CW-1` row in this PR; Silas owns the typed same-session `R-CW-1` row separately.

`runtime-status.txt` records the live deployed runtime:

```text
openclaw --version: OpenClaw 2026.6.10 (2723dbe)
repo HEAD: 2723dbee783c113cae70e4fb63a4cff9f55402e3
```

## Hygiene

No secrets, tokens, prompt bodies, or user content are included in the captured artifacts. The journal excerpt is limited to continuation scheduler lines for the proof window.
