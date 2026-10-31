/**
 * R-CD-RETURN-COVENANT-AUTHORITY disposable real-restart control: the target guard, the
 * observation plan, the grader and the public-safety projection.
 *
 * Nothing here starts, stops or signals a process. The driver
 * (scripts/run-return-covenant-restart-control.mjs) owns process lifecycle and feeds the
 * record it observed into gradeRestartControl(); the grader decides the candidate verdict
 * only from that record. The product path this control exercises is mapped, with
 * path:line anchors at F′, in scenarios/r-cd-return-covenant-authority.js.
 */
import { createHash } from 'node:crypto';
import { canonicalJson } from './canonical-json.mjs';
import {
  sealSignedObserverReceipt,
  validateSignedObserverReceiptIntegrity,
} from './signed-observer-receipt.mjs';

export const RCC_ROW = 'R-CD-RETURN-COVENANT-AUTHORITY';
export const RCC_SCHEMA = 'openclaw.k6.return-covenant-restart-control.v1';
export const RCC_REFUSAL_SCHEMA = 'openclaw.k6.return-covenant-restart-control-refusal.v1';
export const RCC_ROW_VERDICT_SCHEMA = 'openclaw.k6.return-covenant-row-verdict.v1';
// A launcher-held key the gateway processes never receive (they get a cleared env), so the
// candidate under test cannot sign its own observation. Distinct from the gateway-token
// HMAC that R-CD-2/R-CD-TOKEN use.
export const RCC_OBSERVER_ALGORITHM = 'hmac-sha256-proof-observer-key-v1';
export const RCC_CASES = Object.freeze([
  'positive',
  'negative-replacement-never-usable',
  'control-update-respawn-fallback',
  'control-update-respawn-runtime-unavailable',
]);
// Every case but the positive exists to refuse PASS: the row's supervised negative and the
// update-respawn controls. None can ever grade PASS.
export const RCC_NEGATIVE_CASES = Object.freeze(RCC_CASES.filter((caseKind) => caseKind !== 'positive'));
/**
 * Which F′ restart branch each case drives, how, and what kind of evidence it is (anchors at
 * f15237ec92). 🌊's final scope ruling (Discord msg 1565927316687691777) scopes the row's claim to
 * the supervised branch the fleet runs:
 * - supervised: OPENCLAW_SUPERVISOR_MODE=external, so the run loop writes the restart handoff,
 *   closes and exits (src/cli/gateway-cli/run-loop.ts:497-561). Systemd-supervised fleet seats
 *   take this same branch with supervisor systemd. It has no in-process fallback once the
 *   handoff is written. Kinds row-positive and row-negative: the row verdict is graded from
 *   these two cases only (gradeReturnCovenantRow).
 * - spawned: no supervisor at all, and the update-process reason update.run
 *   (run-loop-request.ts:33-35), so the run loop calls respawnGatewayProcessForUpdate
 *   (src/infra/process-respawn.ts:282-307) and observes the child's readiness
 *   (run-loop.ts:459-495). Kind update-respawn-control: it tests the update-respawn fallback, a
 *   distinct control that is not evidence for the fleet restart claim and never feeds the row
 *   verdict. restartGatewayProcessWithFreshPid never spawns (process-respawn.ts:231-273): a
 *   plain restart of an unmanaged gateway is in-process (run-loop.ts:572-580), which is
 *   RCC_IN_PROCESS_RESTART, a named limit and no case at all.
 */
export const RCC_CASE_BRANCH = Object.freeze({
  positive: Object.freeze({ kind: 'row-positive', branch: 'supervised', supervisorMode: 'external', restartReason: 'gateway.restart' }),
  'negative-replacement-never-usable': Object.freeze({ kind: 'row-negative', branch: 'supervised', supervisorMode: 'external', restartReason: 'gateway.restart' }),
  'control-update-respawn-fallback': Object.freeze({ kind: 'update-respawn-control', branch: 'spawned', supervisorMode: null, restartReason: 'update.run' }),
  'control-update-respawn-runtime-unavailable': Object.freeze({ kind: 'update-respawn-control', branch: 'spawned', supervisorMode: null, restartReason: 'update.run' }),
});
// The cases the row verdict is graded from, and the controls reported beside it.
export const RCC_ROW_CASES = Object.freeze(RCC_CASES.filter((caseKind) => RCC_CASE_BRANCH[caseKind].kind !== 'update-respawn-control'));
export const RCC_UPDATE_RESPAWN_CONTROLS = Object.freeze(RCC_CASES.filter((caseKind) => RCC_CASE_BRANCH[caseKind].kind === 'update-respawn-control'));
/**
 * The plain in-process restart, named on its own (🌊: "Name the plain in-process case
 * separately"). An unmanaged gateway restarted without an update-process reason restarts in
 * place under the same PID, with no child and no handoff. It is neither the row's supervised
 * claim nor an update-respawn control, and no case drives it; a control run that lands there
 * grades not-exercised (MISSING).
 */
export const RCC_IN_PROCESS_RESTART = Object.freeze({
  name: 'in-process-restart',
  class: 'limit',
  anchor: 'src/cli/gateway-cli/run-loop.ts:572-580',
  detail: 'an unmanaged gateway restarted without an update-process reason restarts in-process under the same PID; neither the row claim nor an update-respawn control covers it',
});
// Every environment key F′ reads as a supervisor or respawn hint on Linux
// (src/infra/supervisor-markers.ts:5-22, src/infra/process-respawn.ts:56-71). The control
// records which of them the running old generation carries (keys only).
export const RCC_SUPERVISOR_HINT_KEYS = Object.freeze([
  'OPENCLAW_SUPERVISOR_MODE',
  'OPENCLAW_SYSTEMD_UNIT',
  'INVOCATION_ID',
  'SYSTEMD_EXEC_PID',
  'JOURNAL_STREAM',
  'OPENCLAW_SERVICE_MARKER',
  'OPENCLAW_SERVICE_KIND',
  'OPENCLAW_NO_RESPAWN',
]);
// The product's own console lines on the spawned branch (run-loop.ts:480-488, 562-576).
export const RCC_SPAWN_DIAGNOSTICS = Object.freeze({
  unhealthy: /update respawn child did not become healthy \(([^)]*)\)/u,
  fallingBack: /update respawn child did not become healthy \([^)]*\); falling back to in-process restart/u,
  accepted: /restart mode: update process respawn \(spawned pid ([^)]*)\)/u,
  respawnFailed: /update respawn failed \(/u,
  inProcess: /restart mode: in-process restart/u,
  childBindFailed: /another gateway instance is already listening on/u,
});
/**
 * The exits that stop the spawned branch's in-process fallback, in the order
 * reacquireAndResumeInProcessRestart checks them (src/cli/gateway-cli/run-loop.ts:266-360), each
 * with the product's diagnostic. 🌊's fork ruling: the fallback holds only "if the old runtime is
 * viable and not replaced": a limit is the product declining an in-process recovery whose
 * precondition is false; the one failure is the fallback itself failing. Neither is ever PASS.
 */
export const RCC_FALLBACK_BRANCHES = Object.freeze([
  Object.freeze({
    branch: 'require-fresh-process',
    class: 'limit',
    anchor: 'src/cli/gateway-cli/run-loop.ts:274-279',
    pattern: /Fresh-process restart failed; the unsettled native worker cannot recover in-process/u,
  }),
  Object.freeze({
    branch: 'child-runtime-unavailable',
    class: 'limit',
    anchor: 'src/cli/gateway-cli/run-loop.ts:280-285 (src/infra/child-runtime-viability.ts:48-62)',
    pattern: /Fresh-process restart failed; the unavailable child runtime cannot recover in-process/u,
  }),
  Object.freeze({
    branch: 'foreground-closed',
    class: 'limit',
    anchor: 'src/cli/gateway-cli/run-loop.ts:286-288 (warned at :486-488)',
    pattern: /did not become healthy \([^)]*\); shutdown pending; retaining the replacement until it closes/u,
  }),
  Object.freeze({
    branch: 'installation-replaced',
    class: 'limit',
    anchor: 'src/cli/gateway-cli/run-loop.ts:308-310 and 336-338 (exit at :203-214, warned at :486-488)',
    pattern: /the replaced runtime cannot resume|Cannot continue in this process/u,
  }),
  Object.freeze({
    branch: 'lock-reacquire-failed',
    class: 'failure',
    anchor: 'src/cli/gateway-cli/run-loop.ts:313-331',
    pattern: /failed to reacquire gateway lock for in-process restart/u,
  }),
  Object.freeze({
    branch: 'resources-retained',
    class: 'limit',
    anchor: 'src/cli/gateway-cli/run-loop.ts:270-273 (exits 0)',
    pattern: /shutdown resources remain; refusing in-process restart and exiting/u,
  }),
]);
const DIAGNOSTIC_PATTERNS = [...Object.values(RCC_SPAWN_DIAGNOSTICS), ...RCC_FALLBACK_BRANCHES.map((entry) => entry.pattern)];
const DIAGNOSTIC_LINE_CHARS = 600;

