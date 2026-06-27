# R-CW-TOKEN — bare `CONTINUE_WORK:N` token-form (cael-dgx)

**SHA:** `191a7af989a637f435016fd8d72627fc47fae0e0`  
**Seat:** Cael / `cael-dgx` (DGX Spark, ARM64)  
**Verdict:** ✅ PASS — bare token-form parsed from subagent final text and scheduled continuation work on the deployed SHA.

## Fire

A lightContext subagent was instructed to emit exactly:

```text
CONTINUE_WORK:90
```

The parent-visible child result had no output, which is expected when the token is consumed by the continuation scanner rather than delivered as prose.

## Byte

Gateway journal `token_parse_journal.txt` records the token parse and scheduling:

```text
[continuation:trace] payload-scan: count=1 bracketIdx=0 [0]text=false session=agent:main:subagent:f9f65c28-628d-4be5-a2db-536c9758ef20
[continuation:trace] bracket-parse: kind=work delayMs=90000 session=agent:main:subagent:f9f65c28-628d-4be5-a2db-536c9758ef20
[continuation:trace] effective-signal: origin=bracket kind=work session=agent:main:subagent:f9f65c28-628d-4be5-a2db-536c9758ef20
[continuation:work-hedge-armed] fireIn=89998ms fireAt=1782582180693 session=agent:main:subagent:f9f65c28-628d-4be5-a2db-536c9758ef20
```

This row exercises the token/bracket fallback surface, distinct from R-CW-1's tool-form. It proves parse + scheduling on the deployed 191a gateway; it does not wait 90 seconds for the subagent-local follow-up turn to execute, because the row's required byte is scanner acceptance and work scheduling.
