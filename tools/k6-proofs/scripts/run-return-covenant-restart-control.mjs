#!/usr/bin/env node
/**
 * run-return-covenant-restart-control.mjs — the disposable real-restart control for
 * R-CD-RETURN-COVENANT-AUTHORITY (🌊's F″ ruling, karmaterminal/openclaw-bootstrap#1727).
 *
 * The control owns the lifecycle of one disposable gateway that frond-scribe
 * scripts/proof-gw/composite-launcher.sh set up (and then stopped):
 *
 *   1. refuse anything that is not a proof-gw directory with a stopped unit, a free
 *      non-live loopback port and a stage built from the candidate;
 *   2. start the old generation with a cleared environment carrying exactly the case's
 *      supervisor hints (OPENCLAW_SUPERVISOR_MODE=external, or none), and wait for readiness;
 *   3. establish one return authority: sessions.create, then a narrowing
 *      session.visibility.set, which advances (creates) the session_recipient_authority epoch;
 *   4. sample the observation matrix (listener owner and its PID/start ticks, /readyz,
 *      /startupz, hello-ok, the generation observed serving, authority epoch) through a window
 *      planned before the transition;
 *   5. request a real restart (gateway.restart.request) and follow the branch the case drives:
 *      - supervised (positive, negative-replacement-never-usable; the row's claim): wait for the
 *        old generation to close and exit, consume the product's restart handoff, start the
 *        replacement, and verify it (owned listener, /readyz, /startupz, hello-ok with a new
 *        bootId);
 *      - spawned (control-update-respawn-fallback, control-update-respawn-runtime-unavailable;
 *        reason update.run, no supervisor; update-respawn controls, never row evidence): the
 *        product spawns and judges the child; the control follows that child through /proc,
 *        keeps the product's diagnostic lines, and waits for the original process to serve
 *        again or exit;
 *   6. clean up only processes it started or that carry its run marker (PID + start ticks +
 *      run marker), then grade, sign with a launcher-held observer key and write the public
 *      receipt.
 *
 * Every case but the positive refuses PASS by construction. negative-replacement-never-usable
 * (🌻's negative) holds the port with a control-owned socket before the control starts the
 * replacement (the supervised branch has no fallback). The update-respawn controls test the
 * update.run path, which 🌊's final scope ruling (Discord msg 1565927316687691777) keeps out of
 * the row's claim: control-update-respawn-fallback holds the port from the old listener's close
 * until the product-spawned child is gone, so the child can never serve, and the original process
 * must then reacquire and serve again (old-process restoration, never fresh-successor proof);
 * control-update-respawn-runtime-unavailable runs the old generation on a control-owned runtime
 * copy and removes it before the transition, so the product refuses the fallback for real.
 * `--grade-row` grades the row from the signed receipts of the two supervised cases only. The
 * product path and its F′ anchors are in scenarios/r-cd-return-covenant-authority.js.
 *
 * It never reads OPENCLAW_GATEWAY_TOKEN/WS from the environment, never runs systemctl except
 * the read-only `is-active` check, and never signals a process it did not start.
 */
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  createWriteStream,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { canonicalJson } from '../lib/canonical-json.mjs';
import {
  RCC_CASES,
  RCC_CASE_BRANCH,
  RCC_REFUSAL_SCHEMA,
  RCC_ROW,
  RCC_SCHEMA,
  RCC_SPAWN_DIAGNOSTICS,
  RCC_SUPERVISOR_HINT_KEYS,
  boundDiagnosticLine,
  boundedBody,
  evaluateDisposableTarget,
  gradeRestartControl,
  gradeReturnCovenantRow,
  isRestartDiagnostic,
  isSha40,
  observerKeyFingerprint,
  planObservationWindow,
  publicSafetyLeaks,
  redactDeep,
  redactText,
  sealObserverReceipt,
  servingGenerationOf,
  sha256,
  textCapture,
  verifyObserverReceipt,
} from '../lib/return-covenant-restart-control.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const CLIENT = Object.freeze({ id: 'cli', mode: 'cli', version: 'k6-proof-rcc-v1', platform: 'node' });
// --gateway-env is an allowlist: a denylist cannot fail closed (OPENCLAW_AGENT_DIR, for one,
// would point the credential store at the live agent). Allowed: the two settings the
// proof-gw unit itself passes, and the scripted test gateway's RCC_SCRIPT_* switches, which
// the product ignores.
const GATEWAY_ENV_ALLOWED = /^(?:NODE_OPTIONS|OPENCLAW_CODEX_APP_SERVER_BIN|RCC_SCRIPT_[A-Z0-9_]+)$/u;
const NODE_OPTIONS_ALLOWED = /^(?:--max-old-space-size=\d+|--inspect=127\.0\.0\.1:\d{4,5})$/u;
const STOP_GRACE_MS = 10_000;
const KILL_GRACE_MS = 5_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Live generations of the current run, so an interrupted CLI can still stop what it started.
const liveGenerations = new Set();

/* ------------------------------------------------------------------------------------ */
/* /proc observation (read-only)                                                        */
/* ------------------------------------------------------------------------------------ */

function listenInodes(port, procRoot = '/proc') {
  const inodes = new Set();
  const hexPort = port.toString(16).toUpperCase().padStart(4, '0');
  for (const table of ['net/tcp', 'net/tcp6']) {
    let text;
    try {
      text = readFileSync(path.join(procRoot, table), 'utf8');
    } catch {
      continue;
    }
    for (const line of text.split('\n').slice(1)) {
      const fields = line.trim().split(/\s+/u);
      if (fields.length < 10) continue;
      const local = fields[1];
      if (fields[3] === '0A' && local.slice(local.lastIndexOf(':') + 1).toUpperCase() === hexPort) {
        const inode = Number(fields[9]);
        if (Number.isSafeInteger(inode) && inode > 0) inodes.add(inode);
      }
    }
  }
  return [...inodes].sort((a, b) => a - b);
}

function socketInodesOf(pid, procRoot = '/proc') {
  const inodes = new Set();
  let entries = [];
  try {
    entries = readdirSync(path.join(procRoot, String(pid), 'fd'));
  } catch {
    return inodes;
  }
  for (const entry of entries) {
    try {
      const match = /^socket:\[(\d+)\]$/u.exec(readlinkSync(path.join(procRoot, String(pid), 'fd', entry)));
      if (match) inodes.add(Number(match[1]));
    } catch {
      // A descriptor closed between readdir and readlink.
    }
  }
  return inodes;
}

function procStat(pid, procRoot = '/proc') {
  try {
    const text = readFileSync(path.join(procRoot, String(pid), 'stat'), 'utf8');
    const fields = text.slice(text.lastIndexOf(')') + 2).split(' ');
    // Fields after the command: [0]=state (3), [1]=ppid (4), [2]=pgrp (5) ... [19]=starttime (22).
    return { state: fields[0], ppid: Number(fields[1]), pgrp: Number(fields[2]), startTicks: Number(fields[19]) };
  } catch {
    return null;
  }
}

function procEnvironHas(pid, entry, procRoot = '/proc') {
  try {
    return readFileSync(path.join(procRoot, String(pid), 'environ')).toString('utf8').split('\0').includes(entry);
  } catch {
    return false;
  }
}

/**
 * Which supervisor hints a running process carries, by key only (values never leave /proc).
 * null when the environ cannot be read.
 */
function supervisorHintsOf(pid, procRoot = '/proc') {
  try {
    const keys = new Set(readFileSync(path.join(procRoot, String(pid), 'environ')).toString('utf8').split('\0')
      .filter((entry) => entry.includes('=') && entry.slice(entry.indexOf('=') + 1).trim() !== '')
      .map((entry) => entry.slice(0, entry.indexOf('='))));
    return RCC_SUPERVISOR_HINT_KEYS.filter((key) => keys.has(key));
  } catch {
    return null;
  }
}

function childPidsOf(parent, procRoot = '/proc') {
  // /proc/<pid>/task/<tid>/children lists a process's children directly; scan every stat
  // only where the kernel does not expose it.
  try {
    const pids = new Set();
    for (const tid of readdirSync(path.join(procRoot, String(parent), 'task'))) {
      const text = readFileSync(path.join(procRoot, String(parent), 'task', tid, 'children'), 'utf8');
      for (const pid of text.trim().split(/\s+/u)) if (/^\d+$/u.test(pid)) pids.add(Number(pid));
    }
    return [...pids];
  } catch {
    return readdirSync(procRoot).filter((entry) => /^\d+$/u.test(entry) && procStat(Number(entry), procRoot)?.ppid === parent).map(Number);
  }
}

