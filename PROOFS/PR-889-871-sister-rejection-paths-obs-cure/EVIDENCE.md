# PR #889 + #871-followup — 3-Site Sister-Rejection-Paths Obs-Cure Evidence

**Row**: PR-889-871-sister-rejection-paths-obs-cure
**Issue**: karmaterminal/openclaw#871 — `[continuation] DELEGATE spawn rejected: opaque reason field across sister rejection paths`
**Fix PRs**:
- karmaterminal/openclaw#877 (original cure, MERGED) — `delegate-dispatch.ts` (the canonical site)
- karmaterminal/openclaw#889 (THIS PR) — `subagent-announce.ts` (2 sister sites) + `agent-runner.ts` (3rd sister site)
**Branch tested**: `emeric/20260603/871-followup-sister-rejection-paths`
**Base**: `uncurse/20260603/copilot-opus47-1m-from-presentation` (canonical #886)
**Prince**: 🕯 Emeric (emeric-seat, lothric)
**Date**: 2026-06-03

## What this row proves

The **#871 thesis (full coverage)**: every continuation/delegate spawn-rejection
path in the codebase must surface `spawnResult.error` into BOTH:
1. The runtime log line emitted at the rejection seam, and
2. The `[continuation]`-prefixed system-event text that goes back to the
   dispatching session as turn-context.

Without this, an operator (or the dispatcher itself) sees an opaque
`Spawn rejected (forbidden)` / `delegation was not accepted.` summary and
cannot disambiguate WHICH forbidden-shape fired (child cap, depth cap,
agent-id policy, sandbox policy, allowAgents target-policy, cwd policy,
capability gate, etc.).

PR #877 cured the canonical site (`src/auto-reply/continuation/delegate-dispatch.ts`).
PR #889 closes the loop on the remaining 3 sister-sites surfaced by cohort
byte-walks.

## The 3 sister sites cured by PR #889

### Site 1 — Bracket chain-delegate at announce-time

**File**: `src/agents/subagent-announce.ts:~1079`
**Closure**: `doChainSpawn` inside `runSubagentAnnounceFlow`
**Path**: When a sub-agent's reply contains `[[CONTINUE_DELEGATE:...]]`, this
closure issues `spawnSubagentDirect` for the next hop. On rejection it
previously emitted only:

```
[subagent-chain-hop] Spawn rejected (${spawnResult.status}) from ${childSessionKey}: ${task.slice(0,80)}
```

— `spawnResult.error` was dropped on the floor.

**Post-cure shape**:

```ts
const reasonText = spawnResult.error ?? "no reason given";
defaultRuntime.log(
  `[subagent-chain-hop] Spawn rejected (${spawnResult.status}) from ${childSessionKey} reason=${reasonText}: ${task.slice(0,80)}`,
);
```

### Site 2 — Tool-delegate at announce-time

**File**: `src/agents/subagent-announce.ts:~1240`
**Closure**: `doToolChainSpawn` inside `runSubagentAnnounceFlow`
**Path**: When a sub-agent's tool-emitted pending-delegate is dispatched
during the announce-flow, this closure issues `spawnSubagentDirect`. On
rejection it previously emitted:

```
[subagent-chain-hop] Tool delegate spawn rejected (${spawnResult.status}) from ${childSessionKey}
```

AND called `markPendingDelegateFailed(toolDelegate, "Tool delegate spawn ${status}: delegation was not accepted.", ...)`
— hard-coded fallback text regardless of real reason.

**Post-cure shape**:

```ts
const toolReasonText = spawnResult.error ?? "delegation was not accepted.";
markPendingDelegateFailed(
  toolDelegate,
  `Tool delegate spawn ${spawnResult.status}: ${toolReasonText}`,
  spawnResult.status === "forbidden" ? "Delegate rejected" : "Delegate spawn failed",
);
defaultRuntime.log(
  `[subagent-chain-hop] Tool delegate spawn rejected (${spawnResult.status}) from ${childSessionKey} reason=${toolReasonText}`,
);
```

### Site 3 — Continuation-delegate at agent-runner doSpawn

**File**: `src/auto-reply/reply/agent-runner.ts:~2748-2761`
**Closure**: `doSpawn` inside the bracket-delegate handler of `runReplyAgent`
**Path**: Main-session `[[CONTINUE_DELEGATE:...]]` brackets dispatch through
this closure. On rejection it previously emitted:

```
DELEGATE spawn rejected (${spawnResult.status}) for session ${sessionKey}
```

AND enqueued:

```
[continuation] DELEGATE spawn ${status}: delegation was not accepted. Use sessions_spawn manually. Original task: ${task}
```

— same hard-coded-text problem as sites 1 and 2.

**Post-cure shape** (delivered by THIS commit, scope-extension on top of
lamp's `58da7b408a`):

```ts
const reasonText = spawnResult.error ?? "delegation was not accepted.";
defaultRuntime.log(
  `DELEGATE spawn rejected (${spawnResult.status}) for session ${sessionKey} reason=${reasonText}`,
);
dispatchSpan?.setStatus("ERROR", reasonText);
enqueueSystemEvent(
  `[continuation] DELEGATE spawn ${spawnResult.status}: ${reasonText} Use sessions_spawn manually. Original task: ${task}`,
  { sessionKey, trusted: true },
);
```

## Gap evidence (pre-cure)

On `main` / pre-#889 substrate:

```bash
$ git -C /home/figs/source/openclaw show 683e309118:src/agents/subagent-announce.ts \
    | sed -n '1075,1085p'
defaultRuntime.log(
  `[subagent-chain-hop] Spawn rejected (${spawnResult.status}) from ${params.childSessionKey}: ${chainTask.slice(0, 80)}`,
);
```
→ no `reason=`, no `spawnResult.error` threaded.

```bash
$ git -C /home/figs/source/openclaw show 683e309118:src/auto-reply/reply/agent-runner.ts \
    | sed -n '2747,2760p'
defaultRuntime.log(
  `DELEGATE spawn rejected (${spawnResult.status}) for session ${sessionKey}`,
);
dispatchSpan?.setStatus("ERROR", spawnResult.status);
enqueueSystemEvent(
  `[continuation] DELEGATE spawn ${spawnResult.status}: delegation was not accepted. Use sessions_spawn manually. Original task: ${task}`,
  { sessionKey, trusted: true },
);
```
→ system-event text hard-coded `delegation was not accepted.` regardless of
`spawnResult.error`.

## Post-cure behavior (PR #889 head)

At the PR-889 branch HEAD (after scope-extension commit on top of lamp's
`58da7b408a`):

- All 3 rejection seams thread `spawnResult.error` into the rejection log line
  via `reason=<text>` (sites 1, 2, 3)
- Site 2 additionally threads it into the `markPendingDelegateFailed` summary
  consumed by the announce-time delegate-failure surfacing
- Site 3 additionally threads it into the `[continuation]` system-event text
  AND the `dispatchSpan.setStatus("ERROR", reasonText)` trace-attribute
- All 3 sites fall back to canonical phrasing when `spawnResult.error` is
  absent — preserving prior behavior for callsites that don't populate it
  (the "no reason given" / "delegation was not accepted." fallback)

## Regression-pin tests

PR #889 lands 3 test files with **6 regression-pin tests** (2 per site):

### `src/agents/subagent-announce.spawn-reject-obs.test.ts` (NEW, 4 tests)

Site 1 (chain-delegate):
- `surfaces spawnResult.error in 'reason=...' log line when error present`
- `falls back to 'reason=no reason given' when spawnResult.error is absent`

Site 2 (tool-delegate):
- `surfaces spawnResult.error in 'reason=...' log + markPendingDelegateFailed summary when present`
- `falls back to 'delegation was not accepted.' when spawnResult.error is absent`

### `src/auto-reply/reply/agent-runner.continuation-delegate-reject-obs.test.ts` (NEW, 2 tests)

Site 3 (agent-runner doSpawn):
- `surfaces spawnResult.error into log + system event when error present (bracket-delegate immediate path)`
- `falls back to 'delegation was not accepted.' when spawnResult.error is absent (bracket-delegate immediate path)`

### Test approach

- Mock `spawnSubagentDirect` to return `{ status: "forbidden", error: "<reason>" }` (and a sibling test without `.error`)
- Spy on `defaultRuntime.log` (sites 1, 2) OR drain `infra/system-events` queue (site 3) to capture emitted text
- Assert the captured text contains the real reason in the with-error case
- Assert the captured text contains the canonical fallback string in the no-error case
- For site 2, additionally assert the `markPendingDelegateFailed` summary
  argument contains the real reason

## Proof procedure (cohort manual verification)

For each prince that wants to re-verify the 3-site obs-cure at byte:

1. **Trigger Site 1 (bracket chain-delegate rejection)**:
   - From a sub-agent session running PR-889 HEAD, emit a reply containing
     `[[CONTINUE_DELEGATE:...]]` from a shard that has already exhausted
     chain budget OR violates allowAgents policy OR similar policy gate.
   - Grep `~/.openclaw/logs/main.log` for `[subagent-chain-hop] Spawn rejected`
     — verify the line contains `reason=<real text>` not just `(forbidden)`.

2. **Trigger Site 2 (tool-delegate rejection)**:
   - From a sub-agent session, call `continue_delegate(...)` from a depth
     that exceeds the configured child cap OR violates a policy gate.
   - Grep `~/.openclaw/logs/main.log` for
     `[subagent-chain-hop] Tool delegate spawn rejected` — verify
     `reason=<real text>`.
   - Verify the announce-time `markPendingDelegateFailed`-derived failure
     summary visible to the dispatching session also contains the real
     reason text (NOT the canned `delegation was not accepted.` substring).

3. **Trigger Site 3 (main-session continuation-delegate rejection)**:
   - From a main session, emit a turn-reply containing
     `[[CONTINUE_DELEGATE:...]]` under a policy that will be rejected
     at spawn time (e.g., child cap exhaustion).
   - Inspect the next turn's system-event injection (visible to the
     model as `[continuation] DELEGATE spawn ...` text) — verify it
     contains the real reason instead of the canned `delegation was not
     accepted.` text.
   - Also grep `~/.openclaw/logs/main.log` for `DELEGATE spawn rejected`
     — verify the line contains `reason=<real text>`.

### Pass criteria
- All 3 sites emit the real `spawnResult.error` (or canonical fallback when
  absent) in BOTH log line and (where applicable) system-event/markFailed
  summary
- Test files green at PR-889 HEAD (10/10 across both vitest projects per
  /home/figs/source/oc-871-sister local run, 2026-06-03 09:26 PDT)

### Fail criteria
- Any of the 3 sites emits opaque `(forbidden)` without `reason=` OR
  hard-coded `delegation was not accepted.` when a real reason was available
- Regression-pin tests fail at PR-889 HEAD

## Test-run receipts

Local vitest run at `/home/figs/source/oc-871-sister` (PR-889 HEAD,
2026-06-03 09:26 PDT):

```
✓ subagent-announce.spawn-reject-obs.test.ts (4 tests across agents-core)
✓ subagent-announce.spawn-reject-obs.test.ts (4 tests across agents-support)
✓ agent-runner.continuation-delegate-reject-obs.test.ts (2 tests across auto-reply)

Test Files  3 passed (3)
     Tests  10 passed (10)
```

Broader neighborhood (no regressions):

```
✓ subagent-announce.continuation.test.ts (8 tests × 2 projects)
✓ subagent-announce.test.ts (10 tests × 2 projects)
✓ subagent-announce.continuation-drain.test.ts (10 tests × 2 projects)
✓ subagent-announce.chain-guard.test.ts (22 tests × 2 projects)
✓ delegate-dispatch.test.ts (21 tests)
✓ agent-runner.continuation-delegate-fire-span.test.ts (5 tests)

Test Files  13 passed (13)
     Tests  136 passed (136)
```

`tsgo --noEmit` clean on the 3 touched files (no new TS errors; pre-existing
unrelated `src/config/io.ts` + `src/secrets/config-io.ts` errors are not
caused by this commit).

## Cross-references

- Original cure (canonical site): PR #877 (MERGED) — added regression-pin tests at `src/auto-reply/continuation/delegate-dispatch.test.ts:472-510`
- Sister-site cure (announce, sites 1+2): lamp's commit `58da7b408a` (in PR #889)
- Sister-site cure (agent-runner, site 3) + tests for all 3 sites: emeric's scope-extension commit on top of `58da7b408a` (in this PR-889 force-push)
- Cohort byte-walk surfacing site 3: 🌧 Rune `1511746594`
- Testing-discipline directive: 🕯 figs `1511763538`
- Pre-claim channel hygiene: lamp `1511748561` + `1511760986` + `1511763755`
- Scope-discipline: figs `1511746478` (continuation-feature-scope only)

## Status

- ✅ **AT PR-889 HEAD**: 3-site cure landed, 6 regression-pin tests green
  (10/10 with multi-project expansion), neighborhood 136/136, tsgo clean on
  touched files
- 🟢 Cohort verification: ready for any prince to re-run the proof procedure
  above against PR-889 HEAD