/** Whether one output line is a restart diagnostic the receipt must keep. */
export function isRestartDiagnostic(line) {
  return DIAGNOSTIC_PATTERNS.some((pattern) => pattern.test(line));
}

/** Bound a retained diagnostic line; redaction happens in the caller, which holds the secrets. */
export function boundDiagnosticLine(line) {
  const text = String(line ?? '').replace(/\s+$/u, '');
  return text.length > DIAGNOSTIC_LINE_CHARS ? `${text.slice(0, DIAGNOSTIC_LINE_CHARS)}…` : text;
}
export const RCC_RECEIPTS = Object.freeze([
  'transition-http-body',
  'replacement-process-output',
  'generation-fingerprints',
  'observation-record',
  'signed-cleanup-receipt',
]);
export const RCC_VERDICTS = Object.freeze([
  'PASS-candidate',
  'PARTIAL-candidate',
  'FAIL-candidate',
  'MISSING-candidate',
]);
const CORPUS_STATE_CEILING = Object.freeze({
  'PASS-candidate': 'pass',
  'PARTIAL-candidate': 'partial',
  'FAIL-candidate': 'fail',
  'MISSING-candidate': 'missing',
});
// The live fleet gateway's default port. Every seat's live gateway uses it unless its own
// ~/.openclaw/openclaw.json says otherwise, and the guard refuses both.
export const LIVE_GATEWAY_DEFAULT_PORT = 18789;
// Markers frond-scribe scripts/proof-gw/composite-launcher.sh sets for an isolated gateway:
// P=$HOME/proof-gw/comp-<sha8>, UNIT=openclaw-proof-comp-<sha8>, receipts/identity.json.
export const PROOF_GW_DIR_PATTERN = /^comp-([0-9a-f]{8})$/u;
export const PROOF_GW_UNIT_PATTERN = /^openclaw-proof-comp-([0-9a-f]{8})$/u;
export const DEFAULT_PLAN = Object.freeze({
  sampleIntervalMs: 500,
  preTriggerSamples: 4,
  bootTimeoutMs: 120_000,
  transitionDeadlineMs: 45_000,
  readinessDeadlineMs: 60_000,
  observationWindowMs: 90_000,
});
// The spawned branch serves again only after the child's bind retries (20 x 500 ms,
// src/gateway/server/http-listen.ts:6-7), the readiness wait (up to 60 s,
// src/cli/daemon-cli/restart-health.constants.ts) and an in-process boot, so its default
// deadline and window are longer. readinessDeadlineMs bounds the original process serving again.
export const SPAWNED_PLAN_DEFAULTS = Object.freeze({
  readinessDeadlineMs: 150_000,
  observationWindowMs: 180_000,
});

const SHA40 = /^[0-9a-f]{40}$/u;
const HEX64 = /^[0-9a-f]{64}$/u;
const TAIL_BYTES = 4096;
const BODY_BYTES = 2048;

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function isSha40(value) {
  return typeof value === 'string' && SHA40.test(value);
}

function isHex64(value) {
  return typeof value === 'string' && HEX64.test(value);
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function finiteTime(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Freeze the observation window before the transition. Every bound is explicit, so a
 * reviewer can tell a bounded claim from an open-ended one.
 */
export function planObservationWindow(overrides = {}, caseKind = 'positive') {
  const plan = { ...DEFAULT_PLAN, ...(RCC_CASE_BRANCH[caseKind]?.branch === 'spawned' ? SPAWNED_PLAN_DEFAULTS : {}) };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue;
    if (!(key in DEFAULT_PLAN)) throw new Error(`unknown observation plan field: ${key}`);
    if (!positiveInteger(value)) throw new Error(`observation plan ${key} must be a positive integer`);
    plan[key] = value;
  }
  if (plan.readinessDeadlineMs >= plan.observationWindowMs) {
    throw new Error('readinessDeadlineMs must be shorter than observationWindowMs so readiness is followed by a settle period');
  }
  if (plan.transitionDeadlineMs >= plan.observationWindowMs) {
    throw new Error('transitionDeadlineMs must be shorter than observationWindowMs');
  }
  // One sample may wait on two HTTP probes, a hello-ok handshake and a read-only SQLite open;
  // anything slower than this between consecutive samples is an observation gap, not a quiet
  // window.
  plan.probeTimeoutMs = Math.min(1000, Math.max(100, plan.sampleIntervalMs * 2));
  plan.helloTimeoutMs = plan.probeTimeoutMs * 2;
  plan.maxSampleGapMs = plan.sampleIntervalMs * 4 + plan.probeTimeoutMs * 2 + plan.helloTimeoutMs + 1000;
  return plan;
}

/**
 * Which generation a sample saw serving. 🌊's ruling: a generation is usable only while it
 * owns the listening socket, /readyz passes and hello-ok answers. The control records the three
 * observations per sample; nothing else (an unchanged authority epoch, an observer's notion of
 * the "current" generation) makes a generation usable.
 */
export function servingGenerationOf(sample) {
  const owner = sample?.listener?.owner;
  if (owner !== 'old' && owner !== 'replacement') return null;
  if (sample.readyz?.status !== 200 || sample.readyz?.ready !== true) return null;
  return sample.hello?.ok === true ? owner : null;
}

/* ------------------------------------------------------------------------------------ */
/* Disposable-target guard                                                               */
/* ------------------------------------------------------------------------------------ */

export class DisposableTargetRefusal extends Error {
  constructor(refusals) {
    super(`refusing a non-disposable target: ${refusals.map((entry) => entry.code).join(', ')}`);
    this.name = 'DisposableTargetRefusal';
    this.refusals = refusals;
  }
}

function within(parent, child, pathApi) {
  const relative = pathApi.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !pathApi.isAbsolute(relative));
}

/**
 * Decide whether a proof-gw directory names a disposable gateway this control may own.
 * Every check fails closed. `fsApi` supplies existsSync/readFileSync/realpathSync/lstatSync
 * so tests can point `home` at a temporary tree.
 *
 * Returns { ok, refusals, target }. `target` carries only what the driver needs: port,
 * token (private; never written to a public receipt), state/config paths, unit and the
 * staged build identity.
 */
