/**
 * Scenario: R-OBS-status — read-only gateway status/observer receipt.
 *
 * Converts the historical scaffold into a manifest-driven k6 row. It only
 * authenticates to the gateway and requests operator status; it does not fire
 * continuation tools, mutate files, or dispatch agents.
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';

export const options = {
  scenarios: {
    r_obs_status: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '30s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_obs_status_duration: ['p(95)<20000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_obs_status_duration');
const manifest = loadManifestFromEnv();
const rowId = manifest?.rowId || 'R-OBS-status';

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const seat = (manifest && manifest.seat) || __ENV.OPENCLAW_SEAT_NAME || 'ci-runner';
  const candidateSha = (manifest && manifest.candidateSha) || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset';
  const started = Date.now();

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
    row: rowId,
    manifest_loaded: !!manifest,
    seat,
    candidateSha,
    started: new Date().toISOString(),
    connected: false,
    connect_ok: false,
    status_ok: false,
    status_payload: null,
    trace_id: null,
    redacted_events: [],
  };

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();

    socket.on('open', () => {
      evidence.connected = true;
      socket.send(connectFrame(token));
      socket.setTimeout(() => tracker.send(socket, 'status', {}), 500);
      socket.setTimeout(() => socket.close(), 10000);
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

        if (classified.kind === 'other' && msg.type === 'res' && !msg.error) {
          evidence.connect_ok = true;
        }

        if (classified.kind === 'response' && classified.method === 'status') {
          evidence.status_ok = classified.ok;
          evidence.status_payload = classified.payload ? redactEvent(classified.payload) : null;
          if (classified.payload && classified.payload.traceparent) {
            const parts = String(classified.payload.traceparent).split('-');
            evidence.trace_id = parts.length > 1 ? parts[1] : null;
          }
          if (!classified.ok) {
            console.error(`status failed: ${JSON.stringify(classified.error)}`);
            failures.add(1);
          }
          socket.close();
        }
      } catch (err) {
        console.warn(`parse error: ${err}`);
      }
    });

    socket.on('error', (err) => {
      console.error(`ws error: ${err && err.error ? err.error() : err}`);
      failures.add(1);
    });
  });

  evidence.ended = new Date().toISOString();
  evidence.duration_ms = Date.now() - started;
  duration.add(evidence.duration_ms);

  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'connect accepted': () => evidence.connect_ok,
    'status accepted': () => evidence.status_ok,
  });

  if (!evidence.connect_ok || !evidence.status_ok) failures.add(1);

  console.log(`R_OBS_STATUS_EVIDENCE ${JSON.stringify(evidence)}`);
}

export function handleSummary(data) {
  const failureMetric = data.metrics.proof_failures && data.metrics.proof_failures.values;
  const failuresCount = failureMetric ? failureMetric.count : 0;
  return {
    'r-obs-status-summary.json': JSON.stringify({
      row: rowId,
      sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
      verdict: failuresCount === 0 ? 'PASS-candidate' : 'FAIL-candidate',
      metrics: {
        failures: failuresCount,
        duration_ms: data.metrics.r_obs_status_duration ? data.metrics.r_obs_status_duration.values : null,
      },
    }, null, 2),
  };
}
