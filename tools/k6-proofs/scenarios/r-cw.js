/**
 * k6 PROOFS — R-CW precheck: continue_work infrastructure readiness.
 *
 * This is the runner-friendly read-only precheck for `./run-proof.sh r-cw`.
 * It only checks gateway and observability reachability. It does not execute,
 * cover, certify, or emit proof evidence for any R-CW row. Its output is
 * readiness-only and must never be folded as canonical proof evidence.
 *
 * Individual typed-tool and fixture scenarios in tools/k6-proofs/scenarios/
 * own proof semantics and their row-specific receipt contracts.
 *
 * Usage:
 *   ./run-proof.sh r-cw
 *   k6 run scenarios/r-cw.js --env GATEWAY_HOST=10.0.0.148
 */

import http from 'k6/http';
import { check } from 'k6';
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
const readinessRate = new Rate('r_cw_precheck_ready_rate');

export const options = {
  scenarios: {
    'r-cw-precheck': {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '60s',
    },
  },
  thresholds: {
    'r_cw_precheck_ready_rate': ['rate > 0.99'],
  },
};

export default function () {
  const startTime = Date.now();
  let allReady = true;

  console.log(`[R-CW] Read-only continue_work infrastructure precheck (non-evidentiary)`);
  console.log(`[R-CW] SHA: ${PROOF_SHA} | Seat: ${PROOF_SEAT}`);
  console.log('');

  // 1. Gateway health
  checksRun.add(1);
  const health = http.get(`${GATEWAY_BASE}/health`);
  const healthOk = check(health, {
    '[R-CW] gateway alive': (r) => r.status === 200,
  });
  if (healthOk) checksPassed.add(1);
  else allReady = false;

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
    allReady = false;
  }

  // 3. Read-only observability stack checks.
  checksRun.add(1);
  const tempo = http.get(`${TEMPO_BASE_URL}/ready`, { timeout: '5s' });
  const tempoOk = check(tempo, {
    '[R-CW] tempo ready (trace correlation)': (r) => r.status === 200,
  });
  if (tempoOk) checksPassed.add(1);
  else {
    console.warn(`[R-CW] Tempo not ready — trace pulls may need retry`);
    allReady = false;
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

  // 4. Service-only readiness notes. These lines are deliberately not row claims.
  console.log('');
  console.log(`[R-CW] Readiness status (not proof evidence):`);
  console.log(`[R-CW]   gateway:    ${healthOk ? 'READY' : 'NOT READY'}`);
  console.log(`[R-CW]   tempo:      ${tempoOk ? 'READY' : 'NOT READY'}`);
  console.log(`[R-CW]   loki:       ${lokiOk ? 'READY' : 'NOT READY'}`);
  console.log(`[R-CW]   prometheus: ${promOk ? 'READY' : 'NOT READY'}`);
  console.log('');

  const elapsed = Date.now() - startTime;
  totalDuration.add(elapsed);
  readinessRate.add(allReady ? 1 : 0);

  console.log(`[R-CW] PRECHECK: ${allReady ? 'READY' : 'NOT READY'} (non-evidentiary) — ${elapsed}ms`);
  console.log(`[R-CW] Next: select an individually authorized row scenario and its receipt contract.`);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const summary = {
    row: 'R-CW-precheck',
    sha: PROOF_SHA,
    seat: PROOF_SEAT,
    timestamp,
    outcome: data.metrics.r_cw_precheck_ready_rate?.values?.rate > 0 ? 'READY' : 'NOT_READY',
    evidenceClass: 'preflight-only',
    canonicalProofEvidence: false,
    checksRun: data.metrics.r_cw_checks_run?.values?.count || 0,
    checksPassed: data.metrics.r_cw_checks_passed?.values?.count || 0,
    metrics: data.metrics,
    readinessNotes: {
      gateway: 'read-only health/status reachability',
      tempo: 'read-only trace backend readiness',
      loki: 'read-only log backend readiness',
      prometheus: 'read-only metrics backend readiness',
    },
  };

  return {
    stdout: `\n[R-CW] Precheck: ${summary.outcome} | Checks: ${summary.checksPassed}/${summary.checksRun} | Non-evidentiary\n`,
    'r-cw-precheck-summary.json': JSON.stringify(summary, null, 2),
  };
}
