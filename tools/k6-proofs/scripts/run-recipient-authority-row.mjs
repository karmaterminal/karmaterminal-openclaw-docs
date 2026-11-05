#!/usr/bin/env node
/**
 * run-recipient-authority-row.mjs: the control for R-CD-RECIPIENT-AUTHORITY, the live isolated-gateway
 * row (🌊's ruling, room msg 1567077062139838485; docs#536), pinned to j12′
 * a22bd9c05c4a7a9c86e72a132cb7939e399104cb, the merged head with the delegate dispatch grant and the
 * incognito fanout refusal (🌊's ruling, room msg 1567104742604406896; gate 3, room msg
 * 1567194866507841678; the grant, ruling A, room msg 1567487338383413250; the incognito fix, room msgs
 * 1567643207976886343 and 1567646197517385800). The grant's head 2907e656 is history, refused like
 * every other SHA.
 *
 * It owns one disposable gateway that frond-scribe scripts/proof-gw/composite-launcher.sh set up,
 * signed in (login) and stopped:
 *
 *   1. refuse, before anything starts: a candidate other than j12′; anything that is not a stopped
 *      $HOME/proof-gw/comp-<sha8> gateway on a free, non-live loopback port with its own token and no
 *      channels, whose stage dist/build-info.json commit is j12′ and whose state is not under the live
 *      ~/.openclaw (evaluateDisposableTarget); continuation or cross-session targeting disabled in its
 *      config; no isolated model sign-in (openclaw models status --json against the isolated state);
 *      an observer key that is missing, loose or inside the target;
 *   2. start the gateway itself, with a cleared environment (the isolated state and config, its own
 *      TMPDIR so its file log is not the live one, OPENCLAW_SUPERVISOR_MODE=external so a restart
 *      takes the supervised branch, and a run marker), and refuse to go on unless the listener is
 *      that process: PID and kernel start ticks, before and after every case;
 *   3. run scenarios/r-cd-recipient-authority.js once per case against it, while capturing the
 *      gateway's own console output (where j12′'s `[continuation:return-refused]` and
 *      `[continuation:work-refused]` lines and the router's `Delivered to` line land) and sampling
 *      the session_recipient_authority table read-only (the continue_work case's capture is read
 *      there: it follows the tool's `scheduled` result). A parked case's drive phase ends once its
 *      child returned; the control waits for the router's `Delivered to` line for that target from
 *      that child, the witness of the return's queued copy, and only then runs its transition phase
 *      (🌊's ruling, room msg 1567623059727458526). With no witness the transition is never sent.
 *      The continue_work case's drive ends at its `scheduled` result; the control reads the store
 *      until the election's capture is there, at most until rraWorkCaptureDeadline, and only then runs
 *      its transition phase. With no capture by then the transition is never sent;
 *   4. for replay-restart, after the transition phase: gateway.restart.request, wait for the old process to
 *      exit 0, consume its restart handoff (`gateway restart-handoff consume --expected-pid`), start
 *      the replacement and run the observe phase;
 *   5. assemble each case's record, grade it with lib/recipient-authority-row.mjs, sign it with the
 *      launcher-held observer key, and write the public receipt; raw evidence, logs and keys stay in
 *      <artifact-dir>.private;
 *   6. stop only the generations it started (PID, start ticks and run marker re-verified).
 *
 * `--grade-row <artifact-dir>` grades the row from the signed case receipts, crediting a case's trace
 * only from a continuation-trace-correlation.json whose reason fingerprint is that case's.
 *
 * It never reads OPENCLAW_GATEWAY_TOKEN or OPENCLAW_GATEWAY_WS from its own environment, never
 * touches ~/.openclaw, never runs systemctl except the read-only `is-active` check, and never signals
 * a process it did not start. It never reads the delivery queue: no public surface reads a refused
 * row's `failed` receipt at j12′. The product path at j12′ is in the scenario header.
 */
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
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
import { evaluateDisposableTarget, sha256 } from '../lib/return-covenant-restart-control.mjs';
import { sealSignedObserverReceipt, validateSignedObserverReceiptIntegrity } from '../lib/signed-observer-receipt.mjs';
import {
  RRA_CASES,
  RRA_CASE_IDS,
  RRA_CASE_SCHEMA,
  RRA_PINNED,
  RRA_ROW,
  countRoutedAfter,
  countSweepsArmed,
  evaluateContinuationConfig,
  evaluateModelSignIn,
  findReason,
  findReturnRefusals,
  findRouted,
  findWorkRefusals,
  gradeRecipientAuthorityCase,
  gradeRecipientAuthorityRow,
  isAdmissionPolicyRefusal,
  isSha40,
  listenerOwnedBy,
  parseReturnRefusedLine,
  parseWorkRefusedLine,
  rraCaseSpec,
  rraWorkCaptureDeadline,
  traceCorrelationMatches,
} from '../lib/recipient-authority-row.mjs';
import { extractEvidence } from './extract-k6-evidence.mjs';

export const RRA_OBSERVER_ALGORITHM = 'hmac-sha256-proof-observer-key-v1';
export const RRA_REFUSAL_SCHEMA = 'openclaw.k6.recipient-authority-refusal.v1';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SCENARIO = path.join(REPO_ROOT, 'tools/k6-proofs/scenarios/r-cd-recipient-authority.js');
const MANIFEST = path.join(REPO_ROOT, 'tools/k6-proofs/manifests/r-cd-recipient-authority.json');
const RUN_MARKER_ENV = 'RRA_RUN_MARKER';
// The two settings the proof-gw unit itself passes; a denylist could not fail closed.
const GATEWAY_ENV_ALLOWED = /^(?:NODE_OPTIONS|OPENCLAW_CODEX_APP_SERVER_BIN)$/u;
const NODE_OPTIONS_ALLOWED = /^(?:--max-old-space-size=\d+|--inspect=127\.0\.0\.1:\d{4,5})$/u;
// Case timing the operator may tune; passed to the scenario, recorded in the receipt.
// OPENCLAW_RCD_RA_WITNESS_WAIT_MS is the control's own: how long it waits for a parked copy's witness.
// The continue_work case's wait for its capture has no knob: its deadline comes from the case's own
// `scheduled` result (rraWorkCaptureDeadline).
const TIMING_ENV = ['OPENCLAW_RCD_RA_DELAY_SECONDS', 'OPENCLAW_RCD_RA_POLL_MS', 'OPENCLAW_RCD_RA_WINDOW_MS', 'OPENCLAW_RCD_RA_PARK_MS', 'OPENCLAW_RCD_RA_SWEEP_WAIT_MS', 'OPENCLAW_RCD_RA_BOOT_WAIT_MS', 'OPENCLAW_RCD_RA_DUPLICATE_WAIT_MS', 'OPENCLAW_RCD_RA_SAMPLE_GAP_MS', 'OPENCLAW_RCD_RA_PROBE_SETTLE_MS', 'OPENCLAW_RCD_RA_WITNESS_WAIT_MS'];
const WITNESS_WAIT_MS = 120_000;
const WITNESS_POLL_MS = 250;
const CAPTURE_POLL_MS = 250;
const READY_TIMEOUT_MS = 120_000;
// Live generations of the current run, so an interrupted CLI can still stop what it started.
const liveGenerations = new Set();
const EPOCH_SAMPLE_MS = 500;
const STOP_GRACE_MS = 10_000;

