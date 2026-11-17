import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { canonicalJson } from '../lib/canonical-json.mjs';
import {
  HARNESS_CLIENT_IDENTITY,
  HARNESS_CLIENT_OVERRIDE_ENV,
} from '../lib/gateway-client-identity.mjs';

// v3: readiness connects as the row scenarios' backend identity (v2 connected as
// `cli`, which an auth.mode=none Gateway refuses) and records the Gateway's auth method.
export const READINESS_SCHEMA = 'openclaw.k6.seat-readiness.v3';
export const READINESS_SIGNATURE_ALGORITHM = 'hmac-sha256-gateway-token-v1';
export const READINESS_CLIENT = Object.freeze({
  id: HARNESS_CLIENT_IDENTITY.id,
  mode: HARNESS_CLIENT_IDENTITY.mode,
  version: 'k6-proof-readiness-v3',
  platform: 'node',
});
// hello-ok auth.method values readiness vouches for, the two auth modes the fleet runs:
// "token" (the Gateway verified the shared token) or "none" (auth.mode=none; no
// credential was verified, so the token only keys the receipt signature). A password-mode
// Gateway would also take the token field as its password (openclaw ab5a auth.ts:131-137),
// but no seat runs one, so it fails closed here rather than pass unexamined.
export const READINESS_AUTH_METHODS = Object.freeze(['none', 'token']);

// The v2 receipt as the v2 harness wrote it: connected as `cli`, no recorded auth method.
// No live gate accepts it. validatePreV3ReadinessReceipt re-verifies one only for a committed
// run frozen, with its receipt's exact bytes, in PRE_V3_READINESS_RUNS_FILE.
export const PRE_V3_READINESS_SCHEMA = 'openclaw.k6.seat-readiness.v2';
export const PRE_V3_READINESS_CLIENT = Object.freeze({
  id: 'cli',
  mode: 'cli',
  version: 'k6-proof-readiness-v2',
  platform: 'node',
});
export const PRE_V3_READINESS_RUNS_FILE = new URL('./pre-v3-readiness-r-cd-2-runs.json', import.meta.url);
const PRE_V3_READINESS_RUNS_SCHEMA = 'openclaw.k6.pre-v3-readiness-r-cd-2-runs.v1';

const SHA = /^[0-9a-f]{40}$/u;
const DIGEST = /^[0-9a-f]{64}$/u;
const PUBLIC_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]*$/u;
const ERROR_CODE = /^[A-Z][A-Z0-9_]{0,63}$/u;
const PRE_V3_RUN = /^[0-9a-f]{40}\/R-CD-2\/[A-Za-z0-9._:-]+\/[A-Za-z0-9._:-]+$/u;

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * The HARNESS_CLIENT_OVERRIDE_ENV names present in `env`, even empty. A row scenario's
 * connectFrame honours them, so while one is set the rows may connect as an identity
 * readiness never checked; readiness refuses to pass instead of vouching for it.
 */
export function harnessClientOverrides(env = process.env) {
  return HARNESS_CLIENT_OVERRIDE_ENV.filter((name) => Object.hasOwn(env, name));
}

export function gatewayUrlFingerprint(value) {
  try {
    const url = new URL(value);
    if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password) return null;
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/u, '') || '/';
    if (url.search) return null;
    url.hash = '';
    return sha256(url.toString());
  } catch {
    return null;
  }
}

export function selectedRows(value) {
  let rows = value;
  if (typeof rows === 'string' && rows.trim().startsWith('[')) {
    try {
      rows = JSON.parse(rows);
    } catch {
      return null;
    }
  } else if (typeof rows === 'string') {
    rows = rows.split(',');
  }
  if (!Array.isArray(rows)) return null;
  const normalized = [...new Set(rows.map((row) =>
    typeof row === 'string' ? row.trim().toUpperCase() : '',
  ))].filter(Boolean).sort();
  return normalized.length > 0 && normalized.every((row) => /^[A-Z0-9][A-Z0-9._-]*$/u.test(row))
    ? normalized
    : null;
}

