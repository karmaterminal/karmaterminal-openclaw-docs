# EVIDENCE — PR #746 Layer 2 Complementary Cure (spawn-init continueWorkOpts)

**Cure branch:** `emeric/20260603/746-followup-spawn-init-continueWorkOpts`
**Base:** `uncurse/20260603/copilot-opus47-1m-from-presentation` (post-absorb head `c477b13c8c`)
**Cure target:** `src/agents/command/attempt-execution.ts` (runAgentAttempt → runEmbeddedAgent at byte 649)

## Lane-take

`/tableflip-essential` / lamp-axis — figs `1511789649` + Cael `1511790615`/`1511790113`. Cosigned, no veto.

## Substrate

Issue #746 was REOPENED by Cael `1511789404` after Silas `1511789172` empirical re-test post-PR-#892-merge: `CONTINUE_WORK STILL NOT AVAILABLE` from inside a subagent spawned via `continue_delegate`. PR #892 was a Layer 1 partial cure that only fixed the followup-runner (turn-2+) path; the spawn-init (turn-1) path still landed in a subagent tool-list that lacked `continue_work`.

## Pre-cure empirical baseline

- **Silas `1511789172`:** subagent reported `CONTINUE_WORK STILL NOT AVAILABLE` on turn 1 even though PR #892 had merged. Same observable Cael flagged as the false-empirical-proof class (`1511789404`): `turn 2/200` event was produced by `continue_delegate` chain-hop, not by `continue_work`, so the cure-mechanism was indistinguishable from the wake-mechanism without tool-list introspection.
- **Code-walk:** `subagent-spawn.ts:1589` → `callSubagentGateway({method: "agent", ...})` → gateway routes to `agentCommandInternal` → `runAgentAttempt` (`src/agents/command/attempt-execution.ts:392`) → `runEmbeddedAgent` (call-site `attempt-execution.ts:649`). The `runEmbeddedAgent` call-site at byte 649 did **not** forward a `continueWorkOpts` closure, so `openclaw-tools.ts:592` evaluated `options?.continueWorkOpts` as `undefined` and skipped `createContinueWorkTool(...)` for the turn-1 tool-list.
- **PR #892 cure-site (Layer 1, turn-2+):** `src/auto-reply/reply/followup-runner.ts:957` and `src/auto-reply/reply/agent-runner-execution.ts:2519` already construct the closure correctly:
  ```ts
  continueWorkOpts:
    runtimeConfig?.agents?.defaults?.continuation?.enabled === true
      ? { requestContinuation: (request) => { attemptContinueWorkRequest = request; } }
      : undefined,
  ```

## Cure-mechanism distinction

Same observable, different mechanism. Both produce a `turn 2/200`-shaped event:

| Mechanism | Path | Tool-list invariant |
|-----------|------|---------------------|
| `continue_delegate` chain-hop | TaskFlow durable queue dispatches a new subagent session at turn-2 | `continue_delegate` present; `continue_work` absent if Layer 2 broken |
| `continue_work` in-session | Same-session post-turn heartbeat-wake re-fires the runner on turn-2 | **`continue_work` present in turn-1 tool-list** |

The cure must be verified via **tool-list introspection** on turn-1, not via the wake-event firing on turn-2 (which both mechanisms produce). The trap-test added in commit 1 of this PR pins exactly that invariant.

## Cure

`src/agents/command/attempt-execution.ts` — three changes inside `runAgentAttempt`:

1. **Closure construction (mirroring agent-runner-execution.ts:2519-2526):**
   ```ts
   const continuationEnabled =
     params.cfg?.agents?.defaults?.continuation?.enabled === true;
   let attemptContinueWorkRequest: ContinueWorkRequest | undefined;
   const continueWorkOpts = continuationEnabled
     ? {
         requestContinuation: (request: ContinueWorkRequest) => {
           attemptContinueWorkRequest = request;
         },
       }
     : undefined;
   ```

2. **Forward to runEmbeddedAgent at byte 649:** add `continueWorkOpts,` to the call-site param object so `openclaw-tools.ts:592` registers `continue_work` for the turn-1 tool-list.

3. **Post-turn heartbeat-wake scheduler (new local helper `scheduleSpawnInitContinueWorkWake`):** mirrors the followup-runner block (`src/auto-reply/reply/followup-runner.ts:1167-1233`):
   - Dynamic-imports `auto-reply/continuation/{config,state}.js` + `infra/system-events.js` so spawn-init keeps a clean static dep graph when continuation is disabled.
   - Loads chain state, enforces `maxChainLength`, clamps delay to `{min, max, defaultDelayMs}`.
   - Persists advanced chain state, enqueues `[continuation:wake]` system event, arms `requestHeartbeatNow(...)` with `unref()`-ed timer.

