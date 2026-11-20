#!/usr/bin/env node
/**
 * Scripted stand-in for a fresh j12 install, used only by fresh-install-control.test.mjs. The test
 * copies this file to a temporary stage as dist/index.js next to a dist/build-info.json, so the
 * control spawns it exactly as it would spawn `node <stage>/dist/index.js gateway --port <port>`
 * and `node <stage>/dist/index.js config validate --json`.
 *
 * It mirrors the j12 surfaces the control observes, not their implementation:
 * - the gateway start guard: no gateway.mode=local, no start (src/cli/gateway-cli/pre-bootstrap.ts:54-81);
 * - the state database at <state>/state/openclaw.sqlite (src/state/openclaw-state-db.paths.ts:41)
 *   with its migration journal, backup runs and agent registry (src/state/openclaw-state-schema.sql:
 *   1182-1189, 1850-1889), user_version 36, and the one receipt a fresh boot writes
 *   (src/infra/device-pairing-node-desktop-migration.ts:27, 92-127);
 * - the agent database at <state>/agents/<id>/agent/openclaw-agent.sqlite
 *   (src/state/openclaw-agent-db.paths.ts:22-35), created on first use by canonical creation: the
 *   schema, user_version 40 and one schema_meta insert in one transaction
 *   (src/state/openclaw-agent-db-schema.ts:352-358), with session_recipient_authority verbatim
 *   (src/state/openclaw-agent-schema.sql:142-147) and auth_profile_store (:662-666);
 * - GET /readyz and /startupz, hello-ok with server.buildId and server.bootId;
 * - sessions.create (no message: no turn) and session.visibility.set, whose narrowing advances the
 *   recipient authority (src/config/sessions/session-accessor.sqlite-entry-mutation.ts:119-136);
 * - `config validate --json` ({ valid, path, warnings }, exit 0, or { valid: false, issues }, exit 1;
 *   src/cli/config-cli.ts:484-565);
 * - SIGTERM: close and exit 0.
 *
 * Behaviour switches (environment, passed with --gateway-env): FIC_SCRIPT_AGENT_VERSION=<n> creates
 * the agent database at schema n; FIC_SCRIPT_MIGRATED=1 creates it at 39 and migrates it to 40 (an
 * upgrade path: schema_meta updated after it was created); FIC_SCRIPT_LEGACY_IMPORT=1 records a
 * legacy import run and source; FIC_SCRIPT_BACKUP_RUN=1 records a backup run;
 * FIC_SCRIPT_STALE_REGISTRY=1 registers the agent database at schema 39;
 * FIC_SCRIPT_DESKTOP_RETIRED=<n> records the desktop receipt with n retired approvals;
 * FIC_SCRIPT_AUTHORITY=nostrict|extra-column|missing changes the authority table;
 * FIC_SCRIPT_CREATE_WRITES_AUTHORITY=1 makes sessions.create write a second epoch row;
 * FIC_SCRIPT_NO_ADVANCE=1 makes the narrowing write none; FIC_SCRIPT_AUTH_PROFILE=1 stores an auth
 * profile; FIC_SCRIPT_CONFIG_INVALID=1 fails config validate; FIC_SCRIPT_STOP_EXIT=<code> exits with
 * that code on SIGTERM; FIC_SCRIPT_STOP_DEADLINE=1 logs the run loop's missed-deadline line
 * (src/cli/gateway-cli/run-loop.ts:626-628) and still exits 0; FIC_SCRIPT_IGNORE_SIGTERM=1 ignores it; FIC_SCRIPT_ORPHAN=1 leaves a helper
 * behind when it stops; FIC_SCRIPT_NEVER_READY=1 keeps /readyz at 503; FIC_SCRIPT_BUILD_ID=<id>
 * reports another buildId in hello-ok; FIC_SCRIPT_NO_DESKTOP_RECEIPT=1 skips the fresh boot's own
 * journal receipt; FIC_SCRIPT_MAINTAINER=1 detaches a compile-cache maintainer
 * (`node <dist>/node-compile-cache.mjs --maintain <dir>`, as the j12 entry does,
 * node-compile-cache.mjs:192-229) that outlives the stop by design.
 *
 * Like the product it logs to logging.file when the config sets one, and keeps its scratch under
 * TMPDIR.
 */
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { createServer } from 'node:http';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const args = process.argv.slice(2);
const env = process.env;
const stateDir = env.OPENCLAW_STATE_DIR;
const configPath = env.OPENCLAW_CONFIG_PATH;
const buildInfo = JSON.parse(readFileSync(new URL('./build-info.json', import.meta.url), 'utf8'));

