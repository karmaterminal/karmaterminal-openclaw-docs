import { fingerprint16 } from './receipt-seal.mjs';

/**
 * One explicit answer to "what happened to this row's observability evidence?".
 *
 * Node-only post-run module. Never import it from a k6 scenario graph.
 *
 * Before this module, a failed trace correlation left an empty
 * `continuation-trace-collector.json` plus a one-line prose `.error.log`. Every
 * row that lost its trace therefore looked identical from the outside: the
 * corpus recorded the same two `pendingReceipts`
 * (`tempo-trace-json`, `continuation-trace-correlation`) whether Tempo was
 * unreachable, the window held no candidate, two traces matched, or a matched
 * trace failed a topology gate. Reviewers had to re-derive the difference by
 * hand, and a row could not be re-bound later without firing the product again.
 *
 * The contract here is deliberately asymmetric:
 *
 *  - `correlated` is the ONLY status permitted to carry correlation artifacts;
 *  - every other status MUST carry a `rebind` block — the deterministic keys
 *    (service, TraceQL query, search window, reason fingerprint, mode, row
 *    nonce fingerprint) that let a later resolution re-attempt the binding
 *    against the same evidence when the backend returns;
 *  - absence of observability is a first-class, named outcome, never an empty
 *    file that a downstream reader can mistake for "nothing to report".
 */

export const OBSERVABILITY_OUTCOME_SCHEMA = 'openclaw.k6.observability-outcome.v1';

/** Terminal classifications for one row's trace-correlation attempt. */
export const TRACE_OUTCOME = Object.freeze({
  CORRELATED: 'correlated',
  BACKEND_UNAVAILABLE: 'backend-unavailable',
  NO_MATCHING_TRACE: 'no-matching-trace',
  AMBIGUOUS_TRACE: 'ambiguous-trace',
  TOPOLOGY_INVALID: 'topology-invalid',
  CONTRACT_INVALID: 'contract-invalid',
});

const TRACE_OUTCOMES = new Set(Object.values(TRACE_OUTCOME));
const UNRESOLVED_OUTCOMES = new Set([
  TRACE_OUTCOME.BACKEND_UNAVAILABLE,
  TRACE_OUTCOME.NO_MATCHING_TRACE,
  TRACE_OUTCOME.AMBIGUOUS_TRACE,
  TRACE_OUTCOME.TOPOLOGY_INVALID,
  TRACE_OUTCOME.CONTRACT_INVALID,
]);

const NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH',
]);

/**
 * True when the failure is a transport failure rather than an answer.
 *
 * Shared with the collector's retry decision so "should this be retried?" and
 * "was the backend unavailable?" cannot drift into two different answers.
 */
export function isTransportFailure(error) {
  if (!error) return false;
  if (NETWORK_ERROR_CODES.has(error.code) || NETWORK_ERROR_CODES.has(error.cause?.code)) return true;
  // Node's fetch reports every transport failure as `TypeError: fetch failed`.
  const message = String(error.message || '');
  if (error.name === 'TypeError' && /fetch failed/i.test(message)) return true;
  return error.cause?.name === 'TypeError' && /fetch failed/i.test(String(error.cause.message || ''));
}

/** HTTP statuses worth another attempt inside the collection deadline. */
export function isRetryableHttpStatus(status) {
  return status === 404 || status === 429;
}

/** The HTTP status carried by an error or the error it wraps, if any. */
export function httpStatusOf(error) {
  const direct = Number(error?.httpStatus);
  if (Number.isInteger(direct)) return direct;
  const wrapped = Number(error?.cause?.httpStatus);
  return Number.isInteger(wrapped) ? wrapped : null;
}

/** Which Tempo endpoint produced the failure, if the thrower said so. */
export function tempoEndpointOf(error) {
  return error?.tempoEndpoint || error?.cause?.tempoEndpoint || null;
}

/**
 * True when the backend actually answered the question and had nothing.
 *
 * This is a narrower test than "4xx", and the narrowness is the point. Tempo
 * answers a search that matches nothing with 200 and an empty result set, so a
 * 404 from `/api/search` means the route is not there — a wrong base URL, API
 * version, or tenant prefix. That is an operator condition, and reporting it as
 * `no-matching-trace` would state something about the product run that nobody
 * established. Only a 404 from `/api/traces/<id>` is Tempo telling us it is not
 * carrying that trace; a 401/403 means we were refused and learned nothing.
 *
 * The endpoint must say so explicitly. An untagged 404 — from a call site that
 * has not declared which route it hit — resolves to unavailable rather than to
 * a claim about the run, so forgetting the tag can only lose information, never
 * manufacture a product statement.
 */
function answeredWithNothing(error, status) {
  return status === 404 && tempoEndpointOf(error) === 'trace';
}

/**
 * Classify a collector failure without guessing.
 *
 * A failure to obtain an answer is the only case allowed to claim the backend
 * was unavailable; a reachable backend that answered and had nothing stays
 * `no-matching-trace`, which is a product/evidence statement, not an
 * infrastructure excuse. The transport test is deliberately narrow — any
 * `TypeError` would sweep an internal collector bug into the same excuse.
 *
 * The status and transport checks look through `cause`, because the collector
 * re-wraps the last failure when its deadline expires. Reading only the outer
 * error would drop the status and land every timed-out fetch on
 * `topology-invalid` — the most product-blaming outcome in the enum — for a
 * trace the collector never actually obtained.
 */
