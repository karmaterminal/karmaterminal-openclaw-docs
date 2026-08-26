#!/usr/bin/env node
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { classifyTelemetryBackendInteraction } from '../lib/telemetry-backend-status.js';
import {
  finalizeTelemetryBackendStatus,
  fingerprintTelemetryQuery,
  recordTelemetryBackendInteraction,
} from './lib/telemetry-backend-status-store.mjs';

const DEFAULT_LOKI_BASE_URL = 'http://loki.dandelion.cult';

function parseArgs(argv, env = process.env) {
  const args = {
    lokiUrl: env.OPENCLAW_PROOFS_LOKI_BASE_URL || env.LOKI_BASE_URL ||
      DEFAULT_LOKI_BASE_URL,
    limit: 5000,
    sliceStrategy: 'single-window',
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    if (!['--logql', '--loki-url', '--start', '--end', '--limit', '--slice-strategy',
      '--backend-status', '--out', '--row', '--candidate-sha', '--seat',
      '--proof-run-id'].includes(arg)) {
      throw new Error(`unexpected argument: ${arg}`);
    }
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${arg}`);
    args[arg.slice(2).replace(/-([a-z])/gu, (_match, letter) => letter.toUpperCase())] =
      value;
    i += 1;
  }
  args.limit = Number(args.limit);
  return args;
}

function usage() {
  console.error('Usage: node fetch-loki-query.mjs --logql <query> [--start <time>] [--end <time>] [--limit 5000] [--slice-strategy single-window] [--backend-status backend-status.json] [--out loki-query-receipt.json]');
}

function instant(value) {
  if (value == null || value === '') return null;
  if (/^(?:0|[1-9]\d*)$/u.test(String(value))) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    const millis = String(value).length > 13 ? numeric / 1_000_000 : numeric * 1000;
    return new Date(millis).toISOString();
  }

  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function lokiResultCount(json) {
  const result = Array.isArray(json?.data?.result) ? json.data.result : [];
  return result.reduce((count, entry) => {
    if (Array.isArray(entry?.values)) return count + entry.values.length;
    if (Array.isArray(entry?.value)) return count + 1;
    return count + 1;
  }, 0);
}

function context(args, queryFingerprint) {
  const candidateSha = /^[a-f0-9]{40}$/u.test(args.candidateSha || '')
    ? args.candidateSha
    : null;
  const rowId = args.row || 'UNBOUND';
  const seat = args.seat || 'unbound';
  const proofRunId = args.proofRunId || 'standalone';
  return {
    rowId,
    candidateSha,
    seat,
    proofRunId,
    requiredCompletenessKeys: [
      'totalBlocks',
      'completedJobs',
      'inspectedBytes',
      'lokiApiStatus',
    ],
    rebindKeys: [
      'candidate_sha',
      'row_id',
      'seat',
      'run_id',
      'query_fingerprint',
      'window_start_utc',
      'window_end_utc',
      'slice_strategy',
    ],
    rebindValues: {
      ...(candidateSha ? { candidate_sha: candidateSha } : {}),
      row_id: rowId,
      seat,
      run_id: proofRunId,
      query_fingerprint: queryFingerprint,
      ...(instant(args.start) ? { window_start_utc: instant(args.start) } : {}),
      ...(instant(args.end) ? { window_end_utc: instant(args.end) } : {}),
      slice_strategy: args.sliceStrategy,
    },
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }
  if (!args.logql) {
    usage();
    throw new Error('--logql is required');
  }
  if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 5000) {
    throw new Error('--limit must be an integer from 1 through 5000');
  }
  const queryFingerprint = fingerprintTelemetryQuery(args.logql);
  const backendStatusPath = path.resolve(
    args.backendStatus ||
    path.join(args.out ? path.dirname(path.resolve(args.out)) : process.cwd(), 'backend-status.json'),
  );
  const statusContext = context(args, queryFingerprint);
  const params = new URLSearchParams({
    query: args.logql,
    limit: String(args.limit),
  });
  if (args.start) params.set('start', args.start);
  if (args.end) params.set('end', args.end);
  const root = String(args.lokiUrl).replace(/\/+$/u, '');
  let response;
  try {
    response = await fetch(`${root}/loki/api/v1/query_range?${params}`, {
      headers: { accept: 'application/json' },
    });
  } catch (error) {
    const interaction = classifyTelemetryBackendInteraction({
      backend: 'loki',
      operation: 'query-range',
      transportOk: false,
      responseParsed: false,
      queryFingerprint,
      backendBaseUrlEnv: 'OPENCLAW_PROOFS_LOKI_BASE_URL',
      resultLimit: args.limit,
      windowStartUtc: instant(args.start),
      windowEndUtc: instant(args.end),
      sliceStrategy: args.sliceStrategy,
      requiredCompletenessKeys: statusContext.requiredCompletenessKeys,
    });
    await recordTelemetryBackendInteraction(
      backendStatusPath,
      statusContext,
      interaction,
    );
    throw new Error(`Loki query unavailable: ${error.message}`);
  }
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  const result = Array.isArray(json?.data?.result) ? json.data.result : [];
  const resultCount = lokiResultCount(json);
  const resultCapped =
    /max_entries_limit|maximum[^a-z]+limit|limit[^a-z]+exceed/iu.test(text);
  const interaction = classifyTelemetryBackendInteraction({
    backend: 'loki',
    operation: 'query-range',
    httpStatus: response.status,
    responseParsed: json !== null,
    responseJson: json,
    resultCount,
    resultLimit: args.limit,
    resultCapped,
    queryFingerprint,
    backendBaseUrlEnv: 'OPENCLAW_PROOFS_LOKI_BASE_URL',
    windowStartUtc: instant(args.start),
    windowEndUtc: instant(args.end),
    sliceStrategy: args.sliceStrategy,
    requiredCompletenessKeys: statusContext.requiredCompletenessKeys,
  });
  await recordTelemetryBackendInteraction(
    backendStatusPath,
    statusContext,
    interaction,
  );
  const backendStatus = await finalizeTelemetryBackendStatus(
    backendStatusPath,
    statusContext,
  );
  const receipt = {
    schema: 'openclaw.k6.loki-query-fetch.v1',
    queryFingerprint,
    resultCount,
    backendStatus: path.basename(backendStatusPath),
    backendDisposition: backendStatus.status,
    backendComplete: backendStatus.complete,
    resultCapped: interaction.resultCapped,
  };
  if (args.out) {
    await writeFile(path.resolve(args.out), `${JSON.stringify(receipt, null, 2)}\n`, {
      mode: 0o600,
    });
  }
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  if (!response.ok) {
    throw new Error(`Loki query failed: HTTP ${response.status} ${response.statusText}`.trim());
  }
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exitCode = 1;
});