function readConfig() {
  try {
    return JSON.parse(readFileSync(configPath, 'utf8'));
  } catch {
    return null;
  }
}

if (args[0] === 'config' && args[1] === 'validate') {
  const config = readConfig();
  process.stdout.write('[config] validating\n');
  if (!config) {
    process.stdout.write(`${JSON.stringify({ ok: false, error: 'file not found', valid: false, path: configPath }, null, 2)}\n`);
    process.exit(1);
  }
  if (env.FIC_SCRIPT_CONFIG_INVALID === '1' || config.gateway?.mode !== 'local') {
    process.stdout.write(`${JSON.stringify({ ok: false, valid: false, path: configPath, issues: [{ path: 'gateway.mode', message: 'invalid' }] }, null, 2)}\n`);
    process.exit(1);
  }
  process.stdout.write(`${JSON.stringify({ valid: true, path: configPath, warnings: [] }, null, 2)}\n`);
  process.exit(0);
}

if (args[0] === '--fic-helper') {
  setInterval(() => {}, 1_000);
  await new Promise(() => {});
}

if (args[0] !== 'gateway') {
  process.stderr.write(`scripted gateway: unknown command ${args.join(' ')}\n`);
  process.exit(2);
}

const config = readConfig();
if (config?.gateway?.mode !== 'local') {
  process.stderr.write('Gateway start blocked: set gateway.mode=local or pass --allow-unconfigured.\n');
  process.exit(1);
}
const port = Number(args[args.indexOf('--port') + 1]);
const token = config.gateway.auth.token;
const logFile = config.logging?.file ?? null;
const logLine = (line) => {
  if (logFile) appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`);
};
writeFileSync(path.join(os.tmpdir(), `fic-scripted-${process.pid}.tmp`), 'scratch');
logLine('gateway starting');
if (env.FIC_SCRIPT_MAINTAINER === '1') {
  spawn(process.execPath, [new URL('./node-compile-cache.mjs', import.meta.url).pathname, '--maintain', path.join(os.tmpdir(), 'node-compile-cache')], {
    stdio: 'ignore',
    detached: true,
  }).unref();
}
const bootId = randomUUID();
const startedAt = Date.now();
const sessions = new Map();

/* the state database */
mkdirSync(path.join(stateDir, 'state'), { recursive: true });
const stateDb = new DatabaseSync(path.join(stateDir, 'state', 'openclaw.sqlite'));
stateDb.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS agent_databases (
  agent_id TEXT NOT NULL, path TEXT NOT NULL, schema_version INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL, size_bytes INTEGER, PRIMARY KEY (agent_id, path)) STRICT;
CREATE TABLE IF NOT EXISTS migration_runs (
  id TEXT NOT NULL PRIMARY KEY, started_at INTEGER NOT NULL, finished_at INTEGER,
  status TEXT NOT NULL, report_json TEXT NOT NULL) STRICT;
CREATE TABLE IF NOT EXISTS migration_sources (
  source_key TEXT NOT NULL PRIMARY KEY, migration_kind TEXT NOT NULL, source_path TEXT NOT NULL,
  target_table TEXT NOT NULL, source_sha256 TEXT, source_size_bytes INTEGER, source_record_count INTEGER,
  last_run_id TEXT NOT NULL, status TEXT NOT NULL, imported_at INTEGER NOT NULL,
  removed_source INTEGER NOT NULL DEFAULT 0, report_json TEXT NOT NULL) STRICT;
CREATE TABLE IF NOT EXISTS backup_runs (
  id TEXT NOT NULL PRIMARY KEY, created_at INTEGER NOT NULL, archive_path TEXT NOT NULL,
  status TEXT NOT NULL, manifest_json TEXT NOT NULL) STRICT;
PRAGMA user_version = 36;`);
const run = (sql, ...values) => stateDb.prepare(sql).run(...values);
if (env.FIC_SCRIPT_NO_DESKTOP_RECEIPT !== '1') {
  run("INSERT OR IGNORE INTO migration_runs VALUES ('node-desktop-stream-pairing-defaults-v1', ?, ?, 'completed', ?)",
    startedAt, startedAt, JSON.stringify({ retiredDesktopApprovals: Number(env.FIC_SCRIPT_DESKTOP_RETIRED ?? 0) }));
}
if (env.FIC_SCRIPT_LEGACY_IMPORT === '1') {
  run("INSERT INTO migration_runs VALUES ('legacy-sessions:import', ?, ?, 'completed', '{}')", startedAt, startedAt);
  run("INSERT INTO migration_sources VALUES ('legacy-sessions:abc', 'sessions', '/legacy/sessions.json', 'session_nodes', NULL, NULL, 1, 'legacy-sessions:import', 'completed', ?, 1, '{}')", startedAt);
}
if (env.FIC_SCRIPT_BACKUP_RUN === '1') run("INSERT INTO backup_runs VALUES ('pre-migration', ?, '/backup.tar', 'completed', '{}')", startedAt);

