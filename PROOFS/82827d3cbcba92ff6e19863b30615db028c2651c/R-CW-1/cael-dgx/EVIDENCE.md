# R-CW-1 — continue_work tool-form wake (cael-dgx)

**SHA:** `82827d3cbcba92ff6e19863b30615db028c2651c`  
**Seat:** Cael / `cael` (DGX Spark, ARM64)  
**Verdict:** ✅ PASS for tool-form scheduling + continuation wake on the deployed SHA.  
**Trace:** `4f8c2a3d9e1b476aa6c0f2d813579bce` (`trace-4f8c2a3d9e1b476aa6c0f2d813579bce.json`)

## Fire

Tool-form `continue_work(delaySeconds=5, reason="R-CW-1-R-CW-3-CAEL-82827d3cbc-unique-4f8c2a3d-reason-field-proof")` returned scheduled from the live `OpenClaw 2026.6.9 (82827d3)` gateway.

## Byte

Tempo span `continuation.work` in trace `4f8c2a3d...` records:

```json
{
  "delay.ms": 5000,
  "chain.step.remaining": 197,
  "chain.id": "bdf0404b-3fee-4d34-86ef-3273f72264af",
  "reason.preview": "R-CW-1-R-CW-3-CAEL-82827d3cbc-unique-4f8c2a3d-reason-field-proof"
}
```

Journal window (`../R-CW-4/cael-dgx/journal-continuation-window.txt`) shows the scheduled work then firing as `[continuation:work-wake]` on the same deployed gateway.

## Caveat / hygiene

Earlier manual traceparent attempts in this fresh lane are deliberately **not** counted as the primary R-CW-1 receipt. The counted receipt is the unique `4f8c2a3d...` span + journal wake on the live `82827d3` gateway.
