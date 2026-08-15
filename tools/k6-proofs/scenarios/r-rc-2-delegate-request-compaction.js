/**
 * Scenario: R-RC-2 — delegate child request_compaction threshold-aware proof.
 *
 * Parent session asks the agent to fire continue_delegate(mode="normal") with a
 * child task that calls request_compaction. The accepted outcomes are:
 *   - child reports REQUEST_COMPACTION_REJECTED_CONTEXT_THRESHOLD when runtime
 *     honestly refuses because context is below threshold (expected in normal
 *     disposable/public runners), or
 *   - child reports REQUEST_COMPACTION_ACCEPTED / post-compaction path if a
 *     reviewed tiny-context fixture exists.
 *
 * This scenario does not mutate config, lower thresholds, or restart services.
 */
import ws from 'k6/ws';
import { check } from 'k6';
import crypto from 'k6/crypto';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { GatewayHandshake, disposableSessionKey, recordClassifiedEvent } from '../lib/proof-session.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import { findRequestCompactionReceipt } from '../lib/request-compaction-receipt.js';
import { childSessionKeyForRow } from '../lib/row-child-correlation.mjs';

export const options = {
  scenarios: {
    r_rc_2_delegate_request_compaction: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '150s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_rc_2_duration: ['p(95)<140000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_rc_2_duration');
const manifest = loadManifestFromEnv();
const HARNESS_MARKER = '[k6-proof-harness]';
let finalEvidence = null;

function boolEnv(name, fallback = false) {
  const value = (__ENV[name] || '').toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function eventText(classified) {
  return JSON.stringify(classified.data || classified.payload || {});
}

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const requestedSessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || 'main';
  let sessionKey = requestedSessionKey;
  const createDisposableSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION') || boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSIONS', true);
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx';
  const rowNonce = nonce('R-RC-2');

  if (!token) {
    console.error('OPENCLAW_GATEWAY_TOKEN is required');
    failures.add(1);
    return;
  }
  if (manifest) {
    const errors = validateManifest(manifest);
    if (errors.length > 0) console.warn(`Manifest validation warnings: ${errors.join('; ')}`);
  }

  const evidence = {
    row: 'R-RC-2',
    manifest_loaded: !!manifest,
    nonce: rowNonce,
    seat,
    requestedSessionKey,
    sessionKey,
    session_created: false,
    created_session_key: null,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(),
    parent_dispatch_accepted: false,
    dispatch_accepted_at_ms: null,
    delegate_requested: false,
    reason_hash: null,
    reason_length: null,
    delegate_mode: null,
    child_session_observed: false,
    child_session_key: null,
    child_history_requests: 0,
    child_history_available: false,
    delegate_child_report_observed: false,
    child_reported_context_threshold: false,
    request_compaction_tool_result_observed: false,
    request_compaction_receipt_role: null,
    request_compaction_receipt_tool_name: null,
    request_compaction_receipt_status: null,
    request_compaction_invocation_bound: false,
    request_compaction_rejected_context_threshold: false,
    request_compaction_accepted: false,
    request_compaction_accepted_reported: false,
    post_compaction_path_observed: false,
    guard: null,
    context_usage: null,
    threshold: null,
    reported_context_usage: null,
    reported_threshold: null,
    trace_id: null,
    redacted_events: [],
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
          const disposableKey = disposableSessionKey('r-rc-2', rowNonce);
          tracker.send(socket, 'sessions.create', { key: disposableKey, label: `k6 R-RC-2 ${rowNonce}` });
        } else {
          startProofFlow();
        }
      },
    });

    let childHistoryPolls = 0;
    let childHistoryPollScheduled = false;
    let childHistoryPollInFlight = false;

    function hasAuthoritativeThresholdReceipt() {
      return evidence.child_session_observed &&
        evidence.request_compaction_tool_result_observed &&
        evidence.request_compaction_receipt_role === 'toolResult' &&
        evidence.request_compaction_receipt_tool_name === 'request_compaction' &&
        evidence.request_compaction_receipt_status === 'rejected' &&
        evidence.request_compaction_invocation_bound &&
        evidence.request_compaction_rejected_context_threshold &&
        evidence.guard === 'context_threshold';
    }

    function hasAuthoritativeAcceptedReceipt() {
      return evidence.child_session_observed &&
        evidence.request_compaction_tool_result_observed &&
        evidence.request_compaction_receipt_role === 'toolResult' &&
        evidence.request_compaction_receipt_tool_name === 'request_compaction' &&
        evidence.request_compaction_receipt_status === 'accepted' &&
        evidence.request_compaction_invocation_bound &&
        evidence.request_compaction_accepted;
    }

    function maybeCloseCompletedProof() {
      const thresholdComplete =
        hasAuthoritativeThresholdReceipt() &&
        evidence.delegate_child_report_observed &&
        evidence.child_reported_context_threshold;
      const acceptedComplete =
        hasAuthoritativeAcceptedReceipt() &&
        evidence.delegate_child_report_observed &&
        evidence.post_compaction_path_observed;
      if (thresholdComplete || acceptedComplete) socket.close();
    }

    function requestChildHistory(delayMs) {
      if (!evidence.child_session_key || childHistoryPollScheduled || childHistoryPollInFlight) return;
      childHistoryPollScheduled = true;
      socket.setTimeout(() => {
        childHistoryPollScheduled = false;
        childHistoryPollInFlight = true;
        childHistoryPolls += 1;
        evidence.child_history_requests = childHistoryPolls;
        tracker.send(socket, 'sessions.get', { key: evidence.child_session_key, limit: 200 });
      }, delayMs);
    }

    function startProofFlow() {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      socket.setTimeout(() => {
        const inv = manifest?.invocation || {};
        if (!inv.promptTemplate) {
          console.error('✗ manifest invocation.promptTemplate is required');
          failures.add(1);
          socket.close();
          return;
        }
        const childTask = inv.promptTemplate.replace(/\{\{nonce\}\}/g, rowNonce);
        evidence.reason_hash = crypto.sha256(childTask, 'hex').slice(0, 16);
        evidence.reason_length = childTask.length;
        evidence.delegate_mode = inv.mode || 'normal';
        const instruction =
          `${HARNESS_MARKER} R-RC-2 nonce ${rowNonce}. ` +
          `Call continue_delegate with mode="normal", delaySeconds=0, task="${childTask}". ` +
          `No other action.`;
        evidence.delegate_requested = true;
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message: instruction,
          idempotencyKey: `R-RC-2-${rowNonce}`,
        });
      }, 500);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 20 }), 10000);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 20 }), 30000);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 20 }), 60000);
      socket.setTimeout(() => socket.close(), 120000);
    }

    socket.on('open', () => {
      handshake.begin(socket, token);
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        const classified = tracker.classify(msg);
        handshake.observe(classified);
        recordClassifiedEvent(evidence, classified, redactEvent);

        if (classified.kind === 'response' && classified.method === 'sessions.create') {
          if (classified.ok && classified.payload) {
            sessionKey = classified.payload.key || sessionKey;
            evidence.sessionKey = sessionKey;
            evidence.session_created = true;
            evidence.created_session_key = sessionKey;
            console.log(`✓ disposable session created: ${sessionKey}`);
            startProofFlow();
          } else {
            console.error(`✗ sessions.create rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
            socket.close();
          }
        }

        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) {
            evidence.parent_dispatch_accepted = true;
            evidence.dispatch_accepted_at_ms = Date.now();
            if (classified.payload?.traceId) evidence.trace_id = classified.payload.traceId;
            console.log('✓ sessions.send accepted — parent agent turn triggered for R-RC-2');
          } else {
            console.error(`✗ sessions.send rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
          }
        }

        if (classified.kind === 'response' && classified.method === 'tasks.list') {
          const taskStr = JSON.stringify(classified.payload || {});
          if (taskStr.includes(rowNonce)) console.log('✓ task ledger contains R-RC-2 nonce context');
        }

        if (classified.kind === 'response' && classified.method === 'sessions.get') {
          childHistoryPollInFlight = false;
          if (!classified.ok) {
            requestChildHistory(2000);
          } else {
            const messages = Array.isArray(classified.payload?.messages) ? classified.payload.messages : [];
            evidence.child_history_available = true;
            const receipt = findRequestCompactionReceipt(messages, { rowNonce });
            if (receipt.kind !== 'missing') {
              evidence.request_compaction_tool_result_observed = true;
              evidence.request_compaction_receipt_role = 'toolResult';
              evidence.request_compaction_receipt_tool_name = 'request_compaction';
              evidence.request_compaction_receipt_status = receipt.receipt?.status || null;
              evidence.request_compaction_invocation_bound = receipt.nonceBound === true;
              evidence.guard = receipt.receipt?.guard || null;
              evidence.context_usage = Number.isFinite(receipt.receipt?.contextUsage)
                ? receipt.receipt.contextUsage
                : null;
              evidence.threshold = Number.isFinite(receipt.receipt?.threshold)
                ? receipt.receipt.threshold
                : null;
            }
            if (receipt.kind === 'threshold_rejected' && receipt.nonceBound === true) {
              evidence.request_compaction_rejected_context_threshold = true;
              console.log('✓ nonce-bound request_compaction toolResult rejected by context_threshold');
              maybeCloseCompletedProof();
            } else if (
              receipt.kind === 'non_threshold_result' &&
              receipt.nonceBound === true &&
              receipt.receipt?.status === 'accepted'
            ) {
              evidence.request_compaction_accepted = true;
              console.log('✓ nonce-bound request_compaction accepted toolResult observed');
              maybeCloseCompletedProof();
            } else {
              requestChildHistory(2000);
            }
          }
        }

        if (classified.kind === 'event') {
          const eventData = classified.data || {};
          const observedChildSessionKey = childSessionKeyForRow(eventData, rowNonce);
          if (observedChildSessionKey && !evidence.child_session_key) {
            evidence.child_session_observed = true;
            evidence.child_session_key = observedChildSessionKey;
            requestChildHistory(250);
            console.log('✓ nonce-bound delegated child session observed');
          }
          const text = eventText(classified);
          if (!text.includes(rowNonce)) return;
          if (text.includes(HARNESS_MARKER)) {
            console.log('ℹ Ignoring harness prompt echo event');
          } else if (text.includes(`REQUEST_COMPACTION_REJECTED_CONTEXT_THRESHOLD ${rowNonce}`)) {
            evidence.delegate_child_report_observed = true;
            evidence.child_reported_context_threshold = true;
            const usage = text.match(/CONTEXT[^0-9A-Za-z]+(\d+|unknown)/)?.[1] || 'unknown';
            const threshold = text.match(/THRESHOLD[^0-9A-Za-z]+(\d+|unknown)/)?.[1] || 'unknown';
            evidence.reported_context_usage = usage !== 'unknown' ? Number(usage) : null;
            evidence.reported_threshold = threshold !== 'unknown' ? Number(threshold) : null;
            console.log(`✓ auxiliary delegated threshold report observed: context=${usage} threshold=${threshold}`);
            maybeCloseCompletedProof();
            if (!hasAuthoritativeThresholdReceipt()) requestChildHistory(250);
          } else if (text.includes(`REQUEST_COMPACTION_ACCEPTED ${rowNonce}`)) {
            evidence.delegate_child_report_observed = true;
            evidence.request_compaction_accepted_reported = true;
            console.log('✓ auxiliary delegated request_compaction accepted report observed');
            requestChildHistory(250);
          } else if (text.includes(`REQUEST_COMPACTION_POST_COMPACTION ${rowNonce}`)) {
            evidence.delegate_child_report_observed = true;
            evidence.post_compaction_path_observed = true;
            console.log('✓ delegated request_compaction post-compaction sentinel observed');
            maybeCloseCompletedProof();
            if (!hasAuthoritativeAcceptedReceipt()) requestChildHistory(250);
          }
        }
      } catch (e) {
        console.warn(`parse error: ${e}`);
      }
    });

    socket.on('error', (e) => {
      console.error(`ws error: ${e && e.error ? e.error() : e}`);
      failures.add(1);
    });
  });

  evidence.ended = new Date().toISOString();
  evidence.duration_ms = Date.now() - started;
  const authoritativeThresholdReceipt =
    evidence.child_session_observed &&
    evidence.request_compaction_tool_result_observed &&
    evidence.request_compaction_receipt_role === 'toolResult' &&
    evidence.request_compaction_receipt_tool_name === 'request_compaction' &&
    evidence.request_compaction_receipt_status === 'rejected' &&
    evidence.request_compaction_invocation_bound &&
    evidence.request_compaction_rejected_context_threshold &&
    evidence.guard === 'context_threshold';
  const authoritativeAcceptedReceipt =
    evidence.child_session_observed &&
    evidence.request_compaction_tool_result_observed &&
    evidence.request_compaction_receipt_role === 'toolResult' &&
    evidence.request_compaction_receipt_tool_name === 'request_compaction' &&
    evidence.request_compaction_receipt_status === 'accepted' &&
    evidence.request_compaction_invocation_bound &&
    evidence.request_compaction_accepted;
  const verifiedThresholdOutcome =
    authoritativeThresholdReceipt &&
    evidence.delegate_child_report_observed &&
    evidence.child_reported_context_threshold;
  const verifiedPostCompactionOutcome =
    authoritativeAcceptedReceipt &&
    evidence.delegate_child_report_observed &&
    evidence.post_compaction_path_observed;
  const partialOutcomeEvidence =
    authoritativeThresholdReceipt ||
    authoritativeAcceptedReceipt ||
    evidence.delegate_child_report_observed ||
    evidence.child_reported_context_threshold ||
    evidence.request_compaction_accepted ||
    evidence.request_compaction_accepted_reported ||
    evidence.post_compaction_path_observed;
  evidence.verdict = verifiedPostCompactionOutcome
    ? 'PASS-candidate'
    : (verifiedThresholdOutcome
      ? 'HONEST-LIMIT-candidate'
      : (partialOutcomeEvidence ? 'PARTIAL-candidate' : 'FAIL-candidate'));
  finalEvidence = evidence;
  duration.add(evidence.duration_ms);

  const acceptedOutcome =
    verifiedThresholdOutcome ||
    verifiedPostCompactionOutcome ||
    evidence.child_reported_context_threshold ||
    evidence.request_compaction_accepted ||
    evidence.request_compaction_accepted_reported;
  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'parent dispatch accepted': () => evidence.parent_dispatch_accepted,
    'delegate requested': () => evidence.delegate_requested,
    'child report observed': () => evidence.delegate_child_report_observed,
    'accepted threshold/compaction outcome': () => acceptedOutcome,
    'honest-limit has authoritative threshold receipt': () =>
      evidence.verdict !== 'HONEST-LIMIT-candidate' || verifiedThresholdOutcome,
    'pass has authoritative accepted receipt': () =>
      evidence.verdict !== 'PASS-candidate' || verifiedPostCompactionOutcome,
  });
  if (!evidence.parent_dispatch_accepted || !evidence.delegate_requested || !evidence.delegate_child_report_observed || !acceptedOutcome) failures.add(1);

  console.log('\n--- R-RC-2 EVIDENCE SUMMARY ---');
  console.log(JSON.stringify(evidence, null, 2));
  console.log('--- END EVIDENCE ---');
  console.log(`\n[R-RC-2] VERDICT: ${evidence.verdict}`);
}

export function handleSummary(data) {
  const failuresCount = data.metrics.proof_failures?.values?.count || 0;
  const summary = {
    row: 'R-RC-2',
    sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    seat: __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx',
    timestamp: new Date().toISOString(),
    verdict: finalEvidence?.verdict || (failuresCount === 0 ? 'PASS-candidate' : 'PARTIAL-candidate'),
    evidence: finalEvidence,
    metrics: {
      failures: failuresCount,
      duration_ms: data.metrics.r_rc_2_duration?.values || null,
    },
  };
  return { 'r-rc-2-summary.json': JSON.stringify(summary, null, 2) };
}