## Trap-test-first sequence

Per figs `1511789649` + Cael `1511790615`/`1511790113` discipline (RED → cure → GREEN, never bare cure):

### Commit 1 — RED trap-test
`src/agents/command/attempt-execution.continue-work-opts.test.ts`

Asserts `runEmbeddedAgentMock.mock.calls[0][0].continueWorkOpts` is defined when `cfg.agents.defaults.continuation.enabled === true`, and undefined when disabled. **Verified RED on the pre-cure HEAD** (commit `faefc8a085`):

```
× forwards continueWorkOpts to runEmbeddedAgent when continuation.enabled=true (spawn-init / turn-1) 13ms
✓ does NOT forward continueWorkOpts when continuation is disabled  2ms

AssertionError: expected undefined to be defined
  ❯ ../../src/agents/command/attempt-execution.continue-work-opts.test.ts:180:40
```

(Run across both vitest project shards `agents-core` + `agents-support`; both fail identically on the positive assertion.)

### Commit 2 — Cure
`src/agents/command/attempt-execution.ts` plumbing per above. **Verified GREEN** at commit `aed00a5057`:

```
✓ ../../src/agents/command/attempt-execution.continue-work-opts.test.ts  (2 tests)
✓ ../../src/agents/command/attempt-execution.continue-work-opts.test.ts  (2 tests)
Test Files  2 passed (2)
     Tests  4 passed (4)
```

The pre-existing Layer 1 tests (`src/auto-reply/reply/followup-runner.test.ts` — `createFollowupRunner continueWorkOpts threading (#746)`) also remain GREEN:

```
✓ passes continueWorkOpts to runEmbeddedAgent when continuation.enabled=true  777ms
✓ does NOT pass continueWorkOpts when continuation is disabled
```

### Commit 3 — Extended coverage
Adds:
- End-to-end closure-invocation test that drives `runEmbeddedAgentMock` with an implementation invoking the captured `requestContinuation(...)` closure, guarding against a future regression that forwards a stub closure rather than the real accumulator.
- Cross-layer drift sentinel that explicitly cross-references both Layer 1 (`followup-runner.test.ts`) and Layer 2 (this file) cure-sites in the same test output so a maintainer searching for `#746` sees both at once. Defends against the false-empirical-proof class (Cael `1511789404`): fixing one layer in isolation must not silently reopen the other.

GREEN at commit `63fcc16860`: 4 tests per shard × 2 shards = 8 passing.

## Post-cure verification protocol

To verify the cure on a built artifact:

1. Build + restart gateway with the cure branch.
2. Fire a `continue_delegate` from the main session.
3. The delegate inspects its own tool list and confirms `continue_work` is **present** on turn 1 (was absent pre-cure).
4. The delegate calls `continue_work({reason: "...", delaySeconds: N})`.
5. Verify the next turn fires via the **continue_work** heartbeat-wake path (system event `[continuation:wake] Turn X/200. The agent elected to continue working.`) and NOT via a chain-hop `continue_delegate` re-spawn. Distinguish in logs by:
   - `[attempt-execution] continue_work timer fired for session ...` (Layer 2 cure path)
   - vs. a fresh `subagent-spawn` log entry (chain-hop path)

## Cross-references

- **Layer 1 (turn-2+):** PR #892 `feat(continuation): restore continue_work() in subagent sessions (#746, cherry-pick from 583903b422)` → `src/auto-reply/reply/followup-runner.ts:957`, `src/auto-reply/reply/agent-runner-execution.ts:2519`
- **Layer 2 (turn-1, this PR):** `src/agents/command/attempt-execution.ts:649` (cure) + `src/agents/command/attempt-execution.continue-work-opts.test.ts` (trap-test)
- **Empirical re-test:** Silas `1511789172` (`CONTINUE_WORK STILL NOT AVAILABLE` post-#892)
- **Reopen rationale:** Cael `1511789404` (false-empirical-proof class)
- **Trap-test-first discipline:** figs `1511789649`, Cael `1511790615`/`1511790113`
- **Lane-take cosign:** lamp-axis `/tableflip-essential`

## Discipline-floor receipts

- gh auth verified `emeric-dandelion-cult` (`gh api user --jq .login`).
- Continuation-feature scope only (per figs `1511746478`); no unrelated diffs.
- Trap-test-first per figs `1511789649`: RED proof captured at commit `faefc8a085`, cure at `aed00a5057`, extended coverage at `63fcc16860`.
- Cure-mechanism-distinction documented per Cael `1511789404`.
- Absorbed/restructured prior `1511789480` delegate's working-tree WIP into the trap-test-first commit-sequence required by `1511789649`.
