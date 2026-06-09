# ADDENDUM — back-merge drift `8b5dde6165` → `09153e9f1230b9cbc93f48cbcb1ac41d95391de3`

This corpus is the **full proof set carried forward** from `PROOFS/8b5dde6165958d0eaba3c492ae52311548313de4/` onto the post-back-merge presentation head `09153e9f12`. The carry-over is **byte-valid**: the code every behavioral row attests is provably untouched by the back-merge (see § Code-path byte-identity).

## What changed (the drift)

`09153e9f12` is a **history-preserving back-merge**: parents = `8b5dde6165` (the proven continuation fold) + `upstream/main` `7cdec28706`. Reason: resolve a single conflict on `src/auto-reply/reply/agent-runner-execution.ts` so the PR is mergeable against upstream and **upstream CI runs** (it won't run on an unmergeable branch).

- **315 files of upstream/main absorbed** (`8b5dde6165..09153e9f12`).
- **One conflict resolved** (`agent-runner-execution.ts`): upstream refactored the compaction-notice path (`shouldNotifyUserAboutCompaction`→imported fn, extracted `deliverCompactionNoticePayload`/`createCompactionNoticePayload`); the feature added `surfaceBlockedLivenessState` (blocked-liveness) + an inline `sendCompactionNotice`. Resolution = adopt upstream's refactor + re-insert the **severable** `surfaceBlockedLivenessState` block (called at `:2707`, absent upstream); drop the now-stale inline form. tsgo-clean; independently byte-walked + confirmed by 🩸 Cael.

## Safety bytes on `09153e9f12` (byte-verified)

| Check | Expected | Actual |
|---|---|---|
| `compactionFailureContext` in `run.ts` | 0 (never 4 = 1× catastrophe) | **0** ✅ |
| `run.ts` changed by the merge? | no | **byte-UNCHANGED** ✅ |
| slack cure (`prepare.test.ts` saveSessionStore) | 4 | **4** ✅ |
| matrix cure (`session-route.test.ts` saveSessionStore) | 3 | **3** ✅ |
| `surfaceBlockedLivenessState` (feature blocked-liveness) | present | **present** ✅ |
| upstream/main ancestor of head | yes (mergeable) | **yes** ✅ |

## Code-path byte-identity (why the proofs carry over)

Every continuation-**primitive** prod surface the behavioral rows attest is **byte-IDENTICAL** between `8b5dde6165` and `09153e9f12`:

```
src/agents/embedded-agent-runner/run.ts                IDENTICAL   (R-CD-3 timeout-compaction 2× failover)
src/agents/embedded-agent-runner/attempt-execution.ts  IDENTICAL   (R-CW-* continue_work + #952 fromBracket→spawn)
src/agents/embedded-agent-runner/tokens.ts             IDENTICAL   (R-*-TOKEN continuation-signal parse)
src/agents/tools/request-compaction-tool.ts            IDENTICAL   (R-RC-1/2 accept/reject guard)
src/agents/tools/continue-delegate-tool.ts             IDENTICAL   (R-CD-1/2/4 + chained)
src/auto-reply/continuation/scheduler.ts               IDENTICAL   (R-CW-6 chain-depth reject)
```

Cohort byte-confirmations on the same: 🩸 Cael (`attempt-execution.ts`/`tokens.ts`/`request-compaction-tool.ts` identical) · 🌫 Silas (7 silas-canonical paths identical incl. `continue-delegate-tool.ts`/`scheduler.ts`/`status-message.ts`/`subagent-announce.*`).

**The only files the merge touched in the compaction area are NOT the proven primitive surfaces:** `embedded-agent-runner.ts` (+2), `compact-reasons.ts` (+1/-1), `runs.ts` (+9, identical to upstream/main = pure upstream-drift), `compaction-notice.ts` (+67 = upstream's new `createCompactionNoticePayload` helper, used by the conflict-fix), and `agent-runner-execution.ts` (the resolved notice-path). None alter the continuation primitives the rows fire.

## Carry-over verdict

The `8b5dde6165` board — **25 ✅ PASS · 2 ⚠️ HONEST-LIMIT · 0 🔴 FAIL** — holds on `09153e9f12` by code-path byte-identity. `R-CD-3` (timeout-compaction) **re-points** (run.ts byte-identical, not re-run). The Tempo traces + journal receipts in the carried row dirs remain valid evidence for `09153e9f12` because the exercised code is unchanged.

**Available if gate-grade-plus is wanted** (figs's call, not gating): a live re-fire on a deployed `09153e9f12` seat + a true timeout-compaction-trigger capturing the 2× auth-rotation in gateway logs (the one honest-limit half 🕯 scoped). Not required for this addendum — the primitives are byte-unchanged.

— 🌿 frond-scribe, per figs directive (`create a proofs full set for 09153, drop an addendum, include the full set`).
