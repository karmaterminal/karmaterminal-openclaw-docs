# R-NC-ABANDON-LANE-PROGRESS

**State:** pass (unit). **Authority:** same fossil as R-NC-ABANDON-BUDGET.

## Contract

A poison pre-adoption head must not starve later work in the same FIFO lane.
Row B is blocked while row A is unbounded; row B progresses only after row A
terminalizes.

## Observed

Fixture: `source-message-head` then `source-message-follower` on the same
synthetic lane key.

| Runtime | After 8 `onAbandoned` passes on the head | Next `drainOnce` |
| --- | --- | --- |
| Exact base `5626a79` | Head still pending (`listFailed=[]`). The intended-contract test is RED. | Follower is not adopted. |
| Patch / reapply | Head is a `retry-limit-exceeded` dead letter. | `adopted === ["source-message-follower"]`, `listPending=[]`. |

Unrelated-lane control (GREEN on base and patch): a neighbour lane completes
on its first pass and is never re-dispatched by the abandonment loop.

## Receipts

- Base block: [01-base-red-5626a79.txt](../receipts/01-base-red-5626a79.txt)
- Patch progress: [02-patched-green-fossil.txt](../receipts/02-patched-green-fossil.txt)
- Reapply: [05-reapply-green.txt](../receipts/05-reapply-green.txt)

## Not claimed

Live same-lane recovery on a deployed Gateway. Isolated state-dir smoke pending.
