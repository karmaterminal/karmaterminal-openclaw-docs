/**
 * Scenario: R-CONFIG-INTERSESSION — direct, read-only operator-RPC receipt.
 *
 * This tests the actual `config.get` RPC surface and projects only the single
 * safe crossSessionTargeting value. It deliberately does not use a model or a
 * disposable agent, because the agent-facing gateway tool is owner-only.
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { recordClassifiedEvent } from '../lib/proof-session.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';

export const options = {
  scenarios: { r_config_intersession: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '45s' } },
  thresholds: { proof_failures: ['count==0'], r_config_intersession_duration: ['p(95)<30000'] },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_config_intersession_duration');
const manifest = loadManifestFromEnv();

function readCrossSessionTargeting(payload) {
  const value = payload?.config?.agents?.defaults?.continuation?.crossSessionTargeting;
  // This row is specifically evidence that the configured opt-in is enabled.
  // A non-empty fallback value such as "disabled" proves the RPC response
  // shape, but must not satisfy the cross-session-targeting requirement.
  return value === 'enabled' ? value : null;
}

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || 'unknown-seat';
  if (!token) { failures.add(1); return; }
  if (manifest) {
    const errors = validateManifest(manifest);
    if (errors.length) console.warn(`Manifest validation warnings: ${errors.join('; ')}`);
  }

  const evidence = {
    row: 'R-CONFIG-INTERSESSION', manifest_loaded: !!manifest, seat,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(),
    rpc: { method: 'config.get', operator_surface: true, response_ok: false,
      response_shape: { config_present: false, continuation_present: false } },
    config_read: false, cross_session_targeting: null, trace_id: null,
    correlation: { service: `${seat}-prince`, query_window_start: null, query_window_end: null },
    redacted_events: [],
  };
  const started = Date.now();
  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    socket.on('open', () => {
      socket.send(connectFrame(token));
      socket.setTimeout(() => tracker.send(socket, 'config.get', {}), 300);
      socket.setTimeout(() => socket.close(), 15000);
    });
    socket.on('message', (raw) => {
      try {
        const classified = tracker.classify(JSON.parse(raw));
        recordClassifiedEvent(evidence, classified, redactEvent);
        if (classified.kind !== 'response' || classified.method !== 'config.get') return;
        evidence.rpc.response_ok = classified.ok;
        evidence.rpc.response_shape.config_present = Boolean(classified.payload?.config);
        const crossSessionTargeting = readCrossSessionTargeting(classified.payload);
        evidence.rpc.response_shape.continuation_present = crossSessionTargeting !== null;
        if (crossSessionTargeting !== null) {
          evidence.config_read = true;
          evidence.cross_session_targeting = crossSessionTargeting;
        } else failures.add(1);
        socket.close();
      } catch (error) { console.warn(`parse error: ${error}`); failures.add(1); socket.close(); }
    });
    socket.on('error', () => { failures.add(1); });
  });
  evidence.ended = new Date().toISOString();
  evidence.duration_ms = Date.now() - started;
  evidence.correlation.query_window_start = evidence.started;
  evidence.correlation.query_window_end = evidence.ended;
  duration.add(evidence.duration_ms);
  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'direct operator config.get succeeded': () => evidence.config_read,
    'cross-session targeting explicitly enabled': () => evidence.cross_session_targeting === 'enabled',
  });
  if (!evidence.config_read) failures.add(1);
  console.log('\n--- R-CONFIG-INTERSESSION EVIDENCE SUMMARY ---');
  console.log(JSON.stringify(evidence, null, 2));
  console.log('--- END EVIDENCE ---');
  console.log(`\n[R-CONFIG-INTERSESSION] VERDICT: ${evidence.config_read ? 'PASS-candidate' : 'PARTIAL-candidate'}`);
}

export function handleSummary(data) {
  const passRate = data.metrics.proof_failures?.values?.count === 0;
  return { stdout: `\n[R-CONFIG-INTERSESSION] Summary: ${passRate ? 'PASS-candidate' : 'PARTIAL-candidate'} | SHA: ${__ENV.OPENCLAW_CANDIDATE_SHA || 'unset'} | Seat: ${__ENV.OPENCLAW_SEAT_NAME || 'unknown-seat'}\n` };
}
