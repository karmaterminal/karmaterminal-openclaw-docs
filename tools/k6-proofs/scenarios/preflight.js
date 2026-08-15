/**
 * Scenario: preflight — read-only gateway/session/tool inventory.
 *
 * Verifies the proof harness can authenticate to the target gateway and collect
 * the basic session/tool inventory needed before firing live proof rows. This
 * scenario is intentionally non-mutating and safe for workflow dry-runs.
 *
 * Manifest-driven: reads row config from OPENCLAW_ROW_MANIFEST env var when set.
 * References:
 *   - Issue: karmaterminal/karmaterminal-openclaw-docs#101
 *   - Manifest: tools/k6-proofs/manifests/preflight.example.json
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { recordClassifiedEvent } from '../lib/proof-session.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';

export const options = {
  scenarios: {
    preflight_inventory: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '45s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    preflight_duration: ['p(95)<30000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('preflight_duration');

const manifest = loadManifestFromEnv();
const DEFAULTS = {
  sessionKey: 'main',
  seat: 'ci-runner',
};

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const sessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || DEFAULTS.sessionKey;
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || DEFAULTS.seat;

  if (!token) {
    console.error('OPENCLAW_GATEWAY_TOKEN is required');
    failures.add(1);
    return;
  }

  if (manifest) {
    const errors = validateManifest(manifest);
    if (errors.length > 0) {
      console.warn(`Manifest validation warnings: ${errors.join('; ')}`);
    }
  }

  const evidence = {
    row: 'preflight',
    manifest_loaded: !!manifest,
    seat,
    sessionKey,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(),
    connected: false,
    sessions_list_ok: false,
    tools_effective_ok: false,
    tool_inventory_count: 0,
    redacted_events: [],
  };

  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();

    socket.on('open', () => {
      evidence.connected = true;
      socket.send(connectFrame(token));

      socket.setTimeout(() => tracker.send(socket, 'sessions.list', { limit: 10 }), 500);
      socket.setTimeout(() => tracker.send(socket, 'tools.effective', { sessionKey }), 1000);
      socket.setTimeout(() => socket.close(), 12000);
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        const classified = tracker.classify(msg);
        recordClassifiedEvent(evidence, classified, redactEvent);

        if (classified.kind === 'response' && classified.method === 'sessions.list') {
          evidence.sessions_list_ok = classified.ok;
          if (!classified.ok) {
            console.error(`sessions.list failed: ${JSON.stringify(classified.error)}`);
            failures.add(1);
          }
        }

        if (classified.kind === 'response' && classified.method === 'tools.effective') {
          evidence.tools_effective_ok = classified.ok;
          const tools = classified.payload?.tools || classified.payload?.items || [];
          evidence.tool_inventory_count = Array.isArray(tools) ? tools.length : 0;
          if (!classified.ok) {
            console.error(`tools.effective failed: ${JSON.stringify(classified.error)}`);
            failures.add(1);
          }
        }

        if (evidence.sessions_list_ok && evidence.tools_effective_ok) {
          socket.close();
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
    'sessions.list accepted': () => evidence.sessions_list_ok,
    'tools.effective accepted': () => evidence.tools_effective_ok,
  });

  if (!evidence.sessions_list_ok || !evidence.tools_effective_ok) {
    failures.add(1);
  }

  console.log(`PREFLIGHT_EVIDENCE ${JSON.stringify(evidence)}`);
}
