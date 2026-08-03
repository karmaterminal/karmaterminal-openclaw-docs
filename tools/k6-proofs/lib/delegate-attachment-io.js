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
 *   - The row verdict is published on a metric (`proof_row_pass`) so
 *     `handleSummary` reports the SAME verdict `computeVerdict` produced.
 *     Deriving a summary verdict from `proof_failures` alone is forbidden: the
 *     orchestration-gated rows do not raise that counter.
 */
import crypto from 'k6/crypto';
import http from 'k6/http';
import { Counter } from 'k6/metrics';
import { redactEvent } from './gateway-ws.js';

export const HARNESS_MARKER = '[k6-proof-harness]';

/**
 * Verdict transport between the iteration and `handleSummary`.
 * k6 evaluates `handleSummary` in a fresh runtime, so module state does not
 * survive; a metric does. Exactly one of these is incremented per iteration.
 */
export const rowPassCounter = new Counter('proof_row_pass');
export const rowPartialCounter = new Counter('proof_row_partial');
export const rowIterationCounter = new Counter('proof_row_iterations');

/** Escape a value for literal use inside a RegExp source. */
export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Build a sentinel matcher: `<SENTINEL> <nonce> <trailing>`. */
export function sentinel(prefix, rowNonce, trailing = '') {
  return new RegExp(`${escapeRegex(prefix)} ${escapeRegex(rowNonce)}${trailing}`);
}

/** Derive the gateway HTTP base from its WS URL. */
export function httpBaseFromWs(wsUrl) {
  return String(wsUrl || '')
    .replace(/^wss:/i, 'https:')
    .replace(/^ws:/i, 'http:')
    .replace(/\/+$/, '');
}

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
 * Deep-walk a structured payload and return every plain object for which
 * `predicate` holds. Used to bind receipts to structured tool/session records
 * instead of to model prose anywhere in a frame.
 */
export function findRecords(value, predicate, seen) {
  const visited = seen || [];
  const out = [];
  if (!value || typeof value !== 'object') return out;
  for (const entry of visited) if (entry === value) return out;
  visited.push(value);
  if (Array.isArray(value)) {
    for (const child of value) out.push(...findRecords(child, predicate, visited));
    return out;
  }
  if (predicate(value)) out.push(value);
  for (const key of Object.keys(value)) out.push(...findRecords(value[key], predicate, visited));
  return out;
}

/**
 * Structured tool-result records for `toolName`. A gateway tool frame carries
 * the tool name plus a result/error container; model prose never does.
 */
export function toolResultRecords(eventData, toolName) {
  return findRecords(eventData, (record) => {
    const name = typeof record.name === 'string' ? record.name : record.toolName;
    if (name !== toolName) return false;
    return 'result' in record || 'error' in record || 'isError' in record || 'ok' in record;
  });
}

/** True when a structured tool record reports a refusal/error rather than a success. */
export function toolRecordRejected(record) {
  if (!record || typeof record !== 'object') return false;
  if (record.isError === true) return true;
  if (record.ok === false) return true;
  if (record.error) return true;
  const status = String(record.status || record.result?.status || '').toLowerCase();
  return ['error', 'rejected', 'denied', 'refused', 'failed'].includes(status);
}

const ATTACHMENT_STATE_KEYS = [
  'attachments',
  'attachmentSnapshot',
  'attachmentState',
  'pendingAttachments',
  'storedAttachments',
];

/**
 * True when a structured record still carries non-empty delegate attachment
 * state. Used as the authority for "the durable snapshot was scrubbed": an
 * absence claimed in model prose is not a receipt.
 */
export function recordCarriesAttachmentState(record) {
  if (!record || typeof record !== 'object') return false;
  return ATTACHMENT_STATE_KEYS.some((key) => {
    const value = record[key];
    if (value === undefined || value === null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    if (typeof value === 'number') return value > 0;
    return Boolean(value);
  });
}

/** Session keys present in a sessions.list payload. */
export function sessionKeysFromList(payload) {
  const rows = payload?.sessions || payload?.items || payload?.records || [];
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => (typeof row === 'string' ? row : row?.key || row?.sessionKey))
    .filter((key) => typeof key === 'string' && key.length > 0);
}

/** Read a public-safe gateway lifecycle sample from the HTTP status surface. */
export function sampleGatewayStatus(httpBase, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  let res;
  try {
    res = http.get(`${httpBase}/status`, { headers, timeout: '5s' });
  } catch (error) {
    return { reachable: false, uptime: null, version: null, error: String(error) };
  }
  if (!res || res.status !== 200) {
    return { reachable: false, uptime: null, version: null, status: res ? res.status : 0 };
  }
  let body = null;
  try {
    body = JSON.parse(res.body);
  } catch (error) {
    return { reachable: true, uptime: null, version: null, parseError: true };
  }
  const uptime = typeof body.uptime === 'number' ? body.uptime : Number(body.uptime);
  return {
    reachable: true,
    uptime: Number.isFinite(uptime) ? uptime : null,
    version: typeof body.version === 'string' ? body.version : null,
  };
}

