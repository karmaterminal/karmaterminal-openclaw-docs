# RESOLVED-SHA.md

## SHA identity

| Field | Value |
|---|---|
| CANDIDATE_SHA | `f98255262de62b8f1c49cc06cc38db67d6eb8d00` |
| PR | [openclaw/openclaw#79925](https://github.com/openclaw/openclaw/pull/79925) |
| Branch | `frond-scribe-claude/20260509/narrow-surgery-tight` (karmaterminal/openclaw fork) |
| Bundle parent | `e00cb664ad4bd346866dfb1ad863e7b6c72dd7e6` (openclaw/openclaw:main) |
| Force-push lease byte | `a181f57daaca74bfa946917532d14b222bf87158` |

## Bundle commits (3)

| SHA | Description |
|---|---|
| `75a09beab50b3f5c2ee1be9e6815489224659c51` | feat(continuation): context-pressure-aware continuation (continue_work / continue_delegate / request_compaction) |
| `5299ed21481f121ee702b58cc9e2bbbc4f70e5d8` | test(vitest): isolate agents-core shard with fileParallelism: false |
| `f98255262de62b8f1c49cc06cc38db67d6eb8d00` | test(codex): align expected-output with redaction implementation |

## Gate verdicts

| Gate | Receipt | Verdict |
|---|---|---|
| 1 — Savegame verification | `git ls-remote` | ✅ `savegame/f98255262d` resolves to `f98255262de62b8f1c49cc06cc38db67d6eb8d00` |
| 2 — Cure-bytes 4path | `cure-bytes/gate-4a-cure-bytes-4path.log` | ✅ 356 files / +41082 / -2323 vs upstream parent |
| 3e — vitest full-suite | `gates/gate-3e-pnpm-vitest.log` | 8 failed / 60320 passed / 53 skipped — all 8 byte-confirmed upstream-class |
| upstream-baseline broken-class | `gates/upstream-main-broken-class-receipt.log` | 9 failed / 60320 passed on bare upstream `e00cb664ad` |
| 4 — PROOFS corpus | this directory | ✅ assembled |

## Failure attribution summary

PR-head retains 8 upstream-inherited test failures, all byte-confirmed on `openclaw/openclaw:main` at `e00cb664ad`:

- `agents-core/cli-runner.reliability` (1)
- `agents-pi-embedded/model.forward-compat` (2)
- `extension-msteams/reply-dispatcher` (2) + `reply-stream-controller` (1)
- `infra/session-cost-usage` (1) — intermittent
- `tooling/bench-gateway-restart` (1) — intermittent

PR-head bytes fix one upstream regression:

- `runtime-config/io.write-config` (1) — PR-head passes, bare upstream fails

Zero PR-introduced failures.
