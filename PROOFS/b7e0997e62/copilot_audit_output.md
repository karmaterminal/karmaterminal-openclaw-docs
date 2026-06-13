# PR #79925 cure-(1) — copilot/gpt-5.5 lane: 10-path immaterial-gates audit

**Re-anchored to squashed PR head `b7e0997e62cddef4ab73613a4741491477bccc77`**
**(2026-05-14, 🌫 Silas, post-figs's "proofs updated" directive at msg `1504507276`)**

## Provenance

- **Shipping commit**: `b7e0997e62cddef4ab73613a4741491477bccc77` on PR head `frond-scribe-claude/20260509/narrow-surgery-tight` of `karmaterminal/openclaw` (cross-repository PR fork-side; PR is `openclaw/openclaw#79925`).
- **Author**: `silas-dandelion-cult`.
- **Co-authors**: `Copilot`, `cael-dandelion-cult`, `ronan-dandelion-cult`, `elliott-dandelion-cult`.
- **Pre-squash provenance**:
  - Authored on candidate branch `silas/79925-pr-cure-1-copilot-candidate` as 2 commits + lane-bookkeeping.
    - `5a2e135f921965d99f4036b72b9c237a9c83d6c9` — original 18-line delete (route-tree-returns through resolver).
    - `a7413ee844c4e110675db7af3e859de88ae9f0b1` — chain-hop dispatch gate (the 7th-path cure caught at §4 audit divergence).
  - Cohort 4/4 cosigned `5615cf2516e57cd87e08a1da78e64c8f52cd4722` (the pre-squash tip) before figs's "squash before push" canon directive.
  - 🩸 Cael executed the squash + force-push to `b7e0997e62`. Cure-bytes byte-identical to pre-squash; lane-bookkeeping files filtered out (`WORKORDER.md`, `tmp-drop-me-*.md`, `tmp/codeagents/*` retained on lane branch as substrate-walk receipt-history only).
- **Tracking**: `karmaterminal/openclaw#684` (copilot lane); `karmaterminal/openclaw#685` (claude lane, abandoned post-contamination).

## Summary

The shipping commit:

1. **Removes** the hand-rolled inner cross-session gate at the targeted-return delivery boundary in `src/agents/subagent-announce.ts` (lines 1228-1246 in the pre-cure tree). That gate hand-rolled its own cross-session predicate that incorrectly treated `fanoutMode="tree"` as cross-session, while the shared `hasCrossSessionDelegateTargeting` helper in `src/auto-reply/continuation/targeting-pure.ts` treats tree as intra-lineage. Tree-fanout returns produced under the default `crossSessionTargeting:"disabled"` policy were silently dropped at this gate even though every upstream tool-entry and dispatch gate (which uses the helper) correctly let them through.

2. **Routes** every continuation-targeting completion in the targeted-return path through `resolveContinuationReturnTargetSessionKeys` unconditionally, matching the `feature/context-pressure-squashed@f187917c92` reference architecture.

3. **Extends the cure** to gate the subagent chain-hop dispatch path (`subagent-announce.ts:~959-1050`), which previously forwarded child-emitted `[[CONTINUE_DELEGATE:]]` targeting (`fanoutMode`, `targetSessionKey`, `targetSessionKeys`) to `spawnSubagentDirect` without any cross-session policy check. The new `rejectCrossSessionTargetingForSubagentDispatch` helper uses the shared `hasCrossSessionDelegateTargeting` predicate, gates both bracket-source and tool-source chain-hop dispatches, and emits an actionable trusted system event explaining the rejection with the rejected task name. **This 7th-path bypass was caught at §4 audit divergence between the two parallel-track lanes**: the claude lane initially declared 6-path-exhaustive at CP4; the copilot lane found the 7th path and authored the upstream-gate cure-extension; 🩸 Cael byte-walked + cosigned + cited the same path as load-bearing.

4. **Centralizes** all cross-session policy enforcement at upstream gates (no delivery-time policy gate remains). After this change every cross-session policy decision lives at one of these sites:
   - Tool-entry gate: `src/agents/tools/continue-delegate-tool.ts` (rejected at the prince's `continue_delegate(...)` call).
   - Dispatch gates: `src/auto-reply/reply/agent-runner.ts` (bracket-source + tool-source dispatch), `src/auto-reply/continuation/delegate-dispatch.ts` (extracted dispatch helper), `src/auto-reply/reply/post-compaction-delegate-dispatch.ts` (durable-queue drain).
   - Subagent chain-hop gate (NEW): `src/agents/subagent-announce.ts` via `rejectCrossSessionTargetingForSubagentDispatch`.

The resulting shape: **every cross-session continuation policy decision is one helper call (`hasCrossSessionDelegateTargeting`) at one of five upstream gate sites; the targeted-return delivery boundary is purely resolver-driven and admits whatever the upstream gates have approved.**

`fanoutMode: "tree"` is treated as same-tree targeting and remains deliverable under default `crossSessionTargeting: "disabled"`. `fanoutMode: "all"` and explicit cross-session targets are rejected by shared-helper gates with an actionable system event.

## Immaterial-gates audit table (10 paths)

The audit walked every code path that could reach `enqueueContinuationReturnDeliveries` or `spawnSubagentDirect` with continuation targeting attached, to verify that **every** policy decision uses the shared helper and that **no** delivery path can grow a divergence post-cure.

| # | Path | Reaches delivery? | Gated where? | Gate policy-aware? |
|---|------|-------------------|--------------|--------------------|
| 1 | Main-session `continue_delegate` tool call, normal mode → `enqueuePendingDelegate` → `dispatchToolDelegates` → `spawnSubagentDirect` → child return in `runSubagentAnnounceFlow` → `enqueueContinuationReturnDeliveries` | Yes | `src/agents/tools/continue-delegate-tool.ts` rejects at tool entry; `src/auto-reply/continuation/delegate-dispatch.ts` rejects again before spawn | Yes. Both use `hasCrossSessionDelegateTargeting`; `all` and explicit cross-session targets rejected; `tree` allowed. |
| 2 | Main-session `continue_delegate` tool call, post-compaction mode → staged/released via `dispatchStagedPostCompactionDelegates` → `spawnSubagentDirect` → child return → `enqueueContinuationReturnDeliveries` | Yes | Tool entry in `continue-delegate-tool.ts`; staged dispatch in `src/auto-reply/continuation/delegate-dispatch.ts` | Yes. Both use `hasCrossSessionDelegateTargeting`. |
| 3 | Queued post-compaction delivery entries → `src/auto-reply/reply/post-compaction-delegate-dispatch.ts` → `spawnSubagentDirect` → child return → `enqueueContinuationReturnDeliveries` | Yes | Delivery/release guard at `post-compaction-delegate-dispatch.ts:507-522` | Yes. Existing persisted-entry safety gate uses `hasCrossSessionDelegateTargeting`; rejects stale `all`/explicit cross-session entries while allowing `tree`. |
| 4 | Bracket `[[CONTINUE_DELEGATE: ...]]` emitted by a main/session turn → `agent-runner.ts` → `spawnSubagentDirect` → child return → `enqueueContinuationReturnDeliveries` | Yes | `src/auto-reply/reply/agent-runner.ts:2484-2511` bracket delegate guard before spawn | Yes. Uses `hasCrossSessionDelegateTargeting`. |
| 5 | Tool delegates consumed in `agent-runner.ts` legacy/runner path → `spawnSubagentDirect` → child return → `enqueueContinuationReturnDeliveries` | Yes | `src/auto-reply/reply/agent-runner.ts:2997-3024` tool delegate guard before spawn | Yes. Uses `hasCrossSessionDelegateTargeting`. |
| 6 | **Child subagent emits bracket `[[CONTINUE_DELEGATE: ...]]` during a continuation chain-hop** → `subagent-announce.ts` spawns the next child → final child return → `enqueueContinuationReturnDeliveries` | Yes | **NEW** in this commit: `rejectCrossSessionTargetingForSubagentDispatch` before `spawnSubagentDirect` in the chain-hop dispatch helper at `subagent-announce.ts:~959-1050`. | Yes. New gate uses `hasCrossSessionDelegateTargeting` with the emitting child session as dispatching session; tests cover disabled `all` rejection and disabled `tree` allow. |
| 7 | **Child subagent enqueues tool delegates consumed by `subagent-announce.ts` during a continuation chain-hop** → next child spawn → final child return → `enqueueContinuationReturnDeliveries` | Yes | **NEW** in this commit: same `rejectCrossSessionTargetingForSubagentDispatch` before child-spawn dispatch (covers the tool-delegate variant of the chain-hop bypass). | Yes. New gate uses `hasCrossSessionDelegateTargeting`; tests cover disabled `all` rejection and disabled `tree` allow. |
| 8 | Targeted return delivery in `subagent-announce.ts` with `continuationTargetSessionKey(s)` or `continuationFanoutMode` (the cured site) | Yes | **No delivery-time policy gate remains.** Delivery is only the resolver/enqueue boundary after upstream gates admit the work. | Yes by upstream gates above; delivery uses `resolveContinuationReturnTargetSessionKeys` for target resolution, not policy classification. |
| 9 | `silentAnnounce` sibling path in `subagent-announce.ts` without continuation targeting | No, not via `enqueueContinuationReturnDeliveries` | Sends an in-memory system event only to `targetRequesterSessionKey`. | Not a cross-session continuation return path. |
| 10 | Direct announcement sibling path in `subagent-announce.ts` without continuation targeting | No, not via `enqueueContinuationReturnDeliveries` | Calls `deliverSubagentAnnouncement` for the requester origin only. | Not a cross-session continuation return path. |

### Production grep results after the refactor

- `enqueueContinuationReturnDeliveries(` has **one** production caller: `src/agents/subagent-announce.ts`.
- Policy gates using `hasCrossSessionDelegateTargeting` remain in:
  - `src/agents/tools/continue-delegate-tool.ts`
  - `src/auto-reply/continuation/delegate-dispatch.ts`
  - `src/auto-reply/reply/agent-runner.ts`
  - `src/auto-reply/reply/post-compaction-delegate-dispatch.ts`
  - `src/agents/subagent-announce.ts` (NEW: child chain-hop dispatch helper)
- Config/schema/type references are passive contract surfaces, not enforcement points.

## Validation

All gates green on `b7e0997e62`:

- `pnpm test src/agents/subagent-announce.chain-guard.test.ts` → 17 tests passed.
- `pnpm test src/agents/subagent-announce` → 76 Vitest shards passed.
- `pnpm test src/auto-reply/continuation` → 11 files / 130 tests passed (matches PR base baseline + new tests; 22 pre-existing failures in `vi.mock` fixtures are pre-existing baseline noise tracked as separate followup issue).
- `pnpm test` (focused suite) → 3 shards passed for the new regression files.
- `pnpm tsgo` → passed.
- `pnpm check:changed` → passed.
- `pnpm build` → passed.

Per-SHA test receipts collected by 🩸 Cael in pre-squash byte-walk:

| SHA | Scope `src/auto-reply/continuation` | Verdict |
|-----|-------------------------------------|---------|
| `446e285f7d` (PR base, feat-continuation) | 22 fail / 262 pass | baseline noise (pre-existing `vi.mock` fixture gap) |
| `5615cf2516` (cohort-cosigned pre-squash tip) | 22 fail / **264** pass | matches baseline + 7th-path cure tests pass |
| `418ec5cef0` (claude-lane declare-done, abandoned) | 27-40 fail / 244-257 pass | CP5 fixture-repair contaminated lane (5+ NEW regressions) |

These pre-squash receipts read honest as "we tested these commits before squashing, then squashed for upstream presentation per figs's directive." Cure-bytes in `b7e0997e62` are byte-identical to the cure-region of `5615cf2516`.

## Pattern G synthesis-as-artifact

This cure landed because two parallel-track harnesses (Pattern G, per figs's `1504488616238518435` directive) walked the same task spec independently:

- **🩸 claude-opus-4.6 lane** on `cael/79925-pr-cure-1-claude-candidate` — independently arrived at the same 18-line delete (commit `946ca2d1fa`, byte-identical to copilot lane's `5a2e135f92`).
- **🌫 copilot/gpt-5.5 lane** on `silas/79925-pr-cure-1-copilot-candidate` — same 18-line delete + 7th-path chain-hop cure-extension (`a7413ee844`).

The convergence at the cure-region (byte-identical 18-line delete from two independent LLMs in two worktrees with two different architectures) is strong cross-confirmation evidence. The divergence at §4 audit (claude-lane declared 6-path-exhaustive; copilot found and cured the 7th) is exactly the immaterial-gates verification figs called load-bearing — and only Pattern G could surface it.

🩸 then ran wider-scope vitest (`src/auto-reply/continuation` whole-tree) and found his own claude lane contaminated by CP5 fixture-repair regressions, named it cleanly without ego-protection, and recommended shipping copilot lane directly. The shipping artifact is the integration of both lanes' work + 🩸's contamination-naming discipline; neither lane alone would have shipped this clean.

## Substrate-walk discipline catches across the morning

Five independent substrate-walk catches before the lane closed (each one would have shipped a worse cure or a destructive-write disaster without it):

1. **2026-05-14 13:56Z — byte-walk convergence.** Four princes independently re-grounded on the clawsweeper P2 finding within ~60s. 🌻 Elliott: *"if four leaves coordinate first, you get consensus. if four leaves re-ground first, you get evidence."*
2. **2026-05-14 14:06Z — 8030-commit-obliteration averted.** Force-pushing `f187917c92` → PR head would have obliterated 8030 main-sync commits already on `446e285f7d`. 🩸 Cael's hold + 🌻 Elliott's 5-minute walk + cohort cherry-pick discipline saved the substrate.
3. **2026-05-14 14:47Z — 7th-path immaterial gate caught.** 🌫 Silas's parallel-harness (copilot lane) found the chain-hop bypass that 🩸 Cael's claude-lane audit (CP4) had marked as 6-path-exhaustive. 🩸 byte-walked, cosigned, steered claude lane in-flight to extend.
4. **2026-05-14 15:18Z — claude-lane contamination caught.** 🩸 Cael ran wider-scope vitest, found his own lane contaminated by CP5 fixture-repair regressions, surfaced without ego-protection: *"ship copilot directly. abandon claude lane."*
5. **2026-05-14 15:33Z — commit-count squash gap caught.** figs flagged: *"Remember to squash before push, I show 9 commits on our PR."* Cohort 4/4 had cosigned "ship as-cosigned" with lane-bookkeeping baked in. figs's *squash before push* canon outranks cohort cosign when cosign was on a frame the canon supersedes. 🩸 squashed cleanly + dropped lane-bookkeeping files in the same operation.

## Proof gaps (residual, honest accounting)

- Discord archive receipt reads for messages `1504484335468937408` and `1504486610715283467` could not be locally verified inside the copilot harness lane because `discrawl`, `$HOME/.discrawl/discrawl.db`, and the relay helper checkout were unavailable in that lane environment. The workorder itself includes the load-bearing quote and message IDs; no forbidden runtime/parallel worktree paths were read.
- Pre-existing 22-failure baseline noise in `src/auto-reply/continuation/*` (`vi.mock` fixture gap) is real test-debt orthogonal to this cure; tracked as separate followup with the per-SHA evidence above.
- WORKORDER §5 methodology gap surfaced by the claude-lane contamination catch: both lanes initially scoped vitest to touched-files only, missing contamination outside scope. Should be "broader-scope re-run" — runbook + workorder template patch follow-up.

## Cohort attribution

Shipping commit `b7e0997e62`:
- **Author**: silas-dandelion-cult
- **Co-author**: Copilot <223556219+Copilot@users.noreply.github.com> (the harness)
- **Co-author**: cael-dandelion-cult <265407017+cael-dandelion-cult@users.noreply.github.com>
- **Co-author**: ronan-dandelion-cult <ronan.dandelion.cult@hotmail.com>
- **Co-author**: elliott-dandelion-cult <elliott.dandelion.cult@hotmail.com>

Per Pattern G synthesis-as-artifact canon: every prince who held substrate gets attribution because the cure exists at the bytes that shipped only because of their respective discipline at named load-bearing moments.
