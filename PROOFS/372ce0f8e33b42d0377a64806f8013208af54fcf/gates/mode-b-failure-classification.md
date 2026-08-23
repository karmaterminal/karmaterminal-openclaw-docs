# Mode-B failure classification

## Exact runs

| Target | Run | Workflow SHA | Result |
|---|---|---|---|
| presentation `372ce0f8e33b42d0377a64806f8013208af54fcf` | `32650099821` | `6dd6c3a7712c8ae02937a29054525b2ddacb89c1` | failure: 163,506 passed / 38 failed; 16 deterministic |
| absorbed upstream `8578b8f55cf77ddb161891b662a02f8c8c2a80ba` | `32657627746` | `6dd6c3a7712c8ae02937a29054525b2ddacb89c1` | failure: 162,053 passed / 41 failed; 19 deterministic |

Both runs had 22 load flakes that greened on retry and valid receipts from all
69 routed jobs.

## Deterministic comparison

- Shared exact test identities: 13.
- Presentation-only: 3.
- Upstream-only: 6.

Presentation-only failures:

1. `test/scripts/telegram-mantis-sut.test.ts` - waits for the claimed runtime
   owner before returning from stop.
2. `src/tui/tui-pty-harness.e2e.test.ts` - preserves xAI account limit errors.
3. `src/tui/tui-pty-harness.e2e.test.ts` - renders redacted cause-aware send
   failures.

The 13 shared failures cover 12 TUI PTY local-backend cases and the
`doctor-lint` Crabbox-profile case. The six upstream-only failures are one
doctor SQLite UTF-16 case and five `install-sh` platform cases.

## Gate disposition

The shared failures classify a substantial inherited baseline class, but this
does not launder either run. Every deterministic failure keeps both terminal
Mode-B runs red.

The three presentation-only aggregate identities were reconciled from raw
logs and matched execution in
[`mode-b-three-test-reconciliation.md`](mode-b-three-test-reconciliation.md).
They classify as one host permission/fixture failure and two PTY timing/order
failures, not presentation-specific product regressions. The exact terminal
runs remain red; classification does not recolor them.

No continuation proof row was dispatched.
