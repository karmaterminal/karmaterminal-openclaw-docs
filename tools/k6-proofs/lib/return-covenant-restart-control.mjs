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
// A launcher-held key the gateway processes never receive (they get a cleared env), so the
// candidate under test cannot sign its own observation. Distinct from the gateway-token
// HMAC that R-CD-2/R-CD-TOKEN use.
export const RCC_OBSERVER_ALGORITHM = 'hmac-sha256-proof-observer-key-v1';
export const RCC_CASES = Object.freeze(['positive', 'negative-replacement-never-usable']);
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
export function planObservationWindow(overrides = {}) {
  const plan = { ...DEFAULT_PLAN };
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
 * The outage a restart opens, measured from the matrix: the last sample that saw a generation
 * serving before the first unserved post-transition sample, to the first sample after it that
 * saw a generation serving again. Every full-process path at F′ closes the old server first,
 * so the interval exists on every branch; its precision is one sample interval.
 * `firstServingAfter.generation` is `replacement` for a fresh successor and `old` when the
 * original process serves again (the spawned branch's in-process fallback). `open` means
 * nothing served again before the observation ended.
 */
export function computeOutageInterval(record) {
  const samples = sortedSamples(record);
  const triggerAtMs = record?.observation?.triggerAtMs;
  const resolutionMs = record?.plan?.sampleIntervalMs ?? null;
  const base = { observed: false, lastServingBefore: null, firstServingAfter: null, ms: null, open: false, unservedSamples: 0, resolutionMs };
  if (!finiteTime(triggerAtMs) || samples.length === 0) return { ...base, reason: 'no-transition-observed' };
  const gapStart = samples.findIndex((sample) => sample.atMs >= triggerAtMs && servingGenerationOf(sample) === null);
  if (gapStart < 0) return { ...base, reason: 'no-unserved-sample-after-transition' };
  let beforeIndex = gapStart - 1;
  while (beforeIndex >= 0 && servingGenerationOf(samples[beforeIndex]) === null) beforeIndex -= 1;
  const afterIndex = samples.findIndex((sample, index) => index > gapStart && servingGenerationOf(sample) !== null);
  const before = beforeIndex < 0 ? null : samples[beforeIndex];
  const after = afterIndex < 0 ? null : samples[afterIndex];
  return {
    ...base,
    observed: true,
    lastServingBefore: servingPoint(before),
    firstServingAfter: servingPoint(after),
    ms: before && after ? after.atMs - before.atMs : null,
    open: after === null,
    unservedSamples: (afterIndex < 0 ? samples.length : afterIndex) - beforeIndex - 1,
  };
}

function receiptPresence(record) {
  const old = record?.generations?.old;
  const replacement = record?.generations?.replacement;
  const transition = record?.transition;
  const bodies = transition?.httpBodies;
  const observation = record?.observation;
  const plan = record?.plan;
  const capture = (value) => Boolean(value) && Number.isSafeInteger(value.bytes) && isHex64(value.sha256);
  return {
    'transition-http-body': Boolean(
      transition?.response &&
        isHex64(transition.response.sha256) &&
        transition.response.frame &&
        typeof transition.response.frame === 'object' &&
        bodies?.lastPreTrigger?.readyz &&
        (bodies.firstPostTriggerNotReady || bodies.firstReplacementReady),
    ),
    'replacement-process-output': Boolean(
      replacement?.started && capture(replacement.stdout) && capture(replacement.stderr),
    ),
    'generation-fingerprints': Boolean(
      positiveInteger(old?.pid) &&
        positiveInteger(old?.startTicks) &&
        positiveInteger(old?.listen?.inode) &&
        isHex64(old?.bootIdSha256) &&
        positiveInteger(replacement?.pid) &&
        positiveInteger(replacement?.startTicks) &&
        // A replacement that never listened has no socket to fingerprint; its process
        // identity still must be retained.
        (replacement?.readyAtMs ? positiveInteger(replacement?.listen?.inode) && isHex64(replacement?.bootIdSha256) : true),
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
 * Grade one control record. Precedence: a contradicted behaviour is FAIL; with no observed
 * transition there is nothing to judge (MISSING); a positive chain with a missing receipt is
 * PARTIAL; only the full receipt chain plus the positive behaviour is PASS.
 */
export function gradeRestartControl(record) {
  const failures = [];
  const partials = [];
  const missingBehaviour = [];
  const fail = (code, detail) => failures.push({ code, detail });
  const partial = (code, detail) => partials.push({ code, detail });
  const missing = (code, detail) => missingBehaviour.push({ code, detail });

  const receipts = receiptPresence(record);
  const missingReceipts = RCC_RECEIPTS.filter((name) => !receipts[name]);
  const observed = receipts['observation-record'];
  const samples = observed ? [...samplesOf(record)].sort((a, b) => a.atMs - b.atMs) : [];
  const plan = record?.plan ?? {};
  const authority = record?.authority ?? {};
  const old = record?.generations?.old ?? {};
  const replacement = record?.generations?.replacement ?? {};
  const transition = record?.transition ?? {};
  const triggerAtMs = record?.observation?.triggerAtMs;
  const endAtMs = record?.observation?.endAtMs;
  const caseKind = record?.case;

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

  // No predicate credits a generation as usable through the outage: at F′ the old server
  // closes before any successor is ready (🌊's ruling), so continuous service is not an
  // invariant. The outage is measured and reported instead (grade.outageInterval).

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
      }
    }
  }

  // B9: both generations ran the staged candidate build.
  const stageBuildId = record?.target?.stageBuild?.buildId;
  if (transitionHappened) {
    if (typeof stageBuildId !== 'string' || !stageBuildId) {
      partial('build-identity-unverified', 'the stage build-info carries no buildId to bind the generations to');
    } else {
      if (old.buildId !== stageBuildId) fail('build-identity-mismatch', 'the old generation did not report the staged buildId');
      if (finiteTime(readyAt) && replacement.buildId !== stageBuildId) fail('build-identity-mismatch', 'the replacement did not report the staged buildId');
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

  let verdict;
  if (failures.length) verdict = 'FAIL-candidate';
  else if (missingBehaviour.length) verdict = 'MISSING-candidate';
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
    negativeControl = {
      expected: 'non-PASS with the old authority (epoch and fingerprint) and the failure body retained, and no fallback on the supervised branch',
      replacementNeverUsable,
      oldAuthorityRetained,
      failureBodyRetained,
      noFallback,
      holds: verdict !== 'PASS-candidate' && replacementNeverUsable && oldAuthorityRetained && failureBodyRetained && noFallback,
    };
  }

  return {
    verdict,
    corpusStateCeiling: {
      'PASS-candidate': 'pass',
      'PARTIAL-candidate': 'partial',
      'FAIL-candidate': 'fail',
      'MISSING-candidate': 'missing',
    }[verdict],
    receipts: Object.fromEntries(RCC_RECEIPTS.map((name) => [name, receipts[name] ? 'present' : 'missing'])),
    missingReceipts,
    failures,
    partials,
    missingBehaviour,
    negativeControl,
    outageInterval: outage,
    fallback: {
      branch: 'none-on-supervised-branch',
      class: 'not-applicable',
      detail: 'the supervised branch (src/cli/gateway-cli/run-loop.ts:497-561) writes the handoff and exits; it has no in-process fallback once the handoff is written',
    },
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
