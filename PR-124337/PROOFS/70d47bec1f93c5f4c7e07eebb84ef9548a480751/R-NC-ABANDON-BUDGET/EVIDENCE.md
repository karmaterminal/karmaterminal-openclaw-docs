# R-NC-ABANDON-BUDGET

**State:** pass (unit) on `70d47bec`. Fossil assertions unchanged by P1.

## Contract

Genuine `onAbandoned` (not fan-in cancel-compat) consumes the existing retry
budget. Eighth pass terminalizes `retry-limit-exceeded` / `turn-abandoned`.

## Fresh walk

| Head | Result | Receipt |
| --- | --- | --- |
| Exact base `5626a79` | RED — `listFailed` empty. EXIT=1 | [01](../receipts/01-base-fossil-red.txt) |
| Corrected head `70d47bec` | GREEN — 5/5. EXIT=0 | [02](../receipts/02-head-fossil-green.txt) |
| Production reverse to `5626a79` bytes | RED restored. EXIT=1 | [08](../receipts/08-reverse-fossil-red.txt) |
| Reapply `70d47bec` bytes | GREEN — 34 drain/cancel tests. EXIT=0 | [10](../receipts/10-reapply-green.txt) |

## CHARACTERIZES vs coupling

Fossil CHARACTERIZES born-broken upstream. Coupling is the three-file
production reverse/reapply, not the obsolete `0a77fdcf` suite log.

## Not claimed

Fleet heal. Isolated Gateway smoke.
