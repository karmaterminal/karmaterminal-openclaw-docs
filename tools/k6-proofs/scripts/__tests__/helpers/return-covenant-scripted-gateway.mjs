#!/usr/bin/env node
/**
 * Scripted stand-in for the candidate gateway, used only by
 * return-covenant-restart-control.test.mjs. The test copies this file to a temporary
 * stage as dist/index.js next to a dist/build-info.json, so the control spawns it exactly
 * as it would spawn `node <stage>/dist/index.js gateway --port <port>`.
 *
 * It mirrors the F′ surfaces the control observes, not their implementation:
 * - GET /readyz and /startupz with the product's 200/503 bodies (server-http-probes.ts:84-94,
 *   readiness.ts:29-33), including `draining` while a restart closes the server;
 * - the WebSocket connect.challenge -> connect -> hello-ok handshake with server.buildId and
 *   server.bootId (connect-hello.ts:173-182), sessions.create, session.visibility.set
 *   (narrowing advances the recipient authority, session-accessor.sqlite-entry-mutation.ts:119-135)
 *   and the untargeted gateway.restart.request (restart.ts:124-194);
 * - session_recipient_authority in a WAL per-agent database (openclaw-agent-schema.sql:140-147);
 * - external-supervisor restart: close, write the gateway_restart_handoff row, exit 0
 *   (run-loop.ts:497-560), and `gateway restart-handoff consume --expected-pid <pid> --json`
 *   (register-restart-handoff.ts:41-74).
 *
 * Behaviour switches (environment): RCC_SCRIPT_ADVANCE_ON_BOOT=<n> advances every authority
 * row when boot n starts (a product that clears the covenant on restart);
 * RCC_SCRIPT_NO_HANDOFF=1 exits without a handoff row; RCC_SCRIPT_REJECT_RESTART=1 rejects
 * the restart request; RCC_SCRIPT_NEVER_READY_ON_BOOT=<n> keeps boot n listening but 503;
 * RCC_SCRIPT_ORPHAN=1 leaves a descendant in its process group when it exits;
 * RCC_SCRIPT_DROP_RESTART_RESPONSE=1 restarts without answering the request;
 * RCC_SCRIPT_BOOT_DELAY_MS delays each listen. The consume command prints a log line before
 * its JSON, as a product CLI may.
 */
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const PROTOCOL = 'openclaw.gateway.restart-handoff';
const args = process.argv.slice(2);
const stateDir = process.env.OPENCLAW_STATE_DIR;
const configPath = process.env.OPENCLAW_CONFIG_PATH;
const buildInfo = JSON.parse(readFileSync(new URL('./build-info.json', import.meta.url), 'utf8'));

function agentDatabase() {
  const dir = path.join(stateDir, 'agents', 'main', 'agent');
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, 'openclaw-agent.sqlite'));
  db.exec('PRAGMA journal_mode=WAL');
  db.exec(`CREATE TABLE IF NOT EXISTS session_recipient_authority (
    session_key TEXT NOT NULL PRIMARY KEY,
    epoch TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  ) STRICT`);
  return db;
}

function stateDatabase() {
  const dir = path.join(stateDir, 'state');
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, 'openclaw.sqlite'));
  db.exec('PRAGMA journal_mode=WAL');
  db.exec(`CREATE TABLE IF NOT EXISTS gateway_restart_handoff (
    handoff_key TEXT NOT NULL PRIMARY KEY,
    kind TEXT NOT NULL, version INTEGER NOT NULL, intent_id TEXT NOT NULL, pid INTEGER NOT NULL,
    process_instance_id TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
    reason TEXT, source TEXT NOT NULL, restart_kind TEXT NOT NULL, supervisor_mode TEXT NOT NULL
  ) STRICT`);
  return db;
}

function advance(db, sessionKey) {
  const now = Date.now();
  db.prepare(`INSERT INTO session_recipient_authority (session_key, epoch, created_at, updated_at)
    VALUES (?, ?, ?, ?) ON CONFLICT(session_key) DO UPDATE SET epoch = excluded.epoch, updated_at = excluded.updated_at`)
    .run(sessionKey, randomUUID(), now, now);
}

