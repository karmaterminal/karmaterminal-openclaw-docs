/** Scenario: R-CD-MODEL-CHAINED-ALT — depth-1 delegate spawns depth-2 with explicit model override. */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import { childSessionKeyForTokenOnly, compactTaskIdentityToken } from '../lib/row-child-correlation.mjs';
import { createChildObserver, createPreflightGate, failClosedVerdict, reconcileChildIdentity } from '../lib/child-observer.mjs';
import {
  activeFallbackFromSessionMetadata,
  classifyModelIdentity,
  modelFromSessionMetadata,
  normalizeModel,
  resolveRequestedModel,
  servedReceiptFromHistory,
} from '../lib/model-identity.mjs';

import { k6TimeoutMs } from '../lib/k6-timeout.mjs';
export const options = {
  scenarios: { r_cd_model_chained_alt: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '240s' } },
  thresholds: { proof_failures: ['count==0'], r_cd_model_chained_alt_duration: ['p(95)<220000'] },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_model_chained_alt_duration');
const manifest = loadManifestFromEnv();
const DEFAULTS = {
  sessionKey: 'main',
  seat: 'cael-dgx',
  delaySeconds: 1,
  // #559: no default override model; a bare alias resolves per seat.
  idempotencyKeyPrefix: 'R-CD-MODEL-CHAINED-ALT',
};
const HARNESS_MARKER = '[k6-proof-harness]';
// Re-read the served transcript until the sentinel binds; bounded and recorded.
const SERVED_HISTORY_MAX_ATTEMPTS = 15;
const POST_DISPATCH_EVIDENCE_GATE_MS = Number(__ENV.OPENCLAW_MIN_DELEGATE_EVIDENCE_DELAY_MS || 1500);

