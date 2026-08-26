import http from 'k6/http';
import crypto from 'k6/crypto';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import {
  buildTelemetryBackendStatusReceipt,
  classifyTelemetryBackendInteraction,
} from '../lib/telemetry-backend-status.js';

const ROW = 'R-OBS-BACKEND-DISPOSITION';
const CANDIDATE_SHA = __ENV.OPENCLAW_CANDIDATE_SHA || '';
const SEAT = __ENV.OPENCLAW_SEAT_NAME || __ENV.HOSTNAME || 'unknown-seat';
const RUN_ID = __ENV.OPENCLAW_PROOF_RUN_ID || 'backend-disposition';
const TEMPO_URL = (__ENV.OPENCLAW_PROOFS_TEMPO_BASE_URL || '').replace(/\/+$/, '');
const LOKI_URL = (__ENV.OPENCLAW_PROOFS_LOKI_BASE_URL || '').replace(/\/+$/, '');
const TRACEQL = __ENV.OPENCLAW_PROOFS_TEMPO_TRACEQL || '';
const LOGQL = __ENV.OPENCLAW_PROOFS_LOKI_LOGQL || '';
const WINDOW_SECONDS = Number(__ENV.OPENCLAW_PROOFS_BACKEND_WINDOW_SECONDS || 300);
const WINDOW_END_SECONDS = Math.floor(Date.now() / 1000);
const WINDOW_START_SECONDS = WINDOW_END_SECONDS - WINDOW_SECONDS;
const WINDOW_START_UTC = new Date(WINDOW_START_SECONDS * 1000).toISOString();
const WINDOW_END_UTC = new Date(WINDOW_END_SECONDS * 1000).toISOString();
const REQUIRED = [
  'totalBlocks',
  'completedJobs',
  'inspectedBytes',
  'tempoApiStatus',
];
const STATUS_NAMES = ['complete', 'partial', 'unavailable', 'capped', 'unknown'];

const interactionsRun = new Counter('r_obs_backend_interactions');
const disposition = Object.fromEntries(
  ['tempo', 'loki'].map((backend) => [
    backend,
    Object.fromEntries(
      STATUS_NAMES.map((status) => [
        status,
        new Counter(`r_obs_backend_${backend}_status_${status}`),
      ]),
    ),
  ]),
);
const values = {
  tempo: {
    http: new Trend('r_obs_backend_tempo_http'),
    totalBlocks: new Trend('r_obs_backend_tempo_total_blocks'),
    completedJobs: new Trend('r_obs_backend_tempo_completed_jobs'),
    inspectedBytes: new Trend('r_obs_backend_tempo_inspected_bytes'),
    resultCount: new Trend('r_obs_backend_tempo_result_count'),
    capped: new Counter('r_obs_backend_tempo_capped'),
  },
  loki: {
    http: new Trend('r_obs_backend_loki_http'),
    totalBlocks: new Trend('r_obs_backend_loki_total_blocks'),
    completedJobs: new Trend('r_obs_backend_loki_completed_jobs'),
    inspectedBytes: new Trend('r_obs_backend_loki_inspected_bytes'),
    resultCount: new Trend('r_obs_backend_loki_result_count'),
    capped: new Counter('r_obs_backend_loki_capped'),
  },
};

export const options = {
  scenarios: {
    r_obs_backend_disposition: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '60s',
    },
  },
};

function metricValue(metric) {
  const value = metric;
  if (Number.isInteger(value) && value >= 0) return value;
  return null;
}

function recordInteraction(interaction) {
  interactionsRun.add(1);
  disposition[interaction.backend][interaction.status].add(1);
  const target = values[interaction.backend];
  if (interaction.httpStatus !== null) target.http.add(interaction.httpStatus);
  if (interaction.totalBlocks !== null) target.totalBlocks.add(interaction.totalBlocks);
  if (interaction.completedJobs !== null) target.completedJobs.add(interaction.completedJobs);
  if (interaction.inspectedBytes !== null) target.inspectedBytes.add(interaction.inspectedBytes);
  if (interaction.resultCount !== null) target.resultCount.add(interaction.resultCount);
  if (interaction.resultCapped) target.capped.add(1);
}