/**
 * Externally observable gateway restart receipt.
 *
 * `OPENCLAW_RESTART_ORCHESTRATED` is an operator DECLARATION and can never be
 * the evidence. A restart is credited only when the public `/status` surface
 * shows the process identity change from outside the harness: either the
 * endpoint went unreachable and came back, or reported uptime went backwards.
 * Both are properties of the gateway, not of this script's beliefs.
 *
 * Returns `{ observed, downtimeObserved, uptimeReset, samples, reason }`.
 */
export function observeGatewayRestart(params) {
  const { httpBase, token, baseline, windowMs, pollMs, sleep } = params;
  const deadline = Date.now() + Math.max(0, windowMs);
  const interval = Math.max(1000, pollMs || 5000);
  const result = {
    observed: false,
    downtimeObserved: false,
    uptimeReset: false,
    baselineUptime: baseline && baseline.reachable ? baseline.uptime : null,
    finalUptime: null,
    samples: 0,
    reason: null,
  };
  if (!baseline || !baseline.reachable) {
    result.reason = 'gateway /status was not reachable before the restart window, so no lifecycle baseline exists';
    return result;
  }
  if (baseline.uptime === null) {
    result.reason = 'gateway /status did not expose a numeric uptime, so a restart cannot be observed externally';
    return result;
  }
  while (Date.now() < deadline) {
    sleep(interval / 1000);
    const sample = sampleGatewayStatus(httpBase, token);
    result.samples += 1;
    if (!sample.reachable) {
      result.downtimeObserved = true;
      continue;
    }
    result.finalUptime = sample.uptime;
    if (sample.uptime !== null && sample.uptime < baseline.uptime) {
      result.uptimeReset = true;
      result.observed = true;
      return result;
    }
    if (result.downtimeObserved && sample.uptime !== null) {
      // Came back after an observed outage: that is a process lifecycle event
      // even if the uptime unit is too coarse to have gone backwards.
      result.observed = true;
      return result;
    }
  }
  result.reason = result.downtimeObserved
    ? 'gateway went unreachable inside the restart window but never came back before the deadline'
    : 'gateway /status uptime never reset and the endpoint never dropped inside the restart window: no operator restart was observed';
  return result;
}

/**
 * PASS-candidate only when every required receipt fired, every negative check
 * held, and any declared orchestration precondition was observed.
 *
 * Also publishes the verdict onto `proof_row_pass` / `proof_row_partial` so
 * `handleSummary` cannot invent a different one.
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
  rowIterationCounter.add(1);
  if (evidence.verdict === 'PASS-candidate') rowPassCounter.add(1);
  else rowPartialCounter.add(1);
  return evidence.verdict;
}

export function logEvidence(evidence) {
  evidence.ended = new Date().toISOString();
  console.log(`\n--- ${evidence.row} EVIDENCE SUMMARY ---`);
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`--- END EVIDENCE ---`);
  console.log(`\n[${evidence.row}] VERDICT: ${evidence.verdict}`);
}

/**
 * Standard handleSummary payload for this row family.
 *
 * The verdict is READ from the metric `computeVerdict` published, never
 * re-derived from `proof_failures`: the orchestration-gated rows deliberately
 * do not raise that counter, so a failures-only derivation would print PASS
 * while the authoritative row verdict is PARTIAL.
 */
export function rowSummary(params) {
  const { row, data, durationMetric, summaryFile } = params;
  const failures = data.metrics.proof_failures?.values?.count || 0;
  const passes = data.metrics.proof_row_pass?.values?.count || 0;
  const partials = data.metrics.proof_row_partial?.values?.count || 0;
  const iterations = data.metrics.proof_row_iterations?.values?.count || 0;
  // PASS only when the iteration ran, published PASS, published no PARTIAL,
  // and raised no failure. A missing verdict metric means the iteration never
  // reached computeVerdict, which is not a pass.
  const verdict =
    iterations > 0 && passes === iterations && partials === 0 && failures === 0
      ? 'PASS-candidate'
      : 'PARTIAL-candidate';
  const summary = {
    row,
    issue: 491,
    sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    seat: __ENV.OPENCLAW_SEAT_NAME || 'rune-rog-ally',
    timestamp: new Date().toISOString(),
    verdict,
    verdictSource: 'proof_row_pass metric published by computeVerdict',
    metrics: {
      duration_ms: data.metrics[durationMetric]?.values || null,
      failures,
      iterations,
      row_pass: passes,
      row_partial: partials,
    },
  };
  return {
    stdout: `\n[${row}] Summary: ${summary.verdict} | SHA: ${summary.sha} | Seat: ${summary.seat}\n`,
    [summaryFile]: JSON.stringify(summary, null, 2),
  };
}
