# Cost Cap + Chain Depth Wiring Investigation

SHA inspected: `335acbe43a354486e74c684aaa2e2fe14e9aa8c6` / PR #85651 head.

## 1. Q1 finding - does hot-reload happen?

**Finding: external on-disk changes to `agents.defaults.continuation.*` probably do not reach already-running gateway sessions.** The continuation enforcement call sites are written to prefer the live runtime snapshot, but the gateway reload planner classifies `agents.defaults.continuation.costCapTokens` / `maxChainLength` under the broad `agents` no-op rule, so the runtime snapshot is not refreshed for the normal file-watcher path.

The cap values themselves resolve from `agents.defaults.continuation`: `maxChainLength` at `src/auto-reply/continuation/config.ts:83-86` and `costCapTokens` at `src/auto-reply/continuation/config.ts:87-90`. The normal resolver defaults to `getRuntimeConfig()` (`src/auto-reply/continuation/config.ts:64-66`), and `getRuntimeConfig()` goes through `loadConfig()` (`src/config/io.ts:2390-2400`), whose comment explicitly says the first successful load becomes the process snapshot and long-lived runtimes should update it via explicit reload/watcher paths (`src/config/io.ts:2390-2395`). The process snapshot is cached by `loadPinnedRuntimeConfig()` (`src/config/runtime-snapshot.ts:261-268`).

The intended per-decision hot-read helper is `resolveLiveContinuationRuntimeConfig(fallbackCfg)`, which reads `getRuntimeConfigSnapshot() ?? fallbackCfg` on every call (`src/auto-reply/continuation/config.ts:114-118`). Main runner cap enforcement uses it for bracket continuations (`src/auto-reply/reply/agent-runner.ts:2420-2427`) and tool delegates (`src/auto-reply/reply/agent-runner.ts:3000-3018`). Followup turns also use it for tool delegate max-chain threading (`src/auto-reply/reply/followup-runner.ts:946-975`) and followup `continue_work` scheduling (`src/auto-reply/reply/followup-runner.ts:1039-1045`). This means the enforcement code is only as hot as the global runtime snapshot.

The gateway does seed that snapshot on startup (`src/gateway/server.impl.ts:657`). Hot reload also can refresh it: `onHotReload` prepares/activates runtime secrets (`src/gateway/server-reload-handlers.ts:659-679`), and activation calls `setRuntimeConfigSnapshot(next.config, next.sourceConfig)` (`src/secrets/runtime-state.ts:103-120`). However, `agents.defaults.continuation.*` has no specific reload rule. It falls through to `{ prefix: "agents", kind: "none" }` (`src/gateway/config-reload-plan.ts:112-118`). The plan builder pushes `kind: "none"` paths into `plan.noopPaths` (`src/gateway/config-reload-plan.ts:364-377`), and the reloader returns early for a no-op plan before `onHotReload` runs (`src/gateway/config-reload.ts:249-254`). For ordinary watcher reads, the file snapshot is applied via `applySnapshot(snapshot.config, snapshot.sourceConfig)` (`src/gateway/config-reload.ts:343-358`), but that path only updates the reloader's local `currentConfig`, not the global runtime snapshot, before the no-op early return (`src/gateway/config-reload.ts:225-228`, `src/gateway/config-reload.ts:253-254`).

So: if the config change is made in-process through the same gateway process, `finalizeRuntimeSnapshotWrite()` can refresh the runtime snapshot before notifying listeners (`src/config/runtime-snapshot.ts:280-305`, `src/config/io.ts:2537-2560`). But a deployed-host config patch written to disk and picked up by the gateway watcher is likely treated as "agents no-op" and leaves `getRuntimeConfigSnapshot()` stale. That matches the observed failure where a chain started under `costCapTokens=500000` did not observe a later `costCapTokens=1000` patch.

## 2. Q2a cost-cap wiring

### Read site

`costCapTokens` is read from `agents.defaults.continuation.costCapTokens`, clamped as a non-negative integer, with default `500_000` (`src/auto-reply/continuation/config.ts:19`, `src/auto-reply/continuation/config.ts:87-90`). A zero value disables the cost cap in the shared budget check (`src/auto-reply/continuation/scheduler.ts:65`).

### Accumulation / compare sites

The canonical chain state adapter folds the current turn's input+output usage into persisted `continuationChainTokens` (`src/auto-reply/continuation/state.ts:158-166`). Main bracket continuations compute `previousChainTokens + turnTokens` and reject when `accumulatedChainTokens > costCapTokens` (`src/auto-reply/reply/agent-runner.ts:2477-2488`). Tool delegates loaded after the response use `loadContinuationChainState(activeSessionEntry, turnTokens)` and pass that state into `dispatchToolDelegates` (`src/auto-reply/reply/agent-runner.ts:3000-3018`), where `checkContinuationBudget()` is invoked per delegate (`src/auto-reply/continuation/delegate-dispatch.ts:287-307`).

