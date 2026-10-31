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
 *   (register-restart-handoff.ts:41-74);
 * - an unmanaged gateway (no OPENCLAW_SUPERVISOR_MODE, no systemd hints;
 *   process-respawn.ts:56-71): an update-process reason (update.run / update.auto,
 *   run-loop-request.ts:33-35) takes the spawned branch (run-loop.ts:459-495 via
 *   respawnGatewayProcessForUpdate, process-respawn.ts:282-307): close, spawn a detached child
 *   with inherited stdio and env, wait for it to become healthy (restart-health.ts: early
 *   "stopped-free" exit once the child is dead and the port free), and on an unhealthy child log
 *   the product's line, kill it, and reacquireAndResumeInProcessRestart (run-loop.ts:266-360):
 *   the named refusals, a child-runtime viability check (child-runtime-viability.ts:48-62), then
 *   an in-process restart under the same PID. Any other reason restarts in-process
 *   (run-loop.ts:572-580). Every listen retries EADDRINUSE (server/http-listen.ts:6-7, 62-72);
 *   a first boot that cannot bind exits 1, a restart iteration stays alive without serving
 *   (run-loop.ts:1238-1277).
 *
 * Behaviour switches (environment): RCC_SCRIPT_ADVANCE_ON_BOOT=<n> advances every authority
 * row when boot n starts (a product that clears the covenant on restart);
 * RCC_SCRIPT_NO_HANDOFF=1 exits without a handoff row; RCC_SCRIPT_REJECT_RESTART=1 rejects
 * the restart request; RCC_SCRIPT_NEVER_READY_ON_BOOT=<n> keeps boot n listening but 503;
 * RCC_SCRIPT_ORPHAN=1 leaves a descendant in its process group when it exits, =detached leaves
 * one in a new session (setsid);
 * RCC_SCRIPT_DROP_RESTART_RESPONSE=1 restarts without answering the request;
 * RCC_SCRIPT_BOOT_DELAY_MS delays each listen (RCC_SCRIPT_CHILD_BOOT_DELAY_MS a spawned child's);
 * RCC_SCRIPT_BIND_RETRIES / RCC_SCRIPT_BIND_RETRY_MS (default 10 x 50 ms; the product's is
 * 20 x 500 ms) set the EADDRINUSE retry, RCC_SCRIPT_READINESS_TIMEOUT_MS (default 4 s; the
 * product's is 60 s) the replacement readiness wait;
 * RCC_SCRIPT_FALLBACK_BLOCK=<require-fresh-process|foreground-closed|installation-replaced|
 * lock-reacquire-failed|resources-retained> makes the spawned fallback take that refusal with the
 * product's diagnostic and exit code; RCC_SCRIPT_IGNORE_UPDATE_REASON=1 restarts in-process even
 * for update.run. The consume command prints a log line before its JSON, as a product CLI may.
 */
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { accessSync, constants, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import http, { createServer } from 'node:http';
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
const externallySupervised = process.env.OPENCLAW_SUPERVISOR_MODE?.trim().toLowerCase() === 'external';
const fallbackBlock = process.env.RCC_SCRIPT_FALLBACK_BLOCK ?? '';
const sessions = new Map();
const agentDb = agentDatabase();
// Per boot (an in-process restart starts a new boot under the same PID, as the product's
// beginGatewayBootLifecycle does, run.ts:821-875).
let boot = 0;
let bootId = null;
let startedAt = 0;
let draining = false;
let server = null;

function nextBoot() {
  boot = (existsSync(bootsFile) ? Number(readFileSync(bootsFile, 'utf8')) : 0) + 1;
  writeFileSync(bootsFile, String(boot));
  bootId = randomUUID();
  startedAt = Date.now();
  draining = Number(process.env.RCC_SCRIPT_NEVER_READY_ON_BOOT) === boot;
  if (Number(process.env.RCC_SCRIPT_ADVANCE_ON_BOOT) === boot) {
    for (const { session_key: key } of agentDb.prepare('SELECT session_key FROM session_recipient_authority').all()) {
      advance(agentDb, key);
    }
    process.stdout.write(`[gateway] boot ${boot} advanced recipient authority\n`);
  }
}

function json(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(text) });
  res.end(text);
}

function probeHandler(req, res) {
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
}

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

function upgradeHandler(request, socket) {
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
}

function log(stream, line) {
  (stream === 'stderr' ? process.stderr : process.stdout).write(`[gateway] ${line}\n`);
}

function listenInodes() {
  const hexPort = port.toString(16).toUpperCase().padStart(4, '0');
  let found = false;
  for (const table of ['/proc/net/tcp', '/proc/net/tcp6']) {
    let text = '';
    try {
      text = readFileSync(table, 'utf8');
    } catch {
      continue;
    }
    for (const line of text.split('\n').slice(1)) {
      const fields = line.trim().split(/\s+/u);
      if (fields.length >= 10 && fields[3] === '0A' && fields[1].slice(fields[1].lastIndexOf(':') + 1).toUpperCase() === hexPort) found = true;
    }
  }
  return found;
}

function closeServer() {
  server?.close();
  for (const socket of sockets) socket.destroy();
  server?.closeAllConnections?.();
  server = null;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// http-listen.ts:6-7 and 62-72: retry EADDRINUSE, then fail with the product's message.
async function listenWithRetry() {
  const retries = Number(process.env.RCC_SCRIPT_BIND_RETRIES ?? 10);
  const intervalMs = Number(process.env.RCC_SCRIPT_BIND_RETRY_MS ?? 50);
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const candidate = createServer(probeHandler);
    candidate.on('upgrade', upgradeHandler);
    try {
      await new Promise((resolve, reject) => {
        candidate.once('error', reject);
        candidate.listen(port, '127.0.0.1', resolve);
      });
      server = candidate;
      return;
    } catch (error) {
      candidate.close();
      if (error.code === 'EADDRINUSE' && attempt < retries) {
        await sleep(intervalMs);
        continue;
      }
      throw new Error(error.code === 'EADDRINUSE'
        ? `another gateway instance is already listening on ws://127.0.0.1:${port}`
        : `failed to bind gateway socket on ws://127.0.0.1:${port}: ${error.message}`);
    }
  }
}

async function startBoot({ restartIteration }) {
  nextBoot();
  const delay = Number(process.env.RCC_SCRIPT_SPAWNED_CHILD === '1' && !restartIteration
    ? (process.env.RCC_SCRIPT_CHILD_BOOT_DELAY_MS ?? 300)
    : (process.env.RCC_SCRIPT_BOOT_DELAY_MS ?? 150));
  await sleep(delay);
  try {
    await listenWithRetry();
  } catch (error) {
    if (!restartIteration) {
      // A first boot that cannot bind is a startup failure; the CLI exits nonzero.
      log('stderr', `failed to start: ${error.message}`);
      process.exit(1);
    }
    // A restart iteration keeps the process and waits for a restart request (run-loop.ts:1263-1288).
    log('stderr', `restart startup failed: ${error.message}`);
    return;
  }
  log('stdout', `ready (boot ${boot}, port ${port})`);
}

function externalSupervisorRestart(reason) {
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
  if (process.env.RCC_SCRIPT_ORPHAN === '1' || process.env.RCC_SCRIPT_ORPHAN === 'detached') {
    // Same environment: a descendant the old generation leaves behind, in its process group
    // or (detached) in a session of its own.
    spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      stdio: 'ignore',
      detached: process.env.RCC_SCRIPT_ORPHAN === 'detached',
    }).unref();
  }
  log('stdout', 'restart mode: full process restart (supervisor restart)');
  process.exit(0);
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readyzOk() {
  return new Promise((resolve) => {
    const request = http.get({ host: '127.0.0.1', port, path: '/readyz', agent: false, timeout: 200 }, (response) => {
      let body = '';
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          resolve(response.statusCode === 200 && JSON.parse(body).ready === true);
        } catch {
          resolve(false);
        }
      });
    });
    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve(false));
  });
}

