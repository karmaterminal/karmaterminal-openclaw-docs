/** Scenario: R-CD-MODEL-TOOL — explicit model override on typed continue_delegate. */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import {
  childSessionKeyForRow,
  compactTaskIdentityToken,
  renderRowTaskTemplate,
} from '../lib/row-child-correlation.mjs';
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
  scenarios: { r_cd_model_tool: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '210s' } },
  thresholds: { proof_failures: ['count==0'], r_cd_model_tool_duration: ['p(95)<180000'] },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_model_tool_duration');
const manifest = loadManifestFromEnv();
const DEFAULTS = {
  sessionKey: 'main',
  seat: 'cael-dgx',
  delaySeconds: 1,
  idempotencyKeyPrefix: 'R-CD-MODEL-TOOL',
  promptTemplate:
    'MTOOL:{{nonceSuffix16}} Proof nonce {{nonce}}: reply exactly MODEL-TOOL-CHILD {{nonce}} MODEL <provider/model>, replacing <provider/model> with the current model identity from runtime context. The requested model is intentionally omitted from the child task to prevent echo-based false PASS. Do not mutate files. Do not post to any channel.',
};
const HARNESS_MARKER = '[k6-proof-harness]';
// Re-read the served transcript until the sentinel binds; bounded and recorded.
const SERVED_HISTORY_MAX_ATTEMPTS = 15;