if (args[0] === 'gateway' && args[1] === 'restart-handoff' && args[2] === 'consume') {
  const index = args.indexOf('--expected-pid');
  const expectedPid = Number(args[index + 1]);
  const db = stateDatabase();
  const row = db.prepare("SELECT * FROM gateway_restart_handoff WHERE handoff_key = 'current'").get();
  let result;
  if (!row) {
    result = { status: 'none', reason: 'missing' };
  } else if (row.pid !== expectedPid) {
    result = { status: 'rejected', reason: 'pid-mismatch', handoffPid: row.pid };
  } else {
    db.prepare("DELETE FROM gateway_restart_handoff WHERE handoff_key = 'current'").run();
    result = {
      status: 'accepted',
      handoff: {
        kind: row.kind,
        version: row.version,
        intentId: row.intent_id,
        pid: row.pid,
        processInstanceId: row.process_instance_id,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        reason: row.reason,
        source: row.source,
        restartKind: row.restart_kind,
        supervisorMode: row.supervisor_mode,
      },
    };
  }
  db.close();
  process.stdout.write('[restart-handoff] consume {expected-pid} requested\n');
  process.stdout.write(`${JSON.stringify({ ok: true, protocol: PROTOCOL, protocolVersion: 1, ...result }, null, 2)}\n`);
  process.exit(0);
}

if (args[0] !== 'gateway') {
  process.stderr.write(`scripted gateway: unknown command ${args.join(' ')}\n`);
  process.exit(2);
}

const port = Number(args[args.indexOf('--port') + 1]);
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const token = config.gateway.auth.token;
const bootsFile = path.join(stateDir, '.rcc-scripted-boots');
const boot = (existsSync(bootsFile) ? Number(readFileSync(bootsFile, 'utf8')) : 0) + 1;
writeFileSync(bootsFile, String(boot));
const bootId = randomUUID();
const startedAt = Date.now();
const sessions = new Map();
let draining = Number(process.env.RCC_SCRIPT_NEVER_READY_ON_BOOT) === boot;

const agentDb = agentDatabase();
if (Number(process.env.RCC_SCRIPT_ADVANCE_ON_BOOT) === boot) {
  for (const { session_key: key } of agentDb.prepare('SELECT session_key FROM session_recipient_authority').all()) {
    advance(agentDb, key);
  }
  process.stdout.write(`[gateway] boot ${boot} advanced recipient authority\n`);
}

function json(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(text) });
  res.end(text);
}

const server = createServer((req, res) => {
  const uptimeMs = Date.now() - startedAt;
  if (req.url === '/readyz') {
    return draining
      ? json(res, 503, { ready: false, coreReady: false, failing: ['draining'], uptimeMs })
      : json(res, 200, { ready: true, coreReady: true, failing: [], uptimeMs });
  }
  if (req.url === '/startupz') {
    return draining
      ? json(res, 503, { ok: false, status: 'draining', uptimeMs })
      : json(res, 200, { ok: true, status: 'started', version: 'scripted', buildId: buildInfo.buildId, uptimeMs });
  }
  json(res, 404, { ok: false });
});