export function evaluateDisposableTarget({
  proofGwDir,
  stageDir,
  candidateSha,
  home,
  fsApi,
  pathApi,
  portListening,
  unitState,
}) {
  const refusals = [];
  const refuse = (code, detail) => refusals.push({ code, detail });
  const target = {};
  const readJson = (file) => JSON.parse(fsApi.readFileSync(file, 'utf8'));
  const real = (file) => {
    try {
      return fsApi.realpathSync(file);
    } catch {
      return null;
    }
  };

  if (!isSha40(candidateSha)) refuse('candidate-sha-invalid', 'candidate SHA must be 40 lowercase hex');
  if (typeof home !== 'string' || !pathApi.isAbsolute(home)) {
    refuse('home-invalid', 'home must be an absolute path');
    return { ok: false, refusals, target };
  }
  const homeReal = real(home) ?? home;
  const proofGwRoot = pathApi.join(homeReal, 'proof-gw');
  const liveStateDir = pathApi.join(homeReal, '.openclaw');

  if (typeof proofGwDir !== 'string' || !pathApi.isAbsolute(proofGwDir)) {
    refuse('proof-gw-dir-invalid', 'the proof-gw directory must be an absolute path');
    return { ok: false, refusals, target };
  }
  const dirReal = real(proofGwDir);
  if (!dirReal) {
    refuse('proof-gw-dir-missing', 'the proof-gw directory does not exist; run composite-launcher.sh setup first');
    return { ok: false, refusals, target };
  }
  // The target itself may not be a symlink (a comp-* link could point anywhere). A
  // symlinked home is fine: the root comparison below uses the resolved home.
  try {
    if (fsApi.lstatSync(proofGwDir).isSymbolicLink()) {
      refuse('proof-gw-dir-symlinked', 'the proof-gw directory must not be a symlink');
    }
  } catch {
    refuse('proof-gw-dir-missing', 'the proof-gw directory cannot be inspected');
  }
  if (pathApi.dirname(dirReal) !== proofGwRoot) {
    refuse('proof-gw-dir-outside-root', 'the target must be a direct child of $HOME/proof-gw');
  }
  const dirMatch = PROOF_GW_DIR_PATTERN.exec(pathApi.basename(dirReal));
  if (!dirMatch) refuse('proof-gw-dir-name', 'the target directory must be named comp-<8 hex>');
  const sha8 = dirMatch?.[1] ?? null;

  const stateDir = pathApi.join(dirReal, 'state');
  const configPath = pathApi.join(dirReal, 'openclaw.json');
  const stateReal = real(stateDir);
  if (!stateReal) {
    refuse('state-dir-missing', 'proof-gw state/ is missing');
  } else {
    if (stateReal !== stateDir) refuse('state-dir-symlinked', 'proof-gw state/ must be a real directory inside the target');
    const liveReal = real(liveStateDir) ?? liveStateDir;
    if (within(liveReal, stateReal, pathApi) || within(stateReal, liveReal, pathApi)) {
      refuse('state-dir-overlaps-live', 'the isolated state overlaps the live ~/.openclaw state');
    }
  }

  let identity = null;
  const identityPath = pathApi.join(dirReal, 'receipts', 'identity.json');
  try {
    identity = readJson(identityPath);
  } catch {
    refuse('identity-missing', 'receipts/identity.json (written by composite-launcher.sh setup) is missing or unreadable');
  }
  if (identity) {
    const unitMatch = PROOF_GW_UNIT_PATTERN.exec(String(identity.unit ?? ''));
    if (!unitMatch || unitMatch[1] !== sha8) refuse('identity-unit-mismatch', 'identity.json unit is not openclaw-proof-comp-<this dir sha8>');
    if (!positiveInteger(identity.port) || identity.port > 65_535) refuse('identity-port-invalid', 'identity.json port is not a TCP port');
    if (!isSha40(identity.pure_candidate_P) || !isSha40(identity.composite_runtime_C)) {
      refuse('identity-sha-invalid', 'identity.json must name 40-hex pure_candidate_P and composite_runtime_C');
    } else {
      if (identity.pure_candidate_P.slice(0, 8) !== sha8) refuse('identity-dir-mismatch', 'identity.json pure_candidate_P does not match the directory sha8');
      if (identity.composite_runtime_C !== candidateSha) refuse('identity-runtime-mismatch', 'the candidate SHA must equal the runtime this proof-gw directory was set up for');
    }
    target.unit = identity.unit;
    target.identity = {
      pure_candidate_P: identity.pure_candidate_P,
      composite_runtime_C: identity.composite_runtime_C,
      unit: identity.unit,
      port: identity.port,
    };
  }

  let config = null;
  try {
    const stat = fsApi.lstatSync(configPath);
    if (!stat.isFile()) throw new Error('not a file');
    if ((stat.mode & 0o077) !== 0) refuse('config-mode', 'openclaw.json must be mode 0600 (composite-launcher.sh writes it so)');
    config = readJson(configPath);
  } catch {
    refuse('config-missing', 'openclaw.json is missing or unreadable');
  }
  if (config) {
    const gateway = config.gateway ?? {};
    if (gateway.port !== identity?.port) refuse('config-port-mismatch', 'openclaw.json gateway.port differs from identity.json port');
    if (gateway.bind !== 'loopback') refuse('config-bind-not-loopback', 'the disposable gateway must bind loopback only');
    if (gateway.auth?.mode !== 'token' || typeof gateway.auth?.token !== 'string' || gateway.auth.token.length < 16) {
      refuse('config-auth', 'the disposable gateway must use its own token auth');
    }
    if (config.channels && typeof config.channels === 'object' && Object.keys(config.channels).length > 0) {
      refuse('config-channels', 'a disposable proof gateway carries no channels; a restart here must not reach anyone');
    }
    target.port = gateway.port;
    target.token = gateway.auth?.token;
  }

  // The live gateway: the default port and whatever the live config names, read-only.
  const livePorts = new Set([LIVE_GATEWAY_DEFAULT_PORT]);
  try {
    const live = readJson(pathApi.join(liveStateDir, 'openclaw.json'));
    if (positiveInteger(live?.gateway?.port)) livePorts.add(live.gateway.port);
  } catch {
    // No readable live config: the default port stays refused.
  }
  if (positiveInteger(target.port) && livePorts.has(target.port)) {
    refuse('port-is-live', `port ${target.port} belongs to the live gateway`);
  }

  if (typeof stageDir !== 'string' || !pathApi.isAbsolute(stageDir)) {
    refuse('stage-dir-invalid', 'the stage directory must be an absolute path');
  } else {
    const stageReal = real(stageDir);
    if (!stageReal) {
      refuse('stage-dir-missing', 'the stage directory does not exist');
    } else {
      if (within(liveStateDir, stageReal, pathApi)) refuse('stage-dir-live', 'the stage must not live under ~/.openclaw');
      let buildInfo = null;
      try {
        buildInfo = readJson(pathApi.join(stageReal, 'dist', 'build-info.json'));
      } catch {
        refuse('stage-build-info-missing', 'dist/build-info.json is missing from the stage');
      }
      if (buildInfo && buildInfo.commit !== candidateSha) {
        refuse('stage-build-mismatch', 'the stage dist/build-info.json commit is not the candidate SHA');
      }
      if (!fsApi.existsSync(pathApi.join(stageReal, 'dist', 'index.js'))) {
        refuse('stage-entry-missing', 'dist/index.js is missing from the stage');
      }
      target.stageDir = stageReal;
      target.stageBuild = {
        commit: buildInfo?.commit ?? null,
        buildId: typeof buildInfo?.buildId === 'string' ? buildInfo.buildId : null,
      };
    }
  }

  // The control owns this gateway's lifecycle for the run: nothing may already serve the port,
  // and the proof-gw unit must be stopped (its Restart=no plus OPENCLAW_SYSTEMD_UNIT makes a
  // real restart exit for good, so it cannot host the positive control).
  if (positiveInteger(target.port) && !refusals.some((entry) => entry.code === 'port-is-live')) {
    if (portListening(target.port)) refuse('port-in-use', `something already listens on ${target.port}; stop the proof-gw unit first`);
  }
  if (target.unit) {
    // Only a unit known to be down is safe: deactivating can hold the state for the
    // launcher's TimeoutStopSec, and unknown (no user bus) proves nothing.
    const state = unitState(target.unit);
    target.unitState = state;
    if (state !== 'inactive' && state !== 'failed') {
      refuse('unit-not-stopped', `${target.unit} is ${state || 'unknown'}; run composite-launcher.sh stop first (a user systemd bus is required to confirm it)`);
    }
  }

  target.proofGwDir = dirReal;
  target.sha8 = sha8;
  target.stateDir = stateDir;
  target.configPath = configPath;
  target.livePorts = [...livePorts].sort((a, b) => a - b);
  return { ok: refusals.length === 0, refusals, target };
}

/* ------------------------------------------------------------------------------------ */
/* Public-safety projection                                                              */
/* ------------------------------------------------------------------------------------ */

/**
 * Redact private values from captured text before it can enter a public receipt. The
 * private copies keep the raw bytes.
 */
export function redactText(text, secrets = []) {
  let out = String(text ?? '');
  for (const { value, label } of secrets) {
    if (typeof value === 'string' && value.length >= 4) out = out.split(value).join(label);
  }
  return out
    .replace(/[A-Fa-f0-9]{32,}/gu, '<redacted-hex>')
    .replace(/[A-Za-z0-9_-]{40,}/gu, '<redacted-token>')
    .replace(/\b(token|bearer|password|secret)\b\s*[:=]\s*\S+/giu, '$1=<redacted>');
}