`checkContinuationBudget()` itself uses strict greater-than: `config.costCapTokens > 0 && chainState.accumulatedChainTokens > config.costCapTokens` (`src/auto-reply/continuation/scheduler.ts:65-70`). Equality is intentionally allowed; the tests pin that contract (`src/auto-reply/continuation/scheduler.test.ts:66-83`, `src/auto-reply/continuation/delegate-dispatch.cost-cap-exhaustion.test.ts:360-409`).

Subagent-chain returns accumulate child input+output tokens onto the parent session before evaluating another child-emitted continuation (`src/agents/subagent-announce.ts:866-917`). The bracket subagent chain guard compares parent chain tokens against `costCapTokens` (`src/agents/subagent-announce.ts:982-989`), and the tool-delegate subagent guard does the same (`src/agents/subagent-announce.ts:1142-1149`). Post-compaction delivery compares persisted `continuationChainTokens` to the cap before spawning (`src/auto-reply/reply/post-compaction-delegate-dispatch.ts:471-500`), and in-process post-compaction dispatch also uses `checkContinuationBudget()` (`src/auto-reply/continuation/delegate-dispatch.ts:511-542`).

### Rejection emission

Main bracket continuations emit a trusted system event plus a `continuation.disabled` span on cost cap (`src/auto-reply/reply/agent-runner.ts:2487-2515`). Main/tool delegates emit a trusted system event like `Tool delegate rejected: cost-capped` and mark the TaskFlow failed (`src/auto-reply/continuation/delegate-dispatch.ts:297-307`). Post-compaction delivery emits a system event (`src/auto-reply/reply/post-compaction-delegate-dispatch.ts:493-500`) and has tests for that shape (`src/auto-reply/reply/post-compaction-delegate-dispatch.test.ts:851-878`).

Important gap: these are system events/logs, not immediate tool-result JSON. `continue_delegate` returns JSON saying the delegate was scheduled and that chain tracking applies later (`src/agents/tools/continue-delegate-tool.ts:271-282`); R-CW-5/R-CW-6 cap enforcement happens after the response finalizes. The model sees cap rejection only if that system event is routed back into a later turn. Subagent chain rejections are weaker: bracket and tool subagent chain cost-cap failures only log and drop the continuation (`src/agents/subagent-announce.ts:1000-1008`, `src/agents/subagent-announce.ts:1148-1153`), with no trusted system event or structured JSON in the rejecting child/parent context.

### Bypasses / gaps

1. **Config reload bypass:** external disk edits to `agents.defaults.continuation.costCapTokens` are classified as no-op and likely never update the runtime snapshot, so all otherwise-correct comparisons can keep using the old cap.
2. **Followup `continue_work` bypass:** `followup-runner.ts` loads accumulated tokens for followup `continue_work` (`src/auto-reply/reply/followup-runner.ts:1048-1054`) but checks only chain depth (`src/auto-reply/reply/followup-runner.ts:1056-1060`). There is no `costCapTokens` comparison before it schedules and persists the next work turn (`src/auto-reply/reply/followup-runner.ts:1061-1103`).
3. **Subagent-chain emission gap:** subagent bracket/tool chain cap failures only log/drop, so a live test expecting a structured rejection in-agent will not see one on that path.
4. **Direct scheduler wrappers are not production callers:** `scheduleWorkContinuation()` and `scheduleDelegateContinuation()` both call `checkContinuationBudget()` (`src/auto-reply/continuation/scheduler.ts:96-99`, `src/auto-reply/continuation/scheduler.ts:172-175`), but `rg` found their production use only in scheduler tests. Current production enforcement is mostly hand-wired in `agent-runner.ts`, `followup-runner.ts`, `delegate-dispatch.ts`, `post-compaction-delegate-dispatch.ts`, and `subagent-announce.ts`.

## 3. Q2b chain-depth wiring

### Read site

`maxChainLength` is read from `agents.defaults.continuation.maxChainLength`, clamped to a positive integer, with default `10` (`src/auto-reply/continuation/config.ts:18`, `src/auto-reply/continuation/config.ts:83-86`).

### Compare sites

The shared budget checker computes `allocatedChainHop = max(currentChainCount, highestDelayedContinuationReservationHop(sessionKey))` and rejects when `allocatedChainHop >= config.maxChainLength` (`src/auto-reply/continuation/scheduler.ts:52-63`). This is the `scheduler.ts:51-73` function from the workorder: it checks both depth and cost, but it is directly used only by delegate-dispatch/post-compaction code today, not by the main bracket path.

Main bracket continuations duplicate that depth check inline: they read `activeSessionEntry.continuationChainCount`, fold in the highest delayed reservation, and reject at `allocatedChainHop >= maxChainLength` (`src/auto-reply/reply/agent-runner.ts:2431-2444`). Main/tool delegates use `dispatchToolDelegates()` and the shared checker (`src/auto-reply/continuation/delegate-dispatch.ts:287-307`). The followup `continue_work` path rejects at `currentChainCount >= maxChainLength` (`src/auto-reply/reply/followup-runner.ts:1053-1060`).

