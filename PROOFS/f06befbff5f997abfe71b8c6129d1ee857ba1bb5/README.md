# PROOFS / f06befbff5f997abfe71b8c6129d1ee857ba1bb5

PR #79925 drift-cure-N+1 ship candidate. Driver-baton 🌊 ronan → 🌿 frond-scribe at byte 2026-05-20 ~20:38Z (`1506746480`). 🩸 cael drove gates 3a/b/c GREEN + dup-runId 3-line fix; background exec died silently on 3e/3f; frond-scribe-seat re-fires.

## CANDIDATE_SHA

`f06befbff5f997abfe71b8c6129d1ee857ba1bb5`

Branch: `karmaterminal/openclaw:refs/heads/savegame/20260520-2034Z/pr79925-runid-dup-fix-candidate-f06befbff5`

## Substrate

- **PR-head (prior)**: `55c0ed67a5b89c0e3a99e3e862968a5e1aeabc26` (cure-N ship; reviewer LGTM-substrate present in cohort's PROOFS at `../55c0ed67a5b.../README.md`)
- **upstream/main HEAD**: `1a7669bc63 fix: update fs-safe fallback dependency`
- **upstream drift since prior cure baseline** `a13468320c` → `1a7669bc63`: **4 new commits** including `950e5c8c50 fix(agents): credit delivered subagent completions (#84383)` which introduced second `runId` declaration colliding with our cure-region `runId` declaration in `src/agents/openclaw-tools.ts`. CI's pr-merge-commit failed typecheck (`TS2300: Duplicate identifier 'runId'`); local-on-pr-head-alone tsgo was clean. Diagnosis-trail: PR #79925 CI run `26181915034` headSha=`55c0ed67a5b` (3 cure-region TS errors cascaded into 18 CI shard failures; 1 unrelated upstream-class failure in `src/security/windows-acl.test.ts` diacritic-class).
- **savegame (pre-drift-cure-N+1)**: `refs/heads/savegame/20260520-1413Z/pr79925-pre-drift-cure-mainHEAD` (continues to point at `f98255262d` per scribe's earlier savegame; 🩸's cure-N at `55c0ed67a5b` is in `refs/heads/savegame/20260520-1518Z/...` per cohort substrate)

## Cure-bytes (delta from prior PR-head 55c0ed67a5b)

3-line dup-runId fix per 🩸:
- `src/agents/openclaw-tools.ts` — remove duplicate `runId?: string;` declaration that collided with upstream's `950e5c8c50` agent-subagent-completion-credit fix
- `src/agents/pi-tools.ts` — remove duplicate object-literal property at line 1006

Single squash commit (per cohort's 2026-05-20 ship discipline: 1 commit on PR-presenting branch).

## Gate results

| Gate | Command | Status | Time | Notes |
|------|---------|--------|------|-------|
| 1 | savegame push | ✅ | — | `refs/heads/savegame/20260520-2034Z/pr79925-runid-dup-fix-candidate-f06befbff5` → `f06befbff5` (pushed by 🩸 cael-seat) |
| 3a | `pnpm install --frozen-lockfile` | ✅ | 1.9s | warm cache, scribe-seat |
| 3b | `pnpm tsgo` | ✅ | 6.1s | duplicate-runId fix clean against current upstream/main `1a7669bc63` |
| 3c | `pnpm tsgo:test` | ✅ | 22.4s | clean |
| 3d | `pnpm check` (lint) | ⚠️ upstream-class | — | 5 lint errors on `extensions/openrouter/provider-routing.ts` (`unicorn(no-useless-fallback-in-spread)`). VERIFIED upstream-class by 🌊 ronan from spark fresh-clone on bare upstream `1a7669bc63` per msg `1506750453`. Inherited unchanged per Gate 3e taxonomy. See `gates/gate-3d-upstream-class-receipt.md`. |
| 3e | `pnpm vitest run` (FULL) | ⏳ in-flight | TBD | scribe-seat, fired 2026-05-20T20:45:14Z with `NODE_OPTIONS=--max-old-space-size=33000` + `OPENCLAW_VITEST_MAX_WORKERS=4` per cure-(22) Lane A OOM canon. Expected ~45min. |
| 3f | `pnpm build` | ✅ | 1m8s | clean |

## Gate 2 (cure-bytes byte-identical preserved)

`f06befbff5` carries forward the same LGTM-substrate as `55c0ed67a5b` PLUS the 3-line dup-runId fix-bytes 🩸 authored. Range-diff receipt at `cure-bytes/range-diff-receipt.md` (to be filled in once 3e green).

## Behavioral proof rows (TBD)

Per cohort's `55c0ed67a5b` PROOFS at `../55c0ed67a5b89c0e3a99e3e862968a5e1aeabc26/README.md`: 8/8 R-* rows green at `2d8ed4a9ac31`. **Squash invariant**: continuation-feature runtime bytes unchanged across `2d8ed4a9ac → fe241bd5a1 → 55c0ed67a5b → f06befbff5` (the 3-line fix removes dead duplicate declarations only; no runtime delta). Behavioral PROOFS receipts transfer at byte to `f06befbff5`.

## Cohort cosign (TBD per Gate 4)

- 🌊 ronan: path-a/path-c ready from spark (byte-cosign-prepared per `1506746480`)
- 🩸 cael: path-a from cael-seat (gates already fired locally + savegame pushed)
- 🌫 silas: path-b end-state-proofs-read ready
- 🌻 elliott: path-b end-state-proofs-read ready

## figs sanction (TBD at Gate 5)

Pending pre-push-INTENT surface + figs explicit go-signal. Lease byte: `--force-with-lease=frond-scribe-claude/20260509/narrow-surgery-tight:55c0ed67a5b89c0e3a99e3e862968a5e1aeabc26`.

🌿 frond-scribe driver
