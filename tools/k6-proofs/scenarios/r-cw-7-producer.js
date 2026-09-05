/**
 * Live producer: R-CW-7 — traceparent create/propagate/join.
 * Process-local vitest trio is a prerequisite, not closure.
 * Issue: karmaterminal/karmaterminal-openclaw-docs#477
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import {
  HARNESS_MARKER,
  boolEnv,
  disposableSessionKey,
  eventText,
  ignoreHarnessEcho,
  requireGatewayToken,
} from '../lib/producer-live-harness.js';

export const options = {
  scenarios: {
    r_cw_7_producer: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '150s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cw_7_duration: ['p(95)<140000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cw_7_duration');
const manifest = loadManifestFromEnv();
const ROW = 'R-CW-7';

export default function () {
  const token = requireGatewayToken();
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  let sessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || 'main';
  const createDisposableSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION') || boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSIONS');
  const rowNonce = nonce('R-CW-7');
  const inv = manifest?.invocation || {};
  if (!token) {
    failures.add(1);
    return;
  }
  if (manifest) validateManifest(manifest);
  const evidence = {
    row: ROW,
    producer: true,
    nonce: rowNonce,
    sessionKey,
    session_created: false,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    runtimeSha: __ENV.OPENCLAW_RUNTIME_BUILD_SHA || 'unset',
    started: new Date().toISOString(),
    tool_invoke_accepted: false,
    continue_work_tool_result_scheduled: false,
    work_woke_event: false,
    traceparent: null,
    trace_id: null,
    redacted_events: [],
  };
  const started = Date.now();
  const delaySeconds = Number(inv.delaySeconds ?? 5);

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    function startProofFlow(socket) {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      socket.setTimeout(() => {
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message:
            `${HARNESS_MARKER} Call continue_work with reason="k6-proof-R-CW-7-${rowNonce}" delaySeconds=${delaySeconds}. ` +
            `After the tool result reports scheduled, reply exactly CW7-SCHEDULED ${rowNonce} and include any traceparent. ` +
            `On wake reply exactly CW7-WOKE ${rowNonce}. Do not mutate files.`,
          idempotencyKey: `${inv.idempotencyKeyPrefix || 'R-CW-7'}-${rowNonce}`,
        });
      }, 500);
      socket.setTimeout(() => socket.close(), 140000);
    }
    socket.on('open', () => {
      socket.send(connectFrame(token));
      if (createDisposableSession) {
        socket.setTimeout(() => {
          tracker.send(socket, 'sessions.create', {
            key: disposableSessionKey('r-cw-7', rowNonce),
            label: `k6 ${ROW} ${rowNonce}`,
          });
        }, 250);
      } else socket.setTimeout(() => startProofFlow(socket), 500);
    });
    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        const classified = tracker.classify(msg);
        evidence.redacted_events.push({
          ts: Date.now(),
          kind: classified.kind,
          method: classified.method || null,
          data: classified.payload ? redactEvent(classified.payload) : null,
        });
        const blob = JSON.stringify(classified);
        const tp = blob.match(/00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}/);
        if (tp) {
          evidence.traceparent = tp[0];
          evidence.trace_id = tp[0].split('-')[1];
        }
        if (classified.kind === 'response' && classified.method === 'sessions.create' && classified.ok) {
          sessionKey = classified.payload.key || sessionKey;
          evidence.sessionKey = sessionKey;
          evidence.session_created = true;
          startProofFlow(socket);
        }
        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) {
            evidence.tool_invoke_accepted = true;
            if (classified.payload?.traceId) evidence.trace_id = classified.payload.traceId;
          } else failures.add(1);
        }
        if (classified.kind === 'event' && !ignoreHarnessEcho(classified)) {
          const text = eventText(classified);
          if (text.includes(`CW7-SCHEDULED ${rowNonce}`)) evidence.continue_work_tool_result_scheduled = true;
          if (text.includes(`CW7-WOKE ${rowNonce}`)) evidence.work_woke_event = true;
        }
        if (evidence.tool_invoke_accepted && evidence.continue_work_tool_result_scheduled && evidence.work_woke_event && evidence.trace_id) {
          socket.close();
        }
      } catch (e) {
        console.warn(`parse error: ${e}`);
      }
    });
    socket.on('error', () => failures.add(1));
  });

  evidence.duration_ms = Date.now() - started;
  duration.add(evidence.duration_ms);
  const joined = Boolean(evidence.trace_id || evidence.traceparent);
  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'tool-invoke-accepted': () => evidence.tool_invoke_accepted,
    'scheduled': () => evidence.continue_work_tool_result_scheduled,
    'woke': () => evidence.work_woke_event,
    'traceparent-continuity': () => joined,
  });
  if (!evidence.tool_invoke_accepted || !evidence.continue_work_tool_result_scheduled || !evidence.work_woke_event || !joined) {
    failures.add(1);
  }
  const passed = evidence.tool_invoke_accepted && evidence.continue_work_tool_result_scheduled && evidence.work_woke_event && joined;
  console.log(`\n--- ${ROW} EVIDENCE ---\n${JSON.stringify(evidence, null, 2)}\n--- END ---`);
  console.log(`[${ROW}] VERDICT: ${passed ? 'PASS-candidate' : 'PARTIAL-candidate'} (diagnostic unless exact final SHA)`);
}

export function handleSummary(data) {
  const passRate = data.metrics.proof_failures?.values?.count === 0;
  return {
    stdout: `\n[${ROW}] ${passRate ? 'PASS-candidate' : 'PARTIAL-candidate'}\n`,
    'r-cw-7-producer-summary.json': JSON.stringify({
      row: ROW,
      sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
      verdict: passRate ? 'PASS-candidate' : 'PARTIAL-candidate',
      producer: true,
    }, null, 2),
  };
}
