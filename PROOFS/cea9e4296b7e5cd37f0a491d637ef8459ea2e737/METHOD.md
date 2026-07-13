# Method — Project 81 exact-cea9e42 proof cycle

## Identity

- **Assembly / proof SHA:** `cea9e4296b7e5cd37f0a491d637ef8459ea2e737`
- **Assembly branch:** `scribe/20260712/1172-a177-upstream-absorb`
- **Immediate prior corpus:** `2e7861ba45fd8534282aadabab2b855d2f524fdf`
- **Current rollup:** `6 pass / 1 partial / 28 missing`

## Sequence

1. Complete contained CI and Gate 2.7 on the exact assembly SHA.
2. Deploy that exact SHA to all four authorized prince seats without a pilot,
   per figs's direction.
3. Run bounded assigned rows only after the fresh exact-SHA ledger is posted.
   Do not carry exact-`2e7861b` continuation-tool results across this repair.
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
- Codex result status: originating tool span completed, with no
  `codex_dynamic_tool_error`.

## Row classification

- `pass`: reviewed exact-SHA evidence, or an explicit unchanged-surface carry.
- `partial`: some required exact-SHA evidence exists, but a receipt remains
  absent.
- `missing`: exact-SHA row has not been fired.
- `honest_limit`: only the documented context-pressure compaction limit.

## Harness reassessment

`karmaterminal/karmaterminal-openclaw-docs#398` remains the collection
observation point. Collector repairs must retain raw public-safe tool results
and deterministic trace attribution; assistant-authored sentinels alone do not
prove a structured tool result.