export function classifyTraceFailure({ error, candidateCount = 0, contractResolved = true } = {}) {
  const message = String(error?.message || error || '');
  if (!contractResolved) return TRACE_OUTCOME.CONTRACT_INVALID;
  const status = httpStatusOf(error);
  if (status !== null) {
    return answeredWithNothing(error, status)
      ? TRACE_OUTCOME.NO_MATCHING_TRACE
      : TRACE_OUTCOME.BACKEND_UNAVAILABLE;
  }
  if (isTransportFailure(error)) return TRACE_OUTCOME.BACKEND_UNAVAILABLE;
  if (/trace correlation is ambiguous/i.test(message)) return TRACE_OUTCOME.AMBIGUOUS_TRACE;
  if (candidateCount > 1) return TRACE_OUTCOME.AMBIGUOUS_TRACE;
  if (candidateCount === 0) return TRACE_OUTCOME.NO_MATCHING_TRACE;
  return TRACE_OUTCOME.TOPOLOGY_INVALID;
}

/**
 * Deterministic re-binding keys for a row whose trace is not yet correlated.
 * Everything here is public-safe: fingerprints and hashes, never raw nonces,
 * session keys, prompts, or traceparent material.
 */
export function traceRebindKeys({
  serviceName = null,
  query = null,
  startUnixSeconds = null,
  endUnixSeconds = null,
  reasonHash = null,
  reasonLength = null,
  delegateMode = null,
  tool = null,
  rowNonce = null,
  sessionKeys = [],
} = {}) {
  return {
    serviceName: serviceName || null,
    query: query || null,
    searchWindow: {
      startUnixSeconds: Number.isFinite(startUnixSeconds) ? startUnixSeconds : null,
      endUnixSeconds: Number.isFinite(endUnixSeconds) ? endUnixSeconds : null,
    },
    tool: tool || null,
    delegateMode: delegateMode || null,
    reason: {
      hash: typeof reasonHash === 'string' && reasonHash.length > 0 ? reasonHash : null,
      length: Number.isInteger(reasonLength) ? reasonLength : null,
    },
    rowNonceFingerprint: fingerprint16(rowNonce),
    sessionFingerprints: (Array.isArray(sessionKeys) ? sessionKeys : [])
      .map((key) => fingerprint16(key))
      .filter(Boolean),
  };
}

/**
 * Build the structured outcome. Callers pass artifacts only for a real
 * correlation; `buildObservabilityOutcome` refuses to attach them to any other
 * status so a partial run can never be serialized into a success shape.
 */
export function buildObservabilityOutcome({
  row,
  seat,
  status,
  detail = null,
  candidateCount = 0,
  attempts = null,
  timeoutMs = null,
  traceId = null,
  traceJson = null,
  correlationReceipt = null,
  rebind = null,
}) {
  if (!TRACE_OUTCOMES.has(status)) {
    throw new Error(`unknown observability status: ${status}`);
  }
  const correlated = status === TRACE_OUTCOME.CORRELATED;
  if (!correlated && (traceId || traceJson || correlationReceipt)) {
    throw new Error(`observability status ${status} must not carry correlation artifacts`);
  }
  if (correlated && !(traceId && traceJson && correlationReceipt)) {
    throw new Error('correlated observability outcome requires traceId, traceJson and correlationReceipt');
  }
  if (!correlated && !rebind) {
    throw new Error(`observability status ${status} requires rebind keys`);
  }
  return {
    schema: OBSERVABILITY_OUTCOME_SCHEMA,
    row: row || null,
    seat: seat || null,
    status,
    resolved: correlated,
    // An unresolved outcome is explicit review debt, never an implicit pass.
    reviewDebt: correlated ? [] : ['tempo-trace-json', 'continuation-trace-correlation'],
    detail: detail ? String(detail) : null,
    candidateCount: Number.isInteger(candidateCount) ? candidateCount : 0,
    attempts: Number.isInteger(attempts) ? attempts : null,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : null,
    traceId: correlated ? traceId : null,
    traceJson: correlated ? traceJson : null,
    correlationReceipt: correlated ? correlationReceipt : null,
    rebind: correlated ? null : rebind,
  };
}

const FORBIDDEN_MARKERS = ['traceparent', '[k6-proof-harness]', 'agent:'];

/**
 * Fail closed on an outcome that leaked private attribution material or that
 * claims a resolution it cannot evidence.
 */
export function validateObservabilityOutcome(outcome) {
  if (!outcome || outcome.schema !== OBSERVABILITY_OUTCOME_SCHEMA) {
    return { valid: false, reason: 'invalid-schema' };
  }
  if (!TRACE_OUTCOMES.has(outcome.status)) return { valid: false, reason: 'invalid-status' };
  const correlated = outcome.status === TRACE_OUTCOME.CORRELATED;
  if (outcome.resolved !== correlated) return { valid: false, reason: 'resolved-status-mismatch' };
  if (correlated) {
    if (!outcome.traceId || !outcome.traceJson || !outcome.correlationReceipt) {
      return { valid: false, reason: 'missing-correlation-artifacts' };
    }
    if (outcome.rebind) return { valid: false, reason: 'correlated-carries-rebind' };
    if ((outcome.reviewDebt || []).length !== 0) return { valid: false, reason: 'correlated-carries-review-debt' };
  } else {
    if (outcome.traceId || outcome.traceJson || outcome.correlationReceipt) {
      return { valid: false, reason: 'unresolved-carries-artifacts' };
    }
    if (!outcome.rebind) return { valid: false, reason: 'missing-rebind' };
    if (!UNRESOLVED_OUTCOMES.has(outcome.status)) return { valid: false, reason: 'invalid-status' };
    if (!Array.isArray(outcome.reviewDebt) || outcome.reviewDebt.length === 0) {
      return { valid: false, reason: 'unresolved-without-review-debt' };
    }
  }
  const serialized = JSON.stringify(outcome).toLowerCase();
  for (const marker of FORBIDDEN_MARKERS) {
    if (serialized.includes(marker)) return { valid: false, reason: 'private-material' };
  }
  return { valid: true, status: outcome.status };
}
