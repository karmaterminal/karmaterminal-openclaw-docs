/**
 * Scenario scaffold: R-CD-FRESH-INSTALL.
 *
 * k6 cannot create a state directory or start, observe and stop a gateway process, so this entry
 * stays non-runnable and fails closed. The row's executable control is
 * `tools/k6-proofs/scripts/run-fresh-install-control.mjs`: it starts one disposable gateway on an
 * empty state directory with no model sign-in, observes what the fresh install creates, stops it
 * and grades the receipts. Ruling: 🌊, room msg 1567073096706297887 (2026-11-03 07:09Z): fresh
 * install is its own j12 corpus row (empty state dir, disposable process, no model turn), kept
 * separate from the stopped-seat restore receipt, which proves upgrade and recovery. Bound issue:
 * karmaterminal/karmaterminal-openclaw-docs#536; ClawSweeper's P1 on openclaw/openclaw#129388
 * (comment 5442236054) asks for the fresh-install evidence.
 *
 * Product path at j12 karmaterminal/openclaw 352f56029dc95c60149ab4aaa127226a861d0b3d (byte-read
 * with git show; no GitNexus index was used).
 *
 * 1. How an empty state directory is initialized. OPENCLAW_STATE_DIR, when absolute, is the state
 *    root as given (src/config/state-dir.ts:23-43; the default is ~/.openclaw or
 *    ~/.openclaw-<profile>, src/cli/profile-utils.ts:26-37, and the legacy ~/.clawdbot,
 *    src/config/state-dir.ts:10-12). The shared state database is <state>/state/openclaw.sqlite
 *    (src/state/openclaw-state-db.paths.ts:41) at OPENCLAW_STATE_SCHEMA_VERSION 36
 *    (src/state/openclaw-schema-versions.ts:47); each agent's database is
 *    <state>/agents/<id>/agent/openclaw-agent.sqlite (src/state/openclaw-agent-db.paths.ts:22-35).
 *    The gateway starts only with gateway.mode=local or --allow-unconfigured
 *    (src/cli/gateway-cli/pre-bootstrap.ts:54-81), so the minimal config sets it.
 *
 * 2. Where the agent database is created at OPENCLAW_AGENT_SCHEMA_VERSION directly.
 *    OPENCLAW_AGENT_SCHEMA_VERSION = 40 (src/state/openclaw-schema-versions.ts:13; v40 is the
 *    continuation's recipient-authority step, :3-4 and
 *    src/state/openclaw-agent-recipient-authority-schema.ts:11-12). An empty file has
 *    user_version 0 and no application schema, so it is no schema migration
 *    (src/state/openclaw-agent-db-schema.ts:317-319), and its integrity gate is the fresh-empty
 *    branch (:232-239). The canonical-creation branch then runs the whole current schema, sets
 *    PRAGMA user_version = 40 and inserts schema_meta, in one transaction, "Canonical creation has
 *    no legacy rows or definitions to converge or repair" (src/state/openclaw-agent-db-schema.ts:352-358).
 *    schema_meta's primary row is inserted with created_at = updated_at and is updated only when
 *    the version, app version or agent changes (src/state/openclaw-agent-db-metadata-write.ts:9-43;
 *    table at src/state/openclaw-agent-schema.sql:6-14). Every other path crosses the fleet's
 *    migration steps (src/state/openclaw-agent-db-schema.ts:360-465).
 *
 * 3. Where session_recipient_authority is created. In the canonical agent schema, so by the same
 *    canonical creation: src/state/openclaw-agent-schema.sql:142-147, a STRICT table
 *    (session_key TEXT NOT NULL PRIMARY KEY, epoch TEXT NOT NULL, created_at INTEGER NOT NULL,
 *    updated_at INTEGER NOT NULL), with no session_nodes foreign key because deletion is one of
 *    its generation edges (:140-141). SQLite reports the projection whose SHA-256 is
 *    6ede42f5f5ea65007530f5f59da660e22bcab9d932ba3fae6639b848aee8eb7b (lib/fresh-install-control.mjs).
 *
 * 4. What sessions.create and session.visibility.set write. sessions.create
 *    (src/gateway/methods/core-descriptors.ts:244) with no message has no initial turn: it
 *    schedules only a title, and that only with a title source, so it dispatches no model turn
 *    (src/gateway/server-methods/sessions-create.ts:254-263,
 *    src/gateway/server-methods/sessions-create.ts:616-618,
 *    src/gateway/server-methods/chat-send-background.ts:36-38). Creation is not an authority
 *    generation edge. session.visibility.set (operator.write,
 *    src/gateway/methods/core-descriptors.ts:467; handler
 *    src/gateway/server-methods/sessions-sharing.ts:527-585; `suggest` allowed by default,
 *    src/gateway/session-sharing-policy.ts:85-93) patches the entry, and a narrowing
 *    (src/config/sessions/session-recipient-authority-types.ts:94-99) advances the recipient
 *    authority in the same write transaction
 *    (src/config/sessions/session-accessor.sqlite-entry-mutation.ts:119-136), an insert-or-replace
 *    of one row for that session key (src/config/sessions/session-accessor.sqlite-recipient-authority.ts:17-37).
 *    So sessions.create then shared -> suggest writes exactly one epoch row, which the control
 *    reads read-only from outside the gateway and publishes only as SHA-256.
 *
 * 5. The continuation config defaults. agents.defaults.continuation is read at each enforcement
 *    point; enabled only when explicitly true, defaultDelayMs 15000, minDelayMs 5000, maxDelayMs
 *    300000, maxChainLength 10, costCapTokens 500000, maxDelegatesPerTurn 5, maxPendingWork 32,
 *    earlyWarningBand 0.3125, crossSessionTargeting disabled, busy-skip backoff 1 s x2 up to
 *    maxDelayMs (src/auto-reply/continuation/config.ts:15-26,
 *    src/auto-reply/continuation/config.ts:90-137; schema
 *    src/config/zod-schema.agent-defaults-base.ts:270-322). The schema and the authority advance
 *    do not depend on the switch; the minimal config sets enabled true so config validate covers
 *    the continuation block a continuation install carries.
 *
 * 6. The migration journal. migration_runs and migration_sources in the state database
 *    (src/state/openclaw-state-schema.sql:1850-1881), written by
 *    src/infra/state-migrations.receipts.ts:93-151 when a legacy source is imported or a
 *    once-per-database step settles; backup_runs (:1883-1889); the agent registry
 *    agent_databases (:1182-1189). A fresh boot writes one run of its own: the desktop approval
 *    step's once-per-database receipt, completed with nothing retired
 *    (src/infra/device-pairing-node-desktop-migration.ts:27 and 92-127), run at gateway startup by
 *    src/gateway/server-startup-bootstrap.ts:496-505. Anything else is an upgrade or import path.
 *
 * 7. Readiness, validation and stop. /readyz is 200 {ready:true} or 503 and /startupz reports
 *    started | starting | draining (src/gateway/server-http-probes.ts:12-24 and 83-94,
 *    src/gateway/server/readiness.ts:29-33); hello-ok carries server.buildId and a per-process
 *    server.bootId (src/gateway/server/ws-connection/connect-hello.ts:174-180; buildId from
 *    dist/build-info.json, src/version.ts:83-95). `openclaw config validate --json` prints
 *    {valid:true,path,warnings} and exits 0, or {valid:false,issues} and exits 1
 *    (src/cli/config-cli.ts:484-565). SIGTERM requests a stop
 *    (src/cli/gateway-cli/run-loop-signals.ts:175-210 and 344; src/cli/gateway-cli/run-loop.ts:1010-1012);
 *    a stop that misses its shutdown deadline logs "shutdown deadline reached before stop ...
 *    cleanup incomplete" and can still force-exit 0 (run-loop.ts:622-634), so the control reads
 *    that line and does not call such a stop clean.
 *    When the entry re-execs for its compile cache it does so in place with execve on Linux
 *    (src/entry.compile-cache.ts:52-53), so the spawned PID owns the listener; the control also
 *    accepts a listener owned by any process carrying its run marker. The entry may detach a
 *    compile-cache maintainer (node-compile-cache.mjs:192-229) that outlives the gateway by design;
 *    the control counts it apart from leftover processes and stops it at cleanup. The log file is
 *    configured into the run's private directory, because without logging.file the product logs to
 *    the machine-wide /tmp/openclaw rolling file (src/logging/logger.ts:441-442,
 *    src/infra/tmp-openclaw-dir.ts:6); that shared temp root has no override
 *    (src/infra/tmp-openclaw-dir.ts:87-127), so the control records what changed there.
 *
 * 8. Model credentials. Core provider credentials are environment variables
 *    (src/secrets/provider-env-vars.ts:32-44) plus each plugin's setup.providers[].envVars
 *    (extensions/*\/openclaw.plugin.json); CLI sign-ins live under HOME. The gateway gets a
 *    cleared environment and an empty HOME the control owns.
 *
 * What this row does not prove: no upgrade path (j12's stopped-seat restore receipt owns
 * upgrade and recovery), no model turn, no delegate delivery.
 */
export const options = {
  scenarios: {
    r_cd_fresh_install_scaffold: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '10s',
    },
  },
};

const REFUSAL =
  'R-CD-FRESH-INSTALL is fixture-gated; run tools/k6-proofs/scripts/run-fresh-install-control.mjs on a staged runtime of the exact candidate with an empty state directory.';

// k6 logs an exception thrown by an iteration and still exits 0; one thrown from setup()
// aborts the run (exit 107), so the refusal lives there too.
export function setup() {
  throw new Error(REFUSAL);
}

export default function () {
  throw new Error(REFUSAL);
}