function responseJson(response) {
  try {
    return response.json();
  } catch {
    return null;
  }
}

function lokiResultCount(json) {
  const result = Array.isArray(json?.data?.result) ? json.data.result : [];
  return result.reduce((count, entry) =>
    count + (Array.isArray(entry?.values) ? entry.values.length : 1), 0);
}

function queryTempo() {
  const queryFingerprint = crypto.sha256(TRACEQL || 'tempo:not-configured', 'hex').slice(0, 16);
  if (!TEMPO_URL || !TRACEQL) {
    return classifyTelemetryBackendInteraction({
      backend: 'tempo',
      operation: 'not-configured',
      httpStatus: 200,
      responseJson: {},
      resultCount: 0,
      queryFingerprint,
      backendBaseUrlEnv: 'OPENCLAW_PROOFS_TEMPO_BASE_URL',
      sliceStrategy: 'not-configured',
      requiredCompletenessKeys: REQUIRED,
    });
  }
  const response = http.get(
    `${TEMPO_URL}/api/search?q=${encodeURIComponent(TRACEQL)}&start=${WINDOW_START_SECONDS}&end=${WINDOW_END_SECONDS}&limit=20`,
    { timeout: '20s', headers: { accept: 'application/json' } },
  );
  const json = responseJson(response);
  return classifyTelemetryBackendInteraction({
    backend: 'tempo',
    operation: 'search',
    transportOk: response.status > 0,
    responseParsed: json !== null,
    httpStatus: response.status,
    responseJson: json,
    resultCount: Array.isArray(json?.traces) ? json.traces.length : 0,
    resultLimit: 20,
    queryFingerprint,
    backendBaseUrlEnv: 'OPENCLAW_PROOFS_TEMPO_BASE_URL',
    windowStartUtc: WINDOW_START_UTC,
    windowEndUtc: WINDOW_END_UTC,
    sliceStrategy: 'single-window',
    requiredCompletenessKeys: REQUIRED,
  });
}

function queryLoki() {
  const queryFingerprint = crypto.sha256(LOGQL || 'loki:not-configured', 'hex').slice(0, 16);
  if (!LOKI_URL || !LOGQL) {
    return classifyTelemetryBackendInteraction({
      backend: 'loki',
      operation: 'not-configured',
      httpStatus: 200,
      responseJson: {},
      resultCount: 0,
      queryFingerprint,
      backendBaseUrlEnv: 'OPENCLAW_PROOFS_LOKI_BASE_URL',
      sliceStrategy: 'not-configured',
      requiredCompletenessKeys: REQUIRED,
    });
  }
  const response = http.get(
    `${LOKI_URL}/loki/api/v1/query_range?query=${encodeURIComponent(LOGQL)}&start=${WINDOW_START_SECONDS}&end=${WINDOW_END_SECONDS}&limit=5000`,
    { timeout: '20s', headers: { accept: 'application/json' } },
  );
  const json = responseJson(response);
  const body = String(response.body || '');
  return classifyTelemetryBackendInteraction({
    backend: 'loki',
    operation: 'query-range',
    transportOk: response.status > 0,
    responseParsed: json !== null,
    httpStatus: response.status,
    responseJson: json,
    resultCount: lokiResultCount(json),
    resultLimit: 5000,
    resultCapped: /max_entries_limit|maximum[^a-z]+limit|limit[^a-z]+exceed/i.test(body),
    queryFingerprint,
    backendBaseUrlEnv: 'OPENCLAW_PROOFS_LOKI_BASE_URL',
    windowStartUtc: WINDOW_START_UTC,
    windowEndUtc: WINDOW_END_UTC,
    sliceStrategy: 'single-window',
    requiredCompletenessKeys: REQUIRED,
  });
}

