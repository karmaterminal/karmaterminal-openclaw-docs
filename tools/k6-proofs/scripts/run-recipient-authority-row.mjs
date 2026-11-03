#!/usr/bin/env node
/**
 * run-recipient-authority-row.mjs: the control for R-CD-RECIPIENT-AUTHORITY, the live isolated-gateway
 * row at pinned j12 (🌊's ruling, room msg 1567077062139838485; docs#536).
 *
 * It owns one disposable gateway that frond-scribe scripts/proof-gw/composite-launcher.sh set up,
 * signed in (login) and stopped:
 *
 *   1. refuse, before anything starts: a candidate other than j12; anything that is not a stopped
 *      $HOME/proof-gw/comp-<sha8> gateway on a free, non-live loopback port with its own token and no
 *      channels, whose stage dist/build-info.json commit is j12 and whose state is not under the live
 *      ~/.openclaw (evaluateDisposableTarget); continuation or cross-session targeting disabled in its
 *      config; no isolated model sign-in (openclaw models status --json against the isolated state);
 *      an observer key that is missing, loose or inside the target;
 *   2. start the gateway itself, with a cleared environment (the isolated state and config, its own
 *      TMPDIR so its file log is not the live one, OPENCLAW_SUPERVISOR_MODE=external so a restart
 *      takes the supervised branch, and a run marker), and refuse to go on unless the listener is
 *      that process: PID and kernel start ticks, before and after every case;
 *   3. run scenarios/r-cd-recipient-authority.js once per case against it, while capturing the
 *      gateway's own output and sampling the session_recipient_authority table read-only;
 *   4. for replay-restart, after the drive phase: gateway.restart.request, wait for the old process to
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
 * a process it did not start. The product path at j12 is in the scenario header.
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
  RRA_J12,
  RRA_ROW,
  evaluateContinuationConfig,
  evaluateModelSignIn,
  findReason,
  findRouted,
  gradeRecipientAuthorityCase,
  gradeRecipientAuthorityRow,
  isAdmissionPolicyRefusal,
  isSha40,
  listenerOwnedBy,
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
const TIMING_ENV = ['OPENCLAW_RCD_RA_DELAY_SECONDS', 'OPENCLAW_RCD_RA_POLL_MS', 'OPENCLAW_RCD_RA_WINDOW_MS', 'OPENCLAW_RCD_RA_PARK_MS', 'OPENCLAW_RCD_RA_SWEEP_WAIT_MS', 'OPENCLAW_RCD_RA_BOOT_WAIT_MS', 'OPENCLAW_RCD_RA_DUPLICATE_WAIT_MS', 'OPENCLAW_RCD_RA_SAMPLE_GAP_MS'];
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
      const exited = new Promise((resolve) => child.on('exit', (code, signal) => resolve({ code, signal })));
      for (const stream of [child.stdout, child.stderr]) {
        let buffered = '';
        stream.on('data', (chunk) => {
          buffered += chunk.toString('utf8');
          const parts = buffered.split('\n');
          buffered = parts.pop();
          for (const text of parts) lines.push({ atMs: Date.now(), text });
        });
      }
      return { pid: child.pid, lines, exited, signal: (sig) => child.kill(sig) };
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
    candidatePinned: options.candidateSha === RRA_J12,
    buildInfoCommit: null,
    stateIsolated: false,
    modelSignIn: false,
    crossSessionTargetingEnabled: false,
    // Becomes true only once the control's own process owns the listener.
    gatewayStartedByHarness: false,
  };
  if (!gates.candidatePinned) refuse('candidate-not-pinned', `the candidate must be j12 ${RRA_J12}`);
  if (!isSha40(options.docsSha)) refuse('docs-sha-invalid', '--docs-sha must be the 40-hex docs harness commit');
  if (typeof options.artifactDir !== 'string' || !path.isAbsolute(options.artifactDir)) refuse('artifact-dir-invalid', '--artifact-dir must be absolute');
  const disposable = evaluateDisposableTarget({
    proofGwDir: options.proofGwDir,
    stageDir: options.stageDir,
    candidateSha: RRA_J12,
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
 * Assemble one case's public record from the scenario's evidence, the gateway's own log, the epoch
 * timeline and the generations the control started. Pure: no I/O. Session keys and epochs leave
 * only as SHA-256; log lines leave only as a reason kind, a time and a generation.
 */