/* the agent database, created on first use */
const AUTHORITY_DDL = {
  canonical: `CREATE TABLE IF NOT EXISTS session_recipient_authority (
  session_key TEXT NOT NULL PRIMARY KEY,
  epoch TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;`,
  nostrict: 'CREATE TABLE session_recipient_authority (session_key TEXT NOT NULL PRIMARY KEY, epoch TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);',
  'extra-column': 'CREATE TABLE session_recipient_authority (session_key TEXT NOT NULL PRIMARY KEY, epoch TEXT NOT NULL, generation INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL) STRICT;',
  missing: '',
};
let agentDb = null;
function agentDatabase(agentId) {
  if (agentDb) return agentDb;
  const dir = path.join(stateDir, 'agents', agentId, 'agent');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'openclaw-agent.sqlite');
  agentDb = new DatabaseSync(file);
  agentDb.exec('PRAGMA journal_mode=WAL');
  const migrated = env.FIC_SCRIPT_MIGRATED === '1';
  const version = migrated ? 39 : Number(env.FIC_SCRIPT_AGENT_VERSION ?? 40);
  const now = Date.now();
  agentDb.exec('BEGIN IMMEDIATE');
  agentDb.exec(`CREATE TABLE schema_meta (meta_key TEXT NOT NULL PRIMARY KEY, role TEXT NOT NULL,
    schema_version INTEGER NOT NULL, agent_id TEXT, app_version TEXT, created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL) STRICT;
    CREATE TABLE auth_profile_store (store_key TEXT NOT NULL PRIMARY KEY, store_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL) STRICT;
    ${AUTHORITY_DDL[env.FIC_SCRIPT_AUTHORITY ?? 'canonical']}
    PRAGMA user_version = ${version};`);
  agentDb.prepare("INSERT INTO schema_meta VALUES ('primary', 'agent', ?, ?, 'scripted', ?, ?)").run(version, agentId, now, now);
  agentDb.exec('COMMIT');
  if (migrated) {
    agentDb.exec('PRAGMA user_version = 40');
    agentDb.prepare("UPDATE schema_meta SET schema_version = 40, updated_at = ? WHERE meta_key = 'primary'").run(now + 7);
  }
  if (env.FIC_SCRIPT_AUTH_PROFILE === '1') {
    agentDb.prepare("INSERT INTO auth_profile_store VALUES ('anthropic:default', '{}', ?)").run(now);
  }
  const registered = env.FIC_SCRIPT_STALE_REGISTRY === '1' ? 39 : Number(agentDb.prepare('PRAGMA user_version').get().user_version);
  run('INSERT OR REPLACE INTO agent_databases VALUES (?, ?, ?, ?, NULL)', agentId, `agents/${agentId}/agent/openclaw-agent.sqlite`, registered, now);
  return agentDb;
}

