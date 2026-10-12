# PR #121204 real-transport recovery proof

This answers ClawSweeper revision 21's request for "current-source recovery evidence using a real transport client and production preflight, preserving fresh mentions and addressed replies". It uses an isolated mock Discord. This corpus re-runs the same harness, unchanged, at the PR head after a second back-merge onto current upstream main. The previous corpus, at `41277c50d2`, was correct for its head; upstream main moved 35 commits while it was in review and one test-list line then conflicted.

- **Head:** `edcbb5aec765100f0e34f729b952d3dec128a892`, the PR tip after the second back-merge.
- **Control:** `b3c7dc2af7ddb61a71afd169788d846dc37ae2a0`, upstream main and the second back-merge's second parent.
- **Intermediate heads:** not re-run. The `fbef5fda32`, `08d7a0292c` and `cdef5a1d95` runs, which isolate what each of the last three pre-merge commits adds, are in the [`2d997a0bcd` corpus](../2d997a0bcd9b7eb104b1890699cf20f90e45ba17/README.md).

Both trees were checked out in turn in one clean detached worktree, each with `pnpm install --frozen-lockfile` from the same lockfile. [METHOD.md](METHOD.md) lists every stand-in.

## What changed since 2d997a0bcd and 41277c50d2

Nothing in the PR's own production code beyond conflict resolution. The head is three commits on top of `7dfac7ca16` (the back-merge fast-forward of `2d997a0bcd`):
- `ce67be7d4f`, a merge of upstream main `042db1e706`. Conflicts were resolved by adopting upstream's code and keeping the PR's behaviour on top of it:
  - the ingress queue kernel adopts upstream's `CLEARED_CLAIM_COLUMNS` / `executeMutation` and keeps `nextUpdatedAt` and the generation fence;
  - the drain adopts upstream's `laneKeyFor`;
  - the Discord message handler spreads upstream's params and adds `readPolicy`.
- `41277c50d2`, test-only: two core test fixture expectations updated for strictly-forward `updatedAt` (`ingress-drain.watchdog.test.ts`, `ingress-queue.test.ts`). The [`41277c50d2` corpus](../41277c50d231bb848eec5ed56645fc7f08ea70d9/README.md) ran here, with control `b3c7dc2af7`.
- `edcbb5aec7`, a merge of upstream main `b3c7dc2af7` (35 commits). Its only conflict is one line in `test/vitest/vitest.extension-database-workers-paths.mjs`, where upstream added the minimax speech tests at the line this PR adds the stale-backlog test; both stay. Among the PR's files, the 35 upstream commits touch only the two vitest path lists.

Gate receipt at `edcbb5aec7`, on the same host as these runs: install, `tsgo` x4, and 35/35 selected tests passed. `pnpm check` fails three ratchets: line-cap growth, a max-lines suppression, and an assertion without a SAFETY comment. The same three failed on upstream main `042db1e706` in the previous gate, and none names a file the PR touches.

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

All results match the `2d997a0bcd` and `41277c50d2` corpora except fresh-mention wall-clock latency, which is not a contract (see the limit below).

### Recovery

The backlog, all in one mention-gated channel and all older than 15 minutes:
- 20 ambient messages
- an old native `@mention`
- a no-ping **reply to the bot with a canonical nested target**
- a **reply whose nested target arrived without a body**; preflight re-fetches it, and REST returns the bot as its author
- a **raw `<@bot>` with `mentions: []`**; preflight hydrates it over REST

Plus one **fresh `@mention`** delivered live after reconnect.

| | Head `edcbb5aec7` | Control `b3c7dc2af7` |
| --- | --- | --- |
| 20 stale ambient rows | **all `failed`, `stale-ambient-backlog`, `attempts=0`**, failed by the pre-claim pass (`[queue] fail(amb-NN, reason=stale-ambient-backlog, guard) -> committed` x20). None was claimed and none reached preflight. | all claimed, each run through production preflight (`drop: no-mention` x20), then `completed` |
| old `@mention` | completed; preflight `wasMentioned=true`; turn #1 | completed; turn #1 |
| reply to bot, canonical nested target | completed; preflight `effectiveWasMentioned=true` (reply-to-bot); turn #2 | same |
| reply, nested target needs re-fetch | completed; preflight fetched `GET /channels/<gated>/messages/bot-answer-2` (REST returns the bot) and `effectiveWasMentioned=true`; turn #3 | same |
| raw `<@bot>`, `mentions: []` | completed; preflight hydrated it with `GET /channels/<gated>/messages/raw-hydrate`, `wasMentioned=true`; turn #4 | same |
| fresh `@mention` | completion position **5 of 5** rows (by SQLite completion time); turn #5 | completion position **25 of 25** rows; turn #5 |
| production preflight runs | 5 (`mention-gate pass=5 drop:no-mention=0`) | 25 (`mention-gate pass=5 drop:no-mention=20`) |
| final SQLite | `{"failed:stale-ambient-backlog":20,"completed":5}` | `{"completed":25}` |

Logs: [head](logs/head-recovery.log), [control](logs/control-recovery.log).

**Limit on wall-clock time.** Fresh-mention turn latency was 6.5 s at head (`turn 6536ms after the gateway delivered it`) and 6.4 s at control (`6436ms`). In the `41277c50d2` run it was 6.7 s and 6.6 s; in the `2d997a0bcd` run, 4.6 s at head and 6.7 s at control. So in this run head was not faster than control. Against a loopback mock each ambient preflight skip costs only milliseconds, and most of the latency is the drain's first pass after startup, which varies between hosts and runs. Timing is not a contract. What this run shows is the backlog removed from the lane: 5 rows reach claim and preflight at head versus 25 at control (20 claims and 20 preflight runs avoided), and the fresh mention completes 5th instead of 25th. Positions come from SQLite completion timestamps; completion order is not necessarily claim order (METHOD.md). It does not show a latency number for production Discord.

