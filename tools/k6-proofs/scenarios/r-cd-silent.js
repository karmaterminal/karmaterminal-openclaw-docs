/** Scenario: R-CD-SILENT — continue_delegate(mode="silent") no channel delivery + later internal context readback. */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { GatewayHandshake, disposableSessionKey, recordClassifiedEvent } from '../lib/proof-session.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';

export const options = {
  scenarios: { r_cd_silent: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '210s' } },
  thresholds: { proof_failures: ['count==0'], r_cd_silent_duration: ['p(95)<180000'] },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_silent_duration');
const manifest = loadManifestFromEnv();
const HARNESS_MARKER = '[k6-proof-harness]';
const DEFAULTS = { sessionKey: 'main', seat: 'ronan-dgx', delaySeconds: 1, idempotencyKeyPrefix: 'R-CD-SILENT' };
let finalEvidence = null;

function boolEnv(name) { return (__ENV[name] || '').toLowerCase() === 'true'; }
function invocationCfg() { const inv = manifest?.invocation || {}; return { mode: inv.mode || 'silent', delaySeconds: Number(inv.delaySeconds ?? __ENV.OPENCLAW_DELAY_SECONDS ?? DEFAULTS.delaySeconds), idempotencyKeyPrefix: inv.idempotencyKeyPrefix || DEFAULTS.idempotencyKeyPrefix }; }
function safeRedact(classified) { return redactEvent(classified.payload || classified.data || {}); }
function isChannelDeliveryEvent(eventName, eventData) {
  const lowerName = String(eventName || '').toLowerCase();
  if (lowerName.includes('channel') || lowerName.includes('delivery')) return true;
  if (!eventData || typeof eventData !== 'object') return false;
  const channelLike = eventData.channelId || eventData.channel_id || eventData.channel || eventData.targetChannel || eventData.deliveryChannel;
  const surface = String(eventData.surface || eventData.provider || '').toLowerCase();
  return Boolean(channelLike) || surface === 'discord' || surface === 'slack' || surface === 'telegram';
}

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const requestedSessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || DEFAULTS.sessionKey;
  let sessionKey = requestedSessionKey;
  const createDisposableSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION') || boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSIONS');
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || DEFAULTS.seat;
  const rowNonce = nonce('R-CD-SILENT');
  const childToken = `SILENTCHILD-${rowNonce}-${Math.random().toString(36).slice(2, 8)}`;

  if (!token) { console.error('OPENCLAW_GATEWAY_TOKEN is required'); failures.add(1); return; }
  if (manifest) { const errors = validateManifest(manifest); if (errors.length) console.warn('Manifest validation warnings: ' + errors.join('; ')); }

  const inv = invocationCfg();
  const evidence = {
    row: 'R-CD-SILENT', manifest_loaded: !!manifest, nonce: rowNonce, seat,
    requestedSessionKey, sessionKey, session_created: false, created_session_key: null,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset', started: new Date().toISOString(),
    dispatch_accepted: false, scheduled_sentinel: false, child_completion_observed: false, followup_accepted: false,
    parent_internal_context_observed: false, no_channel_delivery: true, child_channel_delivery_observed: false,
    dispatch_accepted_at_ms: null, followup_sent_at_ms: null, trace_id: null, redacted_events: [],
  };
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
        if (createDisposableSession) {
          const disposableKey = disposableSessionKey('r-cd-silent', rowNonce);
          tracker.send(socket, 'sessions.create', { key: disposableKey, label: `k6 R-CD-SILENT ${rowNonce}` });

        } else startProofFlow(socket);
      },
    });


    function sendFollowup(socket) {
      if (evidence.followup_sent_at_ms) return;
      evidence.followup_sent_at_ms = Date.now();
      const followup = `${HARNESS_MARKER} R-CD-SILENT follow-up nonce ${rowNonce}. If the previous silent delegate return is present in your internal context, reply exactly RCDS-PARENT-OBSERVED followed by that SILENTCHILD token. If it is absent, reply exactly RCDS-PARENT-MISSING ${rowNonce}. Do not call tools.`;
      tracker.send(socket, 'sessions.send', { key: sessionKey, message: followup, idempotencyKey: `${inv.idempotencyKeyPrefix}-FOLLOWUP-${rowNonce}` });
    }

    function startProofFlow(socket) {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      socket.setTimeout(() => {
        const task = `Proof ${rowNonce}: return exactly ${childToken}. Do not mutate files. Do not post to any channel.`;
        const instruction = `${HARNESS_MARKER} R-CD-SILENT proof nonce ${rowNonce}. Call continue_delegate with task=${JSON.stringify(task)}, mode="${inv.mode}", delaySeconds=${inv.delaySeconds}. After the continue_delegate tool result reports scheduled, reply exactly RCDS-SCHEDULED ${rowNonce}. Do not say ${childToken} in your visible reply.`;
        tracker.send(socket, 'sessions.send', { key: sessionKey, message: instruction, idempotencyKey: `${inv.idempotencyKeyPrefix}-DISPATCH-${rowNonce}` });
      }, 500);
      socket.setTimeout(() => socket.close(), Math.max(180000, (inv.delaySeconds + 150) * 1000));
    }

    socket.on('open', () => {
      handshake.begin(socket, token);
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw); const classified = tracker.classify(msg);
        handshake.observe(classified);
        recordClassifiedEvent(evidence, classified, redactEvent, { redactData: safeRedact });

        if (classified.kind === 'response' && classified.method === 'sessions.create') {
          if (classified.ok && classified.payload) { sessionKey = classified.payload.key || sessionKey; evidence.sessionKey = sessionKey; evidence.session_created = true; evidence.created_session_key = sessionKey; console.log('✓ disposable session created: ' + sessionKey); startProofFlow(socket); }
          else { console.error('✗ sessions.create rejected: ' + JSON.stringify(classified.error)); failures.add(1); socket.close(); }
        }
        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) {
            if (!evidence.dispatch_accepted) { evidence.dispatch_accepted = true; evidence.dispatch_accepted_at_ms = Date.now(); if (classified.payload?.traceId) evidence.trace_id = classified.payload.traceId; console.log('✓ dispatch sessions.send accepted for mode=silent'); }
            else { evidence.followup_accepted = true; console.log('✓ follow-up sessions.send accepted'); }
          } else { console.error('✗ sessions.send rejected: ' + JSON.stringify(classified.error)); failures.add(1); }
        }
        if (classified.kind === 'event') {
          const eventName = classified.event || '';
          const eventData = classified.data || {};
          const eventStr = JSON.stringify(eventData);
          if (eventStr.includes(childToken) && isChannelDeliveryEvent(eventName, eventData)) {
            evidence.child_channel_delivery_observed = true; evidence.no_channel_delivery = false; console.warn('✗ child token appeared in a channel-delivery-shaped event'); failures.add(1);
          }
          if (!eventStr.includes(HARNESS_MARKER) && eventStr.includes(`RCDS-SCHEDULED ${rowNonce}`)) { evidence.scheduled_sentinel = true; console.log('✓ scheduled sentinel observed'); }
          if (!eventStr.includes(HARNESS_MARKER) && eventStr.includes(childToken) && eventName === 'chat' && String(eventData.sessionKey || '').includes(':subagent:continuation-') && eventStr.includes('final')) {
            if (!evidence.child_completion_observed) { evidence.child_completion_observed = true; console.log('✓ silent child completion observed on internal stream'); socket.setTimeout(() => sendFollowup(socket), Number(__ENV.OPENCLAW_SILENT_FOLLOWUP_AFTER_CHILD_MS || 5000)); }
          }
          if (!eventStr.includes(HARNESS_MARKER) && eventStr.includes(`RCDS-PARENT-OBSERVED ${childToken}`)) { evidence.parent_internal_context_observed = true; console.log('✓ parent reported silent child token from internal context'); }
        }
        if (evidence.dispatch_accepted && evidence.scheduled_sentinel && evidence.child_completion_observed && evidence.followup_accepted && evidence.parent_internal_context_observed && evidence.no_channel_delivery) { console.log('All required R-CD-SILENT evidence gathered, closing early'); socket.close(); }
      } catch (e) { console.warn('parse error: ' + e); }
    });
    socket.on('error', (e) => { console.error('ws error: ' + (e && e.error ? e.error() : e)); failures.add(1); });
  });

  evidence.ended = new Date().toISOString(); evidence.duration_ms = Date.now() - started; finalEvidence = evidence; duration.add(evidence.duration_ms);
  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'dispatch accepted': () => evidence.dispatch_accepted,
    'scheduled sentinel observed': () => evidence.scheduled_sentinel,
    'child completion observed': () => evidence.child_completion_observed,
    'follow-up accepted': () => evidence.followup_accepted,
    'parent internal context observed': () => evidence.parent_internal_context_observed,
    'no child channel delivery': () => evidence.no_channel_delivery,
  });
  if (!evidence.dispatch_accepted || !evidence.scheduled_sentinel || !evidence.child_completion_observed || !evidence.followup_accepted || !evidence.parent_internal_context_observed || !evidence.no_channel_delivery) failures.add(1);
  const passed = (!createDisposableSession || evidence.session_created) && evidence.dispatch_accepted && evidence.scheduled_sentinel && evidence.child_completion_observed && evidence.followup_accepted && evidence.parent_internal_context_observed && evidence.no_channel_delivery;
  console.log(`R_CD_SILENT_EVIDENCE ${JSON.stringify(evidence)}`);
  console.log('\n--- R-CD-SILENT EVIDENCE SUMMARY ---'); console.log(JSON.stringify(evidence, null, 2)); console.log('--- END EVIDENCE ---');
  console.log(`\n[R-CD-SILENT] VERDICT: ${passed ? 'PASS-candidate' : 'PARTIAL-candidate'}`);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const passRate = data.metrics.proof_failures?.values?.count === 0;
  const traceId = finalEvidence?.trace_id || null;
  const verdict = passRate ? 'PASS-candidate' : 'PARTIAL-candidate';
  const summary = { row: 'R-CD-SILENT', sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset', seat: __ENV.OPENCLAW_SEAT_NAME || 'ronan-dgx', timestamp, verdict, candidateOnly: true, foldRequiresReview: true, evidenceJsonl: 'evidence.jsonl', observability: { traceId, traceJson: traceId ? 'pending-fetch' : 'missing' }, review: { status: traceId && verdict === 'PASS-candidate' ? 'ready-for-human-review' : 'review-pending', pendingReceipts: traceId ? [] : ['tempo-trace-json'], notes: traceId ? ['Trace id captured; fetch and attach Tempo trace JSON before canonical fold.'] : [verdict === 'PASS-candidate' ? 'No trace_id emitted; keep PASS-candidate review-pending until trace JSON is fetched or trace-missing is explicitly accepted.' : 'No trace_id emitted. This run is PARTIAL-candidate; preserve k6.log/evidence and do not fold as PASS.'] }, metrics: { duration_ms: data.metrics.r_cd_silent_duration?.values || null, failures: data.metrics.proof_failures?.values?.count || 0 } };
  return { stdout: `\n[R-CD-SILENT] Summary: ${summary.verdict} | SHA: ${summary.sha} | Seat: ${summary.seat}\n`, 'r-cd-silent-summary.json': JSON.stringify(summary, null, 2) };
}