/** Redact every string inside a JSON value, keeping its structure. */
export function redactDeep(value, secrets = []) {
  if (typeof value === 'string') return redactText(value, secrets);
  if (Array.isArray(value)) return value.map((entry) => redactDeep(entry, secrets));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, redactDeep(entry, secrets)]));
  }
  return value;
}

export function textCapture(buffer, secrets = []) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(String(buffer ?? ''));
  const tail = bytes.subarray(Math.max(0, bytes.length - TAIL_BYTES)).toString('utf8');
  return { bytes: bytes.length, sha256: sha256(bytes), tail: redactText(tail, secrets) };
}

export function boundedBody(body, secrets = []) {
  const text = String(body ?? '');
  return redactText(text.length > BODY_BYTES ? `${text.slice(0, BODY_BYTES)}…` : text, secrets);
}

/** Every secret-bearing value must be absent from the serialized public receipt. */
export function publicSafetyLeaks(value, secrets) {
  const serialized = JSON.stringify(value);
  return secrets
    .filter(({ value: secret }) => typeof secret === 'string' && secret.length >= 4 && serialized.includes(secret))
    .map(({ label }) => label);
}

/* ------------------------------------------------------------------------------------ */
/* Grader                                                                                */
/* ------------------------------------------------------------------------------------ */

function samplesOf(record) {
  return Array.isArray(record?.observation?.samples) ? record.observation.samples : [];
}

function sortedSamples(record) {
  return [...samplesOf(record)].sort((a, b) => a.atMs - b.atMs);
}

function servingPoint(sample) {
  return sample
    ? {
        atMs: sample.atMs,
        generation: servingGenerationOf(sample),
        listenerInode: sample.listener?.inode ?? null,
        ownerPid: sample.listener?.ownerPid ?? null,
      }
    : null;
}

/**
 * The outage a restart opens, measured from the matrix. A serving sample has an identity: the
 * generation, the listener owner's PID and the listening socket inode. The outage starts after
 * the last sample at which the identity serving when the transition was requested still served
 * (a draining old generation can keep serving, and miss a hello-ok, after the request), and ends
 * at the first sample served by any other identity: the replacement, or the original process on
 * a new socket (the spawned branch's in-process fallback). Every full-process path at F′ closes
 * the old server first, so the interval exists on every branch; its precision is one sample
 * interval. `open` means nothing else served before the observation ended.
 */
export function computeOutageInterval(record) {
  const samples = sortedSamples(record);
  const triggerAtMs = record?.observation?.triggerAtMs;
  const resolutionMs = record?.plan?.sampleIntervalMs ?? null;
  const base = { observed: false, lastServingBefore: null, firstServingAfter: null, ms: null, open: false, unservedSamples: 0, resolutionMs };
  if (!finiteTime(triggerAtMs) || samples.length === 0) return { ...base, reason: 'no-transition-observed' };
  const identity = (sample) => {
    const generation = servingGenerationOf(sample);
    return generation ? `${generation}:${sample.listener?.ownerPid ?? ''}:${sample.listener?.inode ?? ''}` : null;
  };
  let originIndex = -1;
  for (let index = 0; index < samples.length && samples[index].atMs < triggerAtMs; index += 1) {
    if (identity(samples[index])) originIndex = index;
  }
  if (originIndex < 0) return { ...base, reason: 'no-serving-generation-before-transition' };
  const origin = identity(samples[originIndex]);
  const afterIndex = samples.findIndex((sample, index) => index > originIndex && identity(sample) !== null && identity(sample) !== origin);
  const bound = afterIndex < 0 ? samples.length : afterIndex;
  let beforeIndex = originIndex;
  for (let index = originIndex + 1; index < bound; index += 1) if (identity(samples[index]) === origin) beforeIndex = index;
  if (afterIndex < 0 && beforeIndex === samples.length - 1) return { ...base, reason: 'transition-origin-still-serving' };
  const before = samples[beforeIndex];
  const after = afterIndex < 0 ? null : samples[afterIndex];
  return {
    ...base,
    observed: true,
    lastServingBefore: servingPoint(before),
    firstServingAfter: servingPoint(after),
    ms: after ? after.atMs - before.atMs : null,
    open: after === null,
    unservedSamples: bound - beforeIndex - 1,
  };
}

function branchOf(record) {
  return RCC_CASE_BRANCH[record?.case]?.branch ?? 'supervised';
}

function diagnosticLinesOf(record) {
  const entries = record?.fallback?.diagnostics;
  return Array.isArray(entries) ? entries.map((entry) => String(entry?.line ?? '')) : [];
}

function receiptPresence(record) {
  const old = record?.generations?.old;
  const replacement = record?.generations?.replacement;
  const child = record?.fallback?.child;
  const transition = record?.transition;
  const bodies = transition?.httpBodies;
  const observation = record?.observation;
  const plan = record?.plan;
  const spawned = branchOf(record) === 'spawned';
  const capture = (value) => Boolean(value) && Number.isSafeInteger(value.bytes) && isHex64(value.sha256);
  const oldFingerprint = positiveInteger(old?.pid) &&
    positiveInteger(old?.startTicks) &&
    positiveInteger(old?.listen?.inode) &&
    isHex64(old?.bootIdSha256);
  return {
    'transition-http-body': Boolean(
      transition?.response &&
        isHex64(transition.response.sha256) &&
        transition.response.frame &&
        typeof transition.response.frame === 'object' &&
        bodies?.lastPreTrigger?.readyz &&
        (bodies.firstPostTriggerNotReady || bodies.firstReplacementReady),
    ),
    // On the spawned branch the product starts the child with inherited stdio
    // (src/infra/process-respawn.ts:295-299), so its output is in the old generation's streams.
    'replacement-process-output': Boolean(
      spawned
        ? record?.fallback?.outputChannel === 'inherited-by-old-generation' && capture(old?.stdout) && capture(old?.stderr)
        : replacement?.started && capture(replacement.stdout) && capture(replacement.stderr),
    ),
    'generation-fingerprints': Boolean(
      oldFingerprint &&
        (spawned
          ? // The product's child, by PID from /proc or from the product's own diagnostic; a
            // child whose spawn failed has no PID, and the product reports it as unknown. A
            // restored original process carries its new socket and boot identity.
            (positiveInteger(child?.pid) || child?.reportedPid === 'unknown') &&
            (old?.restored ? positiveInteger(old.restored.listen?.inode) && isHex64(old.restored.bootIdSha256) : true)
          : positiveInteger(replacement?.pid) &&
            positiveInteger(replacement?.startTicks) &&
            // A replacement that never listened has no socket to fingerprint; its process
            // identity still must be retained.
            (replacement?.readyAtMs ? positiveInteger(replacement?.listen?.inode) && isHex64(replacement?.bootIdSha256) : true)),
    ),
    'observation-record': Boolean(
      plan &&
        positiveInteger(plan.observationWindowMs) &&
        positiveInteger(plan.sampleIntervalMs) &&
        finiteTime(observation?.triggerAtMs) &&
        finiteTime(observation?.endAtMs) &&
        samplesOf(record).length > 0,
    ),
    'signed-cleanup-receipt': Boolean(record?.cleanup?.completed === true && record?.observerKey?.available === true),
  };
}

/**
 * Classify what the spawned branch did after the transition, from the product's own console
 * lines (retained by the control), the matrix and the old generation's exit:
 * - `restored` (old-process restoration): the original process, same PID and start ticks, owns
 *   the listener again and serves to the end of the window. This is 🌊's fallback, never
 *   fresh-successor proof.
 * - a named branch from RCC_FALLBACK_BRANCHES: the product refused the fallback (limit) or the
 *   fallback failed (failure).
 * - `not-exercised`: the spawned branch never ran (`in-process-restart`,
 *   `spawned-branch-not-taken`) or a fresh child served (`replacement-accepted`).
 * - `restoration-unstable`, `unclassified-exit`, `not-restored`: failures without a named reason.
 */