function positiveInteger(value) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function observedDepths(payload) {
  const configured = positiveInteger(
    payload?.sourceConfig?.agents?.defaults?.subagents?.maxSpawnDepth,
  );
  const effective = positiveInteger(
    payload?.config?.agents?.defaults?.subagents?.maxSpawnDepth,
  );
  return { configured, effective };
}

export function observedContinuation(payload) {
  const summarize = (value) => ({
    enabled: typeof value?.enabled === 'boolean' ? value.enabled : null,
    defaultsPresent: Boolean(
      value &&
      Object.hasOwn(value, 'maxChainLength') &&
      Object.hasOwn(value, 'maxDelegatesPerTurn') &&
      Object.hasOwn(value, 'costCapTokens'),
    ),
  });
  return {
    configured: summarize(payload?.sourceConfig?.agents?.defaults?.continuation),
    effective: summarize(payload?.config?.agents?.defaults?.continuation),
  };
}

function validHello(hello) {
  return (
    hello?.type === 'hello-ok' &&
    hello.protocol === 4 &&
    typeof hello.server?.version === 'string' &&
    hello.server.version.length > 0 &&
    typeof hello.server?.connId === 'string' &&
    hello.server.connId.length > 0 &&
    Array.isArray(hello.features?.methods) &&
    hello.features.methods.includes('config.get') &&
    Array.isArray(hello.features?.events) &&
    hello.snapshot &&
    typeof hello.snapshot === 'object' &&
    hello.auth?.role === 'operator' &&
    Array.isArray(hello.auth?.scopes) &&
    (hello.auth.scopes.includes('operator.read') || hello.auth.scopes.includes('operator.admin')) &&
    Number.isInteger(hello.policy?.maxPayload) &&
    Number.isInteger(hello.policy?.maxBufferedBytes) &&
    Number.isInteger(hello.policy?.tickIntervalMs)
  );
}

function publicServerIdentity(hello) {
  const server = hello?.server;
  const connId = typeof server?.connId === 'string' && server.connId ? server.connId : null;
  return {
    protocol: positiveInteger(hello?.protocol),
    version: typeof server?.version === 'string' ? server.version : null,
    buildId: typeof server?.buildId === 'string' ? server.buildId : null,
    bootIdHash: typeof server?.bootId === 'string' ? sha256(server.bootId) : null,
    connectionIdHash: connId ? sha256(connId) : null,
    authMethod: typeof hello?.auth?.method === 'string' ? hello.auth.method : null,
    authRole: hello?.auth?.role || null,
    authScopes: Array.isArray(hello?.auth?.scopes) ? [...hello.auth.scopes].sort() : null,
  };
}

// Public-safe form of a connect error: the Gateway's code and detail code only, never its message.
function rejectionCode(error) {
  const code = ERROR_CODE.test(error?.code || '') ? error.code : null;
  const detail = ERROR_CODE.test(error?.details?.code || '') ? error.details.code : null;
  return code ? [code, detail].filter(Boolean).join('/') : null;
}

function failure(reason, rejection = null) {
  return {
    authenticated: false,
    error: reason,
    rejection,
    config: null,
    requestIdentity: null,
    responseIdentity: null,
  };
}

/**
 * Read-only config.get on the supplied target, connecting as the row scenarios'
 * backend identity with the token and no device; no host config is consulted.
 */
