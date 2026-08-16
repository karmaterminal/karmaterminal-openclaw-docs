# Receipts

Immutable command/exit logs from the M1 implementation/review lane. Host-private
absolute paths were substituted (`<product-worktree>`, `<tmp>/…`, `<host-path>`).
Original staged SHA-256 values are in `../SHA256SUMS`.

| File | Step | Exit |
| --- | --- | ---: |
| `01-base-red-5626a79.txt` | exact base + fossil | 1 |
| `02-patched-green-fossil.txt` | patch + fossil | 0 |
| `03-channels-shard-green.txt` | channels owner shard | 0 |
| `04-patch-only-revert-red.txt` | revert production hunk | 1 |
| `05-reapply-green.txt` | reapply drain tests | 0 |
| `06-fossil-equivalence.txt` | executable-surface identity | — |
| `07-negative-control-shards.txt` | discord/line/plugin-sdk/auto-reply | *condensed* |
| `08-full-suite.txt` | `node --import tsx scripts/test-projects.mts` | 1 (15 classified reds) |
| `production-hunk.patch` | `+10/-5` production delta | — |

`07` is published **byte-identical to the staged original**. That original is a
four-block vitest summary (file counts + durations) without a runner command or
`EXIT=` line. This publication does not invent the missing full shard logs.

`08` is the raw 539-shard log and includes the **pre-retarget** Microsoft Teams
FAIL (`preserves abandon retry accounting…` expected pending `attempts: 8`,
received `[]`). Dedicated post-retarget MS Teams command logs were not in the
staged receipt set.

Fixture identifiers inside assertion diffs are synthetic. No credentials, live
session/channel/account IDs, or raw message payloads are present.
