/**
 * Scenario: R-CONFIG-defaults — read-only continuation config/defaults receipt.
 *
 * Drives an agent turn in a disposable session that calls the typed gateway
 * config.get tool for agents.defaults.continuation and emits a nonce-correlated
 * CONFIG-DEFAULTS sentinel with selected read-only values.
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';

export const options = {
  scenarios: {
    r_config_defaults: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '90s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_config_defaults_duration: ['p(95)<75000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_config_defaults_duration');
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
  const createDisposableSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION') || true;
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx';
  const rowNonce = nonce('R-CONFIG-defaults');

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
    row: 'R-CONFIG-defaults',
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
    config_read: false,
    enabled: null,
    max_chain_length: null,
    max_delegates_per_turn: null,
    cost_cap_tokens: null,
    trace_id: null,
    redacted_events: [],
  };

  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();

    function startProofFlow() {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      socket.setTimeout(() => {
        const instruction =
          `${HARNESS_MARKER} For Project 81 row R-CONFIG-defaults nonce ${rowNonce}: ` +
          `call the gateway tool with action=config.get path=agents.defaults.continuation. ` +
          `If the config read succeeds, reply exactly CONFIG-DEFAULTS ${rowNonce} ENABLED <enabled> MAXCHAIN <maxChainLength> MAXDELEGATES <maxDelegatesPerTurn> COSTCAP <costCapTokens>. ` +
          `If the read fails, reply exactly CONFIG-DEFAULTS-FAIL ${rowNonce}. No other action.`;
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message: instruction,
          idempotencyKey: `R-CONFIG-defaults-${rowNonce}`,
        });
      }, 500);
      socket.setTimeout(() => socket.close(), 60000);
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));
      if (createDisposableSession) {
        socket.setTimeout(() => {
          const disposableKey = `r-config-defaults-${rowNonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          tracker.send(socket, 'sessions.create', { key: disposableKey, label: `k6 R-CONFIG-defaults ${rowNonce}` });
        }, 250);
      } else {
        socket.setTimeout(startProofFlow, 500);
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
            console.log('✓ sessions.send accepted — agent turn triggered for config defaults read');
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
            } else if (eventStr.includes(`CONFIG-DEFAULTS ${rowNonce}`)) {
              evidence.config_read = true;
              const enabled = eventStr.match(/ENABLED[^A-Za-z0-9]+(true|false)/)?.[1] || null;
              const maxChain = eventStr.match(/MAXCHAIN[^0-9]+(\d+)/)?.[1] || null;
              const maxDelegates = eventStr.match(/MAXDELEGATES[^0-9]+(\d+)/)?.[1] || null;
              const costCap = eventStr.match(/COSTCAP[^0-9]+(\d+)/)?.[1] || null;
              evidence.enabled = enabled === null ? null : enabled === 'true';
              evidence.max_chain_length = maxChain ? Number(maxChain) : null;
              evidence.max_delegates_per_turn = maxDelegates ? Number(maxDelegates) : null;
              evidence.cost_cap_tokens = costCap ? Number(costCap) : null;
              console.log(`✓ CONFIG-DEFAULTS sentinel observed: enabled=${enabled} maxChain=${maxChain} maxDelegates=${maxDelegates} costCap=${costCap}`);
              socket.close();
            } else if (eventStr.includes(`CONFIG-DEFAULTS-FAIL ${rowNonce}`)) {
              console.error('✗ CONFIG-DEFAULTS-FAIL sentinel observed');
              failures.add(1);
              socket.close();
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
    'config read succeeded': () => evidence.config_read,
    'enabled byte observed': () => evidence.enabled !== null,
    'chain/delegate/cost bytes observed': () => evidence.max_chain_length !== null && evidence.max_delegates_per_turn !== null && evidence.cost_cap_tokens !== null,
  });

  if (!evidence.dispatch_accepted || !evidence.config_read || evidence.enabled === null || evidence.max_chain_length === null || evidence.max_delegates_per_turn === null || evidence.cost_cap_tokens === null) {
    failures.add(1);
  }

  console.log(`\n--- R-CONFIG-defaults EVIDENCE SUMMARY ---`);
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`--- END EVIDENCE ---`);
  console.log(`\n[R-CONFIG-defaults] VERDICT: ${evidence.config_read ? 'PASS-candidate' : 'PARTIAL-candidate'}`);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const passRate = data.metrics.proof_failures?.values?.count === 0;
  const summary = {
    row: 'R-CONFIG-defaults',
    sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    seat: __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx',
    timestamp,
    verdict: passRate ? 'PASS-candidate' : 'PARTIAL-candidate',
    metrics: {
      duration_ms: data.metrics.r_config_defaults_duration?.values || null,
      failures: data.metrics.proof_failures?.values?.count || 0,
    },
  };
  return {
    stdout: `\n[R-CONFIG-defaults] Summary: ${summary.verdict} | SHA: ${summary.sha} | Seat: ${summary.seat}\n`,
    'r-config-defaults-summary.json': JSON.stringify(summary, null, 2),
  };
}
