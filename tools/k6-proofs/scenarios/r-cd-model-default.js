/** Scenario: R-CD-MODEL-DEFAULT — default provider/model inheritance, typed tool path. */
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
import { classifyModelIdentity, modelFromSessionMetadata, normalizeModel } from '../lib/model-identity.mjs';

export const options = {
  scenarios: { r_cd_model_default: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '210s' } },
  thresholds: { proof_failures: ['count==0'], r_cd_model_default_duration: ['p(95)<180000'] },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_model_default_duration');
const manifest = loadManifestFromEnv();
const DEFAULTS = {
  sessionKey: 'main',
  seat: 'cael-dgx',
  delaySeconds: 1,
  idempotencyKeyPrefix: 'R-CD-MODEL-DEFAULT',
  // #559: no model string appears in the child task. The child reports its own
  // runtime identity as an auxiliary self-report; equality uses session metadata only.
  promptTemplate:
    'MDEF:{{nonceSuffix16}} Proof nonce {{nonce}}: reply exactly MODEL-DEFAULT-CHILD {{nonce}} MODEL <provider/model>, replacing <provider/model> with the current model identity from runtime context. Do not mutate files. Do not post to any channel.',
};
const HARNESS_MARKER = '[k6-proof-harness]';

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
  const rowNonce = nonce('R-CD-MODEL-DEFAULT');
  const inv = manifest?.invocation || {};
  const taskIdentityToken = compactTaskIdentityToken('MDEF', rowNonce);
  const childTask = renderRowTaskTemplate(DEFAULTS.promptTemplate, rowNonce);
  // Optional seat pin. When set, the parent's own session model must equal it;
  // a deliberately wrong value is the live negative control (must FAIL).
  const expectedModel = __ENV.OPENCLAW_EXPECTED_MODEL ? normalizeModel(__ENV.OPENCLAW_EXPECTED_MODEL) : null;
  const delaySeconds = Number(inv.delaySeconds ?? __ENV.OPENCLAW_DELAY_SECONDS ?? DEFAULTS.delaySeconds);
  const idPrefix = inv.idempotencyKeyPrefix || DEFAULTS.idempotencyKeyPrefix;
  if (!token) { console.error('OPENCLAW_GATEWAY_TOKEN is required'); failures.add(1); return; }
  if (manifest) { const errors = validateManifest(manifest); if (errors.length) console.warn('Manifest validation warnings: ' + errors.join('; ')); }

  const evidence = {
    row: 'R-CD-MODEL-DEFAULT',
    manifest_loaded: !!manifest,
    nonce: rowNonce,
    seat,
    requestedSessionKey,
    sessionKey,
    session_created: false,
    created_session_key: null,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(),
    expected_model_pin: expectedModel,
    dispatch_accepted: false,
    parent_scheduled_sentinel: false,
    parent_model_byte: null,
    parent_model_source: null,
    child_session_observed: false,
    child_session_key: null,
    child_session_metadata_observed: false,
    child_model_byte: null,
    child_model_source: null,
    child_self_reported_model: null,
    child_session_metadata: null,
    task_identity_token: taskIdentityToken,
    model_matches: false,
    return_payload: false,
    trace_id: null,
    model_classification_reason: null,
    redacted_events: [],
  };
  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    const describeFor = {};
    const attempts = { parent: 0, child: 0 };
    const inFlight = { parent: false, child: false };
    function describe(socket, who, key, delayMs = 1) {
      if (!key || inFlight[who] || attempts[who] >= 6) return;
      if (who === 'parent' ? evidence.parent_model_byte : evidence.child_session_metadata_observed) return;
      socket.setTimeout(() => {
        if (inFlight[who]) return;
        inFlight[who] = true;
        attempts[who] += 1;
        describeFor[tracker.send(socket, 'sessions.describe', { key })] = { who, key };
      }, delayMs);
    }
    function start(socket) {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      socket.setTimeout(() => {
        if (!childTask || !taskIdentityToken) {
          console.error('✗ model-default child task identity could not be rendered');
          failures.add(1);
          socket.close();
          return;
        }
        const instruction =
          HARNESS_MARKER + ' R-CD-MODEL-DEFAULT nonce ' + rowNonce + '. ' +
          'Call continue_delegate with task=' + JSON.stringify(childTask) +
          ', mode="normal", delaySeconds=' + delaySeconds + ', and NO model override. ' +
          'After the continue_delegate tool result reports scheduled, reply exactly ' +
          'MODEL-DEFAULT-PARENT-SCHEDULED ' + rowNonce + '. No other action.';
        tracker.send(socket, 'sessions.send', { key: sessionKey, message: instruction, idempotencyKey: idPrefix + '-DISPATCH-' + rowNonce });
      }, 500);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 50 }), 5000);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 50 }), 15000);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 50 }), 30000);
      socket.setTimeout(() => socket.close(), 180000);
    }
    function observeChildKey(socket, key) {
      if (!key || evidence.child_session_key) return;
      evidence.child_session_observed = true;
      evidence.child_session_key = key;
      describe(socket, 'child', key);
    }
    socket.on('open', () => {
      socket.send(connectFrame(token));
      if (createDisposableSession) {
        socket.setTimeout(() => {
          const key = ('r-cd-model-default-' + rowNonce).toLowerCase().replace(/[^a-z0-9-]/g, '-');
          tracker.send(socket, 'sessions.create', { key, label: 'k6 R-CD-MODEL-DEFAULT ' + rowNonce });
        }, 250);
      } else socket.setTimeout(() => start(socket), 500);
    });
    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        const describeTarget = msg && msg.type === 'res' ? describeFor[msg.id] : undefined;
        const classified = tracker.classify(msg);
        evidence.redacted_events.push({ ts: Date.now(), kind: classified.kind, method: classified.method || null, event: classified.event || null, ok: classified.ok !== undefined ? classified.ok : null, data: classified.payload ? redactEvent(classified.payload) : null });
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
            console.log('✓ sessions.send accepted — default model delegate turn triggered');
          } else { console.error('✗ sessions.send rejected: ' + JSON.stringify(classified.error)); failures.add(1); }
        }
        if (classified.kind === 'response' && classified.method === 'tasks.list') {
          observeChildKey(socket, childSessionKeyForRow(classified.payload, rowNonce, [taskIdentityToken]));
        }
        if (classified.kind === 'response' && classified.method === 'sessions.describe' && describeTarget) {
          const { who, key } = describeTarget;
          inFlight[who] = false;
          const session = classified.payload?.session || null;
          // A describe answer only counts for the key it was asked about.
          if (session && (!session.key || session.key === key)) {
            const model = modelFromSessionMetadata(session);
            if (who === 'parent') {
              evidence.parent_model_byte = model;
              evidence.parent_model_source = 'gateway sessions.describe persisted provider/model metadata (parent, after its turn)';
              if (!model) describe(socket, 'parent', key, 500);
            } else {
              evidence.child_session_metadata_observed = true;
              evidence.child_model_byte = model;
              evidence.child_model_source = 'gateway sessions.describe persisted provider/model metadata (child)';
              evidence.child_session_metadata = {
                key: session.key || null,
                provider: session.modelProvider || session.provider || null,
                model: session.model || null,
                modelSelectionLocked: session.modelSelectionLocked === true,
              };
            }
            console.log('✓ ' + who + ' session metadata observed');
          } else if (!classified.ok) {
            evidence.model_classification_reason = 'gateway sessions.describe unavailable for the ' + who + ' session';
          } else {
            describe(socket, who, key, 250);
          }
        }
        if (classified.kind === 'event') {
          const eventData = classified.data || {}; const eventStr = JSON.stringify(eventData);
          if (eventData.traceId) evidence.trace_id = eventData.traceId;
          observeChildKey(socket, childSessionKeyForRow(eventData, rowNonce, taskIdentityToken ? [taskIdentityToken] : []));
          if (eventStr.includes(rowNonce) && !eventStr.includes(HARNESS_MARKER)) {
            if (eventStr.includes('MODEL-DEFAULT-PARENT-SCHEDULED ' + rowNonce) && !evidence.parent_scheduled_sentinel) {
              evidence.parent_scheduled_sentinel = true;
              console.log('✓ parent scheduled sentinel observed');
              // The parent's turn has run, so its session now carries the model that served it.
              describe(socket, 'parent', sessionKey, 250);
            }
            const childMatch = eventStr.match(new RegExp('MODEL-DEFAULT-CHILD\\s+' + escapeRegex(rowNonce) + '\\s+MODEL\\s+([A-Za-z0-9_.\\/-]+)'));
            if (childMatch) {
              evidence.return_payload = true;
              evidence.child_self_reported_model = normalizeModel(childMatch[1]);
              console.log('✓ MODEL-DEFAULT-CHILD return payload observed (self-report is auxiliary, not used for equality)');
            }
          }
        }
        if (evidence.dispatch_accepted && evidence.parent_model_byte && evidence.child_session_metadata_observed && evidence.return_payload) {
          console.log('R-CD-MODEL-DEFAULT evidence gathered, closing early');
          socket.close();
        }
      } catch (e) { console.warn('parse error: ' + e); }
    });
    socket.on('error', (e) => { console.error('ws error: ' + (e && e.error ? e.error() : e)); failures.add(1); });
  });

  evidence.ended = new Date().toISOString(); evidence.duration_ms = Date.now() - started; duration.add(evidence.duration_ms);
  const complete = (!createDisposableSession || evidence.session_created) && evidence.dispatch_accepted && evidence.parent_scheduled_sentinel && evidence.child_session_observed && evidence.return_payload;
  const identity = classifyModelIdentity({ baseline: evidence.parent_model_byte, observed: evidence.child_model_byte, expected: expectedModel, complete });
  evidence.model_matches = identity.modelMatches;
  evidence.model_classification_reason = identity.reason || evidence.model_classification_reason;
  finalEvidence = { ...evidence, verdict: identity.verdict };
  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'dispatch accepted': () => evidence.dispatch_accepted,
    'parent scheduled sentinel': () => evidence.parent_scheduled_sentinel,
    'authoritative parent-session model byte': () => !!evidence.parent_model_byte,
    'child session observed': () => evidence.child_session_observed,
    'authoritative child-session model byte': () => !!evidence.child_model_byte,
    'child model matches parent': () => evidence.model_matches,
    'return payload': () => evidence.return_payload,
  });
  if (identity.verdict !== 'PASS-candidate') failures.add(1);
  console.log('\n--- R-CD-MODEL-DEFAULT EVIDENCE SUMMARY ---'); console.log(JSON.stringify(evidence, null, 2)); console.log('--- END EVIDENCE ---'); console.log('\n[R-CD-MODEL-DEFAULT] VERDICT: ' + identity.verdict);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const summary = {
    row: 'R-CD-MODEL-DEFAULT',
    sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    seat: __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx',
    timestamp,
    verdict: finalEvidence?.verdict || 'PARTIAL-candidate',
    parentModel: finalEvidence?.parent_model_byte || null,
    childModel: finalEvidence?.child_model_byte || null,
    modelSource: 'sessions.describe metadata (parent and child)',
    expectedModelPin: finalEvidence?.expected_model_pin || null,
    auxiliarySelfReport: finalEvidence?.child_self_reported_model || null,
    classificationReason: finalEvidence?.model_classification_reason || null,
    metrics: { duration_ms: data.metrics.r_cd_model_default_duration?.values || null, failures: data.metrics.proof_failures?.values?.count || 0 },
  };
  return { stdout: '\n[R-CD-MODEL-DEFAULT] Summary: ' + summary.verdict + ' | SHA: ' + summary.sha + ' | Seat: ' + summary.seat + '\n', 'r-cd-model-default-summary.json': JSON.stringify(summary, null, 2) };
}
