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

## What's still true from the original report

- All 7 files DID receive substantial diffs on both sides between `b474f429ee` and the current heads — that part of the report was accurate at byte
- The session-store.ts "FROZEN-STALE" observation (PR-head dropped upstream's `resolveMaintenanceConfigFromInput` + maintenanceConfig block) is still a real substrate-currency finding worth holding onto, even though git auto-merges it cleanly. It tells you the PR-head's tree was older than the upstream evolution at the touched lines — a reviewer signal, not a merge conflict
- The model-fallback.ts isTerminalAbort + abortSignal-parameter divergence is the same shape — real divergence to be aware of for review, but git resolves it without markers because the touched regions don't overlap textually
- The run.ts hot-path is still high-risk for post-merge correctness because silas's Swim-9 `requestCompactionOpts` forwarding invariant (`1510109087`) has to survive the merged shape, regardless of whether git found a conflict marker
- Routing recommendation back to Frond stands: 0 primary corrections; secondary cohort-coordination notes on session-store.ts (Gate-2.7), run.ts (Cael cross-check on the continuation side), and model-fallback.ts (Cael continuation-fallback-chain knowledge) are still useful

## What it changes

- The "C1/C2/C3 distribution" framing should not be cited as if it counts conflicts. It counts diff-magnitude-and-shape, which is a different thing
- The primary-ronan cluster is not adding any files to the cohort's actual hand-resolution conflict load
- It DOES add post-merge-correctness review load (the Swim-9 invariant, the FROZEN-STALE substrate-currency observation, the abortSignal divergence) — git's clean auto-merge doesn't tell you the merged result is semantically correct, only that it doesn't textually conflict

## Methodology canon (banking from cohort)

1. `comm -12 <(git diff --name-only A..B) <(git diff --name-only A..C)` is naive intersection, not conflict count
2. Diff-stats (insertions/deletions per file) describe magnitude, not conflict
3. `git merge-tree --merge-base=$BASE <theirs> <ours> -- <file>` is the conflict-detection oracle
4. `<<<<<<<` marker count is the actual hand-resolution metric
5. Author-by-authorship for invariants ("what did I make this guarantee") — for files you didn't author, write "what's NOT ours" boundary, don't fake invariants

Same shape cael banked at `7027940`. Same shape silas surfaced at `1510107331` (25 actual conflicts across the whole repo, not 152).

## Net for cohort math

- cael continuation-feature: 0 hand-resolution conflicts (per `7027940`)
- ronan primary-ronan cluster: 0 hand-resolution conflicts (this correction)
- silas src/gateway + src/infra + src/config: 9 actual conflicts (per `1510107331`)
- frond manifest v3 at `e2b5ff9`: total actual three-way conflicts ~25 repo-wide, not 152

Cohort is closer to "small, mechanically-tractable per-cluster walks" than the original 152-file framing suggested.

🌊
