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

**Silas-cluster FROZEN-STALE-candidates (7 — refined per Ronan `1510113963` methodology improvement):**

```
src/gateway/server-methods/agent.test.ts       pr-head:+96 (raw-del:235) upstream:+831 (raw-add:967)
src/gateway/server-methods/agent.ts            pr-head:-17 (raw-del:77)  upstream:+156 (raw-add:200)
src/gateway/server-methods/chat.ts             pr-head:-101 (raw-del:105) upstream:+420 (raw-add:468)
src/gateway/server-methods/server-methods.test.ts  pr-head:-199 (raw-del:199) upstream:+198 (raw-add:198)
src/gateway/session-utils.test.ts              pr-head:-33 (raw-del:34)  upstream:+69  (raw-add:69)
src/gateway/sessions-patch.test.ts             pr-head:-103 (raw-del:103) upstream:+33  (raw-add:33)
src/infra/exec-approvals-policy.test.ts        pr-head:-26 (raw-del:44)  upstream:+195 (raw-add:195)
```

**Methodology refinement**: Ronan `1510113963` identified that the original net-deletion proxy (≥-20 net AND ≥+20 net) MISSES two FROZEN-STALE-with-camouflage classes:
1. Deletion-with-tiny-replacement (looks net-positive on PR-head)
2. Upstream-add-balanced-by-upstream-delete (looks net-zero on upstream)

The stricter proxy uses RAW deletion-count + RAW addition-count (≥20 each, regardless of net) to catch camouflaged cases. This surfaced 2 additional silas-cluster candidates that the net-proxy missed:
- `src/gateway/server-methods/agent.test.ts` (pr-head net +96 hides 235 raw deletions)
- `src/gateway/server-methods/agent.ts` (pr-head net -17 below -20 threshold; raw-del 77 is significant) — **CRITICAL: this is the file with the Swim-9 `requestCompactionOpts` invariant. 77 raw deletions in PR-head may include load-bearing content upstream extended.**

2 of these overlap with the merge-tree real-conflict set (`server-methods/agent.ts`, `server-methods/chat.ts`, `exec-approvals-policy.test.ts` — actually 3). The other 4 (`agent.test.ts`, `server-methods.test.ts`, `session-utils.test.ts`, `sessions-patch.test.ts`) are NEW additions to the silas-cluster hand-walk scope that the merge-tree shortcut missed.

**Combined silas-cluster needing hand-walk on rebase-fire = 13 unique files** (9 merge-tree + 7 FROZEN-STALE-candidate - 3 overlap).

🌿 Frond — please byte-walk the 7 FROZEN-STALE-candidates with Gate 2.7 discipline to confirm or eliminate them. The `server-methods.test.ts` -199/+198 case + the `agent.ts` raw-del-77 case (Swim-9 invariant file!) are the most likely real reverse-clobbers.

🌿 Frond — please byte-walk the 5 FROZEN-STALE-candidates with Gate 2.7 discipline to confirm or eliminate them. The `server-methods.test.ts` -199/+198 case is the most striking and most likely a real reverse-clobber.

## Method shortcut (for cohort-replication) — REFINED 2026-05-29 19:58 PDT

**Two clean invocations:**

```bash
# Get the list of files with actual conflicts (file count)
git merge-tree --write-tree --merge-base=b474f429ee upstream/main fc337f05d6 | grep '^CONFLICT'

# Get the merged tree (for reading conflict-marker counts per file)
git merge-tree --write-tree --merge-base=b474f429ee upstream/main fc337f05d6 > /tmp/out
TREE=$(head -1 /tmp/out)
for f in <files>; do
  HASH=$(git ls-tree $TREE -- "$f" | awk '{print $3}')
  COUNT=$(git cat-file -p "$HASH" | grep -c '^<<<<<<<')
  echo "$COUNT marker regions: $f"
done
```

Yields 25 file count + per-file marker-region counts (37 total regions across 25 files).

**Important tooling caveats** (banked from cohort cross-correction cascade tonight):
- `git merge-tree --merge-base=...` **without** `--write-tree` outputs tree-stage entries (mode/hash/stage/filename) NOT merged blob content. So `grep -c '^<<<<<<<'` against that output always returns 0 — the output never contains conflict markers in the first place.
- `git merge-tree -- <file>` (per-file form without `--write-tree`) has the same limitation.
- ALWAYS use `--write-tree` mode + grep `^CONFLICT` (file count) or per-blob marker grep (region count).
- The OLD shortcut I posted at `1510107332` (without `--write-tree`) returned correct FILE COUNTS (25) by accident (the tree-stage output happens to list one tab-separated entry per conflicted file) but produced incorrect marker-count metrics across the cohort cross-correction cascade at `1510114860` / `1510115467`.

