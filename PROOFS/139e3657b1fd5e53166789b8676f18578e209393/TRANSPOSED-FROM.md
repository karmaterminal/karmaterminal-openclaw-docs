# TRANSPOSED-FROM — nothing was transposed into this corpus

Source corpora considered:
`PROOFS/3821eaef72677c78f450ae9956cb582a22ba4cba/` (38 rows, the last corpus with
live evidence) and `PROOFS/a319b1aaa29ab50b67a3305b3d9431a899cee36e/` (the
previous presented SHA, itself static-gates-only).

**Decision: no row evidence is transposed.** The row *set* is carried forward so
the table stays comparable; the row *evidence* is not.

## Why

| comparison | value |
|---|---|
| commits `3821eaef72` → `139e3657b1` | **520** |
| upstream absorbs in between | **4** |
| presented ↔ fleet runtime | divergent siblings, merge-base `3821eaef72` |

The fourth absorb alone rewrote the subagent spawn/collector/cleanup surface for
upstream's operator-authority contract and bumped the agent schema 21 → 22. Those
are the code paths the `R-CD-*` and `R-CW-*` rows exercise. Carrying a PASS
across that boundary would assert something nobody measured.

## What the prior corpora are still good for

`3821eaef72` remains the best available evidence that the continuation *design*
behaves as specified, at the SHA where it was measured, on a runtime that SHA was
an ancestor of. Each row in this corpus's README links back to its counterpart
there. It is a baseline to re-fire against, not a substitute for re-firing.