function boolEnv(name) { return (__ENV[name] || '').toLowerCase() === 'true'; }
function escapeRegex(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
let finalEvidence = null;

export default function() {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const requestedSessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || DEFAULTS.sessionKey;
  let sessionKey = requestedSessionKey;
  const createDisposableSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION') || boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSIONS');
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || DEFAULTS.seat;
  const rowNonce = nonce('R-CD-MODEL-TOOL');
  const inv = manifest?.invocation || {};
  const taskIdentityToken = compactTaskIdentityToken('MTOOL', rowNonce);
  const childTask = renderRowTaskTemplate(inv.promptTemplate || DEFAULTS.promptTemplate, rowNonce);
  // #563 item 5: no built-in default. Unset or a bare alias refuses before
  // dispatch (aliases resolve per seat and cannot be compared byte-for-byte).
  const requested = resolveRequestedModel(__ENV.OPENCLAW_ALT_MODEL, inv.model);
  const requestedModel = requested.model;
  const delaySeconds = Number(inv.delaySeconds ?? __ENV.OPENCLAW_DELAY_SECONDS ?? DEFAULTS.delaySeconds);
  const idPrefix = inv.idempotencyKeyPrefix || DEFAULTS.idempotencyKeyPrefix;
  if (!token) { console.error('OPENCLAW_GATEWAY_TOKEN is required'); failures.add(1); return; }
  if (manifest) { const errors = validateManifest(manifest); if (errors.length) console.warn('Manifest validation warnings: ' + errors.join('; ')); }

  const evidence = {
    row: 'R-CD-MODEL-TOOL',
    manifest_loaded: !!manifest,
    nonce: rowNonce,
    seat,
    requestedSessionKey,
    sessionKey,
    session_created: false,
    created_session_key: null,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(),
    requested_model_byte: requestedModel,
    dispatch_refused: null,
    requested_model_source: 'continue_delegate.model parameter',
    dispatch_accepted: false,
    parent_scheduled_sentinel: false,
    child_session_observed: false,
    child_session_key: null,
    child_session_metadata_observed: false,
    // Selection (sessions.describe) and run-window SERVED model (chat.history)
    // are separate (#561 review).
    child_selected_model_byte: null,
    child_selected_model_source: null,
    child_active_fallback: null,
    child_served_model_byte: null,
    child_served_receipt: null,
    selection_matches: false,
    child_self_reported_model: null,
    child_self_reported_model_source: null,
    child_session_metadata: null,
    child_metadata_requested: false,
    task_identity_token: taskIdentityToken,
    event_child_candidates: [],
    child_identity_conflict: false,
    child_identity_reason: null,
    model_matches: false,
    return_payload: false,
    trace_id: null,
    model_classification_reason: null,
    preflight: null,
    observation_refused: null,
    verdict_reason: null,
    redacted_events: [],
  };
  const started = Date.now();
  const gate = createPreflightGate('R-CD-MODEL-TOOL');
  const observer = createChildObserver({ rootSessionKey: () => sessionKey });

  if (requested.refusal || !taskIdentityToken || !childTask) {
    // Refuse before dispatch: nothing is sent and no attempt is spent.
    evidence.dispatch_refused = requested.refusal || 'row task identity could not be rendered';
    evidence.model_classification_reason = evidence.dispatch_refused;
    evidence.verdict_reason = 'refused before dispatch: ' + evidence.dispatch_refused;
    evidence.ended = new Date().toISOString(); evidence.duration_ms = Date.now() - started; duration.add(evidence.duration_ms);
    evidence.verdict = 'PARTIAL-candidate';
    finalEvidence = evidence;
    failures.add(1);
    console.error('✗ R-CD-MODEL-TOOL refused before dispatch: ' + evidence.dispatch_refused);
    console.log('\n--- R-CD-MODEL-TOOL EVIDENCE SUMMARY ---'); console.log(JSON.stringify(evidence, null, 2)); console.log('--- END EVIDENCE ---'); console.log('\n[R-CD-MODEL-TOOL] VERDICT: PARTIAL-candidate');
    return;
  }
  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    let childMetadataAttempts = 0;
    let childMetadataRequestInFlight = false;
    function requestChildMetadata(socket, delayMs = 1) {
      if (!evidence.child_session_key || childMetadataRequestInFlight || evidence.child_session_metadata_observed) return;
      socket.setTimeout(() => {
        if (!evidence.child_session_key || childMetadataRequestInFlight || evidence.child_session_metadata_observed) return;
        childMetadataRequestInFlight = true;
        childMetadataAttempts += 1;
        evidence.child_metadata_requested = true;
        tracker.send(socket, 'sessions.describe', { key: evidence.child_session_key });
      }, k6TimeoutMs(delayMs));
    }
    // #563 item 2: only the observer binding binds; event candidates cross-check.
    function resolveChild(socket) {
      const identity = reconcileChildIdentity({
        observerBinding: observer.boundChild(rowNonce, [taskIdentityToken]),
        eventCandidates: evidence.event_child_candidates,
      });
      evidence.child_identity_reason = identity.reason;
      if (identity.conflict) { evidence.child_identity_conflict = true; return; }
      const key = identity.childSessionKey;
      if (!key || evidence.child_identity_conflict) return;
      if (evidence.child_session_key && evidence.child_session_key !== key) { evidence.child_identity_conflict = true; return; }
      if (evidence.child_session_key) return;
      evidence.child_session_observed = true;
      evidence.child_session_key = key;
      requestChildMetadata(socket);
    }
    const served = { attempts: 0, inFlight: false, done: false };
    function requestServed(delayMs) {
      if (!evidence.child_session_key || served.done || served.inFlight || served.attempts >= SERVED_HISTORY_MAX_ATTEMPTS) return;
      served.inFlight = true;
      socket.setTimeout(() => {
        served.attempts += 1;
        evidence.child_served_history_attempts = served.attempts;
        if (!observer.refreshHistory(evidence.child_session_key, 100, 'served-child')) served.inFlight = false;
      }, k6TimeoutMs(delayMs));
    }
    function onServedHistory(messages) {
      served.inFlight = false;
      const receipt = servedReceiptFromHistory(messages, { anchor: taskIdentityToken, sentinel: 'MODEL-TOOL-CHILD ' + rowNonce });
      evidence.child_served_receipt = receipt;
      evidence.child_served_model_byte = receipt.served;
      if (receipt.served || receipt.conflict) { served.done = true; return; }
      requestServed(2000);
    }
    function start(socket) {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      socket.setTimeout(() => {
        // Deliberately do NOT include requestedModel in the child task. The child
        // must report its own runtime identity instead of echoing the request.
        if (!childTask || !taskIdentityToken) {
          console.error('✗ model-tool child task identity could not be rendered');
          failures.add(1);
          socket.close();
          return;
        }
        const instruction =
          HARNESS_MARKER + ' R-CD-MODEL-TOOL nonce ' + rowNonce + '. ' +
          'Call continue_delegate with task=' + JSON.stringify(childTask) +
          ', mode="normal", delaySeconds=' + delaySeconds +
          ', model=' + JSON.stringify(requestedModel) + '. ' +
          'After the continue_delegate tool result reports scheduled, reply exactly ' +
          'MODEL-TOOL-PARENT-SCHEDULED ' + rowNonce + ' REQUESTED ' + requestedModel + '. No other action.';
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message: instruction,
          idempotencyKey: idPrefix + '-DISPATCH-' + rowNonce,
        });
      }, 500);
      for (const delayMs of [5000, 15000, 30000, 60000]) socket.setTimeout(() => observer.poll(), delayMs);
      socket.setTimeout(() => socket.close(), 180000);
    }
    function afterHello(socket) {
      if (createDisposableSession) {
        socket.setTimeout(() => {
          const key = ('r-cd-model-tool-' + rowNonce).toLowerCase().replace(/[^a-z0-9-]/g, '-');
          tracker.send(socket, 'sessions.create', { key, label: 'k6 R-CD-MODEL-TOOL ' + rowNonce });
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
          console.error('✗ R-CD-MODEL-TOOL preflight refused before dispatch: ' + gate.result.reason);
          socket.close();
          return;
        }
        if (preflight === 'ready') afterHello(socket);
        const observed = observer.claim(msg);
        const classified = tracker.classify(msg);
        evidence.redacted_events.push({
          ts: Date.now(),
          kind: classified.kind,
          method: classified.method || null,
          event: classified.event || null,
          ok: classified.ok !== undefined ? classified.ok : null,
          data: classified.payload ? redactEvent(classified.payload) : null,
        });
        if (classified.kind === 'response' && classified.method === 'sessions.create') {
          if (classified.ok && classified.payload) {
            sessionKey = classified.payload.key || sessionKey;
            evidence.sessionKey = sessionKey;
            evidence.session_created = true;
            evidence.created_session_key = sessionKey;
            console.log('✓ disposable session created: ' + sessionKey);
            start(socket);
          } else { console.error('✗ sessions.create rejected: ' + JSON.stringify(classified.error)); failures.add(1); socket.close(); }
        }
        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) {
            evidence.dispatch_accepted = true;
            if (classified.payload?.traceId) evidence.trace_id = classified.payload.traceId;
            console.log('✓ sessions.send accepted — explicit model delegate turn triggered');
          } else { console.error('✗ sessions.send rejected: ' + JSON.stringify(classified.error)); failures.add(1); }
        }
        if (observed) {
          const history = observer.handle(observed, classified);
          if (observed.purpose === 'served-child') {
            if (history) onServedHistory(history);
            else { served.inFlight = false; if (!observer.state.refusal) requestServed(2000); }
          }
          // #562: the child's own row names this session in spawnedBy and its own
          // spawn task carries the nonce or the MTOOL token.
          resolveChild(socket);
        }
        if (classified.kind === 'response' && classified.method === 'sessions.describe') {
          childMetadataRequestInFlight = false;
          const child = classified.payload?.session || null;
          // A describe answer only counts for the key it was asked about.
          if (child && (!child.key || child.key === evidence.child_session_key)) {
            evidence.child_session_observed = true;
            evidence.child_session_metadata_observed = true;
            evidence.child_selected_model_byte = modelFromSessionMetadata(child);
            evidence.child_selected_model_source = 'gateway sessions.describe persisted model selection (not a served receipt)';
            evidence.child_active_fallback = activeFallbackFromSessionMetadata(child);
            evidence.child_session_metadata = {
              key: child.key || null,
              provider: child.modelProvider || child.provider || null,
              model: child.model || null,
              modelSelectionLocked: child.modelSelectionLocked === true,
            };
            console.log('✓ child session selection observed');
          } else if (!classified.ok) {
            evidence.model_classification_reason =
              'gateway sessions.describe unavailable while resolving child session metadata';
          } else if (childMetadataAttempts < 6) {
            requestChildMetadata(socket, 250);
          }
        }
        if (classified.kind === 'event') {
          const eventData = classified.data || {}; const eventStr = JSON.stringify(eventData);
          if (eventData.traceId) evidence.trace_id = eventData.traceId;
          const eventBelongsToRow = eventStr.includes(rowNonce);
          const eventChild = childSessionKeyForRow(
            eventData,
            rowNonce,
            taskIdentityToken ? [taskIdentityToken] : [],
          );
          if (eventChild && !evidence.event_child_candidates.includes(eventChild)) {
            evidence.event_child_candidates.push(eventChild);
            resolveChild(socket);
          }
          if (eventBelongsToRow && !eventStr.includes(HARNESS_MARKER)) {
            if (eventStr.includes('MODEL-TOOL-PARENT-SCHEDULED')) {
              evidence.parent_scheduled_sentinel = true;
              console.log('✓ parent scheduled sentinel observed');
            }
            const childMatch = eventStr.match(new RegExp('MODEL-TOOL-CHILD\\s+' + escapeRegex(rowNonce) + '\\s+MODEL\\s+([A-Za-z0-9_.\\/-]+)'));
            if (childMatch) {
              evidence.return_payload = true;
              evidence.child_self_reported_model = normalizeModel(childMatch[1]);
              evidence.child_self_reported_model_source = 'auxiliary child runtime-context self-report (not used for equality)';
              requestServed(500);
              console.log('✓ MODEL-TOOL-CHILD return payload observed');
            }
          }
        }
        if (evidence.return_payload && evidence.child_session_key && !served.done) requestServed(500);
        if (evidence.dispatch_accepted && evidence.child_session_metadata_observed && evidence.return_payload && served.done) {
          console.log('R-CD-MODEL-TOOL return gathered, closing early');
          socket.close();
        }
      } catch (e) { console.warn('parse error: ' + e); }
    });
    socket.on('error', (e) => { console.error('ws error: ' + (e && e.error ? e.error() : e)); failures.add(1); });
  });

  evidence.ended = new Date().toISOString(); evidence.duration_ms = Date.now() - started; duration.add(evidence.duration_ms);
  evidence.preflight = gate.result;
  Object.assign(evidence, observer.summary());
  finalEvidence = evidence;
  const complete = (!createDisposableSession || evidence.session_created) && evidence.dispatch_accepted && evidence.parent_scheduled_sentinel && evidence.child_session_metadata_observed && evidence.return_payload;
  const identity = classifyModelIdentity({
    baseline: requestedModel,
    selected: evidence.child_selected_model_byte,
    served: evidence.child_served_model_byte,
    servedConflict: evidence.child_served_receipt?.conflict === true,
    activeFallback: evidence.child_active_fallback,
    complete,
  });
  evidence.model_matches = identity.modelMatches;
  evidence.selection_matches = identity.selectionMatches;
  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'dispatch accepted': () => evidence.dispatch_accepted,
    'parent scheduled sentinel': () => evidence.parent_scheduled_sentinel,
    'child session observed': () => evidence.child_session_observed,
    'child selected model recorded': () => !!evidence.child_selected_model_byte,
    'child served model (run-window bound)': () => !!evidence.child_served_model_byte,
    'return payload': () => evidence.return_payload,
    'requested model served': () => evidence.model_matches,
  });
  // FAIL needs authoritative evidence (served or selection mismatch, active
  // fallback, mixed served window); selection alone is PARTIAL, never PASS.
  const finalVerdict = failClosedVerdict(identity.verdict, { gate, observer, keepProvenFail: true });
  if (evidence.child_identity_conflict) {
    // A conflicting child identity means no FAIL or PASS is about a proven child.
    finalVerdict.verdict = 'PARTIAL-candidate';
    finalVerdict.reason = finalVerdict.reason || `child identity conflict: ${evidence.child_identity_reason || 'observer and event path disagree'}`;
  }
  evidence.observer_reason = finalVerdict.observerReason || null;
  const verdict = finalVerdict.verdict;
  evidence.verdict_reason = finalVerdict.reason;
  evidence.model_classification_reason = finalVerdict.reason || identity.reason || evidence.model_classification_reason;
  evidence.verdict = verdict;
  if (verdict !== 'PASS-candidate') failures.add(1);
  console.log('\n--- R-CD-MODEL-TOOL EVIDENCE SUMMARY ---'); console.log(JSON.stringify(evidence, null, 2)); console.log('--- END EVIDENCE ---'); console.log('\n[R-CD-MODEL-TOOL] VERDICT: ' + verdict);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const failuresCount = data.metrics.proof_failures?.values?.count || 0;
  // The default function's fail-closed verdict is the only verdict; without it the row is PARTIAL.
  const verdict = finalEvidence?.verdict || 'PARTIAL-candidate';
  const summary = { row: 'R-CD-MODEL-TOOL', sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset', seat: __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx', timestamp, verdict, requestedModel: finalEvidence?.requested_model_byte || __ENV.OPENCLAW_ALT_MODEL || null, servedModel: finalEvidence?.child_served_model_byte || null, selectedModel: finalEvidence?.child_selected_model_byte || null, selectedModelSource: finalEvidence?.child_selected_model_source || null, dispatchRefused: finalEvidence?.dispatch_refused || null, auxiliarySelfReport: finalEvidence?.child_self_reported_model || null, classificationReason: finalEvidence?.model_classification_reason || null, metrics: { duration_ms: data.metrics.r_cd_model_tool_duration?.values || null, failures: failuresCount } };
  return { stdout: '\n[R-CD-MODEL-TOOL] Summary: ' + summary.verdict + ' | SHA: ' + summary.sha + ' | Seat: ' + summary.seat + '\n', 'r-cd-model-tool-summary.json': JSON.stringify(summary, null, 2) };
}
