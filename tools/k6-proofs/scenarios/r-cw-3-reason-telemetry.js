/** Scenario: R-CW-3 — continue_work reason telemetry/redaction candidate.
 *
 * This row deliberately does NOT overclaim the Tempo assertion in k6. It fires a
 * nonce-bearing continue_work reason and verifies schedule+wake. Public evidence
 * redacts the raw reason; the PASS/PARTIAL boundary is decided by reviewing
 * fetched Tempo JSON for safe reason attrs present and raw reason absent.
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import crypto from 'k6/crypto';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { GatewayHandshake, disposableSessionKey, recordClassifiedEvent } from '../lib/proof-session.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';

/**
 * Extract a hex trace ID from a W3C traceparent header string.
 * Format: 00-<32-hex-traceId>-<16-hex-spanId>-<flags>
 * Returns null when the input is absent or malformed.
 */
function parseTraceparent(header) {
  if (!header || typeof header !== 'string') return null;
  const parts = header.split('-');
  return (parts.length >= 4 && /^[0-9a-f]{32}$/.test(parts[1])) ? parts[1] : null;
}

/**
 * Scan an object one level deep for traceId / trace_id / traceparent fields,
 * trying sub-objects keyed by 'result', 'state', or 'payload' as well.
 * Returns the first found hex trace ID, or null.
 */
function extractNestedTraceId(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const probe = (o) => {
    if (!o || typeof o !== 'object') return null;
    if (o.traceId && /^[0-9a-f]{8,64}$/i.test(String(o.traceId))) return String(o.traceId).toLowerCase();
    if (o.trace_id && /^[0-9a-f]{8,64}$/i.test(String(o.trace_id))) return String(o.trace_id).toLowerCase();
    return parseTraceparent(o.traceparent);
  };
  return probe(obj) || probe(obj.result) || probe(obj.state) || probe(obj.payload) || null;
}

