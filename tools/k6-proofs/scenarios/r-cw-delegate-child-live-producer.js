/**
 * Live producer: R-CW-DELEGATE-CHILD-LIVE
 * Fresh hop-two completion under the child session — not the unit dispatch proof.
 * Issue: karmaterminal/karmaterminal-openclaw-docs#478
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
    r_cw_delegate_child_live_producer: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '180s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cw_delegate_child_live_duration: ['p(95)<170000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cw_delegate_child_live_duration');
const manifest = loadManifestFromEnv();
const ROW = 'R-CW-DELEGATE-CHILD-LIVE';

export default function () {
  const token = requireGatewayToken();
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  let sessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || 'main';
  const createDisposableSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION') || boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSIONS');
  const rowNonce = nonce('R-CW-CHILD');
  const inv = manifest?.invocation || {};
  if (!token) {
    failures.add(1);
    return;
  }
  if (manifest) validateManifest(manifest);
  const evidence = {
    row: ROW,
    producer: true,
    not_unit_dispatch_proof: true,
    hop_two_under_child: true,
    nonce: rowNonce,
    sessionKey,
    session_created: false,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    runtimeSha: __ENV.OPENCLAW_RUNTIME_BUILD_SHA || 'unset',
    started: new Date().toISOString(),
    tool_invoke_accepted: false,
    child_session_created: false,
    hop_two_completed_under_child: false,
    parent_only_completion: false,
    trace_id: null,
    redacted_events: [],
  };
  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    function startProofFlow(socket) {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      socket.setTimeout(() => {
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message:
            `${HARNESS_MARKER} Call continue_delegate with mode="silent-wake" ` +
            `task="You are child nonce ${rowNonce}. Call continue_work with delaySeconds=${inv.cwDelaySeconds || inv.childDelaySeconds || 5} ` +
            `reason=k6-child-hop-two-${rowNonce}. After continue_work is scheduled, reply exactly CHILD-HOP2-SCHEDULED ${rowNonce}. ` +
            `On the delayed wake (hop two, this child session) reply exactly CHILD-HOP2-COMPLETE ${rowNonce}." ` +
            `After continue_delegate reports the child, reply exactly PARENT-DELEGATED ${rowNonce}. ` +
            `Do not complete hop two yourself. Do not mutate files.`,
          idempotencyKey: `${inv.idempotencyKeyPrefix || 'R-CW-CHILD-LIVE'}-${rowNonce}`,
        });
      }, 500);
      socket.setTimeout(() => socket.close(), 170000);
    }
    socket.on('open', () => {
      socket.send(connectFrame(token));
      if (createDisposableSession) {
        socket.setTimeout(() => {
          tracker.send(socket, 'sessions.create', {
            key: disposableSessionKey('r-cw-child-live', rowNonce),
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
          if (text.includes('child') && (text.includes('session') || text.includes('key'))) {
            evidence.child_session_created = true;
          }
          if (text.includes(`CHILD-HOP2-COMPLETE ${rowNonce}`)) {
            evidence.hop_two_completed_under_child = true;
            evidence.child_session_created = true;
          }
          if (text.includes(`PARENT-HOP2-COMPLETE ${rowNonce}`)) {
            evidence.parent_only_completion = true;
          }
        }
        if (evidence.tool_invoke_accepted && evidence.hop_two_completed_under_child && !evidence.parent_only_completion) {
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
  const ok = evidence.tool_invoke_accepted && evidence.hop_two_completed_under_child && !evidence.parent_only_completion;
  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'tool-invoke-accepted': () => evidence.tool_invoke_accepted,
    'hop-two-under-child': () => evidence.hop_two_completed_under_child,
    'not-parent-only': () => !evidence.parent_only_completion,
  });
  if (!ok) failures.add(1);
  console.log(`\n--- ${ROW} EVIDENCE ---\n${JSON.stringify(evidence, null, 2)}\n--- END ---`);
  console.log(`[${ROW}] VERDICT: ${ok ? 'PASS-candidate' : 'PARTIAL-candidate'} (diagnostic unless exact final SHA)`);
}

export function handleSummary(data) {
  const passRate = data.metrics.proof_failures?.values?.count === 0;
  return {
    stdout: `\n[${ROW}] ${passRate ? 'PASS-candidate' : 'PARTIAL-candidate'}\n`,
    'r-cw-delegate-child-live-producer-summary.json': JSON.stringify({
      row: ROW,
      sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
      verdict: passRate ? 'PASS-candidate' : 'PARTIAL-candidate',
      producer: true,
    }, null, 2),
  };
}
