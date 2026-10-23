# PR #124337 upgrade / data-model compatibility proof: v2026.10.6 → `cd8a6e26fe`

This answers ClawSweeper's two asks at reviewed head `8da32c408e`: "Add data-model compatibility proof" ("Show that existing data still loads and works with this change") and "latest-stable persisted-queue replay with retry facts preserved."

Durable ingress rows are written by the latest stable release. The PR candidate then replays them from the **same state directory**, in a fresh process, after the normal upgrade step. Two controls drain copies of the same data: stable itself, and clean upstream main (the PR's base).

| Role | Tree |
| --- | --- |
| Writer and control 1 | `v2026.10.6` = `fe06181dc5ecc01cf8904abbfc26925925efefbc` (tag object `3494baecba`). npm `latest` is `2026.10.6`. |
| Reader | candidate `cd8a6e26fecc7a256533c4bcf79219d63f8d7344` = PR head `8da32c408e` plus one test-only removal. Its `dist` (used only for `doctor`) was built at `8da32c408e`; the two differ only in `src/auto-reply/reply/queue/lifecycle.test.ts`. |
| Control 2 | clean upstream main `7ab64536d3eb75e7020a90ebce0b6eafc06502e4`, the PR's merge base |

Run on silas (Linux x86_64), Node v26.12.1, `nice -n 19 taskset -c 16-31`, 2026-10-23 20:27–20:29Z. `logs/identity.txt` records HEAD and a clean worktree at the start and end of every step.

## What runs

Every queue and drain call is the tree's own production code (`src/channels/message/ingress-queue.ts`, `ingress-drain.ts`), imported by path over the durable SQLite `channel_ingress_events` table. The only stand-in is the dispatcher: a scripted function that completes, abandons, or cancels each claim. It settles the turn through the drain's real `onAbandoned` / `onCancelled` lifecycle after returning `deferred`. That is the reply-lane path the PR changes.

All three readers use the same retry policy: `maxAttempts: 3, deadLetterMinAgeMs: 0, baseMs: 1, maxMs: 5`. This is ClawSweeper's example bound, with fast backoff so the run finishes in seconds.

`harness/run.sh` does the following, in order:
1. **stable seed** (`upgrade-124337.mts --mode seed`, then `--mode seed-rest`). Stable's own drain abandons `ev-abandoned-over` six times and `ev-abandoned-under` once. Stable's queue API then writes the remaining states.
2. **dump** of every row (`upgrade-dump.mts`, which reads a copy of db/-wal/-shm in plain read-only mode).
3. The state is copied for control 1.
4. **upgrade step:** the head's own `openclaw doctor --fix --non-interactive` (`doctor-migrate.sh`). The head refuses to open stable's state until this runs ("Client credentials require backed-up migration custody; stop the app and run openclaw doctor --fix"). That is upstream's schema gate (state DB `user_version` 20 → 31), and the PR changes nothing under `src/state`. Doctor saved its pre-migration backup and migrated. **dump**.
5. The migrated state is copied for control 2.
6. **head drain**, fresh process: `recoverStaleClaims`, then 12 drain passes. **dump**.
7. **upstream drain** of the migrated copy, same script. **dump**.
8. **stable drain** of the unmigrated copy, same script. **dump**.

`run.sh` exits 1 unless every step exits 0; it printed `proofs-done`. `schema-compare.mts` ran afterwards on the three final run dirs (`logs/schema-compare.log`).

## Results, per row

From `logs/dump-*.log`. "att" is `attempts`.

| row | as stable wrote it | after doctor migration | **after the PR head** | after upstream 7ab6 (control 2) | after stable (control 1) |
| --- | --- | --- | --- | --- | --- |
| `ev-pending` | pending, att 0 | unchanged | completed, att 0, dispatched **once** | same | same |
| `ev-released` (released twice with `last_error`) | pending, att 2, `stable-era delivery failure` | unchanged | head saw att 2 + `last_error` → completed, att **2 kept** | same | same |
| `ev-abandoned-under` (stable abandoned once) | pending, att 1, `turn-abandoned` | unchanged | abandoned at head → att **2** (counted from stable's 1, not reset; "keeping for retry"), then completed | same | same |
| `ev-abandoned-over` (stable abandoned 6× under a 3-attempt bound) | pending, **att 6**, `turn-abandoned` | unchanged | dispatched **once**, abandoned → **failed `retry-limit-exceeded`**, att 6 and `last_error` kept ("reached retry limit after 7 attempts; dead-lettered") | 12 more abandonments, still **pending at att 18** | 12 more, **pending at att 18** |
| `ev-cancel` (released twice) | pending, att 2 | unchanged | cancelled via `onCancelled` at head → att **stays 2** (no attempt spent), then completed | same | same |
| `ev-dead` (dead-lettered) | failed `stable-era-dead-letter` | unchanged | **untouched**: same status, reason and `updated_at`; never dispatched | same | same |
| `ev-owner` (claim held by a dead owner) | claimed, owner `stable-owner-that-died` | unchanged | `recoverStaleClaims=1`: recovered (att 0→1), then completed | same | same |

Dispatch counts: head `{over:1, under:2, pending:1, released:1, cancel:2, owner:1}`; upstream and stable both `{over:12, under:2, pending:1, released:1, cancel:2, owner:1}`.

**Schema.** The `channel_ingress_events` DDL (table plus index) read from the live databases is identical across stable's unmigrated state, the migrated state after the head and the upstream copy (`logs/schema-compare.log`). The table's source definition in `src/state/openclaw-state-schema.sql` is byte-identical at stable and the candidate. `PRAGMA table_info` lists the same 20 columns in every dump. Doctor's migration did not change any ingress row (`dump-after-migrate` = `dump-stable-written`).

## What this shows

- Rows a v2026.10.6 install leaves load and settle at the head without error after the standard `doctor --fix` upgrade step. That covers pending, released with prior attempts and errors, abandoned, dead-lettered, and held by a dead owner. Their retry facts (`attempts`, `last_error`) are read as written and carried forward, never reset.
- The PR's single behavioural difference from both controls is the intended one. A row stable abandoned past the bound is dead-lettered as `retry-limit-exceeded` on its first post-upgrade abandonment, so its lane is freed. Stable and upstream keep re-dispatching it without limit (att 6 → 18 in 12 passes).
- Cancellation stays budget-free at the head on a stable-written row. Dead-lettered rows are not rewritten.

## Limits

- One upgrade path: latest stable to the candidate. Older releases are not exercised.
- Synthetic rows on one channel id (`telegram`, account `default`), through the shared drain. No channel adapter or transport is involved; ClawSweeper's shipped-Gateway and Telegram Test Server proof is a separate item.
- `deadLetterMinAgeMs: 0` and millisecond backoff are test settings. With the defaults (24 h minimum age, 1 s–3 min backoff) the same dead-letter happens once a row is at least 24 h old.
- Dead-owner recovery is the queue's existing stale-claim path, not new in this PR.
- `doctor --fix` ran with `HOME`, `OPENCLAW_STATE_DIR` and `OPENCLAW_CONFIG_PATH` all inside the run directory. The host's own gateway unit was not touched: its `ActiveEnterTimestamp` (16:23Z) predates the run, `NRestarts=0`, and no systemd user unit file was written.

## Files

- `harness/run.sh`: the runner, with absolute local paths as executed.
- `harness/upgrade-124337.mts`: the seed and drain harness. `harness/upgrade-dump.mts`: the read-only dump.
- `harness/doctor-migrate.sh`: the upgrade step. `harness/schema-compare.mts`: the live DDL and `user_version` read.
- `logs/<step>.log`: each starts `### <step> / tree <sha>` and ends `### exit=0`, with `$HOME` and the hostname replaced. `logs/run.out` is the runner's summary, and `logs/identity.txt` holds the per-step identity records.

frond-gloss (Claude Opus 5.5), 2026-10-23.
