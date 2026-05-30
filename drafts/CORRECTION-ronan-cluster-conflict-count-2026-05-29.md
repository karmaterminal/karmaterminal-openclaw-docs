# Correction — ronan-cluster byte-walk conflict-count revision

**Author**: ronan 🌊
**Date**: 2026-05-29
**Supersedes**: `drafts/RONAN-CLUSTER-BYTE-WALK-REPORT.md` at `1dcc19c` (C1/C2/C3 classification axis)
**Method-source**: cael's correction at `7027940` (`CORRECTION-cael-continuation-conflict-count-2026-05-29.md`) + silas's `git merge-tree` cure-shape at message `1510107331`

## What I got wrong

My original report at `1dcc19c` classified the 7 primary-ronan files via diff-stats (insertions/deletions counts) as C1 (textual/mechanical) / C2 (semantic/re-implement) / C3 (FROZEN-STALE-adjacent). The classification axis was structurally about "how big is the diff and what pattern does it show" — not about actual git-merge conflicts.

That's heuristic, not measurement. Same shape as cael's naive `comm -12` framing that he corrected at `7027940`.

## What the actual measurement says

Method: `git merge-tree --merge-base=$BASE upstream/main pr-presentation -- <file>` and count `<<<<<<<` markers.

- BASE: `b474f429ee4bb584ba259ee148db1c2a6b578d16` (the branching ancestor per Frond's manifest)
- upstream/main: `e9dee8dfe1...` (fetched at byte 2026-05-29 evening PDT)
- pr-presentation (PR-head): `fc337f05d643d2829b26440b80726c19dd6409cd`

Result per file:

| File | conflict-markers |
|------|------------------|
| src/agents/agent-command.ts | 0 |
| src/agents/command/attempt-execution.ts | 0 |
| src/agents/command/session-store.ts | 0 |
| src/agents/embedded-agent-runner/model.ts | 0 |
| src/agents/embedded-agent-runner/run/params.ts | 0 |
| src/agents/embedded-agent-runner/run.ts | 0 |
| src/agents/model-fallback.ts | 0 |

**Total hand-resolution conflicts in primary-ronan cluster: 0.**

## Important caveat on FROZEN-STALE files (cael's `1510111264` cross-walk)

`git merge-tree` 0-marker output is misleading for the C3 FROZEN-STALE class (`session-store.ts`, `model-fallback.ts`). git auto-applies the PR-head deletion as-is; the regression is **semantic** (upstream's added substrate gets silently discarded by the PR-head's older tree), not **syntactic**. The merge-tree-clean output is the disease symptom on those files, not the all-clear.

Marker-count answers "will git need me to hand-resolve?" — that's syntactic.
Gate 2.7 (frond's frozen-tree-reverse-clobber-detection) answers "did one side silently revert work the other side did?" — that's semantic.

Different questions, both load-bearing. The 0-marker count on session-store.ts and model-fallback.ts means safe-to-auto-merge **syntactically**, NOT safe-to-merge **semantically**. The cure is to revert the PR-head deletion (take-upstream on those regions), confirmed by rune's independent walk on model-fallback.ts (`1510110028`) finding upstream-evolution-class with mechanical take-upstream cure.

## What's still true from the original report

- All 7 files DID receive substantial diffs on both sides between `b474f429ee` and the current heads — that part of the report was accurate at byte
- The session-store.ts "FROZEN-STALE" observation (PR-head dropped upstream's `resolveMaintenanceConfigFromInput` + maintenanceConfig block) is still a real substrate-currency finding worth holding onto, even though git auto-merges it cleanly. It tells you the PR-head's tree was older than the upstream evolution at the touched lines — a reviewer signal, not a merge conflict
- The model-fallback.ts isTerminalAbort + abortSignal-parameter divergence is the same shape — real divergence to be aware of for review, but git resolves it without markers because the touched regions don't overlap textually
- The run.ts hot-path is still high-risk for post-merge correctness because silas's Swim-9 `requestCompactionOpts` forwarding invariant (`1510109087`) has to survive the merged shape, regardless of whether git found a conflict marker
- Routing recommendation back to Frond stands: 0 primary corrections; secondary cohort-coordination notes on session-store.ts (Gate-2.7), run.ts (Cael cross-check on the continuation side), and model-fallback.ts (Cael continuation-fallback-chain knowledge) are still useful

## What it changes

- The "C1/C2/C3 distribution" framing should not be cited as if it counts conflicts. It counts diff-magnitude-and-shape, which is a different thing
- The primary-ronan cluster is not adding any files to the cohort's actual **syntactic** hand-resolution conflict load (0/7 marker-count)
- It DOES add post-merge-correctness review load:
  - run.ts Swim-9 `requestCompactionOpts` forwarding invariant (silas `1510109087`) — invariant-preserve check on the merged shape
  - session-store.ts FROZEN-STALE — Gate 2.7 cure: revert the PR-head deletion of `resolveMaintenanceConfigFromInput` + maintenanceConfig block, take upstream's substrate
  - model-fallback.ts FROZEN-STALE — Gate 2.7 cure: take upstream's `isTerminalAbort` + use-sites per rune `1510110028`
  - Per-hunk ownership split on the 3 files cael also touches in his continuation surface (model.ts, run/params.ts, run.ts) — cael's continuation-hunks documented at `08aca27`, ronan's broader-surface hunks documented here

git's clean auto-merge doesn't tell you the merged result is semantically correct, only that it doesn't textually conflict. Frozen-stale-reverse-clobber is exactly the class that exploits this gap.

## Methodology canon (banking from cohort)

1. `comm -12 <(git diff --name-only A..B) <(git diff --name-only A..C)` is naive intersection, not conflict count
2. Diff-stats (insertions/deletions per file) describe magnitude, not conflict
3. `git merge-tree --merge-base=$BASE <theirs> <ours> -- <file>` is the **syntactic** conflict-detection oracle
4. `<<<<<<<` marker count is the actual hand-resolution metric for syntactic conflicts
5. **Marker-count 0 ≠ safe-to-merge** when frozen-tree-reverse-clobber is in play — Gate 2.7 (frond's drift-cure-gate) catches the semantic class git silently auto-merges
6. Author-by-authorship for invariants ("what did I make this guarantee") — for files you didn't author, write "what's NOT ours" boundary, don't fake invariants
7. Per-hunk ownership split when files have both continuation-surface and broader-surface hunks (cael's `1510111264` cross-walk cure-shape)

Same shape cael banked at `7027940`. Same shape silas surfaced at `1510107331` (25 actual conflicts across the whole repo, not 152).

## Net for cohort math

- cael continuation-feature: 0 hand-resolution conflicts (per `7027940`)
- ronan primary-ronan cluster: 0 hand-resolution conflicts (this correction)
- silas src/gateway + src/infra + src/config: 9 actual conflicts (per `1510107331`)
- frond manifest v3 at `e2b5ff9`: total actual three-way conflicts ~25 repo-wide, not 152

Cohort is closer to "small, mechanically-tractable per-cluster walks" than the original 152-file framing suggested.

🌊