export function classifyFallback(record, samples = sortedSamples(record), outage = computeOutageInterval(record)) {
  const lines = diagnosticLinesOf(record);
  const has = (pattern) => lines.some((line) => pattern.test(line));
  const old = record?.generations?.old ?? {};
  const child = record?.fallback?.child ?? {};
  const triggerAtMs = record?.observation?.triggerAtMs;
  const updateRespawnTaken = Boolean(
    positiveInteger(child.pid) ||
      has(RCC_SPAWN_DIAGNOSTICS.unhealthy) ||
      has(RCC_SPAWN_DIAGNOSTICS.accepted) ||
      has(RCC_SPAWN_DIAGNOSTICS.respawnFailed),
  );
  const replacementServed = finiteTime(triggerAtMs) &&
    samples.some((sample) => sample.atMs >= triggerAtMs && servingGenerationOf(sample) === 'replacement');
  const first = outage.firstServingAfter;
  const servingAgain = first?.generation === 'old' ? samples.filter((sample) => sample.atMs >= first.atMs) : [];
  // Restored: the original process (same PID and start ticks), on a new socket, serving to the
  // end of the window, and confirmed by the control's own readiness check of that process.
  const restored = servingAgain.length > 0 &&
    first.listenerInode !== old.listen?.inode &&
    old.restored?.sameProcess === true &&
    servingAgain.every((sample) =>
      servingGenerationOf(sample) === 'old' &&
        sample.listener?.ownerPid === old.pid &&
        sample.listener?.ownerStartTicks === old.startTicks &&
        sample.listener?.inode === first.listenerInode);
  const named = RCC_FALLBACK_BRANCHES.find((entry) => has(entry.pattern));
  const result = (branch, cls, detail, anchor = null) => ({
    branch,
    class: cls,
    detail,
    anchor,
    updateRespawnTaken,
    childPid: positiveInteger(child.pid) ? child.pid : (child.reportedPid ?? null),
  });
  if (replacementServed || has(RCC_SPAWN_DIAGNOSTICS.accepted)) {
    return result('replacement-accepted', 'not-exercised', 'a product-spawned replacement served, so the update-respawn control was not exercised', 'src/cli/gateway-cli/run-loop.ts:480-485');
  }
  if (named) return result(named.branch, named.class, `the product refused or failed the in-process fallback (${named.branch})`, named.anchor);
  if (!updateRespawnTaken) {
    return has(RCC_SPAWN_DIAGNOSTICS.inProcess)
      ? result(RCC_IN_PROCESS_RESTART.name, 'not-exercised', 'the restart stayed in-process and spawned no child', RCC_IN_PROCESS_RESTART.anchor)
      : result('spawned-branch-not-taken', 'not-exercised', 'no child, no update-respawn diagnostic: the spawned branch did not run', 'src/cli/gateway-cli/run-loop.ts:459-495');
  }
  if (restored) {
    return result('restored', 'old-process-restoration', 'the original process (same PID and start ticks) owns the listener again and serves; old-process restoration, not a fresh successor', 'src/cli/gateway-cli/run-loop.ts:266-360');
  }
  if (first?.generation === 'old') return result('restoration-unstable', 'failure', 'the original process served again but did not stay serving, or the listener was not its exact process');
  if (finiteTime(old.exitedAtMs)) return result('unclassified-exit', 'failure', 'the original process exited without a named product reason');
  return result('not-restored', 'failure', 'the original process neither served again nor exited with a named reason before the deadline');
}

/**
 * Grade one control record. Precedence: a contradicted behaviour is FAIL; with no observed
 * transition, or only a declared limit, there is nothing to judge (MISSING); a positive chain
 * with a missing receipt is PARTIAL; only the full receipt chain plus the positive behaviour is
 * PASS, and only for the positive case.
 */
