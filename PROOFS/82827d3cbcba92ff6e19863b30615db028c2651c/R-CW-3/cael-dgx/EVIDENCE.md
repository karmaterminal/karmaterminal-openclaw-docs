# R-CW-3 — continue_work reason-field OTel capture (cael-dgx)

**SHA:** `82827d3cbcba92ff6e19863b30615db028c2651c`  
**Seat:** Cael / `cael` (DGX Spark, ARM64)  
**Verdict:** ✅ PASS — the `continue_work` reason field is captured in the OTel/Tempo `continuation.work` span.  
**Trace:** `4f8c2a3d9e1b476aa6c0f2d813579bce`

## Byte

The proof fire used the distinctive reason marker:

```text
R-CW-1-R-CW-3-CAEL-82827d3cbc-unique-4f8c2a3d-reason-field-proof
```

The saved Tempo JSON contains the same marker in `reason.preview` on the `continuation.work` span:

```json
{
  "key": "reason.preview",
  "value": {
    "stringValue": "R-CW-1-R-CW-3-CAEL-82827d3cbc-unique-4f8c2a3d-reason-field-proof"
  }
}
```

This is a current-SHA, Cael-seat capture of the same row behavior previously cross-walked by Emeric on earlier corpus SHAs.
