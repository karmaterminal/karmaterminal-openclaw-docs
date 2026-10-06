# Method

## What runs

`harness/recovery-proof.mts` loads the **production modules of the tree under test** (`--tree`, a clean detached worktree) and assembles the Discord monitor the way `monitorDiscordProvider` (`extensions/discord/src/monitor/provider.ts`) does, minus native commands, voice, thread bindings and ACP. It runs no vitest and mocks none of the modules under test. Discord itself is `harness/mock-discord.mts`, a separate loopback HTTP + WebSocket server the production client reaches through `DISCORD_API_URL`. That is the production endpoint override in `extensions/discord/src/endpoint-runtime.ts`; it accepts loopback `http://` / `ws://` only.

```
mock Discord (127.0.0.1, ephemeral port)            production code (tree under test)
  GET /gateway/bot  <-------------------------------  createDiscordGatewayPlugin (endpoint metadata fetch)
  WebSocket: HELLO -> IDENTIFY -> READY,          <-->  GatewayPlugin (internal/gateway.ts): heartbeat,
             GUILD_CREATE, MESSAGE_CREATE ...           identify, dispatch; DiscordGatewayChannelInventory
  GET /users/@me    <-------------------------------  fetchDiscordBotIdentity (provider.startup.ts)
                                                       Client.dispatchGatewayEvent -> DiscordMessageListener
                                                         -> createDiscordMessageHandler (message-handler.ts)
                                                           -> createDiscordIngressMonitor.accept (ingress.ts)
                                                             -> SQLite durable ingress queue
                                                       runDiscordGatewayLifecycle -> registerGateway
                                                       drain (ingress-drain.ts)
                                                         -> pending-disposition pass + stale policy (head)
                                                         -> claim -> createDiscordMessageDispatcher
                                                           -> debouncer -> preflightDiscordMessage
  GET /channels/:id, GET /guilds/:id  <-----------------     (channel info, guild)
  GET /channels/:c/messages/:m  <-----------------------     (REST hydration, reply-target re-fetch)
                                                           -> message run queue -> processDiscordMessage
                                                              = TURN STAND-IN (adopts; see below)
```

Production functions called directly by the harness, with the arguments `monitorDiscordProvider` passes:
- `createDiscordMonitorClient`, `fetchDiscordBotIdentity`, `registerDiscordMonitorListeners` (`monitor/provider.startup.ts`)
- `createDiscordLivePolicyReader` (`monitor/live-policy.ts`), over a `readConfig` function the harness owns
- `sessionRuntime.createDiscordMessageHandler`, `createNoopThreadBindingManager` (`monitor/provider-session.runtime.ts`)
- `discordProviderRuntime.runDiscordGatewayLifecycle` and `.createClient` (`monitor/provider-runtime.ts`)
- `createPluginServiceScheduler(new GatewayScheduler())` for the scheduler argument
- `createRuntimeChannel()` (`src/plugins/runtime/runtime-channel.ts`) as the plugin runtime's `channel` surface

## Phases

Each scenario runs as **two processes** over one state dir.

- **Phase A (outage, wedged drain).** The gateway connects and delivers the backlog as `MESSAGE_CREATE` frames. Their Discord `timestamp`s are T-62..T-22 min. Each frame goes through the production listener, handler and ingress monitor and is admitted durably, but the drain never starts. The process then shuts down cleanly with every row `pending`.
- **Phase B (recovery).** A fresh process runs the unmodified composition (drain on): new mock port, new IDENTIFY / READY / GUILD_CREATE. In `recovery` the gateway also delivers one live `@mention`. The harness then waits until no row is `pending` or `claimed`.

## Stand-ins and limits (every one)

1. **Discord is a mock.** `mock-discord.mts` speaks only what this path needs:
   - REST: `GET /gateway/bot`, `GET /users/@me`, `GET /channels/:id`, `GET /guilds/:id`, `GET /channels/:c/messages/:m`. Other `POST`/`PUT`/`PATCH`/`DELETE` calls get 204 and are logged.
   - Gateway: HELLO, IDENTIFY -> READY + GUILD_CREATE, HEARTBEAT -> ACK, RESUME -> RESUMED, and scripted DISPATCH.
   - It does not enforce rate limits, intents or permissions, and there is no compression.
   - Every REST call and every gateway frame is logged (`[discord-rest]`, `[discord-gateway]`).
2. **Agent turn: stand-in.** `processDiscordMessage` is replaced through the production testing hook `createDiscordMessageHandler({ testing: { processDiscordMessage } })` (`message-run-queue.ts`). It runs only after production preflight has returned a context.
   - It logs the context's `wasMentioned`, `effectiveWasMentioned` and `inboundEventKind`.
   - It then calls `ctx.turnAdoptionLifecycle.onAdopted()`, which is what the real reply pipeline does through `bindIngressLifecycleToReplyOptions`, and returns. The production run queue then settles the ingress claim.
   - No model is called and no reply is sent.
3. **Phase A drain suppression.** `createDiscordMessageHandler({ testing: { createIngressMonitor } })` wraps the production `createDiscordIngressMonitor` in a Proxy whose `start()` is a no-op. That is how the outage keeps admitted rows `pending`. Phase B passes no `createIngressMonitor`.
4. **Plugin runtime.**
   - `setDiscordRuntime` receives `channel` = production `createRuntimeChannel()`.
   - It also receives `state.openChannelIngressQueue` = `createChannelIngressQueue({ ...options, channelId: "discord", stateDir })`, the same call `src/plugins/registry-runtime.ts` makes, without the runtime-currency assertion.
   - Every other runtime access is logged as `[runtime] access …` and throws. In the recorded runs, preflight and ingress touched only these two surfaces.