function advance(db, sessionKey) {
  const now = Date.now();
  db.prepare(`INSERT INTO session_recipient_authority (session_key, epoch, created_at, updated_at)
    VALUES (?, ?, ?, ?) ON CONFLICT(session_key) DO UPDATE SET epoch = excluded.epoch, updated_at = excluded.updated_at`)
    .run(sessionKey, randomUUID(), now, now);
}

if (env.FIC_SCRIPT_AUTH_PROFILE === '1') agentDatabase('main');

function json(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(text) });
  res.end(text);
}

function probeHandler(req, res) {
  const uptimeMs = Date.now() - startedAt;
  const ready = env.FIC_SCRIPT_NEVER_READY !== '1';
  if (req.url === '/readyz') {
    return ready ? json(res, 200, { ready: true }) : json(res, 503, { ready: false });
  }
  if (req.url === '/startupz') {
    return ready
      ? json(res, 200, { ok: true, status: 'started', version: 'scripted', buildId: buildInfo.buildId, uptimeMs })
      : json(res, 503, { ok: false, status: 'starting', uptimeMs, pendingReason: 'scripted' });
  }
  json(res, 404, { ok: false });
}

function send(socket, value) {
  const payload = Buffer.from(JSON.stringify(value));
  let header;
  if (payload.length < 126) header = Buffer.from([0x81, payload.length]);
  else if (payload.length < 65_536) header = Buffer.from([0x81, 126, payload.length >> 8, payload.length & 0xff]);
  else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  socket.write(Buffer.concat([header, payload]));
}

function respond(socket, id, ok, payload, error) {
  send(socket, ok ? { type: 'res', id, ok: true, payload } : { type: 'res', id, ok: false, error });
}

function handle(socket, connection, frame) {
  if (frame.method === 'connect') {
    if (frame.params?.auth?.token !== token) {
      respond(socket, frame.id, false, null, { code: 'UNAUTHORIZED', message: 'gateway token mismatch' });
      socket.end();
      return;
    }
    connection.scopes = Array.isArray(frame.params.scopes) ? frame.params.scopes : [];
    respond(socket, frame.id, true, {
      type: 'hello-ok',
      protocol: 4,
      server: { version: 'scripted', buildId: env.FIC_SCRIPT_BUILD_ID ?? buildInfo.buildId, bootId, connId: randomUUID() },
      features: { methods: ['sessions.create', 'session.visibility.set'], events: ['connect.challenge'] },
      snapshot: {},
      auth: { role: 'operator', scopes: connection.scopes },
    });
    return;
  }
  if (!connection.scopes) {
    respond(socket, frame.id, false, null, { code: 'UNAUTHORIZED', message: 'connect first' });
    return;
  }
  if (frame.method === 'sessions.create') {
    if (frame.params?.message !== undefined || frame.params?.titleSource !== undefined) {
      respond(socket, frame.id, false, null, { code: 'INVALID_REQUEST', message: 'scripted gateway runs no model turn' });
      return;
    }
    const db = agentDatabase(frame.params.agentId);
    const key = `agent:${frame.params.agentId}:${frame.params.key}`;
    sessions.set(key, { visibility: 'shared', agentId: frame.params.agentId });
    if (env.FIC_SCRIPT_CREATE_WRITES_AUTHORITY === '1') advance(db, `${key}:shadow`);
    respond(socket, frame.id, true, { ok: true, key, sessionId: randomUUID() });
    return;
  }
  if (frame.method === 'session.visibility.set') {
    if (!connection.scopes.includes('operator.admin')) {
      respond(socket, frame.id, false, null, { code: 'INVALID_REQUEST', message: 'session owner or operator.admin required' });
      return;
    }
    const rank = { draft: 0, 'read-only': 1, suggest: 2, shared: 3 };
    const session = sessions.get(frame.params.sessionKey);
    if (!session) {
      respond(socket, frame.id, false, null, { code: 'NOT_FOUND', message: 'session not found' });
      return;
    }
    if (rank[frame.params.visibility] < rank[session.visibility] && env.FIC_SCRIPT_NO_ADVANCE !== '1') {
      advance(agentDatabase(session.agentId), frame.params.sessionKey);
    }
    session.visibility = frame.params.visibility;
    respond(socket, frame.id, true, { ok: true, sessionKey: frame.params.sessionKey, visibility: frame.params.visibility });
    return;
  }
  respond(socket, frame.id, false, null, { code: 'INVALID_REQUEST', message: `unknown method ${frame.method}` });
}