function procArgs(pid, procRoot = '/proc') {
  try {
    return readFileSync(path.join(procRoot, String(pid), 'cmdline')).toString('utf8').split('\0').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Live children of `parent` that carry this run's marker. The product's gateway also starts
 * helpers that inherit its environment (the codex app server, plugin workers), so each child
 * says whether its command line is the gateway invocation itself: a script inside the stage and
 * the `gateway` command. A stage file, not only dist/index.js, because the foreground gateway
 * may re-exec itself through its entry module (src/entry.compile-cache.ts:40-56).
 */
function markedChildrenOf(parent, marker, stageDir, procRoot = '/proc') {
  const found = [];
  for (const pid of childPidsOf(parent, procRoot)) {
    const stat = procStat(pid, procRoot);
    if (!stat || stat.ppid !== parent || stat.state === 'Z' || !procEnvironHas(pid, marker, procRoot)) continue;
    const args = procArgs(pid, procRoot);
    const inStage = args.some((arg) => arg.startsWith(`${stageDir}${path.sep}`));
    found.push({ pid, startTicks: stat.startTicks, ppid: stat.ppid, gateway: inStage && args.includes('gateway') });
  }
  return found;
}

/**
 * Every live process carrying this run's marker, wherever it is: a descendant that called
 * setsid leaves the generation's process group but keeps the environment. The marker is a
 * fresh 128-bit run id, so a match is a process this control started or its descendant.
 * Only same-user environ files are readable, and only those can be ours.
 */
function processesWithMarker(marker, procRoot = '/proc') {
  const found = [];
  for (const entry of readdirSync(procRoot)) {
    if (!/^\d+$/u.test(entry) || Number(entry) === process.pid) continue;
    const stat = procStat(Number(entry), procRoot);
    if (stat && stat.state !== 'Z' && procEnvironHas(Number(entry), marker, procRoot)) found.push(Number(entry));
  }
  return found;
}

/* ------------------------------------------------------------------------------------ */
/* Loopback probes                                                                       */
/* ------------------------------------------------------------------------------------ */

function httpProbe(port, pathname, timeoutMs) {
  return new Promise((resolve) => {
    const request = http.get({ host: '127.0.0.1', port, path: pathname, agent: false, timeout: timeoutMs, headers: { connection: 'close' } }, (response) => {
      const chunks = [];
      let size = 0;
      response.on('data', (chunk) => {
        size += chunk.length;
        if (size <= 65_536) chunks.push(chunk);
      });
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8'), error: null }));
      response.on('error', (error) => resolve({ status: null, body: null, error: error.code ?? 'response-error' }));
    });
    request.on('timeout', () => request.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })));
    request.on('error', (error) => resolve({ status: null, body: null, error: error.code ?? 'request-error' }));
  });
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * The product CLI writes machine JSON with JSON.stringify(value, null, 2), possibly after
 * log lines. Take the last block that starts with a bare `{` line and parses.
 */
function parseTrailingJson(text) {
  const whole = parseJson(text.trim());
  if (whole && typeof whole === 'object') return whole;
  const lines = text.split('\n');
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].trim() !== '{') continue;
    const parsed = parseJson(lines.slice(index).join('\n').trim());
    if (parsed && typeof parsed === 'object') return parsed;
  }
  return null;
}

/**
 * One authenticated gateway connection: wait for connect.challenge, connect as the local
 * CLI client with the given scopes, then run calls in order. Every response frame is kept
 * verbatim for the private record.
 */
function gatewayRpc({ port, token, scopes, calls, timeoutMs }) {
  return new Promise((resolve) => {
    const result = { hello: null, connectFrame: null, results: [], error: null };
    let socket;
    let settled = false;
    let index = -1;
    let pendingId = null;
    const connectId = `rcc-connect-${randomBytes(6).toString('hex')}`;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) result.error = error;
      try {
        socket?.close();
      } catch {
        // Closing a failed transport cannot change the recorded outcome.
      }
      resolve(result);
    };
    const timer = setTimeout(() => finish(index < 0 ? 'connect-timeout' : `call-timeout:${calls[index]?.method}`), timeoutMs);
    const next = () => {
      index += 1;
      if (index >= calls.length) return finish(null);
      pendingId = `rcc-${index}-${randomBytes(6).toString('hex')}`;
      socket.send(JSON.stringify({ type: 'req', id: pendingId, method: calls[index].method, params: calls[index].params ?? {} }));
    };
    try {
      socket = new WebSocket(`ws://127.0.0.1:${port}`);
    } catch {
      finish('connect-failed');
      return;
    }
    socket.onerror = () => finish(index < 0 ? 'connect-failed' : `transport-error:${calls[index]?.method}`);
    socket.onclose = () => finish(index < calls.length ? `closed-before-response:${calls[Math.max(index, 0)]?.method ?? 'connect'}` : null);
    socket.onmessage = (event) => {
      const frame = parseJson(String(event.data));
      if (!frame) return finish('frame-invalid');
      if (frame.type === 'event' && frame.event === 'connect.challenge' && index < 0 && !result.connectFrame) {
        result.connectFrame = 'sent';
        socket.send(JSON.stringify({
          type: 'req',
          id: connectId,
          method: 'connect',
          params: {
            minProtocol: 4,
            maxProtocol: 4,
            client: CLIENT,
            role: 'operator',
            scopes,
            caps: [],
            commands: [],
            permissions: {},
            auth: { token },
            userAgent: CLIENT.version,
          },
        }));
        return;
      }
      if (frame.type !== 'res') return;
      if (frame.id === connectId) {
        if (frame.ok !== true || frame.payload?.type !== 'hello-ok') {
          result.connectFrame = frame;
          return finish('connect-rejected');
        }
        result.hello = frame.payload;
        return next();
      }
      if (frame.id === pendingId) {
        result.results.push({ method: calls[index].method, frame });
        return next();
      }
    };
  });
}

function readAuthority(databasePath, keys) {
  if (!existsSync(databasePath)) return { state: 'missing', reason: 'no-database' };
  let database;
  try {
    database = new DatabaseSync(databasePath, { readOnly: true, timeout: 1000 });
    const statement = database.prepare('SELECT epoch FROM session_recipient_authority WHERE session_key = ?');
    for (const key of keys) {
      const row = statement.get(key);
      if (row && typeof row.epoch === 'string') return { state: 'present', epoch: row.epoch, key };
    }
    return { state: 'missing', reason: 'no-row' };
  } catch (error) {
    return { state: 'unreadable', reason: String(error?.code ?? error?.message ?? 'error').slice(0, 80) };
  } finally {
    try {
      database?.close();
    } catch {
      // A failed open has nothing to close.
    }
  }
}

/* ------------------------------------------------------------------------------------ */
/* Platform (injectable for tests)                                                      */
/* ------------------------------------------------------------------------------------ */

export function defaultPlatform() {
  return {
    spawnGateway: ({ node, args, env, cwd }) => spawn(node, args, { env, cwd, stdio: ['ignore', 'pipe', 'pipe'], detached: true }),
    runCli: ({ node, args, env, cwd, timeoutMs }) => new Promise((resolve) => {
      const child = spawn(node, args, { env, cwd, stdio: ['ignore', 'pipe', 'pipe'] });
      const stdout = [];
      const stderr = [];
      const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
      child.stdout.on('data', (chunk) => stdout.push(chunk));
      child.stderr.on('data', (chunk) => stderr.push(chunk));
      child.on('error', (error) => {
        clearTimeout(timer);
        resolve({ code: null, signal: null, stdout: Buffer.concat(stdout), stderr: Buffer.from(String(error.message)) });
      });
      child.on('close', (code, signal) => {
        clearTimeout(timer);
        resolve({ code, signal, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) });
      });
    }),
    unitState: (unit) => {
      const result = spawnSync('systemctl', ['--user', 'is-active', unit], { encoding: 'utf8', timeout: 5000 });
      return result.error ? 'unknown' : (result.stdout.trim() || 'unknown');
    },
    docsIdentity: (root) => {
      const git = (...args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', timeout: 10_000 });
      const head = git('rev-parse', 'HEAD');
      const tracked = git('status', '--porcelain', '--untracked-files=no');
      const harness = git('status', '--porcelain', '--', 'tools/k6-proofs');
      return {
        sha: head.status === 0 ? head.stdout.trim() : null,
        clean: tracked.status === 0 && harness.status === 0 && !tracked.stdout.trim() && !harness.stdout.trim(),
      };
    },
    portListening: (port) => listenInodes(port).length > 0,
    now: () => Date.now(),
  };
}