export function gradeRestartControl(record) {
  const failures = [];
  const partials = [];
  const missingBehaviour = [];
  const limits = [];
  const fail = (code, detail) => failures.push({ code, detail });
  const partial = (code, detail) => partials.push({ code, detail });
  const missing = (code, detail) => missingBehaviour.push({ code, detail });
  const limit = (code, detail) => limits.push({ code, detail });

  const receipts = receiptPresence(record);
  const missingReceipts = RCC_RECEIPTS.filter((name) => !receipts[name]);
  const observed = receipts['observation-record'];
  const samples = observed ? sortedSamples(record) : [];
  const plan = record?.plan ?? {};
  const authority = record?.authority ?? {};
  const old = record?.generations?.old ?? {};
  const replacement = record?.generations?.replacement ?? {};
  const transition = record?.transition ?? {};
  const triggerAtMs = record?.observation?.triggerAtMs;
  const endAtMs = record?.observation?.endAtMs;
  const caseKind = record?.case;
  const spawned = branchOf(record) === 'spawned';
  const lines = diagnosticLinesOf(record);

  if (record?.schema !== RCC_SCHEMA || record?.row !== RCC_ROW) fail('record-identity', 'record schema or row is not this control');
  if (!RCC_CASES.includes(caseKind)) fail('case-unknown', 'record case is not a declared control case');
  if (!isSha40(record?.candidateSha) || !isSha40(record?.docsSha)) fail('sha-identity', 'candidate and docs SHAs must both be 40-hex');

  if (!observed) missing('observation-record-missing', 'no planned window and observation matrix were recorded');
  if (!(authority.established === true && isHex64(authority.epochSha256))) {
    missing('authority-not-established', 'no recipient-authority generation was established before the transition');
  }
  // A transition happened when the gateway accepted the request, or, if its body was lost,
  // when the product's own handoff row proves the old generation restarted. A lost body is
  // then a missing receipt (PARTIAL), the rejected base's second half, not a missing claim.
  const transitionHappened =
    transition.response?.ok === true ||
    (!transition.response && finiteTime(transition.requestedAtMs) && transition.handoff?.status === 'accepted');
  if (!transition.response && !transitionHappened) {
    missing('transition-not-requested', 'no transition request reached the gateway');
  } else if (transition.response && transition.response.ok !== true) {
    missing('transition-rejected', 'the gateway rejected the restart request; no restart was observed (body retained)');
  }

  // The branch the case meant to drive must be the one the running process could take: the
  // old generation's own environ carries exactly the supervisor hints the case sets.
  const hints = old.supervisorHints;
  if (Array.isArray(hints)) {
    const expected = RCC_CASE_BRANCH[caseKind]?.supervisorMode === 'external' ? ['OPENCLAW_SUPERVISOR_MODE'] : [];
    if (hints.length !== expected.length || hints.some((key, index) => key !== expected[index])) {
      missing('branch-precondition-unmet', `the old generation carried supervisor hints ${JSON.stringify(hints)}, not ${JSON.stringify(expected)}`);
    }
  } else if (finiteTime(old.readyAtMs)) {
    partial('branch-precondition-unrecorded', 'the old generation\'s supervisor hints were not read from /proc');
  }

  const established = authority.epochSha256;
  const preSamples = samples.filter((sample) => finiteTime(triggerAtMs) && sample.atMs < triggerAtMs);
  const readyAt = replacement.readyAtMs;

  // B2: the authority generation is present and unchanged at every sample.
  const cleared = samples.filter((sample) => sample.authority?.state === 'missing');
  const changed = samples.filter((sample) => sample.authority?.state === 'present' && sample.authority.epochSha256 !== established);
  const unreadable = samples.filter((sample) => !['present', 'missing'].includes(sample.authority?.state));
  if (isHex64(established) && (cleared.length || changed.length)) {
    fail('authority-cleared-or-advanced', `${cleared.length} sample(s) without the authority row, ${changed.length} with a different generation`);
  }
  if (unreadable.length) {
    partial('authority-sample-unreadable', `${unreadable.length} sample(s) could not read the authority store`);
  }
  if (isHex64(established) && replacement.authorityAfterReady && replacement.authorityAfterReady !== established) {
    fail('authority-cleared-or-advanced', 'the replacement-time authority read differs from the established generation');
  }

  // B3: the old generation served before the transition: it owned the listener, /readyz
  // passed and hello-ok answered at each counted sample.
  if (observed && transitionHappened) {
    const servedBefore = preSamples.filter((sample) => servingGenerationOf(sample) === 'old');
    if (servedBefore.length < (plan.preTriggerSamples ?? 1)) {
      fail('old-not-serving-before-transition', `${servedBefore.length} serving old-generation sample(s) before the transition; plan needs ${plan.preTriggerSamples}`);
    }
  }
  const outage = observed ? computeOutageInterval(record) : computeOutageInterval(null);

  // No predicate credits a generation as usable through the outage: at F′ the old server
  // closes before any successor is ready (🌊's ruling), so continuous service is not an
  // invariant. The outage is measured and reported instead (grade.outageInterval).

  let fallback = {
    branch: 'none-on-supervised-branch',
    class: 'not-applicable',
    detail: 'the supervised branch (src/cli/gateway-cli/run-loop.ts:497-561) writes the handoff and exits; it has no in-process fallback once the handoff is written',
  };
  if (spawned) {
    // The spawned branch: the product, not the control, starts the replacement and decides the
    // fallback. A fresh successor is not this case's claim; the child never serving is.
    fallback = classifyFallback(record, samples, outage);
    const child = record?.fallback?.child ?? {};
    if (positiveInteger(child.pid) && /^\d+$/u.test(String(child.reportedPid ?? '')) && Number(child.reportedPid) !== child.pid) {
      partial('child-identity-mismatch', `the control tracked pid ${child.pid}, the product judged pid ${child.reportedPid}`);
    }
    if (transitionHappened) {
      if (fallback.class === 'not-exercised') {
        missing('negative-not-exercised', `${fallback.branch}: ${fallback.detail}`);
      } else {
        fail('replacement-never-usable', 'the product-spawned replacement never became healthy');
      }
      if (fallback.class === 'limit') limit(`fallback-${fallback.branch}`, `${fallback.detail}; ${fallback.anchor}`);
      if (fallback.class === 'failure') fail(`fallback-${fallback.branch}`, fallback.anchor ? `${fallback.detail}; ${fallback.anchor}` : fallback.detail);
    }
  } else {
    // B5: the old generation left through the product's external-supervisor handoff.
    if (transitionHappened) {
      const handoff = transition.handoff;
      if (!finiteTime(old.exitedAtMs)) {
        fail('old-did-not-exit', 'the old generation never exited within the transition deadline');
      } else {
        if (old.exit?.code !== 0) fail('old-exit-nonzero', `the old generation exited with ${JSON.stringify(old.exit)}`);
        if (
          handoff?.status !== 'accepted' ||
          handoff.pid !== old.pid ||
          handoff.restartKind !== 'full-process' ||
          handoff.supervisorMode !== 'external'
        ) {
          fail('restart-handoff-missing', 'the old generation exited without an accepted full-process external restart handoff bound to its PID');
        }
      }
    }

    // B7/B8/B10: the replacement became ready, distinct, and stayed serving.
    if (transitionHappened && finiteTime(old.exitedAtMs)) {
      if (!replacement.started) {
        fail('replacement-not-started', 'the control never started a replacement generation');
      } else if (!finiteTime(readyAt)) {
        fail('replacement-never-usable', replacement.failure?.kind
          ? `the replacement never became usable (${replacement.failure.kind})`
          : 'the replacement never became usable');
      } else {
        if (readyAt - triggerAtMs > plan.readinessDeadlineMs) fail('replacement-ready-late', 'replacement readiness came after the planned deadline');
        if (positiveInteger(old.pid) && replacement.pid === old.pid && replacement.startTicks === old.startTicks) fail('generations-not-distinct', 'old and replacement share one process identity');
        if (positiveInteger(replacement.listen?.inode) && replacement.listen.inode === old.listen?.inode) fail('generations-not-distinct', 'old and replacement share one listening socket inode');
        if (isHex64(replacement.bootIdSha256) && replacement.bootIdSha256 === old.bootIdSha256) fail('generations-not-distinct', 'old and replacement report one boot identity');
        if (observed) {
          const settle = samples.filter((sample) => sample.atMs > readyAt);
          const unstable = settle.filter((sample) =>
            servingGenerationOf(sample) !== 'replacement' ||
            sample.listener?.inode !== replacement.listen?.inode);
          if (unstable.length) fail('replacement-unstable', `${unstable.length} settle sample(s) did not show the same replacement serving`);
          if (settle.length === 0) partial('settle-unobserved', 'no samples followed replacement readiness');
          const firstServing = outage.firstServingAfter;
          if (firstServing?.generation === 'replacement' && firstServing.atMs - triggerAtMs > plan.readinessDeadlineMs) {
            fail('replacement-ready-late', 'the first serving replacement sample came after the planned deadline');
          }
          if (!outage.observed) partial('outage-unobserved', 'no sample fell between the old generation and the replacement');
        if (outage.firstServingAfter && outage.firstServingAfter.generation !== 'replacement') {
          partial('outage-misattributed', `the first generation serving after the outage was ${outage.firstServingAfter.generation}, not the replacement`);
        }
        }
      }
    }
  }

  // B9: every generation that served ran the staged candidate build.
  const stageBuildId = record?.target?.stageBuild?.buildId;
  if (transitionHappened) {
    if (typeof stageBuildId !== 'string' || !stageBuildId) {
      partial('build-identity-unverified', 'the stage build-info carries no buildId to bind the generations to');
    } else {
      if (old.buildId !== stageBuildId) fail('build-identity-mismatch', 'the old generation did not report the staged buildId');
      if (finiteTime(readyAt) && replacement.buildId !== stageBuildId) fail('build-identity-mismatch', 'the replacement did not report the staged buildId');
      if (old.restored && old.restored.buildId !== stageBuildId) fail('build-identity-mismatch', 'the restored original process did not report the staged buildId');
    }
  }

  // B11: the planned window actually elapsed, without blind gaps.
  if (observed) {
    if (endAtMs - triggerAtMs < plan.observationWindowMs) partial('window-short', `observed ${endAtMs - triggerAtMs} ms of a ${plan.observationWindowMs} ms plan`);
    let previous = null;
    let widest = 0;
    for (const sample of samples) {
      if (previous !== null) widest = Math.max(widest, sample.atMs - previous);
      previous = sample.atMs;
    }
    if (positiveInteger(plan.maxSampleGapMs) && widest > plan.maxSampleGapMs) partial('observation-gap', `widest gap ${widest} ms exceeds ${plan.maxSampleGapMs} ms`);
  }
  if (record?.docs?.clean !== true) partial('docs-harness-dirty', 'the docs harness tree was not clean at the executing SHA');

  // B12: cleanup left nothing running.
  if (record?.cleanup?.completed === true) {
    if (record.cleanup.childrenStopped !== true || record.cleanup.portReleased !== true || (record.cleanup.residualPids ?? []).length) {
      fail('resource-retention', 'cleanup finished with a retained process or listener');
    }
    if ((record.cleanup.orphansTerminated ?? []).length) {
      fail('resource-retention', `cleanup had to stop ${record.cleanup.orphansTerminated.length} leftover run process(es)`);
    }
  }

  // A negative or control case that nothing contradicted did not exercise what it tests.
  if (RCC_NEGATIVE_CASES.includes(caseKind) && failures.length === 0 && limits.length === 0 && missingBehaviour.length === 0) {
    missing('negative-not-exercised', 'a negative case must be contradicted; nothing contradicted the positive claim');
  }

  let verdict;
  if (failures.length) verdict = 'FAIL-candidate';
  else if (missingBehaviour.length || limits.length) verdict = 'MISSING-candidate';
  else if (missingReceipts.length || partials.length) verdict = 'PARTIAL-candidate';
  else verdict = 'PASS-candidate';

  // The negative control holds only when it refuses PASS *and* still shows the old
  // authority and the failure body. "Old authority" is the unchanged epoch plus the old
  // generation's retained fingerprint, never a claim that it was usable.
  let negativeControl = null;
  const epochUnchanged = Boolean(
    isHex64(established) &&
      samples.length > 0 &&
      samples.every((sample) => sample.authority?.state === 'present' && sample.authority.epochSha256 === established),
  );
  const nonPass = verdict !== 'PASS-candidate';
  if (caseKind === 'negative-replacement-never-usable') {
    const oldAuthorityRetained = Boolean(
      epochUnchanged &&
        positiveInteger(old.pid) &&
        positiveInteger(old.startTicks) &&
        positiveInteger(old.listen?.inode),
    );
    // This supervised branch has no in-process fallback: the old generation left through the
    // accepted handoff, and nothing served again before the window ended.
    const handoff = transition.handoff;
    const noFallback = Boolean(
      finiteTime(old.exitedAtMs) &&
        old.exit?.code === 0 &&
        handoff?.status === 'accepted' &&
        handoff.pid === old.pid &&
        outage.open === true &&
        samples.every((sample) => sample.atMs <= old.exitedAtMs || servingGenerationOf(sample) === null),
    );
    // Failure text must actually exist: process output with bytes and a non-empty tail,
    // and a not-ready probe that kept a body or an error.
    const hasText = (capture) => Number.isSafeInteger(capture?.bytes) && capture.bytes > 0 && String(capture.tail ?? '').trim().length > 0;
    const keptProbe = (edge) => Boolean(edge && ['readyz', 'startupz'].some((probe) => edge[probe]?.body || edge[probe]?.error));
    const failureBodyRetained = Boolean(
      replacement.failure?.kind &&
        receipts['replacement-process-output'] &&
        (hasText(replacement.stderr) || hasText(replacement.stdout)) &&
        transition.response?.frame &&
        (keptProbe(transition.httpBodies?.lastObservedNotReady) || keptProbe(transition.httpBodies?.firstPostTriggerNotReady)),
    );
    const replacementNeverUsable = !finiteTime(readyAt) && samples.every((sample) => servingGenerationOf(sample) !== 'replacement');
    // 🌊's final ruling: the never-serving replacement must produce the observed failure and the
    // outage, with no old-process fallback claimed.
    const failureObserved = failures.some((entry) => entry.code === 'replacement-never-usable');
    const outageObserved = outage.observed === true &&
      outage.lastServingBefore?.generation === 'old' &&
      outage.open === true &&
      outage.firstServingAfter === null;
    negativeControl = {
      expected: 'non-PASS with the observed failure, the outage, the old authority (epoch and fingerprint) and the failure body retained, and no fallback on the supervised branch',
      nonPass,
      failureObserved,
      replacementNeverUsable,
      outageObserved,
      oldAuthorityRetained,
      failureBodyRetained,
      noFallback,
      holds: nonPass && failureObserved && replacementNeverUsable && outageObserved && oldAuthorityRetained && failureBodyRetained && noFallback,
    };
  } else if (spawned) {
    const replacementNeverUsable = !lines.some((line) => RCC_SPAWN_DIAGNOSTICS.accepted.test(line)) &&
      samples.every((sample) => servingGenerationOf(sample) !== 'replacement');
    const frameRetained = Boolean(transition.response?.frame && typeof transition.response.frame === 'object');
    if (caseKind === 'control-update-respawn-fallback') {
      const failureDiagnosticRetained = frameRetained && lines.some((line) => RCC_SPAWN_DIAGNOSTICS.fallingBack.test(line));
      const originalProcessServesAgain = fallback.branch === 'restored';
      const outageMeasured = outage.firstServingAfter?.generation === 'old' && Number.isFinite(outage.ms);
      const childIdentityConsistent = !partials.some((entry) => entry.code === 'child-identity-mismatch');
      negativeControl = {
        expected: 'non-PASS: the product-spawned child never serves; the fallback diagnostic and restart frame are retained; the original PID and start ticks own the listener again with /readyz and hello-ok passing under the unchanged epoch; the outage is measured (old-process restoration, not fresh-successor proof)',
        spawnedBranchTaken: fallback.updateRespawnTaken,
        childIdentityConsistent,
        replacementNeverUsable,
        failureDiagnosticRetained,
        originalProcessServesAgain,
        epochUnchanged,
        outageMeasured,
        fallbackBranch: fallback.branch,
        holds: nonPass && fallback.updateRespawnTaken && childIdentityConsistent && replacementNeverUsable && failureDiagnosticRetained &&
          originalProcessServesAgain && epochUnchanged && outageMeasured,
      };
    } else {
      const runtime = record?.fallback?.runtime;
      const unavailable = RCC_FALLBACK_BRANCHES.find((entry) => entry.branch === 'child-runtime-unavailable');
      const runtimeRemovedBeforeTransition = Boolean(runtime?.copied === true && finiteTime(runtime.unlinkedAtMs) && finiteTime(triggerAtMs) && runtime.unlinkedAtMs <= triggerAtMs);
      const branchRecognized = fallback.branch === 'child-runtime-unavailable';
      const diagnosticRetained = frameRetained && lines.some((line) => unavailable.pattern.test(line));
      const oldExitedNonZero = finiteTime(old.exitedAtMs) && Number.isInteger(old.exit?.code) && old.exit.code !== 0;
      const noRestoration = outage.open === true;
      negativeControl = {
        expected: 'non-PASS: with the control-owned runtime removed, the product names the unavailable child runtime, exits nonzero instead of restoring, and the epoch is unchanged (a limit, never PASS)',
        spawnedBranchTaken: fallback.updateRespawnTaken,
        replacementNeverUsable,
        runtimeRemovedBeforeTransition,
        branchRecognized,
        diagnosticRetained,
        oldExitedNonZero,
        noRestoration,
        epochUnchanged,
        fallbackBranch: fallback.branch,
        holds: nonPass && fallback.updateRespawnTaken && replacementNeverUsable && runtimeRemovedBeforeTransition &&
          branchRecognized && diagnosticRetained && oldExitedNonZero && noRestoration && epochUnchanged,
      };
    }
  }

  const kind = RCC_CASE_BRANCH[caseKind]?.kind ?? null;
  return {
    verdict,
    corpusStateCeiling: CORPUS_STATE_CEILING[verdict],
    // Which evidence this case is: only row-positive and row-negative feed the row verdict.
    kind,
    feedsRowVerdict: kind === 'row-positive' || kind === 'row-negative',
    receipts: Object.fromEntries(RCC_RECEIPTS.map((name) => [name, receipts[name] ? 'present' : 'missing'])),
    missingReceipts,
    failures,
    partials,
    missingBehaviour,
    limits,
    negativeControl,
    outageInterval: outage,
    fallback,
  };
}