const sockets = new Set();
function upgradeHandler(request, socket) {
  const accept = createHash('sha1')
    .update(`${request.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');
  socket.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${accept}`, '\r\n'].join('\r\n'));
  sockets.add(socket);
  socket.on('close', () => sockets.delete(socket));
  socket.on('error', () => sockets.delete(socket));
  const connection = {};
  send(socket, { type: 'event', event: 'connect.challenge', payload: { nonce: randomUUID(), ts: Date.now() } });
  let buffered = Buffer.alloc(0);
  socket.on('data', (chunk) => {
    buffered = Buffer.concat([buffered, chunk]);
    while (buffered.length >= 2) {
      const opcode = buffered[0] & 0x0f;
      const masked = (buffered[1] & 0x80) !== 0;
      let length = buffered[1] & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (buffered.length < 4) return;
        length = buffered.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (buffered.length < 10) return;
        length = Number(buffered.readBigUInt64BE(2));
        offset = 10;
      }
      const maskLength = masked ? 4 : 0;
      if (buffered.length < offset + maskLength + length) return;
      const mask = masked ? buffered.subarray(offset, offset + 4) : null;
      offset += maskLength;
      const payload = Buffer.from(buffered.subarray(offset, offset + length));
      buffered = buffered.subarray(offset + length);
      if (mask) for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4];
      if (opcode === 0x8) {
        socket.end(Buffer.from([0x88, 0]));
        return;
      }
      if (opcode !== 0x1) continue;
      handle(socket, connection, JSON.parse(payload.toString('utf8')));
    }
  });
}

const server = createServer(probeHandler);
server.on('upgrade', upgradeHandler);
await new Promise((resolve) => setTimeout(resolve, 100));
server.listen(port, '127.0.0.1', () => process.stdout.write(`[gateway] ready (port ${port})\n`));

process.on('SIGTERM', () => {
  if (env.FIC_SCRIPT_IGNORE_SIGTERM === '1') {
    process.stdout.write('[gateway] ignoring SIGTERM\n');
    return;
  }
  if (env.FIC_SCRIPT_ORPHAN === '1') {
    spawn(process.execPath, [process.argv[1], '--fic-helper'], { stdio: 'ignore', detached: true }).unref();
  }
  server.close();
  for (const socket of sockets) socket.destroy();
  server.closeAllConnections?.();
  agentDb?.close();
  stateDb.close();
  if (env.FIC_SCRIPT_STOP_DEADLINE === '1') {
    process.stderr.write('[gateway] shutdown deadline reached before stop; pending close steps: plugins; cleanup incomplete; exitCode=0\n');
  }
  logLine('gateway stopped');
  process.stdout.write('[gateway] stopped\n');
  process.exit(Number(env.FIC_SCRIPT_STOP_EXIT ?? 0));
});
