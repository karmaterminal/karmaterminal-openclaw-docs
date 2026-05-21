# Cure-N+3 follow-on: lint-fix force-push 47a7b494 → 642a33df

**Timestamp**: 2026-05-20 ~17:21 PDT (post-Gate-6 ship at `47a7b494`; ship-state CI surfaced 1 fail in `check-lint`)
**SHA before**: `47a7b4949ffd5cb5b800e1b78449cedc178d91d7` (cure-N+2 first ship; karmafeast committer; tree `ecb218532d`)
**SHA after**: `642a33df900289005afb221ae259458c9a511fd7` (cure-N+3 lint-fix; karmafeast committer)
**Force-with-lease**: anchored to `47a7b4949ffd5cb5b800e1b78449cedc178d91d7` ✓
**Savegame ref**: `karmaterminal/openclaw:refs/heads/savegame/20260521-0011Z/pr79925-cure-N3-lint-fix-642a33df`

## Why follow-on cure-cycle needed

Initial post-ship CI verdict on `47a7b4949f` reported:

```
87 pass / 18 skip / 1 fail
```

The 1 fail was the `check-lint` shard. Specific errors (oxlint `no-unnecessary-type-assertion`):

```
src/auto-reply/continuation/delegate-dispatch.chain-depth-exhaustion.test.ts:109:36 — (flow.revision as number)
src/auto-reply/continuation/delegate-dispatch.cost-cap-exhaustion.test.ts:112:36   — (flow.revision as number)
src/auto-reply/continuation/delegate-dispatch.fanout-error-isolation.test.ts:89:36 — (flow.revision as number)
src/auto-reply/continuation/delegate-dispatch.fanout-error-isolation.test.ts:200:18 — (call[0] as string)
```

All 4 are in this PR's own continuation test files. TypeScript narrowing already held at each callsite (prior assignment of `flow.revision = 0` makes the field `number`, and a prior `typeof call[0] === "string"` guard makes the call narrowing redundant). The `as` casts were redundant and oxlint correctly flagged them.

## Receipt-vs-byte mismatch noted on prior ship

A local-side lint-fix was attempted during the cure-N+2 cycle (rebase-and-commit-amend window), but the working-tree fix did not land into the karmafeast committer-amend that produced `47a7b494` — the amend used pre-fix tree state. This receipt-vs-byte mismatch was not surfaced at the time because the post-amend verification leaned on the prior local `pnpm lint` exit-code rather than re-fetching the committed bytes via the GitHub API. CI on the actual shipped SHA exposed the mismatch.

Banking the discipline: post-commit-amend should re-fetch committed file bytes via `gh api repos/<owner>/<repo>/contents/<path>?ref=<sha>` and verify against expected post-fix content before claiming "fix applied", especially when the amend chain includes committer-rewrite operations that can collide with working-tree state.

## Fix at byte

3 files changed, 4 insertions(+), 4 deletions(-). Mechanical removal of the 4 redundant assertions:

```diff
-flow.revision = (flow.revision as number) + 1;
+flow.revision = flow.revision + 1;

-(call[0] as string).includes("DELEGATE spawn failed: session-B delivery failure"),
+call[0].includes("DELEGATE spawn failed: session-B delivery failure"),
```

## Verification at byte before force-push

- Local `pnpm lint` exit 0 (5424 files, 0 warnings, 0 errors)
- GitHub API content-fetch on `642a33df` confirmed `flow.revision = flow.revision + 1` lands on disk at all 3 test files
- Committer + author both `karmafeast <karmafeast@gmail.com>` (PR-PRESENTATION-RUNBOOK §5 gate)
- Parent unchanged: `4d47f9a4c0385e9d1a9076ca0bed4c3858d9920f` (current upstream main HEAD at rebase-time)

## Post-push verification at byte

```json
{
  "headRefOid": "642a33df900289005afb221ae259458c9a511fd7",
  "mergeable": "MERGEABLE",
  "mergeStateStatus": "CLEAN"
}
```

CI re-ran on new SHA:

```
90 pass / 9 skip / 1 neutral / 0 fail
```

`mergeStateStatus: CLEAN` (no conflicts with base branch). PR is mergeable upstream pending maintainer review.

## Cohort byte-walks cosigning at byte

- Spark fresh-clone reproduced the 4 lint errors on `47a7b494` worktree pre-fix (`pnpm lint:core` exit non-zero with same 4 errors).
- Spark independent verification on the fix-pattern (narrowing-already-holds for each callsite) before force-push.
- Multi-host post-push verify cosign: spark + silas-seat both confirmed `gh pr view 79925` headRefOid + mergeStateStatus + CI 0-fail at byte.

## Cross-references

- Prior Gate 6 receipt (`47a7b494` ship): `gates/gate-6-force-push-receipt.md`
- README: candidate-state + SHA-progression now reflects `642a33df` as final ship-target.
