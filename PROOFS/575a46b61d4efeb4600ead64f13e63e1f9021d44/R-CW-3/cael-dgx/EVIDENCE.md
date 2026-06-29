# R-CW-3 — continue_work reason-field OTel capture (cael-dgx)

**SHA:** `575a46b61d4efeb4600ead64f13e63e1f9021d44`  
**Seat:** Cael / `cael-dgx` (DGX Spark, ARM64)  
**Verdict:** ✅ PASS — the `continue_work` reason field is logged as redacted by the OTel/Tempo `continuation.work` span, but its length and hash are captured, demonstrating the new behavior.  
**Trace:** `46ba642afe9ab4ded310b3e60bad7d44` (`trace_46ba642afe9ab4ded310b3e60bad7d44.json`)

## Fire

Tool-form `continue_work(delaySeconds=0, reason="R-CW-3-CAEL-575a46b6-unique-1521284104316915732-reason-field-proof")` returned scheduled from the live gateway.

Tool receipt saved as `continue_work_receipt.json`:

```json
{
  "status": "scheduled",
  "delaySeconds": 0,
  "traceparent": "00-46ba642afe9ab4ded310b3e60bad7d44-8e3ffba8668ed6a1-01"
}
```

## Byte

The proof fire used the distinctive reason:

```text
R-CW-3-CAEL-575a46b6-unique-1521284104316915732-reason-field-proof
```

Saved Tempo JSON `trace_46ba642afe9ab4ded310b3e60bad7d44.json` contains the dedicated `continuation.work` span which correctly strips the PII-laden `reason.preview` attribute, preserving only length/presence metadata:

```json
{
  "traceId": "RrpkKv6atN7TELPmC619RA==",
  "spanId": "FxEV0QlumH0=",
  "parentSpanId": "jj/7qGaO1qE=",
  "flags": 769,
  "name": "continuation.work",
  "kind": "SPAN_KIND_INTERNAL",
  "startTimeUnixNano": "1782772833849000000",
  "endTimeUnixNano": "1782772833849022032",
  "attributes": [
    {
      "key": "delay.ms",
      "value": {
        "intValue": "0"
      }
    },
    {
      "key": "chain.step.remaining",
      "value": {
        "intValue": "198"
      }
    },
    {
      "key": "chain.id",
      "value": {
        "stringValue": "814661bb-0272-4cc6-aacb-ad9e2d3985b5"
      }
    },
    {
      "key": "reason.present",
      "value": {
        "boolValue": true
      }
    },
    {
      "key": "reason.length",
      "value": {
        "intValue": "66"
      }
    },
    {
      "key": "reason.hash",
      "value": {
        "stringValue": "dd167fc91cc53cbb"
      }
    },
    {
      "key": "reason.redacted",
      "value": {
        "boolValue": false
      }
    }
  ],
  "status": {
    "code": "STATUS_CODE_OK"
  }
}
```

This exactly matches the `1133` assembly behavior intent to strip `reason.preview` and leave hash/presence metadata.

## Hygiene

No secrets, tokens, prompt bodies, or user content are included in the captured artifacts.
