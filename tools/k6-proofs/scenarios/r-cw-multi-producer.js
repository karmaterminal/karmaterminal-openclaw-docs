/**
 * Live producer: R-CW-MULTI
 * Staggered valid elections yield distinct wakes. Not fold/collapse.
 * Issue: karmaterminal/karmaterminal-openclaw-docs#482
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
    r_cw_multi_producer: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '240s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cw_multi_duration: ['p(95)<230000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cw_multi_duration');
const manifest = loadManifestFromEnv();
const ROW = 'R-CW-MULTI';

export default function () {
  const token = requireGatewayToken();
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  let sessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || 'main';
  const createDisposableSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION') || boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSIONS');
  const rowNonce = nonce('R-CW-MULTI');
  const inv = manifest?.invocation || {};
  if (!token) {
    failures.add(1);
    return;
  }
  if (manifest) validateManifest(manifest);
  const delays = inv.delaysSeconds || inv.staggerSeconds || [0, 60, 120];
  const evidence = {
    row: ROW,
    producer: true,
    not_collapse_row: true,
    staggerSeconds: delays,
    nonce: rowNonce,
    sessionKey,
    session_created: false,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    runtimeSha: __ENV.OPENCLAW_RUNTIME_BUILD_SHA || 'unset',
    started: new Date().toISOString(),
    tool_invoke_accepted: false,
    wakes: [],
    distinct_wake_count: 0,
    folded: false,
    observe_ms: Number(inv.observeMs ?? ((inv.observeSeconds || 130) * 1000)),
    trace_id: null,
    redacted_events: [],
  };
  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    function startProofFlow(socket) {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      socket.setTimeout(() => {
        const delayList = delays.join(',');
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message:
            `${HARNESS_MARKER} Schedule three continue_work elections with delaySeconds in [${delayList}] ` +
            `reasons k6-multi-${rowNonce}-t0, t60, t120. After all three are scheduled reply MULTI-SCHEDULED ${rowNonce}. ` +
            `On each distinct wake reply MULTI-WOKE ${rowNonce} <delay>. Do not fold. Do not collapse. Do not mutate files.`,
          idempotencyKey: `${inv.idempotencyKeyPrefix || 'R-CW-MULTI'}-${rowNonce}`,
        });
      }, 500);
      socket.setTimeout(() => socket.close(), Number(inv.observeMs ?? ((inv.observeSeconds || 130) * 1000)) + 20000);
    }
    socket.on('open', () => {
      socket.send(connectFrame(token));
      if (createDisposableSession) {
        socket.setTimeout(() => {
          tracker.send(socket, 'sessions.create', {
            key: disposableSessionKey('r-cw-multi', rowNonce),
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
          if (text.includes(`MULTI-WOKE ${rowNonce}`)) {
            evidence.wakes.push({ ts: Date.now(), text: text.slice(0, 200) });
            evidence.distinct_wake_count = evidence.wakes.length;
          }
          if (text.toLowerCase().includes('fold') || text.toLowerCase().includes('collapse')) {
            evidence.folded = true;
          }
        }
        if (evidence.tool_invoke_accepted && evidence.distinct_wake_count >= 3 && !evidence.folded) {
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
  const ok = evidence.tool_invoke_accepted && evidence.distinct_wake_count >= 3 && !evidence.folded;
  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'tool-invoke-accepted': () => evidence.tool_invoke_accepted,
    'three-distinct-wakes': () => evidence.distinct_wake_count >= 3,
    'not-folded': () => !evidence.folded,
  });
  if (!ok) failures.add(1);
  console.log(`\n--- ${ROW} EVIDENCE ---\n${JSON.stringify(evidence, null, 2)}\n--- END ---`);
  console.log(`[${ROW}] VERDICT: ${ok ? 'PASS-candidate' : 'PARTIAL-candidate'} (diagnostic unless exact final SHA)`);
}

export function handleSummary(data) {
  const passRate = data.metrics.proof_failures?.values?.count === 0;
  return {
    stdout: `\n[${ROW}] ${passRate ? 'PASS-candidate' : 'PARTIAL-candidate'}\n`,
    'r-cw-multi-producer-summary.json': JSON.stringify({
      row: ROW,
      sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
      verdict: passRate ? 'PASS-candidate' : 'PARTIAL-candidate',
      producer: true,
    }, null, 2),
  };
}