export function assembleCaseRecord({ caseId, runId, docsSha, gates, evidence, observeEvidence = null, logEntries, timeline, generations, restartedAtMs = null, cleanup, startedAtMs }) {
  const spec = RRA_CASES[caseId];
  const final = observeEvidence ?? evidence ?? {};
  const keys = evidence?.keys ?? {};
  const transition = evidence?.transition ?? {};
  const capturedAt = evidence?.dispatch?.observed_at_ms;
  // The captured epoch is read after the scheduled toolResult and strictly before the transition,
  // so a transition that advanced it can never be read as the captured value.
  const capturedUntil = Number.isFinite(transition.requested_at_ms) && transition.requested_at_ms > capturedAt ? transition.requested_at_ms : Infinity;
  let reason = null;
  if (spec.reasonKind === 'admission-policy') {
    if (evidence?.dispatch?.status === 'error' && isAdmissionPolicyRefusal(evidence.dispatch.error_text)) {
      reason = { kind: 'admission-policy', observedAtMs: evidence.dispatch.observed_at_ms ?? null, generation: 0 };
    }
  } else if (spec.reasonKind) {
    // A restart case's reason must come from the replacement's boot replay, so it is searched
    // only after the restart; an earlier sweep refusal on the old generation leaves none to find.
    const after = spec.restart ? (restartedAtMs ?? Infinity) : (transition.requested_at_ms ?? startedAtMs);
    reason = findReason(logEntries, spec.reasonKind, { targetKey: keys.target, parentKey: keys.parent }, after);
  }
  const target = final.target_obs ?? {};
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
      observeRunId: observeEvidence ? observeEvidence.control_run_id ?? null : undefined,
      refusals: [...(evidence?.refusals ?? []), ...(observeEvidence?.refusals ?? [])].map((text) => String(text).slice(0, 200)),
      preflightOk: evidence?.preflight?.ok === true,
    },
    keys: { parent: hashKeyed(keys.parent), target: hashKeyed(keys.target), ops: hashKeyed(keys.ops) },
    dispatch: {
      accepted: evidence?.dispatch?.accepted ?? null,
      status: evidence?.dispatch?.status ?? null,
      capturedAtMs: capturedAt ?? null,
      reasonHash: evidence?.reason_hash ?? null,
      reasonLength: evidence?.reason_length ?? null,
      delegateMode: evidence?.delegate_mode ?? null,
    },
    child: {
      spawned: final.child?.spawned ?? null,
      bound: final.child?.bound === true,
      done: final.child?.done === true,
    },
    target: {
      primed: evidence?.target_primed === true,
      probeRan: final.probe_ran === true,
      probeReplied: target.probeReplied === true,
      ackRuns: target.ackRuns ?? null,
      foreignRuns: target.foreignRuns ?? null,
      unattributedAssistantRows: target.unattributedAssistantRows ?? null,
      returnMarkerRows: target.returnMarkerRows ?? null,
      adoptedDeliveryRows: target.adoptedDeliveryRows ?? null,
    },
    parent: { ackRows: final.parent_ack_rows ?? null },
    transition: {
      method: spec.transition,
      ok: transition.ok ?? null,
      requestedAtMs: transition.requested_at_ms ?? null,
      settledAtMs: transition.settled_at_ms ?? null,
    },
    park: { deliveredToTargetAtMs: findRouted(logEntries, keys.target) },
    epochs: {
      captured: Number.isFinite(capturedAt) ? epochIn(timeline, keys.target, capturedAt, capturedUntil) : null,
      afterTransition: Number.isFinite(transition.settled_at_ms) ? epochIn(timeline, keys.target, transition.settled_at_ms) : null,
      final: epochIn(timeline, keys.target, Number.isFinite(capturedAt) ? capturedAt : 0, Infinity, { last: true }),
    },
    reason,
    config: spec.transition === 'config.patch' ? { restored: evidence?.config?.restored === true } : null,
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
  if (!platform.procEnvironHas(generation.pid, `${RUN_MARKER_ENV}=${generation.runId}`)) return { stopped: false, signalled: false };
  generation.process.signal('SIGTERM');
  const deadline = platform.now() + STOP_GRACE_MS;
  while (platform.now() < deadline) {
    const current = platform.procStat(generation.pid);
    if (generation.exited || !current || (Number.isSafeInteger(generation.startTicks) && current.startTicks !== generation.startTicks) || current.state === 'Z') {
      return { stopped: true, signalled: true };
    }
    await platform.sleep(250);
  }
  generation.process.signal('SIGKILL');
  return { stopped: true, signalled: true, killed: true };
}

async function runScenario({ caseId, phase, state, runId, target, options, privateDir, platform }) {
  const env = {
    HOME: platform.home(),
    PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
    OPENCLAW_ROW_MANIFEST: MANIFEST,
    OPENCLAW_GATEWAY_WS: `ws://127.0.0.1:${target.port}`,
    OPENCLAW_GATEWAY_TOKEN: target.token,
    OPENCLAW_CANDIDATE_SHA: RRA_J12,
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
      const caseStart = platform.now();
      const ownedBefore = verifyOwnership(current, target, platform);
      const evidence = ownedBefore ? await runScenario({ caseId, phase: 'drive', runId, target, options, privateDir, platform }) : null;
      let observeEvidence = null;
      let restartedAtMs = null;
      if (RRA_CASES[caseId].restart && evidence?.handoff?.ready_for_restart) {
        restarting = true;
        const restarted = await restartGeneration({ generation: current, target, options, runId, privateDir, platform, next: generations.length });
        restarting = false;
        if (restarted.replacement) generations.push(restarted.replacement);
        if (restarted.ok) {
          current = restarted.replacement;
          restartedAtMs = restarted.restartedAtMs;
          observeEvidence = await runScenario({ caseId, phase: 'observe', state: evidence, runId, target, options, privateDir, platform });
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
        evidence: evidence ?? { candidate_sha: RRA_J12, control_run_id: null },
        observeEvidence,
        logEntries: logEntries.filter((line) => line.atMs >= caseStart),
        timeline: timeline.filter((sample) => sample.atMs >= caseStart),
        generations: caseGenerations,
        restartedAtMs,
        cleanup: { gatewayStopped: false, residue: true },
        startedAtMs: caseStart,
      });
      receipts.push(record);
      for (const value of Object.values(evidence?.keys ?? {})) secrets.push(value);
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
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, async () => {
      for (const generation of [...liveGenerations]) await stopGeneration(generation, platform);
      process.exit(130);
    });
  }
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