/* ------------------------------------------------------------------------------------ */
/* Arguments                                                                             */
/* ------------------------------------------------------------------------------------ */

export function parseArgs(argv, env = process.env) {
  const options = { cases: [...RRA_CASE_IDS], gatewayEnv: {}, timing: {}, k6: 'k6', node: process.execPath, json: false };
  for (const key of TIMING_ENV) {
    if (env[key] === undefined) continue;
    if (!/^[1-9]\d{0,6}$/u.test(env[key])) throw new Error(`${key} must be a positive integer`);
    options.timing[key] = env[key];
  }
  const take = (index) => {
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${argv[index]}`);
    return value;
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') options.json = true;
    else if (arg === '--proof-gw-dir') options.proofGwDir = take(i++);
    else if (arg === '--stage-dir') options.stageDir = take(i++);
    else if (arg === '--candidate') options.candidateSha = take(i++);
    else if (arg === '--docs-sha') options.docsSha = take(i++);
    else if (arg === '--artifact-dir') options.artifactDir = take(i++);
    else if (arg === '--observer-key-file') options.observerKeyFile = take(i++);
    else if (arg === '--seat') options.seat = take(i++);
    else if (arg === '--k6') options.k6 = take(i++);
    else if (arg === '--node') options.node = take(i++);
    else if (arg === '--grade-row') options.gradeRow = take(i++);
    else if (arg === '--cases') {
      const cases = take(i++).split(',').map((value) => value.trim()).filter(Boolean);
      for (const caseId of cases) if (!RRA_CASES[caseId]) throw new Error(`unknown case: ${caseId}`);
      // replay-restart replaces the gateway, so it always runs last.
      options.cases = RRA_CASE_IDS.filter((caseId) => cases.includes(caseId));
    } else if (arg === '--gateway-env') {
      const pair = take(i++);
      const key = pair.slice(0, pair.indexOf('='));
      const value = pair.slice(pair.indexOf('=') + 1);
      if (!GATEWAY_ENV_ALLOWED.test(key)) throw new Error(`--gateway-env ${key} is not allowed`);
      if (key === 'NODE_OPTIONS' && !value.split(/\s+/u).every((flag) => NODE_OPTIONS_ALLOWED.test(flag))) {
        throw new Error('--gateway-env NODE_OPTIONS may carry only --max-old-space-size and a loopback --inspect');
      }
      options.gatewayEnv[key] = value;
    } else throw new Error(`unexpected argument: ${arg}`);
  }
  return options;
}

/* ------------------------------------------------------------------------------------ */
/* /proc and network observation (read-only)                                             */
/* ------------------------------------------------------------------------------------ */

function procStat(pid, procRoot = '/proc') {
  try {
    const text = readFileSync(path.join(procRoot, String(pid), 'stat'), 'utf8');
    const fields = text.slice(text.lastIndexOf(')') + 2).split(' ');
    return { state: fields[0], ppid: Number(fields[1]), startTicks: Number(fields[19]) };
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
      if (fields[3] === '0A' && fields[1].slice(fields[1].lastIndexOf(':') + 1).toUpperCase() === hexPort) inodes.add(Number(fields[9]));
    }
  }
  return inodes;
}

/** The process that owns the listening socket on `port`, by scanning descendants of `pid` and `pid` itself. */
function listenerOwner(port, candidatePids, procRoot = '/proc') {
  const inodes = listenInodes(port, procRoot);
  if (inodes.size === 0) return null;
  for (const pid of candidatePids) {
    let entries = [];
    try {
      entries = readdirSync(path.join(procRoot, String(pid), 'fd'));
    } catch {
      continue;
    }
    for (const entry of entries) {
      try {
        const match = /^socket:\[(\d+)\]$/u.exec(readlinkSync(path.join(procRoot, String(pid), 'fd', entry)));
        if (match && inodes.has(Number(match[1]))) return { pid, startTicks: procStat(pid, procRoot)?.startTicks ?? null };
      } catch {
        // A descriptor closed between readdir and readlink.
      }
    }
  }
  return { pid: null, startTicks: null };
}

function portListening(port) {
  return listenInodes(port).size > 0;
}

function httpReady(port, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const request = http.get({ host: '127.0.0.1', port, path: '/readyz', agent: false, timeout: timeoutMs }, (response) => {
      response.resume();
      response.on('end', () => resolve(response.statusCode === 200));
    });
    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve(false));
  });
}

function unitState(unit) {
  const result = spawnSync('systemctl', ['--user', 'is-active', unit], { encoding: 'utf8', timeout: 5000 });
  return (result.stdout || '').trim() || null;
}

function readAuthorityTable(databasePath) {
  if (!existsSync(databasePath)) return { state: 'missing', rows: [] };
  let database;
  try {
    database = new DatabaseSync(databasePath, { readOnly: true, timeout: 1000 });
    return { state: 'read', rows: database.prepare('SELECT session_key, epoch FROM session_recipient_authority').all() };
  } catch (error) {
    return { state: 'unreadable', rows: [], reason: String(error?.code ?? 'error').slice(0, 60) };
  } finally {
    try {
      database?.close();
    } catch {
      // Nothing opened.
    }
  }
}

/** One gateway RPC over a fresh connection as the local CLI client (shared token keeps its scopes). */
function gatewayRpc({ port, token, method, params, timeoutMs = 15_000 }) {
  return new Promise((resolve) => {
    const connectId = `rra-c-${randomBytes(6).toString('hex')}`;
    const callId = `rra-r-${randomBytes(6).toString('hex')}`;
    let socket;
    const done = (value) => {
      clearTimeout(timer);
      try {
        socket?.close();
      } catch {
        // Already closed.
      }
      resolve(value);
    };
    const timer = setTimeout(() => done({ ok: false, error: 'timeout' }), timeoutMs);
    try {
      socket = new WebSocket(`ws://127.0.0.1:${port}`);
    } catch {
      return done({ ok: false, error: 'connect-failed' });
    }
    socket.onerror = () => done({ ok: false, error: 'transport-error' });
    socket.onmessage = (event) => {
      let frame;
      try {
        frame = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (frame.type === 'event' && frame.event === 'connect.challenge') {
        socket.send(JSON.stringify({
          type: 'req',
          id: connectId,
          method: 'connect',
          params: {
            minProtocol: 4,
            maxProtocol: 4,
            client: { id: 'cli', mode: 'cli', version: 'k6-proof-rra-v1', platform: 'node' },
            role: 'operator',
            scopes: ['operator.read', 'operator.write', 'operator.admin'],
            caps: [],
            commands: [],
            permissions: {},
            auth: { token },
          },
        }));
        return;
      }
      if (frame.type !== 'res') return;
      if (frame.id === connectId) {
        if (frame.ok !== true) return done({ ok: false, error: 'connect-rejected' });
        socket.send(JSON.stringify({ type: 'req', id: callId, method, params }));
        return;
      }
      if (frame.id === callId) done({ ok: frame.ok === true, frame });
    };
  });
}

