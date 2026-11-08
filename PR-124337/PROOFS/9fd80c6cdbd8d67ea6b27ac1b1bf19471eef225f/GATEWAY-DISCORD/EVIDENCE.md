## Evidence

**Behavior or issue addressed:** an ingress row that defers to the reply queue and is then released without being admitted. Two halves:
- Intentional relinquish (Stop / queue clear, Gateway shutdown) must release the row **without spending retry budget**.
- Genuine abandonment (for example a `queue-cap` rejection) must go through the shared retry disposition, so `maxAttempts` bounds it.

**Before evidence:** shipped Gateway at upstream `main` `93a9fa4562b`, same harness and steps as the after-fix runs (3/3 runs per scenario):
- After `/stop`, the queued row that Stop relinquished has spent one attempt (`attempts=1`).
- After a clean Gateway shutdown, the queued row is `pending attempts=1 last_error=turn-abandoned`. A shutdown is charged as a failed attempt.
- A `queue-cap` rejection releases the row with `attempts+1` and `last_error=turn-abandoned`, and logs no retry-disposition line.

**Real environment tested:** the shipped Gateway (`node scripts/run-node.mjs gateway`) on Linux x86-64 with Node 26.12.1, from a clean worktree at the head and one at the base. Everything else was loopback-only:
- **Channel:** the production Discord plugin, reaching a loopback mock of Discord REST plus WebSocket Gateway through the production `DISCORD_API_URL` override. The mock was adapted from the #121204 proof corpus.
- **Agent:** the bundled Codex 0.162.1 app-server as agent runtime (`agentRuntime.id: "codex"`), pointed at a scripted Responses endpoint.
- **Isolation:** its own state directory, config and ports. No real Discord, model provider, credential or host Gateway was involved.
- **Message flow:** messages enter as `MESSAGE_CREATE` frames and pass through the production listener, ingress monitor, SQLite ingress queue, drain, reply queue and agent turn. Replies leave as REST sends, recorded by the mock with their text.
- **Busy turn:** a `HOLD-1` message keeps one turn busy through repeated `sleep` tool calls, so later messages queue behind it.

Config:
- `messages.queue`: `followup`, `cap: 1`, `drop: old | new`; one run used `collect`, `cap: 2`, `drop: old` in a guild channel.
- `messages.inbound.debounceMs: 0`.
- Discord DM allowlist plus one open guild.
- Discord's production ingress policy: `maxAttempts: 8`, `deadLetterMinAgeMs: 0`.

**Exact steps or command run after this patch:**
- Head: `9fd80c6cdbd`, which is this PR's `cd8a6e26fe` with upstream `main` `93a9fa4562b` merged in. The merge was clean; `tsgo:core`, `tsgo:extensions` and `tsgo:test:src` all exit 0.
- Each run (`scenario.sh <scenario> <side> <n> <tree>`):
  1. starts the mock, the scripted provider and the Gateway;
  2. sends `HOLD-1`;
  3. sends one or more `MSG-*` while the turn is busy;
  4. does the scenario action (below);
  5. snapshots `channel_ingress_events` from a copy of the state database (status, attempts, `last_error`, `failed_reason`).
- Scenario actions:
  - **cancel:** `/stop` while `MSG-A` is queued.
  - **restart:** SIGTERM the Gateway while `MSG-A` is queued, then start it again on the same state.
  - **abandon:** `drop:new` with the one slot held by `MSG-A`, then `MSG-B`. Variants: `drop:old`, and a 12-message guild burst under `collect`.

**Evidence after fix:**

| Scenario (runs) | Head `9fd80c6cdbd` | Base `main` `93a9fa4562b` |
|---|---|---|
| Stop clears the queued `MSG-A` (3 + 3) | `completed attempts=0`, 3/3 | `completed attempts=1`, 3/3 |
| Shutdown with `MSG-A` queued (3 + 3) | `pending attempts=0`, no `last_error`, 3/3 | `pending attempts=1 last_error=turn-abandoned`, 3/3 |
| Restart redelivery of that row (3 + 3) | delivered once, one `ack MSG-A`, `completed attempts=0`, 3/3 | delivered once, one `ack MSG-A`, `completed attempts=1`, 3/3 |
| First `queue-cap` rejection (5 + 3) | `[discord] ingress: spooled update msg#04 failed; keeping for retry: turn-abandoned`, then `attempts=1` | silent release, `attempts=1 last_error=turn-abandoned` |
| Guild burst, `collect` cap 2 (1 + 1) | 5 `keeping for retry: turn-abandoned` lines, all 14 rows `completed`, every message answered | 0 such lines, all 14 rows `completed`, every message answered |

**Observed result after fix:**
- Stop and Gateway shutdown now release the row without spending an attempt, and the restart still redelivers it exactly once.
- A genuine `queue-cap` abandonment is now settled through the retry disposition, bounded by `maxAttempts`.

**What was not tested:**
- **Dead-letter through abandonment.** In every Discord shape above, the redelivered row waits behind the busy turn on its channel. After the first abandonment, each further attempt is therefore settled by the 300 s claim→adoption watchdog (`handler-timeout`), and that path applies the retry policy on head and base alike.
  - A 42-minute run on each side ended identically: `spooled update msg#04 on lane channel:<dm-channel> reached retry limit after 8 attempts; dead-lettered` within 0.3 s of each other, then `MSG-C` was answered.
  - So the base defect (abandonment re-dispatching past `maxAttempts`) was not reached in this harness. The proof shows the disposition change, not a lane that main leaves blocked.
- **Telegram** interactive-submission cancellation: this needs a Telegram Test Server bot token, which this run did not have.
- Other channels (Slack, SMS, LINE, Twitch, Feishu) and native Discord commands.
- A real model and real Discord.

Redacted receipts: `bm124-gate/logs/<scenario>-<side>-<n>/` (`meta.txt`, `rows.txt`, mock and provider JSONL, Gateway logs). They contain synthetic snowflakes only, relabelled, with the home path and host name removed.
