# PR #121204 real-transport recovery proof

This answers ClawSweeper revision 21's request for "current-source recovery evidence using a real transport client and production preflight, preserving fresh mentions and addressed replies". It uses an isolated mock Discord.

- **Head:** `2d997a0bcd9b7eb104b1890699cf20f90e45ba17`, the PR tip.
- **Control:** `ca43d19197888f3d42237b4425f08a473779266f`, upstream main and the series' merge base.
- **Intermediate heads:** C also runs at `fbef5fda32` and `08d7a0292c`, and D at `cdef5a1d95`, to isolate what each of the last three commits adds.

All five are clean detached worktrees on one lockfile. [METHOD.md](METHOD.md) lists every stand-in.

## What runs

The production Discord monitor composition (client, `GatewayPlugin`, listeners, message handler, durable SQLite ingress queue, drain, pending-disposition pass, live policy reader, gateway registry, debouncer, **production `preflightDiscordMessage`**, message run queue) runs against a local mock Discord:
- The production REST client and Gateway plugin reach it over real loopback HTTP and a real WebSocket, through the production `DISCORD_API_URL` endpoint override.
- The protocol covers HELLO, IDENTIFY, READY, GUILD_CREATE, heartbeats and MESSAGE_CREATE dispatch.
- REST answers the gateway metadata, bot identity, channel and guild requests, plus preflight's message hydration and reply-target re-fetch.

The only stand-in on the message path is the agent turn after preflight. It is the production `testing.processDiscordMessage` hook, and it adopts through the turn lifecycle.

Each scenario runs in two processes over one state dir:
- **A (outage):** the backlog arrives over the gateway and is admitted durably while the drain is wedged.
- **B (recovery):** a fresh process reconnects and drains.

## Results

### Scenario A at head vs Scenario B (control): recovery

The backlog, all in one mention-gated channel and all older than 15 minutes:
- 20 ambient messages
- an old native `@mention`
- a no-ping **reply to the bot with a canonical nested target**
- a **reply whose nested target arrived without a body**; preflight re-fetches it, and REST returns the bot as its author
- a **raw `<@bot>` with `mentions: []`**; preflight hydrates it over REST

Plus one **fresh `@mention`** delivered live after reconnect.

| | Head `2d997a0bcd` | Control `ca43d19197` |
| --- | --- | --- |
| 20 stale ambient rows | **all `failed`, `stale-ambient-backlog`, `attempts=0`**, failed by the pre-claim pass (`[queue] fail(amb-NN, guard) -> committed`). None was claimed and none reached preflight. | all claimed, each run through production preflight (`drop: no-mention` x20), then `completed` |
| old `@mention` | completed; preflight `wasMentioned=true`; turn #1 | completed; turn #1 |
| reply to bot, canonical nested target | completed; preflight `effectiveWasMentioned=true` (reply-to-bot); turn #2 | same |
| reply, nested target needs re-fetch | completed; preflight fetched `GET /channels/<gated>/messages/bot-answer-2` (REST returns the bot) and `effectiveWasMentioned=true`; turn #3 | same |
| raw `<@bot>`, `mentions: []` | completed; preflight hydrated it with `GET /channels/<gated>/messages/raw-hydrate`, `wasMentioned=true`; turn #4 | same |
| fresh `@mention` | completion position **5 of 5** rows (by SQLite completion time); turn #5 | completion position **25 of 25** rows; turn #5 |
| production preflight runs | 5 (all mention-gate passes) | 25 (5 passes + 20 `drop: no-mention`) |
| final SQLite | `{"failed:stale-ambient-backlog":20,"completed":5}` | `{"completed":25}` |

Logs: [head](logs/head-recovery.log), [control](logs/control-recovery.log).

**Limit on wall-clock time.** Fresh-mention turn latency was 4.6 s (head) and 6.7 s (control) after its frame in this run (4.6 s and 4.7 s in the earlier run at `cdef5a1d95`); timing is not a contract. Against a loopback mock, each ambient preflight skip costs only milliseconds, and most of the 4.6 s is the drain's first pass after startup. So this run shows the backlog removed from the lane: 5 rows reach claim and preflight at head versus 25 at control (20 claims and 20 preflight runs avoided), and the fresh mention completes 5th instead of 25th. Positions come from SQLite completion timestamps; completion order is not necessarily claim order (METHOD.md). It does not show a latency number for production Discord.

### Scenario C: mention-pattern config edit mid-recovery

The backlog is 3 stale `"helper, can you take a look at the build?"` rows plus 20 ambient rows. `helper-1` heads the lane, so it is decided first. `helper` becomes a mention pattern (`messages.groupChat.mentionPatterns`) through a config edit published during recovery, at one of two moments:
- **edit-decide:** after the stale policy took its policy snapshot, before its verdict.
- **edit-commit:** after the policy returned `fail(helper-1)`, before the queue commits the fail. This is 🌊's interleaving.

