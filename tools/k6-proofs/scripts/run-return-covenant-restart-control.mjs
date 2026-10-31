#!/usr/bin/env node
/**
 * run-return-covenant-restart-control.mjs — the disposable real-restart control for
 * R-CD-RETURN-COVENANT-AUTHORITY (🌊's F″ ruling, karmaterminal/openclaw-bootstrap#1727).
 *
 * The control is the declared external supervisor of one disposable gateway that
 * frond-scribe scripts/proof-gw/composite-launcher.sh set up (and then stopped):
 *
 *   1. refuse anything that is not a proof-gw directory with a stopped unit, a free
 *      non-live loopback port and a stage built from the candidate;
 *   2. start the old generation (OPENCLAW_SUPERVISOR_MODE=external) and wait for readiness;
 *   3. establish one return authority: sessions.create, then a narrowing
 *      session.visibility.set, which advances (creates) the session_recipient_authority epoch;
 *   4. sample the observation matrix (listener owner, /readyz, /startupz, authority epoch,
 *      last usable generation) through a window planned before the transition;
 *   5. request a real restart (gateway.restart.request), wait for the old generation to
 *      close and exit, consume the product's restart handoff, start the replacement, and
 *      verify it (owned listener, /readyz, /startupz, hello-ok with a new bootId);
 *   6. clean up only processes it started (PID + start ticks + run marker), then grade,
 *      sign with a launcher-held observer key and write the public receipt.
 *
 * The negative case (`negative-replacement-never-usable`) holds the port with a
 * control-owned socket before the replacement starts, so the replacement can never serve.
 * The grader must then refuse PASS while still showing the old authority and the failure
 * body. The product path and its F′ anchors are in scenarios/r-cd-return-covenant-authority.js.
 *
 * It never reads OPENCLAW_GATEWAY_TOKEN/WS from the environment, never runs systemctl except
 * the read-only `is-active` check, and never signals a process it did not start.
 */
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  chmodSync,
  createWriteStream,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
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
  RCC_REFUSAL_SCHEMA,
  RCC_ROW,
  RCC_SCHEMA,
  boundedBody,
  evaluateDisposableTarget,
  gradeRestartControl,
  isSha40,
  observerKeyFingerprint,
  planObservationWindow,
  publicSafetyLeaks,
  redactDeep,
  redactText,
  sealObserverReceipt,
  sha256,
  textCapture,
  verifyObserverReceipt,
} from '../lib/return-covenant-restart-control.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const CLIENT = Object.freeze({ id: 'cli', mode: 'cli', version: 'k6-proof-rcc-v1', platform: 'node' });
const RETARGETING_ENV = /^(?:HOME|PATH|INVOCATION_ID|SYSTEMD_EXEC_PID|JOURNAL_STREAM|OPENCLAW_(?:STATE_DIR|CONFIG_PATH|GATEWAY_PORT|SUPERVISOR_MODE|SYSTEMD_UNIT|PROOF_RCC_RUN|GATEWAY_TOKEN|GATEWAY_URL|GATEWAY_WS|PROFILE|HOME|LAUNCHD_LABEL|WINDOWS_TASK_NAME|SERVICE_MARKER|SERVICE_KIND|NO_RESPAWN))$/u;
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
    // Fields after the command: [0]=state (3) ... [2]=pgrp (5) ... [19]=starttime (22).
    return { state: fields[0], pgrp: Number(fields[2]), startTicks: Number(fields[19]) };
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