export function defaultPlatform() {
  return {
    home: () => os.homedir(),
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    portListening,
    unitState,
    httpReady,
    readAuthorityTable,
    gatewayRpc,
    listenerOwner: (port, pids) => listenerOwner(port, pids),
    procStat: (pid) => procStat(pid),
    procEnvironHas: (pid, entry) => procEnvironHas(pid, entry),
    runCli: ({ node, args, env, timeoutMs }) => {
      const result = spawnSync(node, args, { env, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 });
      return { code: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
    },
    runK6: ({ k6, args, env }) => new Promise((resolve) => {
      const child = spawn(k6, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
      const chunks = [];
      child.stdout.on('data', (chunk) => chunks.push(chunk));
      child.stderr.on('data', (chunk) => chunks.push(chunk));
      child.on('error', () => resolve({ code: null, log: Buffer.concat(chunks).toString('utf8') }));
      child.on('close', (code) => resolve({ code, log: Buffer.concat(chunks).toString('utf8') }));
    }),
    spawnGateway: ({ node, args, env }) => {
      const child = spawn(node, args, { env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
      const lines = [];
      const exited = new Promise((resolve) => {
        child.on('exit', (code, signal) => resolve({ code, signal }));
        // A spawn that failed never ran: record it instead of crashing the control.
        child.on('error', (error) => {
          lines.push({ atMs: Date.now(), text: `[rra-control] gateway spawn error: ${String(error?.code ?? error?.message ?? 'error')}` });
          resolve({ code: null, signal: null, error: true });
        });
      });
      for (const stream of [child.stdout, child.stderr]) {
        let buffered = '';
        stream.on('data', (chunk) => {
          buffered += chunk.toString('utf8');
          const parts = buffered.split('\n');
          buffered = parts.pop();
          for (const text of parts) lines.push({ atMs: Date.now(), text });
        });
      }
      // The gateway leads its own process group (detached), so a stop reaches its children too. The
      // group is signalled only while the child is unreaped, so its id cannot have been reused.
      return {
        pid: child.pid,
        lines,
        exited,
        signal: (sig, { group = true } = {}) => {
          if (child.exitCode !== null || child.signalCode !== null) return;
          try {
            if (group) process.kill(-child.pid, sig);
            else child.kill(sig);
          } catch {
            child.kill(sig);
          }
        },
      };
    },
  };
}

/* ------------------------------------------------------------------------------------ */
/* Gates                                                                                 */
/* ------------------------------------------------------------------------------------ */

function readObserverKey(file, proofGwDir, refuse) {
  if (!file) {
    refuse('observer-key-missing', '--observer-key-file is required (mode 0600, outside the target)');
    return null;
  }
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

function isolatedEnv(target, platform) {
  return {
    HOME: platform.home(),
    PATH: '/usr/local/bin:/usr/bin:/bin',
    OPENCLAW_STATE_DIR: target.stateDir,
    OPENCLAW_CONFIG_PATH: target.configPath,
    OPENCLAW_GATEWAY_PORT: String(target.port),
  };
}

/**
 * Every refusal the control makes before it starts anything. Returns
 * { ok, refusals, target, gates, observerKey }. `gates` is what the case receipts record.
 */
export function evaluateRecipientAuthorityTarget(options, platform = defaultPlatform()) {
  const refusals = [];
  const refuse = (code, detail) => refusals.push({ code, detail });
  const gates = {
    candidatePinned: options.candidateSha === RRA_PINNED,
    buildInfoCommit: null,
    stateIsolated: false,
    modelSignIn: false,
    crossSessionTargetingEnabled: false,
    // Becomes true only once the control's own process owns the listener.
    gatewayStartedByHarness: false,
  };
  if (!gates.candidatePinned) refuse('candidate-not-pinned', `the candidate must be j12′ ${RRA_PINNED}, the merged head`);
  if (!isSha40(options.docsSha)) refuse('docs-sha-invalid', '--docs-sha must be the 40-hex docs harness commit');
  if (typeof options.artifactDir !== 'string' || !path.isAbsolute(options.artifactDir)) refuse('artifact-dir-invalid', '--artifact-dir must be absolute');
  const disposable = evaluateDisposableTarget({
    proofGwDir: options.proofGwDir,
    stageDir: options.stageDir,
    candidateSha: RRA_PINNED,
    home: platform.home(),
    fsApi: { existsSync, readFileSync, realpathSync, lstatSync },
    pathApi: path,
    portListening: platform.portListening,
    unitState: platform.unitState,
  });
  refusals.push(...disposable.refusals);
  const target = disposable.target;
  gates.buildInfoCommit = target.stageBuild?.commit ?? null;
  gates.stateIsolated = !disposable.refusals.some((entry) => /^(state-dir|stage-dir-live|home-invalid)/u.test(entry.code)) && Boolean(target.stateDir);
  let config = null;
  try {
    config = JSON.parse(readFileSync(target.configPath, 'utf8'));
  } catch {
    // evaluateDisposableTarget already refused a missing config.
  }
  if (config) {
    const continuation = evaluateContinuationConfig(config);
    refusals.push(...continuation.refusals);
    gates.crossSessionTargetingEnabled = continuation.ok;
  }
  const observerKey = readObserverKey(options.observerKeyFile, target.proofGwDir, refuse);
  // Model sign-in, only against a target that passed the disposable checks: the stage CLI is run
  // with a cleared environment that names the isolated state and config, never ~/.openclaw.
  if (disposable.ok && config) {
    const status = platform.runCli({
      node: options.node,
      args: [path.join(target.stageDir, 'openclaw.mjs'), 'models', 'status', '--json'],
      env: isolatedEnv(target, platform),
      timeoutMs: 60_000,
    });
    let parsed = null;
    try {
      parsed = JSON.parse(status.stdout.slice(status.stdout.indexOf('{')));
    } catch {
      parsed = null;
    }
    const signIn = evaluateModelSignIn(parsed, {
      stateDir: target.stateDir,
      primaryModel: config.agents?.defaults?.model?.primary,
      pathApi: path,
    });
    refusals.push(...signIn.refusals);
    gates.modelSignIn = signIn.ok;
  } else {
    refuse('model-sign-in-unchecked', 'the model sign-in is checked only on a disposable target that passed every other check');
  }
  return { ok: refusals.length === 0, refusals, target, gates, observerKey };
}

/* ------------------------------------------------------------------------------------ */
/* Case record                                                                           */
/* ------------------------------------------------------------------------------------ */

function hashKeyed(value) {
  return typeof value === 'string' && value ? sha256(value) : null;
}

/**
 * The epoch hash for `key` in the first readable sample with fromMs <= atMs < toMs (the last such
 * sample when `last`). null when no sample falls in the window or the key has no row in it.
 */
function epochIn(timeline, key, fromMs, toMs = Infinity, { last = false } = {}) {
  const samples = (Array.isArray(timeline) ? timeline : []).filter((sample) => sample.state === 'read' && sample.atMs >= fromMs && sample.atMs < toMs);
  const pick = last ? samples[samples.length - 1] : samples[0];
  const epoch = pick?.rows?.find((row) => row.session_key === key)?.epoch;
  return typeof epoch === 'string' ? sha256(epoch) : null;
}

/**
 * A refused return's reason from its j12′ lines naming the target at or after `afterMs`: the first
 * line's stage and time, every stage seen, and the delivery id as SHA-256 (it is itself a hash of
 * private session keys). null when no line names the target.
 */
function returnRefusalReason(logEntries, targetKey, afterMs) {
  const lines = findReturnRefusals(logEntries, targetKey, afterMs);
  if (lines.length === 0) return null;
  const first = lines[0];
  const ids = new Set(lines.map((line) => line.deliveryId).filter(Boolean));
  return {
    kind: 'return-refused',
    stage: first.stage,
    stages: [...new Set(lines.map((line) => line.stage))],
    reasonTexts: [...new Set(lines.map((line) => line.reason))],
    observedAtMs: first.atMs,
    generation: first.generation,
    deliveryIdHash: first.deliveryId ? sha256(first.deliveryId) : null,
    distinctDeliveryIds: ids.size,
    linesWithoutDeliveryId: lines.filter((line) => !line.deliveryId).length,
    lines: lines.length,
  };
}

/**
 * A refused kept continue_work wake's reason from its j12′ lines naming the session at or after
 * `afterMs`: the first line's stage and time, every stage and reason seen, and the refused
 * election's flowId as SHA-256 (it is a private custody record id). null when no line names it.
 */
function workRefusalReason(logEntries, sessionKey, afterMs) {
  const lines = findWorkRefusals(logEntries, sessionKey, afterMs);
  if (lines.length === 0) return null;
  const first = lines[0];
  return {
    kind: 'work-refused',
    stage: first.stage,
    stages: [...new Set(lines.map((line) => line.stage))],
    reasonTexts: [...new Set(lines.map((line) => line.reason))],
    observedAtMs: first.atMs,
    generation: first.generation,
    flowIdHash: sha256(first.flowId),
    distinctFlowIds: new Set(lines.map((line) => line.flowId)).size,
    lines: lines.length,
  };
}

/**
 * The continue_work case's capture, from the store. Its `scheduled` toolResult is written before the
 * turn schedules the election and captures the epoch, so the result says nothing about the capture.
 * During a case only the capture and the case's own transition write the session's authority row
 * (the legacy import and doctor's repair insert rows only outside a run), so the first
 * readable sample holding it is the capture (byMs), the readable sample before it, without the row,
 * bounds the capture from below (afterMs), and its epoch is the captured one. The grade checks that
 * the capture preceded the transition; the control reads the same capture before it sends the
 * transition (awaitWorkCapture).
 */
function captureFromStore(timeline, key) {
  const samples = (Array.isArray(timeline) ? timeline : []).filter((sample) => sample.state === 'read');
  const first = samples.findIndex((sample) => Array.isArray(sample.rows) && sample.rows.some((row) => row.session_key === key));
  if (first < 0) return { afterMs: null, byMs: null, captured: null };
  const epoch = samples[first].rows.find((row) => row.session_key === key)?.epoch;
  return {
    afterMs: first > 0 ? samples[first - 1].atMs : null,
    byMs: samples[first].atMs,
    captured: typeof epoch === 'string' ? sha256(epoch) : null,
  };
}

/**
 * The continue_work case's capture gate: read the sampler's store timeline (samples from `sinceMs`)
 * until the session's capture is there, as captureFromStore reads it, at most until `deadlineAtMs`
 * (rraWorkCaptureDeadline). Returns { deadlineAtMs, captured, capturedAfterMs, capturedByMs, inTime }:
 * the capture as last read (hashed), and whether it was read at a check no later than the deadline.
 * A null deadline is checked once and is never in time.
 */
export async function awaitWorkCapture({ timeline, key, sinceMs, deadlineAtMs, platform, pollMs = CAPTURE_POLL_MS }) {
  const deadline = Number.isFinite(deadlineAtMs) ? deadlineAtMs : null;
  for (;;) {
    const checkedAtMs = platform.now();
    const capture = captureFromStore((Array.isArray(timeline) ? timeline : []).filter((sample) => sample.atMs >= sinceMs), key);
    const open = deadline !== null && checkedAtMs <= deadline;
    const read = capture.byMs !== null && capture.captured !== null;
    if (read || !open) {
      return { deadlineAtMs: deadline, captured: capture.captured, capturedAfterMs: capture.afterMs, capturedByMs: capture.byMs, inTime: read && open };
    }
    await platform.sleep(pollMs);
  }
}

/** The continue_work case's epochs: its capture from the store, then as for every case. */
function workEpochs(timeline, key, transition) {
  const capture = captureFromStore(timeline, key);
  return {
    captured: capture.captured,
    capturedAfterMs: capture.afterMs,
    capturedByMs: capture.byMs,
    afterTransition: Number.isFinite(transition.settled_at_ms) ? epochIn(timeline, key, transition.settled_at_ms) : null,
    final: epochIn(timeline, key, capture.byMs ?? 0, Infinity, { last: true }),
  };
}

/**
 * Pending-sweep arming lines while the transition RPC was in flight. A parked row's copy can come
 * back after a delete consumed it only through a sweep that armed the row before the delete
 * committed (RRA_CASES.reassigned, otherFirstStages), so for a delete and re-create the span ends at
 * the delete's own response, before the create; a sweep after it can only refuse.
 */
function sweepAround(logEntries, transition, method) {
  const requested = transition.requested_at_ms;
  const settled = method === 'sessions.delete+sessions.create' ? transition.delete_settled_at_ms : transition.settled_at_ms;
  if (!Number.isFinite(requested) || !Number.isFinite(settled) || settled < requested) return { armedInTransition: null };
  return { armedInTransition: countSweepsArmed(logEntries, requested, settled) };
}

function routingAround(logEntries, keys, transition) {
  const requested = transition.requested_at_ms;
  const settled = transition.settled_at_ms;
  if (!Number.isFinite(requested) || !Number.isFinite(settled) || settled < requested) return { duringTransition: null, afterTransition: null };
  return {
    duringTransition: countRoutedAfter(logEntries, keys, requested, settled),
    afterTransition: countRoutedAfter(logEntries, keys, settled),
  };
}

/**
 * The router's first `Delivered to` line at or after `sinceMs` that names `targetKey` and comes from
 * `childKey`: the witness of a parked return's queued copy (RRA_PARKED_COPY_WITNESS_BYTES), as its
 * log time, else null. The same line the record reads as park.deliveredFromChildAtMs.
 */
export function findParkedCopy(lines, { sinceMs, targetKey, childKey }) {
  if (typeof targetKey !== 'string' || !targetKey || typeof childKey !== 'string' || !childKey) return null;
  return findRouted((Array.isArray(lines) ? lines : []).filter((line) => line.atMs >= sinceMs), targetKey, { childKey });
}

/**
 * Wait up to `waitMs` for the parked copy's witness in the gateway's live console lines, as
 * { parkedCopyAtMs } (null when it never came).
 */
async function witnessParkedCopy({ generation, sinceMs, targetKey, childKey, waitMs, platform }) {
  const deadline = platform.now() + waitMs;
  for (;;) {
    const parkedCopyAtMs = findParkedCopy(generation.process.lines, { sinceMs, targetKey, childKey });
    if (parkedCopyAtMs !== null || platform.now() >= deadline) return { parkedCopyAtMs };
    await platform.sleep(WITNESS_POLL_MS);
  }
}

/**
 * Assemble one case's public record from the scenario's evidence, the gateway's own log, the epoch
 * timeline and the generations the control started. Pure: no I/O. Session keys, delivery ids and
 * epochs leave only as SHA-256; log lines leave only as a reason kind and stage, a time and a
 * generation. A parked case's transition phase continues its drive (it carries the drive's state),
 * so its evidence is read for the transition and what follows; `witness` is the control's own
 * observation of the parked copy before it released that phase ({ parkedCopyAtMs, releasedAtMs }).
 * The continue_work case's transition phase likewise continues its drive; `captureGate` is the
 * control's read of its capture before it released that phase (awaitWorkCapture, plus releasedAtMs),
 * null when the drive handed nothing over.
 */
export function assembleCaseRecord({ caseId, runId, docsSha, gates, evidence, transitionEvidence = null, observeEvidence = null, witness = null, captureGate = null, logEntries, timeline, generations, restartedAtMs = null, cleanup, startedAtMs }) {
  const spec = rraCaseSpec(caseId);
  // The drive's evidence, carried forward by the transition phase when there was one.
  const driven = transitionEvidence ?? evidence;
  const final = observeEvidence ?? driven ?? {};
  const phases = [evidence, transitionEvidence, observeEvidence].filter(Boolean);
  const keys = evidence?.keys ?? {};
  const transition = driven?.transition ?? {};
  const capturedAt = evidence?.dispatch?.observed_at_ms;
  // The captured epoch is read after the scheduled toolResult and strictly before the transition,
  // so a transition that advanced it can never be read as the captured value.
  const capturedUntil = Number.isFinite(transition.requested_at_ms) && transition.requested_at_ms > capturedAt ? transition.requested_at_ms : Infinity;
  let reason = null;
  if (spec.reasonKind === 'admission-policy') {
    if (evidence?.dispatch?.status === 'error' && isAdmissionPolicyRefusal(evidence.dispatch.error_text)) {
      reason = { kind: 'admission-policy', observedAtMs: evidence.dispatch.observed_at_ms ?? null, generation: 0 };
    }
  } else if (spec.reasonKind === 'return-refused') {
    // A restart case's reason must come from the replacement's boot replay, so it is searched
    // only after the restart; an earlier refusal on the old generation leaves none to find.
    const after = spec.restart ? (restartedAtMs ?? Infinity) : (transition.requested_at_ms ?? startedAtMs);
    reason = returnRefusalReason(logEntries, keys.target, after);
  } else if (spec.reasonKind === 'work-refused') {
    reason = workRefusalReason(logEntries, keys.target, transition.requested_at_ms ?? startedAtMs);
  } else if (spec.reasonKind) {
    reason = findReason(logEntries, spec.reasonKind, { targetKey: keys.target, parentKey: keys.parent }, transition.requested_at_ms ?? startedAtMs);
  }
  const target = final.target_obs ?? {};
  const childKey = final.child?.key ?? evidence?.child?.key ?? null;
  return {
    schema: RRA_CASE_SCHEMA,
    row: RRA_ROW,
    case: caseId,
    runId,
    candidateSha: evidence?.candidate_sha ?? null,
    docsSha,
    gates,
    gateway: {
      generations: generations.map((generation) => ({
        index: generation.index,
        startedByHarness: generation.startedByHarness === true,
        ownedListenerThroughout: generation.ownedListenerThroughout === true,
      })),
      restartedAtMs,
    },
    scenario: {
      controlRunId: evidence?.control_run_id ?? null,
      transitionRunId: transitionEvidence ? transitionEvidence.control_run_id ?? null : undefined,
      observeRunId: observeEvidence ? observeEvidence.control_run_id ?? null : undefined,
      refusals: phases.flatMap((phase) => phase.refusals ?? []).map((text) => String(text).slice(0, 200)),
      preflightOk: phases.length > 0 && phases.every((phase) => phase.preflight?.ok === true),
    },
    keys: { parent: hashKeyed(keys.parent), target: hashKeyed(keys.target), ops: hashKeyed(keys.ops) },
    dispatch: {
      accepted: evidence?.dispatch?.accepted ?? null,
      status: evidence?.dispatch?.status ?? null,
      capturedAtMs: capturedAt ?? null,
      reasonHash: evidence?.reason_hash ?? null,
      reasonLength: evidence?.reason_length ?? null,
      delegateMode: evidence?.delegate_mode ?? null,
      resultMode: evidence?.dispatch?.result_mode ?? null,
      resultDelaySeconds: evidence?.dispatch?.result_delay_seconds ?? null,
      otherDelegateCalls: final.other_delegate_calls ?? null,
      ...(spec.tool === 'continue_work' ? { otherWorkCalls: final.other_work_calls ?? null } : {}),
    },
    child: {
      spawned: final.child?.spawned ?? null,
      bound: final.child?.bound === true,
      done: final.child?.done === true,
    },
    target: {
      primed: evidence?.target_primed === true,
      probeRan: final.probe_ran === true,
      probeSentAtMs: final.probe_sent_at_ms ?? null,
      probeTextSha256: final.probe_text_sha256 ?? null,
      probeReplied: target.probeReplied === true,
      ackRuns: target.ackRuns ?? null,
      wakeAckRuns: target.wakeAckRuns ?? null,
      probeAckRows: target.probeAckRows ?? null,
      primingAckRows: target.primingAckRows ?? null,
      uncreditedAckRows: target.uncreditedAckRows ?? null,
      foreignRuns: target.foreignRuns ?? null,
      unattributedAssistantRows: target.unattributedAssistantRows ?? null,
      returnMarkerRows: target.returnMarkerRows ?? null,
      adoptedDeliveryRows: target.adoptedDeliveryRows ?? null,
    },
    parent: { ackRows: final.parent_ack_rows ?? null },
    // allowed: the path its ack was read on, and the read that sent the fallback probe (🌊's ruling,
    // room msg 1567623059727458526). A probe-mediated ack is the probe run's, never the wake turn's.
    ack: spec.fallbackProbe
      ? {
          path: final.ack_path ?? null,
          fallbackDecision: final.fallback
            ? { decidedAtMs: final.fallback.decided_at_ms ?? null, wokenRuns: final.fallback.woken_runs ?? null, ackRuns: final.fallback.ack_runs ?? null }
            : null,
        }
      : null,
    preTransition: driven?.pre_transition_obs
      ? {
          ackRuns: driven.pre_transition_obs.ackRuns ?? null,
          foreignRuns: driven.pre_transition_obs.foreignRuns ?? null,
          adoptedDeliveryRows: driven.pre_transition_obs.adoptedDeliveryRows ?? null,
        }
      : null,
    transition: {
      method: spec.transition,
      ok: transition.ok ?? null,
      requestedAtMs: transition.requested_at_ms ?? null,
      settledAtMs: transition.settled_at_ms ?? null,
      ...(spec.transition === 'sessions.delete+sessions.create' ? { deleteSettledAtMs: transition.delete_settled_at_ms ?? null } : {}),
    },
    // The router's first line naming the target, and the first that also comes from this case's
    // child: allowed-silent's probe must follow that one (its return had reached the target).
    park: {
      deliveredToTargetAtMs: findRouted(logEntries, keys.target),
      deliveredFromChildAtMs: findRouted(logEntries, keys.target, { childKey }),
    },
    // A parked case: the control's witness of that same line before it released the transition.
    witness: spec.timing === 'parked'
      ? { parkedCopyAtMs: witness?.parkedCopyAtMs ?? null, releasedAtMs: witness?.releasedAtMs ?? null }
      : null,
    // The continue_work case: the control's read of the election's capture in the store, its deadline,
    // and the release of the transition (null: none was sent). The epoch leaves as SHA-256 only.
    captureGate: spec.timing === 'before-wake' && captureGate
      ? {
          deadlineAtMs: captureGate.deadlineAtMs ?? null,
          captured: captureGate.captured ?? null,
          capturedAfterMs: captureGate.capturedAfterMs ?? null,
          capturedByMs: captureGate.capturedByMs ?? null,
          releasedAtMs: captureGate.releasedAtMs ?? null,
        }
      : null,
    // Router lines for this return, the target named or its child as the source (the child key
    // stays private): while the transition RPC was in flight, and once it had settled. A refused
    // return must leave none after the settle at j12′.
    routing: spec.family === 'refusal' && spec.expectChild !== false
      ? routingAround(logEntries, { targetKey: keys.target, childKey }, transition)
      : null,
    // The gateway's pending-sweep lines while the transition (for a delete and re-create, the
    // delete) was in flight; they name no session.
    sweep: spec.family === 'refusal' && spec.expectChild !== false ? sweepAround(logEntries, transition, spec.transition) : null,
    epochs: spec.tool === 'continue_work'
      ? workEpochs(timeline, keys.target, transition)
      : {
          captured: Number.isFinite(capturedAt) ? epochIn(timeline, keys.target, capturedAt, capturedUntil) : null,
          afterTransition: Number.isFinite(transition.settled_at_ms) ? epochIn(timeline, keys.target, transition.settled_at_ms) : null,
          final: epochIn(timeline, keys.target, Number.isFinite(capturedAt) ? capturedAt : 0, Infinity, { last: true }),
        },
    reason,
    config: spec.transition === 'config.patch' ? { restored: driven?.config?.restored === true } : null,
    trace: null,
    cleanup,
  };
}

function unsignedCanonical(value) {
  const { integrity: _integrity, ...unsigned } = value;
  return canonicalJson(unsigned);
}

export function sealCaseReceipt(record, key) {
  const graded = { ...record, grade: gradeRecipientAuthorityCase(record) };
  return sealSignedObserverReceipt({ receipt: graded, signingKey: key, canonicalize: unsignedCanonical, algorithm: RRA_OBSERVER_ALGORITHM });
}

export function verifyCaseReceipt(receipt, key) {
  if (!receipt || typeof receipt !== 'object') return false;
  return validateSignedObserverReceiptIntegrity({ receipt, signingKey: key, canonicalize: unsignedCanonical, algorithm: RRA_OBSERVER_ALGORITHM });
}

/** Raw values that must never appear in a public receipt. */
export function publicLeaks(publicText, secrets) {
  return secrets.filter((secret) => typeof secret === 'string' && secret.length >= 8 && publicText.includes(secret));
}

/* ------------------------------------------------------------------------------------ */
/* Run                                                                                   */
/* ------------------------------------------------------------------------------------ */

async function startGeneration({ index, target, options, runId, privateDir, platform }) {
  const env = {
    ...isolatedEnv(target, platform),
    TMPDIR: path.join(privateDir, 'tmp'),
    OPENCLAW_SUPERVISOR_MODE: 'external',
    [RUN_MARKER_ENV]: runId,
    ...options.gatewayEnv,
  };
  mkdirSync(env.TMPDIR, { recursive: true, mode: 0o700 });
  const process_ = platform.spawnGateway({ node: options.node, args: [path.join(target.stageDir, 'dist', 'index.js'), 'gateway', '--port', String(target.port)], env });
  let stat = null;
  for (let attempt = 0; attempt < 20 && !Number.isSafeInteger(stat?.startTicks); attempt += 1) {
    stat = platform.procStat(process_.pid);
    if (!Number.isSafeInteger(stat?.startTicks)) await platform.sleep(50);
  }
  // Without start ticks the listener can never be proven this process's, so it is never owned.
  const generation = { index, runId, pid: process_.pid, startTicks: stat?.startTicks ?? null, process: process_, startedByHarness: true, ownedListenerThroughout: false };
  liveGenerations.add(generation);
  process_.exited.then(() => {
    generation.exited = true;
  });
  const deadline = platform.now() + READY_TIMEOUT_MS;
  while (platform.now() < deadline) {
    const owner = platform.listenerOwner(target.port, [process_.pid]);
    if (owner && listenerOwnedBy(owner, generation) && (await platform.httpReady(target.port))) {
      generation.ownedListenerThroughout = true;
      return generation;
    }
    await platform.sleep(500);
  }
  return generation;
}

function verifyOwnership(generation, target, platform) {
  const owner = platform.listenerOwner(target.port, [generation.pid]);
  const owned = listenerOwnedBy(owner, generation) && platform.procEnvironHas(generation.pid, `${RUN_MARKER_ENV}=${generation.runId}`);
  if (!owned) generation.ownedListenerThroughout = false;
  return owned;
}

async function stopGeneration(generation, platform) {
  liveGenerations.delete(generation);
  if (generation.exited) return { stopped: true, signalled: false };
  const stat = platform.procStat(generation.pid);
  if (!stat) return { stopped: true, signalled: false };
  // The process handle is the control's own child, so signalling it cannot reach a recycled PID;
  // the start ticks and run marker are checked as well whenever they are known.
  if (Number.isSafeInteger(generation.startTicks) && stat.startTicks !== generation.startTicks) return { stopped: true, signalled: false };
  // With its run marker readable the whole group is stopped; without it only the control's own
  // child handle is signalled, which cannot reach another process.
  const group = platform.procEnvironHas(generation.pid, `${RUN_MARKER_ENV}=${generation.runId}`);
  generation.process.signal('SIGTERM', { group });
  const deadline = platform.now() + STOP_GRACE_MS;
  while (platform.now() < deadline) {
    const current = platform.procStat(generation.pid);
    if (generation.exited || !current || (Number.isSafeInteger(generation.startTicks) && current.startTicks !== generation.startTicks) || current.state === 'Z') {
      return { stopped: true, signalled: true };
    }
    await platform.sleep(250);
  }
  generation.process.signal('SIGKILL', { group });
  const killDeadline = platform.now() + 2_000;
  while (platform.now() < killDeadline) {
    if (generation.exited || !platform.procStat(generation.pid)) return { stopped: true, signalled: true, killed: true };
    await platform.sleep(100);
  }
  return { stopped: false, signalled: true, killed: true };
}

async function runScenario({ caseId, phase, state, runId, target, options, privateDir, platform }) {
  const env = {
    HOME: platform.home(),
    PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
    OPENCLAW_ROW_MANIFEST: MANIFEST,
    OPENCLAW_GATEWAY_WS: `ws://127.0.0.1:${target.port}`,
    OPENCLAW_GATEWAY_TOKEN: target.token,
    OPENCLAW_CANDIDATE_SHA: RRA_PINNED,
    OPENCLAW_SEAT_NAME: options.seat || 'isolated-proof-gateway',
    OPENCLAW_RCD_RA_CASE: caseId,
    OPENCLAW_RCD_RA_RUN: runId,
    OPENCLAW_RCD_RA_PHASE: phase,
    ...(state ? { OPENCLAW_RCD_RA_STATE: JSON.stringify(state) } : {}),
    ...options.timing,
  };
  const result = await platform.runK6({ k6: options.k6, args: ['run', '--no-usage-report', SCENARIO], env });
  writeFileSync(path.join(privateDir, `${caseId}-${phase}.k6.log`), result.log, { mode: 0o600 });
  const records = extractEvidence(result.log).filter((record) => record.row === RRA_ROW && record.case === caseId && record.phase === phase);
  return records.length === 1 ? records[0] : null;
}

async function restartGeneration({ generation, target, options, runId, privateDir, platform, next }) {
  // Only the control's own generation may be asked to restart.
  if (!verifyOwnership(generation, target, platform)) return { ok: false, reason: 'not-owned-at-restart' };
  const requested = await platform.gatewayRpc({
    port: target.port,
    token: target.token,
    method: 'gateway.restart.request',
    params: { reason: 'gateway.restart', skipDeferral: true },
  });
  if (!requested.ok) return { ok: false, reason: 'restart-not-accepted' };
  const exit = await Promise.race([generation.process.exited, platform.sleep(60_000).then(() => null)]);
  if (!exit || exit.code !== 0) return { ok: false, reason: 'old-generation-did-not-exit-0' };
  const consumed = platform.runCli({
    node: options.node,
    args: [path.join(target.stageDir, 'openclaw.mjs'), 'gateway', 'restart-handoff', 'consume', '--expected-pid', String(generation.pid), '--json'],
    env: isolatedEnv(target, platform),
    timeoutMs: 30_000,
  });
  if (consumed.code !== 0) return { ok: false, reason: 'handoff-not-consumed' };
  const restartedAtMs = platform.now();
  const replacement = await startGeneration({ index: next, target, options, runId, privateDir, platform });
  return { ok: replacement.ownedListenerThroughout, replacement, restartedAtMs };
}

export async function runRecipientAuthorityRow(options, platform = defaultPlatform()) {
  const evaluated = evaluateRecipientAuthorityTarget(options, platform);
  if (!evaluated.ok) {
    return { ok: false, refusal: { schema: RRA_REFUSAL_SCHEMA, row: RRA_ROW, refusals: evaluated.refusals } };
  }
  const { target, gates, observerKey } = evaluated;
  const runId = `rra-${randomBytes(8).toString('hex')}`;
  const privateDir = `${options.artifactDir}.private`;
  mkdirSync(options.artifactDir, { recursive: true });
  mkdirSync(privateDir, { recursive: true, mode: 0o700 });
  const startedAtMs = platform.now();
  const generations = [];
  let current = await startGeneration({ index: 0, target, options, runId, privateDir, platform });
  generations.push(current);
  if (!current.ownedListenerThroughout) {
    await stopGeneration(current, platform);
    return { ok: false, refusal: { schema: RRA_REFUSAL_SCHEMA, row: RRA_ROW, refusals: [{ code: 'gateway-not-started-by-harness', detail: 'the listener never became the control-started process' }] } };
  }
  const caseGates = { ...gates, gatewayStartedByHarness: true };
  const timeline = [];
  let sampling = true;
  const authorityDb = path.join(target.stateDir, 'agents', 'main', 'agent', 'openclaw-agent.sqlite');
  // Every 500 ms: the epoch table, read-only, and whether the listener is still the control's own
  // current generation (between a restart's old exit and its replacement there is none to own).
  let restarting = false;
  const sampler = (async () => {
    while (sampling) {
      timeline.push({ atMs: platform.now(), ...platform.readAuthorityTable(authorityDb) });
      if (!restarting) verifyOwnership(current, target, platform);
      await platform.sleep(EPOCH_SAMPLE_MS);
    }
  })();
  const receipts = [];
  const stops = [];
  const secrets = [target.token, observerKey];
  try {
    for (const caseId of options.cases) {
      const spec = RRA_CASES[caseId];
      const caseStart = platform.now();
      const ownedBefore = verifyOwnership(current, target, platform);
      const evidence = ownedBefore ? await runScenario({ caseId, phase: 'drive', runId, target, options, privateDir, platform }) : null;
      // A parked case: witness the return's queued copy, then release the transition (🌊's ruling,
      // room msg 1567623059727458526). No witness, a drive that recorded a refusal or failed its
      // preflight, or a gateway the control no longer owns, and the transition is never sent.
      let transitionEvidence = null;
      let witness = null;
      let captureGate = null;
      const driveClean = Array.isArray(evidence?.refusals) && evidence.refusals.length === 0 && evidence?.preflight?.ok === true;
      // The continue_work case: its election captures after the `scheduled` result the drive ended
      // on, so read the capture in the store first, by the deadline its own result sets, then release
      // the transition. No capture by then, a drive that recorded a refusal or failed its preflight,
      // or a gateway the control no longer owns, and the transition is never sent.
      if (spec.timing === 'before-wake' && evidence?.handoff?.ready_for_capture && driveClean) {
        const read = await awaitWorkCapture({
          timeline,
          key: evidence.keys?.target,
          sinceMs: caseStart,
          deadlineAtMs: rraWorkCaptureDeadline({ capturedAtMs: evidence.dispatch?.observed_at_ms, resultDelaySeconds: evidence.dispatch?.result_delay_seconds }),
          platform,
        });
        captureGate = { ...read, releasedAtMs: null };
        if (read.inTime && verifyOwnership(current, target, platform)) {
          captureGate.releasedAtMs = platform.now();
          transitionEvidence = await runScenario({ caseId, phase: 'transition', state: evidence, runId, target, options, privateDir, platform });
        }
      }
      if (spec.timing === 'parked' && evidence?.handoff?.ready_for_witness && driveClean) {
        witness = await witnessParkedCopy({
          generation: current,
          sinceMs: caseStart,
          targetKey: evidence.keys?.target,
          childKey: evidence.child?.key,
          waitMs: Number(options.timing.OPENCLAW_RCD_RA_WITNESS_WAIT_MS ?? WITNESS_WAIT_MS),
          platform,
        });
        if (witness.parkedCopyAtMs !== null && verifyOwnership(current, target, platform)) {
          witness.releasedAtMs = platform.now();
          transitionEvidence = await runScenario({ caseId, phase: 'transition', state: evidence, runId, target, options, privateDir, platform });
        }
      }
      // replay-restart's restart follows its transition phase, never its drive.
      const handedOver = spec.timing === 'parked' ? transitionEvidence : evidence;
      let observeEvidence = null;
      let restartedAtMs = null;
      if (spec.restart && handedOver?.handoff?.ready_for_restart) {
        restarting = true;
        const restarted = await restartGeneration({ generation: current, target, options, runId, privateDir, platform, next: generations.length });
        restarting = false;
        if (restarted.replacement) generations.push(restarted.replacement);
        if (restarted.ok) {
          current = restarted.replacement;
          restartedAtMs = restarted.restartedAtMs;
          observeEvidence = await runScenario({ caseId, phase: 'observe', state: handedOver, runId, target, options, privateDir, platform });
        }
      }
      verifyOwnership(current, target, platform);
      const logEntries = generations.flatMap((generation) => generation.process.lines.map((line) => ({ ...line, generation: generation.index })));
      writeFileSync(path.join(privateDir, `${caseId}.gateway.log`), logEntries.filter((line) => line.atMs >= caseStart).map((line) => `${line.atMs} g${line.generation} ${line.text}`).join('\n'), { mode: 0o600 });
      if (evidence) {
        const caseDir = path.join(privateDir, caseId);
        mkdirSync(caseDir, { recursive: true, mode: 0o700 });
        // collect-continuation-trace.mjs reads the case's evidence from here.
        writeFileSync(path.join(caseDir, 'evidence.jsonl'), `${JSON.stringify({ ...evidence, row: RRA_ROW })}\n`, { mode: 0o600 });
      }
      const caseGenerations = generations.filter((generation) => generation.index <= current.index);
      const record = assembleCaseRecord({
        caseId,
        runId,
        docsSha: options.docsSha,
        gates: caseGates,
        evidence: evidence ?? { candidate_sha: RRA_PINNED, control_run_id: null },
        transitionEvidence,
        observeEvidence,
        witness,
        captureGate,
        logEntries: logEntries.filter((line) => line.atMs >= caseStart),
        timeline: timeline.filter((sample) => sample.atMs >= caseStart),
        generations: caseGenerations,
        restartedAtMs,
        cleanup: { gatewayStopped: false, residue: true },
        startedAtMs: caseStart,
      });
      receipts.push(record);
      for (const value of Object.values(evidence?.keys ?? {})) secrets.push(value);
      // The child's key and every refused row's id stay private too: the record carries hashes only.
      secrets.push(evidence?.child?.key, transitionEvidence?.child?.key, observeEvidence?.child?.key);
      // So does a refused election's flowId.
      for (const line of logEntries) {
        if (line.atMs < caseStart) continue;
        const refusal = parseReturnRefusedLine(line.text);
        if (refusal?.deliveryId) secrets.push(refusal.deliveryId);
        const workRefusal = parseWorkRefusedLine(line.text);
        if (workRefusal?.flowId) secrets.push(workRefusal.flowId);
      }
    }
  } finally {
    sampling = false;
    await sampler;
    // Stop what this run started, whatever happened above.
    for (const generation of generations) stops.push(await stopGeneration(generation, platform));
  }
  const cleanup = { gatewayStopped: stops.every((stop) => stop.stopped), residue: platform.portListening(target.port) };
  const written = [];
  for (const record of receipts) {
    const sealed = sealCaseReceipt({ ...record, cleanup }, observerKey);
    const body = `${JSON.stringify(sealed, null, 2)}\n`;
    const epochSecrets = timeline.flatMap((sample) => (sample.rows ?? []).map((row) => row.epoch));
    const leaks = publicLeaks(body, [...secrets, ...epochSecrets]);
    if (leaks.length) throw new Error(`refusing to write a public receipt that carries ${leaks.length} private value(s)`);
    const caseDir = path.join(options.artifactDir, record.case);
    mkdirSync(caseDir, { recursive: true });
    writeFileSync(path.join(caseDir, 'case-receipt.json'), body);
    written.push({ case: record.case, verdict: sealed.grade.verdict });
  }
  return { ok: true, runId, startedAtMs, cases: written };
}

/* ------------------------------------------------------------------------------------ */
/* Row grade                                                                             */
/* ------------------------------------------------------------------------------------ */

export function gradeRowFromArtifacts(artifactDir, observerKey, { privateDir = `${artifactDir}.private` } = {}) {
  const entries = [];
  for (const caseId of RRA_CASE_IDS) {
    const file = path.join(artifactDir, caseId, 'case-receipt.json');
    if (!existsSync(file)) continue;
    let receipt = null;
    try {
      receipt = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      entries.push({ record: null, verified: false });
      continue;
    }
    const verified = verifyCaseReceipt(receipt, observerKey) && receipt.case === caseId;
    const { integrity: _integrity, grade: _grade, ...record } = receipt;
    // A case's trace counts only from its own collector receipt, matched by its own fingerprint.
    for (const dir of [path.join(artifactDir, caseId), path.join(privateDir, caseId)]) {
      const correlation = path.join(dir, 'continuation-trace-correlation.json');
      if (!existsSync(correlation)) continue;
      try {
        if (traceCorrelationMatches(record, JSON.parse(readFileSync(correlation, 'utf8')))) record.trace = { correlated: true };
      } catch {
        // An unreadable receipt is no trace.
      }
    }
    entries.push({ record, verified });
  }
  return gradeRecipientAuthorityRow(entries);
}

/* ------------------------------------------------------------------------------------ */
/* CLI                                                                                   */
/* ------------------------------------------------------------------------------------ */

function installInterruptCleanup(platform) {
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, async () => {
      if (stopping) return;
      stopping = true;
      for (const generation of [...liveGenerations]) await stopGeneration(generation, platform);
      process.exit(130);
    });
  }
  // Last resort on any exit path (a crash included): kill what is still live, synchronously.
  process.on('exit', () => {
    for (const generation of liveGenerations) generation.process.signal('SIGKILL', { group: false });
  });
}

async function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(error.message);
    return 2;
  }
  if (options.gradeRow) {
    const refusals = [];
    const key = readObserverKey(options.observerKeyFile, null, (code, detail) => refusals.push({ code, detail }));
    if (!key) {
      console.log(JSON.stringify({ schema: RRA_REFUSAL_SCHEMA, row: RRA_ROW, refusals }, null, 2));
      return 2;
    }
    const verdict = gradeRowFromArtifacts(path.resolve(options.gradeRow), key);
    console.log(JSON.stringify(verdict, null, 2));
    return verdict.verdict === 'PASS-candidate' ? 0 : 1;
  }
  const platform = defaultPlatform();
  installInterruptCleanup(platform);
  const result = await runRecipientAuthorityRow(options, platform);
  console.log(JSON.stringify(result.ok ? result : result.refusal, null, 2));
  return result.ok ? 0 : 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv).then((code) => {
    process.exitCode = code;
  });
}
