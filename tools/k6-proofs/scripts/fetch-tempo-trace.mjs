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
import { normalizeFetchTraceIdInput } from '../lib/tempo-trace-id.mjs';

const DEFAULT_TEMPO_BASE_URL = 'http://tempo.dandelion.cult';

function defaultTempoUrl(env = process.env) {
  return env.OPENCLAW_PROOFS_TEMPO_BASE_URL || env.TEMPO_BASE_URL || DEFAULT_TEMPO_BASE_URL;
}

function usage() {
  console.error(`Usage: node fetch-tempo-trace.mjs (--trace-id <id> | --run-dir <dir> | --traceql <query>) [--tempo-url <base-url>] [--start <unix-seconds>] [--end <unix-seconds>] [--out trace.json]

Tempo endpoint resolution: --tempo-url, else OPENCLAW_PROOFS_TEMPO_BASE_URL, else TEMPO_BASE_URL, else ${DEFAULT_TEMPO_BASE_URL}.`);
}

function parseArgs(argv, env = process.env) {
  const out = { tempoUrl: defaultTempoUrl(env) };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--trace-id' || arg === '--run-dir' || arg === '--traceql' || arg === '--tempo-url' || arg === '--start' || arg === '--end' || arg === '--out') {
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

// Single identifier contract shared with the row collector. A 31-hex Tempo
// search id is recovered to its real 32-hex value instead of being fetched
// verbatim — the failure class that cost R-CD-4 its correlation receipt.
function safeTraceId(value) {
  return normalizeFetchTraceIdInput(value);
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


async function traceIdFromTraceql(baseUrl, traceql, { start, end } = {}) {
  const query = String(traceql ?? '').trim();
  if (!query) throw new Error('empty traceql query');
  const root = String(baseUrl).replace(/\/+$/, '');
  const params = { q: query, limit: '1' };
  if (start) params.start = String(start);
  if (end) params.end = String(end);
  const url = `${root}/api/search?${new URLSearchParams(params)}`;
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  const text = await response.text();
  if (!response.ok) throw new Error(`Tempo search failed: HTTP ${response.status} ${response.statusText}`.trim());
  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error(`Tempo search did not return JSON for query ${query}`); }
  const traceId = json?.traces?.[0]?.traceID || json?.traces?.[0]?.traceId || json?.traces?.[0]?.trace_id;
  if (!traceId) throw new Error(`Tempo search returned no traces for query ${query}`);
  return safeTraceId(traceId);
}

async function fetchTrace(baseUrl, traceId) {
  const root = String(baseUrl).replace(/\/+$/, '');
  const url = `${root}/api/traces/${encodeURIComponent(traceId)}`;
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  const text = await response.text();
  if (!response.ok) throw new Error(`Tempo trace fetch failed: HTTP ${response.status} ${response.statusText}`.trim());
  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error(`Tempo trace fetch did not return JSON for ${traceId}`); }
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
  const traceId = safeTraceId(args.traceId || (args.runDir ? await traceIdFromRunDir(args.runDir) : await traceIdFromTraceql(args.tempoUrl, args.traceql, { start: args.start, end: args.end })));
  const out = args.out
    ? path.resolve(args.out)
    : path.join(path.resolve(args.runDir || process.cwd()), `tempo-trace-${traceId.slice(0, 12)}.json`);
  const { url, json } = await fetchTrace(args.tempoUrl, traceId);
  const publicTrace = projectPublicTempoTrace(json, traceId);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(publicTrace, null, 2)}\n`);
  console.log(JSON.stringify({
    schema: 'openclaw.k6.tempo-trace-fetch.v1',
    traceId,
    out: path.basename(out),
    tempoUrl: publicTempoUrl(url),
    fetched: true,
    spans: publicTrace.spans.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exitCode = 1;
});
