# Method and proof boundary

## Exact source

An independent detached source root was checked out at
`4435e132ffb5b7d34fa05ad2c9bc275a24f565e9`. A frozen install used the
repository-pinned pnpm 11.22.0 lockfile, the product built successfully, and
`dist/build-info.json` named the same commit.

## Deterministic P1 control

The exact-head real-SQLite pending-disposition owner test was run with:

```text
node scripts/run-vitest.mjs run --config vitest.config.ts --maxWorkers=1 src/channels/message/ingress-drain-pending-disposition.test.ts
```

Result: one file, four tests passed. The table-driven regression exercised both
a synchronous throw and rejected promise from the committed receipt observer.
For both forms it proves the stale row remains terminally failed, the observer
failure reaches the existing drain log path, and the later fresh row is
dispatched by the same drain.

The accepted exact-head shared owner/sibling rerun passed 88/88 tests across the
pending-disposition owner, generic ingress monitor, Discord, and Signal.

## Single live run

A fresh state root, Discord account binding, SQLite queue, workspace, gateway
port, transient unit, OTel service name, channel, and session were created.
Exactly two same-lane source rows were seeded before the gateway started:

1. a controlled-aged row with positively ambient Discord classification;
2. a fresh addressed row received one millisecond later.

The transient gateway was started once. Collection stopped after the stale
terminal receipt, fresh completed queue state, one completed isolated model
turn, and one visible response converged. There was no reseed, behavior retry,
second gateway start, or second proof run.

## Runtime contract

The exact build installed `@openai/codex` 0.149.1. Direct inspection of Codex
tag `rust-v0.149.1` at
`ff29a44391deccde0aba0f8390337d7f3c319ea4` established:

- `codex-rs/app-server-protocol/src/protocol/v2/turn.rs:66-168` defines a
  `turn/start` request with one thread ID and returns the started turn.
- `codex-rs/app-server-protocol/src/protocol/common.rs:1831-1834` maps typed
  `turn/started` and terminal `turn/completed` notifications.
- `codex-rs/app-server/tests/common/test_app_server.rs:1032-1071` waits for the
  `turn/completed` notification whose thread ID and turn ID match the turn
  returned by `turn/start`.

The isolated Codex state/log projection contained one thread, one turn context,
one user event, one assistant event, one task completion, and one
`turn/completed` notification for `openai/gpt-5.6-sol`. The only
`codex_core::client` sampling row had no retry or error marker. No raw rollout,
log body, prompt, or response is included here.

## Broader exact-head context

Mode-B run `33043848497` used workflow commit
`342cc9c6d190e1ba57d9995d29e394c993a3e79b`: 168,518 passed, 42 failed, one
load flake greened, and 164 summaries were collected. All 42 failures were
classified outside the three-file P1 delta. This packet does not relabel those
failures as green.
