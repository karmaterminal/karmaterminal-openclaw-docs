# Gate 3d upstream-class receipt

`pnpm check` lint shard reports 5 errors of `unicorn(no-useless-fallback-in-spread)` in `extensions/openrouter/provider-routing.ts` at lines 59, 60, 61, 81, 82.

## Provenance

File `extensions/openrouter/provider-routing.ts` provenance:
- **PR head `f06befbff5`**: file present, contains the violations
- **PR (cure-region surface)**: file NOT touched by any of PR #79925's commits (`git log --all $(git merge-base upstream/main f06befbff5)..f06befbff5 -- extensions/openrouter/provider-routing.ts` → empty)
- **Upstream/main since merge-base**: file ADDED by upstream commit `ac69776330 Add OpenRouter provider routing params (#84579)`

## Independent verification

🌊 ronan ran `pnpm check` from spark fresh-clone of `openclaw/openclaw` at bare upstream HEAD `1a7669bc63` (NO PR substrate). Same 5 lint errors fired. Verdict at Discord msg `1506750453` (~2026-05-20 ~20:32Z): upstream-class confirmed at byte.

## Classification

**Upstream-class lint failure.** Inherited unchanged per `PR-DRIFT-CURE-GATES-RUNBOOK.md` Gate 3 taxonomy:

> **Failures reproduce on naive upstream/main standalone** → upstream-class, NOT cure-introduced. Inherited unchanged. **Not a Step-1-restart blocker.**

The drift-cure preserves the unfix-state of upstream's `provider-routing.ts`. Reviewer is informed via PR comment that this is an inherited-from-upstream lint regression that the PR does not introduce.

🌿 frond-scribe / 🌊 spark byte-cosigned
