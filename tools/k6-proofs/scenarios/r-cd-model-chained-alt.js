/** Scenario: R-CD-MODEL-CHAINED-ALT — depth-1 delegate spawns depth-2 with explicit model override. */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import { childSessionKeyForTokenOnly, compactTaskIdentityToken } from '../lib/row-child-correlation.mjs';
import {
  classifyModelIdentity,
  modelFromSessionMetadata,
  normalizeModel,
  resolveRequestedModel,
} from '../lib/model-identity.mjs';

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
    depth_2_model_byte: null, depth_2_model_source: null, depth_2_self_reported_model: null, depth_2_session_metadata: null,
    depth_1_token: depth1Token, depth_2_token: depth2Token, model_matches: false,
    return_payload: false, trace_id: null, model_classification_reason: null, redacted_events: [],
  };
  const started = Date.now();
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
      }, delayMs);
    }
    function observeDepth2Child(socket, payload) {
      const key = childSessionKeyForTokenOnly(payload, depth2Token, depth1Token);
      if (!key || evidence.depth_2_child_session_key) return;
      evidence.depth_2_child_observed = true;
      evidence.depth_2_child_session_key = key;
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
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 50 }), 20000);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 50 }), 45000);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 50 }), 90000);
      socket.setTimeout(() => socket.close(), 220000);
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));
      if (createDisposableSession) {
        socket.setTimeout(() => {
          const key = `r-cd-model-chain-${rowNonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          tracker.send(socket, 'sessions.create', { key, label: `k6 R-CD-MODEL-CHAINED-ALT ${rowNonce}` });
        }, 250);
      } else socket.setTimeout(() => start(socket), 500);
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw); const classified = tracker.classify(msg);
        evidence.redacted_events.push({ ts: Date.now(), kind: classified.kind, method: classified.method || null, event: classified.event || null, ok: classified.ok !== undefined ? classified.ok : null, data: classified.payload ? redactEvent(classified.payload) : null });
        if (classified.kind === 'response' && classified.method === 'sessions.create') {
          if (classified.ok && classified.payload) { sessionKey = classified.payload.key || sessionKey; evidence.sessionKey = sessionKey; evidence.session_created = true; evidence.created_session_key = sessionKey; console.log('✓ disposable session created: ' + sessionKey); start(socket); }
          else { console.error('✗ sessions.create rejected: ' + JSON.stringify(classified.error)); failures.add(1); socket.close(); }
        }
        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) { evidence.dispatch_accepted = true; evidence.dispatch_accepted_at_ms = Date.now(); if (classified.payload?.traceId) evidence.trace_id = classified.payload.traceId; console.log('✓ sessions.send accepted — chained model parent turn triggered'); }
          else { console.error('✗ sessions.send rejected: ' + JSON.stringify(classified.error)); failures.add(1); }
        }
        if (classified.kind === 'response' && classified.method === 'tasks.list') observeDepth2Child(socket, classified.payload);
        if (classified.kind === 'response' && classified.method === 'sessions.describe') {
          depth2MetadataInFlight = false;
          const child = classified.payload?.session || null;
          if (child && (!child.key || child.key === evidence.depth_2_child_session_key)) {
            evidence.depth_2_session_metadata_observed = true;
            evidence.depth_2_model_byte = modelFromSessionMetadata(child);
            evidence.depth_2_model_source = 'gateway sessions.describe persisted provider/model metadata (depth-2 child)';
            evidence.depth_2_session_metadata = { key: child.key || null, provider: child.modelProvider || child.provider || null, model: child.model || null, modelSelectionLocked: child.modelSelectionLocked === true };
            console.log('✓ depth-2 child session metadata observed');
          } else if (!classified.ok) {
            evidence.model_classification_reason = 'gateway sessions.describe unavailable while resolving depth-2 child metadata';
          } else requestDepth2Metadata(socket, 250);
        }
        if (classified.kind === 'event') {
          const eventData = classified.data || {}; const eventStr = JSON.stringify(eventData);
          if (eventData.traceId) evidence.trace_id = eventData.traceId;
          if (eventData.childSessionKey) evidence.depth_1_child_observed = true;
          observeDepth2Child(socket, eventData);
          if (eventStr.includes(rowNonce) && !eventStr.includes(HARNESS_MARKER) && evidence.dispatch_accepted && evidence.dispatch_accepted_at_ms) {
            if ((Date.now() - (evidence.dispatch_accepted_at_ms || Date.now())) < POST_DISPATCH_EVIDENCE_GATE_MS) return;
            if (eventStr.includes('MODEL-CHAINED-PARENT-SCHEDULED')) console.log('✓ parent scheduled sentinel observed');
            if (eventStr.includes(`MODEL-CHAINED-DEPTH1-SCHEDULED ${rowNonce}`)) { evidence.depth_1_child_observed = true; evidence.depth_1_scheduled_inner = true; console.log('✓ depth-1 scheduled depth-2 sentinel observed'); }
            const depth2Return = eventStr.match(new RegExp('MODEL-CHAINED-DEPTH2\\s+' + escapeRegex(rowNonce) + '\\s+MODEL\\s+([A-Za-z0-9_.\\/-]+)'));
            if (depth2Return) {
              evidence.return_payload = true;
              evidence.depth_2_self_reported_model = normalizeModel(depth2Return[1]);
              console.log('✓ depth-2 return observed (self-report is auxiliary, not used for equality)');
            }
          }
        }
        if (evidence.dispatch_accepted && evidence.depth_1_child_observed && evidence.depth_1_scheduled_inner && evidence.depth_2_session_metadata_observed && evidence.return_payload) { console.log('All required R-CD-MODEL-CHAINED-ALT evidence gathered, closing early'); socket.close(); }
      } catch (e) { console.warn('parse error: ' + e); }
    });
    socket.on('error', (e) => { console.error('ws error: ' + (e && e.error ? e.error() : e)); failures.add(1); });
  });
  evidence.ended = new Date().toISOString(); evidence.duration_ms = Date.now() - started; duration.add(evidence.duration_ms);
  const complete = (!createDisposableSession || evidence.session_created) && evidence.dispatch_accepted && evidence.depth_1_child_observed && evidence.depth_1_scheduled_inner && evidence.depth_2_child_observed && evidence.return_payload;
  const identity = classifyModelIdentity({ baseline: evidence.requested_model_byte, observed: evidence.depth_2_model_byte, complete });
  evidence.model_matches = identity.modelMatches;
  evidence.model_classification_reason = identity.reason || evidence.model_classification_reason;
  finalEvidence = { ...evidence, verdict: identity.verdict };
  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, { 'dispatch accepted': () => evidence.dispatch_accepted, 'depth-1 child observed': () => evidence.depth_1_child_observed, 'depth-1 scheduled inner': () => evidence.depth_1_scheduled_inner, 'depth-2 child observed': () => evidence.depth_2_child_observed, 'authoritative depth-2 model byte': () => !!evidence.depth_2_model_byte, 'requested model observed': () => evidence.model_matches, 'return payload': () => evidence.return_payload });
  if (identity.verdict !== 'PASS-candidate') failures.add(1);
  console.log('\n--- R-CD-MODEL-CHAINED-ALT EVIDENCE SUMMARY ---'); console.log(JSON.stringify(evidence, null, 2)); console.log('--- END EVIDENCE ---'); console.log('\n[R-CD-MODEL-CHAINED-ALT] VERDICT: ' + identity.verdict);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const summary = { row: 'R-CD-MODEL-CHAINED-ALT', sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset', seat: __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx', timestamp, verdict: finalEvidence?.verdict || 'PARTIAL-candidate', requestedModel: finalEvidence?.requested_model_byte || null, observedModel: finalEvidence?.depth_2_model_byte || null, observedModelSource: finalEvidence?.depth_2_model_source || null, dispatchRefused: finalEvidence?.dispatch_refused || null, auxiliarySelfReport: finalEvidence?.depth_2_self_reported_model || null, classificationReason: finalEvidence?.model_classification_reason || null, metrics: { duration_ms: data.metrics.r_cd_model_chained_alt_duration?.values || null, failures: data.metrics.proof_failures?.values?.count || 0 } };
  return { stdout: '\n[R-CD-MODEL-CHAINED-ALT] Summary: ' + summary.verdict + ' | SHA: ' + summary.sha + ' | Seat: ' + summary.seat + '\n', 'r-cd-model-chained-alt-summary.json': JSON.stringify(summary, null, 2) };
}
