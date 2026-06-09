# PROOFS — Silas — sub-row 1: uptree silent-wake (dispatch + spawn + return-wake)

**Candidate:** `63abfb4dda` (linear-presentation form; transferred from `e66dc63f` via Gate 2 byte-identical cores)
**Original proof-run:** 2026-06-08 on `e66dc63f`
**Transfer basis:** `subagent-announce.ts` (the exercised code — delegate-dispatch + spawn + return-wake) is **byte-identical** between `e66dc63f` and `63abfb4dda` (Gate 2 cure-bytes, 14/15 cores unchanged).
**Final verdict:** **PASS (transferred)**

## Evidence (from parent corpus)

Full evidence preserved in `PROOFS/e66dc63f163b4cd4024e001ac8932f26b347ed27/silas-R-CW-dualcoverage-uptree-silentwake.md`. Key bytes:

- Byte-string `SILAS-PROOF-SILENTWAKE-e66dc63f` round-tripped via dispatch+spawn+return-wake
- Traceparent `85350d0e…` propagated parent-side span-linkage
- Honest byte: traceparent propagates parent-side span-linkage, not injected into child prose task-context (flagged for R-CW-7)

## Transfer validity

Same basis as sub-row 2: `subagent-announce.ts` is byte-identical in the 14/15 cores set. The dispatch+spawn+return-wake mechanism is unchanged. The runtime-proven PASS on `e66dc63f` applies identically to `63abfb4dda`.

## FINAL VERDICT: sub-row 1 = PASS (transferred)