/* ------------------------------------------------------------------------------------ */
/* Arguments                                                                             */
/* ------------------------------------------------------------------------------------ */

const PLAN_FLAGS = {
  '--sample-interval-ms': 'sampleIntervalMs',
  '--pre-trigger-samples': 'preTriggerSamples',
  '--boot-timeout-ms': 'bootTimeoutMs',
  '--transition-deadline-ms': 'transitionDeadlineMs',
  '--readiness-deadline-ms': 'readinessDeadlineMs',
  '--observation-window-ms': 'observationWindowMs',
};

export function parseArgs(argv) {
  const options = { plan: {}, gatewayEnv: {} };
  const value = (index) => {
    if (index + 1 >= argv.length) throw new Error(`${argv[index]} needs a value`);
    return argv[index + 1];
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--help' || flag === '-h') {
      options.help = true;
      continue;
    }
    if (flag in PLAN_FLAGS) {
      options.plan[PLAN_FLAGS[flag]] = Number(value(index));
      index += 1;
      continue;
    }
    const simple = {
      '--proof-gw-dir': 'proofGwDir',
      '--stage-dir': 'stageDir',
      '--candidate-sha': 'candidateSha',
      '--docs-sha': 'docsSha',
      '--case': 'caseKind',
      '--artifact-dir': 'artifactDir',
      '--observer-key-file': 'observerKeyFile',
      '--node': 'node',
      '--agent-id': 'agentId',
      '--verify': 'verify',
    }[flag];
    if (flag === '--grade-row') {
      (options.gradeRow ??= []).push(value(index));
      index += 1;
      continue;
    }
    if (simple) {
      options[simple] = value(index);
      index += 1;
      continue;
    }
    if (flag === '--gateway-env') {
      const entry = value(index);
      const separator = entry.indexOf('=');
      if (separator <= 0) throw new Error('--gateway-env takes KEY=VALUE');
      options.gatewayEnv[entry.slice(0, separator)] = entry.slice(separator + 1);
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${flag}`);
  }
  return options;
}

const USAGE = `Usage:
  node tools/k6-proofs/scripts/run-return-covenant-restart-control.mjs \\
    --proof-gw-dir ~/proof-gw/comp-<sha8> --stage-dir <stage-only build dir> \\
    --candidate-sha <40-hex> --docs-sha <40-hex> \\
    --case positive|negative-replacement-never-usable|control-update-respawn-fallback|control-update-respawn-runtime-unavailable \\
    --artifact-dir <new public dir> --observer-key-file <0600 key file> \\
    [--sample-interval-ms 500] [--observation-window-ms 90000] [--readiness-deadline-ms 60000] \\
    [--transition-deadline-ms 45000] [--boot-timeout-ms 120000] [--pre-trigger-samples 4] \\
    [--agent-id main] [--node <node>] [--gateway-env KEY=VALUE]...
  node tools/k6-proofs/scripts/run-return-covenant-restart-control.mjs \\
    --verify <observer-receipt.json> --observer-key-file <key file>
  node tools/k6-proofs/scripts/run-return-covenant-restart-control.mjs \\
    --grade-row <observer-receipt.json> [--grade-row <observer-receipt.json>]... --observer-key-file <key file>

The row verdict is graded from the positive and negative-replacement-never-usable receipts only;
update-respawn control receipts are reported beside it and never feed it. --grade-row counts only
receipts whose observer signature verifies and exits 1 when any receipt did not verify.`;

/* ------------------------------------------------------------------------------------ */
/* Control                                                                               */
/* ------------------------------------------------------------------------------------ */

function readObserverKey(file, proofGwDir, refuse) {
  if (!file) return null;
  try {
    const stat = lstatSync(file);
    if (!stat.isFile()) throw new Error('not a regular file');
    if ((stat.mode & 0o077) !== 0) {
      refuse('observer-key-mode', 'the observer key file must be mode 0600');
      return null;
    }
    const resolved = realpathSync(file);
    if (proofGwDir && (resolved === proofGwDir || resolved.startsWith(`${proofGwDir}${path.sep}`))) {
      refuse('observer-key-in-target', 'the observer key must not live inside the gateway-under-test directory');
      return null;
    }
    const key = readFileSync(resolved, 'utf8').trim();
    if (key.length < 32) {
      refuse('observer-key-short', 'the observer key must be at least 32 characters');
      return null;
    }
    return key;
  } catch {
    refuse('observer-key-unreadable', 'the observer key file cannot be read');
    return null;
  }
}

function writeJson(file, value, mode = 0o644) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode });
}

function refusalResult({ artifactDir, refusals, options, candidateSha }) {
  const refusal = {
    schema: RCC_REFUSAL_SCHEMA,
    row: RCC_ROW,
    case: options.caseKind ?? null,
    candidateSha: isSha40(candidateSha) ? candidateSha : null,
    refusedAt: new Date().toISOString(),
    processesStarted: 0,
    refusals: refusals.map(({ code, detail }) => ({ code, detail })),
  };
  // Never create anything inside a directory the guard refused to write to.
  const unwritable = refusals.some((entry) => entry.code === 'artifact-dir-in-target' || entry.code === 'artifact-dir-in-repo');
  if (artifactDir && !unwritable) {
    mkdirSync(artifactDir, { recursive: true });
    writeJson(path.join(artifactDir, 'refusal.json'), refusal);
  }
  return { status: 'refused', refusals: refusal.refusals, refusal, refusalWritten: Boolean(artifactDir && !unwritable) };
}

/** Run one control case. Returns { status, record, grade, receipt } or a refusal. */
export async function runRestartControl(options, overrides = {}) {
  const platform = { ...defaultPlatform(), ...overrides };
  const home = options.home ?? os.homedir();
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const refusals = [];
  const refuse = (code, detail) => refusals.push({ code, detail });
  const artifactDir = options.artifactDir ? path.resolve(options.artifactDir) : null;
  const caseKind = options.caseKind ?? 'positive';
  const agentId = options.agentId ?? 'main';

  if (!artifactDir) refuse('artifact-dir-missing', '--artifact-dir is required');
  if (!RCC_CASES.includes(caseKind)) refuse('case-unknown', `--case must be one of ${RCC_CASES.join(', ')}`);
  if (!isSha40(options.docsSha)) refuse('docs-sha-invalid', '--docs-sha must be 40 lowercase hex');
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/u.test(agentId)) refuse('agent-id-invalid', '--agent-id must be a plain agent id');
  for (const [key, value] of Object.entries(options.gatewayEnv ?? {})) {
    if (!GATEWAY_ENV_ALLOWED.test(key)) {
      refuse('gateway-env-not-allowed', `--gateway-env may set only NODE_OPTIONS or OPENCLAW_CODEX_APP_SERVER_BIN, not ${key}`);
    } else if (key === 'NODE_OPTIONS' && !String(value).trim().split(/\s+/u).every((part) => NODE_OPTIONS_ALLOWED.test(part))) {
      refuse('gateway-env-not-allowed', 'NODE_OPTIONS may carry only --max-old-space-size=<n> and --inspect=127.0.0.1:<port>');
    } else if (key === 'OPENCLAW_CODEX_APP_SERVER_BIN' && !path.isAbsolute(String(value))) {
      refuse('gateway-env-not-allowed', 'OPENCLAW_CODEX_APP_SERVER_BIN must be an absolute path');
    }
  }
  let plan;
  try {
    plan = planObservationWindow(options.plan ?? {}, caseKind);
  } catch (error) {
    refuse('plan-invalid', error.message);
  }

  const evaluation = evaluateDisposableTarget({
    proofGwDir: options.proofGwDir ? path.resolve(options.proofGwDir) : options.proofGwDir,
    stageDir: options.stageDir ? path.resolve(options.stageDir) : options.stageDir,
    candidateSha: options.candidateSha,
    home,
    fsApi: { existsSync, readFileSync, realpathSync, lstatSync },
    pathApi: path,
    portListening: platform.portListening,
    unitState: platform.unitState,
  });
  refusals.push(...evaluation.refusals);
  const target = evaluation.target;

  const docs = platform.docsIdentity(repoRoot);
  if (isSha40(options.docsSha) && docs.sha !== options.docsSha) {
    refuse('docs-sha-mismatch', 'the docs SHA is not the harness checkout executing this control');
  }
  if (artifactDir) {
    const inside = (dir) => artifactDir === dir || artifactDir.startsWith(`${dir}${path.sep}`);
    for (const forbidden of [target.proofGwDir, path.join(home, '.openclaw')].filter(Boolean)) {
      if (inside(forbidden)) {
        refuse('artifact-dir-in-target', 'the artifact directory must live outside the gateway-under-test and the live state');
      }
    }
    // The private sibling keeps raw logs; it must never land in a repository tree.
    if (inside(path.resolve(repoRoot))) {
      refuse('artifact-dir-in-repo', 'write receipts outside the docs repository (for example ~/proof-runs/...); publishing is a separate reviewed step');
    }
    if (existsSync(path.join(artifactDir, 'observer-receipt.json')) || existsSync(`${artifactDir}.private`)) {
      refuse('artifact-dir-used', 'the artifact directory already holds a control run; use a new one');
    }
  }
  const observerKey = readObserverKey(options.observerKeyFile, target.proofGwDir, refuse);

  if (refusals.length) return refusalResult({ artifactDir, refusals, options, candidateSha: options.candidateSha });

  return await executeControl({ options, platform, plan, target, docs, home, artifactDir, caseKind, agentId, observerKey });
}

async function executeControl({ options, platform, plan, target, docs, home, artifactDir, caseKind, agentId, observerKey }) {
  const now = platform.now;
  const node = options.node ?? process.execPath;
  const entry = path.join(target.stageDir, 'dist', 'index.js');
  const privateDir = `${artifactDir}.private`;
  mkdirSync(artifactDir, { recursive: true });
  mkdirSync(privateDir, { recursive: true, mode: 0o700 });
  chmodSync(privateDir, 0o700);
  // control-update-respawn-runtime-unavailable runs the old generation on a runtime copy the
  // control owns, inside its private directory, and removes that copy before the transition, so
  // the product's child-runtime viability check fails for real
  // (src/infra/child-runtime-viability.ts:48-62).
  const runtimeCopy = caseKind === 'control-update-respawn-runtime-unavailable' ? path.join(privateDir, 'runtime', 'node') : null;
  const removeRuntimeCopy = () => {
    if (runtimeCopy && existsSync(runtimeCopy)) unlinkSync(runtimeCopy);
  };

  const runId = `rcc-${randomBytes(16).toString('hex')}`;
  const sessionSlug = `rcc-${runId.slice(4, 16)}`;
  const agentDatabase = path.join(target.stateDir, 'agents', agentId, 'agent', 'openclaw-agent.sqlite');
  const secrets = [
    { value: target.proofGwDir, label: '<proof-gw-dir>' },
    { value: target.stageDir, label: '<stage-dir>' },
    { value: home, label: '~' },
    { value: target.token, label: '<gateway-token>' },
    { value: observerKey, label: '<observer-key>' },
  ];
  const addSecret = (value, label) => {
    if (typeof value === 'string' && value.length >= 4) secrets.push({ value, label });
    secrets.sort((a, b) => String(b.value ?? '').length - String(a.value ?? '').length);
  };
  secrets.sort((a, b) => String(b.value ?? '').length - String(a.value ?? '').length);
  const redact = (text) => redactText(text, secrets);

  // A cleared environment: the supervisor hints are exactly what the case's branch needs. The
  // supervised cases declare the external supervisor; the update-respawn controls carry no hint
  // at all (no OPENCLAW_SUPERVISOR_MODE, no OPENCLAW_SYSTEMD_UNIT, no systemd invocation
  // variables), so F′ resolves the unmanaged decision (src/infra/process-respawn.ts:56-71).
  const branch = RCC_CASE_BRANCH[caseKind];
  const childEnv = {
    HOME: home,
    PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
    TZ: process.env.TZ ?? 'UTC',
    LANG: process.env.LANG ?? 'C.UTF-8',
    NO_COLOR: '1',
    ...(options.gatewayEnv ?? {}),
    OPENCLAW_STATE_DIR: target.stateDir,
    OPENCLAW_CONFIG_PATH: target.configPath,
    OPENCLAW_GATEWAY_PORT: String(target.port),
    ...(branch.supervisorMode === 'external' ? { OPENCLAW_SUPERVISOR_MODE: 'external' } : {}),
    OPENCLAW_PROOF_RCC_RUN: runId,
  };

  const record = {
    schema: RCC_SCHEMA,
    row: RCC_ROW,
    runId,
    case: caseKind,
    // row-positive and row-negative feed the row verdict; an update-respawn-control never does.
    kind: branch.kind,
    candidateSha: options.candidateSha,
    docsSha: options.docsSha,
    docs: { sha: docs.sha, clean: docs.clean === true },
    startedAt: new Date(now()).toISOString(),
    target: {
      port: target.port,
      unit: target.unit,
      unitState: target.unitState,
      proofGwDirName: path.basename(target.proofGwDir),
      identity: target.identity,
      stageBuild: target.stageBuild,
      livePortsRefused: target.livePorts,
      supervisorMode: branch.supervisorMode ?? 'unmanaged',
      restartBranch: branch.branch,
      restartReason: branch.restartReason,
      supervisorHintKeys: [...RCC_SUPERVISOR_HINT_KEYS],
      guard: 'passed',
    },
    plan,
    authority: { established: false, agentId },
    generations: { old: { started: false }, replacement: { started: false } },
    transition: { httpBodies: {} },
    observation: { samples: [] },
    cleanup: { completed: false },
    observerKey: { available: Boolean(observerKey), algorithmFingerprint: observerKey ? observerKeyFingerprint(observerKey) : null },
    errors: [],
  };
  // The spawned branch's own record: the product-spawned child, the port the control holds,
  // the control-owned runtime copy, and the product's diagnostic lines.
  const fallback = branch.branch === 'spawned'
    ? {
        outputChannel: 'inherited-by-old-generation',
        oldListenerClosedAtMs: null,
        child: { pid: null, pidSource: null, invocation: null, reportedPid: null, ppid: null, startTicks: null, firstSeenAtMs: null, goneAtMs: null },
        blocker: null,
        runtime: null,
        diagnostics: [],
      }
    : null;
  record.fallback = fallback;

  const generations = {};
  const state = { triggerAtMs: null, replacementReadyAt: null, stopSampling: false, lastPreTrigger: null, rawEpoch: null, preTriggerChildren: new Set(), pendingChild: null };
  // The control-held port (the supervised negative's and the fallback control's "replacement never
  // usable"), opened and closed only here.
  const held = { server: null, open: false, used: false };
  const holdPort = async () => {
    const server = net.createServer((socket) => socket.destroy());
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(target.port, '127.0.0.1', resolve);
    });
    Object.assign(held, { server, open: true, used: true });
  };
  const releasePort = async () => {
    if (!held.open) return false;
    held.open = false;
    await new Promise((resolve) => held.server.close(() => resolve()));
    return true;
  };
  let sampler = null;

  const startGeneration = (name, runtime = node) => {
    const logs = {
      stdout: createWriteStream(path.join(privateDir, `${name}.stdout.log`), { mode: 0o600 }),
      stderr: createWriteStream(path.join(privateDir, `${name}.stderr.log`), { mode: 0o600 }),
    };
    const generation = { name, stdout: [], stderr: [], exited: false, exit: null, exitedAtMs: null, logs, diagnostics: [], partial: { stdout: '', stderr: '' } };
    // Keep every restart diagnostic line as it arrives: a later log flood cannot push it out
    // of the public tail, and the spawned flow reads the child's PID from it.
    generation.scan = (stream, chunk, flush = false) => {
      const lines = `${generation.partial[stream]}${chunk}`.split('\n');
      generation.partial[stream] = flush ? '' : lines.pop().slice(-8192);
      for (const line of lines) {
        if (isRestartDiagnostic(line)) generation.diagnostics.push({ stream, atMs: now(), line: boundDiagnosticLine(line) });
      }
    };
    let child;
    try {
      child = platform.spawnGateway({ node: runtime, args: [entry, 'gateway', '--port', String(target.port)], env: childEnv, cwd: target.proofGwDir });
    } catch (error) {
      logs.stdout.end();
      logs.stderr.end();
      record.generations[name] = { started: false, failure: { kind: 'spawn-failed', message: redact(error.message) } };
      throw error;
    }
    generation.child = child;
    generation.pid = child.pid;
    generation.spawnedAtMs = now();
    child.stdout?.on('data', (chunk) => {
      generation.stdout.push(chunk);
      logs.stdout.write(chunk);
      generation.scan('stdout', chunk.toString('utf8'));
    });
    child.stderr?.on('data', (chunk) => {
      generation.stderr.push(chunk);
      logs.stderr.write(chunk);
      generation.scan('stderr', chunk.toString('utf8'));
    });
    generation.closed = new Promise((resolve) => {
      child.on('error', (error) => {
        generation.stderr.push(Buffer.from(`spawn error: ${error.message}\n`));
        generation.exited = true;
        generation.exitedAtMs = now();
        generation.exit = { code: null, signal: null, error: error.code ?? 'spawn-error' };
        resolve();
      });
      child.on('exit', (code, signal) => {
        generation.exited = true;
        generation.exitedAtMs = now();
        generation.exit = { code, signal };
      });
      child.on('close', () => resolve());
    });
    const stat = procStat(child.pid);
    generation.startTicks = stat?.startTicks ?? null;
    generation.runId = runId;
    liveGenerations.add(generation);
    generation.closed.then(() => liveGenerations.delete(generation));
    generations[name] = generation;
    record.generations[name] = { started: true, pid: child.pid ?? null, startTicks: generation.startTicks, spawnedAtMs: generation.spawnedAtMs };
    return generation;
  };

  const owners = () => {
    const map = new Map();
    for (const name of ['old', 'replacement']) {
      const generation = generations[name];
      if (generation && !generation.exited) for (const inode of socketInodesOf(generation.pid)) map.set(inode, { name, pid: generation.pid });
    }
    // The product-spawned child (spawned branch) is the replacement, though the control did
    // not start it.
    const productChild = fallback?.child;
    if (productChild?.pid && productChild.goneAtMs === null) {
      for (const inode of socketInodesOf(productChild.pid)) if (!map.has(inode)) map.set(inode, { name: 'replacement', pid: productChild.pid });
    }
    for (const inode of socketInodesOf(process.pid)) if (!map.has(inode)) map.set(inode, { name: 'control-blocker', pid: process.pid });
    return map;
  };

  // The listener's owner by process: the owning PID and its current kernel start ticks, so a
  // serving sample is tied to one exact process, not merely to a port.
  const listenerFor = () => {
    const inodes = listenInodes(target.port);
    if (inodes.length === 0) return { owner: null, inode: null, inodes, ownerPid: null, ownerStartTicks: null };
    const owned = owners();
    for (const preferred of ['replacement', 'old', 'control-blocker']) {
      const inode = inodes.find((candidate) => owned.get(candidate)?.name === preferred);
      if (inode) {
        const { pid } = owned.get(inode);
        return { owner: preferred, inode, inodes, ownerPid: pid, ownerStartTicks: procStat(pid)?.startTicks ?? null };
      }
    }
    return { owner: 'foreign', inode: inodes[0], inodes, ownerPid: null, ownerStartTicks: null };
  };

  const probeBodies = async () => {
    const [readyz, startupz] = await Promise.all([
      httpProbe(target.port, '/readyz', plan.probeTimeoutMs),
      httpProbe(target.port, '/startupz', plan.probeTimeoutMs),
    ]);
    return { readyz, startupz };
  };

  const projectProbe = (probe, kind) => {
    const parsed = parseJson(probe.body ?? '');
    return {
      status: probe.status,
      [kind === 'readyz' ? 'ready' : 'startup']: kind === 'readyz' ? parsed?.ready === true : (parsed?.status ?? null),
      bodySha256: probe.body === null ? null : sha256(probe.body),
      error: probe.error,
    };
  };

  const edge = (atMs, bodies) => ({
    atMs,
    readyz: { status: bodies.readyz.status, body: bodies.readyz.body === null ? null : boundedBody(bodies.readyz.body, secrets), error: bodies.readyz.error },
    startupz: { status: bodies.startupz.status, body: bodies.startupz.body === null ? null : boundedBody(bodies.startupz.body, secrets), error: bodies.startupz.error },
  });

  // hello-ok is the third leg of "serving"; it is only attempted when the first two hold, so an
  // outage costs no handshakes.
  const helloProbe = async (listener, readyz) => {
    if (!['old', 'replacement'].includes(listener.owner) || readyz.status !== 200 || readyz.ready !== true) return null;
    const rpc = await gatewayRpc({ port: target.port, token: target.token, scopes: ['operator.read'], calls: [], timeoutMs: plan.helloTimeoutMs });
    const bootId = rpc.hello?.server?.bootId;
    return typeof bootId === 'string'
      ? { ok: true, bootIdSha256: sha256(bootId), error: null }
      : { ok: false, bootIdSha256: null, error: rpc.error ?? 'hello-missing-boot-id' };
  };

  const takeSample = async () => {
    const atMs = now();
    const triggered = state.triggerAtMs !== null && atMs >= state.triggerAtMs;
    const listener = listenerFor();
    const bodies = await probeBodies();
    const readyz = projectProbe(bodies.readyz, 'readyz');
    const hello = await helloProbe(listener, readyz);
    const authority = readAuthority(agentDatabase, [state.authorityKey]);
    const sample = {
      atMs,
      phase: null,
      oldAlive: Boolean(generations.old && !generations.old.exited),
      replacementAlive: fallback
        ? fallback.child.pid !== null && fallback.child.goneAtMs === null
        : Boolean(generations.replacement && !generations.replacement.exited),
      listener,
      readyz,
      startupz: projectProbe(bodies.startupz, 'startupz'),
      hello,
      servingGeneration: null,
      authority: authority.state === 'present'
        ? { state: 'present', epochSha256: sha256(authority.epoch) }
        : { state: authority.state, reason: authority.reason },
    };
    // Observed, not assigned: the generation serving is whichever owns the listener while
    // /readyz passes and hello-ok answers. The phase only names what the sample saw.
    sample.servingGeneration = servingGenerationOf(sample);
    sample.phase = !triggered ? 'pre-trigger' : sample.servingGeneration ? `${sample.servingGeneration}-serving` : 'outage';
    record.observation.samples.push(sample);
    const readyNow = readyz.status === 200 && readyz.ready === true;
    if (!triggered) {
      state.lastPreTrigger = edge(atMs, bodies);
    } else if (!readyNow) {
      const notReady = edge(atMs, bodies);
      record.transition.httpBodies.firstPostTriggerNotReady ??= notReady;
      if (state.replacementReadyAt === null) record.transition.httpBodies.lastObservedNotReady = notReady;
    }
  };

  const runSampler = async () => {
    while (!state.stopSampling) {
      const started = now();
      try {
        await takeSample();
      } catch (error) {
        record.errors.push({ at: 'sample', message: redact(error.message) });
      }
      const wait = plan.sampleIntervalMs - (now() - started);
      if (wait > 0) await sleep(wait);
    }
  };

  /** Verify a generation is usable: it owns the listener, both probes pass, hello-ok answers. */
  const verifyReady = async (generation) => {
    if (generation.exited) return null;
    const owned = socketInodesOf(generation.pid);
    const inode = listenInodes(target.port).find((candidate) => owned.has(candidate));
    if (!inode) return null;
    const bodies = await probeBodies();
    generation.lastProbe = edge(now(), bodies);
    const ready = parseJson(bodies.readyz.body ?? '');
    const startup = parseJson(bodies.startupz.body ?? '');
    if (bodies.readyz.status !== 200 || ready?.ready !== true || bodies.startupz.status !== 200 || startup?.status !== 'started') return null;
    const rpc = await gatewayRpc({ port: target.port, token: target.token, scopes: ['operator.read'], calls: [], timeoutMs: Math.max(2000, plan.probeTimeoutMs * 4) });
    if (!rpc.hello || typeof rpc.hello.server?.bootId !== 'string') return null;
    if (generation.exited || !socketInodesOf(generation.pid).has(inode)) return null;
    return {
      atMs: now(),
      inode,
      bootIdSha256: sha256(rpc.hello.server.bootId),
      buildId: typeof rpc.hello.server.buildId === 'string' ? rpc.hello.server.buildId : (startup?.buildId ?? null),
      startupBuildId: startup?.buildId ?? null,
      bodies,
    };
  };

  const waitUntil = async (predicate, deadlineAtMs, stepMs) => {
    while (now() < deadlineAtMs) {
      const value = await predicate();
      if (value) return value;
      await sleep(stepMs);
    }
    return null;
  };

  /**
   * Track the child the product spawned (spawned branch): first from /proc, as a marked child of
   * the old generation, else from the product's own "did not become healthy (<pid>)" line, which
   * also names a child that never had a PID ("unknown").
   */
  const marker = `OPENCLAW_PROOF_RCC_RUN=${runId}`;
  const followChild = (old) => {
    const child = fallback.child;
    if (child.pid === null && child.reportedPid === null && !old.exited) {
      // A new child since the trigger, whose command line is the gateway invocation, seen on two
      // polls: between fork and exec a helper still shows its parent's command line.
      const found = markedChildrenOf(old.pid, marker, target.stageDir)
        .find((candidate) => candidate.gateway && !state.preTriggerChildren.has(candidate.pid));
      const pending = state.pendingChild;
      if (!found) {
        state.pendingChild = null;
      } else if (pending && pending.pid === found.pid && pending.startTicks === found.startTicks && now() > pending.seenAtMs) {
        Object.assign(child, { pid: found.pid, pidSource: 'proc', invocation: 'gateway', ppid: found.ppid, startTicks: found.startTicks, firstSeenAtMs: pending.seenAtMs });
        state.pendingChild = null;
      } else if (!pending || pending.pid !== found.pid || pending.startTicks !== found.startTicks) {
        state.pendingChild = { pid: found.pid, startTicks: found.startTicks, seenAtMs: now() };
      }
    }
    if (child.reportedPid === null) {
      const named = old.diagnostics.find((line) => RCC_SPAWN_DIAGNOSTICS.unhealthy.test(line.line));
      if (named) {
        child.reportedPid = RCC_SPAWN_DIAGNOSTICS.unhealthy.exec(named.line)[1];
        // The product's own word on which child it judged overrides anything inferred.
        if (/^\d+$/u.test(child.reportedPid) && child.pid !== Number(child.reportedPid)) {
          // Alive only while that PID is still a marked child of the old generation.
          const pid = Number(child.reportedPid);
          const stat = procStat(pid);
          const ours = Boolean(stat && stat.state !== 'Z' && stat.ppid === old.pid && procEnvironHas(pid, marker));
          Object.assign(child, {
            pid,
            pidSource: 'diagnostic',
            invocation: 'named-by-product',
            ppid: old.pid,
            startTicks: ours ? stat.startTicks : null,
            goneAtMs: ours ? null : now(),
          });
        }
      }
    }
    if (child.pid !== null && child.goneAtMs === null) {
      const stat = procStat(child.pid);
      if (!stat || stat.state === 'Z' || (child.startTicks !== null && stat.startTicks !== child.startTicks)) child.goneAtMs = now();
    }
  };

  /**
   * The spawned branch after an accepted restart. The old server closes first (no listener on
   * the port); control-update-respawn-fallback then holds the port so the product's child can
   * never serve, and releases it only once that child is gone: a dead child cannot become healthy,
   * and the product's own listen retry (src/gateway/server/http-listen.ts:6-7) would otherwise
   * let a live one bind. Then it waits for the original process to serve again or to exit.
   */
  const spawnedTransition = async (old) => {
    const child = fallback.child;
    const transitionDeadline = state.triggerAtMs + plan.transitionDeadlineMs;
    const deadline = state.triggerAtMs + plan.readinessDeadlineMs;
    const step = Math.min(20, plan.sampleIntervalMs);
    const closed = await waitUntil(() => old.exited || listenInodes(target.port).length === 0, transitionDeadline, 10);
    if (!closed) return;
    fallback.oldListenerClosedAtMs = now();
    if (caseKind === 'control-update-respawn-fallback' && !old.exited) {
      try {
        await holdPort();
        fallback.blocker = { bound: true, boundAtMs: now(), releasedAtMs: null, releasedOn: null };
      } catch (error) {
        fallback.blocker = { bound: false, error: String(error?.code ?? error?.message ?? 'listen-failed') };
      }
    }
    const release = async (reason) => {
      if (await releasePort()) Object.assign(fallback.blocker, { releasedAtMs: now(), releasedOn: reason });
    };
    while (now() < deadline) {
      followChild(old);
      if (old.exited) {
        await release('old-exited');
        break;
      }
      if (held.open) {
        const childKnown = child.pid !== null || child.reportedPid !== null;
        const childGone = child.goneAtMs !== null || (child.pid === null && child.reportedPid === 'unknown');
        if (childKnown ? childGone : now() >= transitionDeadline) await release(childKnown ? 'replacement-exited' : 'no-replacement-observed');
      } else {
        const ready = await verifyReady(old);
        if (ready) {
          record.generations.old.restored = {
            atMs: ready.atMs,
            listen: { port: target.port, inode: ready.inode },
            bootIdSha256: ready.bootIdSha256,
            buildId: ready.buildId,
            sameProcess: !old.exited && procStat(old.pid)?.startTicks === old.startTicks,
          };
          break;
        }
      }
      await sleep(step);
    }
    await release('deadline');
    followChild(old);
  };

  const observe = async () => {
    /* 1. the old generation (on the control-owned runtime copy for the runtime case) */
    if (runtimeCopy) {
      mkdirSync(path.dirname(runtimeCopy), { recursive: true, mode: 0o700 });
      copyFileSync(node, runtimeCopy);
      chmodSync(runtimeCopy, 0o700);
      const bytes = readFileSync(runtimeCopy);
      fallback.runtime = { copied: true, sourceName: path.basename(node), bytes: bytes.length, sha256: sha256(bytes), unlinkedAtMs: null };
    }
    const old = startGeneration('old', runtimeCopy ?? node);
    const oldReady = await waitUntil(async () => (old.exited ? 'exited' : await verifyReady(old)), now() + plan.bootTimeoutMs, Math.min(250, plan.sampleIntervalMs));
    if (!oldReady || oldReady === 'exited') {
      record.generations.old.failure = {
        kind: oldReady === 'exited' ? 'exited-before-ready' : 'not-ready-by-deadline',
        exit: old.exit,
        lastProbe: old.lastProbe ?? null,
      };
      return;
    }
    Object.assign(record.generations.old, {
      readyAtMs: oldReady.atMs,
      listen: { port: target.port, inode: oldReady.inode },
      bootIdSha256: oldReady.bootIdSha256,
      buildId: oldReady.buildId,
      // The branch precondition at the byte of the running process: which supervisor hints its
      // own /proc environ carries (keys only).
      supervisorHints: supervisorHintsOf(old.pid),
    });

    /* 2. one return authority. session.visibility.set needs the session owner or
       operator.admin (sessions-sharing-authority.ts); a device-less CLI client is not the
       owner, so this connection asks for operator.admin as the CLI does. */
    const establishScopes = ['operator.read', 'operator.write', 'operator.admin'];
    const establish = await gatewayRpc({
      port: target.port,
      token: target.token,
      scopes: establishScopes,
      calls: [{ method: 'sessions.create', params: { key: sessionSlug, agentId, label: 'return-covenant restart control' } }],
      timeoutMs: 15_000,
    });
    const created = establish.results[0]?.frame;
    const sessionKey = typeof created?.payload?.key === 'string' ? created.payload.key : null;
    record.authority.createOk = created?.ok === true;
    if (!sessionKey) {
      record.authority.error = redact(JSON.stringify(created?.error ?? establish.connectFrame?.error ?? establish.error ?? 'sessions.create returned no key'));
      return;
    }
    addSecret(sessionKey, '<session-key>');
    const narrowed = await gatewayRpc({
      port: target.port,
      token: target.token,
      scopes: establishScopes,
      calls: [{ method: 'session.visibility.set', params: { sessionKey, agentId, visibility: 'suggest' } }],
      timeoutMs: 15_000,
    });
    const narrowFrame = narrowed.results[0]?.frame;
    record.authority.visibilityOk = narrowFrame?.ok === true;
    const bareKey = sessionKey.startsWith(`agent:${agentId}:`) ? sessionKey.slice(`agent:${agentId}:`.length) : sessionKey;
    const established = readAuthority(agentDatabase, [sessionKey, bareKey]);
    if (established.state !== 'present') {
      record.authority.error = redact(JSON.stringify(narrowFrame?.error ?? narrowed.error ?? `authority ${established.state}`));
      return;
    }
    state.authorityKey = established.key;
    state.rawEpoch = established.epoch;
    addSecret(established.epoch, '<authority-epoch>');
    Object.assign(record.authority, {
      established: true,
      method: 'session.visibility.set(suggest) advances session_recipient_authority',
      keyForm: established.key === sessionKey ? 'canonical' : 'bare',
      sessionKeySha256: sha256(established.key),
      epochSha256: sha256(established.epoch),
      establishedAtMs: now(),
    });

    /* 3. the observation matrix, planned before the transition */
    sampler = runSampler();
    await waitUntil(
      () => record.observation.samples.filter((sample) => sample.phase === 'pre-trigger').length >= plan.preTriggerSamples,
      now() + plan.preTriggerSamples * plan.maxSampleGapMs + 5000,
      Math.min(50, plan.sampleIntervalMs),
    );

    /* 4. the real restart (the runtime case first removes its runtime copy) */
    if (runtimeCopy) {
      removeRuntimeCopy();
      fallback.runtime.unlinkedAtMs = now();
    }
    if (fallback) state.preTriggerChildren = new Set(childPidsOf(old.pid));
    state.triggerAtMs = now();
    record.observation.triggerAtMs = state.triggerAtMs;
    record.observation.plannedEndAtMs = state.triggerAtMs + plan.observationWindowMs;
    record.transition.httpBodies.lastPreTrigger = state.lastPreTrigger;
    record.transition.requestedAtMs = state.triggerAtMs;
    const request = { method: 'gateway.restart.request', params: { reason: branch.restartReason, skipDeferral: true } };
    record.transition.request = request;
    const restart = await gatewayRpc({ port: target.port, token: target.token, scopes: ['operator.admin'], calls: [request], timeoutMs: 15_000 });
    const frame = restart.results[0]?.frame ?? (restart.connectFrame && typeof restart.connectFrame === 'object' ? restart.connectFrame : null);
    if (frame) {
      writeJson(path.join(privateDir, 'transition-response.json'), frame, 0o600);
      record.transition.response = {
        ok: frame.ok === true,
        receivedAtMs: now(),
        sha256: sha256(canonicalJson(frame)),
        frame: redactDeep(frame, secrets),
      };
    }
    if (restart.error) record.transition.error = redact(restart.error);

    const windowEnd = state.triggerAtMs + plan.observationWindowMs;
    // A lost response is not a rejected one: if the old generation still restarts, follow
    // it, and let the grader score the missing body (the rejected base's second half).
    if ((frame?.ok === true || !frame) && branch.branch === 'spawned') {
      /* 5-6. the spawned branch: the product starts and judges the replacement */
      await spawnedTransition(old);
      await waitUntil(() => {
        followChild(old);
        return false;
      }, windowEnd, Math.min(100, plan.sampleIntervalMs));
      record.generations.old.exitedAtMs = old.exited ? old.exitedAtMs : null;
    } else if (frame?.ok === true || !frame) {
      /* 5. the old generation closes and exits through the handoff */
      await waitUntil(() => old.exited, state.triggerAtMs + plan.transitionDeadlineMs, 20);
      if (old.exited) {
        await old.closed;
        Object.assign(record.generations.old, { exitedAtMs: old.exitedAtMs, exit: old.exit });
        const consume = await platform.runCli({
          node,
          args: [entry, 'gateway', 'restart-handoff', 'consume', '--expected-pid', String(old.pid), '--json'],
          env: childEnv,
          cwd: target.proofGwDir,
          timeoutMs: 30_000,
        });
        writeJson(path.join(privateDir, 'handoff-consume.json'), {
          code: consume.code,
          signal: consume.signal,
          stdout: consume.stdout.toString('utf8'),
          stderr: consume.stderr.toString('utf8'),
        }, 0o600);
        const stdout = consume.stdout.toString('utf8');
        const body = parseTrailingJson(stdout);
        record.transition.handoff = {
          exit: { code: consume.code, signal: consume.signal },
          sha256: sha256(stdout),
          protocol: body?.protocol ?? null,
          status: body?.status ?? null,
          reason: body?.reason ?? null,
          pid: body?.handoff?.pid ?? null,
          restartKind: body?.handoff?.restartKind ?? null,
          supervisorMode: body?.handoff?.supervisorMode ?? null,
          source: body?.handoff?.source ?? null,
          stderrTail: textCapture(consume.stderr, secrets).tail,
        };

        /* the negative: a control-owned socket holds the port so no replacement can serve */
        if (caseKind === 'negative-replacement-never-usable') await holdPort();

        /* 6. the replacement */
        const replacement = startGeneration('replacement');
        if (caseKind === 'negative-replacement-never-usable') record.generations.replacement.blockedBy = 'control-held-port';
        const deadline = state.triggerAtMs + plan.readinessDeadlineMs;
        const ready = await waitUntil(async () => (replacement.exited ? 'exited' : await verifyReady(replacement)), deadline, Math.min(100, plan.sampleIntervalMs));
        if (ready && ready !== 'exited') {
          state.replacementReadyAt = ready.atMs;
          const after = readAuthority(agentDatabase, [state.authorityKey]);
          record.transition.httpBodies.firstReplacementReady = edge(ready.atMs, ready.bodies);
          Object.assign(record.generations.replacement, {
            readyAtMs: ready.atMs,
            listen: { port: target.port, inode: ready.inode },
            bootIdSha256: ready.bootIdSha256,
            buildId: ready.buildId,
            authorityAfterReady: after.state === 'present' ? sha256(after.epoch) : after.state,
          });
        } else {
          record.generations.replacement.readyAtMs = null;
          record.generations.replacement.failure = {
            kind: replacement.exited ? 'exited-before-ready' : 'not-ready-by-deadline',
            atMs: replacement.exited ? replacement.exitedAtMs : now(),
            lastProbe: replacement.lastProbe ?? null,
          };
        }
      } else {
        record.generations.old.exitedAtMs = null;
      }
      await waitUntil(() => false, windowEnd, Math.min(100, plan.sampleIntervalMs));
    } else {
      // A rejected or undelivered restart: keep observing briefly so the matrix shows the
      // old generation still serving, then stop; there is no transition window to fill.
      await sleep(plan.sampleIntervalMs * 2);
    }
  };

  try {
    await observe();
  } catch (error) {
    record.errors.push({ at: 'control', message: redact(error.stack ?? error.message) });
  } finally {
    state.stopSampling = true;
    if (sampler) await sampler;
    record.observation.endAtMs = now();
    await cleanup({ record, generations, held, target, runId });
    for (const [name, generation] of Object.entries(generations)) {
      await new Promise((resolve) => generation.logs.stdout.end(resolve));
      await new Promise((resolve) => generation.logs.stderr.end(resolve));
      Object.assign(record.generations[name], {
        exit: generation.exit,
        // An exit the control caused during cleanup is not a transition exit; a recorded
        // null (no exit within the transition deadline) stays null.
        exitedAtMs: 'exitedAtMs' in record.generations[name] ? record.generations[name].exitedAtMs : generation.exitedAtMs,
        stoppedByCleanup: generation.stoppedByCleanup === true,
        stdout: textCapture(Buffer.concat(generation.stdout), secrets),
        stderr: textCapture(Buffer.concat(generation.stderr), secrets),
      });
    }
    if (generations.replacement && record.generations.replacement.started && record.generations.replacement.failure) {
      record.generations.replacement.failure.exit = generations.replacement.exit ?? null;
      record.generations.replacement.failure.stderrTail = record.generations.replacement.stderr.tail;
    }
    if (fallback) {
      // The product's diagnostic lines, redacted, and the product-spawned replacement as seen
      // from outside: it shares the old generation's streams and is never the control's child.
      const old = generations.old;
      if (old) {
        for (const stream of ['stdout', 'stderr']) old.scan(stream, '', true);
        fallback.diagnostics = old.diagnostics.map((entry) => ({ stream: entry.stream, atMs: entry.atMs, line: redact(entry.line) }));
      }
      const child = fallback.child;
      const started = child.pid !== null || child.reportedPid !== null;
      const served = record.observation.samples.some((sample) => sample.servingGeneration === 'replacement');
      record.generations.replacement = {
        started,
        spawnedBy: 'product',
        pid: child.pid,
        startTicks: child.startTicks,
        ppid: child.ppid,
        pidSource: child.pidSource,
        invocation: child.invocation,
        reportedPid: child.reportedPid,
        firstSeenAtMs: child.firstSeenAtMs,
        goneAtMs: child.goneAtMs,
        readyAtMs: null,
        failure: started && !served ? { kind: 'never-healthy' } : null,
      };
    }
    if (runtimeCopy) {
      try {
        removeRuntimeCopy();
        rmSync(path.dirname(runtimeCopy), { recursive: true, force: true });
      } catch (error) {
        record.errors.push({ at: 'runtime-copy-cleanup', message: redact(error.message) });
      }
    }
  }

  return finishReceipt({ record, observerKey, artifactDir, secrets, state });
}

async function stopOwnGeneration(generation, runId, outcome) {
  if (!generation || generation.exited) return;
  const pid = generation.pid;
  const stat = procStat(pid);
  if (!stat || stat.startTicks !== generation.startTicks || !procEnvironHas(pid, `OPENCLAW_PROOF_RCC_RUN=${runId}`)) {
    // Fail closed: a PID that no longer carries this run's identity is never signalled.
    outcome.unverified.push(pid);
    return;
  }
  const signal = (name) => {
    try {
      process.kill(stat.pgrp === pid ? -pid : pid, name);
    } catch {
      // Already gone.
    }
  };
  generation.stoppedByCleanup = true;
  signal('SIGTERM');
  const settle = (ms) => Promise.race([generation.closed, sleep(ms)]);
  await settle(STOP_GRACE_MS);
  if (!generation.exited) {
    outcome.escalated.push(pid);
    signal('SIGKILL');
    await settle(KILL_GRACE_MS);
  }
}

async function cleanup({ record, generations, held, target, runId }) {
  const outcome = { escalated: [], unverified: [] };
  for (const name of ['replacement', 'old']) await stopOwnGeneration(generations[name], runId, outcome);
  let blockerClosed = null;
  if (held.used) {
    if (held.open) {
      held.open = false;
      await new Promise((resolve) => held.server.close(() => resolve()));
    }
    blockerClosed = true;
  }
  const marker = `OPENCLAW_PROOF_RCC_RUN=${runId}`;
  const runMembers = () => {
    const found = new Set(processesWithMarker(marker));
    for (const generation of Object.values(generations)) {
      if (generation.pid && !generation.exited) found.add(generation.pid);
    }
    return [...found].sort((a, b) => a - b);
  };
  // A process still carrying this run's marker is ours by construction (a generation or its
  // descendant, detached or not). Stop it, but record it: a generation that leaves a
  // descendant behind did not retire cleanly.
  const orphans = runMembers();
  for (const [signalName, graceMs] of [['SIGTERM', STOP_GRACE_MS], ['SIGKILL', KILL_GRACE_MS]]) {
    const live = runMembers();
    if (live.length === 0) break;
    for (const pid of live) {
      // Re-read the marker immediately before the signal: a PID that no longer carries it is
      // not ours any more.
      if (!procEnvironHas(pid, marker) && !Object.values(generations).some((generation) => generation.pid === pid && !generation.exited)) continue;
      try {
        process.kill(pid, signalName);
      } catch {
        // Already gone.
      }
    }
    const deadline = Date.now() + graceMs;
    while (Date.now() < deadline && runMembers().length > 0) await sleep(100);
  }
  const residual = runMembers();
  const listeners = listenInodes(target.port);
  record.cleanup = {
    completed: true,
    completedAtMs: Date.now(),
    childrenStopped: residual.length === 0 && outcome.unverified.length === 0,
    orphansTerminated: orphans,
    residualPids: residual,
    unverifiedPids: outcome.unverified,
    escalatedToSigkill: outcome.escalated,
    portReleased: listeners.length === 0,
    blockerClosed,
    stateRetainedForShred: true,
  };
}

function finishReceipt({ record, observerKey, artifactDir, secrets, state }) {
  let grade = gradeRestartControl(record);
  const leakSecrets = [...secrets];
  if (state.rawEpoch) leakSecrets.push({ value: state.rawEpoch, label: '<authority-epoch>' });
  const leaks = publicSafetyLeaks(record, leakSecrets);
  let publicRecord = record;
  if (leaks.length) {
    grade = {
      ...grade,
      verdict: 'FAIL-candidate',
      corpusStateCeiling: 'fail',
      failures: [...grade.failures, { code: 'public-artifact-unsafe', detail: `withheld the record: ${leaks.join(', ')}` }],
    };
    publicRecord = null;
  }
  const body = {
    schema: `${RCC_SCHEMA}#observer-receipt`,
    row: RCC_ROW,
    runId: record.runId,
    case: record.case,
    kind: record.kind,
    candidateSha: record.candidateSha,
    docsSha: record.docsSha,
    generatedAt: new Date().toISOString(),
    verdict: grade.verdict,
    grade,
    record: publicRecord,
  };
  const receipt = observerKey ? sealObserverReceipt(body, observerKey) : body;
  writeJson(path.join(artifactDir, 'observer-receipt.json'), receipt);
  return { status: 'completed', record, grade, receipt };
}

