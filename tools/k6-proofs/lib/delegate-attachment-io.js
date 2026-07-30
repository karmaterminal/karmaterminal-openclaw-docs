/**
 * Shared helpers for the P86 delegate attachment I/O row family (docs#491).
 *
 * These rows prove the typed `continue_delegate` INPUT snapshot surface and the
 * managed delegate OUTPUT (`delegate_artifacts_publish` / `delegate_artifacts`)
 * claim lifecycle against the assembly candidate.
 *
 * Public-safety contract enforced here:
 *   - Attachment/artifact CONTENT never enters an artifact. Only a byte count
 *     and a truncated sha256 digest are recorded.
 *   - Every captured event is passed through `redactEvent` first.
 *   - Harness prompt echoes (events carrying HARNESS_MARKER) are excluded from
 *     the raw-byte leak scan, because the harness itself must name the canary in
 *     the instruction it sends. This mirrors the existing R-CD-1 convention.
 *
 * Honesty contract enforced here:
 *   - `computeVerdict` returns PASS-candidate only when every required receipt
 *     fired AND every negative check held. Anything else is PARTIAL-candidate.
 *   - `orchestrationGate` forces PARTIAL-candidate when a row depends on an
 *     operator step (config revoke, gateway restart) that this run did not
 *     observe. A row must never claim PASS on an unperformed precondition.
 */
import crypto from 'k6/crypto';
import { redactEvent } from './gateway-ws.js';

export const HARNESS_MARKER = '[k6-proof-harness]';

/** Deterministic public-safe canary content for a row nonce. */
export function canaryFor(rowNonce) {
  return `P86-CANARY-${rowNonce}`;
}

/** Digest a payload for evidence without ever recording the payload itself. */
export function contentReceipt(value) {
  const text = String(value ?? '');
  return {
    bytes: text.length,
    sha256_prefix: crypto.sha256(text, 'hex').slice(0, 16),
  };
}

export function boolEnv(name) {
  return String(__ENV[name] || '').toLowerCase() === 'true';
}

/**
 * Base evidence record shared by every row in the family.
 * `required` and `negative` are receipt-name arrays used by computeVerdict.
 */
export function baseEvidence(params) {
  return {
    row: params.row,
    issue: 491,
    manifest_loaded: !!params.manifest,
    nonce: params.nonce,
    seat: params.seat,
    requestedSessionKey: params.requestedSessionKey,
    sessionKey: params.sessionKey,
    session_created: false,
    created_session_key: null,
    candidateSha: params.manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(),
    receipts: {},
    negative_checks: {},
    provenance: {
      flow_id: null,
      dispatch_id: null,
      claim_id: null,
      child_session_key: null,
      trace_id: null,
      mount_rel_path: null,
      materialized_destination: null,
    },
    orchestration: {
      required: params.orchestrationRequired || null,
      observed: false,
      reason: null,
    },
    content_receipt: null,
    prompt_echoes_ignored: 0,
    redacted_events: [],
    verdict: 'PARTIAL-candidate',
  };
}

/** Mark a named receipt as fired (idempotent, records first-fire timestamp). */
export function fire(evidence, name) {
  if (!evidence.receipts[name]) {
    evidence.receipts[name] = { observed: true, at_ms: Date.now() };
    console.log(`✓ receipt: ${name}`);
  }
  return evidence.receipts[name];
}

/** Declare a negative check. Starts held=true and is broken by `breakNegative`. */
export function declareNegative(evidence, name, description) {
  evidence.negative_checks[name] = { held: true, description, violated_at_ms: null };
}

export function breakNegative(evidence, name, why) {
  const entry = evidence.negative_checks[name];
  if (!entry || !entry.held) return;
  entry.held = false;
  entry.violated_at_ms = Date.now();
  entry.violation = why;
  console.error(`✗ negative check violated: ${name} — ${why}`);
}

/**
 * Capture one classified frame into the evidence stream, redacted.
 * Returns the stringified payload for sentinel matching, or null when the frame
 * is a harness prompt echo that must be excluded from behavioral matching.
 */
export function capture(evidence, classified) {
  evidence.redacted_events.push({
    ts: Date.now(),
    kind: classified.kind,
    method: classified.method || null,
    event: classified.event || null,
    ok: classified.ok !== undefined ? classified.ok : null,
    data: classified.payload || classified.data
      ? redactEvent(classified.payload || classified.data)
      : null,
  });
  const body = JSON.stringify(classified.payload || classified.data || {});
  if (body.includes(HARNESS_MARKER)) {
    evidence.prompt_echoes_ignored += 1;
    return null;
  }
  return body;
}

/**
 * Raw-byte boundary scan. `body` must already have passed the harness-echo
 * filter in `capture`. Any appearance of the canary content outside the harness
 * instruction means the runtime rendered or forwarded attachment bytes.
 */
export function scanRawBytes(evidence, body, rowNonce, negativeName) {
  if (!body) return;
  if (body.includes(canaryFor(rowNonce))) {
    breakNegative(evidence, negativeName, 'attachment/artifact content observed on a non-harness frame');
  }
}

/** Extract the first capture group of `pattern` from `body`, or null. */
export function matchGroup(body, pattern) {
  if (!body) return null;
  const found = body.match(pattern);
  return found ? found[1] : null;
}

/**
 * Force PARTIAL when an operator-orchestrated precondition was not observed.
 * `reason` is recorded verbatim so the artifact says why, never silently.
 */
export function orchestrationGate(evidence, observed, reason) {
  evidence.orchestration.observed = !!observed;
  if (!observed) evidence.orchestration.reason = reason;
  return !!observed;
}

/**
 * PASS-candidate only when every required receipt fired, every negative check
 * held, and any declared orchestration precondition was observed.
 */
export function computeVerdict(evidence, requiredReceipts) {
  const missing = requiredReceipts.filter((name) => !evidence.receipts[name]);
  const violated = Object.keys(evidence.negative_checks).filter(
    (name) => !evidence.negative_checks[name].held,
  );
  const orchestrationOk = !evidence.orchestration.required || evidence.orchestration.observed;
  evidence.missing_receipts = missing;
  evidence.violated_negative_checks = violated;
  evidence.verdict =
    missing.length === 0 && violated.length === 0 && orchestrationOk
      ? 'PASS-candidate'
      : 'PARTIAL-candidate';
  return evidence.verdict;
}

export function logEvidence(evidence) {
  evidence.ended = new Date().toISOString();
  console.log(`\n--- ${evidence.row} EVIDENCE SUMMARY ---`);
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`--- END EVIDENCE ---`);
  console.log(`\n[${evidence.row}] VERDICT: ${evidence.verdict}`);
}

/** Standard handleSummary payload for this row family. */
export function rowSummary(params) {
  const { row, data, durationMetric, summaryFile } = params;
  const failures = data.metrics.proof_failures?.values?.count || 0;
  const summary = {
    row,
    issue: 491,
    sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    seat: __ENV.OPENCLAW_SEAT_NAME || 'rune-rog-ally',
    timestamp: new Date().toISOString(),
    verdict: failures === 0 ? 'PASS-candidate' : 'PARTIAL-candidate',
    metrics: {
      duration_ms: data.metrics[durationMetric]?.values || null,
      failures,
    },
  };
  return {
    stdout: `\n[${row}] Summary: ${summary.verdict} | SHA: ${summary.sha} | Seat: ${summary.seat}\n`,
    [summaryFile]: JSON.stringify(summary, null, 2),
  };
}