function processGroupMembers(pgrp, procRoot = '/proc') {
  const members = [];
  for (const entry of readdirSync(procRoot)) {
    if (!/^\d+$/u.test(entry)) continue;
    const stat = procStat(Number(entry), procRoot);
    if (stat && stat.pgrp === pgrp && stat.state !== 'Z') members.push(Number(entry));
  }
  return members;
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
    --case positive|negative-replacement-never-usable \\
    --artifact-dir <new public dir> --observer-key-file <0600 key file> \\
    [--sample-interval-ms 500] [--observation-window-ms 90000] [--readiness-deadline-ms 60000] \\
    [--transition-deadline-ms 45000] [--boot-timeout-ms 120000] [--pre-trigger-samples 4] \\
    [--agent-id main] [--node <node>] [--gateway-env KEY=VALUE]...
  node tools/k6-proofs/scripts/run-return-covenant-restart-control.mjs \\
    --verify <observer-receipt.json> --observer-key-file <key file>`;

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
  if (artifactDir) {
    mkdirSync(artifactDir, { recursive: true });
    writeJson(path.join(artifactDir, 'refusal.json'), refusal);
  }
  return { status: 'refused', refusals: refusal.refusals, refusal };
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
  for (const key of Object.keys(options.gatewayEnv ?? {})) {
    if (RETARGETING_ENV.test(key)) refuse('gateway-env-retargets', `--gateway-env may not set ${key}`);
  }
  let plan;
  try {
    plan = planObservationWindow(options.plan ?? {});
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
    for (const forbidden of [target.proofGwDir, path.join(home, '.openclaw')].filter(Boolean)) {
      if (artifactDir === forbidden || artifactDir.startsWith(`${forbidden}${path.sep}`)) {
        refuse('artifact-dir-in-target', 'the artifact directory must live outside the gateway-under-test and the live state');
      }
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
    OPENCLAW_SUPERVISOR_MODE: 'external',
    OPENCLAW_PROOF_RCC_RUN: runId,
  };

  const record = {
    schema: RCC_SCHEMA,
    row: RCC_ROW,
    runId,
    case: caseKind,
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
      supervisorMode: 'external',
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

  const generations = {};
  const state = { triggerAtMs: null, replacementReadyAt: null, stopSampling: false, lastPreTrigger: null, rawEpoch: null };
  let blocker = null;
  let sampler = null;

  const startGeneration = (name) => {
    const logs = {
      stdout: createWriteStream(path.join(privateDir, `${name}.stdout.log`), { mode: 0o600 }),
      stderr: createWriteStream(path.join(privateDir, `${name}.stderr.log`), { mode: 0o600 }),
    };
    const generation = { name, stdout: [], stderr: [], exited: false, exit: null, exitedAtMs: null, logs };
    const child = platform.spawnGateway({ node, args: [entry, 'gateway', '--port', String(target.port)], env: childEnv, cwd: target.proofGwDir });
    generation.child = child;
    generation.pid = child.pid;
    generation.spawnedAtMs = now();
    child.stdout?.on('data', (chunk) => {
      generation.stdout.push(chunk);
      logs.stdout.write(chunk);
    });
    child.stderr?.on('data', (chunk) => {
      generation.stderr.push(chunk);
      logs.stderr.write(chunk);
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
      if (generation && !generation.exited) for (const inode of socketInodesOf(generation.pid)) map.set(inode, name);
    }
    for (const inode of socketInodesOf(process.pid)) if (!map.has(inode)) map.set(inode, 'control-blocker');
    return map;
  };

  const listenerFor = () => {
    const inodes = listenInodes(target.port);
    if (inodes.length === 0) return { owner: null, inode: null, inodes };
    const owned = owners();
    for (const preferred of ['replacement', 'old', 'control-blocker']) {
      const inode = inodes.find((candidate) => owned.get(candidate) === preferred);
      if (inode) return { owner: preferred, inode, inodes };
    }
    return { owner: 'foreign', inode: inodes[0], inodes };
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

  const takeSample = async () => {
    const atMs = now();
    const lastUsableGeneration = state.replacementReadyAt !== null ? 'replacement' : 'old';
    const triggered = state.triggerAtMs !== null && atMs >= state.triggerAtMs;
    const oldAlive = Boolean(generations.old && !generations.old.exited);
    const phase = !triggered
      ? 'pre-trigger'
      : state.replacementReadyAt !== null
        ? 'replacement-serving'
        : oldAlive
          ? 'old-draining'
          : 'awaiting-replacement';
    const listener = listenerFor();
    const bodies = await probeBodies();
    const authority = readAuthority(agentDatabase, [state.authorityKey]);
    const sample = {
      atMs,
      phase,
      lastUsableGeneration,
      oldAlive,
      replacementAlive: Boolean(generations.replacement && !generations.replacement.exited),
      listener,
      readyz: projectProbe(bodies.readyz, 'readyz'),
      startupz: projectProbe(bodies.startupz, 'startupz'),
      authority: authority.state === 'present'
        ? { state: 'present', epochSha256: sha256(authority.epoch) }
        : { state: authority.state, reason: authority.reason },
    };
    record.observation.samples.push(sample);
    const readyNow = sample.readyz.status === 200 && sample.readyz.ready === true;
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

  const observe = async () => {
    /* 1. the old generation */
    const old = startGeneration('old');
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

    /* 4. the real restart */
    state.triggerAtMs = now();
    record.observation.triggerAtMs = state.triggerAtMs;
    record.observation.plannedEndAtMs = state.triggerAtMs + plan.observationWindowMs;
    record.transition.httpBodies.lastPreTrigger = state.lastPreTrigger;
    record.transition.requestedAtMs = state.triggerAtMs;
    const request = { method: 'gateway.restart.request', params: { reason: 'gateway.restart', skipDeferral: true } };
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
    if (frame?.ok === true || !frame) {
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
        if (caseKind === 'negative-replacement-never-usable') {
          blocker = net.createServer((socket) => socket.destroy());
          await new Promise((resolve, reject) => {
            blocker.once('error', reject);
            blocker.listen(target.port, '127.0.0.1', resolve);
          });
        }

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
    await cleanup({ record, generations, blocker, target, runId });
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
    if (record.generations.replacement.started && record.generations.replacement.failure) {
      record.generations.replacement.failure.exit = generations.replacement?.exit ?? null;
      record.generations.replacement.failure.stderrTail = record.generations.replacement.stderr.tail;
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

async function cleanup({ record, generations, blocker, target, runId }) {
  const outcome = { escalated: [], unverified: [] };
  for (const name of ['replacement', 'old']) await stopOwnGeneration(generations[name], runId, outcome);
  let blockerClosed = null;
  if (blocker) {
    await new Promise((resolve) => blocker.close(() => resolve()));
    blockerClosed = true;
  }
  const marker = `OPENCLAW_PROOF_RCC_RUN=${runId}`;
  const runMembers = () => {
    const found = new Set();
    for (const generation of Object.values(generations)) {
      if (!generation.pid) continue;
      if (!generation.exited) found.add(generation.pid);
      for (const member of processGroupMembers(generation.pid)) {
        if (procEnvironHas(member, marker)) found.add(member);
      }
    }
    return [...found].sort((a, b) => a - b);
  };
  // A process left in one of our groups with this run's marker is ours by construction
  // (a generation's descendant). Stop it, but record it: a generation that leaves a
  // descendant behind did not retire cleanly.
  const orphans = runMembers();
  for (const [signalName, graceMs] of [['SIGTERM', STOP_GRACE_MS], ['SIGKILL', KILL_GRACE_MS]]) {
    const live = runMembers();
    if (live.length === 0) break;
    for (const pid of live) {
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
    console.log(JSON.stringify({ valid, verdict: receipt.verdict ?? null }));
    return valid ? 0 : 1;
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
    verdict: result.grade.verdict,
    missingReceipts: result.grade.missingReceipts,
    failures: result.grade.failures.map((entry) => entry.code),
    partials: result.grade.partials.map((entry) => entry.code),
    negativeControl: result.grade.negativeControl,
  }, null, 2));
  console.log(`VERDICT: ${result.grade.verdict}`);
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
