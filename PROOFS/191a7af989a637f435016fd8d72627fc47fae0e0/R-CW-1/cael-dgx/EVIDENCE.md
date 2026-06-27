# R-CW-1 — continue_work tool-form wake (cael-dgx)

**SHA:** `191a7af989a637f435016fd8d72627fc47fae0e0`  
**Seat:** Cael / `cael-dgx` (DGX Spark, ARM64)  
**Verdict:** ✅ PASS for tool-form scheduling + continuation wake on the deployed SHA.

## Fire

Tool-form `continue_work(delaySeconds=5, reason="PROOFS R-CW-1/R-CW-3 fresh tool-form fire on deployed 191a7af989a637f435016fd8d72627fc47fae0e0; ... nonce=cael-191a-r-cw-1-3-realtrace-1031")` returned `status: scheduled` from the live `OpenClaw 2026.6.10 (191a7af)` gateway.

The tool response returned traceparent:

```text
00-99999999999999999999999999999999-aaaaaaaaaaaaaaaa-01
```

## Byte

Saved Tempo JSON `continue_work_trace_99999999.json` includes a `continuation.work` span with:

```json
{
  "delay": "5000",
  "remaining": "196",
  "chain": "6bc38f60-17f3-4ac8-bfd1-b7ce76879d59",
  "reason": "PROOFS R-CW-1/R-CW-3 fresh tool-form fire on deployed 191a7af989a637f435016fd8d7"
}
```

Journal receipt `continue_work_journal.txt` records the tool signal and wake path:

```text
[continuation:trace] effective-signal: origin=tool-call kind=work session=agent:main:discord:channel:1466192485440164011
[continuation:work-hedge-armed] fireIn=4980ms ...
[continuation:work-wake] hop=1/200 session=agent:main:discord:channel:1466192485440164011 reasonCategory=follow-up-work
```

`k6-r-cw-1-output.txt` also reports the deployed-SHA infrastructure scenario as `PASS` for `191a7af989a637f435016fd8d72627fc47fae0e0` on `cael-dgx`.

## Caveat / hygiene

The trace ID here is deliberately synthetic from the tool-call traceparent supplied to the tool. It is still a live Tempo fetch from the deployed gateway and contains the counted `continuation.work` span and reason marker. The row is judged on the live tool-form schedule + wake receipt, not on older 82827d artifacts.
