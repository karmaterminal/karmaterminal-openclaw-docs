# PROOFS — `2d8ed4a9ac3158d46c87aba0f37fed1fb9a12a31`

**PR**: openclaw/openclaw#79925 `feat: context-pressure-aware continuation (continue_work / continue_delegate / request_compaction)`
**Branch**: `karmaterminal/openclaw:frond-scribe-claude/20260509/narrow-surgery-tight`
**Parent**: `a13468320c63573917c185db278f3d4e13389a78` (upstream main HEAD at time of push)
**Tree-hash**: `37d4e4edce8cb0b06c82c0b09a8392949e3b78b4`

## Status

| Gate | Result | Notes |
|------|--------|-------|
| Gate 1 — Savegame | ✅ | `refs/heads/savegame/20260520-1413Z/pr79925-pre-drift-cure-mainHEAD` → `f98255262d` |
| Gate 2 — Cure-bytes byte-identical | ✅ | `git range-diff` shows cure-bytes preserved; only context-offsets differ |
| Gate 3a — pnpm install | ✅ | `--frozen-lockfile`, 3.3s |
| Gate 3b — tsgo:core | ✅ | exit 0 (after L48 dead-import fix) |
| Gate 3c — tsgo:test | ✅ | exit 0 (after SessionStatus factory fix) |
| Gate 3d — pnpm check (lint) | ⚠️ upstream-class | 5× `unicorn(no-useless-fallback-in-spread)` in `extensions/openrouter/provider-routing.ts` — file from upstream `ac69776330`, not touched by PR |
| Gate 3e — full vitest | ✅ | 4977+ passed; 21 failures + 1 stall = ALL upstream-class (byte-proven, see `upstream-class/`) |
| Gate 3f — pnpm build | ✅ | exit 0, 1m25s |

## Squash invariant

`proofs-SHA == push-SHA`: `2d8ed4a9ac3158d46c87aba0f37fed1fb9a12a31`

Tree-hash match across parallel independent squashes:
- 🌊 ronan (pushed): tree `37d4e4edce8cb0b06c82c0b09a8392949e3b78b4`
- 🩸 cael (rejected by force-with-lease): tree `37d4e4edce8cb0b06c82c0b09a8392949e3b78b4`
- Pre-squash `6b8c8aa116ba` (Gate-3e-tested): tree `37d4e4edce8cb0b06c82c0b09a8392949e3b78b4`

## Commit-boundary cosign

3-prince squash cosign (🩸 + 🌊 + 🌫) applied. Single squash per `HOW_TO_DO_A_CLEAN_VERSION_UPDATE` canon.

## Lineage

```
f98255262d (cure-(24) ship, prior PR-head)
     ↓ drift-cure rebase onto a13468320c
8175cab2dd (candidate v2, L48 import-fix amended)
     ↓ rebase onto a13468320c (1 new upstream commit)
6b8c8aa116 (candidate v3, + SessionStatus factory fix, Gate-3e-tested)
     ↓ squash-to-1
2d8ed4a9ac (FINAL, force-pushed to PR-presenting branch)
```

## Cohort verification seats

| Seat | Platform | Verification |
|------|----------|-------------|
| 🌊 ronan (spark-ecdf) | ARM64/DGX Spark 128GB | Full vitest 33GB heap + upstream-bare verification |
| 🩸 cael (spark) | ARM64/DGX Spark 128GB | Parallel squash + upstream-bare agents-core verification |
| 🌫 silas (urudyne) | x64/WSL2 | Targeted upstream-bare 3-file proof + agents-core clean-pass on x64 |
