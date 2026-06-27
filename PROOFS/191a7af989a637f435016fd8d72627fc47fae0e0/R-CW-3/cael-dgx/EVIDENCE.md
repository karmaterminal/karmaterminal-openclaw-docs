# R-CW-3 — continue_work reason-field OTel capture (cael-dgx)

**SHA:** `191a7af989a637f435016fd8d72627fc47fae0e0`  
**Seat:** Cael / `cael-dgx` (DGX Spark, ARM64)  
**Verdict:** ✅ PASS — the `continue_work` reason field is captured in the OTel/Tempo `continuation.work` span.

## Byte

The proof fire used the distinctive reason prefix:

```text
PROOFS R-CW-1/R-CW-3 fresh tool-form fire on deployed 191a7af989a637f435016fd8d72627fc47fae0e0
```

Saved Tempo JSON `reason_preview_trace_bbbbbbbb.json` contains the same marker in `reason.preview` on the `continuation.work` span:

```json
{
  "delay": "5000",
  "remaining": "195",
  "chain": "6bc38f60-17f3-4ac8-bfd1-b7ce76879d59",
  "reason": "PROOFS R-CW-1/R-CW-3 fresh tool-form fire on deployed 191a7af989a637f435016fd8d7"
}
```

The value is truncated by the runtime's `reason.preview` attribute, but it preserves the deployed-SHA row marker and proves reason-field propagation into telemetry on this corpus SHA.
