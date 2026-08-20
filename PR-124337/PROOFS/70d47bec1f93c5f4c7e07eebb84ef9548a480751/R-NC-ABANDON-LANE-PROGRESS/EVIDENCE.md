# R-NC-ABANDON-LANE-PROGRESS

**State:** pass (unit).

## Contract

Same-lane follower is blocked while a genuine abandoned head is unbounded.
Follower is adopted only after the head terminalizes.

## Observed (fresh)

| Runtime | After 8 genuine abandons | Next drain |
| --- | --- | --- |
| Exact base | Head still pending (`listFailed=[]`). Fossil RED. | Follower not adopted. |
| `70d47bec` | Head is `retry-limit-exceeded`. | Follower adopted. |

The P1 mixed-cancel test then plants a poison+follower pair and asserts the
same unblocking after genuine abandon (receipt 03), proving cancel-compat
does not disable dead-letter.

## Receipts

- [01-base-fossil-red.txt](../receipts/01-base-fossil-red.txt)
- [02-head-fossil-green.txt](../receipts/02-head-fossil-green.txt)
- [03-head-mixed-cancel-green.txt](../receipts/03-head-mixed-cancel-green.txt)

## Not claimed

Live same-lane recovery.
