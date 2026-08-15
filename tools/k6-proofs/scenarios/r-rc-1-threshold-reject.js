/**
 * Scenario: R-RC-1 — request_compaction below-threshold reject.
 *
 * Creates a disposable low-context session, verifies request_compaction is in
 * that session's effective tool inventory, then captures the authoritative
 * role=toolResult receipt for the invocation. Assistant sentinel prose is
 * retained as diagnostic evidence only and can never satisfy the row.
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { GatewayHandshake, disposableSessionKey, recordClassifiedEvent } from '../lib/proof-session.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import {
  classifyRequestCompactionReceipt,
  findRequestCompactionReceipt,
  hasEffectiveTool,
} from '../lib/request-compaction-receipt.js';

export const options = {
  scenarios: {
    r_rc_1_threshold_reject: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '90s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_rc_1_duration: ['p(95)<75000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_rc_1_duration');
const manifest = loadManifestFromEnv();
const HARNESS_MARKER = '[k6-proof-harness]';

function boolEnv(name) {
  return (__ENV[name] || '').toLowerCase() === 'true';
}

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const requestedSessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || 'main';
  let sessionKey = requestedSessionKey;
  const createDisposableSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION') || boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSIONS') || true;
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx';
  const rowNonce = nonce('R-RC-1');

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
    row: 'R-RC-1',
    manifest_loaded: !!manifest,
    nonce: rowNonce,
    seat,
    requestedSessionKey,
    sessionKey,
    session_created: false,
    created_session_key: null,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(),
    tool_inventory_checked: false,
    tool_registered: false,
    dispatch_accepted: false,
    dispatch_accepted_at_ms: null,
    tool_name: 'request_compaction',
    tool_invocation_observed: false,
    tool_result_observed: false,
    tool_call_id: null,
    tool_call_nonce_bound: false,
    tool_result_status: null,
    tool_invoke_rejected: false,
    guard: null,
    context_usage: null,
    threshold: null,
    no_compaction_side_effect: false,
    assistant_sentinel_observed: false,
    history_requested: false,
    history_attempts: 0,
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
          const disposableKey = disposableSessionKey('r-rc-1', rowNonce);
          tracker.send(socket, 'sessions.create', { key: disposableKey, label: `k6 R-RC-1 ${rowNonce}` });
        } else {
          startProofFlow();
        }
      },
    });


    function startProofFlow() {
      tracker.send(socket, 'tools.effective', { sessionKey });
      socket.setTimeout(() => socket.close(), 60000);
    }

    function dispatchRequestCompaction() {
      const reason = `R-RC-1 k6 proof nonce ${rowNonce}: expected below-threshold structured rejection; do not compact.`;
      const instruction =
        `${HARNESS_MARKER} Call request_compaction with reason=${JSON.stringify(reason)}. ` +
        `After the tool returns, reply exactly RC1-RESULT-OBSERVED ${rowNonce}. ` +
        `Do not infer or restate the receipt, and take no other action.`;
      tracker.send(socket, 'sessions.send', {
        key: sessionKey,
        message: instruction,
        idempotencyKey: `R-RC-1-${rowNonce}`,
      });
    }

    function recordAuthoritativeReceipt(receiptResult) {
      if (receiptResult.kind === 'threshold_rejected') {
        const receipt = receiptResult.receipt;
        evidence.tool_result_observed = true;
        evidence.tool_call_id = receiptResult.toolCallId;
        evidence.tool_call_nonce_bound = receiptResult.nonceBound === true;
        evidence.tool_invocation_observed = evidence.tool_call_nonce_bound;
        evidence.tool_result_status = receipt.status;
        evidence.tool_invoke_rejected = true;
        evidence.guard = receipt.guard;
        evidence.context_usage = Number.isFinite(receipt.contextUsage) ? receipt.contextUsage : null;
        evidence.threshold = Number.isFinite(receipt.threshold) ? receipt.threshold : null;
        evidence.no_compaction_side_effect = true;
        console.log(`✓ authoritative toolResult: status=${receipt.status} guard=${receipt.guard} context=${receipt.contextUsage ?? 'unknown'} threshold=${receipt.threshold ?? 'unknown'}`);
        socket.close();
        return true;
      }
      if (receiptResult.kind === 'invalid' || receiptResult.kind === 'non_threshold_result') {
        evidence.tool_result_observed = true;
        evidence.tool_call_id = receiptResult.toolCallId || null;
        evidence.tool_result_status = receiptResult.receipt?.status || 'invalid';
        console.error(`✗ authoritative request_compaction tool result did not prove threshold rejection: ${JSON.stringify(receiptResult)}`);
        failures.add(1);
        socket.close();
        return true;
      }
      return false;
    }

    function requestTranscriptReceipt() {
      evidence.history_requested = true;
      evidence.history_attempts += 1;
      tracker.send(socket, 'sessions.get', { key: sessionKey, limit: 20 });
    }

    socket.on('open', () => {
      handshake.begin(socket, token);
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        const classified = tracker.classify(msg);
        handshake.observe(classified);
        recordClassifiedEvent(evidence, classified, redactEvent, {
          redactData: (frame) => redactEvent(frame.data || frame.payload || null),
        });

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

        if (classified.kind === 'response' && classified.method === 'tools.effective') {
          evidence.tool_inventory_checked = true;
          evidence.tool_registered = classified.ok && hasEffectiveTool(classified.payload, 'request_compaction');
          if (!evidence.tool_registered) {
            console.error(`✗ request_compaction absent from effective inventory: ${JSON.stringify(classified.error || classified.payload)}`);
            failures.add(1);
            socket.close();
          } else {
            console.log('✓ request_compaction present in effective inventory');
            tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
          }
        }

        if (classified.kind === 'response' && classified.method === 'sessions.messages.subscribe') {
          if (classified.ok) {
            dispatchRequestCompaction();
          } else {
            console.error(`✗ sessions.messages.subscribe rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
            socket.close();
          }
        }

        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) {
            evidence.dispatch_accepted = true;
            evidence.dispatch_accepted_at_ms = Date.now();
            if (classified.payload?.traceId) evidence.trace_id = classified.payload.traceId;
            console.log('✓ sessions.send accepted — awaiting authoritative request_compaction tool result');
          } else {
            console.error(`✗ sessions.send rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
            socket.close();
          }
        }

        if (classified.kind === 'response' && classified.method === 'sessions.get') {
          if (!classified.ok) {
            console.error(`✗ sessions.get rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
            socket.close();
          } else {
            const receiptResult = findRequestCompactionReceipt(classified.payload?.messages, { rowNonce });
            if (!recordAuthoritativeReceipt(receiptResult)) {
              if (evidence.history_attempts < 8) {
                socket.setTimeout(requestTranscriptReceipt, 250);
              } else {
                console.error('✗ sessions.get contained no authoritative request_compaction tool result after bounded retries');
                failures.add(1);
                socket.close();
              }
            }
          }
        }

        if (classified.kind === 'event') {
          const receiptResult = classifyRequestCompactionReceipt(classified.data);
          // Subscription events can be delayed or replayed. Never accept an
          // unbound tool result directly; use it only as a signal to fetch the
          // transcript, where the nonce-bearing tool call and toolCallId can be
          // correlated in the same disposable session.
          if (receiptResult.kind !== 'unrelated' && !evidence.history_requested) {
            requestTranscriptReceipt();
          }

          const eventMessage = classified.data?.message;
          const eventStr = JSON.stringify(eventMessage?.content || '');
          if (eventMessage?.role === 'assistant' && eventStr.includes(`RC1-RESULT-OBSERVED ${rowNonce}`)) {
            evidence.assistant_sentinel_observed = true;
            console.log('ℹ assistant sentinel observed (diagnostic only; not accepted as row evidence)');
            if (!evidence.history_requested && !evidence.tool_result_observed) {
              requestTranscriptReceipt();
            }
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
  duration.add(evidence.duration_ms);

  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'request_compaction registered': () => evidence.tool_inventory_checked && evidence.tool_registered,
    'dispatch accepted': () => evidence.dispatch_accepted,
    'typed tool invocation observed': () => evidence.tool_invocation_observed,
    'authoritative tool result observed': () => evidence.tool_result_observed,
    'tool result bound to current nonce-bearing call': () => evidence.tool_call_nonce_bound,
    'request_compaction rejected': () => evidence.tool_invoke_rejected,
    'context_threshold guard observed': () => evidence.guard === 'context_threshold',
    'no compaction side effect': () => evidence.no_compaction_side_effect,
  });

  if (!evidence.tool_inventory_checked || !evidence.tool_registered || !evidence.dispatch_accepted ||
      !evidence.tool_invocation_observed || !evidence.tool_result_observed ||
      !evidence.tool_invoke_rejected ||
      !evidence.tool_call_nonce_bound || evidence.guard !== 'context_threshold' ||
      !evidence.no_compaction_side_effect) {
    failures.add(1);
  }

  console.log(`\n--- R-RC-1 EVIDENCE SUMMARY ---`);
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`--- END EVIDENCE ---`);
  console.log(`\n[R-RC-1] VERDICT: ${evidence.tool_invoke_rejected ? 'PASS-candidate' : 'PARTIAL-candidate'}`);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const passRate = data.metrics.proof_failures?.values?.count === 0;
  const summary = {
    row: 'R-RC-1',
    sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    seat: __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx',
    timestamp,
    verdict: passRate ? 'PASS-candidate' : 'PARTIAL-candidate',
    metrics: {
      duration_ms: data.metrics.r_rc_1_duration?.values || null,
      failures: data.metrics.proof_failures?.values?.count || 0,
    },
  };
  return {
    stdout: `\n[R-RC-1] Summary: ${summary.verdict} | SHA: ${summary.sha} | Seat: ${summary.seat}\n`,
    'r-rc-1-summary.json': JSON.stringify(summary, null, 2),
  };
}
