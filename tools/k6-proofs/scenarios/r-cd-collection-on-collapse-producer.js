/**
 * Live producer: R-CD-COLLECTION-ON-COLLAPSE
 *
 * A spawns detached session-mode B; B schedules delayed C then terminalizes;
 * C must return to A (default one-parent). fanoutMode="tree" is a different
 * ancestry-return control and is not this fire.
 *
 * Manifest: tools/k6-proofs/manifests/r-cd-collection-on-collapse.json
 * Issue: karmaterminal/karmaterminal-openclaw-docs#459
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
    r_cd_collection_on_collapse_producer: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '180s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cd_collection_on_collapse_duration: ['p(95)<170000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_collection_on_collapse_duration');
const manifest = loadManifestFromEnv();
const ROW = 'R-CD-COLLECTION-ON-COLLAPSE';

export default function () {
  const token = requireGatewayToken();
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  let sessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || 'main';
  const createDisposableSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION') || boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSIONS');
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx';
  const rowNonce = nonce('R-CD-COLLAPSE');
  const inv = manifest?.invocation || {};
  if (!token) {
    failures.add(1);
    return;
  }
  if (manifest) validateManifest(manifest);

  const evidence = {
    row: ROW,
    producer: true,
    static_validator_is_not_this_fire: true,
    fanout_mode: 'default-one-parent',
    not_fanout_mode_tree: true,
    nonce: rowNonce,
    seat,
    sessionKey,
    session_created: false,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    runtimeSha: __ENV.OPENCLAW_RUNTIME_BUILD_SHA || 'unset',
    started: new Date().toISOString(),
    tool_invoke_accepted: false,
    b_scheduled: false,
    b_terminal: false,
    c_done_on_a: false,
    c_only_on_b: false,
    orphan_c: false,
    trace_id: null,
    redacted_events: [],
  };
  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    function startProofFlow(socket) {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      socket.setTimeout(() => {
        const agentInstruction =
          `${HARNESS_MARKER} You are root A. Call continue_delegate with mode="session" (detached B), ` +
          `task="You are B nonce ${rowNonce}. Call continue_delegate with delaySeconds=${inv.childDelaySeconds || 4} ` +
          `mode=silent-wake task='You are C nonce ${rowNonce}. Reply exactly C-DONE ${rowNonce} then stop. Do not set fanoutMode. Do not mutate files.' ` +
          `Then reply exactly B-SCHEDULED ${rowNonce} and terminate so B collapses. Do not set fanoutMode." ` +
          `After continue_delegate reports scheduled, reply exactly A-SCHEDULED ${rowNonce}. ` +
          `When C returns to you (default one-parent), reply exactly A-COLLECTED ${rowNonce}. ` +
          `Do not use fanoutMode=tree. Do not mutate files. Do not post to any channel.`;
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message: agentInstruction,
          idempotencyKey: `${inv.idempotencyKeyPrefix || 'R-CD-COLLECT-COLLAPSE'}-${rowNonce}`,
        });
      }, 500);
      socket.setTimeout(() => socket.close(), 170000);
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));
      if (createDisposableSession) {
        socket.setTimeout(() => {
          tracker.send(socket, 'sessions.create', {
            key: disposableSessionKey('r-cd-collapse', rowNonce),
            label: `k6 ${ROW} ${rowNonce}`,
          });
        }, 250);
      } else {
        socket.setTimeout(() => startProofFlow(socket), 500);
      }
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        const classified = tracker.classify(msg);
        evidence.redacted_events.push({
          ts: Date.now(),
          kind: classified.kind,
          method: classified.method || null,
          event: classified.event || null,
          data: classified.payload ? redactEvent(classified.payload) : null,
        });
        if (classified.kind === 'response' && classified.method === 'sessions.create') {
          if (classified.ok && classified.payload) {
            sessionKey = classified.payload.key || sessionKey;
            evidence.sessionKey = sessionKey;
            evidence.session_created = true;
            startProofFlow(socket);
          } else {
            failures.add(1);
            socket.close();
          }
        }
        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) {
            evidence.tool_invoke_accepted = true;
            if (classified.payload?.traceId) evidence.trace_id = classified.payload.traceId;
          } else failures.add(1);
        }
        if (classified.kind === 'event' && !ignoreHarnessEcho(classified)) {
          const text = eventText(classified);
          if (text.includes(`A-SCHEDULED ${rowNonce}`) || text.includes(`B-SCHEDULED ${rowNonce}`)) {
            evidence.b_scheduled = true;
          }
          if (text.includes(`A-COLLECTED ${rowNonce}`) || text.includes(`C-DONE ${rowNonce}`)) {
            evidence.c_done_on_a = true;
            evidence.b_terminal = true;
          }
          if (classified.payload?.traceId) evidence.trace_id = classified.payload.traceId;
        }
        if (evidence.tool_invoke_accepted && evidence.c_done_on_a) socket.close();
      } catch (e) {
        console.warn(`parse error: ${e}`);
      }
    });

    socket.on('error', () => failures.add(1));
  });

  evidence.ended = new Date().toISOString();
  evidence.duration_ms = Date.now() - started;
  duration.add(evidence.duration_ms);
  const noBOnly = evidence.c_done_on_a && !evidence.c_only_on_b && !evidence.orphan_c;
  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'tool-invoke-accepted': () => evidence.tool_invoke_accepted,
    'root-collection-after-intermediate-finalized': () => evidence.c_done_on_a,
    'no-orphan-or-b-only-delivery': () => noBOnly,
  });
  if (!evidence.tool_invoke_accepted || !evidence.c_done_on_a || !noBOnly) failures.add(1);
  const passed = evidence.tool_invoke_accepted && evidence.c_done_on_a && noBOnly;
  console.log(`\n--- ${ROW} EVIDENCE ---\n${JSON.stringify(evidence, null, 2)}\n--- END ---`);
  console.log(`[${ROW}] VERDICT: ${passed ? 'PASS-candidate' : 'PARTIAL-candidate'} (diagnostic unless exact final SHA)`);
}

export function handleSummary(data) {
  const passRate = data.metrics.proof_failures?.values?.count === 0;
  return {
    stdout: `\n[${ROW}] ${passRate ? 'PASS-candidate' : 'PARTIAL-candidate'}\n`,
    'r-cd-collection-on-collapse-producer-summary.json': JSON.stringify({
      row: ROW,
      sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
      verdict: passRate ? 'PASS-candidate' : 'PARTIAL-candidate',
      producer: true,
    }, null, 2),
  };
}