/* ------------------------------------------------------------------------------------ */
/* Row verdict                                                                           */
/* ------------------------------------------------------------------------------------ */

// Lowest first. The row verdict starts from the positive's and only ever moves down.
const VERDICT_RANK = Object.freeze({ 'FAIL-candidate': 0, 'MISSING-candidate': 1, 'PARTIAL-candidate': 2, 'PASS-candidate': 3 });

function lowerVerdict(a, b) {
  return VERDICT_RANK[a] <= VERDICT_RANK[b] ? a : b;
}

// One graded case: a control result ({ record, grade }) or an observer receipt body
// ({ case, kind, candidateSha, docsSha, grade }). Every kind it states must be the case's own.
function caseEvidence(entry) {
  const caseKind = entry?.case ?? entry?.record?.case ?? null;
  const declared = RCC_CASE_BRANCH[caseKind]?.kind ?? null;
  const stated = [entry?.kind, entry?.record?.kind, entry?.grade?.kind].filter((kind) => kind !== undefined && kind !== null);
  return {
    case: caseKind,
    declared,
    kindConsistent: declared !== null && stated.every((kind) => kind === declared),
    stated,
    candidateSha: entry?.candidateSha ?? entry?.record?.candidateSha ?? null,
    docsSha: entry?.docsSha ?? entry?.record?.docsSha ?? null,
    grade: entry?.grade ?? null,
  };
}

function positiveSummary(evidence) {
  const grade = evidence.grade;
  return {
    present: true,
    case: evidence.case,
    verdict: grade.verdict,
    missingReceipts: grade.missingReceipts ?? [],
    failures: (grade.failures ?? []).map((entry) => entry.code),
    partials: (grade.partials ?? []).map((entry) => entry.code),
    missingBehaviour: (grade.missingBehaviour ?? []).map((entry) => entry.code),
    outageInterval: grade.outageInterval ?? null,
  };
}

