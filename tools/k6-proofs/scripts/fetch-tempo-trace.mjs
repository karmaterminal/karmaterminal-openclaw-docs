#!/usr/bin/env node
/**
 * Fetch a Tempo trace JSON receipt for a Project 81 k6 proof candidate run.
 *
 * The script accepts either --trace-id directly or --run-dir containing
 * evidence.jsonl. It writes a public-safe Tempo trace projection to --out (or
 * <run-dir>/tempo-trace-<trace-id>.json) and prints a compact public-safe
 * receipt to stdout.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { projectPublicTempoTrace } from '../lib/public-tempo-trace.mjs';
import { classifyTelemetryBackendInteraction } from '../lib/telemetry-backend-status.js';
import {
  finalizeTelemetryBackendStatus,
  fingerprintTelemetryQuery,
  recordTelemetryBackendInteraction,
} from './lib/telemetry-backend-status-store.mjs';

const DEFAULT_TEMPO_BASE_URL = 'http://tempo.dandelion.cult';

function defaultTempoUrl(env = process.env) {
  return env.OPENCLAW_PROOFS_TEMPO_BASE_URL || env.TEMPO_BASE_URL || DEFAULT_TEMPO_BASE_URL;
}

function usage() {
  console.error(`Usage: node fetch-tempo-trace.mjs (--trace-id <id> | --run-dir <dir> | --traceql <query>) [--tempo-url <base-url>] [--start <unix-seconds>] [--end <unix-seconds>] [--out trace.json] [--backend-status backend-status.json] [--row <row>] [--candidate-sha <sha>] [--seat <seat>] [--proof-run-id <id>]

Tempo endpoint resolution: --tempo-url, else OPENCLAW_PROOFS_TEMPO_BASE_URL, else TEMPO_BASE_URL, else ${DEFAULT_TEMPO_BASE_URL}.`);
}

function parseArgs(argv, env = process.env) {
  const out = { tempoUrl: defaultTempoUrl(env) };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (['--trace-id', '--run-dir', '--traceql', '--tempo-url', '--start', '--end',
      '--out', '--backend-status', '--row', '--candidate-sha', '--seat',
      '--proof-run-id'].includes(arg)) {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error(`missing value for ${arg}`);
      out[arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      out.help = true;
    } else {
      throw new Error(`unexpected argument: ${arg}`);
    }
  }
  return out;
}

function safeTraceId(value) {
  const text = String(value ?? '').trim();
  if (!/^[A-Fa-f0-9]{8,64}$/.test(text)) throw new Error(`invalid trace id: ${text || '(empty)'}`);
  return text.toLowerCase();
}

async function traceIdFromRunDir(runDir) {
  const evidencePath = path.join(runDir, 'evidence.jsonl');
  const text = await readFile(evidencePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (row.trace_id) return safeTraceId(row.trace_id);
    } catch {
      // Ignore malformed evidence lines; run-proofs already preserves raw logs.
    }
  }
  throw new Error('no trace_id found in run evidence');
}


function statusContext(args, backendStatusPath, queryFingerprint) {
  const candidateSha = /^[a-f0-9]{40}$/u.test(args.candidateSha || '')
    ? args.candidateSha
    : null;
  const rowId = args.row || 'UNBOUND';
  const seat = args.seat || 'unbound';
  const proofRunId = args.proofRunId ||
    (args.runDir ? path.basename(path.resolve(args.runDir)) : 'standalone');
  return {
    file: backendStatusPath,
    value: {
      rowId,
      candidateSha,
      seat,
      proofRunId,
      requiredCompletenessKeys: [
        'totalBlocks',
        'completedJobs',
        'inspectedBytes',
        'tempoApiStatus',
      ],
      rebindKeys: [
        'candidate_sha',
        'row_id',
        'seat',
        'run_id',
        'query_fingerprint',
      ],
      rebindValues: {
        ...(candidateSha ? { candidate_sha: candidateSha } : {}),
        row_id: rowId,
        seat,
        run_id: proofRunId,
        query_fingerprint: queryFingerprint,
      },
    },
  };
}

async function recordTempoInteraction(status, values) {
  const interaction = classifyTelemetryBackendInteraction({
    backend: 'tempo',
    backendBaseUrlEnv: 'OPENCLAW_PROOFS_TEMPO_BASE_URL',
    requiredCompletenessKeys: status.value.requiredCompletenessKeys,
    ...values,
  });
  await recordTelemetryBackendInteraction(status.file, status.value, interaction);
}

async function traceIdFromTraceql(baseUrl, traceql, status, { start, end } = {}) {
  const query = String(traceql ?? '').trim();
  if (!query) throw new Error('empty traceql query');
  const root = String(baseUrl).replace(/\/+$/, '');
  const params = { q: query, limit: '1' };
  if (start) params.start = String(start);
  if (end) params.end = String(end);
  const url = `${root}/api/search?${new URLSearchParams(params)}`;
  let response;
  try {
    response = await fetch(url, { headers: { accept: 'application/json' } });
  } catch (error) {
    await recordTempoInteraction(status, {
      operation: 'search',
      transportOk: false,
      responseParsed: false,
      queryFingerprint: fingerprintTelemetryQuery(query),
      resultLimit: 1,
      windowStartUtc: start ? new Date(Number(start) * 1000).toISOString() : null,
      windowEndUtc: end ? new Date(Number(end) * 1000).toISOString() : null,
      sliceStrategy: 'single-window',
    });
    throw new Error(`Tempo search unavailable: ${error.message}`);
  }
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch {
    await recordTempoInteraction(status, {
      operation: 'search',
      httpStatus: response.status,
      responseParsed: false,
      queryFingerprint: fingerprintTelemetryQuery(query),
      resultLimit: 1,
      windowStartUtc: start ? new Date(Number(start) * 1000).toISOString() : null,
      windowEndUtc: end ? new Date(Number(end) * 1000).toISOString() : null,
      sliceStrategy: 'single-window',
    });
    throw new Error('Tempo search did not return JSON');
  }
  const traces = Array.isArray(json?.traces) ? json.traces : [];
  await recordTempoInteraction(status, {
    operation: 'search',
    httpStatus: response.status,
    responseJson: json,
    resultCount: traces.length,
    resultLimit: 1,
    queryFingerprint: fingerprintTelemetryQuery(query),
    windowStartUtc: start ? new Date(Number(start) * 1000).toISOString() : null,
    windowEndUtc: end ? new Date(Number(end) * 1000).toISOString() : null,
    sliceStrategy: 'single-window',
  });
  if (!response.ok) throw new Error(`Tempo search failed: HTTP ${response.status} ${response.statusText}`.trim());
  const traceId = json?.traces?.[0]?.traceID || json?.traces?.[0]?.traceId || json?.traces?.[0]?.trace_id;
  if (!traceId) throw new Error('Tempo search returned no traces');
  return safeTraceId(traceId);
}

async function fetchTrace(baseUrl, traceId, status) {
  const root = String(baseUrl).replace(/\/+$/, '');
  const url = `${root}/api/traces/${encodeURIComponent(traceId)}`;
  let response;
  try {
    response = await fetch(url, { headers: { accept: 'application/json' } });
  } catch (error) {
    await recordTempoInteraction(status, {
      operation: 'trace-by-id',
      transportOk: false,
      responseParsed: false,
      queryFingerprint: fingerprintTelemetryQuery(`trace:${traceId}`),
      sliceStrategy: 'trace-id',
    });
    throw new Error(`Tempo trace fetch unavailable: ${error.message}`);
  }
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch {
    await recordTempoInteraction(status, {
      operation: 'trace-by-id',
      httpStatus: response.status,
      responseParsed: false,
      queryFingerprint: fingerprintTelemetryQuery(`trace:${traceId}`),
      sliceStrategy: 'trace-id',
    });
    throw new Error(`Tempo trace fetch did not return JSON for ${traceId}`);
  }
  await recordTempoInteraction(status, {
    operation: 'trace-by-id',
    httpStatus: response.status,
    responseJson: json,
    resultCount: response.ok ? 1 : 0,
    queryFingerprint: fingerprintTelemetryQuery(`trace:${traceId}`),
    sliceStrategy: 'trace-id',
  });
  if (!response.ok) throw new Error(`Tempo trace fetch failed: HTTP ${response.status} ${response.statusText}`.trim());
  return { url, json };
}

function publicTempoUrl(url) {
  const parsed = new URL(url);
  return `${parsed.origin}/api/traces/<trace-id>`;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { usage(); return; }
  if ([args.traceId, args.runDir, args.traceql].filter(Boolean).length !== 1) throw new Error('choose exactly one of --trace-id, --run-dir, or --traceql');
  const queryFingerprint = fingerprintTelemetryQuery(
    args.traceql || `trace:${args.traceId || args.runDir || 'run-dir'}`,
  );
  const backendStatusPath = path.resolve(
    args.backendStatus ||
    path.join(
      args.runDir
        ? path.resolve(args.runDir)
        : args.out
          ? path.dirname(path.resolve(args.out))
          : process.cwd(),
      'backend-status.json',
    ),
  );
  const status = statusContext(args, backendStatusPath, queryFingerprint);
  const traceId = safeTraceId(args.traceId || (args.runDir
    ? await traceIdFromRunDir(args.runDir)
    : await traceIdFromTraceql(
      args.tempoUrl,
      args.traceql,
      status,
      { start: args.start, end: args.end },
    )));
  const out = args.out
    ? path.resolve(args.out)
    : path.join(path.resolve(args.runDir || process.cwd()), `tempo-trace-${traceId.slice(0, 12)}.json`);
  const { url, json } = await fetchTrace(args.tempoUrl, traceId, status);
  const publicTrace = projectPublicTempoTrace(json, traceId);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(publicTrace, null, 2)}\n`);
  const backendStatus = await finalizeTelemetryBackendStatus(backendStatusPath, status.value);
  console.log(JSON.stringify({
    schema: 'openclaw.k6.tempo-trace-fetch.v1',
    traceId,
    out: path.basename(out),
    tempoUrl: publicTempoUrl(url),
    fetched: true,
    spans: publicTrace.spans.length,
    backendStatus: path.basename(backendStatusPath),
    backendDisposition: backendStatus.status,
    backendComplete: backendStatus.complete,
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exitCode = 1;
});
