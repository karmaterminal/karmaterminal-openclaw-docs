/**
 * Scenario: R-CONFIG-DEFAULTS — direct, read-only operator-RPC receipt.
 *
 * This row intentionally exercises Gateway's `config.get` RPC at its real
 * operator surface. It must not ask a disposable agent to invoke the
 * owner-only `gateway` tool: non-owner sender policy correctly removes that
 * tool, which made the previous LLM/sentinel harness incapable of observing
 * the config response.
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';

export const options = {
  scenarios: { r_config_defaults: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '45s' } },
  thresholds: { proof_failures: ['count==0'], r_config_defaults_duration: ['p(95)<30000'] },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_config_defaults_duration');
const manifest = loadManifestFromEnv();

function readContinuation(payload) {
  const continuation = payload?.config?.agents?.defaults?.continuation;
  if (!continuation || typeof continuation !== 'object') return null;
  const enabled = continuation.enabled;
  const maxChainLength = continuation.maxChainLength;
  const maxDelegatesPerTurn = continuation.maxDelegatesPerTurn;
  const costCapTokens = continuation.costCapTokens;
  if (typeof enabled !== 'boolean' || !Number.isFinite(maxChainLength) ||
      !Number.isFinite(maxDelegatesPerTurn) || !Number.isFinite(costCapTokens)) return null;
  return { enabled, maxChainLength, maxDelegatesPerTurn, costCapTokens };
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
    row: 'R-CONFIG-DEFAULTS', manifest_loaded: !!manifest, seat,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(),
    rpc: { method: 'config.get', operator_surface: true, response_ok: false,
      response_shape: { config_present: false, continuation_present: false } },
    config_read: false, enabled: null, max_chain_length: null,
    max_delegates_per_turn: null, cost_cap_tokens: null,
    trace_id: null, correlation: { service: `${seat}-prince`, query_window_start: null, query_window_end: null },
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
        evidence.redacted_events.push({ ts: Date.now(), kind: classified.kind, method: classified.method || null,
          event: classified.event || null, ok: classified.ok !== undefined ? classified.ok : null,
          data: classified.payload ? redactEvent(classified.payload) : null });
        if (classified.kind !== 'response' || classified.method !== 'config.get') return;
        evidence.rpc.response_ok = classified.ok;
        evidence.rpc.response_shape.config_present = Boolean(classified.payload?.config);
        const continuation = readContinuation(classified.payload);
        evidence.rpc.response_shape.continuation_present = continuation !== null;
        if (continuation) {
          evidence.config_read = true;
          evidence.enabled = continuation.enabled;
          evidence.max_chain_length = continuation.maxChainLength;
          evidence.max_delegates_per_turn = continuation.maxDelegatesPerTurn;
          evidence.cost_cap_tokens = continuation.costCapTokens;
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
    'all continuation defaults observed': () => evidence.enabled !== null && evidence.max_chain_length !== null && evidence.max_delegates_per_turn !== null && evidence.cost_cap_tokens !== null,
  });
  if (!evidence.config_read) failures.add(1);
  console.log('\n--- R-CONFIG-DEFAULTS EVIDENCE SUMMARY ---');
  console.log(JSON.stringify(evidence, null, 2));
  console.log('--- END EVIDENCE ---');
  console.log(`\n[R-CONFIG-DEFAULTS] VERDICT: ${evidence.config_read ? 'PASS-candidate' : 'PARTIAL-candidate'}`);
}

export function handleSummary(data) {
  const passRate = data.metrics.proof_failures?.values?.count === 0;
  return { stdout: `\n[R-CONFIG-DEFAULTS] Summary: ${passRate ? 'PASS-candidate' : 'PARTIAL-candidate'} | SHA: ${__ENV.OPENCLAW_CANDIDATE_SHA || 'unset'} | Seat: ${__ENV.OPENCLAW_SEAT_NAME || 'unknown-seat'}\n` };
}
