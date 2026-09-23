# TRANSPOSED-FROM — nothing was transposed into this corpus

Source corpus considered: `PROOFS/3821eaef72677c78f450ae9956cb582a22ba4cba/`
(38 rows, rollup 23 pass / 9 partial / 0 thin / 0 fail at that SHA).

**Decision: no row evidence is transposed.** The row *set* is carried forward so the table is
comparable; the row *evidence* is not.

## Why

Transposition is honest when the two SHAs are close enough that the evidence still describes the
code that would run. That test fails here, and not marginally:

| comparison | value |
|---|---|
| commits `3821eaef72` → `a319b1aaa2` | **484** |
| upstream absorbs in between | **3** |
| total files differing | **13,956** |
| production files differing under `src/gateway/` + `src/agents/` | **1,280** |
| production files differing under `src/auto-reply/continuation/` | **3** |

The third absorb alone rewrote Gateway maintenance teardown (upstream `54abbae585`, #153636 —
`startGatewayMaintenanceTimers` stopped returning raw intervals, a new
`server-maintenance-lifecycle.ts` took over `clearGatewayMaintenanceHandles`) and the assistant-text
extraction path in `src/agents/embedded-agent-utils.ts` (lazy-thunk extraction,
`finalizeAssistantExtraction(errorContext, …)`). Those are the exact code paths the `R-CD-*` and
`R-CW-*` rows exercise.

Carrying a PASS across that boundary would assert something nobody measured. The rows are marked
`not_fired_at_this_sha` instead.

## What the prior corpus is still good for

It remains the best available evidence that the continuation *design* behaves as specified, at the
SHA where it was measured, on a runtime that SHA was an ancestor of. Each row row in this corpus's
README links back to its counterpart there. It is a baseline to re-fire against, not a substitute
for re-firing.