const sockets = new Set();
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
      server: { version: 'scripted', buildId: buildInfo.buildId, bootId, connId: randomUUID() },
      features: { methods: ['sessions.create', 'session.visibility.set', 'gateway.restart.request'], events: ['connect.challenge'] },
      snapshot: {},
      auth: { role: 'operator', scopes: connection.scopes },
      policy: { maxPayload: 1_048_576, maxBufferedBytes: 4_194_304, tickIntervalMs: 30_000 },
    });
    return;
  }
  if (!connection.scopes) {
    respond(socket, frame.id, false, null, { code: 'UNAUTHORIZED', message: 'connect first' });
    return;
  }
  if (frame.method === 'sessions.create') {
    const key = `agent:${frame.params.agentId}:${frame.params.key}`;
    sessions.set(key, { visibility: 'shared' });
    respond(socket, frame.id, true, { ok: true, key, sessionId: randomUUID() });
    return;
  }
  if (frame.method === 'session.visibility.set') {
    // The product requires the session owner or operator.admin (sessions-sharing-authority.ts).
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
    if (rank[frame.params.visibility] < rank[session.visibility]) advance(agentDb, frame.params.sessionKey);
    session.visibility = frame.params.visibility;
    respond(socket, frame.id, true, { ok: true, sessionKey: frame.params.sessionKey, visibility: frame.params.visibility });
    return;
  }
  if (frame.method === 'gateway.restart.request') {
    if (!connection.scopes.includes('operator.admin')) {
      respond(socket, frame.id, false, null, { code: 'FORBIDDEN', message: 'missing scope: operator.admin' });
      return;
    }
    if (process.env.RCC_SCRIPT_DROP_RESTART_RESPONSE === '1') {
      // The restart proceeds but its response never reaches the client.
      socket.destroy();
      setTimeout(restart, 80, frame.params.reason);
      return;
    }
    if (process.env.RCC_SCRIPT_REJECT_RESTART === '1') {
      respond(socket, frame.id, false, null, { code: 'UNAVAILABLE', message: 'restart refused by script' });
      return;
    }
    respond(socket, frame.id, true, {
      ok: true,
      status: 'scheduled',
      preflight: { safe: true, counts: { totalActive: 0 }, blockers: [], summary: 'safe to restart now' },
      restart: { ok: true, pid: process.pid, delayMs: 0, reason: frame.params.reason },
    });
    setTimeout(restart, 80, frame.params.reason);
    return;
  }
  respond(socket, frame.id, false, null, { code: 'INVALID_REQUEST', message: `unknown method ${frame.method}` });
}

server.on('upgrade', (request, socket) => {
  const accept = createHash('sha1')
    .update(`${request.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');
  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`,
    '\r\n',
  ].join('\r\n'));
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
      if (opcode === 0x9) {
        socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload]));
        continue;
      }
      if (opcode !== 0x1) continue;
      handle(socket, connection, JSON.parse(payload.toString('utf8')));
    }
  });
});

function restart(reason) {
  draining = true;
  process.stdout.write(`[gateway] restart requested (${reason}); draining\n`);
  setTimeout(() => {
    server.close();
    for (const socket of sockets) socket.destroy();
    server.closeAllConnections?.();
    if (process.env.RCC_SCRIPT_NO_HANDOFF !== '1') {
      const db = stateDatabase();
      const now = Date.now();
      db.prepare(`INSERT OR REPLACE INTO gateway_restart_handoff
        (handoff_key, kind, version, intent_id, pid, process_instance_id, created_at, expires_at, reason, source, restart_kind, supervisor_mode)
        VALUES ('current', 'gateway-supervisor-restart-handoff', 1, ?, ?, ?, ?, ?, ?, 'operator-restart', 'full-process', 'external')`)
        .run(randomUUID(), process.pid, randomUUID(), now, now + 60_000, reason);
      db.close();
    }
    agentDb.close();
    if (process.env.RCC_SCRIPT_ORPHAN === '1') {
      // Same process group and environment: a descendant the old generation leaves behind.
      spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' }).unref();
    }
    process.stdout.write('[gateway] restart mode: full process restart (supervisor restart)\n');
    process.exit(0);
  }, 150);
}

server.on('error', (error) => {
  process.stderr.write(`[gateway] failed to bind 127.0.0.1:${port}: ${error.code ?? error.message}\n`);
  process.exit(1);
});

setTimeout(() => {
  server.listen(port, '127.0.0.1', () => {
    process.stdout.write(`[gateway] ready (boot ${boot}, port ${port})\n`);
  });
}, Number(process.env.RCC_SCRIPT_BOOT_DELAY_MS ?? 150));

process.on('SIGTERM', () => {
  server.close();
  for (const socket of sockets) socket.destroy();
  process.exit(0);
});
