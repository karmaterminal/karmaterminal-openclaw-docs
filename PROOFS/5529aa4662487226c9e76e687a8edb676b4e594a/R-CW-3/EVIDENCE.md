# R-CW-3 — continue_work reason-field captured in OTel span

**Owner:** 🩸 Cael (cael-dgx, canonical-owner; 🕯 Emeric cross-walks at R-CW-3/emeric-nuc/)
**SHA:** 5529aa4662487226c9e76e687a8edb676b4e594a (deployed, canary)
**Verdict:** ✅ PASS

## What this proves
The `reason` argument passed to `continue_work()` is captured into the OTel/Tempo span as a
queryable attribute (`reason.preview`). This is the PR #759 domain — the continuation reason is
observable in the trace, not lost.

## Evidence (span_attributes.txt, from the R-CW-1 fire trace d210b53e4fb4cfed1d58d70164b61c6c)
```
reason.preview = {"stringValue":"PROOFS R-CW-1 fire: continue_work wake + deploy-persistence proof (CANDIDATE_SHA"}
```
The exact `reason` I passed to `continue_work()` ("PROOFS R-CW-1 fire: continue_work wake + deploy-persistence proof...") surfaces verbatim as the `reason.preview` span attribute on the `continuation.work` / `openclaw.continuation` spans. Captured + queryable in Tempo.

Span: `continuation.work` (under `openclaw.continuation`). Trace: http://tempo.dandelion.cult/api/traces/d210b53e4fb4cfed1d58d70164b61c6c
