# R-CW-TOKEN — bare `CONTINUE_WORK:N` token-form (cael-dgx)

**SHA:** `82827d3cbcba92ff6e19863b30615db028c2651c`  
**Seat:** Cael / `cael` (DGX Spark, ARM64)  
**Verdict:** ✅ PASS — bare token-form parsed from subagent final text and scheduled continuation work on the deployed SHA.

## Fire

A lightContext subagent was instructed to emit exactly:

```text
CONTINUE_WORK:90
```

No prose was delivered because the token was consumed by the continuation scanner.

## Byte

Gateway journal (`../R-CW-4/cael-dgx/journal-continuation-window.txt`) records the token parse and scheduling:

```text
[continuation:trace] payload-scan: count=1 bracketIdx=0 ... session=agent:main:subagent:5aaee1ea-2558-4860-be8d-74c5a588e2a3
[continuation:trace] bracket-parse: kind=work delayMs=90000 ...
[continuation:trace] effective-signal: origin=bracket kind=work ...
[continuation:work-hedge-armed] fireIn=89990ms ... session=agent:main:subagent:5aaee1ea-2558-4860-be8d-74c5a588e2a3
```

Tempo search/fetch found the corresponding `continuation.work` spans for the 90s token chain:

- `trace-e7b697891a3089c76f347d2a07c408e.json` — `delay.ms=90000`, `chain.step.remaining=199`
- `trace-f7bb4ceb950948a39ab9e7f0db3d75a9.json` — `delay.ms=90000`, `chain.step.remaining=198`, stable chain id `76ad48ec-4670-4a97-8d21-a753055a89f7`
- `trace-ddbf440d8337d4bc6f7ba46383d30cdf.json` — `delay.ms=90000`, `chain.step.remaining=197`, stable chain id `76ad48ec-4670-4a97-8d21-a753055a89f7`

This row exercises the token/bracket fallback surface, distinct from R-CW-1's tool-form.