export async function inspectTarget(wsUrl, token, {
  WebSocketImpl = globalThis.WebSocket,
  timeoutMs = 5000,
} = {}) {
  if (!gatewayUrlFingerprint(wsUrl)) return failure('gateway-url-invalid');
  if (typeof token !== 'string' || token.length === 0) return failure('gateway-token-missing');
  if (typeof WebSocketImpl !== 'function') return failure('websocket-unavailable');

  return await new Promise((resolve) => {
    const connectRequestId = `readiness-connect-${randomUUID()}`;
    const configRequestId = `readiness-config-${randomUUID()}`;
    let socket;
    let settled = false;
    let connectSent = false;
    let hello = null;
    let challengeHash = null;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket?.close();
      } catch {
        // Closing an already-failed transport does not change the failed result.
      }
      resolve(result);
    };
    const timer = setTimeout(() => finish(failure('gateway-rpc-timeout')), timeoutMs);

    try {
      socket = new WebSocketImpl(wsUrl);
    } catch {
      finish(failure('gateway-connect-failed'));
      return;
    }

    socket.onerror = () => finish(failure('gateway-connect-failed'));
    socket.onclose = () => {
      if (!settled) finish(failure('gateway-closed-before-config'));
    };
    socket.onmessage = (event) => {
      let frame;
      try {
        frame = JSON.parse(String(event.data));
      } catch {
        finish(failure('gateway-frame-invalid'));
        return;
      }

      if (frame?.type === 'event' && frame.event === 'connect.challenge') {
        const nonce = typeof frame.payload?.nonce === 'string' ? frame.payload.nonce : '';
        if (!nonce || connectSent) {
          finish(failure('gateway-challenge-invalid'));
          return;
        }
        challengeHash = sha256(nonce);
        connectSent = true;
        socket.send(JSON.stringify({
          type: 'req',
          id: connectRequestId,
          method: 'connect',
          params: {
            minProtocol: 4,
            maxProtocol: 4,
            client: READINESS_CLIENT,
            role: 'operator',
            scopes: ['operator.read'],
            caps: [],
            commands: [],
            permissions: {},
            auth: { token },
            userAgent: READINESS_CLIENT.version,
          },
        }));
        return;
      }

      if (frame?.type !== 'res') return;
      if (frame.id === connectRequestId) {
        if (frame.ok !== true) {
          finish(failure('gateway-auth-rejected', rejectionCode(frame.error)));
          return;
        }
        if (!validHello(frame.payload)) {
          finish(failure('gateway-auth-rejected'));
          return;
        }
        if (!READINESS_AUTH_METHODS.includes(frame.payload.auth.method)) {
          finish(failure('gateway-auth-method-unexpected'));
          return;
        }
        hello = frame.payload;
        socket.send(JSON.stringify({
          type: 'req',
          id: configRequestId,
          method: 'config.get',
          params: {},
        }));
        return;
      }
      if (frame.id === configRequestId) {
        if (
          frame.ok !== true ||
          frame.payload?.valid !== true ||
          !frame.payload.sourceConfig ||
          typeof frame.payload.sourceConfig !== 'object' ||
          !frame.payload.config ||
          typeof frame.payload.config !== 'object' ||
          typeof frame.payload.configRevisionHash !== 'string' ||
          frame.payload.configRevisionHash.length === 0 ||
          frame.payload.configRevisionHash !== frame.payload.appliedConfigHash ||
          !hello
        ) {
          finish(failure('config-get-rejected'));
          return;
        }
        finish({
          authenticated: true,
          error: null,
          config: frame.payload,
          requestIdentity: {
            connectRequestId,
            configRequestId,
            method: 'config.get',
            client: READINESS_CLIENT,
            role: 'operator',
            scopes: ['operator.read'],
            challengeHash,
          },
          responseIdentity: {
            ...publicServerIdentity(hello),
            connectResponseId: connectRequestId,
            configResponseId: configRequestId,
            configRevisionHash: typeof frame.payload.configRevisionHash === 'string'
              ? frame.payload.configRevisionHash
              : null,
            appliedConfigHash: typeof frame.payload.appliedConfigHash === 'string'
              ? frame.payload.appliedConfigHash
              : null,
          },
        });
      }
    };
  });
}