## Silas-cluster real-conflict files (9 files, 12 marker regions total)

| markers | file |
|---|---|
| 4 | `src/gateway/server-methods/agent.ts` ← HIGH-RISK: contains Swim-9 `requestCompactionOpts` invariant |
| 2 | `src/gateway/operator-approvals-client.ts` |
| 1 | `src/config/sessions/types.ts` |
| 1 | `src/gateway/chat-abort.test.ts` |
| 1 | `src/gateway/mcp-http.test.ts` |
| 1 | `src/gateway/operator-approvals-client.test.ts` |
| 1 | `src/gateway/server-methods/chat.ts` |
| 1 | `src/gateway/session-lifecycle-state.ts` |
| 1 | `src/infra/exec-approvals-policy.test.ts` |

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
- Session lifecycle. **Cael cross-walk at `1510111891` confirms this is gateway-cluster-internal, NOT a continuation post-compaction lifeboat intersection.** Real lifeboat hooks live in `src/gateway/session-compaction-checkpoints.ts` (which is NOT in this cluster's conflict list, so likely no intersection at all).
- **Conflict-class**: C2 semantic — gateway-internal scope.

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
- 🩸 **Cael** — **CORRECTED per `1510111891`**: `src/gateway/session-lifecycle-state.ts` is NOT a continuation/post-compaction intersection. Real lifeboat hooks live in `src/gateway/session-compaction-checkpoints.ts` (not in conflict list). No silas-cluster file confirmed as continuation-cluster intersection.
- 🌿 **Frond** — none of these 9 are Gate-2.7 FROZEN-STALE-class (Frond's specialty per `model-fallback.ts` + `session-store.ts` cluster from §3). Silas-cluster is C1/C2-dominant.

## Per Phase B atomic-decomposition allocation

All 9 silas-cluster files belong to **Layer 1 (Core implementation) — Commit 2 forward-rebase step** per manifest-v1 §7-v2 strategy. Three-way-merge auto-resolution will eat most of the diff; hand-walk is bounded to these 9 files.

## What's NOT in this report

- Per-hunk byte-walk content — that fires on actual rebase, not pre-rebase scoping.
- Behavior-invariant test results — feature-changelog draft at `/tmp/silas-feature-changelog/silas-feature-changelog-additions.md` on lothric covers 7 areas of behavior-invariants (context-pressure-bands, V8_Fatal, gitnexus-operational, cure-cycle-history, cohort-canon-don't-colonize, Codex-app-server, reservation-model). That draft is overlay-material for Frond's eventual FEATURE-CHANGELOG.md seed, not part of this byte-walk.
- Other clusters — Cael walked continuation (84 files, `08aca27`); Ronan walked his §3 (7 files, `1dcc19c`); Rune's auto-reply cluster walk pending if he picks it up.

## Open questions (cohort + figs)

1. **rebase strategy** — is the per-commit forward-rebase from `b474f429ee` confirmed, or is the path-decision still open per figs's deep-research-workorder? If the latter, this report stays scoping-class until the strategy lands.
2. **gpt-5.5 model.ts standing question** — RESOLVED via cael+silas convergence at `1510111891`: **KEEP**. My `1510106564` KEEP verdict was right at byte. Cael's `cf1d05e` DROP was based on name-catch-up (upstream now has `DEFAULT_MODEL = "gpt-5.5"`) but missed behavior-catch-up (upstream does NOT carry the hardcoded contextWindow/maxTokens/mediaInput defaults). Dropping would require fleet config to provide these fields explicitly. Methodology-canon banked by cael at `387fe71`: name-catch-up ≠ behavior-catch-up. Net 0 figs-judgment items.
3. **Gate 2.7 FROZEN-STALE walks on the 5 candidates above** — Frond's call when she has cycles.

## Update log

- 2026-05-29 19:45 PDT — added FROZEN-STALE-class section per Cael `1510111264` caveat on Ronan §3 walk. Original merge-tree-only finding was incomplete; combined-finding is 12 unique files (9 + 5 - 2 overlap).
- 2026-05-29 19:48 PDT — corrected `session-lifecycle-state.ts` per Cael `1510111891` cross-walk (gateway-internal, not continuation-intersection); resolved gpt-5.5 question (KEEP confirmed via cael+silas convergence; name-catch-up ≠ behavior-catch-up canon banked).
- 2026-05-29 19:55 PDT — refined FROZEN-STALE proxy per Ronan `1510113963` methodology improvement (raw-del/raw-add vs net-del/net-add). Surfaced 2 additional candidates missed by net-proxy, including `server-methods/agent.ts` (Swim-9 invariant file). Combined-finding now 13 unique files (9 + 7 - 3 overlap).
- 2026-05-29 19:58 PDT — method-shortcut refined per cohort cross-correction cascade. The original shortcut (without `--write-tree`) gave correct file count (25) but produced incorrect marker counts across cohort attempts. New canonical invocation uses `--write-tree` + `grep ^CONFLICT` (file count) and per-blob marker grep (region count). Silas-cluster: 9 files, 12 marker regions total.

## Provenance

- Tool: `git merge-tree` (modern git ≥ 2.38 syntax with `--merge-base=` flag).
- Local clone: `/home/figs/flesh_beast_tmp/openclaw` (detached HEAD `0dff94db`).
- Throwaway worktree probe: `/tmp/silas-merge-probe` (deleted after use; never branched/pushed).
- Read-only against SHAs. PR-presentation branch `frond-scribe-claude/20260509/narrow-surgery-tight` untouched from this seat.


---

## ADDENDUM 2026-05-29 22:00 PDT — Alt-path MIXED-CLOBBER triage: openclaw-state-schema files (frond `1510143788` ask)

After Frond-scribe `1510143788` routed `src/state/openclaw-state-schema.{generated.ts,sql}` to silas-seat as "1-line drops on upstream `bc848b367f`" — byte-walked at byte rather than classifying-from-Gate-2.7-output.

### Byte-state verified

- **Upstream `bc848b367f`** (steipete shared-sqlite-state-database refactor, Sat 2026-05-30 00:52 +0200) CREATED both files NEW. Parent tree has neither. On upstream/main HEAD at blobs:
  - `src/state/openclaw-state-schema.generated.ts` = blob `5a5f0e2777891e845e2ede5a6939ee0381989589`
  - `src/state/openclaw-state-schema.sql` = blob `55101c69cf94d4053754d7a1f46ea86969438940`
- **alt-path `7c1df404782a` (origin/scribe.dandelion.cult/20260530/alt-path-cael-careful-apply)** preserves both files at OLDER blobs:
  - `.generated.ts` = blob `ffdf6a7466ade82193752a3df42bbd5fd1d6db68`
  - `.sql` = blob `0d21e2fc479e99c3e4a64add6c527d334397e0d1`
- **PR-head `frond-scribe-claude/20260509/narrow-surgery-tight`** has NO `src/state/` directory at all. Both files DELETED on PR-head.

### Divergence shape

- alt-path's `.sql` vs upstream/main:
  - alt-path missing `chain_id TEXT` column on `flow_runs` table
  - alt-path missing `CREATE INDEX IF NOT EXISTS idx_flow_runs_chain_id ON flow_runs(chain_id);`
  - That's "the 1-line drop" Frond's Gate 2.7 classifier surfaced — but it's CONTINUATION-CHAIN-TRACKING substrate, not arbitrary line-drift.
- PR-head's substantively-shipped form has REFACTORED continuation-chain-tracking out of `openclaw-state-schema` and INTO `src/tasks/task-flow-registry.store.sqlite.{ts,chain-id.test.ts}`:
  - `git grep -l "chain_id" origin/frond-scribe-claude/20260509/narrow-surgery-tight -- "*.sql" "*.ts"` returns:
    - `src/infra/continuation-tracer.test.ts`
    - `src/infra/continuation-tracer.ts`
    - `src/tasks/task-flow-registry.store.sqlite.chain-id.test.ts`
    - `src/tasks/task-flow-registry.store.sqlite.ts`
    - `src/tasks/task-flow-registry.test.ts`
    - `src/tasks/task-flow-registry.ts`
  - Notably absent from this list: `src/state/openclaw-state-schema.*`

### Recommendation

Likely cohort-canonical-form: PR-head's architecture (continuation-chain-tracking lives in `task-flow-registry.store.sqlite`, separated from `openclaw-state-schema`). The cleaner separation. Alt-path needs **file-DELETION** of these two files (not line-addition) to match PR-head's architecture. The "1-line drop" Gate 2.7 surfaced disappears because the files themselves are correctly absent on PR-head.

### Action class

Add **file-deletion-as-resolution-class** to the cohort 4-MIXED-CLOBBER action-set. Gate 2.7 classification "1-line drop" under-states the substrate-weight here when the file-itself-is-deleted-on-PR-head. Worth re-running Gate 2.7 with PR-head-vs-alt-path-aware classifier if available — currently classifying against `bc848b367f`-upstream-direct missed the PR-head architecture-divergence.

### Discipline-canon-from-this-byte-walk

This byte-walk applied the discipline-canon-of-the-night:
- **byte > cohort-cosign**: Frond's "1-line drop" classification was at-byte against upstream `bc848b367f` but missed the PR-head architecture-divergence. Going to byte directly surfaced the bigger substrate-shape.
- **Tools-as-ops-default**: Used `git ls-tree`, `git diff`, `git grep` at byte rather than reading-from-classification-output-from-memory.
- **Correction-density-as-flex**: This finding adds another correction to tonight's count — the Gate 2.7 classifier surfaced one-line-drop but real substrate is architecture-divergence. Banking the correction at byte not as failure.

### Branch + commit

This finding committed on branch `silas-dandelion-cult/20260530/silas-cluster-byte-walk-report`. Read-only-on-PR-presentation-branch hard-rule held throughout. Path D's stalled wt-laneD state safely preserved in `stash@{0}` (576 modifications unchanged, recoverable if Path D ever resumes).

🌫 silas-seat — 2026-05-29 22:00 PDT


---

## ADDENDUM 2026-05-29 22:15 PDT — CLI-binding cluster (7 files) byte-walk for alt-path MIXED-CLOBBER triage (Cael `1510145745` routing)

After Cael's `1510145745` cluster-mapping + `1510148729` allocation, byte-walked the 7-file CLI-binding + cli-runner cluster on alt-path vs PR-head vs upstream.

### Byte-state verified (all 7 files present on all 3 refs — no deletion class)

| File | alt-path blob | PR-head blob | upstream blob | Diff lines |
|------|---------------|--------------|---------------|-----------|
| `src/auto-reply/reply/agent-runner.ts` | `726ce2083b` | `33478c650a` | `18628f887d` | 3 |
| `src/auto-reply/reply/followup-runner.ts` | `34d9fa7fff` | `6459ee93b9` | `6a16f05b0b` | many |
| `src/auto-reply/reply/session.test.ts` | `93ae488889` | `93a33d7241` | `3b3b82df20` | 55 |
| `src/auto-reply/reply/agent-runner-execution.test.ts` | `faa269f8c8` | `a45b82a032` | `0311a5ccb8` | 271 |
| `src/cron/isolated-agent/run.ts` | `5cab7bd7d3` | `6a9a98f83c` | `d6deee2552` | many |
| `src/agents/command/attempt-execution.helpers.ts` | `44af5900aa` | `7ab90d6654` | `5fd80f95de` | 86 |
| `src/agents/cli-runner/prepare.ts` | `4233f79d39` | `138d451c66` | `b077da4149` | 12 |

### Per-file classification

#### 1. `src/auto-reply/reply/agent-runner.ts` — **ALT-PATH AHEAD, not behind**
alt-path HAS `skipMaintenance: true, takeCacheOwnership: true` params on 3 `applySessionStoreEntryPatch` calls; PR-head REMOVED them. Alt-path has continuation-cache-ownership substrate PR-head dropped. Gate 2.7's "3-line MIXED-CLOBBER" is mis-reading alt-path's continuation-tracking as missing-from-PR-head when it's actually present-on-alt-path-and-absent-on-PR-head. **Likely alt-path-is-correct, PR-head-regressed**.

#### 2. `src/auto-reply/reply/followup-runner.ts` — **PR-head SIMPLIFIED, alt-path elaborate**
alt-path HAS:
- `clearDroppedCliSessionBinding` + `keepCliSessionBindingOnlyWhenReused` imports
- restart-sentinel-followup logic with `isRestartSentinelFollowup` branch  
- `onToolEvent` callback handler for forwardFollowupProgressEvent
- `droppedCliSessionReplacement` tracking

PR-head SIMPLIFIED to:
- Just `runCliAgentWithLifecycle` import (others removed)
- `isRoomEventCliRun` branch with conditional `getCliSessionBinding`
- No onToolEvent callback
- No restart-sentinel-followup branch

**PR-head architectural simplification of complex auto-reply CLI handling.** Worth cohort decision: is the simplification correct (we want the simpler form) or did PR-head regress on continuation-tracking edge cases (restart-sentinel + onToolEvent)?

#### 3. `src/cron/isolated-agent/run.ts` — **Pure path-refactor + architectural simplification**
- Import path changes: `resolveCronSkillsSnapshot` from `../../skills/runtime/cron-snapshot.js` → `./skills-snapshot.js` (LOCAL not GLOBAL skills runtime)
- Removed `resolveCronPreflightCandidates` (alt-path uses explicit `preflightCandidates`; PR-head inlines into `preflight = ... preflightCronModelProvider({...})`)
- Removed `modelFallbacksOverride` field from PreparedCronRunContext type

**PR-head consolidates cron-specific helpers into local module + simplifies preflight invocation. Architectural.**

#### 4. `src/auto-reply/reply/session.test.ts` (55 diff lines) — **PR-head DELETED tests**
PR-head removed tests including `"accounts goal usage when fresh token snapshots are persisted"`. Tests for goal-usage-tracking REMOVED. **If alt-path's test coverage is correct, alt-path is ahead.** If PR-head intentionally deleted obsolete tests after a refactor, alt-path needs to drop those tests too.

#### 5. `src/auto-reply/reply/agent-runner-execution.test.ts` (271 diff lines!) — **MASSIVE test deletion on PR-head**
PR-head removed `"reuses CLI sessions for room-event turns"` test + many others. **Largest divergence in the cluster.** 271 lines worth of test substrate diverged.

#### 6. `src/agents/command/attempt-execution.helpers.ts` (86 diff lines) — **PR-head function-rewrite**
- Renamed `scanJsonlFile` → `jsonlFileHasAssistantMessage` (simpler return type)
- Added `os` import + `CLAUDE_PROJECTS_RELATIVE_DIR` constant
- Removed `cliBackendLog`, `resolveClaudeCliProjectDirForWorkspace` imports
- Changed return signature from `{ fileExists, hasAssistant }` to `boolean`

**Pure refactor on PR-head. Alt-path preserves older API shape.**

#### 7. `src/agents/cli-runner/prepare.ts` (12 diff lines) — **Import-path refactor + env-var simplification**
- Import: `../../skills/loading/workspace.js` → `../skills.js`
- Removed `OPENCLAW_MCP_CURRENT_CHANNEL_ID/THREAD_TS/MESSAGE_ID` env vars (3 vars)
- Removed `currentChannelId/currentThreadTs/currentMessageId` params

**PR-head removed current-channel/thread/message-id propagation to MCP children. Architectural decision: do these propagate or not?**

### Pattern at byte (cluster-level)

**PR-head is the SIMPLIFIED, refactored form. Alt-path preserves OLDER MORE COMPLEX shape that was simplified in upstream/PR-head work.** Gate 2.7's "MIXED-CLOBBER" classification reads as "alt-path didn't pick up PR-head's simplification refactors" — alt-path is BEHIND on these refactors, not ahead (with possible exception of agent-runner.ts which may have continuation-cache-ownership substrate PR-head regressed on).

### Recommendation

For 6 of the 7 files (everything except `agent-runner.ts`): **alt-path should CHECKOUT these files FROM PR-head** to match the simplified-refactored form. Don't preserve alt-path's older shape — that's the bug, not the feature.

For `agent-runner.ts`: **cohort decision needed** — is the `skipMaintenance: true, takeCacheOwnership: true` substrate continuation-feature-required (alt-path correct), or was it intentionally removed in PR-head as obsolete (PR-head correct)? Likely cohort-canonical answer requires byte-walking the continuation-feature-spec for context.

### Discipline-canon-from-byte-walk

This 7-file byte-walk applied the discipline-canon:
- **byte > cohort-cosign**: Gate 2.7 classifier reported these as "MIXED-CLOBBER drops" but the actual shape is "alt-path missed PR-head simplification refactors" — completely different action-class.
- **Tools-as-ops-default**: Used `git ls-tree`, `git diff` per-file rather than reading from classification.tsv-output alone.
- **Cluster-coordination-discipline**: Checked with cohort before firing (paused at `1510148438` for Rune ownership-check, fired at `1510148729` after Cael's direct allocation).
- **Cluster-pattern-recognition**: Per-file byte-walk surfaced cluster-level pattern (PR-head-simplification-class) that single-file walks would miss.

### Branch + commit

Finding committed on branch `silas-dandelion-cult/20260530/silas-cluster-byte-walk-report` on top of `a52c133` (openclaw-state-schema addendum). Read-only-on-PR-presentation held throughout.

🌫 silas-seat — 2026-05-29 22:15 PDT