5. **Queue observation wrapper.** The queue returned in item 4 has its `fail` wrapped to log each call and its result (`[queue] fail(...) -> committed|not committed`), then delegate unchanged.
   - In `edit-commit` the wrapper also publishes the config edit *before* delegating the first fail. Because this happens inside `queue.fail`, after the stale policy has returned its verdict, it is the interleaving 🌊 described.
6. **Config edit injection (`edit-decide`).** The `readPolicy` handed to the handler wraps the production reader. On the first read whose call stack is inside `ingress-stale-policy.ts` (after the guild is hydrated), it publishes the edit *after* the reader returned the snapshot. The verdict is therefore computed on the old config.
   - On a tree without the stale policy (control), the edit is published on the first read after hydration instead.
   - The edit adds `messages.groupChat.mentionPatterns: ["\\bhelper\\b"]`.
7. **Channel rename injection (`rename-commit`).**
   - The run config carries a name-keyed direct-open entry, `guilds[<guild>].channels.concierge.requireMention = false`. No channel has that name at startup, and the live policy reader is seeded with that entry as resolved, which is the shape startup REST resolution leaves intact.
   - The queue `fail` wrapper (item 5) handles the first pre-claim fail as follows, before delegating to the real `fail`:
     - the mock renames `general` (unlisted in the name-keyed channel map, so preflight drops it as `channelConfig.allowed===false`) to `concierge` (so later REST `GET /channels/:id` answers agree);
     - it sends `CHANNEL_UPDATE` over the WebSocket;
     - it waits until the production `GatewayPlugin`'s inventory shows the new name.
   - The rename is therefore applied to the session inventory after the stale policy returned its verdict and before the fail's write reaches the state worker.
8. **Composition subset.** Native commands (empty arrays), voice (off) and thread bindings (noop manager) are not wired. ACP reconciliation and the startup status log are skipped.
9. **Identities and timestamps.**
   - All snowflakes are synthetic (`1000…01` guild, `2000…01` channel, `3000…01` bot, `4000…01/02` humans, `5000…NN` messages) and are relabelled in the logs.
   - The token is the literal `proof-token-not-a-credential` and is redacted from the IDENTIFY log.
   - Clocks are real (`Date.now`). Backlog age comes from the frames' Discord `timestamp`; the durable receipt is never newer.
10. **Isolation.**
   - Each run sets `HOME`, `TMPDIR`, `OPENCLAW_STATE_DIR`, `OPENCLAW_CONFIG_PATH` and `OPENCLAW_PROFILE` to its own run dir, and writes the file log to `<run>/openclaw-<phase>.log`.
   - There is no network beyond 127.0.0.1. Every process runs under `nice -n 10 taskset -c 16-31 timeout 300`.
   - The host's production gateway, its config and its units are not touched.

## Trees

| side | tree | sha |
| --- | --- | --- |
| head | PR head | `2d997a0bcd9b7eb104b1890699cf20f90e45ba17` |
| prefix-cdef | head before the channel-facts fence | `cdef5a1d956ac04f9b006c9295ed1e4ea9131e77` |
| control | merge base (upstream main) | `ca43d19197888f3d42237b4425f08a473779266f` |
| prefix-fbef | head before the config-freshness fences | `fbef5fda32fd284fb6dc8b19f20c6f778c77bf09` |
| prefix-08d7 | head before the commit-time guard | `08d7a0292cac17ad21a24ce1ff173b8ee31d6342` |

Every tree is a clean detached worktree (`dirty=0` in each log). Each has its own `pnpm install --frozen-lockfile` from the identical lockfile (`pnpm-lock.yaml` blob `eb9be2e161593e0cf28bd1337cd9453f9c37d3eb` on all five). Node is `v26.9.0`, on Linux x86-64.

## Commands

```bash
bash harness/run-all.sh   # every scenario x tree; writes logs/<side>-<scenario>.log
```

`run-all.sh` runs phase A then phase B for each (side, scenario) as:

```bash
cd <tree> && nice -n 10 taskset -c 16-31 timeout 300 \
  node --import <tree>/scripts/tsx.mjs harness/recovery-proof.mts \
  --tree <tree> --run runs/<side>-<scenario> --phase A|B --scenario recovery|edit-decide|edit-commit|rename-commit
```

It then replaces `$HOME` and the hostname in the log.

## Reading a log

- `[discord-gateway]` / `[discord-rest]`: the mock's view of the real transport (frames sent, requests served).
- `[startup]`, `[gateway]`: production startup phases, gateway registration and channel-inventory state.
- `[queue] fail(...)`: every pre-claim fail the drain attempted and whether the SQLite write committed. `guard` means the fail carried the commit-time validity guard.
- `[preflight]`: production preflight's own decision lines (`shouldRequireMention=… mentionDecision.shouldSkip=… wasMentioned=…`, `drop: no-mention`), read back from the run's file log.
- `[turn]`: the stand-in turn, reached only when production preflight admitted the message.
- `[sqlite]`: a direct projection of `channel_ingress_events` (status, attempts, failed_reason, last_error).
- `[runtime-error] discord ingress: ingress drain: …`: the drain's own log lines. The Discord ingress monitor routes them through `runtime.error`, so they carry that tag; it is not an error in the run.
- `[result]` / `[verdict]`: computed from that projection, the completion order (`updated_at` of the completing transition) and the turn record.
  - The production handler releases the lane while the debouncer holds a dispatch (`deferredLaneOccupancy: "release"`). Rows can therefore overlap in flight, and completion order approximates claim order but is not identical to it.
