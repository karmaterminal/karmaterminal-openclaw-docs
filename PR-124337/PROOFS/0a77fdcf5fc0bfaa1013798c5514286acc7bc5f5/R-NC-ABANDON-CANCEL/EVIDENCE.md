# R-NC-ABANDON-CANCEL

**State:** pass (unit). GREEN on exact base **and** on the patch.

## Contract

Intentional cancellation / shutdown stays budget-free. `onCancelled` must not
enter `applyFailureDisposition` and must not dead-letter a row that is already
at the attempt ceiling.

## Observed

Fossil `leaves cancellation budget-free even at the attempt ceiling`:

1. Seed the row to `attempts = maxAttempts - 1` via `queue.release`.
2. Defer and call `onCancelled` three times, advancing the clock past the cap.
3. Pending retry facts stay `{ attempts: 7, lastError: "turn-abandoned" }`.
4. `listFailed` stays `[]`.

Sibling control `keeps an abandoned claim retryable below the attempt ceiling`
still passes: seven abandons leave a pending row, not a dead letter.

Production path is unchanged:
`settleUnadopted(state, (claim) => releaseClaim(claim, { recordAttempt: false }))`.

## Receipts

The cancel control is the 3rd of 5 fossil tests (GREEN in both RED and GREEN
walks):

- [01-base-red-5626a79.txt](../receipts/01-base-red-5626a79.txt) — 4 passed including cancel
- [02-patched-green-fossil.txt](../receipts/02-patched-green-fossil.txt) — 5 passed
- [05-reapply-green.txt](../receipts/05-reapply-green.txt) — 32 passed

## Not claimed

Live shutdown/cancel on a running Gateway.
