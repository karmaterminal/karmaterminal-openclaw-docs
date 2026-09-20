# RESOLVED-SHA — 3821eaef72677c78f450ae9956cb582a22ba4cba

| identity | value |
|---|---|
| presented / published SHA | `3821eaef72677c78f450ae9956cb582a22ba4cba` |
| executed runtime SHA | `1baff536afa549fea75660403c453bbd265352c0` |
| `exact_product_runtime` | false |
| presented is ancestor of runtime | **true** (`git merge-base --is-ancestor`) |
| docs / harness SHA | `45d301cb87c2e57634daf2fb78c7613d6afbc018` |
| prior board SHA | `7cb9d71f622250bedbf565e327bd7d7b9d90b567` (not an ancestor of the presented SHA) |

## Protected refs

Both protected refs resolve on `origin` to the presented SHA and were neither fast-forwarded nor
mutated by this cycle:

- `refs/heads/codeagent/85651-upstream-1ba243c8-gates` → `3821eaef72677c78f450ae9956cb582a22ba4cba`
- `refs/heads/ronan/20260916/p89-absorb-d8d7d53d` → `3821eaef72677c78f450ae9956cb582a22ba4cba`

## Composite parents

| commit | source |
|---|---|
| `131456cbae` | openclaw/openclaw#124337 — ingress cancellation through the reply terminal lifecycle |
| `1edf868b3a` | openclaw/openclaw#121204 — drop stale ambient gateway backlog before it claims a turn |
| `a6de2d2b78` | local integration repair — drain-level pending-disposition policy |
| `1baff536af` | local gate repair — discord gateway channel inventory enum |

The composite must never be presented upstream and must never be conflated with the continuation
feature; #121204 and #124337 carry their own proofs separately.

## Gate status

Gate receipts for this SHA live with the assembly that produced it; this corpus records proof-side
execution only. `execution_status = CANDIDATE_ONLY_NOT_ACCEPTANCE_COMPLETE`.