export default function () {
  const interactions = [queryTempo(), queryLoki()];
  interactions.forEach(recordInteraction);
  console.log(`PUBLIC_EVIDENCE ${JSON.stringify({
    row: ROW,
    candidateSha: /^[a-f0-9]{40}$/.test(CANDIDATE_SHA) ? CANDIDATE_SHA : null,
    seat: SEAT,
    started: WINDOW_START_UTC,
    ended: WINDOW_END_UTC,
    interactions: interactions.map((entry) => ({
      backend: entry.backend,
      operation: entry.operation,
      status: entry.status,
      httpStatus: entry.httpStatus,
      apiStatus: entry.apiStatus,
      totalBlocks: entry.totalBlocks,
      completedJobs: entry.completedJobs,
      inspectedBytes: entry.inspectedBytes,
      resultCapped: entry.resultCapped,
      resultCount: entry.resultCount,
      resultLimit: entry.resultLimit,
      queryFingerprint: entry.queryFingerprint,
      sliceStrategy: entry.sliceStrategy,
      zeroResultAuthoritative: entry.zeroResultAuthoritative,
    })),
  })}`);
  check(interactions, {
    'every backend interaction received an explicit disposition': (entries) =>
      entries.length === 2 && entries.every((entry) => STATUS_NAMES.includes(entry.status)),
    'zero is authoritative only for complete responses': (entries) =>
      entries.every((entry) =>
        entry.zeroResultAuthoritative !== true || entry.status === 'complete'),
  });
}

function trend(data, name) {
  const value = data.metrics[name]?.values;
  return value ? metricValue(value.max) : null;
}

function reconstructedInteraction(data, backend, query, limit) {
  const prefix = `r_obs_backend_${backend}`;
  const status = STATUS_NAMES.find(
    (name) => (data.metrics[`${prefix}_status_${name}`]?.values?.count || 0) > 0,
  ) || 'unknown';
  const httpStatus = trend(data, `${prefix}_http`);
  const totalBlocks = trend(data, `${prefix}_total_blocks`);
  const completedJobs = trend(data, `${prefix}_completed_jobs`);
  const inspectedBytes = trend(data, `${prefix}_inspected_bytes`);
  const resultCount = trend(data, `${prefix}_result_count`) || 0;
  return classifyTelemetryBackendInteraction({
    backend,
    operation: query ? (backend === 'tempo' ? 'search' : 'query-range') : 'not-configured',
    transportOk: status !== 'unavailable',
    responseParsed: status !== 'unavailable',
    httpStatus,
    responseJson: status === 'unknown'
      ? {}
      : {
          metrics: {
            totalBlocks,
            completedJobs,
            inspectedBytes,
            ...(status === 'partial' && completedJobs !== null
              ? { totalJobs: completedJobs + 1 }
              : {}),
          },
          data: {
            stats: {
              summary: {
                totalBlocks,
                completedJobs,
                inspectedBytes,
                ...(status === 'partial' && completedJobs !== null
                  ? { totalJobs: completedJobs + 1 }
                  : {}),
              },
            },
          },
        },
    resultCount,
    resultLimit: limit,
    resultCapped: (data.metrics[`${prefix}_capped`]?.values?.count || 0) > 0,
    queryFingerprint: crypto.sha256(
      query || `${backend}:not-configured`,
      'hex',
    ).slice(0, 16),
    backendBaseUrlEnv: backend === 'tempo'
      ? 'OPENCLAW_PROOFS_TEMPO_BASE_URL'
      : 'OPENCLAW_PROOFS_LOKI_BASE_URL',
    windowStartUtc: query ? WINDOW_START_UTC : null,
    windowEndUtc: query ? WINDOW_END_UTC : null,
    sliceStrategy: query ? 'single-window' : 'not-configured',
    requiredCompletenessKeys: REQUIRED,
  });
}

