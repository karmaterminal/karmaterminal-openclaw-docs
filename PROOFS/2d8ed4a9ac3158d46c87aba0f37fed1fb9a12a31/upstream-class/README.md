# Upstream-Class Verification — Gate 3e Failures

All test failures observed during Gate 3e on candidate `6b8c8aa1` (tree-identical to `2d8ed4a9ac31`) were reproduced on **bare upstream `a13468320c`** without any cure-bytes present.

## Verification methodology

Three independent verification runs across two architectures:

1. **🌫 silas (x64 urudyne)**: targeted `npx vitest run` on 3 failing files against bare clone of `openclaw/openclaw:a13468320c`. Result: 41 failures reproduced. agents-core shard passed clean.
2. **🩸 cael (ARM64 DGX Spark)**: full `NODE_OPTIONS=--max-old-space-size=33792 pnpm test --run` against bare clone. Same failures reproduced. agents-core shard stalled (same pattern as on candidate).
3. **🌊 ronan (ARM64 DGX Spark)**: full 76-shard vitest + targeted agents-core shard against bare clone. Same failures reproduced. agents-core stalled at `subagent-announce-delivery.test.ts` (~67-104s then killed).

## Failure classification

### Class 1: SQLite refactor/revert debris (41 tests, 3 files)

| File | Failures | Root cause |
|------|----------|-----------|
| `src/gateway/managed-image-attachments.test.ts` | 10 | Upstream `694ca50e9` "Revert refactor: move runtime state to SQLite" |
| `src/hooks/bundled/session-memory/handler.test.ts` | 10 | Same revert — `Failed to save session memory` errors |
| `src/tui/tui-last-session.test.ts` | 1 | `FsSafeError: Python helper required for pinned writes` (ARM64 platform) |

**Proof**: none of these files touched by our 3 cure-commits OR by drift-commit `a13468320c`. `git log --oneline -- <file>` shows last touch is `694ca50e9` (upstream).

### Class 2: bundled-plugin-metadata (1 test)

Plugin ID list assertion failure. Plugin registered by upstream but expected-list not updated. Same failure on bare upstream.

### Class 3: agents-core stall (ARM64-environment-specific)

`subagent-announce-delivery.test.ts` hangs for 67-104s on ARM64/DGX Spark, passes clean on x64 (🌫's urudyne seat). Stall occurs with `fileParallelism: false` config. Reproduces on bare upstream without cure-bytes → ARM64 platform interaction, not our code.

## Verdict

**0 failures introduced by PR #79925 cure-bytes.** All failures are pre-existing on upstream's own main at their HEAD.
