/** Scenario: R-CW-4 — continue_work chain depth counter, 3 sequential hops. */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent, assertConnected } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';

export const options = {
  scenarios: { r_cw_4_chain_depth: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '10m' } },
  thresholds: { proof_failures: ['count==0'], r_cw_4_duration: ['p(95)<600000'] },
};
const failures = new Counter('proof_failures');
const duration = new Trend('r_cw_4_duration');
const manifest = loadManifestFromEnv();
const DEFAULTS = { sessionKey: 'main', seat: 'cael-dgx', delaySeconds: 5, idempotencyKeyPrefix: 'R-CW-4' };
const HARNESS_MARKER = '[k6-proof-harness]';
function boolEnv(name) { return (__ENV[name] || '').toLowerCase() === 'true'; }
function isRunnerProvisionedSession(key) { return String(key || '').includes(':subagent:continuation-'); }
function disposableSubagentKey(rowNonce) { return `agent:main:subagent:continuation-r-cw-4-${rowNonce}`.toLowerCase().replace(/[^a-z0-9:._-]/g, '-'); }
function invocationCfg() { const inv = manifest?.invocation || {}; return { delaySeconds: Number(inv.delaySeconds ?? __ENV.OPENCLAW_DELAY_SECONDS ?? DEFAULTS.delaySeconds), idempotencyKeyPrefix: inv.idempotencyKeyPrefix || DEFAULTS.idempotencyKeyPrefix }; }

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const requestedSessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || DEFAULTS.sessionKey;
  let sessionKey = requestedSessionKey;
  const createDisposableSession = (boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION') || boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSIONS')) && !isRunnerProvisionedSession(requestedSessionKey);
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || DEFAULTS.seat;
  const rowNonce = nonce('R-CW-4');
  if (!token) { console.error('OPENCLAW_GATEWAY_TOKEN is required'); failures.add(1); return; }
  if (manifest) { const errors = validateManifest(manifest); if (errors.length) console.warn('Manifest validation warnings: ' + errors.join('; ')); }
  const inv = invocationCfg();
  const evidence = { row:'R-CW-4', manifest_loaded:!!manifest, nonce:rowNonce, seat, requestedSessionKey, sessionKey, session_created:false, created_session_key:null, candidateSha:manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset', started:new Date().toISOString(), dispatch_accepted:false, hop1_scheduled:false, hop2_scheduled:false, hop3_scheduled:false, final_done:false, hop_events:[], trace_id:null, redacted_events:[] };
  const started = Date.now();
  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    function startProofFlow(socket) {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      socket.setTimeout(() => {
        const instruction = `${HARNESS_MARKER} R-CW-4 proof nonce ${rowNonce}. This is a sequential continue_work proof. On this initial turn: call continue_work with delaySeconds=${inv.delaySeconds} and reason="R-CW-4 hop1 ${rowNonce}; on wake call hop2". After tool result scheduled, reply exactly CW4-HOP1-SCHEDULED ${rowNonce}. On the first continuation wake: call continue_work with delaySeconds=${inv.delaySeconds} and reason="R-CW-4 hop2 ${rowNonce}; on wake call hop3"; after scheduled, reply exactly CW4-HOP2-SCHEDULED ${rowNonce}. On the second continuation wake: call continue_work with delaySeconds=${inv.delaySeconds} and reason="R-CW-4 hop3 ${rowNonce}; on wake finish"; after scheduled, reply exactly CW4-HOP3-SCHEDULED ${rowNonce}. On the third continuation wake: reply exactly CW4-DONE ${rowNonce}. No file mutations, no external posts.`;
        tracker.send(socket, 'sessions.send', { key: sessionKey, message: instruction, idempotencyKey: `${inv.idempotencyKeyPrefix}-DISPATCH-${rowNonce}` });
      }, 500);
      socket.setTimeout(() => socket.close(), Math.max(600000, (inv.delaySeconds * 4 + 360) * 1000));
    }
    socket.on('open', () => { socket.send(connectFrame(token)); if (createDisposableSession) { socket.setTimeout(() => { const disposableKey = disposableSubagentKey(rowNonce); tracker.send(socket, 'sessions.create', { key: disposableKey, label: `k6 R-CW-4 ${rowNonce}` }); }, 250); } else socket.setTimeout(() => startProofFlow(socket), 500); });
    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw); const classified = tracker.classify(msg);
        evidence.redacted_events.push({ ts:Date.now(), kind:classified.kind, method:classified.method||null, event:classified.event||null, ok:classified.ok!==undefined?classified.ok:null, data:classified.payload?redactEvent(classified.payload):null });
        if (classified.kind === 'response' && classified.method === 'sessions.create') {
          if (classified.ok && classified.payload) { sessionKey = classified.payload.key || sessionKey; evidence.sessionKey=sessionKey; evidence.session_created=true; evidence.created_session_key=sessionKey; console.log('✓ disposable session created: ' + sessionKey); startProofFlow(socket); } else { console.error('✗ sessions.create rejected: ' + JSON.stringify(classified.error)); failures.add(1); socket.close(); }
        }
        if (classified.kind === 'response' && classified.method === 'sessions.send') { if (classified.ok) { evidence.dispatch_accepted=true; if (classified.payload?.traceId) evidence.trace_id=classified.payload.traceId; console.log('✓ sessions.send accepted — chain-depth parent turn triggered'); } else { console.error('✗ sessions.send rejected: ' + JSON.stringify(classified.error)); failures.add(1); } }
        if (classified.kind === 'event') {
          const eventStr = JSON.stringify(classified.data || {});
          if (eventStr.includes(rowNonce) && !eventStr.includes(HARNESS_MARKER)) {
            for (const [key, marker] of [['hop1_scheduled', 'CW4-HOP1-SCHEDULED'], ['hop2_scheduled', 'CW4-HOP2-SCHEDULED'], ['hop3_scheduled', 'CW4-HOP3-SCHEDULED'], ['final_done', 'CW4-DONE']]) {
              if (!evidence[key] && eventStr.includes(`${marker} ${rowNonce}`)) { evidence[key]=true; evidence.hop_events.push({marker, ts:Date.now(), event:classified.event||null}); console.log('✓ ' + marker + ' observed'); }
            }
          }
        }
        if (evidence.dispatch_accepted && evidence.hop1_scheduled && evidence.hop2_scheduled && evidence.hop3_scheduled && evidence.final_done) { console.log('All required R-CW-4 evidence gathered, closing early'); socket.close(); }
      } catch (e) { console.warn('parse error: ' + e); }
    });

  // Rig-fault guard (see assertConnected): a refused WS upgrade yields an
  // artefact identical to a genuine failure — 0 ms, every flag false. Record
  // it so this row is never published as evidence about the feature.
  const connectFault = assertConnected(res);
  if (connectFault) evidence.connect_failed = connectFault;
    socket.on('error', (e) => { console.error('ws error: ' + (e && e.error ? e.error() : e)); failures.add(1); });
  });
  evidence.ended = new Date().toISOString(); evidence.duration_ms = Date.now() - started; duration.add(evidence.duration_ms);
  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, { 'dispatch accepted':()=>evidence.dispatch_accepted, 'hop1 scheduled':()=>evidence.hop1_scheduled, 'hop2 scheduled':()=>evidence.hop2_scheduled, 'hop3 scheduled':()=>evidence.hop3_scheduled, 'final done':()=>evidence.final_done });
  if (!evidence.dispatch_accepted || !evidence.hop1_scheduled || !evidence.hop2_scheduled || !evidence.hop3_scheduled || !evidence.final_done) failures.add(1);
  const passed = (!createDisposableSession || evidence.session_created) && evidence.dispatch_accepted && evidence.hop1_scheduled && evidence.hop2_scheduled && evidence.hop3_scheduled && evidence.final_done;
  console.log('\n--- R-CW-4 EVIDENCE SUMMARY ---'); console.log(JSON.stringify(evidence, null, 2)); console.log('--- END EVIDENCE ---'); console.log('\n[R-CW-4] VERDICT: ' + (passed ? 'PASS-candidate' : 'PARTIAL-candidate'));
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString(); const passRate = data.metrics.proof_failures?.values?.count === 0;
  const summary = { row:'R-CW-4', sha:__ENV.OPENCLAW_CANDIDATE_SHA || 'unset', seat:__ENV.OPENCLAW_SEAT_NAME || 'cael-dgx', timestamp, verdict: passRate ? 'PASS-candidate' : 'PARTIAL-candidate', metrics:{ duration_ms:data.metrics.r_cw_4_duration?.values || null, failures:data.metrics.proof_failures?.values?.count || 0 } };
  return { stdout:'\n[R-CW-4] Summary: ' + summary.verdict + ' | SHA: ' + summary.sha + ' | Seat: ' + summary.seat + '\n', 'r-cw-4-chain-depth-summary.json': JSON.stringify(summary, null, 2) };
}
