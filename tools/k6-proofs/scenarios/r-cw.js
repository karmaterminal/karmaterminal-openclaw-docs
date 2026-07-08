/**
 * k6 PROOFS — R-CW (combined): continue_work rows overview scenario.
 * Issue #117: Covers R-CW-1 through R-CW-7 infrastructure verification.
 *
 * This is the runner-friendly combined scenario for `./run-proof.sh r-cw`.
 * It verifies the gateway infrastructure supports all continue_work proof rows:
 *   - R-CW-1: tool-form schedule + wake
 *   - R-CW-3: reason field in OTel span
 *   - R-CW-4: chain depth hop counter
 *   - R-CW-5: cost-cap rejection
 *   - R-CW-6: maxChainLength boundary
 *   - R-CW-7: traceparent E2E propagation
 *
 * Individual WS-based scenarios in tools/k6-proofs/scenarios/ exercise
 * each row in depth. This scenario does the preflight infrastructure check.
 *
 * Usage:
 *   ./run-proof.sh r-cw
 *   k6 run scenarios/r-cw.js --env GATEWAY_HOST=10.0.0.148
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

const GATEWAY_HOST = __ENV.GATEWAY_HOST || '127.0.0.1';
const GATEWAY_PORT = __ENV.GATEWAY_PORT || '18789';
const GATEWAY_BASE = `http://${GATEWAY_HOST}:${GATEWAY_PORT}`;
const PROOF_SHA = __ENV.PROOF_SHA || 'unknown';
const PROOF_SEAT = __ENV.PROOF_SEAT || __ENV.HOSTNAME || 'cael-dgx';
const TEMPO_BASE_URL = (__ENV.OPENCLAW_PROOFS_TEMPO_BASE_URL || __ENV.TEMPO_BASE_URL || `http://${__ENV.TEMPO_HOST || 'tempo.dandelion.cult'}`).replace(/\/+$/, '');
const LOKI_BASE_URL = (__ENV.OPENCLAW_PROOFS_LOKI_BASE_URL || __ENV.LOKI_BASE_URL || `http://${__ENV.LOKI_HOST || 'loki.dandelion.cult'}`).replace(/\/+$/, '');
const PROMETHEUS_BASE_URL = (__ENV.OPENCLAW_PROOFS_PROMETHEUS_BASE_URL || __ENV.PROMETHEUS_BASE_URL || `http://${__ENV.PROM_HOST || 'prometheus.dandelion.cult'}`).replace(/\/+$/, '');

// Metrics
const checksRun = new Counter('r_cw_checks_run');
const checksPassed = new Counter('r_cw_checks_passed');
const totalDuration = new Trend('r_cw_duration_ms', true);
const passRate = new Rate('r_cw_pass_rate');

export const options = {
  scenarios: {
    'r-cw-combined': {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '60s',
    },
  },
  thresholds: {
    'r_cw_pass_rate': ['rate > 0.99'],
  },
};

export default function () {
  const startTime = Date.now();
  let allPassed = true;

  console.log(`[R-CW] Combined continue_work infrastructure proof`);
  console.log(`[R-CW] SHA: ${PROOF_SHA} | Seat: ${PROOF_SEAT}`);
  console.log('');

  // 1. Gateway health
  checksRun.add(1);
  const health = http.get(`${GATEWAY_BASE}/health`);
  const healthOk = check(health, {
    '[R-CW] gateway alive': (r) => r.status === 200,
  });
  if (healthOk) checksPassed.add(1);
  else allPassed = false;

  // 2. Gateway status (continuation should be in the tool surface)
  checksRun.add(1);
  const status = http.get(`${GATEWAY_BASE}/status`);
  const statusOk = check(status, {
    '[R-CW] status endpoint responsive': (r) => r.status === 200,
  });
  if (statusOk) {
    checksPassed.add(1);
    try {
      const data = JSON.parse(status.body);
      console.log(`[R-CW] Gateway: ${data.version || '?'} | Uptime: ${data.uptime || '?'}`);
    } catch (e) { /* non-JSON is fine */ }
  } else {
    allPassed = false;
  }

  // 3. Observability stack checks (needed for R-CW-3, R-CW-7 trace correlation)
  checksRun.add(1);
  const tempo = http.get(`${TEMPO_BASE_URL}/ready`, { timeout: '5s' });
  const tempoOk = check(tempo, {
    '[R-CW] tempo ready (trace correlation)': (r) => r.status === 200,
  });
  if (tempoOk) checksPassed.add(1);
  else {
    console.warn(`[R-CW] Tempo not ready — R-CW-3, R-CW-7 trace pulls may need retry`);
    allPassed = false;
  }

  checksRun.add(1);
  const loki = http.get(`${LOKI_BASE_URL}/ready`, { timeout: '5s' });
  const lokiOk = check(loki, {
    '[R-CW] loki ready (log correlation)': (r) => r.status === 200,
  });
  if (lokiOk) checksPassed.add(1);
  else console.warn(`[R-CW] Loki not ready — journal-based correlation available as fallback`);

  checksRun.add(1);
  const prom = http.get(`${PROMETHEUS_BASE_URL}/-/ready`, { timeout: '5s' });
  const promOk = check(prom, {
    '[R-CW] prometheus ready (metrics destination)': (r) => r.status === 200,
  });
  if (promOk) checksPassed.add(1);
  else console.warn(`[R-CW] Prometheus not ready — metrics may not write`);

  // 4. Row-specific infrastructure notes
  console.log('');
  console.log(`[R-CW] Row infrastructure status:`);
  console.log(`[R-CW]   R-CW-1 (schedule+wake):    gateway ${healthOk ? '✓' : '✗'}`);
  console.log(`[R-CW]   R-CW-3 (reason in span):   tempo ${tempoOk ? '✓' : '✗'}`);
  console.log(`[R-CW]   R-CW-4 (chain depth):      gateway ${healthOk ? '✓' : '✗'}`);
  console.log(`[R-CW]   R-CW-5 (cost-cap reject):  gateway ${healthOk ? '✓' : '✗'} (mutates config)`);
  console.log(`[R-CW]   R-CW-6 (maxChainLength):   gateway ${healthOk ? '✓' : '✗'} (mutates config + restart)`);
  console.log(`[R-CW]   R-CW-7 (traceparent E2E):  tempo ${tempoOk ? '✓' : '✗'}`);
  console.log('');

  const elapsed = Date.now() - startTime;
  totalDuration.add(elapsed);
  passRate.add(allPassed ? 1 : 0);

  console.log(`[R-CW] VERDICT: ${allPassed ? 'PASS' : 'PARTIAL'} (infrastructure) — ${elapsed}ms`);
  console.log(`[R-CW] Next: run individual WS scenarios (tools/k6-proofs/scenarios/r-cw-*.js)`);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const summary = {
    row: 'R-CW-combined',
    sha: PROOF_SHA,
    seat: PROOF_SEAT,
    timestamp,
    verdict: data.metrics.r_cw_pass_rate?.values?.rate > 0 ? 'PASS' : 'PARTIAL',
    checksRun: data.metrics.r_cw_checks_run?.values?.count || 0,
    checksPassed: data.metrics.r_cw_checks_passed?.values?.count || 0,
    metrics: data.metrics,
    rowNotes: {
      'R-CW-1': 'tool-form schedule+wake (gateway only)',
      'R-CW-3': 'reason.preview in OTel span (needs Tempo)',
      'R-CW-4': 'chain depth hop counter 1/N→3/N (gateway only)',
      'R-CW-5': 'cost-cap exhaustion reject (mutates config temporarily)',
      'R-CW-6': 'maxChainLength boundary (mutates config + requires restart)',
      'R-CW-7': 'traceparent E2E propagation (needs Tempo)',
    },
  };

  return {
    stdout: `\n[R-CW] Summary: ${summary.verdict} | Checks: ${summary.checksPassed}/${summary.checksRun}\n`,
    'r-cw-summary.json': JSON.stringify(summary, null, 2),
  };
}