### Scenario C: mention-pattern config edit mid-recovery

The backlog is 3 stale `"helper, can you take a look at the build?"` rows plus 20 ambient rows. `helper-1` heads the lane, so it is decided first. `helper` becomes a mention pattern (`messages.groupChat.mentionPatterns`) through a config edit published during recovery, at one of two moments:
- **edit-decide:** after the stale policy took its policy snapshot, before its verdict.
- **edit-commit:** after the policy returned `fail(helper-1)`, before the queue commits the fail. This is 🌊's interleaving.

| | head `edcbb5aec7` | control `b3c7dc2af7` |
| --- | --- | --- |
| edit-decide: `helper-1` | **completed, turn**. No fail was attempted for it (no `[queue] fail(helper-1…)` line) | completed, preflight-skipped (no pre-claim pass; preflight read the pre-edit config) |
| edit-commit: `helper-1` | **completed, turn**. `fail(helper-1, reason=stale-ambient-backlog, guard) -> not committed`, `pending disposition invalidated before commit for event helper-1` | completed, preflight-skipped (no pre-claim fail exists, so the edit trigger never fired: `edit published=false`) |
| `helper-2`, `helper-3` | completed, turns (both, in both runs) | edit-decide: turns; edit-commit: skipped |
| ambient | 20/20 `stale-ambient-backlog` (20 fails committed) in both runs | 0/20 (all claimed and preflight-skipped) |
| production preflight | edit-decide and edit-commit: `pass=3 drop:no-mention=0` | edit-decide: `pass=2 drop:no-mention=21`; edit-commit: `pass=0 drop:no-mention=23` |
| final SQLite | `{"completed":3,"failed:stale-ambient-backlog":20}` in both runs | `{"completed":23}` in both runs |

Logs: `logs/{head,control}-{edit-decide,edit-commit}.log`.

At head, every now-addressed row reached production preflight under the edited config: `wasMentioned=true`, `inboundEventKind=user_request`.

### Scenario D: channel rename between verdict and fail commit

ClawSweeper revision 22 asked for this case.

- **Setup:**
  - The config has a name-keyed direct-open entry: `guilds[<guild>].channels.concierge.requireMention = false`.
  - 20 stale ambient rows sit in the channel `general`. Because the guild's channel map is name-keyed and `general` is not listed, preflight refuses its messages with `drop: channelConfig.allowed===false`. That is a channel-allowlist drop, not the mention gate used in recovery and C.
- **The injected event:** after the stale policy returns `fail(amb-01)` and before the fail commits, Discord sends `CHANNEL_UPDATE` renaming `general` to `concierge`. The frame travels over the WebSocket and the production `GatewayPlugin` applies it to its inventory before the write is sent.
- **What the new mapping means:** the channel is now direct-open, so every one of those rows is work.

| | head `edcbb5aec7` | control `b3c7dc2af7` |
| --- | --- | --- |
| `amb-01` | **`fail(amb-01, reason=stale-ambient-backlog, guard) -> not committed`**, `pending disposition invalidated before commit for event amb-01`. Re-decided next pass, kept, preflight `shouldRequireMention=false`, turn | no pre-claim fail exists, so the rename trigger never fired (`renamed=false`) |
| `amb-02..20` | completed, 19 turns | preflight drop `channelConfig.allowed===false` x20 (no rename happened) |
| final | `{"completed":20}`, 20 turns, 0 failed | `{"completed":20}` (all preflight-dropped), 0 turns |

Logs: `logs/{head,control}-rename-commit.log`. The `cdef5a1d95` comparison (1 failed, 19 completed) is in the `2d997a0bcd` corpus.

## Run it

```bash
bash harness/proof-rerun.sh
```

`proof-rerun.sh` replaces `run-all.sh` for this rerun. It checks out each tree in turn in one detached worktree (`git checkout --detach -f`, `git clean`, `pnpm install --frozen-lockfile`), runs head then control, and also runs the PR #124337 harness in the same pass. Paths in it are relative to the runner's scratch directory; see METHOD.md.

Prerequisites: a clone of openclaw with both SHAs fetched, and Node 26.

Every process runs under `nice -n 15` and `timeout 300`, with no CPU pinning. There is no network beyond 127.0.0.1. Every run has its own HOME, state, config and log file.

All 16 processes (8 scenario x tree runs, phases A and B) exited 0.

## Files

- `harness/recovery-proof.mts`, sha256 `a1ab2b3a35735328644a5187809a870650c3aeb3b2396683c2ef234c27101f17` (same bytes as the `2d997a0bcd` corpus)
- `harness/mock-discord.mts`, sha256 `f7b374a96076de09d36b239763d7ec4fb9c889d5b93151d80c52688e4f2e866f` (same bytes)
- `harness/proof-rerun.sh`, sha256 `2c20b0c1c53d2b48755d96a59aab16054876fab438897ddbf57c2b7738327b30`
- `logs/<side>-<scenario>.log`: phases A and B, with `$HOME` and the hostname replaced and ANSI colour codes stripped.

Snowflakes are synthetic and relabelled (`<guild>`, `<gated>`, `<bot>`, `<human>`, message names). The token is a placeholder and is redacted from the IDENTIFY line.

**Scope of scenarios C and D.** The edit-commit and rename-commit runs inject the change from the `queue.fail` wrapper, before the fail's transaction opens. They show the guard refusing the commit end to end. They do not separately exercise the guard turning false *between* transaction open and commit; the same-head unit test `ingress-queue.generation.test.ts` (guard true at open, false at commit) covers that narrower boundary.
