# Method

## What runs

`harness/discord-recovery-proof.mts` imports the **production modules from the tree under test** (`--tree`) and drives them in two processes over one SQLite state dir, with no vitest and no mocks of the modules under test:

```
R1 "outage" (drain not running)
  raw MESSAGE_CREATE frame (APIMessage)
    -> createDiscordIngressMonitor(...).accept   extensions/discord/src/monitor/ingress.ts
         (the function createDiscordMessageHandler wires; inspectDiscordMessage + payload codec)
      -> createChannelIngressMonitor.admit        src/channels/message/ingress-monitor.ts
        -> createChannelIngressQueue              real SQLite durable queue, temp state dir
  monitor.start() is never called; the process exits with 22 rows `pending`.

R2 "recovery" (fresh process, same state dir)
  new GatewayPlugin({ autoInteractions:false })  extensions/discord/src/internal/gateway.ts
    -> registerGateway(accountId, gateway)       extensions/discord/src/monitor/gateway-registry.ts
    -> handleDispatch(READY), handleDispatch(GUILD_CREATE)
         -> DiscordGatewayChannelInventory        extensions/discord/src/internal/gateway-channel-inventory.ts
  createDiscordLivePolicyReader({ cfg, readConfig, accountId, token, discordRestFetch })
                                                 extensions/discord/src/monitor/live-policy.ts
    -> resolveDiscordAllowlistConfig (numeric ids: no REST) -> DiscordLivePolicy
  createDiscordIngressMonitor({ botUserId, readPolicy, queue, client:{}, dispatch })
    -> drain: { resolvePendingDisposition: createDiscordStaleAmbientPendingDisposition({
          botUserId, readPolicy,
          resolveChannelInfo: DEFAULT  -> getGateway(accountId)?.getGatewayChannelInfo(id),
          isChannelInventoryHydrating: DEFAULT -> getGateway(accountId)?.isGatewayChannelInventoryHydrating(g) ?? true }) }
  monitor.accept(fresh @bot mention)             admitted before the first drain pass
  monitor.start()
    -> createChannelIngressDrain pump              src/channels/message/ingress-drain.ts
      -> applyIngressPendingDispositions           src/channels/message/ingress-drain-pending-disposition.ts
           (fails stale ambient rows with generation fence { updatedAt })
      -> claim per lane -> deliver -> mapGatewayDispatchData -> params.dispatch(event, lifecycle)
           -> lifecycle.onAdopted() -> drain completes (tombstones) the SQLite row
```

On the control tree the same harness runs unchanged. `createDiscordIngressMonitor` at `23bc4d7bfe` has no `botUserId` / `readPolicy` params (they are ignored), `GatewayPlugin` has no inventory methods (the log prints `undefined`), and the drain has no pre-claim pass.

## What is not production (every stub)

1. **Discord WebSocket**: none. `GatewayPlugin.client` is set to `{ dispatchGatewayEvent: async () => {}, getPlugin: () => undefined }` and `handleDispatch` (the method the socket `message` handler calls) is invoked directly with synthetic READY (`{ session_id, guilds:[{ id, unavailable:true }] }`) and GUILD_CREATE (`{ id, voice_states:[], channels:[2 GuildText], threads:[] }`) payloads. This is the same injection the PR's own boundary test uses.
2. **Discord REST**: none. `discordRestFetch` is `async () => { throw }` and counts calls; both runs log `restFetchCalls=0` because guild/channel ids are numeric and the allowlist resolver needs no lookup. The token is a literal placeholder string passed as `token`.
3. **Dispatcher**: stubbed at the seam `createDiscordMessageHandler` passes to the monitor (`dispatcher(event, client, { abortSignal, turnAdoptionLifecycle })`). The stub records `{ seq, id, lane }` and calls `lifecycle.onAdopted()`. No preflight, no agent turn, no model, no reply.
4. **Client** passed to `createDiscordIngressMonitor` is `{}`; `mapGatewayDispatchData` only reads the raw frame for these fixtures.
5. **Queue** is `createChannelIngressQueue({ channelId:"discord", accountId:"default", stateDir, now })` from `src/channels/message/ingress-queue.ts`, the same factory `state.openChannelIngressQueue` reaches in production, pointed at a temp state dir.
6. **Config** is a literal `OpenClawConfig` fragment: `channels.discord.guilds[<guild>].channels[<open>].requireMention = false`; the gated channel has no entry (default `true`). `readConfig: () => cfg` keeps the reader off the runtime config snapshot.
7. **Timestamps**: backlog frames carry Discord `timestamp`s T-60..T-22 min (ambient), T-41 (old mention), T-31 (open request) and are admitted at wall-clock T; the fresh mention carries T-0. No fake clock: `now` is `Date.now` everywhere.

