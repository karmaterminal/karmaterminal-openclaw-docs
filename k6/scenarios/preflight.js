/**
 * Scenario 0: Preflight inventory.
 *
 * Proves the harness can authenticate and that the target session
 * exposes expected continuation tools.
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { connectFrame, frame } from '../lib/gateway-ws.js';

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
    preflight_failures: ['count==0'],
  },
};

const failures = new Counter('preflight_failures');

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const sessionKey = __ENV.OPENCLAW_SESSION_KEY || 'main';

  if (!token) {
    console.error('OPENCLAW_GATEWAY_TOKEN is required');
    failures.add(1);
    return;
  }

  const results = { health: null, tools: null, sessions: null };

  const res = ws.connect(url, {}, (socket) => {
    socket.on('open', () => {
      socket.send(connectFrame(token));
      socket.setTimeout(() => socket.send(frame('health')), 300);
      socket.setTimeout(() => socket.send(frame('sessions.list')), 600);
      socket.setTimeout(() => socket.send(frame('tools.effective', { sessionKey })), 900);
      socket.setTimeout(() => socket.close(), 8000);
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.method === 'health' || (msg.result && msg.result.uptime !== undefined)) {
          results.health = msg.result || msg;
        }
        if (msg.result && msg.result.tools) {
          results.tools = msg.result.tools;
        }
        if (msg.result && Array.isArray(msg.result.sessions)) {
          results.sessions = msg.result.sessions;
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

  check(res, { 'websocket connected': (r) => r && r.status === 101 });

  // Verify expected tools are visible
  if (results.tools) {
    const toolNames = Array.isArray(results.tools)
      ? results.tools.map((t) => t.name || t)
      : Object.keys(results.tools);

    const hasCW = toolNames.includes('continue_work');
    const hasCD = toolNames.includes('continue_delegate');
    const hasRC = toolNames.includes('request_compaction');

    check(null, {
      'continue_work visible': () => hasCW,
      'continue_delegate visible': () => hasCD,
      'request_compaction visible': () => hasRC,
    });

    if (!hasCW || !hasCD) {
      console.error(`Missing expected tools. Found: ${toolNames.join(', ')}`);
      failures.add(1);
    }
  } else {
    console.error('No tools response received');
    failures.add(1);
  }

  console.log(`Preflight complete. Health: ${JSON.stringify(results.health)}`);
}
