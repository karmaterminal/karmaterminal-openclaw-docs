import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

export const options = {
  scenarios: {
    preflight: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '30s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    proof_row_duration_ms: ['p(95)<30000'],
  },
};

const failures = new Counter('proof_failures');
const rowDuration = new Trend('proof_row_duration_ms');

const manifestPath = __ENV.K6_PROOF_MANIFEST || 'tools/k6-proofs/manifests/preflight.example.json';
const manifest = JSON.parse(open(manifestPath));
const offline = (__ENV.K6_PROOFS_OFFLINE || '').toLowerCase() === '1' || manifest.transport === 'offline';

function req(id, method, params = {}) {
  return JSON.stringify({ type: 'req', id, method, params });
}

function runId() {
  return __ENV.K6_PROOF_RUN_ID || `k6-run-${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`;
}

function validateManifestShape() {
  const required = [
    'schema',
    'rowId',
    'candidateSha',
    'seat',
    'sessionKey',
    'transport',
    'toolSurface',
    'mutates',
    'timeoutSeconds',
    'expectedReceipts',
    'artifactDestination',
    'review',
  ];
  return required.every((key) => Object.prototype.hasOwnProperty.call(manifest, key)) &&
    manifest.schema === 'openclaw.k6.proof-row-manifest.v1' &&
    manifest.mutates === false &&
    manifest.review && manifest.review.candidateOnly === true && manifest.review.foldRequiresReview === true;
}

export default function () {
  const started = Date.now();
  const shapeOk = validateManifestShape();
  check({ shapeOk, manifest }, {
    'manifest has required candidate-only shape': (v) => v.shapeOk,
    'preflight manifest is non-mutating': (v) => v.manifest.mutates === false,
    'candidate SHA is full length': (v) => /^[0-9a-f]{40}$/.test(v.manifest.candidateSha),
  });
  if (!shapeOk) failures.add(1);

  if (offline) {
    console.log(JSON.stringify({
      kind: 'k6-proof-preflight-offline',
      runId: runId(),
      rowId: manifest.rowId,
      candidateSha: manifest.candidateSha,
      seat: manifest.seat,
      mutates: manifest.mutates,
      note: 'offline dry preflight: no gateway traffic, no proof verdict written',
    }));
    rowDuration.add(Date.now() - started);
    sleep(1);
    return;
  }

  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const sessionKey = __ENV.OPENCLAW_SESSION_KEY || manifest.sessionKey;

  check({ token, sessionKey }, {
    'gateway token supplied for live preflight': (v) => !!v.token,
    'session key supplied for live preflight': (v) => !!v.sessionKey && !String(v.sessionKey).includes('${'),
  });
  if (!token || !sessionKey || String(sessionKey).includes('${')) {
    failures.add(1);
    rowDuration.add(Date.now() - started);
    return;
  }

  const res = ws.connect(url, {}, (socket) => {
    socket.on('open', () => {
      socket.send(req('connect-1', 'connect', {
        minProtocol: 3,
        maxProtocol: 4,
        client: {
          id: 'k6-proof-harness',
          version: '0.1.0',
          platform: 'linux',
          mode: 'operator',
        },
        role: 'operator',
        scopes: ['operator.read'],
        caps: [],
        commands: [],
        permissions: {},
        auth: { token },
        userAgent: 'k6-proof-harness/0.1.0',
      }));

      socket.setTimeout(() => socket.send(req('health-1', 'health')), 250);
      socket.setTimeout(() => socket.send(req('status-1', 'status')), 500);
      socket.setTimeout(() => socket.send(req('sessions-list-1', 'sessions.list', {})), 750);
      socket.setTimeout(() => socket.send(req('tools-effective-1', 'tools.effective', { sessionKey })), 1000);
      socket.setTimeout(() => socket.close(), manifest.timeoutSeconds * 1000);
    });

    socket.on('message', (raw) => {
      console.log(raw);
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'res' && msg.ok === false) failures.add(1);
      } catch (_) {
        failures.add(1);
      }
    });

    socket.on('error', (e) => {
      console.error(`ws error: ${e && e.error ? e.error() : e}`);
      failures.add(1);
    });
  });

  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  rowDuration.add(Date.now() - started);
  sleep(1);
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify({
      kind: 'k6-proof-summary',
      runId: runId(),
      rowId: manifest.rowId,
      candidateSha: manifest.candidateSha,
      seat: manifest.seat,
      offline,
      metrics: Object.keys(data.metrics || {}).sort(),
      candidateOnly: true,
    }, null, 2) + '\n',
  };
}
