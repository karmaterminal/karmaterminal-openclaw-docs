# R-CW-TOKEN — cael-dgx: bare CONTINUE_WORK token-form via bypass (ship-SHA 749f95b)
**Ship-SHA:** `749f95b9b10aa3bbb804856acacc9073043ee772`
**Verdict:** ✅ PASS — bare `CONTINUE_WORK:90` token (NOT the tool-form) scheduled a continuation via stripContinuationSignal.
## Byte (flow_runs DB)
```
aa4f409a-...  queued  Continuation work (bare token CONTINUE_WORK:90, owner=subagent 0dee4c85)
```
A fresh lightContext subagent ended its response with the literal bare token `CONTINUE_WORK:90`. The deployed `stripContinuationSignal` (tokens.ts) parsed it + scheduled the continuation flow_run — proving the token-form path (distinct from the tool-form) drives on `749f95b`. Bypass-able.