export const options = { scenarios: { r_cw_3_reason_telemetry: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '10m' } }, thresholds: { proof_failures: ['count==0'], r_cw_3_duration: ['p(95)<600000'] } };
const failures = new Counter('proof_failures');
const duration = new Trend('r_cw_3_duration');
const manifest = loadManifestFromEnv();
const HARNESS_MARKER = '[k6-proof-harness]';
const DEFAULTS = { sessionKey: 'main', seat: 'cael-dgx', delaySeconds: 5, idempotencyKeyPrefix: 'R-CW-3' };
let finalEvidence = null;
function boolEnv(name) { return (__ENV[name] || '').toLowerCase() === 'true'; }
function invocationCfg() { const inv = manifest?.invocation || {}; return { delaySeconds: Number(inv.delaySeconds ?? __ENV.OPENCLAW_DELAY_SECONDS ?? DEFAULTS.delaySeconds), idempotencyKeyPrefix: inv.idempotencyKeyPrefix || DEFAULTS.idempotencyKeyPrefix, reason: inv.reason || 'k6-proof-R-CW-3-redaction RAW-RCW3-{{nonce}}; on continuation wake reply exactly CW3-WOKE {{nonce}}' }; }
function redactedNoReason(classified) {
  const redacted = redactEvent(classified.payload || classified.data || {});
  if (redacted && typeof redacted === 'object') delete redacted.reason;
  return redacted;
}

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const requestedSessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || DEFAULTS.sessionKey;
  let sessionKey = requestedSessionKey;
  const createDisposableSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION') || boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSIONS');
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || DEFAULTS.seat;
  const rowNonce = nonce('R-CW-3');
  const rawReasonSentinel = `RAW-RCW3-${rowNonce}`;
  if (!token) { console.error('OPENCLAW_GATEWAY_TOKEN is required'); failures.add(1); return; }
  if (manifest) { const errors = validateManifest(manifest); if (errors.length) console.warn('Manifest validation warnings: ' + errors.join('; ')); }
  const inv = invocationCfg();
  const rawReason = inv.reason.replace(/\{\{nonce\}\}/g, rowNonce);
  const evidence = { row: 'R-CW-3', manifest_loaded: !!manifest, nonce: rowNonce, seat, requestedSessionKey, sessionKey, session_created: false, created_session_key: null, candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset', started: new Date().toISOString(), dispatch_accepted: false, scheduled_sentinel: false, wake_observed: false, public_artifact_raw_reason_absent: true, tempo_assertion: 'pending-review', reason_hash: crypto.sha256(rawReason, 'hex').slice(0, 16), reason_length: rawReason.length, trace_id: null, trace_id_source: null, dispatch_accepted_at_ms: null, scheduled_result_at_ms: null, wake_delay_ms: null, redacted_events: [] };
  const started = Date.now();
  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    // Response-driven handshake: start the row when the gateway
    // acknowledges connect, not after a fixed guess. The old fixed delay
    // survives only as the recorded upper bound.
    const handshake = new GatewayHandshake({
      tracker,
      evidence,
      fallbackMs: 500,
      onReady: () => {
        if (createDisposableSession) { const disposableKey = disposableSessionKey('r-cw-3', rowNonce); tracker.send(socket, 'sessions.create', { key: disposableKey, label: `k6 R-CW-3 ${rowNonce}` }); } else startProofFlow(socket);
      },
    });

    function startProofFlow(socket) {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      socket.setTimeout(() => {
        const instruction = `${HARNESS_MARKER} R-CW-3 proof nonce ${rowNonce}. Call continue_work with delaySeconds=${inv.delaySeconds} and the supplied reason. After the continue_work tool result reports scheduled, reply exactly CW3-SCHEDULED ${rowNonce}. On the continuation wake, reply exactly CW3-WOKE ${rowNonce}. Supplied reason: ${JSON.stringify(rawReason)}. Do not mutate files.`;
        tracker.send(socket, 'sessions.send', { key: sessionKey, message: instruction, idempotencyKey: `${inv.idempotencyKeyPrefix}-DISPATCH-${rowNonce}` });
      }, 500);
      socket.setTimeout(() => socket.close(), Math.max(600000, (inv.delaySeconds + 540) * 1000));
    }
    socket.on('open', () => {
      handshake.begin(socket, token);
    });
    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw); const classified = tracker.classify(msg);
        handshake.observe(classified);
        // Belt-and-suspenders: capture traceId from the raw gateway frame before
        // classification drops root-level fields (classify returns data:msg.payload).
        // Covers: msg.traceId, msg.trace_id, W3C msg.traceparent, and nested state/result.
        if (!evidence.trace_id) {
          const rootId = extractNestedTraceId(msg);
          if (rootId) { evidence.trace_id = rootId; evidence.trace_id_source = 'root-frame'; }
        }
        const safeData = redactedNoReason(classified);
        if (JSON.stringify(safeData).includes(rawReasonSentinel)) evidence.public_artifact_raw_reason_absent = false;
        recordClassifiedEvent(evidence, classified, redactEvent, { redactData: () => safeData });
        if (classified.kind === 'response' && classified.method === 'sessions.create') { if (classified.ok && classified.payload) { sessionKey = classified.payload.key || sessionKey; evidence.sessionKey = sessionKey; evidence.session_created = true; evidence.created_session_key = sessionKey; console.log('✓ disposable session created: ' + sessionKey); startProofFlow(socket); } else { console.error('✗ sessions.create rejected: ' + JSON.stringify(classified.error)); failures.add(1); socket.close(); } }
        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) {
            evidence.dispatch_accepted = true; evidence.dispatch_accepted_at_ms = Date.now();
            // Try camelCase, snake_case, and W3C traceparent from the response payload.
            if (!evidence.trace_id) {
              const sendId = extractNestedTraceId(classified.payload);
              if (sendId) { evidence.trace_id = sendId; evidence.trace_id_source = 'sessions.send-response'; }
            }
            console.log('✓ sessions.send accepted — reason telemetry turn triggered');
          } else { console.error('✗ sessions.send rejected: ' + JSON.stringify(classified.error)); failures.add(1); }
        }
        if (classified.kind === 'event') { const eventData = classified.data || {}; const eventStr = JSON.stringify(eventData); if (eventStr.includes(HARNESS_MARKER)) return;
          if (!evidence.scheduled_sentinel && eventStr.includes(`CW3-SCHEDULED ${rowNonce}`)) {
            evidence.scheduled_sentinel = true; evidence.scheduled_result_at_ms = Date.now();
            // Try eventData (msg.payload) plus the full raw message for this frame.
            if (!evidence.trace_id) {
              const schedId = extractNestedTraceId(eventData) || extractNestedTraceId(msg);
              if (schedId) { evidence.trace_id = schedId; evidence.trace_id_source = 'cw3-scheduled-event'; }
            }
            console.log('✓ CW3-SCHEDULED sentinel observed');
          }
          if (evidence.scheduled_sentinel && !evidence.wake_observed && eventStr.includes(`CW3-WOKE ${rowNonce}`)) { evidence.wake_observed = true; evidence.wake_delay_ms = evidence.scheduled_result_at_ms ? Date.now() - evidence.scheduled_result_at_ms : null; console.log('✓ CW3-WOKE sentinel observed'); } }
        if (evidence.dispatch_accepted && evidence.scheduled_sentinel && evidence.wake_observed) { console.log('Required R-CW-3 schedule/wake evidence gathered, closing early'); socket.close(); }
      } catch (e) { console.warn('parse error: ' + e); }
    });
    socket.on('error', (e) => { console.error('ws error: ' + (e && e.error ? e.error() : e)); failures.add(1); });
  });
  evidence.ended = new Date().toISOString(); evidence.duration_ms = Date.now() - started; finalEvidence = evidence; duration.add(evidence.duration_ms);
  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, { 'dispatch accepted': () => evidence.dispatch_accepted, 'scheduled sentinel observed': () => evidence.scheduled_sentinel, 'wake observed': () => evidence.wake_observed, 'raw reason absent from public evidence': () => evidence.public_artifact_raw_reason_absent });
  if (!evidence.dispatch_accepted || !evidence.scheduled_sentinel || !evidence.wake_observed || !evidence.public_artifact_raw_reason_absent) failures.add(1);
  const passed = (!createDisposableSession || evidence.session_created) && evidence.dispatch_accepted && evidence.scheduled_sentinel && evidence.wake_observed && evidence.public_artifact_raw_reason_absent;
  console.log(`R_CW_3_EVIDENCE ${JSON.stringify(evidence)}`);
  console.log('\n--- R-CW-3 EVIDENCE SUMMARY ---'); console.log(JSON.stringify(evidence, null, 2)); console.log('--- END EVIDENCE ---'); console.log('\n[R-CW-3] VERDICT: PARTIAL-candidate');
}
export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const failuresCount = data.metrics.proof_failures?.values?.count || 0;
  const traceId = finalEvidence?.trace_id || null;
  const traceIdSource = finalEvidence?.trace_id_source || null;
  const verdict = 'PARTIAL-candidate';
  const pendingReceipts = ['reason-telemetry-redaction-review'];
  if (!traceId) pendingReceipts.unshift('tempo-trace-json');
  const notes = [
    failuresCount === 0
      ? 'k6 proved dispatch/schedule/wake and kept the raw reason out of public evidence; the row remains partial until Tempo reason telemetry/redaction review.'
      : 'This run did not prove the full schedule/wake path. Preserve k6.log/evidence and do not fold as PASS.',
    traceId
      ? `Trace id captured from ${traceIdSource || 'unknown source'}; fetch Tempo trace JSON and verify safe reason attributes are present while the raw reason sentinel is absent.`
      : 'No traceId emitted by gateway WS API: checked root frame (traceId/trace_id/traceparent), sessions.send response payload, and CW3-SCHEDULED event data (including nested result/state/payload). This is a gateway API limitation — the WS protocol for these methods does not expose a traceId. Keep as PARTIAL/trace-missing until trace JSON is obtained via Tempo search (query by chain.id or flow.id attributes) or trace-missing is explicitly accepted.',
  ];
  const summary = {
    row: 'R-CW-3',
    sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    seat: __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx',
    timestamp,
    verdict,
    candidateOnly: true,
    foldRequiresReview: true,
    evidenceJsonl: 'evidence.jsonl',
    observability: { traceId, traceIdSource, traceJson: traceId ? 'pending-fetch' : 'missing' },
    review: { status: 'review-pending', pendingReceipts, notes },
    metrics: { duration_ms: data.metrics.r_cw_3_duration?.values || null, failures: failuresCount },
  };
  return { stdout: `
[R-CW-3] Summary: ${summary.verdict} | SHA: ${summary.sha} | Seat: ${summary.seat}
`, 'r-cw-3-reason-telemetry-summary.json': JSON.stringify(summary, null, 2) };
}
