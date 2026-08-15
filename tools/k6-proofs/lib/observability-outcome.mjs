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
 * Classify a collector failure without guessing.
 *
 * A transport failure is the only case allowed to claim the backend was
 * unavailable; a reachable backend that returned nothing stays
 * `no-matching-trace`, which is a product/evidence statement, not an
 * infrastructure excuse. The transport test is deliberately narrow — any
 * `TypeError` would sweep an internal collector bug into the same excuse.
 */
export function classifyTraceFailure({ error, candidateCount = 0, contractResolved = true } = {}) {
  const message = String(error?.message || error || '');
  if (!contractResolved) return TRACE_OUTCOME.CONTRACT_INVALID;
  // A reachable Tempo that answers 404 or another 4xx has *told* us something:
  // it is not carrying the trace. Only a server-side or rate-limit refusal is
  // an availability claim.
  const status = Number(error?.httpStatus);
  if (Number.isInteger(status)) {
    if (status >= 500 || status === 429) return TRACE_OUTCOME.BACKEND_UNAVAILABLE;
    return TRACE_OUTCOME.NO_MATCHING_TRACE;
  }
  if (NETWORK_ERROR_CODES.has(error?.code) || NETWORK_ERROR_CODES.has(error?.cause?.code)) {
    return TRACE_OUTCOME.BACKEND_UNAVAILABLE;
  }
  // Node's fetch reports every transport failure as `TypeError: fetch failed`.
  if (error?.name === 'TypeError' && /fetch failed/i.test(message)) {
    return TRACE_OUTCOME.BACKEND_UNAVAILABLE;
  }
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