| | head `2d997a0bcd` | `08d7a0292c` | `fbef5fda32` | control `ca43d19197` |
| --- | --- | --- | --- | --- |
| edit-decide: `helper-1` | **completed, turn** (verdict discarded: `isConfigCurrent()` false) | completed, turn | **failed `stale-ambient-backlog`** (the bug 08d7 fixes) | completed, preflight-skipped (no pre-claim pass; preflight read the pre-edit config) |
| edit-commit: `helper-1` | **completed, turn**. `fail(helper-1, guard) -> not committed`, `pending disposition invalidated before commit` | **failed `stale-ambient-backlog`** (the bug `cdef5a1d95` fixes: `fail(helper-1) -> committed`) | failed `stale-ambient-backlog` | completed, preflight-skipped (no pre-claim fail exists, so the edit trigger never fired) |
| `helper-2`, `helper-3` | completed, turns (both) | completed, turns | completed, turns | edit-decide: turns; edit-commit: skipped |
| ambient | 20/20 `stale-ambient-backlog` | 20/20 | 20/20 | 0/20 (all claimed and preflight-skipped) |

Logs: `logs/{head,prefix-08d7,prefix-fbef,control}-{edit-decide,edit-commit}.log`.

At head, every now-addressed row reached production preflight under the edited config: `wasMentioned=true`, `inboundEventKind=user_request`.

### Scenario D: channel rename between verdict and fail commit

ClawSweeper revision 22 asked for this case.

- **Setup:**
  - The config has a name-keyed direct-open entry: `guilds[<guild>].channels.concierge.requireMention = false`.
  - 20 stale ambient rows sit in the gated channel `general`.
- **The injected event:** after the stale policy returns `fail(amb-01)` and before the fail commits, Discord sends `CHANNEL_UPDATE` renaming `general` to `concierge`. The frame travels over the WebSocket and the production `GatewayPlugin` applies it to its inventory before the write is sent.
- **What the new mapping means:** the channel is now direct-open, so every one of those rows is work.

| | head `2d997a0bcd` | `cdef5a1d95` (before the channel-facts fence) | control `ca43d19197` |
| --- | --- | --- | --- |
| `amb-01` | **`fail(amb-01, guard) -> not committed`**, `pending disposition invalidated before commit`. Re-decided next pass, kept, preflight `shouldRequireMention=false`, turn | **`fail(amb-01, guard) -> committed`**: failed `stale-ambient-backlog` although the new mapping accepts it | no pre-claim fail exists, so the rename trigger never fired |
| `amb-02..20` | completed, 19 turns | completed, 19 turns (decided after the rename) | preflight-skipped as gated (no rename happened) |
| final | 20 completed, 20 turns, 0 failed | 1 failed, 19 completed | 20 completed, 0 turns |

Logs: `logs/{head,prefix-cdef,control}-rename-commit.log`.

## Run it

```bash
bash harness/run-all.sh
```

Prerequisites:
- `head/`, `control/`, `prefix-fbef/`, `prefix-08d7/` and `prefix-cdef/` are detached worktrees at the SHAs above, each with `pnpm install --frozen-lockfile`.
- Node 26.

Every process runs niced, pinned to cores 16-31 and under `timeout 300`. There is no network beyond 127.0.0.1. Every run has its own HOME, state, config and log file.

All 26 processes (13 scenario x tree runs, phases A and B) exited 0. Every scenario was re-run at the new head `2d997a0bcd`; recovery and C give the same results as at `cdef5a1d95`.

## Files

- `harness/recovery-proof.mts`, sha256 `a1ab2b3a35735328644a5187809a870650c3aeb3b2396683c2ef234c27101f17`
- `harness/mock-discord.mts`, sha256 `f7b374a96076de09d36b239763d7ec4fb9c889d5b93151d80c52688e4f2e866f`
- `harness/run-all.sh`, sha256 `15f89d1f4e33329cd9c1af50b882f4e1581771847a3b7cd914d4af900219c86d`
- `logs/<side>-<scenario>.log`: phases A and B, with `$HOME` and the hostname replaced.

Snowflakes are synthetic and relabelled (`<guild>`, `<gated>`, `<bot>`, `<human>`, message names). The token is a placeholder and is redacted from the IDENTIFY line.

**Scope of scenarios C and D.** The edit-commit and rename-commit runs inject the change from the `queue.fail` wrapper, before the fail's transaction opens. They show the guard refusing the commit end to end. They do not separately exercise the guard turning false *between* transaction open and commit; the same-head unit test `ingress-queue.generation.test.ts` (guard true at open, false at commit) covers that narrower boundary.
