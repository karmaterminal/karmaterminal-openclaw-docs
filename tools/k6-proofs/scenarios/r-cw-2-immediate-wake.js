/** Scenario: R-CW-2 — continue_work(delaySeconds=0) immediate schedule + wake. */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { GatewayHandshake, disposableSessionKey, recordClassifiedEvent } from '../lib/proof-session.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';

export const options = { scenarios: { r_cw_2_immediate_wake: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '120s' } }, thresholds: { proof_failures: ['count==0'], r_cw_2_duration: ['p(95)<90000'] } };
const failures = new Counter('proof_failures');
const duration = new Trend('r_cw_2_duration');
const manifest = loadManifestFromEnv();
const HARNESS_MARKER = '[k6-proof-harness]';
const DEFAULTS = { sessionKey: 'main', seat: 'cael-dgx', delaySeconds: 0, idempotencyKeyPrefix: 'R-CW-2' };
let finalEvidence = null;
function boolEnv(name) { return (__ENV[name] || '').toLowerCase() === 'true'; }
function invocationCfg() { const inv = manifest?.invocation || {}; return { delaySeconds: Number(inv.delaySeconds ?? __ENV.OPENCLAW_DELAY_SECONDS ?? DEFAULTS.delaySeconds), idempotencyKeyPrefix: inv.idempotencyKeyPrefix || DEFAULTS.idempotencyKeyPrefix, reason: inv.reason || 'k6-proof-R-CW-2-immediate-{{nonce}}' }; }
function safeRedact(classified) { return redactEvent(classified.payload || classified.data || {}); }

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const requestedSessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || DEFAULTS.sessionKey;
  let sessionKey = requestedSessionKey;
  const createDisposableSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION') || boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSIONS');
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || DEFAULTS.seat;
  const rowNonce = nonce('R-CW-2');
  if (!token) { console.error('OPENCLAW_GATEWAY_TOKEN is required'); failures.add(1); return; }
  if (manifest) { const errors = validateManifest(manifest); if (errors.length) console.warn('Manifest validation warnings: ' + errors.join('; ')); }
  const inv = invocationCfg();
  const evidence = { row: 'R-CW-2', manifest_loaded: !!manifest, nonce: rowNonce, seat, requestedSessionKey, sessionKey, session_created: false, created_session_key: null, candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset', started: new Date().toISOString(), dispatch_accepted: false, scheduled_sentinel: false, immediate_wake_observed: false, prompt_echo_ignored: false, dispatch_accepted_at_ms: null, scheduled_result_at_ms: null, wake_delay_ms: null, trace_id: null, redacted_events: [] };
  const started = Date.now();
  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    // Response-driven handshake: start the row when the gateway
    // acknowledges connect, not after a fixed guess. The old fixed delay
    // survives only as the recorded upper bound.
    const handshake = new GatewayHandshake({
      tracker,
      fallbackMs: 500,
      onReady: () => {
        if (createDisposableSession) { const disposableKey = disposableSessionKey('r-cw-2', rowNonce); tracker.send(socket, 'sessions.create', { key: disposableKey, label: `k6 R-CW-2 ${rowNonce}` }); } else startProofFlow(socket);
      },
    });

    function startProofFlow(socket) {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      socket.setTimeout(() => {
        const reason = `${inv.reason.replace(/\{\{nonce\}\}/g, rowNonce)} -- on continuation wake reply exactly CW2-WOKE ${rowNonce}`;
        const instruction = `${HARNESS_MARKER} R-CW-2 proof nonce ${rowNonce}. Call continue_work with delaySeconds=${inv.delaySeconds} and reason=${JSON.stringify(reason)}. After the continue_work tool result reports scheduled, reply exactly CW2-SCHEDULED ${rowNonce}. On the continuation wake, reply exactly CW2-WOKE ${rowNonce}. Do not mutate files.`;
        tracker.send(socket, 'sessions.send', { key: sessionKey, message: instruction, idempotencyKey: `${inv.idempotencyKeyPrefix}-DISPATCH-${rowNonce}` });
      }, 500);
      socket.setTimeout(() => socket.close(), 90000);
    }
    socket.on('open', () => {
      handshake.begin(socket, token);
    });
    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw); const classified = tracker.classify(msg);
        handshake.observe(classified);
        recordClassifiedEvent(evidence, classified, redactEvent, { redactData: safeRedact });
        if (classified.kind === 'response' && classified.method === 'sessions.create') { if (classified.ok && classified.payload) { sessionKey = classified.payload.key || sessionKey; evidence.sessionKey = sessionKey; evidence.session_created = true; evidence.created_session_key = sessionKey; console.log('✓ disposable session created: ' + sessionKey); startProofFlow(socket); } else { console.error('✗ sessions.create rejected: ' + JSON.stringify(classified.error)); failures.add(1); socket.close(); } }
        if (classified.kind === 'response' && classified.method === 'sessions.send') { if (classified.ok) { evidence.dispatch_accepted = true; evidence.dispatch_accepted_at_ms = Date.now(); if (classified.payload?.traceId) evidence.trace_id = classified.payload.traceId; console.log('✓ sessions.send accepted — immediate continue_work turn triggered'); } else { console.error('✗ sessions.send rejected: ' + JSON.stringify(classified.error)); failures.add(1); } }
        if (classified.kind === 'event') {
          const eventData = classified.data || {}; const eventStr = JSON.stringify(eventData);
          if (eventStr.includes(HARNESS_MARKER)) { evidence.prompt_echo_ignored = true; return; }
          if (!evidence.scheduled_sentinel && eventStr.includes(`CW2-SCHEDULED ${rowNonce}`)) { evidence.scheduled_sentinel = true; evidence.scheduled_result_at_ms = Date.now(); if (eventData.traceId) evidence.trace_id = eventData.traceId; console.log('✓ CW2-SCHEDULED sentinel observed'); }
          if (evidence.scheduled_sentinel && !evidence.immediate_wake_observed && eventStr.includes(`CW2-WOKE ${rowNonce}`)) { evidence.immediate_wake_observed = true; evidence.wake_delay_ms = evidence.scheduled_result_at_ms ? Date.now() - evidence.scheduled_result_at_ms : null; console.log('✓ CW2-WOKE sentinel observed'); }
        }
        if (evidence.dispatch_accepted && evidence.scheduled_sentinel && evidence.immediate_wake_observed) { console.log('All required R-CW-2 evidence gathered, closing early'); socket.close(); }
      } catch (e) { console.warn('parse error: ' + e); }
    });
    socket.on('error', (e) => { console.error('ws error: ' + (e && e.error ? e.error() : e)); failures.add(1); });
  });
  evidence.ended = new Date().toISOString(); evidence.duration_ms = Date.now() - started; finalEvidence = evidence; duration.add(evidence.duration_ms);
  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, { 'dispatch accepted': () => evidence.dispatch_accepted, 'scheduled sentinel observed': () => evidence.scheduled_sentinel, 'immediate wake observed': () => evidence.immediate_wake_observed, 'harness prompt echo ignored': () => evidence.prompt_echo_ignored || evidence.scheduled_sentinel });
  if (!evidence.dispatch_accepted || !evidence.scheduled_sentinel || !evidence.immediate_wake_observed) failures.add(1);
  const passed = (!createDisposableSession || evidence.session_created) && evidence.dispatch_accepted && evidence.scheduled_sentinel && evidence.immediate_wake_observed;
  console.log(`R_CW_2_EVIDENCE ${JSON.stringify(evidence)}`);
  console.log('\n--- R-CW-2 EVIDENCE SUMMARY ---'); console.log(JSON.stringify(evidence, null, 2)); console.log('--- END EVIDENCE ---'); console.log(`\n[R-CW-2] VERDICT: ${passed ? 'PASS-candidate' : 'PARTIAL-candidate'}`);
}
export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const failuresCount = data.metrics.proof_failures?.values?.count || 0;
  const traceId = finalEvidence?.trace_id || null;
  const verdict = failuresCount === 0 ? 'PASS-candidate' : 'PARTIAL-candidate';
  const pendingReceipts = traceId ? [] : ['tempo-trace-json'];
  const notes = traceId
    ? ['Trace id captured; fetch and attach Tempo trace JSON before canonical fold.']
    : [
      verdict === 'PASS-candidate'
        ? 'No trace_id emitted; keep PASS-candidate review-pending until trace JSON is fetched or trace-missing is explicitly accepted.'
        : 'No trace_id emitted. This run is PARTIAL-candidate; preserve k6.log/evidence and do not fold as PASS without CW2-WOKE plus trace review or explicit trace-missing acceptance.',
    ];
  const summary = {
    row: 'R-CW-2',
    sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    seat: __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx',
    timestamp,
    verdict,
    candidateOnly: true,
    foldRequiresReview: true,
    evidenceJsonl: 'evidence.jsonl',
    observability: { traceId, traceJson: traceId ? 'pending-fetch' : 'missing' },
    review: { status: traceId && verdict === 'PASS-candidate' ? 'ready-for-human-review' : 'review-pending', pendingReceipts, notes },
    metrics: { duration_ms: data.metrics.r_cw_2_duration?.values || null, failures: failuresCount },
  };
  return { stdout: `
[R-CW-2] Summary: ${summary.verdict} | SHA: ${summary.sha} | Seat: ${summary.seat}
`, 'r-cw-2-immediate-wake-summary.json': JSON.stringify(summary, null, 2) };
}