// 🌻's negative, read against 🌊's final ruling: a supervised replacement that never serves must
// produce the observed failure and outage, keep the authority and the failure body, grade
// non-PASS, and claim no old-process fallback.
function supervisedNegativeSummary(evidence) {
  const grade = evidence.grade;
  const control = grade.negativeControl ?? {};
  const outage = grade.outageInterval ?? null;
  const summary = {
    present: true,
    case: evidence.case,
    verdict: grade.verdict,
    nonPass: grade.verdict !== 'PASS-candidate',
    failure: (grade.failures ?? []).some((entry) => entry.code === 'replacement-never-usable') ? 'replacement-never-usable' : null,
    failureBodyRetained: control.failureBodyRetained === true,
    outageInterval: outage,
    outageObserved: outage?.observed === true &&
      outage.lastServingBefore?.generation === 'old' &&
      outage.open === true &&
      outage.firstServingAfter === null,
    authorityRetained: control.oldAuthorityRetained === true,
    noFallback: control.noFallback === true && grade.fallback?.branch === 'none-on-supervised-branch',
    fallbackBranch: grade.fallback?.branch ?? null,
  };
  summary.holds = control.holds === true &&
    summary.nonPass &&
    summary.failure !== null &&
    summary.failureBodyRetained &&
    summary.outageObserved &&
    summary.authorityRetained &&
    summary.noFallback;
  return summary;
}

function controlSummary(evidence) {
  const grade = evidence.grade ?? {};
  return {
    case: evidence.case,
    kind: 'update-respawn-control',
    feedsRowVerdict: false,
    kindConsistent: evidence.kindConsistent,
    verdict: grade.verdict ?? null,
    holds: grade.negativeControl?.holds === true,
    fallbackBranch: grade.fallback?.branch ?? null,
    candidateSha: evidence.candidateSha,
  };
}

/**
 * Grade the row from its two supervised cases only (🌊's final scope ruling, Discord msg
 * 1565927316687691777): `positive` and `negative-replacement-never-usable` (🌻's negative), both on
 * the branch systemd-supervised fleet seats take. The update-respawn controls are reported in
 * `controls`, beside the verdict: they neither raise it nor are required for it, and everything
 * but `controls` is identical with or without them. The plain in-process restart is a named
 * limit (`namedLimits`), outside both.
 *
 * The verdict starts from the positive's and only moves down:
 * - no positive: MISSING (positive-missing);
 * - no supervised negative: at most PARTIAL (supervised-negative-missing);
 * - a supervised negative that grades PASS: at most MISSING (supervised-negative-not-refused), since
 *   a control that cannot refuse PASS makes its positive no evidence;
 * - a supervised negative that does not hold: at most PARTIAL (supervised-negative-not-holding);
 * - supervised cases from different candidates: at most MISSING; from different docs harnesses: at
 *   most PARTIAL;
 * - a repeated supervised case grades from the worst of its receipts (row-case-repeated).
 * Pass only receipts whose observer signature verified (the CLI's --grade-row does).
 */
export function gradeReturnCovenantRow(entries = []) {
  const reasons = [];
  const reason = (code, detail) => reasons.push({ code, detail });
  const rowEvidence = new Map(RCC_ROW_CASES.map((caseKind) => [caseKind, []]));
  const controls = [];
  for (const entry of entries) {
    const evidence = caseEvidence(entry);
    if (evidence.declared === 'update-respawn-control') {
      controls.push(controlSummary(evidence));
      continue;
    }
    if (!evidence.declared) {
      reason('case-unknown', `a receipt for case ${JSON.stringify(evidence.case)} is not a declared case`);
    } else if (!evidence.kindConsistent) {
      reason('case-kind-mismatch', `a ${evidence.case} receipt states kind ${JSON.stringify(evidence.stated)}, not ${evidence.declared}; not counted`);
    } else if (!RCC_VERDICTS.includes(evidence.grade?.verdict)) {
      reason('case-grade-missing', `a ${evidence.case} receipt carries no graded verdict; not counted`);
    } else {
      rowEvidence.get(evidence.case).push(evidence);
    }
  }

  const counted = [...rowEvidence.values()].flat();
  for (const [field, code, ceiling] of [
    ['candidateSha', 'row-cases-candidate-mismatch', 'MISSING-candidate'],
    ['docsSha', 'row-cases-docs-mismatch', 'PARTIAL-candidate'],
  ]) {
    const values = [...new Set(counted.map((evidence) => evidence[field]))];
    if (values.length > 1) reason(code, `the supervised cases disagree on ${field}: ${values.join(', ')}`);
  }
  for (const [caseKind, list] of rowEvidence) {
    if (list.length > 1) reason('row-case-repeated', `${list.length} receipts for ${caseKind}; the worst of them is graded`);
  }

  const positives = rowEvidence.get('positive').map(positiveSummary);
  const positive = positives.reduce((worst, entry) => (worst && VERDICT_RANK[worst.verdict] <= VERDICT_RANK[entry.verdict] ? worst : entry), null) ??
    { present: false, case: 'positive' };
  if (!positive.present) reason('positive-missing', 'no verified positive receipt: the row has no supervised claim to grade');

  const negatives = rowEvidence.get('negative-replacement-never-usable').map(supervisedNegativeSummary);
  const supervisedNegative = negatives.find((entry) => !entry.nonPass) ??
    negatives.find((entry) => !entry.holds) ??
    negatives[0] ??
    { present: false, case: 'negative-replacement-never-usable' };
  if (!supervisedNegative.present) {
    reason('supervised-negative-missing', 'no verified negative-replacement-never-usable receipt: the supervised claim has no negative');
  } else if (!supervisedNegative.nonPass) {
    reason('supervised-negative-not-refused', 'the supervised negative graded PASS: a control that cannot refuse PASS makes its positive no evidence');
  } else if (!supervisedNegative.holds) {
    const unmet = ['failure', 'failureBodyRetained', 'outageObserved', 'authorityRetained', 'noFallback']
      .filter((field) => !supervisedNegative[field]);
    reason('supervised-negative-not-holding', `the supervised negative is non-PASS but does not hold${unmet.length ? ` (${unmet.join(', ')})` : ''}`);
  }

  const ceilings = {
    'positive-missing': 'MISSING-candidate',
    'supervised-negative-missing': 'PARTIAL-candidate',
    'supervised-negative-not-refused': 'MISSING-candidate',
    'supervised-negative-not-holding': 'PARTIAL-candidate',
    'row-cases-candidate-mismatch': 'MISSING-candidate',
    'row-cases-docs-mismatch': 'PARTIAL-candidate',
  };
  let verdict = positive.present ? positive.verdict : 'MISSING-candidate';
  for (const entry of reasons) if (ceilings[entry.code]) verdict = lowerVerdict(verdict, ceilings[entry.code]);
  const single = (field) => {
    const values = [...new Set(counted.map((evidence) => evidence[field]))];
    return values.length === 1 ? values[0] : null;
  };

  return {
    schema: RCC_ROW_VERDICT_SCHEMA,
    row: RCC_ROW,
    verdict,
    corpusStateCeiling: CORPUS_STATE_CEILING[verdict],
    gradedFrom: [...RCC_ROW_CASES],
    candidateSha: single('candidateSha'),
    docsSha: single('docsSha'),
    positive,
    supervisedNegative,
    reasons,
    namedLimits: [{ ...RCC_IN_PROCESS_RESTART }],
    controls,
  };
}

/* ------------------------------------------------------------------------------------ */
/* Observer receipt                                                                      */
/* ------------------------------------------------------------------------------------ */

export function observerKeyFingerprint(key) {
  return sha256(`${RCC_OBSERVER_ALGORITHM}\0${key}`).slice(0, 16);
}

// The signature covers every field except the integrity block itself.
function unsignedCanonical(value) {
  const { integrity: _integrity, ...unsigned } = value;
  return canonicalJson(unsigned);
}

export function sealObserverReceipt(receipt, key) {
  return sealSignedObserverReceipt({
    receipt,
    signingKey: key,
    canonicalize: unsignedCanonical,
    algorithm: RCC_OBSERVER_ALGORITHM,
  });
}

export function verifyObserverReceipt(receipt, key) {
  if (!receipt || typeof receipt !== 'object') return false;
  return validateSignedObserverReceiptIntegrity({
    receipt,
    signingKey: key,
    canonicalize: unsignedCanonical,
    algorithm: RCC_OBSERVER_ALGORITHM,
  });
}
