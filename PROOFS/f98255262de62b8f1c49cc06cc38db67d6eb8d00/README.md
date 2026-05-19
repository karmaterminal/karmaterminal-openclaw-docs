# PROOFS Corpus — `f98255262de62b8f1c49cc06cc38db67d6eb8d00`

PR #79925 (openclaw/openclaw) — Agent self-elected turn continuation.

## SHA identity

| Field | Value |
|---|---|
| PR-head SHA | `f98255262de62b8f1c49cc06cc38db67d6eb8d00` |
| upstream/main parent | `e00cb664ad4bd346866dfb1ad863e7b6c72dd7e6` |
| Bundle | 3 commits: feat(continuation) + test(vitest) agents-core fileParallelism + test(codex) event-projector alignment |

## Verdict table

| Gate | Receipt | Result |
|---|---|---|
| 3e — vitest full-suite at PR head | `gates/gate-3e-pnpm-vitest.log` | 8 failed / 60320 passed / 53 skipped (61281 tests across 5518 files) — all 8 failures byte-confirmed upstream-class |
| upstream-main broken-class baseline | `gates/upstream-main-broken-class-receipt.log` | 9 failed / 60320 passed on `e00cb664ad` — 8 match PR-head failures; PR-head fixes `runtime-config/io.write-config` |
| 4a — cure-bytes 4path diff | `cure-bytes/gate-4a-cure-bytes-4path.log` | 356 files / +41082 / -2323 vs upstream parent |

## Failure attribution

8 PR-head failures, all byte-confirmed on bare upstream `e00cb664ad`:

| File | PR-head | upstream | Class |
|---|---|---|---|
| `agents-core/cli-runner.reliability.test.ts` | ❌ | ❌ | upstream-class |
| `agents-pi-embedded/model.forward-compat.errors-and-overrides.test.ts` (×2) | ❌ | ❌ | upstream-class |
| `extension-msteams/reply-dispatcher.test.ts` (×2) | ❌ | ❌ | upstream-class |
| `extension-msteams/reply-stream-controller.test.ts` | ❌ | ❌ | upstream-class |
| `infra/session-cost-usage.test.ts` | ❌ | ❌ | upstream-class (intermittent) |
| `tooling/bench-gateway-restart.test.ts` | ❌ | ❌ | upstream-class (intermittent) |
| `runtime-config/io.write-config.test.ts` | ✅ | ❌ | PR-head fixes upstream regression |

## Reproducer

```bash
# Bare upstream baseline
git checkout e00cb664ad4bd346866dfb1ad863e7b6c72dd7e6
pnpm install --frozen-lockfile
NODE_OPTIONS='--max-old-space-size=33000' OPENCLAW_VITEST_MAX_WORKERS=16 pnpm vitest run

# PR head
git checkout f98255262de62b8f1c49cc06cc38db67d6eb8d00
pnpm install --frozen-lockfile
NODE_OPTIONS='--max-old-space-size=33000' OPENCLAW_VITEST_MAX_WORKERS=16 pnpm vitest run
```

Full methodology in `METHOD.md`.
