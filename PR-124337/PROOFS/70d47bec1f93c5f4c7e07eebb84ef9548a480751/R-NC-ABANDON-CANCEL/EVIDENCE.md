# R-NC-ABANDON-CANCEL

**State:** pass (unit). This is the P1 row.

## Contract

1. Explicit `onCancelled` stays `releaseClaim({ recordAttempt: false })`.
2. Mixed fan-in of a capable lifecycle plus a bind-stripped legacy source
   (no `onCancelled`) must also stay budget-free. Public fan-in still calls
   `onAbandoned` for the legacy source; P1 wraps that call in
   `runIngressCancelCompat`.

## Fresh GREEN

[03-head-mixed-cancel-green.txt](../receipts/03-head-mixed-cancel-green.txt)
— 2 passed, including eight mixed cancels with both rows at `attempts: 0`.

[12-head-plugin-sdk-runtime.txt](../receipts/12-head-plugin-sdk-runtime.txt)
— 7 passed; fan-in cancel-compat coverage.

## Reverse RED (P1 coupling)

[09-reverse-mixed-cancel-red.txt](../receipts/09-reverse-mixed-cancel-red.txt)
— production files at exact-base hashes, tests at `70d47bec`. Capable cancel
still budget-free; **legacy** row becomes `attempts: 1` on the first pass.
EXIT=1.

Reapply: [10-reapply-green.txt](../receipts/10-reapply-green.txt) EXIT=0.

## Not claimed

Live Discord debounce cancel. Isolated Gateway smoke.
