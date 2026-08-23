# PR #124337 exact-source proof corpus

This corpus is bound to accepted feature source
`4ff99f7e5c149d90214a3df932f9d5adb438b835`. The executing runtime is the
separately disclosed composite
`6e6da7bba079b0fc50d134b96657cda683985837`.

No row may claim that a prince ran the source SHA. Each live receipt must bind
both identities and verify the installed checkout plus `dist/build-info.json`
before executing.

## Current state

| Row | Contract | State |
| --- | --- | --- |
| `A-GENUINE-ABANDONMENT` | Genuine pre-adoption abandonment spends the existing retry budget, terminalizes at the configured ceiling, and releases the same-lane follower. | missing |
| `B-BUDGET-FREE-CANCELLATION` | Explicit cancellation preserves prior retry facts and never dead-letters. | missing |
| `C-MIXED-FANIN-SEPARATION` | Capable and legacy fan-in cancellation stays budget-free while a separate genuine abandonment still terminalizes. | missing |

The corpus-local harness uses production queue, drain, retry, and Plugin SDK
fan-in code from the installed composite. It writes public-safe receipts,
bounded journals, raw SQLite row projections, and database hashes. Runner
output is candidate evidence only until the final fold reviews each row.

## Files

- [`METHOD.md`](METHOD.md)
- [`RESOLVED-SHA.md`](RESOLVED-SHA.md)
- [`SOURCE-COMPOSITE-NON-INTERFERENCE.md`](SOURCE-COMPOSITE-NON-INTERFERENCE.md)
- [`proofs-manifest.json`](proofs-manifest.json)
- [`harness.mjs`](harness.mjs)
