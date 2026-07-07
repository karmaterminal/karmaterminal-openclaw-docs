/**
 * Scenario: R-CONFIG-INTERSESSION — read-only cross-session continuation config receipt.
 *
 * Drives an agent turn in a disposable session that reads
 * agents.defaults.continuation.crossSessionTargeting via config.get and emits a
 * nonce-correlated sentinel. No config mutation, continuation fire, or channel
 * delivery is required.
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';

export const options = {
  scenarios: { r_config_intersession: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '90s' } },
  thresholds: { proof_failures: ['count==0'], r_config_intersession_duration: ['p(95)<75000'] },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_config_intersession_duration');
const manifest = loadManifestFromEnv();
const HARNESS_MARKER = '[k6-proof-harness]';

function boolEnv(name) { return (__ENV[name] || '').toLowerCase() === 'true'; }
function parseSentinel(text, nonceValue) {
  const idx = text.lastIndexOf(`CONFIG-INTERSESSION ${nonceValue}`);
  if (idx === -1) return null;
  const match = text.slice(idx).match(/CROSSSESSION[^A-Za-z0-9_-]+([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const requestedSessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || 'main';
  let sessionKey = requestedSessionKey;
  const createDisposableSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION') || true;
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx';
  const rowNonce = nonce('R-CONFIG-INTERSESSION');

  if (!token) { console.error('OPENCLAW_GATEWAY_TOKEN is required'); failures.add(1); return; }
  if (manifest) {
    const errors = validateManifest(manifest);
    if (errors.length > 0) console.warn(`Manifest validation warnings: ${errors.join('; ')}`);
  }

  const evidence = {
    row: 'R-CONFIG-INTERSESSION', manifest_loaded: !!manifest, nonce: rowNonce, seat,
    requestedSessionKey, sessionKey, session_created: false, created_session_key: null,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(), dispatch_accepted: false, config_read: false,
    cross_session_targeting: null, trace_id: null, redacted_events: [],
  };
  const started = Date.now();
  const nonceEventText = [];
  let loggedPartialSentinel = false;

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    function startProofFlow() {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      socket.setTimeout(() => {
        const instruction = `${HARNESS_MARKER} For Project 81 row R-CONFIG-INTERSESSION nonce ${rowNonce}: ` +
          `call the gateway tool with action=config.get path=agents.defaults.continuation.crossSessionTargeting. ` +
          `If the config read succeeds, reply exactly CONFIG-INTERSESSION ${rowNonce} CROSSSESSION <value>. ` +
          `If the read fails, reply exactly CONFIG-INTERSESSION-FAIL ${rowNonce}. No other action.`;
        tracker.send(socket, 'sessions.send', { key: sessionKey, message: instruction, idempotencyKey: `R-CONFIG-INTERSESSION-${rowNonce}` });
      }, 500);
      socket.setTimeout(() => socket.close(), 60000);
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));
      if (createDisposableSession) {
        socket.setTimeout(() => {
          const disposableKey = `r-config-intersession-${rowNonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          tracker.send(socket, 'sessions.create', { key: disposableKey, label: `k6 R-CONFIG-INTERSESSION ${rowNonce}` });
        }, 250);
      } else socket.setTimeout(startProofFlow, 500);
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        const classified = tracker.classify(msg);
        evidence.redacted_events.push({ ts: Date.now(), kind: classified.kind, method: classified.method || null, event: classified.event || null, ok: classified.ok !== undefined ? classified.ok : null, data: classified.payload ? redactEvent(classified.payload) : null });
        if (classified.kind === 'response' && classified.method === 'sessions.create') {
          if (classified.ok && classified.payload) { sessionKey = classified.payload.key || sessionKey; evidence.sessionKey = sessionKey; evidence.session_created = true; evidence.created_session_key = sessionKey; console.log(`✓ disposable session created: ${sessionKey}`); startProofFlow(); }
          else { console.error(`✗ sessions.create rejected: ${JSON.stringify(classified.error)}`); failures.add(1); socket.close(); }
        }
        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) { evidence.dispatch_accepted = true; if (classified.payload?.traceId) evidence.trace_id = classified.payload.traceId; console.log('✓ sessions.send accepted — agent turn triggered for intersession config read'); }
          else { console.error(`✗ sessions.send rejected: ${JSON.stringify(classified.error)}`); failures.add(1); }
        }
        if (classified.kind === 'event') {
          const eventStr = JSON.stringify(classified.data || {});
          if (eventStr.includes(rowNonce)) {
            if (eventStr.includes(HARNESS_MARKER)) console.log('ℹ Ignoring harness prompt echo event');
            else if (eventStr.includes(`CONFIG-INTERSESSION-FAIL ${rowNonce}`)) { console.error('✗ CONFIG-INTERSESSION-FAIL sentinel observed'); failures.add(1); socket.close(); }
            else {
              nonceEventText.push(eventStr);
              const observedText = nonceEventText.join(' ');
              const crossSession = parseSentinel(observedText, rowNonce);
              if (crossSession !== null) { evidence.config_read = true; evidence.cross_session_targeting = crossSession; console.log(`✓ CONFIG-INTERSESSION sentinel observed: crossSessionTargeting=${crossSession}`); socket.close(); }
              else if (eventStr.includes(`CONFIG-INTERSESSION ${rowNonce}`) && !loggedPartialSentinel) { loggedPartialSentinel = true; console.log('ℹ CONFIG-INTERSESSION sentinel prefix observed; waiting for complete streamed sentinel'); }
            }
          }
        }
      } catch (e) { console.warn(`parse error: ${e}`); }
    });
    socket.on('error', (e) => { console.error(`ws error: ${e && e.error ? e.error() : e}`); failures.add(1); });
  });

  evidence.ended = new Date().toISOString(); evidence.duration_ms = Date.now() - started; duration.add(evidence.duration_ms);
  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, { 'dispatch accepted': () => evidence.dispatch_accepted, 'config read succeeded': () => evidence.config_read, 'cross-session targeting observed': () => typeof evidence.cross_session_targeting === 'string' && evidence.cross_session_targeting.length > 0 });
  if (!evidence.dispatch_accepted || !evidence.config_read || !evidence.cross_session_targeting) failures.add(1);
  console.log('\n--- R-CONFIG-INTERSESSION EVIDENCE SUMMARY ---'); console.log(JSON.stringify(evidence, null, 2)); console.log('--- END EVIDENCE ---');
  console.log(`\n[R-CONFIG-INTERSESSION] VERDICT: ${evidence.config_read ? 'PASS-candidate' : 'PARTIAL-candidate'}`);
}

export function handleSummary(data) {
  const passRate = data.metrics.proof_failures?.values?.count === 0;
  const summary = { row: 'R-CONFIG-INTERSESSION', sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset', seat: __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx', timestamp: new Date().toISOString(), verdict: passRate ? 'PASS-candidate' : 'PARTIAL-candidate', metrics: { duration_ms: data.metrics.r_config_intersession_duration?.values || null, failures: data.metrics.proof_failures?.values?.count || 0 } };
  return { stdout: `\n[R-CONFIG-INTERSESSION] Summary: ${summary.verdict} | SHA: ${summary.sha} | Seat: ${summary.seat}\n`, 'r-config-intersession-summary.json': JSON.stringify(summary, null, 2) };
}
