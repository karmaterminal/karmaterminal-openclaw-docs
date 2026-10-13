# PR #121204 real-transport recovery proof

This answers ClawSweeper revision 21's request for "current-source recovery evidence using a real transport client and production preflight, preserving fresh mentions and addressed replies". It uses an isolated mock Discord. This corpus re-runs the same harness, unchanged, at the safe-branch candidate that carries the repairs for ClawSweeper's review of `a8eafa8d71`. Those repairs change the stale policy's production code (see below), so the [`edcbb5aec7` corpus](../edcbb5aec765100f0e34f729b952d3dec128a892/README.md) does not stand for it.

- **Head:** `3d237ac8d52a9a5a2d7bde881ae6dc219f88d8e6`, the tip of the safe branch `gloss/121204-backmerge-20261011`: the second back-merge `edcbb5aec7` plus ten commits. When this corpus was made, upstream #121204 pointed at `f9ffb032bc` (the eighth of the ten); it is fast-forwarded to `3d237ac8d5` only after this corpus and the code are reviewed.
- **Control:** `b3c7dc2af7ddb61a71afd169788d846dc37ae2a0`, upstream main and the second back-merge's second parent.
- **Intermediate heads:** not re-run. The `fbef5fda32`, `08d7a0292c` and `cdef5a1d95` runs, which isolate what each of the last three pre-merge commits adds, are in the [`2d997a0bcd` corpus](../2d997a0bcd9b7eb104b1890699cf20f90e45ba17/README.md).

Both trees were checked out in turn in one clean detached worktree, each with `pnpm install --frozen-lockfile` from the same lockfile. [METHOD.md](METHOD.md) lists every stand-in.

## What changed since edcbb5aec7

Ten commits, all in the Discord stale policy, the codec's stored-frame boundary, their tests and one ratchet baseline:
- `a8eafa8d71`: the stored frame reaches the `Message` constructor through a type predicate instead of the chained `as unknown as APIMessage` cast that `lint:no-chained-type-assertions` rejected.
- `6f029b3c58`, for ClawSweeper's two findings on `a8eafa8d71`:
  - **[P1]** An ordinary channel no longer inherits its category's channel entry. Preflight passes a parent only for threads, so a direct-open wildcard outranks a gated category; the policy now resolves the channel config the same way. The real-preflight parity matrix gains that row.
  - **[P2]** The predicate validates every field `APIMessage` requires, the element shapes of `author`, `mentions`, `mention_roles`, `attachments` and `embeds`, and the nested reply target. Anything less stays with the claim-time codec.