Subagent chain handling uses the chain-hop prefix as the depth source. For child bracket continuations, it parses `[continuation:chain-hop:N]`, computes `nextChainHop = childChainHop + 1`, and rejects when the child is already at the cap (`childChainHop >= maxChainLength`) (`src/agents/subagent-announce.ts:965-980`). For child tool delegates, it rejects when the next hop would exceed the cap (`nextToolHop > toolMaxChainLength`) (`src/agents/subagent-announce.ts:1122-1139`). That allows spawning hop exactly `maxChainLength`, then rejects the next hop; tests cover the exact boundary for both bracket and tool subagent paths (`src/agents/subagent-announce.chain-guard.test.ts:214-233`, `src/agents/subagent-announce.chain-guard.test.ts:376-399`).

### Rejection emission

Main bracket chain cap emits a trusted system event and disabled span (`src/auto-reply/reply/agent-runner.ts:2437-2475`). Main/tool delegate chain cap emits a trusted system event and marks TaskFlow failed (`src/auto-reply/continuation/delegate-dispatch.ts:287-307`). Post-compaction delivery emits a system event (`src/auto-reply/reply/post-compaction-delegate-dispatch.ts:479-490`), with tests (`src/auto-reply/reply/post-compaction-delegate-dispatch.test.ts:821-848`).

The two weak paths mirror the cost-cap gaps. Followup `continue_work` only logs on chain cap and does not enqueue a system event (`src/auto-reply/reply/followup-runner.ts:1056-1060`). Subagent bracket/tool chain caps only log and drop (`src/agents/subagent-announce.ts:1000-1004`, `src/agents/subagent-announce.ts:1134-1139`). That explains why a live R-CW-6 path can reject or drop a boundary continuation without the expected structured rejection surfacing to the agent.

### Comparison correctness

The main/shared comparisons are consistent with "allow the cap hop, reject the next one": stored/current count at `maxChainLength` rejects a new continuation (`>=`), while subagent tool path rejects only `nextToolHop > maxChainLength`. Cost uses strict `>` everywhere inspected, so equality with `costCapTokens` is allowed. The likely observed R-CW-6 failure is not an obvious off-by-one in the main/shared checker; it is more likely stale config, a non-emitting subagent/followup path, or both.

## 4. Regression hypothesis

Local history is shallow/grafted, but blame still points to two relevant introductions:

- `resolveLiveContinuationRuntimeConfig()` and the current continuation enforcement wiring were introduced by `6a23864d12 feat(continuation): context-pressure-aware continuation (continue_work / continue_delegate / request_compaction)` (`src/auto-reply/continuation/config.ts:104-118`, `src/auto-reply/reply/agent-runner.ts:2420-2490`, `src/auto-reply/reply/followup-runner.ts:1048-1062`).
- The broad `{ prefix: "agents", kind: "none" }` reload rule predates that continuation commit in local blame (`dcc5e45b50`, `src/gateway/config-reload-plan.ts:112-118`).

Most likely regression shape: continuation was built assuming `gateway/reload config change applied` would refresh the runtime snapshot, but the existing reload rules classify `agents.defaults.continuation.*` as no-op, so the snapshot never changes for external gateway file-watcher edits. The second likely source of the live "no structured rejection" observation is that subagent/followup cap paths log/drop rather than enqueueing the rejection event the model can consume.

## 5. Recommended verification

Minimal reproducer for Q1: a gateway config-reload unit test that changes only `agents.defaults.continuation.costCapTokens` (and `maxChainLength`) through the external snapshot/watcher path and asserts that `getRuntimeConfigSnapshot()?.agents?.defaults?.continuation` changes in the gateway process. A smaller first assertion is that `buildGatewayReloadPlan(["agents.defaults.continuation.costCapTokens"])` should not be a pure no-op. Suspect fix shape: add an explicit `agents.defaults.continuation` hot-reload rule, likely with whatever heartbeat/tool-surface action is needed when `enabled` changes, so `onHotReload` runs and refreshes the runtime snapshot.

Minimal reproducer for Q2/R-CW-5: seed a followup session with `continuationChainTokens > costCapTokens`, make a followup turn call `continue_work`, and assert no timer/wake is scheduled plus a trusted cap event is emitted. Today that path has no cost-cap branch.

Minimal reproducer for Q2/R-CW-6 structured rejection: run `subagent-announce` with a child task at `[continuation:chain-hop:${maxChainLength}]` that emits another `CONTINUE_DELEGATE`, then assert a cap rejection system event is enqueued to the requester/parent session. Today the path only logs and drops. A parallel tool-delegate subagent test should assert the same for `nextToolHop > maxChainLength`.

Existing tests that currently pass are narrower than the live R-CW-5/R-CW-6 probe: `delegate-dispatch.cost-cap-exhaustion.test.ts` and `delegate-dispatch.chain-depth-exhaustion.test.ts` call `dispatchToolDelegates()` directly with injected chain state/config, so they do not exercise gateway config hot reload, followup `continue_work`, or subagent rejection emission.