export function evaluateTarget({
  wsUrl,
  configuredDepth,
  effectiveDepth,
  requiredDepth,
  expectedDepth,
  rpc,
  runtimeSha,
  continuation,
}) {
  const notes = [];
  const fingerprint = gatewayUrlFingerprint(wsUrl);
  const required = positiveInteger(requiredDepth);
  const expected = positiveInteger(expectedDepth);
  if (!fingerprint) notes.push('gateway-url-invalid');
  if (rpc?.authenticated !== true) notes.push(rpc?.error || 'target-rpc-unreachable');
  if (rpc?.authenticated !== true && rpc?.rejection) notes.push(`gateway-rejection:${rpc.rejection}`);
  if (!positiveInteger(configuredDepth)) notes.push('configured-depth-unknown');
  if (!positiveInteger(effectiveDepth)) notes.push('effective-depth-unknown');
  if (
    continuation?.configured?.enabled !== true ||
    continuation.configured.defaultsPresent !== true
  ) {
    notes.push('configured-continuation-unready');
  }
  if (
    continuation?.effective?.enabled !== true ||
    continuation.effective.defaultsPresent !== true
  ) {
    notes.push('effective-continuation-unready');
  }
  if (!required) notes.push('required-depth-invalid');
  if (!expected) notes.push('expected-depth-invalid');
  if (positiveInteger(effectiveDepth) && required && effectiveDepth < required) {
    notes.push('effective-depth-insufficient');
  }
  if (positiveInteger(effectiveDepth) && expected && effectiveDepth !== expected) {
    notes.push('effective-depth-unexpected');
  }
  const serverBuildId = rpc?.responseIdentity?.buildId;
  if (
    SHA.test(runtimeSha || '') &&
    (typeof serverBuildId !== 'string' || !serverBuildId.includes(runtimeSha.slice(0, 12)))
  ) {
    notes.push('runtime-sha-not-observed');
  }
  return { pass: notes.length === 0, notes, fingerprint, required, expected };
}

export function readinessBinding(receipt) {
  return {
    candidateSha: receipt?.bindings?.candidateSha,
    runtimeSha: receipt?.bindings?.runtimeSha,
    docsSha: receipt?.bindings?.docsSha,
    gatewayUrlFingerprint: receipt?.target?.gatewayUrlFingerprint,
    seat: receipt?.bindings?.seat,
    unit: receipt?.bindings?.unit,
    selectedRows: receipt?.bindings?.selectedRows,
    configuredMaxSpawnDepth: receipt?.target?.configuredMaxSpawnDepth,
    effectiveMaxSpawnDepth: receipt?.target?.effectiveMaxSpawnDepth,
    requiredMaxSpawnDepth: receipt?.target?.requiredMaxSpawnDepth,
    expectedMaxSpawnDepth: receipt?.target?.expectedMaxSpawnDepth,
    continuation: receipt?.target?.continuation,
    authentication: receipt?.target?.authentication,
  };
}

function unsignedReceipt(receipt) {
  const { integrity: _integrity, ...unsigned } = receipt;
  return unsigned;
}

export function sealReadinessReceipt(receipt, signingKey) {
  if (typeof signingKey !== 'string' || signingKey.length === 0) {
    throw new Error('missing gateway signing key');
  }
  const withDigest = {
    ...unsignedReceipt(receipt),
    bindingDigest: sha256(canonicalJson(readinessBinding(receipt))),
  };
  return {
    ...withDigest,
    integrity: {
      algorithm: READINESS_SIGNATURE_ALGORITHM,
      signature: createHmac('sha256', signingKey)
        .update(canonicalJson(withDigest))
        .digest('hex'),
    },
  };
}

