# Mode-B three-test matched reconciliation

## Identities

| Target | Run | Workflow SHA |
|---|---|---|
| presentation `372ce0f8e33b42d0377a64806f8013208af54fcf` | `32650099821` | `6dd6c3a7712c8ae02937a29054525b2ddacb89c1` |
| frozen upstream `8578b8f55cf77ddb161891b662a02f8c8c2a80ba` | `32657627746` | `6dd6c3a7712c8ae02937a29054525b2ddacb89c1` |

The exact failed tests are byte-identical:

- `test/scripts/telegram-mantis-sut.test.ts`:
  `c31fd7c70bfcc417ff6d3dfcea0de9e0ee9b3ebe`;
- `src/tui/tui-pty-harness.e2e.test.ts`:
  `06189d12d22d4f24fc0ef85362b9e11e9aa59d8c`.

The Mantis owner script, Mantis helper, TUI fixture, TUI entry point, chat log,
and command-surface helper are also byte-identical. Candidate-only TUI changes
are outside the failed producer/renderer path or add continuation lifecycle
coverage without changing these error fixtures.

## Exact artifact evidence

1. **Telegram Mantis stop-owner wait.** The presentation run failed before the
   owner-wait predicate because the copied fixture could not open
   `/run/lock/openclaw-mantis-sut-network.lock`; `lock_fd` was consequently
   unset. This is a host permission/fixture failure, not an owner-wait product
   result.
2. **xAI account-limit rendering.** The initial presentation pass timed out
   waiting for `monthly spending limit`, then the same run's bounded file retry
   passed. Frozen upstream exhibited the same initial timeout and later pass.
3. **Redacted cause-aware send failure.** The initial presentation pass timed
   out waiting for `send failed: gateway down`, then the same run's bounded
   file retry passed. Frozen upstream passed the identity.

The aggregate's presentation-only label records initial identities; it does
not override the raw retry evidence.

## Matched execution

Both immutable SHAs used the same ARM64 host, Node version, lockfile, package
manifest, repository runner, worker count, environment, test selection, and
order. Each command ran three times per SHA, alternating presentation and
frozen execution:

```text
node scripts/run-vitest.mjs run --config test/vitest/vitest.tooling.config.ts --maxWorkers=1 test/scripts/telegram-mantis-sut.test.ts -t 'waits for the claimed runtime owner before returning from stop'
node scripts/run-vitest.mjs run --config test/vitest/vitest.tui-pty.config.ts --maxWorkers=1 src/tui/tui-pty-harness.e2e.test.ts -t 'preserves xAI account limit errors|renders redacted, cause-aware send failures'
```

| Identity | Presentation | Frozen upstream | Classification |
|---|---:|---:|---|
| Telegram Mantis owner wait | 3/3 pass | 3/3 pass | host fixture/permission class |
| xAI account-limit rendering | 3/3 pass | 2/3 pass | PTY timing/order class reproduced on frozen |
| redacted cause-aware send failure | 3/3 pass | 3/3 pass | one-off PTY timing class |

Independent review confirmed all three classifications. No
presentation-specific product failure was proved by these identities.

This closes the bounded Mode-B classification question only. Gate 2.7 still
requires one product `RESTORE`, so no seed publication or live dispatch is
permitted.
