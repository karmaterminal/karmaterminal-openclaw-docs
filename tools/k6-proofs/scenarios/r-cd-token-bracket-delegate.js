/** Scenario: R-CD-TOKEN — bracket [[CONTINUE_DELEGATE:...]] path from lightContext subagent. */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';

export const options = {
  scenarios: { r_cd_token_bracket_delegate: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '210s' } },
  thresholds: { proof_failures: ['count==0'], r_cd_token_duration: ['p(95)<180000'] },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_token_duration');
const manifest = loadManifestFromEnv();
const DEFAULTS = { sessionKey: 'main', seat: 'cael-dgx', delaySeconds: 1, idempotencyKeyPrefix: 'R-CD-TOKEN', taskNamePrefix: 'r-cd-token' };
const HARNESS_MARKER = '[k6-proof-harness]';
const POST_DISPATCH_EVIDENCE_GATE_MS = Number(__ENV.OPENCLAW_MIN_TOKEN_EVIDENCE_DELAY_MS || 1500);
function boolEnv(name) { return (__ENV[name] || '').toLowerCase() === 'true'; }
function invocationCfg() {
  const inv = manifest?.invocation || {};
  return {
    delaySeconds: Number(inv.delaySeconds ?? __ENV.OPENCLAW_DELEGATE_DELAY_SECONDS ?? DEFAULTS.delaySeconds),
    idempotencyKeyPrefix: inv.idempotencyKeyPrefix || DEFAULTS.idempotencyKeyPrefix,
    taskNamePrefix: inv.taskNamePrefix || DEFAULTS.taskNamePrefix,
    lightContext: inv.lightContext !== false,
  };
}

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLW_GATEWAY_TOKEN || __ENV.OPENCLAW_GATEWAY_TOKEN;
  const requestedSessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || DEFAULTS.sessionKey;
  let sessionKey = requestedSessionKey;
  const createDisposableSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION') || boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSIONS');
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || DEFAULTS.seat;
  const rowNonce = nonce('R-CD-TOKEN');
  if (!token) { console.error('OPENCLAW_GATEWAY_TOKEN is required'); failures.add(1); return; }
  if (manifest) { const errors = validateManifest(manifest); if (errors.length > 0) console.warn('Manifest validation warnings: ' + errors.join('; ')); }
  const evidence = {
    row: 'R-CD-TOKEN', manifest_loaded: !!manifest, nonce: rowNonce, seat, requestedSessionKey, sessionKey,
    session_created: false, created_session_key: null, candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(), prompt_injected: false, subagent_spawn_requested: false, subagent_spawn_accepted: false,
    bracket_token_observed: false, delegate_spawn_or_return_observed: false, child_spawned: false, parent_return_event: false,
    dispatch_accepted_at_ms: null, child_session_key: null, trace_id: null, redacted_events: [],
  };
  const started = Date.now();
  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    function startProofFlow(socket) {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      socket.setTimeout(() => {
        const inv = invocationCfg();
        const taskName = (inv.taskNamePrefix + '-' + rowNonce).toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 80);
        const delegateTask = 'Proof R-CD-TOKEN delegate return nonce ' + rowNonce + ': reply exactly CD-TOKEN-DELEGATE-DONE ' + rowNonce + '. Do not mutate files. Do not post externally.';
        const bracket = '[[CONTINUE_DELEGATE: ' + delegateTask + ' +' + inv.delaySeconds + 's]]';
        const childTask = 'k6 proof R-CD-TOKEN nonce ' + rowNonce + '. Reply exactly CD-TOKEN-HOP1 ' + rowNonce + ', then end your entire response with this exact terminal bracket on its own final line: ' + bracket + ' Do not call continue_delegate tool. Do not put any text after the closing brackets. Do not mutate files.';
        const agentInstruction = HARNESS_MARKER + ' Call sessions_spawn exactly once with runtime="subagent", mode="run", taskName="' + taskName + '", label="k6 R-CD-TOKEN ' + rowNonce + '", lightContext=' + (inv.lightContext ? 'true' : 'false') + ', context="isolated", cleanup="delete", and task=' + JSON.stringify(childTask) + '. After the sessions_spawn tool result is accepted, reply exactly CD-TOKEN-PARENT-SPAWNED ' + rowNonce + '. This is a proof run.';
        evidence.subagent_spawn_requested = true;
        tracker.send(socket, 'sessions.send', { key: sessionKey, message: agentInstruction, idempotencyKey: inv.idempotencyKeyPrefix + '-DISPATCH-' + rowNonce });
      }, 500);
      socket.setTimeout(() => socket.close(), 180000);
    }
    socket.on('open', () => {
      socket.send(connectFrame(token));
      if (createDisposableSession) {
        socket.setTimeout(() => {
          const disposableKey = ('r-cd-token-' + rowNonce).toLowerCase().replace(/[^a-z0-9-]/g, '-');
          tracker.send(socket, 'sessions.create', { key: disposableKey, label: 'k6 R-CD-TOKEN ' + rowNonce });
        }, 250);
      } else socket.setTimeout(() => startProofFlow(socket), 500);
    });
    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw); const classified = tracker.classify(msg);
        evidence.redacted_events.push({ ts: Date.now(), kind: classified.kind, method: classified.method || null, event: classified.event || null, ok: classified.ok !== undefined ? classified.ok : null, data: classified.payload ? redactEvent(classified.payload) : null });
        if (classified.kind === 'response' && classified.method === 'sessions.create') {
          if (classified.ok && classified.payload) { sessionKey = classified.payload.key || sessionKey; evidence.sessionKey = sessionKey; evidence.session_created = true; evidence.created_session_key = sessionKey; console.log('✓ disposable session created: ' + sessionKey); startProofFlow(socket); }
          else { console.error('✗ sessions.create rejected: ' + JSON.stringify(classified.error)); failures.add(1); socket.close(); }
        }
        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) { evidence.prompt_injected = true; evidence.dispatch_accepted_at_ms = Date.now(); if (classified.payload?.traceId) evidence.trace_id = classified.payload.traceId; console.log('✓ sessions.send accepted — parent agent turn triggered'); }
          else { console.error('✗ sessions.send rejected: ' + JSON.stringify(classified.error)); failures.add(1); }
        }
        if (classified.kind === 'event') {
          const eventData = classified.data || {}; const eventStr = JSON.stringify(eventData);
          if (eventData.traceId) evidence.trace_id = eventData.traceId;
          if (eventData.childSessionKey) { evidence.child_session_key = eventData.childSessionKey; evidence.child_spawned = true; }
          if (eventStr.includes(rowNonce)) {
            if (eventStr.includes(HARNESS_MARKER)) console.log('ℹ Ignoring harness prompt echo event');
            else if (evidence.prompt_injected && evidence.dispatch_accepted_at_ms && (Date.now() - evidence.dispatch_accepted_at_ms) >= POST_DISPATCH_EVIDENCE_GATE_MS) {
              if (eventStr.includes('CD-TOKEN-PARENT-SPAWNED') || eventStr.includes('sessions_spawn') || eventStr.includes('childSessionKey')) { evidence.subagent_spawn_accepted = true; evidence.child_spawned = true; console.log('✓ parent sessions_spawn acceptance signal observed'); }
              if (eventStr.includes('CD-TOKEN-HOP1 ' + rowNonce) || eventStr.includes('[[CONTINUE_DELEGATE:') || eventStr.includes('bracket')) { evidence.bracket_token_observed = true; console.log('✓ bracket-token child turn observed'); }
              if (eventStr.includes('CD-TOKEN-DELEGATE-DONE ' + rowNonce)) { evidence.delegate_spawn_or_return_observed = true; evidence.parent_return_event = true; console.log('✓ CD-TOKEN-DELEGATE-DONE return sentinel observed'); }
            }
          }
        }
        if (evidence.prompt_injected && evidence.subagent_spawn_accepted && evidence.bracket_token_observed && evidence.delegate_spawn_or_return_observed && evidence.parent_return_event) { console.log('All required R-CD-TOKEN evidence gathered, closing early'); socket.close(); }
      } catch (e) { console.warn('parse error: ' + e); }
    });
    socket.on('error', (e) => { console.error('ws error: ' + (e && e.error ? e.error() : e)); failures.add(1); });
  });
  evidence.ended = new Date().toISOString(); evidence.duration_ms = Date.now() - started; duration.add(evidence.duration_ms);
  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, { 'prompt injected': () => evidence.prompt_injected, 'subagent spawn requested': () => evidence.subagent_spawn_requested, 'subagent spawn accepted': () => evidence.subagent_spawn_accepted, 'bracket token observed': () => evidence.bracket_token_observed, 'delegate return observed': () => evidence.delegate_spawn_or_return_observed, 'parent return event': () => evidence.parent_return_event });
  if (!evidence.prompt_injected || !evidence.subagent_spawn_requested || !evidence.subagent_spawn_accepted || !evidence.bracket_token_observed || !evidence.delegate_spawn_or_return_observed || !evidence.parent_return_event) failures.add(1);
  const passed = (!createDisposableSession || evidence.session_created) && evidence.prompt_injected && evidence.subagent_spawn_requested && evidence.subagent_spawn_accepted && evidence.bracket_token_observed && evidence.delegate_spawn_or_return_observed && evidence.parent_return_event;
  console.log('\n--- R-CD-TOKEN EVIDENCE SUMMARY ---'); console.log(JSON.stringify(evidence, null, 2)); console.log('--- END EVIDENCE ---'); console.log('\n[R-CD-TOKEN] VERDICT: ' + (passed ? 'PASS-candidate' : 'PARTIAL-candidate'));
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString(); const passRate = data.metrics.proof_failures?.values?.count === 0;
  const summary = { row: 'R-CD-TOKEN', sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset', seat: __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx', timestamp, verdict: passRate ? 'PASS-candidate' : 'PARTIAL-candidate', metrics: { duration_ms: data.metrics.r_cd_token_duration?.values || null, failures: data.metrics.proof_failures?.values?.count || 0 } };
  return { stdout: '\n[R-CD-TOKEN] Summary: ' + summary.verdict + ' | SHA: ' + summary.sha + ' | Seat: ' + summary.seat + '\n', 'r-cd-token-bracket-delegate-summary.json': JSON.stringify(summary, null, 2) };
}
