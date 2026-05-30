# Silas-Cluster Byte-Walk Report

**Authored**: 2026-05-29 ~19:30 PDT, silas-seat (lothric)
**Method**: `git merge-tree --merge-base=<ancestor> upstream/main pr-head` against local clone refs, read-only against SHAs. No branch writes.
**Per task-shape**: cael `1510102876` continuation-walk as model; rune `1510106712` replicate-on-other-clusters suggestion; figs `1510104573` git-canonical-substrate-direction.

## Inputs

- Upstream `upstream/main` HEAD: `440e737c67` (fetched 2026-05-29 19:25 PDT)
- PR-head: `fc337f05d6` (frond-scribe-claude/20260509/narrow-surgery-tight)
- Branch-point ancestor: `b474f429ee` (per figs's branch-at-ancestor strategy `1510096905`)
- Silas-cluster scope (per frond routing-v2 at `karmaterminal-openclaw-docs:WIP/path-d/alt-path-cohort-routing.md`):
  - `src/gateway/*` (15 files primary)
  - `src/infra/*` (4 files primary)
  - `src/config/*` (4 files primary)
  - +Codex plugin / Swift-bridge / build configs (~7 misc)

## The Headline Finding

**Real three-way-merge conflicts in silas-cluster = 9 files (merge-tree shortcut).**
**FROZEN-STALE-class regressions in silas-cluster = 5 additional files (Gate 2.7 axis).**
**Combined silas-cluster needing hand-walk = 12 unique files** (2 overlap between sets).

**Total real three-way-merge conflicts across entire repo = 25 files, not 152.**

The "152 conflict files" number in manifest-v1 was naive intersection of "both branches touched the file." Most of those resolve cleanly as orthogonal hunks under three-way merge. The real semantic-conflict surface is where git can't auto-merge — `git merge-tree --merge-base=<ancestor>` produces exactly this set with stage-3 conflict entries.

This validates 🩸 Cael's `1510106712` hypothesis on continuation-slice ("the actual continuation tools aren't even in the conflict class") generalized across clusters.

## CRITICAL CAVEAT — merge-tree misses FROZEN-STALE-class

Per 🩸 Cael's `1510111264` cross-walk on Ronan's §3 report: **`git merge-tree --merge-base=` counts hand-resolution conflict-markers but MISSES semantic regressions from frozen-tree-reverse-clobber.** If PR-head deletes content that upstream subsequently modified or extended, git merges the deletion as-is (no conflict marker) and the upstream evolution is silently lost.

The right axis for catching this is 🌿 Frond's **drift-cure-gate Gate 2.7** (frozen-tree-reverse-clobber detection), not merge-tree.

**Proxy detection** (run on silas-cluster post-Cael's caveat): files where PR-head has net-deletion ≥ 20 lines AND upstream has net-addition ≥ 20 lines on the same file. This is a candidate set, NOT a definitive set — each candidate needs Frond's Gate 2.7 byte-walk to confirm the deletion-pattern is reverse-clobber vs intentional-refactor.

**Silas-cluster FROZEN-STALE-candidates (5):**

```
src/gateway/server-methods/chat.ts             pr-head:-101  upstream:+420  (significant)
src/gateway/server-methods/server-methods.test.ts  pr-head:-199  upstream:+198  (huge)
src/gateway/session-utils.test.ts              pr-head:-33   upstream:+69
src/gateway/sessions-patch.test.ts             pr-head:-103  upstream:+33
src/infra/exec-approvals-policy.test.ts        pr-head:-26   upstream:+195
```

2 of these overlap with the merge-tree real-conflict set (`server-methods/chat.ts`, `exec-approvals-policy.test.ts`). The other 3 (`server-methods.test.ts`, `session-utils.test.ts`, `sessions-patch.test.ts`) are NEW additions to the silas-cluster hand-walk scope that the merge-tree shortcut missed.

**Combined silas-cluster needing hand-walk on rebase-fire = 12 unique files** (9 merge-tree + 5 FROZEN-STALE-candidate - 2 overlap).

🌿 Frond — please byte-walk the 5 FROZEN-STALE-candidates with Gate 2.7 discipline to confirm or eliminate them. The `server-methods.test.ts` -199/+198 case is the most striking and most likely a real reverse-clobber.

## Method shortcut (for cohort-replication)

```bash
git merge-tree --merge-base=b474f429ee upstream/main fc337f05d6 | \
  grep -oP '(?<=\t)[^\x00]+' | sort -u
```

Yields the full 25-file conflict list. Filter per-cluster with `grep -E` on path prefix.

## Silas-cluster real-conflict files (9)

```
src/config/sessions/types.ts
src/gateway/chat-abort.test.ts
src/gateway/mcp-http.test.ts
src/gateway/operator-approvals-client.test.ts
src/gateway/operator-approvals-client.ts
src/gateway/server-methods/agent.ts       ← HIGH-RISK: contains Swim-9 requestCompactionOpts forwarding invariant
src/gateway/server-methods/chat.ts
src/gateway/session-lifecycle-state.ts
src/infra/exec-approvals-policy.test.ts
```

## Per-file notes (preliminary — needs per-hunk walk on rebase fire)

### src/gateway/server-methods/agent.ts — HIGH-RISK
- **Invariant**: `requestCompactionOpts` field must be forwarded through the continuation path. This is the one-missing-line Swim 9 caught on my canary build before ship; 132 unit tests didn't catch it.
- **Risk**: if upstream's reshape moved the forwarding location, must re-thread or `request_compaction` (Trigger E) becomes silently-broken.
- **Cohort cross-walk**: 🌊 Ronan's §3 report flagged this file adjacent to his `run.ts` HIGH-RISK cluster. Cael's continuation-tool registration overlap noted.
- **Upstream diff since branch-point**: 244-line delta (+200/-44) — substantial reshape.
- **PR-head diff since branch-point**: 137-line delta (+60/-77) — net-reduction (continuation refactor consolidation).
- **Conflict-class**: C2 semantic — needs hand-walk on rebase.

### src/gateway/operator-approvals-client.ts + .test.ts
- Approvals-flow changes both sides. Need to verify continuation tools (`request_compaction`, `continue_delegate`, `continue_work`) still appear in approval-eligibility for sessions that route through approvals.
- **Conflict-class**: C2 semantic.

### src/gateway/chat-abort.ts/.test.ts
- Chat-abort path. Cross-reference with `model-fallback.ts` (Ronan §3 finding, 🪨 Rune `1510110028` walk: upstream-evolution, mechanical take-upstream). Verify continuation queue-drain on chat-abort isn't broken.
- **Conflict-class**: C1/C2 — likely mechanical, possibly semantic at abort+continuation intersection.

### src/gateway/mcp-http.ts (NOT in conflict list) + mcp-http.test.ts (IS in list)
- Interesting: source file auto-merges (1 line each side, orthogonal); test file conflicts. Suggests upstream + PR-head added different test cases to same file region.
- **Conflict-class**: C1 textual — mechanical resolve.

### src/gateway/session-lifecycle-state.ts
- Session lifecycle. Continuation paths interact via `sessions_yield` + post-compaction lifeboat hooks. Verify post-compaction `take` reads still resolve through whatever lifecycle-state shape upstream landed.
- **Conflict-class**: C2 semantic.

### src/gateway/server-methods/chat.ts
- Likely overlap with `agent.ts` reshape. Cross-walk with that file's hand-resolve.
- **Conflict-class**: C2 semantic.

### src/config/sessions/types.ts
- Type-shape changes both sides. Continuation reservations + heartbeat-state fields may need re-add to upstream's new type definitions.
- **Conflict-class**: C2 semantic.

### src/infra/exec-approvals-policy.test.ts
- Test-only conflict. Mechanical resolve likely.
- **Conflict-class**: C1.

## Routing back to other princes

- 🌊 **Ronan** — `src/gateway/server-methods/agent.ts` overlaps his `run.ts` HIGH-RISK from §3. Cross-walk recommended at rebase-fire time.
- 🩸 **Cael** — `src/gateway/session-lifecycle-state.ts` post-compaction lifeboat hook surface intersects his continuation cluster.
- 🌿 **Frond** — none of these 9 are Gate-2.7 FROZEN-STALE-class (Frond's specialty per `model-fallback.ts` + `session-store.ts` cluster from §3). Silas-cluster is C1/C2-dominant.

## Per Phase B atomic-decomposition allocation

All 9 silas-cluster files belong to **Layer 1 (Core implementation) — Commit 2 forward-rebase step** per manifest-v1 §7-v2 strategy. Three-way-merge auto-resolution will eat most of the diff; hand-walk is bounded to these 9 files.

## What's NOT in this report

- Per-hunk byte-walk content — that fires on actual rebase, not pre-rebase scoping.
- Behavior-invariant test results — feature-changelog draft at `/tmp/silas-feature-changelog/silas-feature-changelog-additions.md` on lothric covers 7 areas of behavior-invariants (context-pressure-bands, V8_Fatal, gitnexus-operational, cure-cycle-history, cohort-canon-don't-colonize, Codex-app-server, reservation-model). That draft is overlay-material for Frond's eventual FEATURE-CHANGELOG.md seed, not part of this byte-walk.
- Other clusters — Cael walked continuation (84 files, `08aca27`); Ronan walked his §3 (7 files, `1dcc19c`); Rune's auto-reply cluster walk pending if he picks it up.

## Open questions (cohort + figs)

1. **rebase strategy** — is the per-commit forward-rebase from `b474f429ee` confirmed, or is the path-decision still open per figs's deep-research-workorder? If the latter, this report stays scoping-class until the strategy lands.
2. **gpt-5.5 model.ts standing question** — already byte-walked + verdict posted at `1510106564`: KEEP, all uses registry-class or default-when-unset, no fallback-chain-poisoning found. Note: 🩸 Cael's `1510111264` says `model.ts` is RESOLVED at `cf1d05e` (DROP per upstream registry catch-up). Cael's chapter authoritative — my registry-walk was confirming surface-class not making the keep/drop call. Verdict: defer to Cael's `cf1d05e` resolution.
3. **Gate 2.7 FROZEN-STALE walks on the 5 candidates above** — Frond's call when she has cycles.

## Update log

- 2026-05-29 19:45 PDT — added FROZEN-STALE-class section per Cael `1510111264` caveat on Ronan §3 walk. Original merge-tree-only finding was incomplete; combined-finding is 12 unique files (9 + 5 - 2 overlap).

## Provenance

- Tool: `git merge-tree` (modern git ≥ 2.38 syntax with `--merge-base=` flag).
- Local clone: `/home/figs/flesh_beast_tmp/openclaw` (detached HEAD `0dff94db`).
- Throwaway worktree probe: `/tmp/silas-merge-probe` (deleted after use; never branched/pushed).
- Read-only against SHAs. PR-presentation branch `frond-scribe-claude/20260509/narrow-surgery-tight` untouched from this seat.
