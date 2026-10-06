# WO-129388-gate2 — feature-byte disposition, presentation tip → cut head

Bound: karmaterminal/openclaw#1418. Analysis only: product code was not edited, and nothing was committed or pushed.

## 0. UNEXPLAINED rows

**None.** I placed all 165 hunks across the 13 failing files under one of the four explained dispositions, each with commit evidence. Section 6 lists the facts the orchestrator should know (window correction, lanes outside the four named, and the L6 test relocation). None of them is an unexplained hunk.

**Verdict.** The Gate 2 FAIL is fully accounted for. 70 hunks are upstream projection: upstream commits, not our edits. 18 are named lane fixes on L8. 30 are cut removals (blocks 1, 5, 7 and 9). 47 are FEATURE-CHANGE, and all of them come from the #1408 L4 TaskFlow→custody re-home, which upstream forced by removing TaskFlow in `6652f7eac8` (#159179). Every covering test passes at `8ff211b484`.

## 1. Named refs

| ref class | ref | full SHA | local = tracking = server |
|---|---|---|---|
| product base (read-only) | `codeagent/129388-cut-integrate` | `8ff211b48433502204aa6e7eb66243cc497872d8` | yes (local, `origin/…`, `ls-remote`) |
| presentation tip (PR_HEAD, read-only) | `codeagent/85651-upstream-1ba243c8-gates` | `9eb655afa7f70886e8dcd034e56df659eabf33df` | yes |
| L8-full (intermediate) | `scribe/20261002/p89-l8-absorb-b51feb98` | `879ff7e1bb5bb080ffae4538e8ed8d62163b7a8b` | yes |
| upstream base | — | `b51feb98ebb1bfa6735b62d136eca9abdbee4285` | — |
| WO "old merge base" | — | `6b229ad820eef2bb222c3b6aa5c79ee4dcc57059` | — |
| **actual merge base (tip, upstream)** | `git merge-base 9eb655afa7 b51feb98eb` | `6d65c8b7f229641bf9b32e16da2c0fec1b64079f` | — (this is what the Gate 2 tool uses) |
| bootstrap tools | `karmaterminal/openclaw-bootstrap` main | `fb5ac57b933971f6dfdfd0a81d8c73f0d47dd7ff` (tools last changed at `2b69870927`) | fetched |
| lane branch | `codeagent/129388-gate2-disposition` | `8ff211b484…` (local only, analysis lane; WO: nothing committed) | not published (WO: analysis only) |
| CI / presentation / docs | N/A | N/A | N/A |

Ancestry checks: tip → L8 → cut is a descendant chain, and `b51feb98eb` is an ancestor of L8. `6b229ad820` is **not** an ancestor of the tip. The tip sits on upstream `6d65c8b7f2` (2026-09-21).

**Receipt reproduced exactly.** `bash feature-cores-byte-check.sh 9eb655afa7 8ff211b484 drift-cure-gate.primitive-cores.txt --upstream b51feb98eb` reports 40 invariants, 13 FAIL, 16 exact-upstream and 4 tombstone. The failed list is the same 13 files.

## 2. Method

- **Hunks.** `git diff -U3 9eb655afa7 8ff211b484 -- <file>`, using the default context, as the WO specifies.
- **Added lines.** `git blame --porcelain 8ff211b484`. A commit counts as upstream when it is in `rev-list b51feb98eb ^9eb655afa7`.
- **Removed lines.** A recursive first-parent walk over `9eb655afa7..8ff211b484` finds the commit where the line's count drops. At a merge, it descends into the second parent's side. When the line vanished on the upstream side of an absorb merge, `git log -S'<line>' <merge-base>..<upstream-parent> -- <file>` names the upstream commit that removed it.
- **Upstream-owned files** (openclaw-tools, compact-reasons(.test), compact.hooks.harness/.test, run.overflow-compaction.harness). Each hunk is also split at line level:
  - a "fork line" is a removed line absent from `6d65c8b7f2:<file>`, or an added line absent from `b51feb98eb:<file>`;
  - a hunk with zero fork lines is **UPSTREAM-PROJECTION**;
  - a hunk with fork lines takes the disposition of the commit that changed those lines.
  This keeps generic lines such as `});` from being misattributed.
