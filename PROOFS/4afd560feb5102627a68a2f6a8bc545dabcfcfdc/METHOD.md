# Method — Project 81 exact-4afd proof cycle

## Identity

- **Assembly / proof SHA:** `4afd560feb5102627a68a2f6a8bc545dabcfcfdc`
- **Assembly branch:** `scribe/20260709/1172-status-row-assembly`
- **Seed corpus:** `9c6690710c6687c52b93260529932d0c70f58707`
- **Current rollup:** `29 pass / 1 partial / 1 honest_limit / 4 missing`

## Sequence

1. Complete contained CI and Gate 2.7 on the exact assembly SHA.
2. Deploy that exact SHA to the authorized canary, then fleet only with group
   direction.
3. Run one bounded R-CD trace smoke before changing the harness. The old null
   artifacts were produced before the runtime trace repair.
4. If collection is healthy, proceed with assigned exact-SHA rows.
5. Preserve raw Actions artifacts and exact Tempo JSON.
6. Review evidence before changing a row state.
7. Commit each reviewed fold directly to docs `main`.
8. Re-run the corpus validator after every manifest change.

## Trace acceptance

- Trace ID: exactly 32 lowercase hexadecimal characters and not all zero.
- Span ID: exactly 16 lowercase hexadecimal characters and not all zero.
- Delayed fire and paired dispatch/work: same trace ID, distinct span IDs.
- Context provenance: internally captured; never model/prince supplied.
- Attribution: deterministic row/run/session receipt, not timing alone.

## Row classification

- `pass`: reviewed exact-SHA evidence, or an explicit unchanged-surface carry.
- `partial`: some required exact-SHA evidence exists, but a receipt remains
  absent.
- `missing`: exact-SHA row has not been fired.
- `honest_limit`: only the documented context-pressure compaction limit.

## Harness reassessment

`karmaterminal-openclaw-docs#398` is an observation point, not a pre-deploy
blocker. Do not modify the R-CD harness unless the fixed exact runtime still
reproduces attributable-trace collection failure.
