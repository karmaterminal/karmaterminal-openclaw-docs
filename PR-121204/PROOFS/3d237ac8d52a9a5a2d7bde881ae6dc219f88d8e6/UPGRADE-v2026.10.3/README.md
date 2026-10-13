# PR #121204 upgrade / data-model compatibility proof: v2026.10.3 → `3d237ac8d5`

This answers ClawSweeper's "Add data-model compatibility proof" item at reviewed head `3d237ac8d52a9a5a2d7bde881ae6dc219f88d8e6`: *show that existing data still loads and works with this change.* Durable ingress rows are written by the latest stable release, then drained by the PR head over the **same state directory**. A copy of that same state is drained by the stable release itself, as the control.

- **Stable (writer and control):** `v2026.10.3` = `59cb44796b0f1f0daa0e37af8b1495abb45d9bc1`, the latest non-beta tag.
- **Head (reader):** `3d237ac8d52a9a5a2d7bde881ae6dc219f88d8e6`, the PR head.
- **Schema:** the `channel_ingress_events` table definition in `src/state/openclaw-state-schema.sql` is byte-identical at both trees. No migration runs; the question is purely whether the head's code reads and settles rows written by stable's code.

## What runs

The same production-transport recovery harness as the parent corpus (`../README.md`): the production Discord client and `GatewayPlugin` over loopback HTTP/WebSocket to the same mock Discord (`mock-discord.mts`, same bytes), the durable SQLite ingress queue, the drain, the pending-disposition pass, the live policy reader and production preflight. The only stand-in on the message path is the agent turn.

Steps, in order, in one detached worktree (each tree checked out and `pnpm install --frozen-lockfile`ed):
1. **stable, phase A** (`v2026.10.3`): the outage backlog (20 stale ambient rows, an old mention, a canonical reply to the bot, a reply whose target needs a re-fetch, a raw `<@bot>` needing hydration) is admitted over the gateway while the drain is wedged. Result: `24/24 rows pending`.
2. **stable, seed** (`upgrade-seed.mts`, stable's own `createChannelIngressQueue`): three of those rows are moved into the other persisted states a stable install leaves behind:
   - `…001`: claimed, then **released with a failure** → `pending`, `attempts=1`, `last_error="stable-era delivery failure"`
   - `…002`: claimed, then **failed** → `failed`, `failed_reason=stable-era-dead-letter`
   - `…003`: claimed, and the process **exits holding the claim** (a dead owner) → `claimed`, `claim_owner` set
3. **dump**: every row, read-only (`upgrade-dump.mts`).
4. The state directory is copied for the control.
5. **head, phase B** (`3d237ac8d5`) on the original: reconnect, drain, and a fresh mention delivered live.
6. **dump**.
7. **stable, phase B** (`v2026.10.3`) on the copy, as the control. **dump**.

## Results

Counts, from `logs/dump-*.log`:

| | rows |
| --- | --- |
| written by stable (steps 1–2) | 24: `pending` 22, `claimed` 1, `failed:stable-era-dead-letter` 1 |
| **after the head drained it** | 25: **`failed:stale-ambient-backlog` 19**, `completed` 5, `failed:stable-era-dead-letter` 1 |
| after stable drained the copy (control) | 25: `completed` 24, `failed:stable-era-dead-letter` 1 |

The three seeded rows, field by field:

| row | as stable wrote it | after the head | after stable (control) |
| --- | --- | --- | --- |
| `…001` released | `pending`, `attempts=1`, `last_error` set, `updated_at` …283171 | **`failed:stale-ambient-backlog`**, `attempts=1` kept, `updated_at` …321861 (**strictly forward**) | `completed`, `attempts=1` |
| `…002` dead-letter | `failed:stable-era-dead-letter`, `updated_at` …283222 | **untouched**: same status, reason, message and `updated_at` | untouched |
| `…003` dead owner | `claimed`, `claim_owner` set | **recovered** (`attempts` 0→1, claim cleared), then `failed:stale-ambient-backlog` | recovered, then `completed` |

The addressed rows are unaffected. At head, all five reached production preflight and completed with a turn: the old mention, both replies to the bot, the raw `<@bot>`, and the fresh mention, which completed **5th of 5** claims. In the control the fresh mention completed **24th of 24**, which is the same before/after effect as the parent corpus, now starting from stable-written data.

So rows a `v2026.10.3` install leaves on disk (pending, released with prior attempts and errors, dead-lettered, and held by a dead owner) load at the head without error. They are classified by the same rules, and the 121204 kernel's strictly-forward `updated_at` advances them from stable's timestamps. Terminal rows are not rewritten, and no lane is left stuck.

## Limits

- One upgrade path: the latest stable to the PR head, with the schema unchanged between them. Older releases are not exercised.
- The rows come from the harness's own synthetic backlog, not a production database.
- A dead owner's claim is recovered by the queue's normal stale-claim path at the head. That recovery is not new in this PR, but the proof shows the head's pending-disposition pass handles the recovered row correctly.

## Files

- `harness/recovery-proof-upgrade.mts`, sha256 `0d6bfb1cbb1f582a39b6134dfa4cb53ab9626305e45968cc002c2b3b1f101a49`. This is the parent corpus's `recovery-proof.mts` plus one compatibility shim, shown in full in `harness/recovery-proof-upgrade.diff`. `v2026.10.3`'s `createDiscordMonitorClient` takes its gateway factories (`createGatewayPlugin`, `createGatewaySupervisor`, `createAutoPresenceController`) as parameters, and later trees build them inside the function, ignoring extra parameters. The shim imports each factory when the tree has its module and passes it. The first run, without the shim, failed closed at stable phase A with `params.createGatewayPlugin is not a function`.
- `harness/upgrade-seed.mts`, sha256 `69d876c4bdb9ac0db0b94039e48e11e3ad7cf7253cac98a03f732def0761cbb7`.
- `harness/upgrade-dump.mts`, sha256 `5c6f821c71ca7b099b9cb686fcc498becdbc197561010c457c29f5509637ea4b`.
- `harness/upgrade-rerun.sh`, sha256 `9891f622d198d46a225747b100722244bacd58af1306fbc59a54722f0c72bb55`. This is the runner. It exits 1 unless every install and step exits 0; this run printed `proofs-done`. The published copy differs from the executed one only in line 5 (`S0=${SCRATCH:?…}`). Replay with `SCRATCH=<dir> bash harness/upgrade-rerun.sh`. `$SCRATCH` holds `openclaw/` (a clone with both trees), `gate25-F/` (the worktree), `proof-121204/harness/mock-discord.mts` and `proof-121204-upgrade-src/` (this `harness/` directory plus `mock-discord.mts`). Outputs go to `proof-121204-upgrade/{runs,logs}`; this `logs/` is a copy.
- `logs/<step>.log`: each starts with `### <step> / tree <sha>` and ends with `### exit=0`. `$HOME` and the hostname are replaced, and ANSI codes are stripped.

Node v26.9.0, Linux aarch64. Run 2026-10-13 by frond-gloss (Claude Opus 5.5).