// update-successor.ts:65-122 over restart-health.ts:114-548, reduced: healthy when the child is
// alive and /readyz answers ready; "stopped-free" once the child is dead and the port free for
// consecutive polls; otherwise a timeout.
async function observeReadiness(child) {
  const pollMs = Number(process.env.RCC_SCRIPT_READINESS_POLL_MS ?? 50);
  const threshold = Number(process.env.RCC_SCRIPT_STOPPED_FREE_POLLS ?? 6);
  const deadline = Date.now() + Number(process.env.RCC_SCRIPT_READINESS_TIMEOUT_MS ?? 4000);
  let stoppedFree = 0;
  while (Date.now() < deadline) {
    const alive = child.pid !== undefined && child.exitCode === null && child.signalCode === null && pidAlive(child.pid);
    if (alive && await readyzOk()) return true;
    stoppedFree = !alive && !listenInodes() ? stoppedFree + 1 : 0;
    if (stoppedFree >= threshold) return false;
    await sleep(pollMs);
  }
  return false;
}

function childRuntimeAvailable() {
  try {
    accessSync(process.execPath, constants.X_OK);
    return true;
  } catch (error) {
    return !['ENOENT', 'ENOTDIR'].includes(error.code);
  }
}

// run-loop.ts:266-360, in the order the product checks.
async function reacquireAndResumeInProcessRestart() {
  if (fallbackBlock === 'resources-retained') {
    log('stderr', 'shutdown resources remain; refusing in-process restart and exiting');
    process.exit(0);
  }
  if (fallbackBlock === 'require-fresh-process') {
    log('stderr', 'Fresh-process restart failed; the unsettled native worker cannot recover in-process. Exiting through the verified service owner.');
    process.exit(1);
  }
  if (!childRuntimeAvailable()) {
    log('stderr', 'Fresh-process restart failed; the unavailable child runtime cannot recover in-process. Restart through the service owner after repairing its runtime.');
    process.exit(1);
  }
  if (fallbackBlock === 'foreground-closed') process.exit(1);
  if (fallbackBlock === 'installation-replaced') {
    log('stderr', 'Gateway installation was replaced on disk. Cannot continue in this process. Run: openclaw gateway run');
    process.exit(1);
  }
  if (fallbackBlock === 'lock-reacquire-failed') {
    log('stderr', 'failed to reacquire gateway lock for in-process restart: failed to acquire gateway state ownership');
    process.exit(1);
  }
  await startBoot({ restartIteration: true });
}

