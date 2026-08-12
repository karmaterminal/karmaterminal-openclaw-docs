/**
 * Scenario: R-OBS-1 — status-card observability via session_status tool.
 *
 * This is the k6 candidate counterpart to the manual R-OBS-1 corpus row. It
 * creates a disposable session, asks the agent to call the session_status tool,
 * and requires a nonce-correlated sentinel confirming that the status card
 * exposed the expected read-only observability fields. It does not fire
 * continuation tools, mutate config, or dispatch delegates.
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent, assertConnected } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';

export const options = {
  scenarios: {
    r_obs_1: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '90s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_obs_1_duration: ['p(95)<75000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_obs_1_duration');
const manifest = loadManifestFromEnv();
const HARNESS_MARKER = '[k6-proof-harness]';

function boolEnv(name, defaultValue = false) {
  const raw = __ENV[name];
  if (raw === undefined || raw === '') return defaultValue;
  return String(raw).toLowerCase() === 'true';
}

function parseObsSentinel(text, nonceValue) {
  const idx = text.lastIndexOf(`OBS1-STATUS ${nonceValue}`);
  if (idx === -1) return null;
  const tail = text.slice(idx);
  const build = tail.match(/BUILD\s+(yes|no)/i)?.[1]?.toLowerCase() || null;
  const context = tail.match(/CONTEXT\s+(yes|no)/i)?.[1]?.toLowerCase() || null;
  const chain = tail.match(/CHAIN\s+(yes|no)/i)?.[1]?.toLowerCase() || null;
  const route = tail.match(/ROUTE\s+(yes|no)/i)?.[1]?.toLowerCase() || null;
  if (!build || !context || !chain || !route) return null;
  return { build, context, chain, route };
}

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const requestedSessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || 'main';
  let sessionKey = requestedSessionKey;
  const createDisposableSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION', true);
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || 'ci-runner';
  const rowNonce = nonce('R-OBS-1');

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
    row: 'R-OBS-1',
    manifest_loaded: !!manifest,
    nonce: rowNonce,
    seat,
    requestedSessionKey,
    sessionKey,
    session_created: false,
    created_session_key: null,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(),
    dispatch_accepted: false,
    status_card_observed: false,
    build_visible: false,
    context_visible: false,
    continuation_chain_visible: false,
    route_visible: false,
    trace_id: null,
    redacted_events: [],
  };

  const started = Date.now();
  const nonceEventText = [];
  let loggedPartialSentinel = false;

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();

    function startProofFlow() {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      socket.setTimeout(() => {
        const instruction =
          `${HARNESS_MARKER} For Project 81 row R-OBS-1 nonce ${rowNonce}: ` +
          `call the session_status tool for the current session. Inspect the returned status card. ` +
          `Then reply exactly: OBS1-STATUS ${rowNonce} BUILD <yes|no> CONTEXT <yes|no> CHAIN <yes|no> ROUTE <yes|no>. ` +
          `Use yes only if the status card exposes that field family: build/version, context usage, continuation chain/queue visibility, and active route/delivery context. No other action.`;
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message: instruction,
          idempotencyKey: `R-OBS-1-${rowNonce}`,
        });
      }, 500);
      socket.setTimeout(() => socket.close(), 60000);
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));
      if (createDisposableSession) {
        socket.setTimeout(() => {
          const disposableKey = `r-obs-1-${rowNonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          tracker.send(socket, 'sessions.create', { key: disposableKey, label: `k6 R-OBS-1 ${rowNonce}` });
        }, 250);
      } else {
        socket.setTimeout(startProofFlow, 500);
      }
    });

  // Rig-fault guard (see assertConnected): a refused WS upgrade yields an
  // artefact identical to a genuine failure — 0 ms, every flag false. Record
  // it so this row is never published as evidence about the feature.
  const connectFault = assertConnected(res);
  if (connectFault) evidence.connect_failed = connectFault;

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
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
            evidence.dispatch_accepted = true;
            if (classified.payload?.traceId) evidence.trace_id = classified.payload.traceId;
            console.log('✓ sessions.send accepted — agent turn triggered for R-OBS-1 status-card read');
          } else {
            console.error(`✗ sessions.send rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
          }
        }

        if (classified.kind === 'event') {
          const eventStr = JSON.stringify(classified.data || {});
          if (eventStr.includes(rowNonce)) {
            if (eventStr.includes(HARNESS_MARKER)) {
              console.log('ℹ Ignoring harness prompt echo event');
            } else {
              nonceEventText.push(eventStr);
              const observedText = nonceEventText.join(' ');
              const sentinel = parseObsSentinel(observedText, rowNonce);
              if (sentinel) {
                evidence.status_card_observed = true;
                evidence.build_visible = sentinel.build === 'yes';
                evidence.context_visible = sentinel.context === 'yes';
                evidence.continuation_chain_visible = sentinel.chain === 'yes';
                evidence.route_visible = sentinel.route === 'yes';
                console.log(`✓ OBS1-STATUS sentinel observed: ${JSON.stringify(sentinel)}`);
                socket.close();
              } else if (eventStr.includes(`OBS1-STATUS ${rowNonce}`) && !loggedPartialSentinel) {
                loggedPartialSentinel = true;
                console.log('ℹ OBS1-STATUS sentinel prefix observed; waiting for complete streamed sentinel');
              }
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
    'dispatch accepted': () => evidence.dispatch_accepted,
    'status card sentinel observed': () => evidence.status_card_observed,
    'build/context/chain/route visible': () => evidence.build_visible && evidence.context_visible && evidence.continuation_chain_visible && evidence.route_visible,
  });

  if (!evidence.dispatch_accepted || !evidence.status_card_observed || !evidence.build_visible || !evidence.context_visible || !evidence.continuation_chain_visible || !evidence.route_visible) {
    failures.add(1);
  }

  console.log(`R_OBS_1_EVIDENCE ${JSON.stringify(evidence)}`);
}

export function handleSummary(data) {
  const failureMetric = data.metrics.proof_failures && data.metrics.proof_failures.values;
  const failuresCount = failureMetric ? failureMetric.count : 0;
  return {
    'r-obs-1-summary.json': JSON.stringify({
      row: 'R-OBS-1',
      sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
      verdict: failuresCount === 0 ? 'PASS-candidate' : 'FAIL-candidate',
      metrics: {
        failures: failuresCount,
        duration_ms: data.metrics.r_obs_1_duration ? data.metrics.r_obs_1_duration.values : null,
      },
    }, null, 2),
  };
}
