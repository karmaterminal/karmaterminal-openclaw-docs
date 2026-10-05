/** Scenario: R-CD-MODEL-TOKEN — bracket continue_delegate with model=<provider/model>. */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import { childSessionKeyForTokenOnly, compactTaskIdentityToken } from '../lib/row-child-correlation.mjs';
import { createChildObserver, createPreflightGate, failClosedVerdict } from '../lib/child-observer.mjs';
import {
  activeFallbackFromSessionMetadata,
  classifyModelIdentity,
  modelFromSessionMetadata,
  normalizeModel,
  resolveRequestedModel,
  servedReceiptFromHistory,
} from '../lib/model-identity.mjs';

export const options = {
  scenarios: { r_cd_model_token: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '210s' } },
  thresholds: { proof_failures: ['count==0'], r_cd_model_token_duration: ['p(95)<180000'] },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_model_token_duration');
const manifest = loadManifestFromEnv();
// #559: no default override model. A bare alias such as "gpt" resolved to a
// model the seat did not have and the row still reported the echoed alias.
const DEFAULTS = { sessionKey: 'main', seat: 'cael-dgx', delaySeconds: 1, idempotencyKeyPrefix: 'R-CD-MODEL-TOKEN', taskNamePrefix: 'r-cd-model-token' };
const HARNESS_MARKER = '[k6-proof-harness]';
const POST_DISPATCH_EVIDENCE_GATE_MS = Number(__ENV.OPENCLAW_MIN_TOKEN_EVIDENCE_DELAY_MS || 1500);
function boolEnv(name) { return (__ENV[name] || '').toLowerCase() === 'true'; }
function escapeRegex(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function invocationCfg() {
  const inv = manifest?.invocation || {};
  const requested = resolveRequestedModel(__ENV.OPENCLAW_ALT_MODEL, inv.model);
  return {
    delaySeconds: Number(inv.delaySeconds ?? __ENV.OPENCLAW_DELEGATE_DELAY_SECONDS ?? DEFAULTS.delaySeconds),
    requestedModel: requested.model,
    requestedModelRefusal: requested.refusal,
    idempotencyKeyPrefix: inv.idempotencyKeyPrefix || DEFAULTS.idempotencyKeyPrefix,
    taskNamePrefix: inv.taskNamePrefix || DEFAULTS.taskNamePrefix,
    lightContext: inv.lightContext !== false,
  };
}
let finalEvidence = null;

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const requestedSessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || DEFAULTS.sessionKey;
  let sessionKey = requestedSessionKey;
  const createDisposableSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION') || boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSIONS');
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || DEFAULTS.seat;
  const rowNonce = nonce('R-CD-MODEL-TOKEN');
  const inv = invocationCfg();
  // The hop-1 task embeds the delegate task inside its bracket, so the hop-1
  // child carries both tokens and the delegate child carries only its own.
  const hop1Token = compactTaskIdentityToken('MTOK1', rowNonce);
  const delegateToken = compactTaskIdentityToken('MTOKD', rowNonce);
  if (!token) { console.error('OPENCLAW_GATEWAY_TOKEN is required'); failures.add(1); return; }
  if (manifest) { const errors = validateManifest(manifest); if (errors.length > 0) console.warn('Manifest validation warnings: ' + errors.join('; ')); }
  const evidence = {
    row: 'R-CD-MODEL-TOKEN', manifest_loaded: !!manifest, nonce: rowNonce, seat, requestedSessionKey, sessionKey,
    session_created: false, created_session_key: null, candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(), requested_model_byte: inv.requestedModel, requested_model_source: 'bracket model= modifier',
    dispatch_refused: null, prompt_injected: false, subagent_spawn_requested: false,
    subagent_spawn_accepted: false, bracket_token_observed: false, bracket_model_modifier_observed: false,
    hop1_child_session_key: null, child_session_observed: false, child_session_key: null,
    // Selection (sessions.describe) and run-window SERVED model (chat.history) are separate.
    child_session_metadata_observed: false, child_selected_model_byte: null, child_selected_model_source: null,
    child_active_fallback: null, child_served_model_byte: null, child_served_receipt: null,
    child_self_reported_model: null, child_session_metadata: null, model_matches: false, selection_matches: false, return_payload: false,
    hop1_token: hop1Token, delegate_token: delegateToken,
    dispatch_accepted_at_ms: null, trace_id: null, model_classification_reason: null,
    preflight: null, observation_refused: null, verdict_reason: null, redacted_events: [],
  };
  const started = Date.now();
  const gate = createPreflightGate('R-CD-MODEL-TOKEN');
  // Depth 2: hop-1 names the parent in spawnedBy; the bracket delegate names hop-1.
  const observer = createChildObserver({ rootSessionKey: () => sessionKey, maxDepth: 2 });
  if (inv.requestedModelRefusal || !hop1Token || !delegateToken) {
    // Refuse before dispatch: nothing is sent and no attempt is spent.
    evidence.dispatch_refused = inv.requestedModelRefusal || 'row task identity tokens could not be rendered';
    evidence.model_classification_reason = evidence.dispatch_refused;
    evidence.ended = new Date().toISOString(); evidence.duration_ms = Date.now() - started; duration.add(evidence.duration_ms);
    finalEvidence = { ...evidence, verdict: 'PARTIAL-candidate' };
    failures.add(1);
    console.error('✗ R-CD-MODEL-TOKEN refused before dispatch: ' + evidence.dispatch_refused);
    console.log('\n--- R-CD-MODEL-TOKEN EVIDENCE SUMMARY ---'); console.log(JSON.stringify(evidence, null, 2)); console.log('--- END EVIDENCE ---'); console.log('\n[R-CD-MODEL-TOKEN] VERDICT: PARTIAL-candidate');
    return;
  }
  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    let childMetadataAttempts = 0;
    let childMetadataRequestInFlight = false;
    function requestChildMetadata(socket, delayMs = 1) {
      if (!evidence.child_session_key || childMetadataRequestInFlight || evidence.child_session_metadata_observed || childMetadataAttempts >= 6) return;
      socket.setTimeout(() => {
        if (childMetadataRequestInFlight || evidence.child_session_metadata_observed) return;
        childMetadataRequestInFlight = true;
        childMetadataAttempts += 1;
        tracker.send(socket, 'sessions.describe', { key: evidence.child_session_key });
      }, delayMs);
    }
    const served = { attempts: 0, inFlight: false, done: false };
    function requestServed(delayMs) {
      if (!evidence.child_session_key || served.done || served.inFlight || served.attempts >= 6) return;
      served.inFlight = true;
      socket.setTimeout(() => {
        served.attempts += 1;
        if (!observer.refreshHistory(evidence.child_session_key, 100, 'served-child')) served.inFlight = false;
      }, delayMs);
    }
    function onServedHistory(messages) {
      served.inFlight = false;
      const receipt = servedReceiptFromHistory(messages, { anchor: delegateToken, sentinel: 'MODEL-TOKEN-DELEGATE-DONE ' + rowNonce });
      evidence.child_served_receipt = receipt;
      evidence.child_served_model_byte = receipt.served;
      if (receipt.served || receipt.conflict) { served.done = true; return; }
      requestServed(2000);
    }
    function observeDelegateChild(socket, payload) {
      const key = childSessionKeyForTokenOnly(payload, delegateToken, hop1Token);
      acceptDelegateChild(socket, key);
    }
    // #562: hop-1's own row names the parent and its own spawn task carries the
    // hop-1 token; the delegate's own row names hop-1 and its own task carries
    // only the delegate token (hop-1 embeds both, so token-only excludes it).
    function observeDelegateLineage(socket) {
      const hop1 = observer.boundChild(hop1Token, [], { spawnedBy: sessionKey });
      if (!hop1.childSessionKey) return;
      if (!evidence.hop1_child_session_key) evidence.hop1_child_session_key = hop1.childSessionKey;
      if (evidence.hop1_child_session_key !== hop1.childSessionKey) return;
      acceptDelegateChild(socket, observer.boundChildForTokenOnly(delegateToken, hop1Token, { spawnedBy: hop1.childSessionKey }));
    }
    function acceptDelegateChild(socket, key) {
      if (!key || evidence.child_session_key) return;
      evidence.child_session_observed = true;
      evidence.child_session_key = key;
      requestChildMetadata(socket);
    }
    function startProofFlow(socket) {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      socket.setTimeout(() => {
        const taskName = (inv.taskNamePrefix + '-' + rowNonce).toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 80);
        // Neither task names the requested model; only the bracket modifier does.
        const delegateTask = delegateToken + ' Proof R-CD-MODEL-TOKEN delegate nonce ' + rowNonce + ': reply exactly MODEL-TOKEN-DELEGATE-DONE ' + rowNonce + ' MODEL <provider/model>, replacing <provider/model> with the current model identity from runtime context. Do not mutate files. Do not post externally.';
        const bracket = '[[CONTINUE_DELEGATE: ' + delegateTask + ' +' + inv.delaySeconds + 's | model=' + inv.requestedModel + ']]';
        const childTask = hop1Token + ' k6 proof R-CD-MODEL-TOKEN nonce ' + rowNonce + '. Reply exactly MODEL-TOKEN-HOP1 ' + rowNonce + ', then end your entire response with this exact terminal bracket on its own final line: ' + bracket + ' Do not call continue_delegate tool. Do not put any text after the closing brackets. Do not mutate files.';
        const agentInstruction = HARNESS_MARKER + ' Call sessions_spawn exactly once with runtime="subagent", mode="run", taskName="' + taskName + '", label="k6 R-CD-MODEL-TOKEN ' + rowNonce + '", lightContext=' + (inv.lightContext ? 'true' : 'false') + ', context="isolated", cleanup="delete", and task=' + JSON.stringify(childTask) + '. After the sessions_spawn tool result is accepted, reply exactly MODEL-TOKEN-PARENT-SPAWNED ' + rowNonce + '. This is a proof run.';
        evidence.subagent_spawn_requested = true;
        tracker.send(socket, 'sessions.send', { key: sessionKey, message: agentInstruction, idempotencyKey: inv.idempotencyKeyPrefix + '-DISPATCH-' + rowNonce });
      }, 500);
      for (const delayMs of [15000, 30000, 60000, 90000]) socket.setTimeout(() => observer.poll(), delayMs);
      socket.setTimeout(() => socket.close(), 180000);
    }
    function afterHello(socket) {
      if (createDisposableSession) {
        socket.setTimeout(() => {
          const disposableKey = ('r-cd-model-token-' + rowNonce).toLowerCase().replace(/[^a-z0-9-]/g, '-');
          tracker.send(socket, 'sessions.create', { key: disposableKey, label: 'k6 R-CD-MODEL-TOKEN ' + rowNonce });
        }, 250);
      } else socket.setTimeout(() => startProofFlow(socket), 500);
    }
    socket.on('open', () => {
      socket.send(connectFrame(token));
      observer.attach((method, params) => tracker.send(socket, method, params));
      socket.setTimeout(() => { if (gate.timeout(10000)) socket.close(); }, 10000);
    });
    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        const preflight = gate.observe(msg);
        if (preflight === 'refused') {
          console.error('✗ R-CD-MODEL-TOKEN preflight refused before dispatch: ' + gate.result.reason);
          socket.close();
          return;
        }
        if (preflight === 'ready') afterHello(socket);
        const observed = observer.claim(msg);
        const classified = tracker.classify(msg);
        evidence.redacted_events.push({ ts: Date.now(), kind: classified.kind, method: classified.method || null, event: classified.event || null, ok: classified.ok !== undefined ? classified.ok : null, data: classified.payload ? redactEvent(classified.payload) : null });
        if (classified.kind === 'response' && classified.method === 'sessions.create') {
          if (classified.ok && classified.payload) { sessionKey = classified.payload.key || sessionKey; evidence.sessionKey = sessionKey; evidence.session_created = true; evidence.created_session_key = sessionKey; console.log('✓ disposable session created: ' + sessionKey); startProofFlow(socket); }
          else { console.error('✗ sessions.create rejected: ' + JSON.stringify(classified.error)); failures.add(1); socket.close(); }
        }
        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) { evidence.prompt_injected = true; evidence.dispatch_accepted_at_ms = Date.now(); if (classified.payload?.traceId) evidence.trace_id = classified.payload.traceId; console.log('✓ sessions.send accepted — parent agent turn triggered'); }
          else { console.error('✗ sessions.send rejected: ' + JSON.stringify(classified.error)); failures.add(1); }
        }
        if (observed) {
          const history = observer.handle(observed, classified);
          if (observed.purpose === 'served-child') {
            if (history) onServedHistory(history);
            else { served.inFlight = false; if (!observer.state.refusal) requestServed(2000); }
          }
          observeDelegateLineage(socket);
        }
        if (classified.kind === 'response' && classified.method === 'sessions.describe') {
          childMetadataRequestInFlight = false;
          const child = classified.payload?.session || null;
          if (child && (!child.key || child.key === evidence.child_session_key)) {
            evidence.child_session_metadata_observed = true;
            evidence.child_selected_model_byte = modelFromSessionMetadata(child);
            evidence.child_selected_model_source = 'gateway sessions.describe persisted model selection (delegate child; not a served receipt)';
            evidence.child_active_fallback = activeFallbackFromSessionMetadata(child);
            evidence.child_session_metadata = { key: child.key || null, provider: child.modelProvider || child.provider || null, model: child.model || null, modelSelectionLocked: child.modelSelectionLocked === true };
            console.log('✓ delegate child session metadata observed');
          } else if (!classified.ok) {
            evidence.model_classification_reason = 'gateway sessions.describe unavailable while resolving delegate child metadata';
          } else requestChildMetadata(socket, 250);
        }
        if (classified.kind === 'event') {
          const eventData = classified.data || {}; const eventStr = JSON.stringify(eventData);
          if (eventData.traceId) evidence.trace_id = eventData.traceId;
          if (eventData.childSessionKey && !evidence.hop1_child_session_key && eventStr.includes(hop1Token)) evidence.hop1_child_session_key = eventData.childSessionKey;
          observeDelegateChild(socket, eventData);
          if (eventStr.includes(rowNonce)) {
            if (eventStr.includes(HARNESS_MARKER)) console.log('ℹ Ignoring harness prompt echo event');
            else if (evidence.prompt_injected && evidence.dispatch_accepted_at_ms && (Date.now() - evidence.dispatch_accepted_at_ms) >= POST_DISPATCH_EVIDENCE_GATE_MS) {
              if (eventStr.includes('MODEL-TOKEN-PARENT-SPAWNED') || eventStr.includes('sessions_spawn') || eventStr.includes('childSessionKey')) { evidence.subagent_spawn_accepted = true; console.log('✓ parent sessions_spawn acceptance signal observed'); }
              if (eventStr.includes('MODEL-TOKEN-HOP1 ' + rowNonce) || eventStr.includes('[[CONTINUE_DELEGATE:') || eventStr.includes('bracket')) { evidence.bracket_token_observed = true; console.log('✓ bracket-token child turn observed'); }
              if (eventStr.includes('model=' + evidence.requested_model_byte)) { evidence.bracket_model_modifier_observed = true; console.log('✓ bracket model modifier observed'); }
              const done = eventStr.match(new RegExp('MODEL-TOKEN-DELEGATE-DONE\\s+' + escapeRegex(rowNonce) + '\\s+MODEL\\s+([A-Za-z0-9_.\\/-]+)'));
              if (done) {
                evidence.return_payload = true;
                evidence.child_self_reported_model = normalizeModel(done[1]);
                requestServed(500);
                console.log('✓ MODEL-TOKEN-DELEGATE-DONE return sentinel observed (self-report is auxiliary, not used for equality)');
              }
            }
          }
        }
        if (evidence.return_payload && evidence.child_session_key && !served.done) requestServed(500);
        if (evidence.prompt_injected && evidence.subagent_spawn_accepted && evidence.bracket_token_observed && evidence.bracket_model_modifier_observed && evidence.return_payload && evidence.child_session_metadata_observed && served.done) { console.log('All required R-CD-MODEL-TOKEN evidence gathered, closing early'); socket.close(); }
      } catch (e) { console.warn('parse error: ' + e); }
    });
    socket.on('error', (e) => { console.error('ws error: ' + (e && e.error ? e.error() : e)); failures.add(1); });
  });
  evidence.ended = new Date().toISOString(); evidence.duration_ms = Date.now() - started; duration.add(evidence.duration_ms);
  const complete = (!createDisposableSession || evidence.session_created) && evidence.prompt_injected && evidence.subagent_spawn_requested && evidence.subagent_spawn_accepted && evidence.bracket_token_observed && evidence.bracket_model_modifier_observed && evidence.child_session_observed && evidence.return_payload;
  evidence.preflight = gate.result;
  Object.assign(evidence, observer.summary());
  const identity = classifyModelIdentity({
    baseline: evidence.requested_model_byte,
    selected: evidence.child_selected_model_byte,
    served: evidence.child_served_model_byte,
    servedConflict: evidence.child_served_receipt?.conflict === true,
    activeFallback: evidence.child_active_fallback,
    complete,
  });
  // A served/selection mismatch on a bound child is authoritative; an unrelated
  // later observer error does not erase it (it is recorded as observer_reason).
  const finalVerdict = failClosedVerdict(identity.verdict, { gate, observer, keepProvenFail: true });
  evidence.observer_reason = finalVerdict.observerReason || null;
  evidence.model_matches = identity.modelMatches;
  evidence.selection_matches = identity.selectionMatches;
  evidence.model_classification_reason = finalVerdict.reason || identity.reason || evidence.model_classification_reason;
  evidence.verdict_reason = finalVerdict.reason;
  finalEvidence = { ...evidence, verdict: finalVerdict.verdict };
  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, { 'prompt injected': () => evidence.prompt_injected, 'subagent spawn requested': () => evidence.subagent_spawn_requested, 'subagent spawn accepted': () => evidence.subagent_spawn_accepted, 'bracket token observed': () => evidence.bracket_token_observed, 'bracket model modifier observed': () => evidence.bracket_model_modifier_observed, 'delegate return observed': () => evidence.return_payload, 'delegate-child selected model recorded': () => !!evidence.child_selected_model_byte, 'delegate-child served model (run-window bound)': () => !!evidence.child_served_model_byte, 'requested model served': () => evidence.model_matches });
  if (finalVerdict.verdict !== 'PASS-candidate') failures.add(1);
  console.log('\n--- R-CD-MODEL-TOKEN EVIDENCE SUMMARY ---'); console.log(JSON.stringify(evidence, null, 2)); console.log('--- END EVIDENCE ---'); console.log('\n[R-CD-MODEL-TOKEN] VERDICT: ' + finalVerdict.verdict);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const summary = { row: 'R-CD-MODEL-TOKEN', sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset', seat: __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx', timestamp, verdict: finalEvidence?.verdict || 'PARTIAL-candidate', requestedModel: finalEvidence?.requested_model_byte || null, servedModel: finalEvidence?.child_served_model_byte || null, selectedModel: finalEvidence?.child_selected_model_byte || null, selectedModelSource: finalEvidence?.child_selected_model_source || null, dispatchRefused: finalEvidence?.dispatch_refused || null, auxiliarySelfReport: finalEvidence?.child_self_reported_model || null, classificationReason: finalEvidence?.model_classification_reason || null, metrics: { duration_ms: data.metrics.r_cd_model_token_duration?.values || null, failures: data.metrics.proof_failures?.values?.count || 0 } };
  return { stdout: '\n[R-CD-MODEL-TOKEN] Summary: ' + summary.verdict + ' | SHA: ' + summary.sha + ' | Seat: ' + summary.seat + '\n', 'r-cd-model-token-summary.json': JSON.stringify(summary, null, 2) };
}