function equalJson(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

// The receipt shapes a validator accepts: the current v3, and the v2 shape exactly as the
// v2 harness wrote it (v2 recorded no auth method, so one present is not that shape).
const V3_RECEIPT = Object.freeze({
  schema: READINESS_SCHEMA,
  client: READINESS_CLIENT,
  authMethodValid: (response) => READINESS_AUTH_METHODS.includes(response.authMethod),
});
const PRE_V3_RECEIPT = Object.freeze({
  schema: PRE_V3_READINESS_SCHEMA,
  client: PRE_V3_READINESS_CLIENT,
  authMethodValid: (response) => !Object.hasOwn(response, 'authMethod'),
});

/**
 * Validates a v3 receipt against the expected bindings. Every gate in front of a live run
 * uses this: the preflight's self-check, verify-seat-readiness.mjs (run-proofs.sh and both
 * workflows), the evidence writer and run-readiness-consumer.mjs. It refuses v1 and v2.
 */
export function validateReadinessReceipt(receipt, expected = {}) {
  return validateReceiptShape(receipt, V3_RECEIPT, expected);
}

let preV3RunsCache;

/**
 * The frozen pre-v3 runs, as Map<run, receipt sha256>. Unreadable or malformed, it is empty
 * and names why, so no v2 receipt is re-verified. Read only by validatePreV3ReadinessReceipt.
 */
function preV3ReadinessRuns() {
  if (preV3RunsCache) return preV3RunsCache;
  try {
    const parsed = JSON.parse(readFileSync(PRE_V3_READINESS_RUNS_FILE, 'utf8'));
    const runs = Array.isArray(parsed?.runs) ? parsed.runs : [];
    if (
      parsed?.schema !== PRE_V3_READINESS_RUNS_SCHEMA ||
      runs.length === 0 ||
      runs.some((entry) =>
        !PRE_V3_RUN.test(entry?.run || '') || !DIGEST.test(entry?.seatReadinessSha256 || '')) ||
      new Set(runs.map((entry) => entry.run)).size !== runs.length
    ) {
      throw new Error('runs is not a list of unique <candidate>/R-CD-2/<seat>/<run> entries with receipt digests');
    }
    preV3RunsCache = {
      runs: new Map(runs.map((entry) => [entry.run, entry.seatReadinessSha256])),
      error: null,
    };
  } catch (error) {
    preV3RunsCache = { runs: new Map(), error: error.message };
  }
  return preV3RunsCache;
}

/**
 * Re-verifies the v2 receipt of a committed R-CD-2 run (lib/r-cd-2-authority-context.mjs).
 * `run` is the run's { candidateSha, row, seat, runId } under its authority root and `raw`
 * the exact bytes of its seat-readiness.json. Only a run frozen in PRE_V3_READINESS_RUNS_FILE,
 * with exactly those bytes, gets this far; its receipt must then have exactly the v2 shape
 * and pass the signature and binding checks v2 had. No live gate calls this.
 */
export function validatePreV3ReadinessReceipt({ raw, run } = {}, expected = {}) {
  const frozen = preV3ReadinessRuns();
  if (frozen.error) return { valid: false, reason: 'pre-v3-run-list-unreadable' };
  const key = [run?.candidateSha, run?.row, run?.seat, run?.runId].join('/');
  if (!PRE_V3_RUN.test(key) || !frozen.runs.has(key)) {
    return { valid: false, reason: 'pre-v3-run-not-listed' };
  }
  if (!Buffer.isBuffer(raw) || sha256(raw) !== frozen.runs.get(key)) {
    return { valid: false, reason: 'pre-v3-receipt-bytes-mismatch' };
  }
  let receipt;
  try {
    receipt = JSON.parse(raw.toString('utf8'));
  } catch {
    return { valid: false, reason: 'invalid-receipt' };
  }
  return validateReceiptShape(receipt, PRE_V3_RECEIPT, expected);
}

function validateReceiptShape(receipt, shape, {
  signingKey,
  candidateSha,
  runtimeSha,
  docsSha,
  gatewayWs,
  gatewayFingerprint,
  seat,
  unit,
  rows,
  requiredDepth,
  expectedDepth,
} = {}) {
  if (
    !receipt ||
    receipt.schema !== shape.schema ||
    receipt.outcome !== 'PASS-candidate' ||
    receipt.target?.authentication?.authenticated !== true ||
    receipt.target?.authentication?.request?.client?.id !== shape.client.id ||
    receipt.target?.authentication?.request?.client?.mode !== shape.client.mode ||
    receipt.target?.authentication?.request?.client?.version !== shape.client.version ||
    receipt.target?.authentication?.request?.role !== 'operator' ||
    !equalJson(receipt.target?.authentication?.request?.scopes, ['operator.read']) ||
    !DIGEST.test(receipt.target?.authentication?.request?.challengeHash || '') ||
    receipt.target?.authentication?.request?.method !== 'config.get' ||
    receipt.target?.authentication?.response?.connectResponseId !==
      receipt.target?.authentication?.request?.connectRequestId ||
    receipt.target?.authentication?.response?.configResponseId !==
      receipt.target?.authentication?.request?.configRequestId ||
    receipt.target?.authentication?.response?.protocol !== 4 ||
    typeof receipt.target?.authentication?.response?.version !== 'string' ||
    !DIGEST.test(receipt.target?.authentication?.response?.connectionIdHash || '') ||
    !shape.authMethodValid(receipt.target.authentication.response) ||
    receipt.target?.authentication?.response?.authRole !== 'operator' ||
    !Array.isArray(receipt.target?.authentication?.response?.authScopes) ||
    !receipt.target.authentication.response.authScopes.includes('operator.read') ||
    typeof receipt.target?.authentication?.response?.configRevisionHash !== 'string' ||
    receipt.target.authentication.response.configRevisionHash.length === 0 ||
    receipt.target.authentication.response.configRevisionHash !==
      receipt.target.authentication.response.appliedConfigHash ||
    !DIGEST.test(receipt.bindingDigest || '') ||
    receipt.bindingDigest !== sha256(canonicalJson(readinessBinding(receipt))) ||
    receipt.integrity?.algorithm !== READINESS_SIGNATURE_ALGORITHM ||
    !DIGEST.test(receipt.integrity?.signature || '') ||
    typeof signingKey !== 'string' ||
    signingKey.length === 0
  ) {
    return { valid: false, reason: 'invalid-receipt' };
  }
  const expectedSignature = createHmac('sha256', signingKey)
    .update(canonicalJson(unsignedReceipt(receipt)))
    .digest('hex');
  if (!timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(receipt.integrity.signature, 'hex'),
  )) {
    return { valid: false, reason: 'invalid-signature' };
  }

  const expected = {
    candidateSha,
    runtimeSha,
    docsSha,
    gatewayUrlFingerprint: gatewayFingerprint || gatewayUrlFingerprint(gatewayWs),
    seat,
    unit,
    selectedRows: selectedRows(rows),
    requiredMaxSpawnDepth: positiveInteger(requiredDepth),
    expectedMaxSpawnDepth: positiveInteger(expectedDepth),
  };
  if (
    !SHA.test(expected.candidateSha || '') ||
    !SHA.test(expected.runtimeSha || '') ||
    !SHA.test(expected.docsSha || '') ||
    !expected.gatewayUrlFingerprint ||
    !PUBLIC_ID.test(expected.seat || '') ||
    !PUBLIC_ID.test(expected.unit || '') ||
    !expected.selectedRows ||
    !expected.requiredMaxSpawnDepth ||
    !expected.expectedMaxSpawnDepth
  ) {
    return { valid: false, reason: 'invalid-expected-binding' };
  }
  for (const key of Object.keys(expected)) {
    if (!equalJson(receipt.bindings?.[key] ?? receipt.target?.[key], expected[key])) {
      return { valid: false, reason: `binding-mismatch:${key}` };
    }
  }
  if (
    receipt.bindings.candidateSha !== receipt.bindings.runtimeSha ||
    receipt.target.continuation?.configured?.enabled !== true ||
    receipt.target.continuation?.configured?.defaultsPresent !== true ||
    receipt.target.continuation?.effective?.enabled !== true ||
    receipt.target.continuation?.effective?.defaultsPresent !== true ||
    receipt.target.configuredMaxSpawnDepth < 1 ||
    receipt.target.effectiveMaxSpawnDepth < receipt.target.requiredMaxSpawnDepth ||
    receipt.target.effectiveMaxSpawnDepth !== receipt.target.expectedMaxSpawnDepth
  ) {
    return { valid: false, reason: 'invalid-readiness-assertion' };
  }
  return { valid: true, reason: null };
}