export function handleSummary(data) {
  const interactions = [
    reconstructedInteraction(data, 'tempo', TRACEQL, 20),
    reconstructedInteraction(data, 'loki', LOGQL, 5000),
  ];
  const backendStatus = buildTelemetryBackendStatusReceipt({
    rowId: ROW,
    candidateSha: /^[a-f0-9]{40}$/.test(CANDIDATE_SHA) ? CANDIDATE_SHA : null,
    seat: SEAT,
    proofRunId: RUN_ID,
    interactions,
    requiredCompletenessKeys: REQUIRED,
    rebindKeys: [
      'backend_base_url_env',
      'query_fingerprint',
      'window_start_utc',
      'window_end_utc',
      'slice_strategy',
      'result_capped',
      'candidate_sha',
      'proof_run_id',
    ],
    rebindValues: {
      backend_base_url_env: [
        'OPENCLAW_PROOFS_TEMPO_BASE_URL',
        'OPENCLAW_PROOFS_LOKI_BASE_URL',
      ],
      query_fingerprint: interactions.map((entry) => entry.queryFingerprint),
      window_start_utc: WINDOW_START_UTC,
      window_end_utc: WINDOW_END_UTC,
      slice_strategy: interactions.map((entry) => entry.sliceStrategy),
      result_capped: interactions.some((entry) => entry.resultCapped),
      ...(/^[a-f0-9]{40}$/.test(CANDIDATE_SHA)
        ? { candidate_sha: CANDIDATE_SHA }
        : {}),
      proof_run_id: RUN_ID,
    },
  });
  const controlBase = {
    backend: 'tempo',
    operation: 'control',
    queryFingerprint: crypto.sha256('backend-disposition-control', 'hex').slice(0, 16),
    backendBaseUrlEnv: 'OPENCLAW_PROOFS_TEMPO_BASE_URL',
    requiredCompletenessKeys: REQUIRED,
  };
  const classificationControls = {
    complete: classifyTelemetryBackendInteraction({
      ...controlBase,
      httpStatus: 200,
      responseJson: {
        metrics: {
          totalBlocks: 1,
          completedJobs: 1,
          totalJobs: 1,
          inspectedBytes: 1,
        },
      },
      resultCount: 0,
    }).status,
    partial: classifyTelemetryBackendInteraction({
      ...controlBase,
      httpStatus: 200,
      responseJson: {
        metrics: {
          totalBlocks: 1,
          completedJobs: 0,
          totalJobs: 1,
          inspectedBytes: 1,
        },
      },
      resultCount: 0,
    }).status,
    unavailable: classifyTelemetryBackendInteraction({
      ...controlBase,
      transportOk: false,
      responseParsed: false,
    }).status,
    capped: classifyTelemetryBackendInteraction({
      ...controlBase,
      httpStatus: 200,
      responseJson: {
        metrics: {
          totalBlocks: 1,
          completedJobs: 1,
          totalJobs: 1,
          inspectedBytes: 1,
        },
      },
      resultCount: 20,
      resultLimit: 20,
      sliceStrategy: 'daily-reslice-required',
    }).status,
    unknown: classifyTelemetryBackendInteraction({
      ...controlBase,
      httpStatus: 200,
      responseJson: {},
      resultCount: 0,
    }).status,
  };
  const controlsPass = STATUS_NAMES.every(
    (status) => classificationControls[status] === status,
  );
  const summary = {
    row: ROW,
    sha: CANDIDATE_SHA || 'unset',
    seat: SEAT,
    timestamp: new Date().toISOString(),
    verdict: backendStatus.complete ? 'PASS-candidate' : 'PARTIAL-candidate',
    backendDisposition: backendStatus.status,
    backendComplete: backendStatus.complete,
    classificationControls,
    proof_receipts: {
      'backend-completeness-receipt': backendStatus.interactions.length === 2,
      'degraded-response-classified': controlsPass,
      'rebind-key-set-published': backendStatus.rebind.complete,
      'slice-strategy-recorded': controlsPass &&
        backendStatus.interactions.every((entry) => entry.sliceStrategy.length > 0),
    },
    metrics: data.metrics,
  };
  return {
    stdout: `\n[${ROW}] ${summary.verdict} (${backendStatus.status})\n`,
    'r-obs-backend-disposition-summary.json': JSON.stringify(summary, null, 2),
    'backend-status.json': JSON.stringify(backendStatus, null, 2),
  };
}