function boolEnv(name) { return (__ENV[name] || '').toLowerCase() === 'true'; }
function escapeRegex(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function invocationCfg() {
  const inv = manifest?.invocation || {};
  const requested = resolveRequestedModel(__ENV.OPENCLAW_ALT_MODEL, inv.model);
  return {
    delaySeconds: Number(inv.delaySeconds ?? __ENV.OPENCLAW_DELAY_SECONDS ?? DEFAULTS.delaySeconds),
    requestedModel: requested.model,
    requestedModelRefusal: requested.refusal,
    idempotencyKeyPrefix: inv.idempotencyKeyPrefix || DEFAULTS.idempotencyKeyPrefix,
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
  const rowNonce = nonce('R-CD-MODEL-CHAINED-ALT');
  const inv = invocationCfg();
  // The depth-1 task embeds the depth-2 task, so the depth-1 child carries both
  // tokens and the depth-2 child carries only its own.
  const depth1Token = compactTaskIdentityToken('MCH1', rowNonce);
  const depth2Token = compactTaskIdentityToken('MCH2', rowNonce);

  if (!token) { console.error('OPENCLAW_GATEWAY_TOKEN is required'); failures.add(1); return; }
  if (manifest) { const errors = validateManifest(manifest); if (errors.length) console.warn('Manifest validation warnings: ' + errors.join('; ')); }

  const evidence = {
    row: 'R-CD-MODEL-CHAINED-ALT', manifest_loaded: !!manifest, nonce: rowNonce, seat,
    requestedSessionKey, sessionKey, session_created: false, created_session_key: null,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(), requested_model_byte: inv.requestedModel, requested_model_source: 'depth-1 continue_delegate model parameter',
    dispatch_refused: null, dispatch_accepted: false, dispatch_accepted_at_ms: null, depth_1_child_observed: false, depth_2_child_observed: false,
    depth_1_scheduled_inner: false, depth_2_child_session_key: null, depth_2_session_metadata_observed: false,
    // Selection (sessions.describe) and run-window SERVED model (chat.history) are separate.
    depth_2_selected_model_byte: null, depth_2_selected_model_source: null, depth_2_active_fallback: null,
    depth_2_served_model_byte: null, depth_2_served_receipt: null,
    depth_2_self_reported_model: null, depth_2_session_metadata: null, selection_matches: false,
    depth_1_token: depth1Token, depth_2_token: depth2Token, model_matches: false,
    return_payload: false, trace_id: null, model_classification_reason: null,
    depth_1_child_session_key: null, event_depth_2_candidates: [], child_identity_conflict: false, child_identity_reason: null, preflight: null, observation_refused: null, verdict_reason: null, redacted_events: [],
  };
  const started = Date.now();
  const gate = createPreflightGate('R-CD-MODEL-CHAINED-ALT');
  // Depth 2: depth-1 names the parent in spawnedBy; depth-2 names depth-1.
  const observer = createChildObserver({ rootSessionKey: () => sessionKey, maxDepth: 2 });
  if (inv.requestedModelRefusal || !depth1Token || !depth2Token) {
    // Refuse before dispatch: nothing is sent and no attempt is spent.
    evidence.dispatch_refused = inv.requestedModelRefusal || 'row task identity tokens could not be rendered';
    evidence.model_classification_reason = evidence.dispatch_refused;
    evidence.ended = new Date().toISOString(); evidence.duration_ms = Date.now() - started; duration.add(evidence.duration_ms);
    finalEvidence = { ...evidence, verdict: 'PARTIAL-candidate' };
    failures.add(1);
    console.error('✗ R-CD-MODEL-CHAINED-ALT refused before dispatch: ' + evidence.dispatch_refused);
    console.log('\n--- R-CD-MODEL-CHAINED-ALT EVIDENCE SUMMARY ---'); console.log(JSON.stringify(evidence, null, 2)); console.log('--- END EVIDENCE ---'); console.log('\n[R-CD-MODEL-CHAINED-ALT] VERDICT: PARTIAL-candidate');
    return;
  }

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    let depth2MetadataAttempts = 0;
    let depth2MetadataInFlight = false;
    function requestDepth2Metadata(socket, delayMs = 1) {
      if (!evidence.depth_2_child_session_key || depth2MetadataInFlight || evidence.depth_2_session_metadata_observed || depth2MetadataAttempts >= 6) return;
      socket.setTimeout(() => {
        if (depth2MetadataInFlight || evidence.depth_2_session_metadata_observed) return;
        depth2MetadataInFlight = true;
        depth2MetadataAttempts += 1;
        tracker.send(socket, 'sessions.describe', { key: evidence.depth_2_child_session_key });
      }, k6TimeoutMs(delayMs));
    }
    const served = { attempts: 0, inFlight: false, done: false };
    function requestServed(delayMs) {
      if (!evidence.depth_2_child_session_key || served.done || served.inFlight || served.attempts >= SERVED_HISTORY_MAX_ATTEMPTS) return;
      served.inFlight = true;
      socket.setTimeout(() => {
        served.attempts += 1;
        evidence.depth_2_served_history_attempts = served.attempts;
        if (!observer.refreshHistory(evidence.depth_2_child_session_key, 100, 'served-child')) served.inFlight = false;
      }, k6TimeoutMs(delayMs));
    }
    function onServedHistory(messages) {
      served.inFlight = false;
      const receipt = servedReceiptFromHistory(messages, { anchor: depth2Token, sentinel: 'MODEL-CHAINED-DEPTH2 ' + rowNonce });
      evidence.depth_2_served_receipt = receipt;
      evidence.depth_2_served_model_byte = receipt.served;
      if (receipt.served || receipt.conflict) { served.done = true; return; }
      requestServed(2000);
    }
    function markConflict(reason) {
      evidence.child_identity_conflict = true;
      evidence.child_identity_reason = reason;
    }
    // #562 / #563 item 2: depth-1's own row names the parent and its own spawn
    // task carries the depth-1 token; depth-2's own row names depth-1 and its
    // own task carries only the depth-2 token (depth-1 embeds both, so
    // token-only excludes it). Only these observer bindings bind; event-path
    // candidates cross-check, and disagreement or ambiguity fails closed.
    function observeDepthLineage(socket) {
      if (evidence.child_identity_conflict) return;
      const depth1 = observer.boundChild(depth1Token, [], { spawnedBy: sessionKey });
      if (depth1.ambiguous) return markConflict('depth-1: more than one child is bound to the row (observer)');
      if (!depth1.childSessionKey) return;
      if (evidence.depth_1_child_session_key && evidence.depth_1_child_session_key !== depth1.childSessionKey) return markConflict('depth-1 identity changed');
      evidence.depth_1_child_session_key = depth1.childSessionKey;
      evidence.depth_1_child_observed = true;
      const depth2 = reconcileChildIdentity({
        observerBinding: observer.boundChildTokenOnly(depth2Token, depth1Token, { spawnedBy: depth1.childSessionKey }),
        eventCandidates: evidence.event_depth_2_candidates,
      });
      if (depth2.conflict) return markConflict(`depth-2: ${depth2.reason}`);
      if (!depth2.childSessionKey) return;
      if (evidence.depth_2_child_session_key && evidence.depth_2_child_session_key !== depth2.childSessionKey) return markConflict('depth-2 identity changed');
      if (evidence.depth_2_child_session_key) return;
      evidence.depth_2_child_observed = true;
      evidence.depth_2_child_session_key = depth2.childSessionKey;
      requestDepth2Metadata(socket);
    }
    function start(socket) {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      socket.setTimeout(() => {
        const depth2Task =
          `${depth2Token} Proof nonce ${rowNonce} depth-2: reply exactly MODEL-CHAINED-DEPTH2 ${rowNonce} MODEL <provider/model>, ` +
          `replacing <provider/model> with the current model identity from runtime context. ` +
          `Do not mutate files. Do not post externally.`;
        const depth1Task =
          `${depth1Token} Proof nonce ${rowNonce} depth-1: call continue_delegate exactly once with mode="normal", delaySeconds=${inv.delaySeconds}, ` +
          `model=${JSON.stringify(inv.requestedModel)}, targetSessionKey=${JSON.stringify(sessionKey)}, and task=${JSON.stringify(depth2Task)}. ` +
          `After the continue_delegate tool result reports scheduled, reply exactly MODEL-CHAINED-DEPTH1-SCHEDULED ${rowNonce}. ` +
          `Do not mutate files. Do not post externally.`;
        const instruction =
          `${HARNESS_MARKER} R-CD-MODEL-CHAINED-ALT nonce ${rowNonce}. ` +
          `Call continue_delegate with mode="normal", delaySeconds=${inv.delaySeconds}, and task=${JSON.stringify(depth1Task)}. ` +
          `Do not set a model override on the depth-1 delegate. ` +
          `After the outer continue_delegate tool result reports scheduled, reply exactly MODEL-CHAINED-PARENT-SCHEDULED ${rowNonce}. No other action.`;
        tracker.send(socket, 'sessions.send', { key: sessionKey, message: instruction, idempotencyKey: `${inv.idempotencyKeyPrefix}-DISPATCH-${rowNonce}` });
      }, 500);
      for (const delayMs of [20000, 45000, 90000, 130000]) socket.setTimeout(() => observer.poll(), delayMs);
      socket.setTimeout(() => socket.close(), 220000);
    }

    function afterHello(socket) {
      if (createDisposableSession) {
        socket.setTimeout(() => {
          const key = `r-cd-model-chain-${rowNonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          tracker.send(socket, 'sessions.create', { key, label: `k6 R-CD-MODEL-CHAINED-ALT ${rowNonce}` });
        }, 250);
      } else socket.setTimeout(() => start(socket), 500);
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));
      observer.attach(
        (method, params) => tracker.send(socket, method, params),
        (delayMs, fn) => socket.setTimeout(fn, delayMs),
      );
      socket.setTimeout(() => { if (gate.timeout(10000)) socket.close(); }, 10000);
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        const preflight = gate.observe(msg);
        if (preflight === 'refused') {
          console.error('✗ R-CD-MODEL-CHAINED-ALT preflight refused before dispatch: ' + gate.result.reason);
          socket.close();
          return;
        }
        if (preflight === 'ready') afterHello(socket);
        const observed = observer.claim(msg);
        const classified = tracker.classify(msg);
        evidence.redacted_events.push({ ts: Date.now(), kind: classified.kind, method: classified.method || null, event: classified.event || null, ok: classified.ok !== undefined ? classified.ok : null, data: classified.payload ? redactEvent(classified.payload) : null });
        if (classified.kind === 'response' && classified.method === 'sessions.create') {
          if (classified.ok && classified.payload) { sessionKey = classified.payload.key || sessionKey; evidence.sessionKey = sessionKey; evidence.session_created = true; evidence.created_session_key = sessionKey; console.log('✓ disposable session created: ' + sessionKey); start(socket); }
          else { console.error('✗ sessions.create rejected: ' + JSON.stringify(classified.error)); failures.add(1); socket.close(); }
        }
        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) { evidence.dispatch_accepted = true; evidence.dispatch_accepted_at_ms = Date.now(); if (classified.payload?.traceId) evidence.trace_id = classified.payload.traceId; console.log('✓ sessions.send accepted — chained model parent turn triggered'); }
          else { console.error('✗ sessions.send rejected: ' + JSON.stringify(classified.error)); failures.add(1); }
        }
        if (observed) {
          const history = observer.handle(observed, classified);
          if (observed.purpose === 'served-child') {
            if (history) onServedHistory(history);
            else { served.inFlight = false; if (!observer.state.refusal) requestServed(2000); }
          }
          observeDepthLineage(socket);
        }
        if (classified.kind === 'response' && classified.method === 'sessions.describe') {
          depth2MetadataInFlight = false;
          const child = classified.payload?.session || null;
          if (child && (!child.key || child.key === evidence.depth_2_child_session_key)) {
            evidence.depth_2_session_metadata_observed = true;
            evidence.depth_2_selected_model_byte = modelFromSessionMetadata(child);
            evidence.depth_2_selected_model_source = 'gateway sessions.describe persisted model selection (depth-2 child; not a served receipt)';
            evidence.depth_2_active_fallback = activeFallbackFromSessionMetadata(child);
            evidence.depth_2_session_metadata = { key: child.key || null, provider: child.modelProvider || child.provider || null, model: child.model || null, modelSelectionLocked: child.modelSelectionLocked === true };
            console.log('✓ depth-2 child session metadata observed');
          } else if (!classified.ok) {
            evidence.model_classification_reason = 'gateway sessions.describe unavailable while resolving depth-2 child metadata';
          } else requestDepth2Metadata(socket, 250);
        }
        if (classified.kind === 'event') {
          const eventData = classified.data || {}; const eventStr = JSON.stringify(eventData);
          if (eventData.traceId) evidence.trace_id = eventData.traceId;
          // A bare childSessionKey on an event no longer counts as depth-1 identity.
          const eventDepth2 = childSessionKeyForTokenOnly(eventData, depth2Token, depth1Token);
          if (eventDepth2 && !evidence.event_depth_2_candidates.includes(eventDepth2)) evidence.event_depth_2_candidates.push(eventDepth2);
          observeDepthLineage(socket);
          if (eventStr.includes(rowNonce) && !eventStr.includes(HARNESS_MARKER) && evidence.dispatch_accepted && evidence.dispatch_accepted_at_ms) {
            if ((Date.now() - (evidence.dispatch_accepted_at_ms || Date.now())) < POST_DISPATCH_EVIDENCE_GATE_MS) return;
            if (eventStr.includes('MODEL-CHAINED-PARENT-SCHEDULED')) console.log('✓ parent scheduled sentinel observed');
            if (eventStr.includes(`MODEL-CHAINED-DEPTH1-SCHEDULED ${rowNonce}`)) { evidence.depth_1_child_observed = true; evidence.depth_1_scheduled_inner = true; console.log('✓ depth-1 scheduled depth-2 sentinel observed'); }
            const depth2Return = eventStr.match(new RegExp('MODEL-CHAINED-DEPTH2\\s+' + escapeRegex(rowNonce) + '\\s+MODEL\\s+([A-Za-z0-9_.\\/-]+)'));
            if (depth2Return) {
              evidence.return_payload = true;
              evidence.depth_2_self_reported_model = normalizeModel(depth2Return[1]);
              requestServed(500);
              console.log('✓ depth-2 return observed (self-report is auxiliary, not used for equality)');
            }
          }
        }
        if (evidence.return_payload && evidence.depth_2_child_session_key && !served.done) requestServed(500);
        if (evidence.dispatch_accepted && evidence.depth_1_child_observed && evidence.depth_1_scheduled_inner && evidence.depth_2_session_metadata_observed && evidence.return_payload && served.done) { console.log('All required R-CD-MODEL-CHAINED-ALT evidence gathered, closing early'); socket.close(); }
      } catch (e) { console.warn('parse error: ' + e); }
    });
    socket.on('error', (e) => { console.error('ws error: ' + (e && e.error ? e.error() : e)); failures.add(1); });
  });
  evidence.ended = new Date().toISOString(); evidence.duration_ms = Date.now() - started; duration.add(evidence.duration_ms);
  const complete = (!createDisposableSession || evidence.session_created) && evidence.dispatch_accepted && evidence.depth_1_child_observed && evidence.depth_1_scheduled_inner && evidence.depth_2_child_observed && evidence.return_payload;
  evidence.preflight = gate.result;
  Object.assign(evidence, observer.summary());
  const identity = classifyModelIdentity({
    baseline: evidence.requested_model_byte,
    selected: evidence.depth_2_selected_model_byte,
    served: evidence.depth_2_served_model_byte,
    servedConflict: evidence.depth_2_served_receipt?.conflict === true,
    activeFallback: evidence.depth_2_active_fallback,
    complete,
  });
  // A served/selection mismatch on a bound child is authoritative; an unrelated
  // later observer error does not erase it (it is recorded as observer_reason).
  const finalVerdict = failClosedVerdict(identity.verdict, { gate, observer, keepProvenFail: true });
  if (evidence.child_identity_conflict) {
    // A conflicting child identity means no FAIL or PASS is about a proven child.
    finalVerdict.verdict = 'PARTIAL-candidate';
    finalVerdict.reason = finalVerdict.reason || `child identity conflict: ${evidence.child_identity_reason || 'observer and event path disagree'}`;
  }
  evidence.observer_reason = finalVerdict.observerReason || null;
  evidence.model_matches = identity.modelMatches;
  evidence.selection_matches = identity.selectionMatches;
  evidence.model_classification_reason = finalVerdict.reason || identity.reason || evidence.model_classification_reason;
  evidence.verdict_reason = finalVerdict.reason;
  finalEvidence = { ...evidence, verdict: finalVerdict.verdict };
  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, { 'dispatch accepted': () => evidence.dispatch_accepted, 'depth-1 child observed': () => evidence.depth_1_child_observed, 'depth-1 scheduled inner': () => evidence.depth_1_scheduled_inner, 'depth-2 child observed': () => evidence.depth_2_child_observed, 'depth-2 selected model recorded': () => !!evidence.depth_2_selected_model_byte, 'depth-2 served model (run-window bound)': () => !!evidence.depth_2_served_model_byte, 'requested model served': () => evidence.model_matches, 'return payload': () => evidence.return_payload });
  if (finalVerdict.verdict !== 'PASS-candidate') failures.add(1);
  console.log('\n--- R-CD-MODEL-CHAINED-ALT EVIDENCE SUMMARY ---'); console.log(JSON.stringify(evidence, null, 2)); console.log('--- END EVIDENCE ---'); console.log('\n[R-CD-MODEL-CHAINED-ALT] VERDICT: ' + finalVerdict.verdict);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const summary = { row: 'R-CD-MODEL-CHAINED-ALT', sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset', seat: __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx', timestamp, verdict: finalEvidence?.verdict || 'PARTIAL-candidate', requestedModel: finalEvidence?.requested_model_byte || null, servedModel: finalEvidence?.depth_2_served_model_byte || null, selectedModel: finalEvidence?.depth_2_selected_model_byte || null, selectedModelSource: finalEvidence?.depth_2_selected_model_source || null, dispatchRefused: finalEvidence?.dispatch_refused || null, auxiliarySelfReport: finalEvidence?.depth_2_self_reported_model || null, classificationReason: finalEvidence?.model_classification_reason || null, metrics: { duration_ms: data.metrics.r_cd_model_chained_alt_duration?.values || null, failures: data.metrics.proof_failures?.values?.count || 0 } };
  return { stdout: '\n[R-CD-MODEL-CHAINED-ALT] Summary: ' + summary.verdict + ' | SHA: ' + summary.sha + ' | Seat: ' + summary.seat + '\n', 'r-cd-model-chained-alt-summary.json': JSON.stringify(summary, null, 2) };
}
