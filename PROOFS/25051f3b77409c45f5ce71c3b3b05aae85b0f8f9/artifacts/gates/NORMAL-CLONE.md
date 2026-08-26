# Source-ancestor 2ffc normal-clone receipt

Every 2ffc identity below is exact source-corpus qualification, not an exact
warm-target 25051 receipt.

| Field | Value |
|---|---|
| Product | `karmaterminal/openclaw@2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a` |
| Checkout class | Fresh normal clone, not a linked worktree |
| Dependency gate | `pnpm install --frozen-lockfile` — PASS |
| Production types | `pnpm tsgo` — PASS |
| Full test types | `pnpm tsgo:test` — PASS |
| Complete check | `pnpm check` — PASS |
| Full build | `pnpm build` — PASS |
| Final tracked state | Clean |

This is the accepted exact-source normal-clone handoff recorded by the product
gate lane before corpus transposition. The docs lane did not rerun or reinterpret
it. The independent heartbeat review cites the same direct evidence and remains
separately vendored as [`HEARTBEAT-MERGE-REVIEW.md`](HEARTBEAT-MERGE-REVIEW.md).