- **Window.** The WO's projection window is `6b229ad820..b51feb98eb`, but the tip's real upstream base is `6d65c8b7f2`. Between the tip and the cut, six upstream absorbs landed: `2167eab4cf` (`1ec480f152`), `b1c68b936f` (`c2c131b051`), `e834097fb7` (`857dcc7b02`), `6d06be1455` L5 (`a8e96ea787`), `6b229ad820` L7 (`6c9a4597c9`) and `b51feb98eb` L8 (`c15749a11f`). Almost every projection commit lies in `6d65c8b7f2..6b229ad820`; only `b5b1029990` (#158091) falls in the WO window. So the evidence uses `6d65c8b7f2..b51feb98eb`, the same base the Gate 2 tool uses.
- **Disposition mapping.** I took cut block numbers from each cut commit body and the merge that brings it onto the cut's first-parent chain. I took NAMED-FIX lanes from the commit body's `Refs` lines and confirmed each commit is an ancestor of L8 `879ff7e1bb`.

## 3. Per-file disposition counts

| file | hunks | UNEXPLAINED | UPSTREAM-PROJECTION | NAMED-FIX | CUT-REMOVAL | FEATURE-CHANGE |
|---|---:|---:|---:|---:|---:|---:|
| `src/agents/openclaw-tools.ts` | 16 | 0 | 12 | 4 | 0 | 0 |
| `src/agents/tools/continue-delegate-tool.ts` | 8 | 0 | 0 | 2 | 6 | 0 |
| `src/agents/tools/continue-delegate-tool.test.ts` | 34 | 0 | 0 | 0 | 1 | 33 |
| `src/agents/tools/continue-delegate-tool.crosssession-gate.test.ts` | 13 | 0 | 0 | 0 | 0 | 13 |
| `src/agents/tools/request-compaction-tool.ts` | 1 | 0 | 0 | 0 | 0 | 1 |
| `src/agents/tools/request-compaction-tool.test.ts` | 2 | 0 | 0 | 2 | 0 | 0 |
| `src/agents/tools/request-compaction-tool.callsite-threading.test.ts` | 1 | 0 | 0 | 1 | 0 | 0 |
| `src/agents/tools/continuation-tools-registration.test.ts` | 1 | 0 | 0 | 0 | 1 | 0 |
| `src/agents/embedded-agent-runner/compact-reasons.ts` | 8 | 0 | 3 | 0 | 5 | 0 |
| `src/agents/embedded-agent-runner/compact-reasons.test.ts` | 8 | 0 | 3 | 0 | 5 | 0 |
| `src/agents/embedded-agent-runner/compact.hooks.harness.ts` | 20 | 0 | 17 | 3 | 0 | 0 |
| `src/agents/embedded-agent-runner/compact.hooks.test.ts` | 31 | 0 | 27 | 4 | 0 | 0 |
| `src/agents/embedded-agent-runner/run.overflow-compaction.harness.ts` | 22 | 0 | 8 | 2 | 12 | 0 |
| **total** | **165** | **0** | **70** | **18** | **30** | **47** |

## 4. `compact.hooks.test.ts`: our file at `8ff211b484` = upstream `b51feb98eb` + a measured delta

`git diff --stat b51feb98eb 8ff211b484 -- src/agents/embedded-agent-runner/compact.hooks.test.ts` gives **+9 / −36** (3438 → 3411 lines). The −7.8k in tip→cut is upstream's own restructuring of this file between `6d65c8b7f2` and `b51feb98eb`, mainly `e5d4585279` (#160766), `ed309646b1` (#157685), `34ddb38956` (#157977) and `f77e791fd5` (#159597). The tip still carried the pre-split 7336-line shape. Upstream's only change in the WO window is one line, `mockReturnValue`→`mockResolvedValue` from `b5b1029990`, and the cut has it.

The full delta at the cut:

| # | delta vs upstream | lines | what it is | continuation? |
|---|---|---|---|---|
| d1 | `+ replaceSessionEntry,` import | +1 | used by d3 | no; permission-policy fixture, carried unchanged from the tip |
| d2 | `- permissionMode: "full",` in an upstream exec-override test call | −1 | carried unchanged from the tip (T delta) | no |
| d3 | `+ await replaceSessionEntry({…TEST_STORE_PATH…}, {…permissionMode: "workspace"})` in "defaults rootless compaction permissions…" | +8 | carried from the tip; `defaultStorePath`→upstream `TEST_STORE_PATH` in the b1c68b936f absorb resolution | no |
| d4 | `−` upstream test "preserves a deprecated SQLite marker successor for legacy maintenance" | −35 | **relocated** by L6 `13bdb562b1` (#1408) to fork-only `compact.hooks.session-state.test.ts:359`, using the tip's isolated-store rewrite | no (moved for the line cap) |

The tip's delta against its own base (`6d65c8b7f2→9eb655afa7`) was +201/−16. The difference between the two is:
- **L6 relocation** (`13bdb562b1`), now in `compact.hooks.session-state.test.ts`. I checked that 189 of the 190 non-blank L6-removed lines are present there; the one difference is an import-list line. The relocated tests are:
  - "disables continuation tools when rebuilding nested compaction tools" (the only continuation test);
  - three permission-policy tests;
  - "resolves queued compaction model metadata through the selected runtime provider";
  - the legacy-marker rewrite.
- **The `defaultStorePath`/`activeStorePath` fixture**, superseded by upstream's `TEST_STORE_PATH = await compactionFixture.prepare()` (`ed309646b1`, #157685). Upstream deleted the active-sessions `it.each` in `e5d4585279` (#160766). The fixture was dropped in absorb resolutions `c2c131b051` and `a8e96ea787`.

The same holds for the other upstream-owned files:
- `run.overflow-compaction.harness.ts` = upstream + 2 lines (`export` on `mockedLog` and `resetRunOverflowCompactionHarnessMocks`, from L6 `13bdb562b1` for `run.overflow-compaction.context-engine.test-support.ts`). Blocks 5 and 5-follow-up restored everything else to upstream bytes.
- `compact.hooks.harness.ts` = upstream + the L6 extraction into `compact.hooks.harness-selection.test-support.ts`, +19/−37. That moves upstream's harness-selection mocks and carries our `resolveSelectedOpenAIRuntimeProviderMock` with them.
- `openclaw-tools.ts` = upstream + 9/−11. The continuation tools spread moved to `openclaw-tools.continuation-run.ts` (`resolveOpenClawContinuationToolParamsForRun`), plus the hook-context helper and a scheduled-authority comment carried from the tip. That comment is not continuation and is unchanged by this motion; it came from fork commit `5d21ba0a2a`.

## 5. FEATURE-CHANGE and NAMED-FIX rows: behaviour, covering tests, results

All runs were at `8ff211b484` (clean tree, `git diff --quiet 8ff211b484`) with
`NO_COLOR=1 FORCE_COLOR=0 env -u GITHUB_REPOSITORY node scripts/run-vitest.mjs run <paths> --maxWorkers=1`, in the foreground.

| row class | behaviour changed / why | covering test(s) | result |
|---|---|---|---|
| FEATURE-CHANGE ×47: #1408 L4 `d71e6bcd3d` (continue-delegate-tool.ts), `57b17df352` (both delegate test files, 46 hunks), `1a91b04af5` (request-compaction-tool.ts comment) | `continue_delegate` now writes delegates and post-compaction stages through the custody store's worker operations: `enqueuePendingDelegate` / `stagePostCompactionCustodyDelegate` are awaited, `stagePostCompactionTaskFlowDelegate` becomes `stagePostCompactionCustodyDelegate`, and `claimStagedPostCompactionTaskFlowDelegates` becomes `claimStagedPostCompactionDelegates`. Tests read the store with `await` and use `useContinuationCustodyTestState()`. **Why:** upstream removed the TaskFlow runtime (`6652f7eac8`, #159179); #1408 re-homes custody. The tool's contract is unchanged: same statuses, notes and caps. | `src/agents/tools/continue-delegate-tool.test.ts`, `continue-delegate-tool.crosssession-gate.test.ts`, `request-compaction-tool.test.ts` | PASS (infra shard 56/56 for the 3 delegate files; agents-tools 79/79) |
| NAMED-FIX grok-p1s `a950b1cf64` (+ `511c2d1d64` merge, `662ff13b4c` move), #1418/#1396 | `maxDelegatesPerTurn` used to be check-then-await-then-count. It is now an atomic `reserveContinueDelegateTurnSlot` held across the durable write, released on throw, and bound to its turn. `delegateIndex` = reserved slot. | `src/agents/tools/continue-delegate-tool.turn-admission.test.ts` (4 cases: queued, queued-for-compaction, release on failure, no cross-turn release) | PASS 4/4 |
| NAMED-FIX `2afd4c429b` + `a2568d076b` (#1396) | The continuation tool params and inventory stub opts moved verbatim to `openclaw-tools.continuation-run.ts`. `openclaw-tools.ts` still calls `createOpenClawContinuationTools` directly (Project 84 topology). | `src/agents/tools/continuation-tools-registration.test.ts`, `src/agents/openclaw-tools.continuation.session-key.test.ts`, `src/auto-reply/continuation/project84-owned-topology.contract.test.ts` | PASS 13/13, 2/2, 9/9 |
| NAMED-FIX `1a137df685` (#1396; upstream #157977 `34ddb38956`) | The test replica passes upstream's new `compactEmbeddedAgentSession(params, { sourceAuthority })` second argument. | `src/agents/tools/request-compaction-tool.callsite-threading.test.ts` | PASS (in agents-tools 79/79) |
| NAMED-FIX `fad7665b33` | Three assertions now pin the owner-qualified queue key `resolveSystemEventQueueKey(SESSION_KEY, OWNER_AGENT_ID)` instead of the bare key. This strengthens them. | `src/agents/tools/request-compaction-tool.test.ts` | PASS |
| NAMED-FIX L6 `13bdb562b1` (#1408) | Line-cap relocation only: test names are unchanged and the harness mocks moved verbatim. | `src/agents/embedded-agent-runner/compact.hooks.test.ts` (83) + `compact.hooks.session-state.test.ts` (6); `run.overflow-compaction.test.ts`, `.loop.test.ts`, `.misc-owners.test.ts` | PASS 89/89; 28/28 + 11/11 |
| CUT-REMOVAL neighbours (not required; run for the behaviour the cut changed) | Block 1 drops `returnOptions`/`recipientContext` from the continue_delegate schema. Block 7 folds `no_real_conversation_messages` into `no_compactable_entries`; both are skip codes, so request_compaction's outcome is unchanged. | `continuation-tools-registration.test.ts` (schema key set); `compact-reasons.test.ts` (53); `request-compaction-tool.classifier-emission.test.ts`, `.volitional-threading.test.ts` | PASS |

Totals: 7 Vitest shards across 4 runner invocations, **265 tests passed, 0 failed, 0 skipped.** Logs were in `/tmp/g2/test{1..4}.log` (scratch).

**Dependency note.** The worktree's `node_modules` symlink pointed at `source/openclaw/node_modules`, which was installed from a stale lock (clone HEAD `599f7ba0c9`, version 2026.6.2; its lock is not the cut's). `openclaw-129388-cut-integrate` is clean at exactly `8ff211b484`, and its hard-link `node_modules` matches the cut's `pnpm-lock.yaml`; the only difference is pnpm's 158-line env preamble, which `.pnpm/lock.yaml` omits. For the test runs I temporarily pointed this worktree's root `node_modules` and 179 per-package `node_modules` at that tree, all untracked symlinks, and restored them afterwards. I did not run `pnpm install`.

## 6. Facts for the orchestrator (not UNEXPLAINED)

1. **Window correction.** The WO's `6b229ad820..b51feb98eb` window cannot explain this motion, because the tip predates L5/L7. With the actual base `6d65c8b7f2`, every UPSTREAM-PROJECTION hunk's cut side is byte-identical to `b51feb98eb` except where a named fork delta sits.
2. **NAMED-FIX lanes outside the four the WO names.** These are reviewed lane commits on L8, with SHAs and issues:
   - L6 line-cap `13bdb562b1` (#1408);
   - lint split `2afd4c429b`/`a2568d076b` (#1396);
   - absorb repairs `1a137df685` (#1396) and `aed08b92ef` (#1375/#1376);
   - the test repair `fad7665b33`, which cites no issue.
   If the orchestrator restricts NAMED-FIX to grok-p1s, scope-correctness, step 6 and L8 absorb, these 16 hunks need a ruling: openclaw-tools H1/H3/H7/H16, compact.hooks.harness H1/H3/H14, compact.hooks.test H5/H15/H19/H28, run.overflow-compaction.harness H3/H7, request-compaction-tool.test H1/H2, callsite-threading H1. The other 2 NAMED-FIX hunks are grok-p1s (continue-delegate-tool H7/H8). No scope-correctness or step-6 commit touches any of the 13 failing files in `9eb655afa7..8ff211b484`; the L8-full merge `511c2d1d64` reaches them only through grok-p1s `a950b1cf64`/`662ff13b4c`.
3. **L6 moved upstream-owned test content into fork-only files.** Upstream's "preserves a deprecated SQLite marker successor for legacy maintenance" test now lives in `compact.hooks.session-state.test.ts`, and upstream's harness-selection mocks now live in `compact.hooks.harness-selection.test-support.ts`. A reviewer diffing `b51feb98eb..cut` sees an upstream test deleted from `compact.hooks.test.ts`. That file also carries four non-continuation fork tests (three permission-policy tests and one OpenAI runtime-provider test, with `resolveSelectedOpenAIRuntimeProviderMock`). By the counterfactual test they are not continuation. This is cut scope (#1418), outside this lane.
4. **Block-number mismatch.** Dead-code commit `20bcb4c83d` says "Block 10", while `WO-129388-presentation-cut.md` numbers dead code as item 9. The rows here use the WO number.
5. **Fork-carried comment.** `openclaw-tools.ts` keeps "Scheduled turns keep delivery routing live…" (fork `5d21ba0a2a`, cron scheduled authority, not continuation) in both tip and cut. It is not part of this motion.

## 7. Per-hunk table

Evidence names the hunk's fork-line commit(s), or, for UPSTREAM-PROJECTION, the upstream commits that the added lines blame to and that removed the deleted lines. "via" is the first-parent merge that brought a cut commit into `8ff211b484`.

#### `src/agents/openclaw-tools.ts`

| hunk | tip range | cut range | +/− | disposition | evidence |
|---|---|---|---|---|---|
| H1 | 17,7 | 17,9 | +2/−0 | NAMED-FIX | split repair keeping the openclaw-tools → openclaw-tools.continuation edge direct: `a2568d076b` on L8, #1396 [1 fork lines] ‖ also upstream: `bdd47f252a` feat: edit personal instructions on multi-user gateways (#155256) |
| H2 | 25,12 | 27,10 | +2/−4 | UPSTREAM-PROJECTION | `10ea4739bd` fix(nodes): apply the same tool policy to node sessions as Gateway ses (#160444); `96f60182b7` refactor(agents): deslop agents core third pass (#159220) |
| H3 | 41,7 | 41,6 | +0/−1 | NAMED-FIX | lint max-lines split to `openclaw-tools.continuation-run.ts`: `2afd4c429b` on L8, #1396 [1 fork lines] |
| H4 | 49,9 | 48,9 | +1/−1 | UPSTREAM-PROJECTION | `f9e969c081` feat(decisions): add explicit evaluation and Labs opt-in foundation (#155134); `bdd47f252a` feat: edit personal instructions on multi-user gateways (#155256) |
| H5 | 63,14 | 62,13 | +2/−3 | UPSTREAM-PROJECTION | `c7bab50e6e` feat(portals): allow scoped previews from dedicated session attachment (#156373); `bdd47f252a` feat: edit personal instructions on multi-user gateways (#155256); `4f8c9d8f78` feat(skills): add installed skill search and read tools (#158090) |
| H6 | 109,14 | 107,9 | +1/−6 | UPSTREAM-PROJECTION | `10ea4739bd` fix(nodes): apply the same tool policy to node sessions as Gateway ses (#160444) |
| H7 | 126,16 | 119,17 | +6/−5 | NAMED-FIX | lint max-lines split to `openclaw-tools.continuation-run.ts`: `2afd4c429b` on L8, #1396 [5 fork lines] ‖ also upstream: `10ea4739bd` fix(nodes): apply the same tool policy to node sessions as Gateway ses (#160444) |
| H8 | 163,43 | 157,29 | +4/−18 | UPSTREAM-PROJECTION | `10ea4739bd` fix(nodes): apply the same tool policy to node sessions as Gateway ses (#160444); `d2811224dc` fix(agents): generated images in shared-main chats run in the backgrou (#161005) |
| H9 | 216,31 | 196,31 | +11/−11 | UPSTREAM-PROJECTION | `10ea4739bd` fix(nodes): apply the same tool policy to node sessions as Gateway ses (#160444); `1c5b8c4134` fix: PDF analysis uses the active vision model (#159593) |
| H10 | 249,64 | 229,32 | +3/−35 | UPSTREAM-PROJECTION | `10ea4739bd` fix(nodes): apply the same tool policy to node sessions as Gateway ses (#160444) |
| H11 | 356,10 | 304,12 | +2/−0 | UPSTREAM-PROJECTION | `3ba0a0b237` fix: recheck unfinished plans before an agent stops (#160297); `4f8c9d8f78` feat(skills): add installed skill search and read tools (#158090) |
| H12 | 369,44 | 319,34 | +13/−23 | UPSTREAM-PROJECTION | `10ea4739bd` fix(nodes): apply the same tool policy to node sessions as Gateway ses (#160444); `dc0874047c` fix: let write operators control their own sessions through agents (#160296) |
| H13 | 418,16 | 358,11 | +2/−7 | UPSTREAM-PROJECTION | `10ea4739bd` fix(nodes): apply the same tool policy to node sessions as Gateway ses (#160444); `c7bab50e6e` feat(portals): allow scoped previews from dedicated session attachment (#156373) |
| H14 | 437,117 | 372,71 | +53/−99 | UPSTREAM-PROJECTION | `10ea4739bd` fix(nodes): apply the same tool policy to node sessions as Gateway ses (#160444); `bdd47f252a` feat: edit personal instructions on multi-user gateways (#155256); `96f60182b7` refactor(agents): deslop agents core third pass (#159220); `f9e969c081` feat(decisions): add explicit evaluation and Labs opt-in foundation (#155134) |
| H15 | 568,82 | 457,58 | +36/−60 | UPSTREAM-PROJECTION | `10ea4739bd` fix(nodes): apply the same tool policy to node sessions as Gateway ses (#160444); `96f60182b7` refactor(agents): deslop agents core third pass (#159220); `e157b5604a` fix: preserve requester routes for delayed session continuations (#156802); `bdd47f252a` feat: edit personal instructions on multi-user gateways (#155256) |
| H16 | 658,39 | 523,22 | +10/−27 | NAMED-FIX | lint max-lines split to `openclaw-tools.continuation-run.ts`: `2afd4c429b` on L8, #1396 [10 fork lines]; split repair keeping the openclaw-tools → openclaw-tools.continuation edge direct: `a2568d076b` on L8, #1396 [1 fork lines]; cut block 1 (delegate-artifacts → #1345): `fff0b2f504` via `b089dda9b8` [1 fork lines] ‖ also upstream: `10ea4739bd` fix(nodes): apply the same tool policy to node sessions as Gateway ses (#160444) |

#### `src/agents/tools/continue-delegate-tool.ts`

| hunk | tip range | cut range | +/− | disposition | evidence |
|---|---|---|---|---|---|
| H1 | 5,15 | 5,9 | +3/−9 | CUT-REMOVAL | cut block 1 (delegate-artifacts → #1345): `fff0b2f504` via `b089dda9b8` [6L]; grok-p1s delegate cap, atomic slot: `a950b1cf64` on L8, #1418/#1396, via `511c2d1d64` [4L]; #1408 L4 TaskFlow→custody re-home: `d71e6bcd3d` on L8 [2L] |
| H2 | 31,8 | 25,6 | +0/−2 | CUT-REMOVAL | cut block 1 (delegate-artifacts → #1345): `fff0b2f504` via `b089dda9b8` [2L] |
| H3 | 98,31 | 90,6 | +0/−25 | CUT-REMOVAL | cut block 1 (delegate-artifacts → #1345): `fff0b2f504` via `b089dda9b8` [25L] |
| H4 | 266,108 | 233,6 | +0/−102 | CUT-REMOVAL | cut block 1 (delegate-artifacts → #1345): `fff0b2f504` via `b089dda9b8` [85L]; #1408 L4 TaskFlow→custody re-home: `d71e6bcd3d` on L8 [16L]; cut block 1: line last edited by #1417 step 5 `ed8ced4b49`, function deleted by `fff0b2f504` [1L] |
| H5 | 391,7 | 256,6 | +0/−1 | CUT-REMOVAL | cut block 1 (delegate-artifacts → #1345): `fff0b2f504` via `b089dda9b8` [1L] |
| H6 | 474,13 | 338,6 | +0/−7 | CUT-REMOVAL | cut block 1 (delegate-artifacts → #1345): `fff0b2f504` via `b089dda9b8` [7L] |
| H7 | 504,24 | 361,16 | +8/−16 | NAMED-FIX | grok-p1s delegate cap, atomic slot: `a950b1cf64` on L8, #1418/#1396, via `511c2d1d64` [15L]; cut block 1 (delegate-artifacts → #1345): `fff0b2f504` via `b089dda9b8` [9L] |
| H8 | 536,94 | 385,74 | +50/−70 | NAMED-FIX | grok-p1s delegate cap, atomic slot: `a950b1cf64` on L8, #1418/#1396, via `511c2d1d64` [87L]; cut block 1 (delegate-artifacts → #1345): `fff0b2f504` via `b089dda9b8` [24L]; #1408 L4 TaskFlow→custody re-home: `d71e6bcd3d` on L8 [6L]; L8-full merge resolution of grok-p1s + cut: `511c2d1d64` [3L] |

#### `src/agents/tools/continue-delegate-tool.test.ts`

| hunk | tip range | cut range | +/− | disposition | evidence |
|---|---|---|---|---|---|
| H1 | 1,13 | 1,11 | +3/−5 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [8L] |
| H2 | 33,16 | 31,14 | +2/−4 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [6L] |
| H3 | 155,8 | 151,8 | +2/−2 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [4L] |
| H4 | 166,118 | 162,6 | +0/−112 | CUT-REMOVAL | cut block 1 (delegate-artifacts → #1345): `fff0b2f504` via `b089dda9b8` [111L]; #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [1L] |
| H5 | 308,7 | 192,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H6 | 337,12 | 221,12 | +2/−2 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [4L] |
| H7 | 354,7 | 238,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H8 | 371,7 | 255,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H9 | 386,7 | 270,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H10 | 422,7 | 306,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H11 | 474,7 | 358,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H12 | 574,7 | 458,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H13 | 599,7 | 483,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H14 | 629,7 | 513,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H15 | 666,7 | 550,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H16 | 711,10 | 595,10 | +2/−2 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [4L] |
| H17 | 731,7 | 615,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H18 | 752,7 | 636,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H19 | 775,7 | 659,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H20 | 798,7 | 682,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H21 | 824,7 | 708,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H22 | 848,7 | 732,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H23 | 867,7 | 751,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H24 | 884,7 | 768,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H25 | 905,7 | 789,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H26 | 927,7 | 811,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H27 | 949,7 | 833,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H28 | 963,7 | 847,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H29 | 1016,7 | 900,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H30 | 1041,7 | 925,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H31 | 1061,7 | 945,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H32 | 1075,7 | 959,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H33 | 1089,7 | 973,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H34 | 1107,7 | 991,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |

#### `src/agents/tools/continue-delegate-tool.crosssession-gate.test.ts`

| hunk | tip range | cut range | +/− | disposition | evidence |
|---|---|---|---|---|---|
| H1 | 1,7 | 1,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H2 | 54,6 | 54,8 | +2/−0 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H3 | 61,7 | 63,6 | +0/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [1L] |
| H4 | 74,7 | 75,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H5 | 84,7 | 85,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H6 | 93,7 | 94,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H7 | 105,13 | 106,13 | +2/−2 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [4L] |
| H8 | 125,7 | 126,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H9 | 138,7 | 139,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H10 | 152,7 | 153,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H11 | 163,7 | 164,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H12 | 178,7 | 179,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |
| H13 | 192,7 | 193,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 G5 suites onto real custody: `57b17df352` on L8 [2L] |

#### `src/agents/tools/request-compaction-tool.ts`

| hunk | tip range | cut range | +/− | disposition | evidence |
|---|---|---|---|---|---|
| H1 | 34,7 | 34,7 | +1/−1 | FEATURE-CHANGE | #1408 L4 custody cutover (comment only): `1a91b04af5` on L8 [2L] |

#### `src/agents/tools/request-compaction-tool.test.ts`

| hunk | tip range | cut range | +/− | disposition | evidence |
|---|---|---|---|---|---|
| H1 | 267,7 | 267,7 | +1/−1 | NAMED-FIX | test repair to the owner-qualified queue key: `fad7665b33` on L8 (no issue cited) [2L] |
| H2 | 337,11 | 337,11 | +2/−2 | NAMED-FIX | test repair to the owner-qualified queue key: `fad7665b33` on L8 (no issue cited) [4L] |

#### `src/agents/tools/request-compaction-tool.callsite-threading.test.ts`

| hunk | tip range | cut range | +/− | disposition | evidence |
|---|---|---|---|---|---|
| H1 | 146,17 | 146,22 | +16/−11 | NAMED-FIX | absorb repair b1c68b936f, adopts upstream #157977 (`34ddb38956`) sourceAuthority: `1a137df685` on L8, #1396 [27L] |

#### `src/agents/tools/continuation-tools-registration.test.ts`

| hunk | tip range | cut range | +/− | disposition | evidence |
|---|---|---|---|---|---|
| H1 | 177,8 | 177,6 | +0/−2 | CUT-REMOVAL | cut block 1 (delegate-artifacts → #1345): `fff0b2f504` via `b089dda9b8` [2L] |

#### `src/agents/embedded-agent-runner/compact-reasons.ts`

| hunk | tip range | cut range | +/− | disposition | evidence |
|---|---|---|---|---|---|
| H1 | 1,6 | 1,3 | +0/−3 | UPSTREAM-PROJECTION | `46147f5e5d` refactor(agents): deslop embedded agent runner fourth pass (#160906) |
| H2 | 25,7 | 22,6 | +0/−1 | CUT-REMOVAL | cut block 7 (reason split restored to upstream): `1ea9c5ed4d` via `f9986a2244` [1 fork lines] |
| H3 | 44,12 | 40,10 | +1/−3 | CUT-REMOVAL | cut block 7 (reason split restored to upstream): `1ea9c5ed4d` via `f9986a2244` [4 fork lines] |
| H4 | 59,15 | 53,6 | +0/−9 | CUT-REMOVAL | cut block 9 dead code (commit says "Block 10"): `20bcb4c83d` via `baa2dd058f` [5 fork lines] ‖ also upstream: `46147f5e5d` refactor(agents): deslop embedded agent runner fourth pass (#160906) |
| H5 | 95,7 | 80,6 | +0/−1 | UPSTREAM-PROJECTION | `18d41b7cde` refactor(agents): deslop agent runners sixth pass (#161874) |
| H6 | 107,12 | 91,9 | +1/−4 | CUT-REMOVAL | cut block 7 (reason split restored to upstream): `1ea9c5ed4d` via `f9986a2244` [3 fork lines] |
| H7 | 154,13 | 135,11 | +0/−2 | UPSTREAM-PROJECTION | `18d41b7cde` refactor(agents): deslop agent runners sixth pass (#161874) |
| H8 | 169,16 | 148,12 | +1/−5 | CUT-REMOVAL | cut block 7 (reason split restored to upstream): `1ea9c5ed4d` via `f9986a2244` [4 fork lines] ‖ also upstream: `18d41b7cde` refactor(agents): deslop agent runners sixth pass (#161874) |

#### `src/agents/embedded-agent-runner/compact-reasons.test.ts`

| hunk | tip range | cut range | +/− | disposition | evidence |
|---|---|---|---|---|---|
| H1 | 8,7 | 8,6 | +0/−1 | CUT-REMOVAL | cut block 9 dead code (commit says "Block 10"): `20bcb4c83d` via `baa2dd058f` [1 fork lines] |
| H2 | 53,7 | 52,6 | +0/−1 | UPSTREAM-PROJECTION | `785fdcaa54` test(core,ui,plugins): remove low-value tests (batch d017) (#158882) |
| H3 | 102,14 | 100,6 | +0/−8 | CUT-REMOVAL | cut block 7 (reason split restored to upstream): `1ea9c5ed4d` via `f9986a2244` [3 fork lines]; cut block 9 dead code (commit says "Block 10"): `20bcb4c83d` via `baa2dd058f` [2 fork lines] |
| H4 | 158,7 | 148,7 | +1/−1 | UPSTREAM-PROJECTION | `785fdcaa54` test(core,ui,plugins): remove low-value tests (batch d017) (#158882) |
| H5 | 166,7 | 156,6 | +0/−1 | UPSTREAM-PROJECTION | `785fdcaa54` test(core,ui,plugins): remove low-value tests (batch d017) (#158882) |
| H6 | 231,7 | 220,6 | +0/−1 | CUT-REMOVAL | cut block 7 (reason split restored to upstream): `1ea9c5ed4d` via `f9986a2244` [1 fork lines] |
| H7 | 247,7 | 235,6 | +0/−1 | CUT-REMOVAL | cut block 7 (reason split restored to upstream): `1ea9c5ed4d` via `f9986a2244` [1 fork lines] |
| H8 | 256,17 | 243,4 | +0/−13 | CUT-REMOVAL | cut block 9 dead code (commit says "Block 10"): `20bcb4c83d` via `baa2dd058f` [10 fork lines] |

#### `src/agents/embedded-agent-runner/compact.hooks.harness.ts`

| hunk | tip range | cut range | +/− | disposition | evidence |
|---|---|---|---|---|---|
| H1 | 1,46 | 1,48 | +23/−21 | NAMED-FIX | L6 line-cap relocation: `13bdb562b1` on L8, #1408 [11 fork lines] ‖ also upstream: `34ddb38956` fix(agents): restore manual and preflight native compaction (#157977); `f77e791fd5` refactor(agents): deslop embedded agent runner third pass (#159597); `b5b1029990` feat(agents): expose installed skill search across harnesses (#158091) |
| H2 | 69,19 | 71,7 | +1/−13 | UPSTREAM-PROJECTION | `f77e791fd5` refactor(agents): deslop embedded agent runner third pass (#159597); `34ddb38956` fix(agents): restore manual and preflight native compaction (#157977) |
| H3 | 140,41 | 130,16 | +8/−33 | NAMED-FIX | L6 line-cap relocation: `13bdb562b1` on L8, #1408 [2 fork lines] ‖ also upstream: `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766); `ed309646b1` refactor: reuse prepared fixtures in slow core tests (#157685); `f77e791fd5` refactor(agents): deslop embedded agent runner third pass (#159597) |
| H4 | 191,7 | 156,7 | +1/−1 | UPSTREAM-PROJECTION | `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766) |
| H5 | 202,7 | 167,7 | +1/−1 | UPSTREAM-PROJECTION | `ed309646b1` refactor: reuse prepared fixtures in slow core tests (#157685) |
| H6 | 257,14 | 222,14 | +4/−4 | UPSTREAM-PROJECTION | `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766) |
| H7 | 275,7 | 240,9 | +3/−1 | UPSTREAM-PROJECTION | `b5b1029990` feat(agents): expose installed skill search across harnesses (#158091) |
| H8 | 299,7 | 266,7 | +1/−1 | UPSTREAM-PROJECTION | `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766) |
| H9 | 331,16 | 298,6 | +0/−10 | UPSTREAM-PROJECTION | `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766); `f77e791fd5` refactor(agents): deslop embedded agent runner third pass (#159597) |
| H10 | 529,8 | 486,6 | +0/−2 | UPSTREAM-PROJECTION | `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766) |
| H11 | 548,11 | 503,11 | +3/−3 | UPSTREAM-PROJECTION | `ed309646b1` refactor: reuse prepared fixtures in slow core tests (#157685); `b5b1029990` feat(agents): expose installed skill search across harnesses (#158091) |
| H12 | 584,19 | 539,7 | +1/−13 | UPSTREAM-PROJECTION | `f77e791fd5` refactor(agents): deslop embedded agent runner third pass (#159597); `163cd10bfa` feat(tools): explain terminal access restrictions (#157014) |
| H13 | 642,8 | 585,7 | +1/−2 | UPSTREAM-PROJECTION | `34ddb38956` fix(agents): restore manual and preflight native compaction (#157977); `4fd44ffcf9` refactor(agents): deslop agent runners second pass (#158879) |
| H14 | 691,30 | 633,7 | +1/−24 | NAMED-FIX | L6 line-cap relocation: `13bdb562b1` on L8, #1408 [4 fork lines] ‖ also upstream: `6652f7eac8` refactor: remove Tasks and TaskFlow runtime (#159179); `163cd10bfa` feat(tools): explain terminal access restrictions (#157014) |
| H15 | 760,12 | 679,7 | +1/−6 | UPSTREAM-PROJECTION | `dbd3bf7da2` refactor(sessions): hydrate saved transcripts off thread (#153325) |
| H16 | 848,21 | 762,6 | +0/−15 | UPSTREAM-PROJECTION | `6652f7eac8` refactor: remove Tasks and TaskFlow runtime (#159179) |
| H17 | 907,23 | 806,15 | +2/−10 | UPSTREAM-PROJECTION | `163cd10bfa` feat(tools): explain terminal access restrictions (#157014); `f77e791fd5` refactor(agents): deslop embedded agent runner third pass (#159597) |
| H18 | 934,12 | 825,6 | +0/−6 | UPSTREAM-PROJECTION | `163cd10bfa` feat(tools): explain terminal access restrictions (#157014) |
| H19 | 973,34 | 858,20 | +4/−18 | UPSTREAM-PROJECTION | `b5b1029990` feat(agents): expose installed skill search across harnesses (#158091); `ed309646b1` refactor: reuse prepared fixtures in slow core tests (#157685); `163cd10bfa` feat(tools): explain terminal access restrictions (#157014); `6652f7eac8` refactor: remove Tasks and TaskFlow runtime (#159179) |
| H20 | 1125,7 | 996,14 | +8/−1 | UPSTREAM-PROJECTION | `34ddb38956` fix(agents): restore manual and preflight native compaction (#157977) |

#### `src/agents/embedded-agent-runner/compact.hooks.test.ts`

| hunk | tip range | cut range | +/− | disposition | evidence |
|---|---|---|---|---|---|
| H1 | 1,14 | 1,12 | +1/−3 | UPSTREAM-PROJECTION | `ed309646b1` refactor: reuse prepared fixtures in slow core tests (#157685); `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766) |
| H2 | 21,7 | 19,6 | +0/−1 | UPSTREAM-PROJECTION | `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766) |
| H3 | 29,14 | 26,10 | +1/−5 | UPSTREAM-PROJECTION | `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766); `ed309646b1` refactor: reuse prepared fixtures in slow core tests (#157685) |
| H4 | 52,18 | 45,19 | +4/−3 | UPSTREAM-PROJECTION | `34ddb38956` fix(agents): restore manual and preflight native compaction (#157977); `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766) |
| H5 | 71,21 | 65,17 | +1/−5 | NAMED-FIX | L6 line-cap relocation: `13bdb562b1` on L8, #1408 [1 fork lines] ‖ also upstream: `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766) |
| H6 | 94,59 | 84,41 | +11/−29 | UPSTREAM-PROJECTION | `34ddb38956` fix(agents): restore manual and preflight native compaction (#157977); `ed309646b1` refactor: reuse prepared fixtures in slow core tests (#157685); `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766); `f77e791fd5` refactor(agents): deslop embedded agent runner third pass (#159597) |
| H7 | 270,7 | 242,7 | +1/−1 | UPSTREAM-PROJECTION | `f77e791fd5` refactor(agents): deslop embedded agent runner third pass (#159597) |
| H8 | 289,6 | 261,15 | +9/−0 | UPSTREAM-PROJECTION | `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766) |
| H9 | 298,7 | 279,7 | +1/−1 | UPSTREAM-PROJECTION | `ed309646b1` refactor: reuse prepared fixtures in slow core tests (#157685) |
| H10 | 359,72 | 340,22 | +7/−57 | UPSTREAM-PROJECTION | `ed309646b1` refactor: reuse prepared fixtures in slow core tests (#157685); `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766); `f77e791fd5` refactor(agents): deslop embedded agent runner third pass (#159597) |
| H11 | 444,196 | 375,95 | +66/−167 | UPSTREAM-PROJECTION | `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766); `b5b1029990` feat(agents): expose installed skill search across harnesses (#158091) |
| H12 | 703,56 | 533,6 | +0/−50 | UPSTREAM-PROJECTION | `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766) |
| H13 | 813,42 | 593,6 | +0/−36 | UPSTREAM-PROJECTION | `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766) |
| H14 | 940,269 | 684,22 | +16/−263 | UPSTREAM-PROJECTION | `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766) |
| H15 | 1225,1111 | 722,450 | +377/−1038 | NAMED-FIX | L6 line-cap relocation: `13bdb562b1` on L8, #1408 [36 fork lines] ‖ also upstream: `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766); `60adac1aff` fix(agents): fit compacted context and prioritize foreground replies (#139822); `13872f4338` fix: plugin tools disappear from Codex and restricted profiles (#124947) |
| H16 | 2384,3353 | 1220,1357 | +1138/−3134 | UPSTREAM-PROJECTION | `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766); `96843f9a72` fix(compaction): restore fallback after safeguard provider failures (#132449); `59e95fe3fd` feat: support GPT-5.6 Ultra across OpenClaw and Codex runtimes (#98021); `1710dac5eb` fix(pi-embedded): route Codex OAuth compaction through OpenAI-Codex |
| H17 | 5739,7 | 2579,10 | +4/−1 | UPSTREAM-PROJECTION | `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766) |
| H18 | 5747,150 | 2590,145 | +109/−114 | UPSTREAM-PROJECTION | `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766); `9d07a96ac9` fix(agents): route unbound OAuth compaction through auth-aware harness; `93bad8de2a` fix: restore GitHub Copilot turns and account context limits (#106198) |
| H19 | 5970,92 | 2808,6 | +0/−86 | NAMED-FIX | L6 line-cap relocation: `13bdb562b1` on L8, #1408 [11 fork lines] ‖ also upstream: `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766) |
| H20 | 6071,103 | 2823,25 | +17/−95 | UPSTREAM-PROJECTION | `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766); `f77e791fd5` refactor(agents): deslop embedded agent runner third pass (#159597); `f94a7dc183` feat(codex): supervise native Codex sessions (#104045) |
| H21 | 6221,64 | 2895,7 | +1/−58 | UPSTREAM-PROJECTION | `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766); `f77e791fd5` refactor(agents): deslop embedded agent runner third pass (#159597) |
| H22 | 6336,105 | 2953,16 | +8/−97 | UPSTREAM-PROJECTION | `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766); `f77e791fd5` refactor(agents): deslop embedded agent runner third pass (#159597) |
| H23 | 6458,87 | 2986,6 | +0/−81 | UPSTREAM-PROJECTION | `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766); `f77e791fd5` refactor(agents): deslop embedded agent runner third pass (#159597) |
| H24 | 6569,98 | 3016,24 | +13/−87 | UPSTREAM-PROJECTION | `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766); `f77e791fd5` refactor(agents): deslop embedded agent runner third pass (#159597) |
| H25 | 6671,80 | 3044,55 | +43/−68 | UPSTREAM-PROJECTION | `12e8edc5be` fix: faulty compaction probe wedges run steering and restart aborts (#154868); `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766); `f77e791fd5` refactor(agents): deslop embedded agent runner third pass (#159597) |
| H26 | 6821,17 | 3169,6 | +0/−11 | UPSTREAM-PROJECTION | `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766); `f77e791fd5` refactor(agents): deslop embedded agent runner third pass (#159597) |
| H27 | 6840,232 | 3177,46 | +37/−223 | UPSTREAM-PROJECTION | `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766); `586df58bcc` fix: allow stopping manual compaction (#90821); `f77e791fd5` refactor(agents): deslop embedded agent runner third pass (#159597); `85cefd0252` fix(compaction): preserve headroom for local chat follow-up turns (#132190) |
| H28 | 7100,63 | 3251,7 | +1/−57 | NAMED-FIX | L6 line-cap relocation: `13bdb562b1` on L8, #1408 [3 fork lines]; absorb repair 2167eab4cf: `aed08b92ef` on L8, #1375/#1376 [1 fork lines]; absorb repair b1c68b936f, adopts upstream #157977 (`34ddb38956`) sourceAuthority: `1a137df685` on L8, #1396 [1 fork lines] ‖ also upstream: `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766); `ed309646b1` refactor: reuse prepared fixtures in slow core tests (#157685); `f77e791fd5` refactor(agents): deslop embedded agent runner third pass (#159597) |
| H29 | 7169,7 | 3264,7 | +1/−1 | UPSTREAM-PROJECTION | `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766); `ed309646b1` refactor: reuse prepared fixtures in slow core tests (#157685) |
| H30 | 7179,120 | 3274,66 | +40/−94 | UPSTREAM-PROJECTION | `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766); `e9fcdb4002` feat(openai): add explicit Agents API MVP harness (#151176); `f77e791fd5` refactor(agents): deslop embedded agent runner third pass (#159597); `ed309646b1` refactor: reuse prepared fixtures in slow core tests (#157685) ‖ note: this region at the cut lacks upstream's "preserves a deprecated SQLite marker successor for legacy maintenance" (b51feb98eb:3317), which L6 `13bdb562b1` relocated to `compact.hooks.session-state.test.ts` (see H28) |
| H31 | 7301,36 | 3342,70 | +54/−20 | UPSTREAM-PROJECTION | `e5d4585279` test(agents,channels,cli): remove low-value tests (batch d091) (#160766); `4273ca9dbd` refactor(sessions): remove file-era transcript runtime (#113233); `2273ef64d5` feat: restore continuation substrate on current upstream |

#### `src/agents/embedded-agent-runner/run.overflow-compaction.harness.ts`

| hunk | tip range | cut range | +/− | disposition | evidence |
|---|---|---|---|---|---|
| H1 | 7,12 | 7,12 | +2/−2 | UPSTREAM-PROJECTION | `504d2905d6` fix(models): apply downloaded catalogs without a Gateway restart (#158000); `79fded8bf5` fix(cron): sessions_send fails after current automation runs (#161085) |
| H2 | 22,13 | 22,17 | +5/−1 | CUT-REMOVAL | cut block 5 (codex-auth): `417b629871` via `87da523da6` [1 fork lines] ‖ also upstream: `504d2905d6` fix(models): apply downloaded catalogs without a Gateway restart (#158000); `2fe1706154` fix(reply): preserve Codex max thinking on reply-path turns (#161103) |
| H3 | 70,12 | 74,6 | +0/−6 | NAMED-FIX | L6 line-cap relocation: `13bdb562b1` on L8, #1408 [4 fork lines] |
| H4 | 85,38 | 83,7 | +1/−32 | UPSTREAM-PROJECTION | `504d2905d6` fix(models): apply downloaded catalogs without a Gateway restart (#158000) |
| H5 | 127,7 | 94,7 | +1/−1 | CUT-REMOVAL | cut block 5 follow-up (upstream-retired #118351 tests): `132abaca9c` via `87da523da6` [1 fork lines] |
| H6 | 136,7 | 103,7 | +1/−1 | UPSTREAM-PROJECTION | `79fded8bf5` fix(cron): sessions_send fails after current automation runs (#161085) |
| H7 | 161,14 | 128,13 | +1/−2 | NAMED-FIX | L6 line-cap relocation: `13bdb562b1` on L8, #1408 [2 fork lines] |
| H8 | 193,22 | 159,31 | +24/−15 | UPSTREAM-PROJECTION | `504d2905d6` fix(models): apply downloaded catalogs without a Gateway restart (#158000) |
| H9 | 258,7 | 233,7 | +1/−1 | CUT-REMOVAL | cut block 5 (codex-auth): `417b629871` via `87da523da6` [1 fork lines] |
| H10 | 268,18 | 243,18 | +4/−4 | CUT-REMOVAL | cut block 5 follow-up (upstream-retired #118351 tests): `132abaca9c` via `87da523da6` [4 fork lines] |
| H11 | 308,8 | 283,8 | +2/−2 | CUT-REMOVAL | cut block 5 follow-up (upstream-retired #118351 tests): `132abaca9c` via `87da523da6` [2 fork lines] |
| H12 | 317,7 | 292,7 | +1/−1 | CUT-REMOVAL | cut block 5 follow-up (upstream-retired #118351 tests): `132abaca9c` via `87da523da6` [1 fork lines] |
| H13 | 347,7 | 322,6 | +0/−1 | UPSTREAM-PROJECTION | `18d41b7cde` refactor(agents): deslop agent runners sixth pass (#161874) |
| H14 | 361,10 | 335,8 | +2/−4 | CUT-REMOVAL | cut block 5 follow-up (upstream-retired #118351 tests): `132abaca9c` via `87da523da6` [2 fork lines] |
| H15 | 372,7 | 344,7 | +1/−1 | CUT-REMOVAL | cut block 5 follow-up (upstream-retired #118351 tests): `132abaca9c` via `87da523da6` [1 fork lines] |
| H16 | 396,7 | 368,7 | +1/−1 | CUT-REMOVAL | cut block 5 (codex-auth): `417b629871` via `87da523da6` [1 fork lines] |
| H17 | 438,11 | 410,11 | +4/−4 | CUT-REMOVAL | cut block 5 (codex-auth): `417b629871` via `87da523da6` [4 fork lines] |
| H18 | 507,7 | 479,6 | +0/−1 | CUT-REMOVAL | cut block 5 follow-up (upstream-retired #118351 tests): `132abaca9c` via `87da523da6` [1 fork lines] |
| H19 | 587,8 | 558,6 | +0/−2 | UPSTREAM-PROJECTION | `18d41b7cde` refactor(agents): deslop agent runners sixth pass (#161874) |
| H20 | 910,7 | 879,6 | +0/−1 | UPSTREAM-PROJECTION | `18d41b7cde` refactor(agents): deslop agent runners sixth pass (#161874) |
| H21 | 936,16 | 904,7 | +1/−10 | CUT-REMOVAL | cut block 5 follow-up (upstream-retired #118351 tests): `132abaca9c` via `87da523da6` [8 fork lines] |
| H22 | 982,6 | 941,7 | +1/−0 | UPSTREAM-PROJECTION | `2fe1706154` fix(reply): preserve Codex max thinking on reply-path turns (#161103) |


## 8. Exact commands

```
git rev-parse <each ref>; git ls-remote origin <branches>; git merge-base 9eb655afa7 b51feb98eb
bash /tmp/g2-fcbc.sh 9eb655afa7 8ff211b484 /tmp/g2-cores.txt --upstream b51feb98eb   # tools from bootstrap fb5ac57b93
git diff --stat 9eb655afa7 879ff7e1bb | 879ff7e1bb 8ff211b484 | b51feb98eb 8ff211b484 | 6d65c8b7f2 9eb655afa7 -- <13 files>
python3 /tmp/g2/attr.py <file>        # blame + recursive first-parent vanish + upstream -S
python3 /tmp/g2/forklines.py <file>   # fork-line split vs 6d65c8b7f2 / b51feb98eb
python3 /tmp/g2/forkattr.py <file>    # commit attribution of fork lines only
NO_COLOR=1 FORCE_COLOR=0 env -u GITHUB_REPOSITORY node scripts/run-vitest.mjs run <paths> --maxWorkers=1
```

CI path: **focused-only**. The WO asks for behaviour checks, not broad acceptance, so I dispatched no Mode-B run. I did not use GitNexus: every symbol movement (the continuation-run extraction, the harness-selection extraction, the session-state relocation) was resolved directly with `git log -S` and byte checks against the moved-to files.