Everything else on the path (frame inspection, payload codec, SQLite queue, drain, pre-claim disposition pass, stale policy, mention-document projection, allowlist/guild-entry resolution, `resolveDiscordShouldRequireMention`, gateway inventory, gateway registry, live-policy reader) is production code loaded from the tree under test.

## Environment

- Node `v26.9.0` (nvm, `~/.local/bin`), Linux x86-64, `nice -n 10`, each process under `timeout 300`, no network.
- Head: `<scratch>/rp-121204`, branch `gloss/121204-repaint-r2` @ `99c99a06d0e8c26ac0ef6150f1fdfd65eff75392`, `git status` clean before and after.
- Control: `<scratch>/ctl-121204`, detached worktree of `<scratch>/oc1418` @ `23bc4d7bfe8626594f4d986814ea15855097cb6b`, clean. Dependencies hard-linked (`cp -al`) from the head tree for every `node_modules` dir after confirming both trees' `pnpm-lock.yaml` blob is `f2a63c09bcd9bac50eb084959163f545930bdf90`. Removed after the logs were saved.
- Module resolution: `node --import <tree>/scripts/tsx.mjs`; `openclaw/plugin-sdk/*` specifiers inside `extensions/discord` map to `<tree>/src/plugin-sdk/*.ts` through the tree's `tsconfig.json` paths, so the extension exercised the same tree's core.

## Commands

The same commands run for each `<tree>` (head, then control), each side with its own fresh state dir; R2 reuses R1's:

```bash
H=harness/discord-recovery-proof.mts
st=<scratch>/proof-121204/runs/<side>-R/state
nice -n 10 timeout 300 node --import <tree>/scripts/tsx.mjs "$H" --tree <tree> --state "$st" --phase R1 > <side>-R1.raw.log 2>&1
nice -n 10 timeout 300 node --import <tree>/scripts/tsx.mjs "$H" --tree <tree> --state "$st" --phase R2 > <side>-R2.raw.log 2>&1
```

Every run exited 0. `logs/<side>-R.log` is the two raw logs concatenated with phase banners, `<scratch>` / `<home>` substituted for local paths. Module load accounts for the first 5-9 s of each log; the drain itself runs about 3.4 s on each side.

## Reading a log

- `[env]`: tree path, HEAD sha, dirty count, and whether `ingress-stale-policy.ts` / `ingress-drain-pending-disposition.ts` exist in the tree (feature detection for labelling only; nothing branches on it).
- `[ingress] accept(<id>) lane=... sentAt=T-<n>min`: a frame admitted through the production monitor.
- `[sqlite] {<id> lane=... status=... attempts=... failed_reason=... last_error=...}`: a direct projection of the durable ingress row (`channel_ingress_events`), ordered by `received_at, rowid`.
- `[gateway]`: `GatewayPlugin` method presence, `isConnected`, `hydrating(guild)` before/after GUILD_CREATE, and the inventory entries the default resolver will read.
- `[policy]`: the live policy's `guildEntries` and the production `resolveDiscordShouldRequireMention` answer for both channels.
- `[dispatch] #n <id> reached the dispatcher seam on <lane>` / `adopted -> ingress claim completed`: the stub at the dispatcher seam.
- `[queue] pending=.. claims=.. failed=.. dispatched=..`: queue state sampled every 100 ms, printed on change.
- `[result]` / `[verdict]`: computed from the final SQLite projection and the dispatch record.
