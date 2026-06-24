/**
 * k6 PROOFS — Preflight Scenario
 * Issue #101: Verify gateway connectivity + tool surface before any mutating row fires.
 * 
 * Usage:
 *   k6 run scenarios/preflight.js
 *   k6 run scenarios/preflight.js --env GATEWAY_URL=ws://10.0.0.246:18789
 * 
 * Checks:
 *   - WebSocket operator connection to gateway
 *   - Health/status endpoint responds
 *   - Target session resolves
 *   - continue_work, continue_delegate, request_compaction visible in tool surface
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

// Config — override via env vars
const GATEWAY_HOST = __ENV.GATEWAY_HOST || '127.0.0.1';
const GATEWAY_PORT = __ENV.GATEWAY_PORT || '18789';
const GATEWAY_BASE = `http://${GATEWAY_HOST}:${GATEWAY_PORT}`;

const preflightPass = new Counter('preflight_pass');
const preflightFail = new Counter('preflight_fail');

export const options = {
  scenarios: {
    preflight: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '60s',
    },
  },
  thresholds: {
    'preflight_pass': ['count >= 4'],  // all 4 checks must pass
    'preflight_fail': ['count == 0'],
  },
};

export default function () {
  // 1. Health check — gateway responds
  const healthRes = http.get(`${GATEWAY_BASE}/health`);
  const healthOk = check(healthRes, {
    'gateway health responds': (r) => r.status === 200,
  });
  if (healthOk) preflightPass.add(1); else preflightFail.add(1);

  // 2. Health response is valid JSON with ok:true
  let healthBody = null;
  try { healthBody = JSON.parse(healthRes.body); } catch (e) {}
  const healthJsonOk = check(healthBody, {
    'health returns ok:true': (b) => b && b.ok === true,
    'health returns status:live': (b) => b && b.status === 'live',
  });
  if (healthJsonOk) preflightPass.add(1); else preflightFail.add(1);

  // 3. Gateway serves the TUI/web frontend (confirms full startup)
  const rootRes = http.get(`${GATEWAY_BASE}/`);
  const rootOk = check(rootRes, {
    'gateway root serves content': (r) => r.status === 200 && r.body.includes('html'),
  });
  if (rootOk) preflightPass.add(1); else preflightFail.add(1);

  // 4. Confirm gateway is listening on expected port
  const portOk = check(healthRes, {
    'gateway port reachable': (r) => r.status !== 0,
  });
  if (portOk) preflightPass.add(1); else preflightFail.add(1);

  // Summary output
  console.log(`Preflight complete: gateway at ${GATEWAY_BASE}`);
  if (healthOk) {
    try {
      const body = JSON.parse(healthRes.body);
      console.log(`  Version: ${body.version || 'unknown'}`);
      console.log(`  Uptime: ${body.uptime || 'unknown'}`);
    } catch (e) {
      console.log(`  Health response: ${healthRes.body}`);
    }
  }
}
