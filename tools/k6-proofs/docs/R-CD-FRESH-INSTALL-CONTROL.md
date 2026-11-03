# R-CD-FRESH-INSTALL: disposable fresh-install control

🌊's ruling (room msg 1567073096706297887, 2026-11-03 07:09Z):

> make fresh install its own j12 corpus row: empty state dir, disposable process, no model turn. Keep it separate from the stopped-seat restore receipt; they prove different paths. Don't call either row satisfied until its actual artifact exists.

ClawSweeper's P1 on openclaw/openclaw#129388 (comment 5442236054) names the gap: "the new
authority storage, migration paths, and public SDK exports lack … complete fresh-install/upgrade
evidence". j12's stopped-seat restore receipt proves upgrade and recovery. Nothing proved that a
**fresh** install of the candidate creates the continuation storage correctly and serves. The map
of what each row covers is on karmaterminal/karmaterminal-openclaw-docs#536 (comment 6597622114).

This document is the operator's guide to the control,
`tools/k6-proofs/scripts/run-fresh-install-control.mjs`. The product path it exercises, with
`path:line` anchors at j12 (karmaterminal/openclaw `352f56029dc95c60149ab4aaa127226a861d0b3d`),
is summarised in [The product path at j12](#the-product-path-at-j12) and written out in the header
of `tools/k6-proofs/scenarios/r-cd-fresh-install.js`, whose k6 entry fails closed.

The control starts and stops one real gateway process it set up for the run, never the live one,
so it is not a process-local fixture. The row manifest names it under `invocation.control` with
`invocation.artifactClass: "disposable-real-process"`, as the restart control's is. The
verdict-cap rule (`tools/k6-proofs/lib/row-verdict-cap.mjs`, the ruling on docs#616) therefore does
not cap it at `PARTIAL-candidate`.

**The row stays MISSING until a run at j12 lands and is reviewed.** Nothing in this harness change
is that artifact: the tests here run a scripted gateway, never the product.

## What it proves

On one disposable gateway started from an empty state directory, with no model sign-in and no
model turn:

- **The fresh install serves.** The run's process owns the listening socket, `/readyz` and
  `/startupz` pass, and hello-ok answers with the staged build's `buildId`.
- **The agent database is created at the current schema, not migrated up.** Its
  `PRAGMA user_version` is `OPENCLAW_AGENT_SCHEMA_VERSION` (40 at j12), and its `schema_meta`
  primary row says schema 40 with `created_at` equal to `updated_at`: one insert by canonical
  creation, never a later migration bump.
- **No migration journal entry shows an upgrade path.** See [No upgrade path](#no-upgrade-path).
- **The continuation storage exists with the byte-walked shape.** `session_recipient_authority`
  is present and its column projection hashes to
  `6ede42f5f5ea65007530f5f59da660e22bcab9d932ba3fae6639b848aee8eb7b`.
- **It writes exactly one epoch row.** `sessions.create`, then `session.visibility.set` to
  `suggest`, leaves exactly one authority row, bound to the created session key: zero before
  `sessions.create`, one after the narrowing. The control reads it read-only from outside the
  gateway and publishes only its SHA-256.
- **The fresh config validates.** `openclaw config validate --json` exits 0 with `valid: true`
  for the config the gateway ran with.
- **It stops cleanly and leaves nothing.** SIGTERM stops it with exit 0, no SIGKILL, no missed
  shutdown deadline and no process left behind; the disposable state, the gateway HOME and the
  config are removed, and the cleanup record is signed.

## What it does not prove

- **No upgrade path.** A fresh install never migrates: the row proves the opposite. Upgrade and
  recovery belong to j12's stopped-seat restore receipt. The two rows prove different paths, and
  neither is folded as the other.
- **No model turn.** `sessions.create` carries no message and no title source, so nothing is
  dispatched to a model, and no model is signed in.
- **No delegate delivery.** No delegate is spawned and no return is delivered; the epoch row is
  established without one, as the restart control's is.
- No continuation behaviour beyond its storage and config: the continuation tools never run.
- No live seat: the gateway is disposable and the state is removed.

## The product path at j12

Byte-read with `git show 352f56029dc95c60149ab4aaa127226a861d0b3d:<path>`.

| What | Where (j12) |
| --- | --- |
| `OPENCLAW_STATE_DIR` as the state root; the default `~/.openclaw`, `~/.openclaw-<profile>`, legacy `~/.clawdbot` | `src/config/state-dir.ts:23-43`, `:10-12`; `src/cli/profile-utils.ts:26-37` |
| State database `<state>/state/openclaw.sqlite`, schema 36 | `src/state/openclaw-state-db.paths.ts:41`; `src/state/openclaw-schema-versions.ts:47` |
| Agent database `<state>/agents/<id>/agent/openclaw-agent.sqlite` | `src/state/openclaw-agent-db.paths.ts:22-35` |
| The gateway starts only with `gateway.mode=local` | `src/cli/gateway-cli/pre-bootstrap.ts:54-81` |
| `OPENCLAW_AGENT_SCHEMA_VERSION = 40` (the continuation's recipient-authority step) | `src/state/openclaw-schema-versions.ts:3-4, 13`; `src/state/openclaw-agent-recipient-authority-schema.ts:11-12` |
| An empty file is no schema migration | `src/state/openclaw-agent-db-schema.ts:317-319` (integrity: `:232-239`) |
| Canonical creation: whole schema, `user_version = 40`, `schema_meta`, one transaction | `src/state/openclaw-agent-db-schema.ts:352-358` |
| `schema_meta` inserted with `created_at = updated_at`, updated only on change | `src/state/openclaw-agent-db-metadata-write.ts:9-43`; `src/state/openclaw-agent-schema.sql:6-14` |
| `session_recipient_authority` | `src/state/openclaw-agent-schema.sql:142-147` (comment `:140-141`) |
| `sessions.create` with no message runs no turn; a title only with a title source | `src/gateway/server-methods/sessions-create.ts:254-263, 616-618`; `src/gateway/server-methods/chat-send-background.ts:36-38` |
| `session.visibility.set`; `suggest` allowed by default | `src/gateway/server-methods/sessions-sharing.ts:527-585`; `src/gateway/methods/core-descriptors.ts:467`; `src/gateway/session-sharing-policy.ts:85-93` |
| A narrowing advances the authority in the same transaction | `src/config/sessions/session-recipient-authority-types.ts:94-99`; `src/config/sessions/session-accessor.sqlite-entry-mutation.ts:119-136`; `src/config/sessions/session-accessor.sqlite-recipient-authority.ts:17-37` |
| Continuation config defaults | `src/auto-reply/continuation/config.ts:15-26, 90-137`; schema `src/config/zod-schema.agent-defaults-base.ts:270-322` |
| Migration journal, backup runs, agent registry | `src/state/openclaw-state-schema.sql:1850-1881, 1883-1889, 1182-1189`; writer `src/infra/state-migrations.receipts.ts:93-151` |
| The fresh boot's own journal row | `src/infra/device-pairing-node-desktop-migration.ts:27, 92-127`, run by `src/gateway/server-startup-bootstrap.ts:496-505` |
| `/readyz`, `/startupz`, hello-ok `buildId`/`bootId` | `src/gateway/server-http-probes.ts:12-24, 83-94`; `src/gateway/server/readiness.ts:29-33`; `src/gateway/server/ws-connection/connect-hello.ts:174-180`; `src/version.ts:83-95` |
| `openclaw config validate --json` | `src/cli/config-cli.ts:484-565` |
| SIGTERM stop; the shutdown-deadline force exit (code 0 when the budget allows) | `src/cli/gateway-cli/run-loop-signals.ts:175-210, 344`; `src/cli/gateway-cli/run-loop.ts:1010-1012, 622-634` |
| Provider credentials | `src/secrets/provider-env-vars.ts:32-44`; `setup.providers[].envVars` in `extensions/*/openclaw.plugin.json` |

`session_recipient_authority` at `src/state/openclaw-agent-schema.sql:142-147`, verbatim:

```sql
CREATE TABLE IF NOT EXISTS session_recipient_authority (
  session_key TEXT NOT NULL PRIMARY KEY,
  epoch TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;
```

`src/state/openclaw-schema-versions.ts:13`: `export const OPENCLAW_AGENT_SCHEMA_VERSION = 40;`

The column hash is the SHA-256 of the canonical JSON of what SQLite reports for that table:
`PRAGMA table_xinfo` (cid, name, declared type, notnull, default, pk, hidden) with `PRAGMA
table_list`'s `strict` and `wr` flags. The control reads the same projection from the fresh
database, so a missing column, a nullable one, a changed type, a lost `STRICT` or a `WITHOUT ROWID`
all change it. `tools/k6-proofs/scripts/__tests__/fresh-install-control.test.mjs` re-derives the
value from the DDL above, and, on a host with an openclaw clone holding j12, re-reads the DDL and
the other expectations from the product bytes.

The continuation defaults at j12: `enabled` only when explicitly `true` (`config.ts:100`);
`defaultDelayMs` 15000, `minDelayMs` 5000, `maxDelayMs` 300000, `maxChainLength` 10,
`costCapTokens` 500000, `maxDelegatesPerTurn` 5, `maxPendingWork` 32, `earlyWarningBand` 0.3125,
`crossSessionTargeting` disabled, busy-skip backoff 1 s ×2 up to `maxDelayMs`. The authority schema
and its advance do not depend on the switch. The minimal config sets `enabled: true`, so `config
validate` covers the continuation block a continuation install carries.

## No upgrade path

The migration journal is the state database's `migration_runs` and `migration_sources`. A fresh
j12 boot writes **one** row there of its own: the desktop approval step records its
once-per-database receipt unconditionally, `node-desktop-stream-pairing-defaults-v1`, status
`completed`, report `{"retiredDesktopApprovals":0}`, from gateway startup
(`src/gateway/server-startup-bootstrap.ts:496-505`). So "no journal entries" cannot mean an empty
table. The control reads it as follows, and publishes counts and hashes only:

- that one receipt, exactly so, is the fresh boot's own (`freshInstallReceipts`);
- any other run, or that id with another status or with approvals retired, is an upgrade or import
  path (`unexpected`), named only by the SHA-256 of its id;
- any `migration_sources` row, any `backup_runs` row, or an `agent_databases` row for the agent
  below schema 40 is an upgrade path too;
- the agent database's own `schema_meta` row must have been inserted once at 40
  (`agent-schema-version`).

If a real j12 run shows an unexpected run, report its hash and find the writer with a byte-walk.
Do not widen the allowlist without one.

## Refusals before start

The control refuses before it creates or starts anything, writes `refusal.json` (schema
`openclaw.k6.fresh-install-control-refusal.v1`, `processesStarted: 0`) and exits 2. The named
refusals:

| Refusal | When |
| --- | --- |
| `state-dir-not-empty` | `--state-dir` exists and holds anything. A fresh install starts from an empty directory; a missing one is created by the control. |
| `state-dir-live` | `--state-dir` is, is inside, or contains `~/.openclaw`, any `~/.openclaw-<profile>`, `~/.clawdbot`, or the operator's own `$OPENCLAW_STATE_DIR`. |
| `port-in-use` | Something already listens on `--port`. (`port-is-live` refuses 18789 and any port a live config names; `port-invalid` anything below 1024.) |
| `stage-build-mismatch` | The stage's `dist/build-info.json` commit is not `--candidate-sha`. |
| `model-credentials-in-environment` | The control's own environment carries a model credential: a key ending like a provider secret (`_API_KEY`, `_OAUTH_TOKEN`, `_AUTH_TOKEN`, …) or one of the j12 provider names the pattern misses (`COPILOT_GITHUB_TOKEN`, `GOOGLE_APPLICATION_CREDENTIALS`, `AWS_*` Bedrock credentials, …). Named by key, never by value. |

It also refuses a missing or loose observer key (`observer-key-missing`, `observer-key-mode`,
`observer-key-in-target`, `observer-key-short`), a docs SHA that is not the executing checkout
(`docs-sha-mismatch`), an artifact directory inside the repository, the state, the stage or a live
directory, or one already used, a state directory inside the artifact directory, a symlinked state
directory, a stage under a live directory, and any `--gateway-env` key but `NODE_OPTIONS`
(`--max-old-space-size`, loopback `--inspect`) and `OPENCLAW_CODEX_APP_SERVER_BIN`.

The gateway never sees the operator's environment. It gets a cleared one: `PATH`, `TZ`, `LANG`,
`NO_COLOR`, the allowed `--gateway-env`, `OPENCLAW_STATE_DIR`, `OPENCLAW_CONFIG_PATH`,
`OPENCLAW_GATEWAY_PORT`, the run marker, and `HOME` set to an empty directory the control owns, so
no CLI sign-in file (`~/.codex`, `~/.claude`, …) is discoverable either. The control re-reads the
running gateway's `/proc/<pid>/environ` (keys only) to confirm it.

## How it runs

1. **Guard.** The refusals above.
2. **Fresh state.** It creates the state directory (mode 0700), lists it (zero entries), and writes
   the minimal config to `<artifact-dir>.private/config/openclaw.json` (mode 0600, outside the
   state directory): `gateway.mode: "local"`, `gateway.port`, `gateway.bind: "loopback"`,
   `gateway.auth: { mode: "token", token: <fresh disposable token> }` and
   `agents.defaults.continuation.enabled: true`. Nothing else: no channels, no models, no plugins.
3. **One disposable gateway.** `node <stage>/dist/index.js gateway --port <port>` with the cleared
   environment, in its own process group. It waits up to `--boot-timeout-ms` (180 s) until the run's
   process owns the listener, `/readyz` and `/startupz` pass, and hello-ok answers.
4. **The epoch.** `sessions.create` (`{ key, agentId, label }`: no message, no title source), then
   `session.visibility.set` to `suggest`, with `operator.admin` as the CLI does. Authority rows are
   counted read-only before and after each.
5. **What the install created.** Read-only, from outside the gateway: the agent database's
   `user_version`, `schema_meta`, the authority table's projection and `auth_profile_store` count,
   and the state database's journal, backup runs and agent registry. These reads happen even when
   the epoch could not be established, so a missing table grades on the table.
6. **Config validate.** `node <stage>/dist/index.js config validate --json` with the gateway's own
   environment, while the gateway still runs.
7. **Clean stop.** SIGTERM to the gateway, identity re-checked (PID, start ticks, run marker). It
   must exit 0 within `--stop-grace-ms` (30 s) with no SIGKILL, without the product's "shutdown
   deadline reached before stop" line, with the listener released and no run process left behind.
8. **Cleanup.** It stops any process still carrying the run marker (recorded), removes the state
   directory it created (re-identified by device and inode; one it was given empty is emptied
   instead), the gateway HOME and the config, and confirms none remains.
9. **Receipt.** It grades the record, checks that no secret reached it (the token, the paths, the
   session key, the raw epoch, the observer key), signs `observer-receipt.json` with the observer
   key (`hmac-sha256-proof-observer-key-v1`) and keeps raw output in `<artifact-dir>.private` (mode
   0700, never published).

## Receipts and grading

Every receipt is graded `present` and `holds`. `gradeFreshInstallControl` in
`tools/k6-proofs/lib/fresh-install-control.mjs` decides the verdict from the signed record only.

| Receipt | Holds when |
| --- | --- |
| `runtime-build-info` | The stage's build-info commit is the candidate (buildId and version recorded). |
| `state-dir-empty-proof` | Zero entries before the first boot; the gateway HOME control-owned and empty; the config 0600, outside the state, with exactly the minimal keys (SHA-256 of its bytes). |
| `readiness` | Owned listener, `/readyz` 200 ready, `/startupz` 200 started, hello-ok with a bootId and the staged buildId. |
| `agent-schema-version` | `user_version` 40; `schema_meta` role `agent`, schema 40, the agent id, `created_at = updated_at`. |
| `no-upgrade-path` | Only the fresh boot's own receipt in `migration_runs`; no `migration_sources`, no `backup_runs`, no agent registered below 40. |
| `authority-table-column-hash` | The table exists and hashes to `6ede42f5f5ea65007530f5f59da660e22bcab9d932ba3fae6639b848aee8eb7b`. |
| `authority-epoch-row-hash` | 0 rows before `sessions.create`, exactly 1 after the narrowing, bound to the created key; key and epoch published as SHA-256 only. |
| `no-model-sign-in` | No credential key in the gateway's environ, its HOME the control's, no `auth_profile_store` row, none in the control's environment. |
| `config-validate` | Exit 0, `valid: true`, the reported path is the fresh config. |
| `clean-stop` | SIGTERM, exit 0, no SIGKILL, no missed shutdown deadline, listener released, nothing left. |
| `timings` | Boot, establishment, stop and total recorded. |
| `signed-cleanup-receipt` | No run process, listener, state, gateway HOME or config remains, and the record is signed. |

The verdict starts at PASS and only moves down:

- **PASS-candidate** needs every receipt present and holding.
- **FAIL-candidate** when a present receipt contradicts a fresh install: a gateway that never
  served, a wrong or migrated schema, an upgrade path in the journal, a missing or drifted
  authority table, not exactly one epoch row, a model credential or auth profile, an invalid
  config, an unclean stop, residue after cleanup, or a public-safety leak (the record is then
  withheld).
- **MISSING-candidate** when a receipt is absent: there is nothing to judge.
- **PARTIAL-candidate** when everything holds but a bound is missing: an unsigned record, a dirty
  docs harness, a stage without a `buildId` to bind hello-ok to, timings not recorded, or a control
  error recorded along the way.

So any missing observation keeps the record below PASS-candidate. Every grade lists the named
limits `no-upgrade-path-exercised`, `no-model-turn` and `no-delegate-delivery`.

## Operator steps for the j12 fire

Run these on a seat that builds locally, with a stage-only build of j12 whose
`dist/build-info.json` commit is the candidate. Never point the control at the live install, and run
it from a shell with no model credentials: `env -i` with only `HOME` and `PATH` is simplest. Pass
`OPENCLAW_STATE_DIR` through only so the guard can refuse it when the seat's live gateway uses a
custom one; the gateway never receives it.

```bash
SHA=352f56029dc95c60149ab4aaa127226a861d0b3d; DOCS=<merged docs 40-hex>
V=$HOME/flesh_beast_tmp/.openclaw-path-b/stage-only/$SHA     # dist/build-info.json commit == $SHA
W=~/flesh_beast_best_beast/source/WORKTREES/docs-fic-${DOCS:0:8}
git -C ~/flesh_beast_best_beast/source/karmaterminal-openclaw-docs worktree add --detach "$W" "$DOCS"
mkdir -p ~/.config/frond && (umask 077; head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > ~/.config/frond/fic-observer.key)
RUN=~/proof-runs/FIC-${SHA:0:8}-$(date -u +%Y%m%dT%H%M%SZ)   # new; the state and the receipt live side by side
FIC=tools/k6-proofs/scripts/run-fresh-install-control.mjs
KEY=~/.config/frond/fic-observer.key
cd "$W"
env -i HOME="$HOME" PATH="$PATH" ${OPENCLAW_STATE_DIR:+OPENCLAW_STATE_DIR="$OPENCLAW_STATE_DIR"} \
  node $FIC \
    --stage-dir "$V" --candidate-sha "$SHA" --docs-sha "$DOCS" \
    --state-dir "$RUN/state" --port 18797 \
    --artifact-dir "$RUN/receipt" --observer-key-file "$KEY" \
    --gateway-env NODE_OPTIONS=--max-old-space-size=16384
node $FIC --verify "$RUN/receipt/observer-receipt.json" --observer-key-file "$KEY"
```

Add `--gateway-env OPENCLAW_CODEX_APP_SERVER_BIN=<absolute path>` only if the seat's proof gateways
need it to boot; it carries no credential, and the gateway's HOME is empty, so nothing is signed in.
`--verify` checks the observer signature and re-grades the signed record; it exits 0 only when both
agree.

Expected:

| Evidence | Value |
| --- | --- |
| `VERDICT:` | `PASS-candidate`, `missingReceipts: []`, `namedLimits: [no-upgrade-path-exercised, no-model-turn, no-delegate-delivery]` |
| `record.storage.agentDatabase` | `userVersion: 40`, `schemaMeta.createdEqualsUpdated: true`, `authProfileRows: 0` |
| `record.storage.authorityTable.columnsSha256` | `6ede42f5f5ea65007530f5f59da660e22bcab9d932ba3fae6639b848aee8eb7b` |
| `record.storage.stateDatabase` | `migrationRuns.freshInstallReceipts: 1`, `unexpected: 0`, `migrationSources: 0`, `backupRuns: 0`, `userVersion: 36` |
| `record.authority` | `rowsBeforeCreate: 0`, `rowsAfterNarrowing: 1` |
| `record.cleanup` | `stateRemoved`, `homeRemoved`, `configRemoved` all `true`, `residualPids: []` |
| `$RUN/state` | gone |

If it grades anything else, report it with the receipt; do not retry with a weaker configuration.
`record.gateway.failure`, the `failures` codes and the private logs say which surface refused. An
interrupted run (Ctrl-C) stops its processes but writes no receipt and leaves `$RUN/state` for the
operator to remove.

Publish only `$RUN/receipt/` after review; never `$RUN/receipt.private`. Folding it into `PROOFS/`
is a separate, reviewed corpus step, and it is never folded with, or as, the stopped-seat restore
receipt. R-CD-FRESH-INSTALL stays MISSING until that artifact exists.

## Tests

`tools/k6-proofs/scripts/__tests__/fresh-install-control.test.mjs` and
`fresh-install-contract.test.mjs`, with a scripted stand-in for a fresh j12 install
(`__tests__/helpers/fresh-install-scripted-gateway.mjs`): every named refusal; the verdict on a
holding fixture (PASS-candidate), with each receipt removed in turn (never PASS), and with each
contradiction (FAIL-candidate); dry runs of the real control against the scripted gateway, one
positive and one per contradiction, each cleaning up; the manifest, the catalog checks and the
live-run guard, which refuses the row (`orchestration-required`) even with every live gate set.
They are fixtures and mocks only, never a live result.
