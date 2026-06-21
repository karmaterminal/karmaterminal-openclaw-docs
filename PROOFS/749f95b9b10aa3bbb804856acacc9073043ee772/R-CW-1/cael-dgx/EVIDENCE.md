# R-CW-1 — cael-dgx: single bare self-continuation via bypass (ship-SHA 749f95b)
**Ship-SHA:** `749f95b9b10aa3bbb804856acacc9073043ee772`
**Verdict:** ✅ PASS — single `continue_work` → 1 continuation flow_run, fresh-subagent bypass, drain-INDEPENDENT.
## Byte (flow_runs DB)
```
280d9f95-...  queued  R-CW-1-FIRE-CAEL-749f95b — single bare self-continuation hop-1
```
One bare `continue_work` from a fresh lightContext subagent (own key, 0 queued) scheduled a real hop-2 continuation. Session-agnostic per-turn behavior. Bypass-able.