/* ------------------------------------------------------------------------------------ */
/* CLI                                                                                   */
/* ------------------------------------------------------------------------------------ */

/** On SIGINT/SIGTERM, stop every generation this process started, then exit. */
function installInterruptCleanup() {
  const interrupt = (signal) => {
    const runIds = new Set([...liveGenerations].map((generation) => generation.runId));
    for (const runId of runIds) {
      for (const pid of processesWithMarker(`OPENCLAW_PROOF_RCC_RUN=${runId}`)) {
        try {
          process.kill(pid, 'SIGKILL');
        } catch {
          // Already gone.
        }
      }
    }
    for (const generation of liveGenerations) {
      const stat = procStat(generation.pid);
      if (stat && stat.startTicks === generation.startTicks && procEnvironHas(generation.pid, `OPENCLAW_PROOF_RCC_RUN=${generation.runId}`)) {
        try {
          process.kill(stat.pgrp === generation.pid ? -generation.pid : generation.pid, 'SIGKILL');
        } catch {
          // Already gone.
        }
      }
    }
    console.error(`interrupted by ${signal}; stopped ${liveGenerations.size} control generation(s); no receipt was written`);
    process.exit(130);
  };
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
}

async function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`${error.message}\n${USAGE}`);
    return 2;
  }
  if (options.help) {
    console.log(USAGE);
    return 0;
  }
  if (options.verify) {
    const receipt = JSON.parse(readFileSync(options.verify, 'utf8'));
    const key = options.observerKeyFile ? readFileSync(options.observerKeyFile, 'utf8').trim() : '';
    const valid = verifyObserverReceipt(receipt, key);
    console.log(JSON.stringify({ valid, verdict: receipt.verdict ?? null, kind: receipt.kind ?? null }));
    return valid ? 0 : 1;
  }
  if (options.gradeRow) {
    // Only a receipt whose observer signature verifies is counted; without the key none can be.
    if (!options.observerKeyFile) {
      console.error(`--grade-row needs --observer-key-file: only receipts whose observer signature verifies are counted\n${USAGE}`);
      return 2;
    }
    let key;
    try {
      key = readFileSync(options.observerKeyFile, 'utf8').trim();
    } catch (error) {
      console.error(`cannot read the observer key file: ${error?.code ?? error?.message ?? 'unreadable'}`);
      return 2;
    }
    const verified = [];
    const unverifiedReceipts = [];
    for (const file of options.gradeRow) {
      let receipt = null;
      try {
        receipt = JSON.parse(readFileSync(file, 'utf8'));
      } catch (error) {
        unverifiedReceipts.push({ file, case: null, error: String(error?.code ?? 'unreadable') });
        continue;
      }
      if (verifyObserverReceipt(receipt, key)) verified.push(receipt);
      else unverifiedReceipts.push({ file, case: typeof receipt?.case === 'string' ? receipt.case : null, error: 'signature-not-verified' });
    }
    // An unverified receipt is never counted; one that names a supervised or unknown case caps the
    // row (row-receipt-unverified), and any of them makes the exit status 1.
    const rowGrade = gradeReturnCovenantRow(verified, { unverified: unverifiedReceipts });
    console.log(JSON.stringify({ ...rowGrade, unverifiedReceipts }, null, 2));
    console.log(`ROW VERDICT: ${rowGrade.verdict}`);
    if (rowGrade.controls.length) {
      const listed = rowGrade.controls.map((control) => `${control.case} ${control.holds ? 'holds' : 'does not hold'}`);
      console.log(`CONTROLS beside the row verdict, never feeding it: ${listed.join(', ')}`);
    }
    return unverifiedReceipts.length ? 1 : 0;
  }
  installInterruptCleanup();
  const result = await runRestartControl(options);
  if (result.status === 'refused') {
    console.error(`REFUSED: ${result.refusals.map((entry) => `${entry.code} (${entry.detail})`).join('; ')}`);
    return 2;
  }
  console.log(JSON.stringify({
    row: RCC_ROW,
    case: result.record.case,
    kind: result.grade.kind,
    feedsRowVerdict: result.grade.feedsRowVerdict,
    verdict: result.grade.verdict,
    missingReceipts: result.grade.missingReceipts,
    failures: result.grade.failures.map((entry) => entry.code),
    partials: result.grade.partials.map((entry) => entry.code),
    negativeControl: result.grade.negativeControl,
  }, null, 2));
  console.log(`VERDICT: ${result.grade.verdict}`);
  if (!result.grade.feedsRowVerdict) {
    console.log('This case is an update-respawn control: it is not evidence for the fleet restart claim and never feeds the row verdict (--grade-row).');
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  }, (error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