- `f908ece873`, test-only: ClawSweeper's incomplete-frame examples stay claimable, and the same frame complete is stale backlog.
- `a05aa8f596`, oxfmt import order in one test.
- `2b52673944` (🕯's review): the predicate also validates the message reference, whose `channel_id` `APIMessageReference` requires; `{}` and a reference without `channel_id` are negative controls.
- `1a33c93726` and `2701bb9be0` (🌊's review): the predicate's type claims only the fields the policy reads (`StalePolicyFrame`), and the one `APIMessage` assertion moves to `ingress-stored-message.ts` as `asStoredDiscordMessage`, which the claim-time codec's decode and the stale policy both call. Preflight and the policy read the same stored object through it. No behaviour change.
- `f9ffb032bc`, oxfmt import order.
- `1699740f30` (ClawSweeper's ratchet finding at `f9ffb032bc`, traced by 🕯): the `// SAFETY:` line sits directly above the shared assertion, so `check:assertion-safety` counts it as documented.
- `3d237ac8d5`: `config/assertion-safety-baseline.txt` shrinks `extensions/discord/src/monitor/ingress.ts` from 6 to 5, since the codec's inline cast moved into the shared helper.

The harness frames are full gateway MESSAGE_CREATE objects (users with `discriminator`, `global_name` and `avatar`; `tts`, `pinned`, `edited_timestamp`), so the stricter predicate reads them, and every scenario still exercises the pre-claim policy. No scenario uses a category entry.

Gate receipt at `3d237ac8d5`, on the same host as these runs: install, `tsgo:extensions` and `tsgo:extensions:test`, `lint:no-chained-type-assertions`, `lint:no-widen-then-assert`, `check:import-cycles` and `check:assertion-safety` (0 findings), oxfmt and oxlint on the changed files, `ingress.test.ts` (the codec) and the five stale-policy suites passed. Revert checks: reverting only the P1 line (at `6f029b3c58`) turns the new parity row and the category case red; restoring the `a8eafa8d71` predicate (at `f908ece873`) turns the incomplete-frame test red; restoring the `a05aa8f596` predicate (at `3d237ac8d5`) turns the message-reference controls red.

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

All results match the `edcbb5aec7`, `41277c50d2` and `2d997a0bcd` corpora except fresh-mention wall-clock latency, which is not a contract (see the limit below).

### Recovery

The backlog, all in one mention-gated channel and all older than 15 minutes:
- 20 ambient messages
- an old native `@mention`
- a no-ping **reply to the bot with a canonical nested target**
- a **reply whose nested target arrived without a body**; preflight re-fetches it, and REST returns the bot as its author
- a **raw `<@bot>` with `mentions: []`**; preflight hydrates it over REST

Plus one **fresh `@mention`** delivered live after reconnect.

| | Head `3d237ac8d5` | Control `b3c7dc2af7` |
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

**Limit on wall-clock time.** Fresh-mention turn latency was 6.3 s at head (`turn 6253ms after the gateway delivered it`) and 6.3 s at control (`6312ms`). In the `f9ffb032bc` run it was 6.1 s and 6.7 s; in the `a05aa8f596` run (docs#584's first corpus) it was 6.5 s and 7.3 s; in the `edcbb5aec7` run it was 6.5 s and 6.4 s; in the `41277c50d2` run, 6.7 s and 6.6 s; in the `2d997a0bcd` run, 4.6 s at head and 6.7 s at control. Run-to-run variation is larger than the head/control gap. Against a loopback mock each ambient preflight skip costs only milliseconds, and most of the latency is the drain's first pass after startup, which varies between hosts and runs. Timing is not a contract. What this run shows is the backlog removed from the lane: 5 rows reach claim and preflight at head versus 25 at control (20 claims and 20 preflight runs avoided), and the fresh mention completes 5th instead of 25th. Positions come from SQLite completion timestamps; completion order is not necessarily claim order (METHOD.md). It does not show a latency number for production Discord.

### Scenario C: mention-pattern config edit mid-recovery

The backlog is 3 stale `"helper, can you take a look at the build?"` rows plus 20 ambient rows. `helper-1` heads the lane, so it is decided first. `helper` becomes a mention pattern (`messages.groupChat.mentionPatterns`) through a config edit published during recovery, at one of two moments:
- **edit-decide:** after the stale policy took its policy snapshot, before its verdict.
- **edit-commit:** after the policy returned `fail(helper-1)`, before the queue commits the fail. This is 🌊's interleaving.

| | head `3d237ac8d5` | control `b3c7dc2af7` |
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

| | head `3d237ac8d5` | control `b3c7dc2af7` |
| --- | --- | --- |
| `amb-01` | **`fail(amb-01, reason=stale-ambient-backlog, guard) -> not committed`**, `pending disposition invalidated before commit for event amb-01`. Re-decided next pass, kept, preflight `shouldRequireMention=false`, turn | no pre-claim fail exists, so the rename trigger never fired (`renamed=false`) |
| `amb-02..20` | completed, 19 turns | preflight drop `channelConfig.allowed===false` x20 (no rename happened) |
| final | `{"completed":20}`, 20 turns, 0 failed | `{"completed":20}` (all preflight-dropped), 0 turns |

Logs: `logs/{head,control}-rename-commit.log`. The `cdef5a1d95` comparison (1 failed, 19 completed) is in the `2d997a0bcd` corpus.

## Run it

```bash
SCRATCH=<dir> bash harness/proof-rerun.sh
```

`proof-rerun.sh` replaces `run-all.sh` for this rerun and runs only this PR's harness. It checks out each tree in turn in one detached worktree (`git checkout --detach -f`, `git clean`, `pnpm install --frozen-lockfile`), runs head then control, and exits 1 (printing `proofs-FAILED`) unless every install and every phase exits 0. `SCRATCH` names the directory holding the openclaw clone (`openclaw/`), the worktree (`gate25-F/`) and the harness (`proof-121204/harness/`); see METHOD.md.

Layout under `$SCRATCH`, as the executed run used it:
- **inputs:** `openclaw/` (a clone with both SHAs fetched), `gate25-F/` (one worktree of that clone, where each tree is checked out and installed) and `proof-121204/harness/` (holding this corpus's `recovery-proof.mts` and `mock-discord.mts`; the runner reads `H1` from there);
- **outputs:** `proof-121204g/runs/<side>-<scenario>/` (per-run HOME and state) and `proof-121204g/logs/<side>-<scenario>.log`. This corpus's `logs/` is a copy of that `logs/` directory. A replay writes to the same `proof-121204g/` paths, so start it with no `proof-121204g/` present, or move the old one aside.

The published script is the executed script with line 5 (`S0=…`) changed to read `SCRATCH`; `diff` of the two shows that line only.

Prerequisites: a clone of openclaw with both SHAs fetched, and Node 26.

Every process runs under `nice -n 15` and `timeout 300`, with no CPU pinning. There is no network beyond 127.0.0.1. Every run has its own HOME, state, config and log file.

All 16 processes (8 scenario x tree runs, phases A and B) exited 0.

## Files

- `harness/recovery-proof.mts`, sha256 `a1ab2b3a35735328644a5187809a870650c3aeb3b2396683c2ef234c27101f17` (same bytes as the `2d997a0bcd` corpus)
- `harness/mock-discord.mts`, sha256 `f7b374a96076de09d36b239763d7ec4fb9c889d5b93151d80c52688e4f2e866f` (same bytes)
- `harness/proof-rerun.sh`, sha256 `49e18f781e35879b3cebaf9d6d79ae4c5c5e60d0e597577e656547ef9c31a26c`
- `logs/<side>-<scenario>.log`: phases A and B, with `$HOME` and the hostname replaced and ANSI colour codes stripped.

Snowflakes are synthetic and relabelled (`<guild>`, `<gated>`, `<bot>`, `<human>`, message names). The token is a placeholder and is redacted from the IDENTIFY line.

**Scope of scenarios C and D.** The edit-commit and rename-commit runs inject the change from the `queue.fail` wrapper, before the fail's transaction opens. They show the guard refusing the commit end to end. They do not separately exercise the guard turning false *between* transaction open and commit; the same-head unit test `ingress-queue.generation.test.ts` (guard true at open, false at commit) covers that narrower boundary.
