/** Scenario: R-CW-3 — continue_work reason telemetry/redaction candidate.
 *
 * This row deliberately does NOT overclaim the Tempo assertion in k6. It fires a
 * nonce-bearing continue_work reason and verifies schedule+wake. Public evidence
 * redacts the raw reason; the PASS/HONEST-LIMIT boundary is decided by reviewing
 * fetched Tempo JSON for safe reason attrs present and raw reason absent.
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';

export const options = { scenarios: { r_cw_3_reason_telemetry: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '120s' } }, thresholds: { proof_failures: ['count==0'], r_cw_3_duration: ['p(95)<90000'] } };
const failures = new Counter('proof_failures');
const duration = new Trend('r_cw_3_duration');
const manifest = loadManifestFromEnv();
const HARNESS_MARKER = '[k6-proof-harness]';
const DEFAULTS = { sessionKey: 'main', seat: 'cael-dgx', delaySeconds: 5, idempotencyKeyPrefix: 'R-CW-3' };
let finalEvidence = null;
function boolEnv(name) { return (__ENV[name] || '').toLowerCase() === 'true'; }
function invocationCfg() { const inv = manifest?.invocation || {}; return { delaySeconds: Number(inv.delaySeconds ?? __ENV.OPENCLAW_DELAY_SECONDS ?? DEFAULTS.delaySeconds), idempotencyKeyPrefix: inv.idempotencyKeyPrefix || DEFAULTS.idempotencyKeyPrefix, reasonPrefix: inv.reasonPrefix || 'k6-proof-R-CW-3-redaction' }; }
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
  const rawReasonSentinel = `RAW-RCW3-${rowNonce}-${Math.random().toString(36).slice(2, 8)}`;
  if (!token) { console.error('OPENCLAW_GATEWAY_TOKEN is required'); failures.add(1); return; }
  if (manifest) { const errors = validateManifest(manifest); if (errors.length) console.warn('Manifest validation warnings: ' + errors.join('; ')); }
  const inv = invocationCfg();
  const evidence = { row: 'R-CW-3', manifest_loaded: !!manifest, nonce: rowNonce, seat, requestedSessionKey, sessionKey, session_created: false, created_session_key: null, candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset', started: new Date().toISOString(), dispatch_accepted: false, scheduled_sentinel: false, wake_observed: false, public_artifact_raw_reason_absent: true, tempo_assertion: 'pending-review', trace_id: null, dispatch_accepted_at_ms: null, scheduled_result_at_ms: null, wake_delay_ms: null, redacted_events: [] };
  const started = Date.now();
  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    function startProofFlow(socket) {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      socket.setTimeout(() => {
        const rawReason = `${inv.reasonPrefix} ${rawReasonSentinel}; on continuation wake reply exactly CW3-WOKE ${rowNonce}`;
        const instruction = `${HARNESS_MARKER} R-CW-3 proof nonce ${rowNonce}. Call continue_work with delaySeconds=${inv.delaySeconds} and the supplied reason. After the continue_work tool result reports scheduled, reply exactly CW3-SCHEDULED ${rowNonce}. On the continuation wake, reply exactly CW3-WOKE ${rowNonce}. Supplied reason: ${JSON.stringify(rawReason)}. Do not mutate files.`;
        tracker.send(socket, 'sessions.send', { key: sessionKey, message: instruction, idempotencyKey: `${inv.idempotencyKeyPrefix}-DISPATCH-${rowNonce}` });
      }, 500);
      socket.setTimeout(() => socket.close(), Math.max(90000, (inv.delaySeconds + 60) * 1000));
    }
    socket.on('open', () => { socket.send(connectFrame(token)); if (createDisposableSession) { socket.setTimeout(() => { const disposableKey = `r-cw-3-${rowNonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'); tracker.send(socket, 'sessions.create', { key: disposableKey, label: `k6 R-CW-3 ${rowNonce}` }); }, 250); } else socket.setTimeout(() => startProofFlow(socket), 500); });
    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw); const classified = tracker.classify(msg);
        const safeData = redactedNoReason(classified);
        if (JSON.stringify(safeData).includes(rawReasonSentinel)) evidence.public_artifact_raw_reason_absent = false;
        evidence.redacted_events.push({ ts: Date.now(), kind: classified.kind, method: classified.method || null, event: classified.event || null, ok: classified.ok !== undefined ? classified.ok : null, data: safeData });
        if (classified.kind === 'response' && classified.method === 'sessions.create') { if (classified.ok && classified.payload) { sessionKey = classified.payload.key || sessionKey; evidence.sessionKey = sessionKey; evidence.session_created = true; evidence.created_session_key = sessionKey; console.log('✓ disposable session created: ' + sessionKey); startProofFlow(socket); } else { console.error('✗ sessions.create rejected: ' + JSON.stringify(classified.error)); failures.add(1); socket.close(); } }
        if (classified.kind === 'response' && classified.method === 'sessions.send') { if (classified.ok) { evidence.dispatch_accepted = true; evidence.dispatch_accepted_at_ms = Date.now(); if (classified.payload?.traceId) evidence.trace_id = classified.payload.traceId; console.log('✓ sessions.send accepted — reason telemetry turn triggered'); } else { console.error('✗ sessions.send rejected: ' + JSON.stringify(classified.error)); failures.add(1); } }
        if (classified.kind === 'event') { const eventData = classified.data || {}; const eventStr = JSON.stringify(eventData); if (eventStr.includes(HARNESS_MARKER)) return; if (!evidence.scheduled_sentinel && eventStr.includes(`CW3-SCHEDULED ${rowNonce}`)) { evidence.scheduled_sentinel = true; evidence.scheduled_result_at_ms = Date.now(); if (eventData.traceId) evidence.trace_id = eventData.traceId; console.log('✓ CW3-SCHEDULED sentinel observed'); } if (evidence.scheduled_sentinel && !evidence.wake_observed && eventStr.includes(`CW3-WOKE ${rowNonce}`)) { evidence.wake_observed = true; evidence.wake_delay_ms = evidence.scheduled_result_at_ms ? Date.now() - evidence.scheduled_result_at_ms : null; console.log('✓ CW3-WOKE sentinel observed'); } }
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
  console.log('\n--- R-CW-3 EVIDENCE SUMMARY ---'); console.log(JSON.stringify(evidence, null, 2)); console.log('--- END EVIDENCE ---'); console.log(`\n[R-CW-3] VERDICT: ${passed ? 'HONEST-LIMIT-candidate' : 'PARTIAL-candidate'}`);
}
export function handleSummary(data) { const timestamp = new Date().toISOString(); const passRate = data.metrics.proof_failures?.values?.count === 0; const traceId = finalEvidence?.trace_id || null; const summary = { row: 'R-CW-3', sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset', seat: __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx', timestamp, verdict: passRate ? 'HONEST-LIMIT-candidate' : 'PARTIAL-candidate', candidateOnly: true, foldRequiresReview: true, observability: { traceId, traceJson: traceId ? 'pending-fetch' : 'missing' }, review: { status: 'review-pending', pendingReceipts: ['tempo-trace-json', 'reason-telemetry-redaction-review'], notes: ['k6 proves dispatch/schedule/wake and keeps the raw reason out of public evidence.', 'Before folding PASS, fetch Tempo trace JSON and verify safe reason attributes are present while the raw reason sentinel is absent. If trace fetch is unavailable, keep this as HONEST-LIMIT-candidate.'] }, metrics: { duration_ms: data.metrics.r_cw_3_duration?.values || null, failures: data.metrics.proof_failures?.values?.count || 0 } }; return { stdout: `\n[R-CW-3] Summary: ${summary.verdict} | SHA: ${summary.sha} | Seat: ${summary.seat}\n`, 'r-cw-3-reason-telemetry-summary.json': JSON.stringify(summary, null, 2) }; }
