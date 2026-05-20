# PROOFS / 8175cab2dd9bc93408537699c4a5f336fb9eef60

PR #79925 drift-cure ship candidate. Single-driver scribe-class per figs's 2026-05-20 "deal with drift" directive (post-powerloss-recovery byte).

## CANDIDATE_SHA

`8175cab2dd9bc93408537699c4a5f336fb9eef60`

Branch: `karmaterminal/openclaw:refs/heads/savegame/20260520-1432Z/pr79925-drift-cure-candidate-8175cab2-typecheck-clean`

## Substrate

- **PR-head (prior)**: `f98255262de62b8f1c49cc06cc38db67d6eb8d00` (cure-(22)→(24) ship; reviewer LGTM-substrate present)
- **upstream/main HEAD**: `c8a953af93` (fix: keep cron final output over tool warnings)
- **merge-base**: `e00cb664ad`
- **drift size**: 143 upstream commits since merge-base; 3 PR commits replayed
- **savegame (pre-drift)**: `refs/heads/savegame/20260520-1413Z/pr79925-pre-drift-cure-mainHEAD`

## Conflict footprint

24-file conflict-risk intersection; actual rebase produced **1 content-conflict** at `src/auto-reply/reply/agent-runner-execution.ts` (line 47 import-block region). All 23 other intersection files auto-merged cleanly.

**Resolution**: kept `isMessagingToolSendAction` (upstream added; used at file line 2149) + `EmbeddedPiCompactResult` (PR added; used at file line 157). Dropped upstream's `runEmbeddedPiAgent` static import — our PR's `feat(continuation)` commit deliberately removed the static call site in favor of dynamic-import-only (PR-head version confirms via `git show f98255262d:src/auto-reply/reply/agent-runner-execution.ts | grep runEmbeddedPiAgent` → zero static import line).

Receipt: `cure-bytes/conflict-resolution-line-48-import-block.md`.

## Gate results

| Gate | Command | Status | Time | Notes |
|------|---------|--------|------|-------|
| 3a | `pnpm install --frozen-lockfile` | ✅ | 3.3s | warm cache |
| 3b | `pnpm tsgo` | ✅ | 3s | (after fix; initial run failed TS6133 unused-import; cause: my conflict-resolution stale-resolution; corrected, see cure-bytes/) |
| 3c | `pnpm tsgo:test` | ✅ | 14s | clean |
| 3d | `pnpm check` | ⚠️ upstream-class | 35s | 5 lint errors all on `extensions/openrouter/provider-routing.ts` (file added by upstream commit `ac69776330`; PR did NOT touch). See `gates/gate-3d-upstream-class-receipt.md`. Per Gate 3 spec: inherited unchanged. NOT Step-1-restart-blocker. |
| 3e | `pnpm vitest run` (FULL) | ⏳ pending | TBD | running in background; verdict appended on completion |
| 3f | `pnpm build` | ✅ | 1m25s | clean |

## Gate 2 (cure-bytes byte-identical)

Verified via `git range-diff e00cb664ad..f98255262d c8a953af93..<CANDIDATE>`:

- Commit 1 `feat(continuation)`: `!` differs — only on import-block (resolution above) + 4-line upstream-class fold-in at `src/agents/subagent-announce.ts` (`runtime.error?.(...)` → `runtime.log("[warn]...")`; upstream-side migration, NOT our cure-bytes)
- Commit 2 `test(vitest)`: `=` identical patch
- Commit 3 `test(codex)`: `=` identical patch (note: line-48 unused-import fix amended onto this commit not the feat-commit; can be rebase-squashed before force-push if cohort prefers commit-boundary tidiness)

LGTM-substrate preserved. Receipt: `cure-bytes/range-diff-receipt.md`.

## Behavioral proof rows (TBD post-fleet-deploy)

Princes fire from own seats at CANDIDATE_SHA per `PROOF-CORPUS-METHOD.md`:
- R-CW (continue-work) — cael / scribe
- R-CD (continue-delegate) — ronan
- R-RC (request-compaction) — silas / cael
- R-OBS (observability) — elliott
- R-CD-CHAINED-DEPTH-2 — multi-seat

## Cohort cosign (TBD)

Per Gate 4: ≥2 non-driver seats verify via path-(b) end-state-proofs-read OR path-(c) independent-recreation. Sanction Discipline canon `1504142962` applies: cohort-cosign + broad-warrant; figs go-signal AT Gate 5 specifically.

## figs sanction (TBD at Gate 5)

Pending pre-push-INTENT announcement + figs go-signal.

🌿
