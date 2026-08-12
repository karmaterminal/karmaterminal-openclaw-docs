/** Scenario: R-CD-MODEL-TOOL — explicit model override on typed continue_delegate. */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import {
  parentReturnContainsNonce,
  resolveModelToolChildAuthority,
  sessionKeysFromListPayload,
} from '../lib/r-cd-model-tool-authority.mjs';

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
  requestedModel: 'openai/gpt-5.6-luna',
};
const HARNESS_MARKER = '[k6-proof-harness]';

function boolEnv(name) { return (__ENV[name] || '').toLowerCase() === 'true'; }
function normalizeModel(value) { return String(value || '').trim().replace(/[.,;:]+$/, ''); }
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
  const requestedModel = normalizeModel(__ENV.OPENCLAW_ALT_MODEL || inv.model || DEFAULTS.requestedModel);
  const delaySeconds = Number(inv.delaySeconds ?? __ENV.OPENCLAW_DELAY_SECONDS ?? DEFAULTS.delaySeconds);
  const idPrefix = inv.idempotencyKeyPrefix || DEFAULTS.idempotencyKeyPrefix;
  if (!token) { console.error('OPENCLAW_GATEWAY_TOKEN is required'); failures.add(1); return; }
  // Disposable parent is mandatory so spawnedBy set-diff is unambiguous.
  if (!createDisposableSession) {
    console.error('OPENCLAW_CREATE_DISPOSABLE_SESSION=true is required for R-CD-MODEL-TOOL');
    failures.add(1);
    return;
  }
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
    disposable_parent_required: true,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(),
    requested_model_byte: requestedModel,
    requested_model_source: 'continue_delegate.model parameter',
    pre_spawned_by_keys: [],
    post_spawned_by_keys: [],
    pre_spawned_by_captured: false,
    post_spawned_by_captured: false,
    spawned_by_diff_empty: false,
    spawned_by_diff_ambiguous: false,
    dispatch_accepted: false,
    parent_scheduled_sentinel: false,
    parent_return_nonce_bound: false,
    child_session_observed: false,
    child_session_key: null,
    child_session_metadata_observed: false,
    child_metadata_model_byte: null,
    child_metadata_model_source: null,
    child_self_reported_model: null,
    child_self_reported_model_source: null,
    child_session_metadata: null,
    child_metadata_requested: false,
    model_matches: false,
    return_payload: false,
    trace_id: null,
    model_classification_reason: null,
    redacted_events: [],
  };
  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    let listPhase = null; // 'pre' | 'post' | 'parent-history'
    let postListPolls = 0;
    let parentHistoryPolls = 0;

    function requestSpawnedByList(phase) {
      listPhase = phase;
      evidence.child_metadata_requested = true;
      tracker.send(socket, 'sessions.list', { spawnedBy: sessionKey, limit: 100 });
    }

    function requestParentHistory() {
      listPhase = 'parent-history';
      tracker.send(socket, 'sessions.get', { key: sessionKey, limit: 200 });
    }

    function applyChildAuthority(payload) {
      const authority = resolveModelToolChildAuthority({
        preKeys: evidence.pre_spawned_by_keys,
        postKeys: sessionKeysFromListPayload(payload),
        sessionsPayload: payload,
        requestedModel,
      });
      evidence.post_spawned_by_keys = sessionKeysFromListPayload(payload);
      evidence.post_spawned_by_captured = true;
      evidence.spawned_by_diff_empty = authority.empty;
      evidence.spawned_by_diff_ambiguous = authority.ambiguous;
      if (authority.uniqueNewChildKey) {
        evidence.child_session_key = authority.uniqueNewChildKey;
        evidence.child_session_observed = true;
        evidence.child_session_metadata_observed = !!authority.childMetadataModelByte;
        evidence.child_metadata_model_byte = authority.childMetadataModelByte;
        evidence.child_metadata_model_source = 'gateway sessions.list spawnedBy set-diff provider/model metadata';
        evidence.child_session_metadata = {
          keyFingerprint: null,
          provider: null,
          model: authority.childMetadataModelByte,
        };
        const sessions = Array.isArray(payload?.sessions) ? payload.sessions : [];
        const child = sessions.find((s) => s?.key === authority.uniqueNewChildKey);
        if (child) {
          evidence.child_session_metadata = {
            key: child.key || null,
            provider: child.modelProvider || child.provider || null,
            model: child.model || null,
            modelSelectionLocked: child.modelSelectionLocked === true,
          };
        }
        evidence.model_matches = authority.modelMatches;
        if (!evidence.model_matches) {
          evidence.model_classification_reason = authority.failureCategory === 'model-mismatch'
            ? 'requested model does not match authoritative child-session metadata'
            : 'authoritative child-session model byte unavailable';
        }
        console.log('✓ spawnedBy set-diff bound exactly one new child');
      } else if (authority.ambiguous) {
        evidence.model_classification_reason = 'spawnedBy set-diff produced multiple new children';
        console.warn('✗ spawnedBy set-diff ambiguous (multiple new children)');
      } else {
        evidence.model_classification_reason = 'spawnedBy set-diff produced zero new children';
      }
    }

    function start(socket) {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      // Pre-dispatch baseline: server-filtered children of this disposable parent.
      socket.setTimeout(() => requestSpawnedByList('pre'), 300);
      socket.setTimeout(() => {
        if (!evidence.pre_spawned_by_captured) {
          console.error('✗ pre-dispatch sessions.list {spawnedBy} baseline missing');
          failures.add(1);
          socket.close();
        }
      }, 5000);
      socket.setTimeout(() => {
        if (!evidence.pre_spawned_by_captured) return;
        const childTask =
          'Proof nonce ' + rowNonce + ': read your runtime context/current model identity. ' +
          'Reply exactly MODEL-TOOL-CHILD ' + rowNonce + ' MODEL <provider/model>. ' +
          'Use UNKNOWN only if no runtime model identity is available. Do not mutate files. Do not post externally.';
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
      }, 800);
      // Independent post-dispatch polls (not event-correlation gated).
      socket.setTimeout(() => { if (evidence.dispatch_accepted) requestSpawnedByList('post'); }, 4000);
      socket.setTimeout(() => { if (evidence.dispatch_accepted) requestSpawnedByList('post'); }, 12000);
      socket.setTimeout(() => { if (evidence.dispatch_accepted) requestSpawnedByList('post'); }, 30000);
      socket.setTimeout(() => { if (evidence.dispatch_accepted) requestSpawnedByList('post'); }, 60000);
      socket.setTimeout(() => { if (evidence.dispatch_accepted) requestParentHistory(); }, 8000);
      socket.setTimeout(() => { if (evidence.dispatch_accepted) requestParentHistory(); }, 25000);
      socket.setTimeout(() => { if (evidence.dispatch_accepted) requestParentHistory(); }, 70000);
      socket.setTimeout(() => socket.close(), 180000);
    }
    socket.on('open', () => {
      socket.send(connectFrame(token));
      socket.setTimeout(() => {
        const key = ('r-cd-model-tool-' + rowNonce).toLowerCase().replace(/[^a-z0-9-]/g, '-');
        tracker.send(socket, 'sessions.create', { key, label: 'k6 R-CD-MODEL-TOOL ' + rowNonce });
      }, 250);
    });
    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw); const classified = tracker.classify(msg);
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
        if (classified.kind === 'response' && classified.method === 'sessions.list') {
          if (listPhase === 'pre') {
            evidence.pre_spawned_by_keys = sessionKeysFromListPayload(classified.payload);
            evidence.pre_spawned_by_captured = true;
            console.log('✓ pre-dispatch spawnedBy baseline captured (' + evidence.pre_spawned_by_keys.length + ')');
            listPhase = null;
          } else if (listPhase === 'post' || evidence.dispatch_accepted) {
            postListPolls += 1;
            if (classified.ok) applyChildAuthority(classified.payload || {});
            else {
              evidence.model_classification_reason =
                'gateway sessions.list unavailable while resolving child session metadata';
            }
            listPhase = null;
          }
        }
        if (classified.kind === 'response' && classified.method === 'sessions.get') {
          parentHistoryPolls += 1;
          if (classified.ok) {
            const messages = Array.isArray(classified.payload?.messages) ? classified.payload.messages : [];
            if (parentReturnContainsNonce(messages, rowNonce)) {
              evidence.parent_return_nonce_bound = true;
              console.log('✓ parent sessions.get nonce-bound normal-mode return observed');
            }
          }
          listPhase = null;
        }
        if (classified.kind === 'event') {
          const eventData = classified.data || {}; const eventStr = JSON.stringify(eventData);
          if (eventData.traceId) evidence.trace_id = eventData.traceId;
          // Event correlation may observe child text, but cannot establish model equality
          // or replace the spawnedBy set-diff authority.
          if (eventStr.includes(rowNonce) && !eventStr.includes(HARNESS_MARKER)) {
            if (eventStr.includes('MODEL-TOOL-PARENT-SCHEDULED')) {
              evidence.parent_scheduled_sentinel = true;
              console.log('✓ parent scheduled sentinel observed');
            }
            const childMatch = eventStr.match(new RegExp('MODEL-TOOL-CHILD\\s+' + escapeRegex(rowNonce) + '\\s+MODEL\\s+([A-Za-z0-9_.\\/-]+)'));
            if (childMatch) {
              evidence.return_payload = true;
              evidence.child_self_reported_model = normalizeModel(childMatch[1]);
              evidence.child_self_reported_model_source = 'auxiliary child runtime-context self-report (not used for equality)';
              console.log('✓ MODEL-TOOL-CHILD return payload observed (auxiliary only)');
            }
          }
        }
        if (evidence.dispatch_accepted && evidence.child_session_metadata_observed &&
            evidence.parent_return_nonce_bound) {
          console.log('R-CD-MODEL-TOOL authority gathered, closing early');
          socket.close();
        }
      } catch (e) { console.warn('parse error: ' + e); }
    });
    socket.on('error', (e) => { console.error('ws error: ' + (e && e.error ? e.error() : e)); failures.add(1); });
  });

  evidence.ended = new Date().toISOString(); evidence.duration_ms = Date.now() - started; duration.add(evidence.duration_ms);
  finalEvidence = evidence;
  // Child self-report (return_payload) is auxiliary and never required for PASS.
  const complete = evidence.session_created && evidence.dispatch_accepted &&
    evidence.pre_spawned_by_captured && evidence.post_spawned_by_captured &&
    evidence.child_session_metadata_observed && evidence.child_metadata_model_byte &&
    evidence.parent_return_nonce_bound &&
    !evidence.spawned_by_diff_ambiguous && !evidence.spawned_by_diff_empty;
  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'disposable parent created': () => evidence.session_created,
    'pre spawnedBy baseline': () => evidence.pre_spawned_by_captured,
    'dispatch accepted': () => evidence.dispatch_accepted,
    'post spawnedBy poll': () => evidence.post_spawned_by_captured,
    'exactly one new child': () => !!evidence.child_session_key && !evidence.spawned_by_diff_ambiguous,
    'authoritative child-session model byte': () => !!evidence.child_metadata_model_byte,
    'parent nonce-bound return': () => evidence.parent_return_nonce_bound,
    'requested model observed': () => evidence.model_matches,
  });
  const authoritativeMismatch =
    evidence.child_session_metadata_observed &&
    !!evidence.child_metadata_model_byte &&
    !evidence.model_matches;
  const verdict = authoritativeMismatch
    ? 'FAIL-candidate'
    : (complete ? 'PASS-candidate' : 'PARTIAL-candidate');
  if (verdict !== 'PASS-candidate') failures.add(1);
  console.log('\n--- R-CD-MODEL-TOOL EVIDENCE SUMMARY ---'); console.log(JSON.stringify(evidence, null, 2)); console.log('--- END EVIDENCE ---'); console.log('\n[R-CD-MODEL-TOOL] VERDICT: ' + verdict);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const failuresCount = data.metrics.proof_failures?.values?.count || 0;
  const complete = !!(finalEvidence?.session_created && finalEvidence?.dispatch_accepted &&
    finalEvidence?.pre_spawned_by_captured && finalEvidence?.post_spawned_by_captured &&
    finalEvidence?.child_session_metadata_observed && finalEvidence?.child_metadata_model_byte &&
    finalEvidence?.parent_return_nonce_bound &&
    !finalEvidence?.spawned_by_diff_ambiguous && !finalEvidence?.spawned_by_diff_empty);
  const authoritativeMismatch =
    finalEvidence?.child_session_metadata_observed &&
    !!finalEvidence?.child_metadata_model_byte &&
    !finalEvidence?.model_matches;
  const verdict = authoritativeMismatch
    ? 'FAIL-candidate'
    : (complete ? 'PASS-candidate' : 'PARTIAL-candidate');
  const summary = { row: 'R-CD-MODEL-TOOL', sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset', seat: __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx', timestamp, verdict, requestedModel: finalEvidence?.requested_model_byte || __ENV.OPENCLAW_ALT_MODEL || null, observedModel: finalEvidence?.child_metadata_model_byte || null, observedModelSource: finalEvidence?.child_metadata_model_source || null, auxiliarySelfReport: finalEvidence?.child_self_reported_model || null, classificationReason: finalEvidence?.model_classification_reason || null, metrics: { duration_ms: data.metrics.r_cd_model_tool_duration?.values || null, failures: failuresCount } };
  return { stdout: '\n[R-CD-MODEL-TOOL] Summary: ' + summary.verdict + ' | SHA: ' + summary.sha + ' | Seat: ' + summary.seat + '\n', 'r-cd-model-tool-summary.json': JSON.stringify(summary, null, 2) };
}
