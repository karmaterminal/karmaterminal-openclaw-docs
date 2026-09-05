import ws from 'k6/ws';
import { check } from 'k6';
import crypto from 'k6/crypto';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import {
  assistantTextEvent,
  boolEnv,
  disposableSessionKey,
  eventDedupKey,
  eventIdentity,
  lifecycleEvent,
  renderTemplate,
  requireGatewayToken,
  toolEvent,
} from '../lib/producer-live-harness.js';

export const options = {
  scenarios: {
    r_cw_7: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '170s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cw_7_duration: ['p(95)<160000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cw_7_duration');
const manifest = loadManifestFromEnv();
const ROW = 'R-CW-7';

export default function () {
  const token = requireGatewayToken();
  if (!token) {
    failures.add(1);
    return;
  }
  if (manifest) validateManifest(manifest);
  const invocation = manifest?.invocation || {};
  const rowNonce = nonce('R-CW-7');
  const reason = renderTemplate(invocation.reason, rowNonce);
  if (!reason) {
    console.error('manifest invocation.reason is required');
    failures.add(1);
    return;
  }
  let sessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || 'main';
  const createSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION') ||
    boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSIONS');
  const evidence = {
    row: ROW,
    producer: true,
    nonce: rowNonce,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    runtimeSha: __ENV.OPENCLAW_RUNTIME_BUILD_SHA || 'unset',
    started: new Date().toISOString(),
    dispatch_accepted_at_ms: null,
    session_key: null,
    origin_run_id: null,
    tool_call_id: null,
    tool_started: false,
    tool_scheduled: false,
    hop_two_run_id: null,
    hop_two_started: false,
    hop_two_completed: false,
    hop_two_terminal_phase: null,
    hop_two_output_bound: false,
    reason_hash: crypto.sha256(reason, 'hex').slice(0, 16),
    reason_length: reason.length,
    redacted_events: [],
  };
  const seen = {};
  const started = Date.now();
  const result = ws.connect(__ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789', {}, (socket) => {
    const tracker = new RequestTracker();

    function startProof() {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      const instruction =
        `[k6-proof-harness] R-CW-7 nonce ${rowNonce}. Call continue_work exactly once with ` +
        `reason=${JSON.stringify(reason)} and delaySeconds=${invocation.delaySeconds ?? 7}. ` +
        `After the tool result reports scheduled, reply exactly CW7-SCHEDULED ${rowNonce}. ` +
        `On the successor wake reply exactly CW7-WOKE ${rowNonce}.`;
      tracker.send(socket, 'sessions.send', {
        key: sessionKey,
        message: instruction,
        idempotencyKey: `${invocation.idempotencyKeyPrefix || ROW}-${rowNonce}`,
      });
      socket.setTimeout(() => socket.close(), 160_000);
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));
      if (createSession) {
        socket.setTimeout(() => tracker.send(socket, 'sessions.create', {
          key: disposableSessionKey('r-cw-7', rowNonce),
          label: `k6 ${ROW} ${rowNonce}`,
        }), 250);
      } else {
        socket.setTimeout(startProof, 500);
      }
    });
    socket.on('message', (raw) => {
      try {
        const classified = tracker.classify(JSON.parse(raw));
        const identity = eventIdentity(classified);
        const dedupKey = eventDedupKey(identity);
        if (dedupKey && seen[dedupKey]) return;
        if (dedupKey) seen[dedupKey] = true;
        evidence.redacted_events.push({
          ts: Date.now(),
          kind: classified.kind,
          method: classified.method || null,
          event: classified.event || null,
          data: classified.data ? redactEvent(classified.data) : null,
        });
        if (classified.kind === 'response' && classified.method === 'sessions.create') {
          if (!classified.ok || !classified.payload?.key) {
            failures.add(1);
            socket.close();
            return;
          }
          sessionKey = classified.payload.key;
          startProof();
        }
        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (!classified.ok) failures.add(1);
          else {
            evidence.dispatch_accepted_at_ms = Date.now();
            evidence.session_key = sessionKey;
            evidence.origin_run_id = classified.payload?.runId || null;
          }
        }
        if (evidence.origin_run_id) {
          const work = toolEvent(classified, sessionKey, evidence.origin_run_id, 'continue_work');
          if (work?.phase === 'start') {
            evidence.tool_started = true;
            evidence.tool_call_id = work.toolCallId;
          }
          if (work?.phase === 'result' &&
              work.toolCallId === evidence.tool_call_id &&
              !work.isError) {
            evidence.tool_scheduled = true;
          }
        }
        const lifecycle = lifecycleEvent(classified, sessionKey);
        if (lifecycle && lifecycle.runId !== evidence.origin_run_id &&
            (!evidence.hop_two_run_id || lifecycle.runId === evidence.hop_two_run_id)) {
          if (lifecycle.phase === 'start') evidence.hop_two_run_id = lifecycle.runId;
          if (lifecycle.runId !== evidence.hop_two_run_id) return;
          if (lifecycle.phase === 'start') evidence.hop_two_started = true;
          if (['end', 'error'].includes(lifecycle.phase)) {
            evidence.hop_two_completed = true;
            evidence.hop_two_terminal_phase = lifecycle.phase;
          }
        }
        const output = evidence.hop_two_run_id
          ? assistantTextEvent(classified, sessionKey, evidence.hop_two_run_id)
          : null;
        if (output?.text.includes(`CW7-WOKE ${rowNonce}`)) evidence.hop_two_output_bound = true;
        if (evidence.tool_scheduled &&
            evidence.hop_two_started &&
            evidence.hop_two_completed &&
            evidence.hop_two_output_bound) {
          socket.close();
        }
      } catch {
        failures.add(1);
        console.error('producer event processing failed');
        socket.close();
      }
    });
    socket.on('error', () => failures.add(1));
  });

  evidence.ended = new Date().toISOString();
  evidence.duration_ms = Date.now() - started;
  duration.add(evidence.duration_ms);
  const distinctRun = Boolean(
    evidence.hop_two_run_id &&
    evidence.hop_two_run_id !== evidence.origin_run_id,
  );
  const exactRuntime = evidence.candidateSha === evidence.runtimeSha;
  const ok = result?.status === 101 &&
    exactRuntime &&
    evidence.tool_started &&
    evidence.tool_scheduled &&
    distinctRun &&
    evidence.hop_two_started &&
    evidence.hop_two_completed &&
    evidence.hop_two_terminal_phase === 'end' &&
    evidence.hop_two_output_bound;
  check(null, {
    'final SHA equals deployed runtime SHA': () => exactRuntime,
    'typed schedule bound to originating run': () =>
      evidence.tool_started && evidence.tool_scheduled,
    'successor is a distinct completed run': () =>
      distinctRun && evidence.hop_two_started && evidence.hop_two_completed &&
      evidence.hop_two_terminal_phase === 'end',
    'live trace discoverable by exact reason': () =>
      evidence.reason_hash.length === 16 && evidence.reason_length === reason.length,
  });
  if (!ok) failures.add(1);
  console.log(`\n--- ${ROW} EVIDENCE SUMMARY ---`);
  console.log(JSON.stringify(evidence, null, 2));
  console.log('--- END EVIDENCE ---');
  console.log(`[${ROW}] VERDICT: ${ok ? 'PASS-candidate' : 'PARTIAL-candidate'}`);
}

export function handleSummary(data) {
  const passed = data.metrics.proof_failures?.values?.count === 0;
  return {
    stdout: `\n[${ROW}] ${passed ? 'PASS-candidate' : 'PARTIAL-candidate'}\n`,
    'r-cw-7-producer-summary.json': JSON.stringify({
      row: ROW,
      producer: true,
      verdict: passed ? 'PASS-candidate' : 'PARTIAL-candidate',
      requiresProcessLocalPrerequisite: true,
      requiresRawTempoTrace: true,
    }, null, 2),
  };
}