// run-loop.ts:459-495: respawnGatewayProcessForUpdate spawns a detached child with inherited
// stdio and env (process-respawn.ts:282-307); an unhealthy child is killed and the old process
// falls back.
async function spawnedRestart() {
  const child = spawn(process.execPath, [...process.execArgv, process.argv[1], ...process.argv.slice(2)], {
    env: { ...process.env, RCC_SCRIPT_SPAWNED_CHILD: '1' },
    detached: true,
    stdio: 'inherit',
  });
  child.on('error', () => {});
  child.unref();
  if (await observeReadiness(child)) {
    log('stdout', `restart mode: update process respawn (spawned pid ${child.pid ?? 'unknown'})`);
    process.exit(0);
  }
  const tail = fallbackBlock === 'foreground-closed'
    ? 'shutdown pending; retaining the replacement until it closes; inspect its startup logs'
    : fallbackBlock === 'installation-replaced'
      ? 'the replaced runtime cannot resume'
      : 'falling back to in-process restart';
  log('stderr', `update respawn child did not become healthy (${child.pid ?? 'unknown'}); ${tail}`);
  try {
    child.kill();
  } catch {
    // Already gone.
  }
  await reacquireAndResumeInProcessRestart();
}

function restart(reason) {
  draining = true;
  log('stdout', `restart requested (${reason}); draining`);
  setTimeout(() => {
    closeServer();
    if (externallySupervised) return externalSupervisorRestart(reason);
    const updateRestart = (reason === 'update.run' || reason === 'update.auto') && process.env.RCC_SCRIPT_IGNORE_UPDATE_REASON !== '1';
    if (updateRestart) return void spawnedRestart();
    log('stdout', 'restart mode: in-process restart (unmanaged: use in-process restart to keep custom supervisor PID tracking stable)');
    return void startBoot({ restartIteration: true });
  }, 150);
}

// A restart iteration that could not bind keeps the process alive, as the product does.
setInterval(() => {}, 60_000);
void startBoot({ restartIteration: false });

process.on('SIGTERM', () => {
  closeServer();
  process.exit(0);
});
