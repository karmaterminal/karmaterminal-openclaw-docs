#!/usr/bin/env node
/**
 * Export Project 81 k6 PROOFS candidate artifacts into the public-safe
 * openclaw_proofs_k6_* metrics contract.
 *
 * Inputs:
 *   --row-result <row-result.json>     normalized postprocess artifact
 *   --run-dir <dir>                    row-list runner dir containing run-result.json,
 *                                      row-manifest.json, runner-metadata.json, and *summary.json
 *
 * Outputs:
 *   --prometheus-out <file>            Prometheus text exposition
 *   --otlp-out <file>                  OTLP/HTTP JSON request body
 *   --push-otlp <url>                  POST OTLP JSON to collector, e.g. http://10.0.0.99:4318/v1/metrics
 *
 * Stdout prints a compact JSON receipt. No secrets, session keys, prompts, nonces,
 * raw events, or local private paths are emitted into metric labels.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  consumeRcd2Authority,
  isRcd2AuthorityRequired,
} from '../lib/r-cd-2-authority-context.mjs';
import { candidateEnvelopeMatchesSiblings } from './candidate-run-result-contract.mjs';

const METRIC_PREFIX = 'openclaw_proofs_k6';

function usage() {
  console.error(`Usage: node export-row-metrics.mjs (--row-result <row-result.json> | --run-dir <dir>) [--prometheus-out <file>] [--otlp-out <file>] [--push-otlp <url>]`);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`unexpected argument: ${arg}`);
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for --${key}`);
    out[key] = value;
    i += 1;
  }
  return out;
}

function stringAttr(key, value) {
  return { key, value: { stringValue: String(value ?? '') } };
}

function safeLabelValue(value, fallback = 'unknown') {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  // Keep labels public-safe and bounded. This intentionally strips session keys,
  // paths, nonces, and arbitrary payload fragments if a malformed artifact tries
  // to pass them through a known label field.
  return text.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 120) || fallback;
}

function boolLabel(value) {
  return value ? 'true' : 'false';
}

function escapeProm(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

function nowNs() {
  return `${BigInt(Date.now()) * 1000000n}`;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function readOptionalJson(file) {
  try {
    return await readJson(file);
  } catch {
    return null;
  }
}

function pickSummaryFile(files) {
  const summaries = files.filter((name) => /summary\.json$/i.test(name) && name !== 'run-summary.json');
  return summaries.sort()[0] || null;
}

function durationFromSummary(summary) {
  const v = summary?.metrics?.duration_ms;
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object') return Number(v.avg ?? v.med ?? v.max ?? v.min ?? 0);
  return null;
}

function checksRateFromSummary(summary) {
  const checks = summary?.metrics?.checks;
  if (checks && typeof checks === 'object' && checks.rate !== undefined) return Number(checks.rate);
  if (summary?.metrics?.checksRate !== undefined) return Number(summary.metrics.checksRate);
  return null;
}

function receiptRowsFrom({ result, manifest, runResult }) {
  const receipts = [];
  for (const receipt of result.receipts || []) {
    receipts.push({
      name: safeLabelValue(receipt.name, 'unknown'),
      required: Boolean(receipt.required),
      status: safeLabelValue(receipt.status, 'unknown'),
    });
  }

  const pending = new Set(runResult?.review?.pendingReceipts || result.review?.pendingReceipts || []);
  for (const name of pending) {
    if (!receipts.some((r) => r.name === safeLabelValue(name))) {
      receipts.push({ name: safeLabelValue(name), required: true, status: 'missing' });
    }
  }

  // The row-list runner records trace review state in run-result.json rather
  // than row-result receipts. Expose that as the contract receipt the dashboard
  // knows how to show.
  const traceStatus = runResult?.observability?.traceStatus || result?.observability?.traceStatus;

  for (const name of manifest?.liveRunSafety?.requiredReceipts || []) {
    const safe = safeLabelValue(name);
    if (!receipts.some((r) => r.name === safe)) {
      receipts.push({ name: safe, required: true, status: 'unknown' });
    }
  }

  if (traceStatus === 'missing') {
    const existing = receipts.find((r) => r.name === 'tempo-trace-json' || r.name === 'trace-id');
    if (existing) existing.status = 'missing';
  } else if (traceStatus === 'present') {
    const existing = receipts.find((r) => r.name === 'tempo-trace-json' || r.name === 'trace-id');
    if (existing) existing.status = 'present';
  }

  return receipts;
}

async function readEvidenceJsonl(file) {
  const text = await readFile(file, 'utf8').catch(() => '');
  return text.split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);
}

function receiptStatusFromEvidence(name, evidenceRows, readiness = null) {
  const safe = safeLabelValue(name);
  const evidence = evidenceRows[0] || {};
  switch (safe) {
    case 'seat-readiness':
      return readiness?.outcome === 'PASS-candidate' ? 'present' : 'unknown';
    case 'config-read':
      return evidence.config_read === true ? 'present' : 'unknown';
    case 'continuation-values':
      return typeof evidence.enabled === 'boolean'
        && Number.isFinite(evidence.max_chain_length)
        && Number.isFinite(evidence.max_delegates_per_turn)
        && Number.isFinite(evidence.cost_cap_tokens)
        ? 'present'
        : 'unknown';
    case 'cross-session-targeting':
      return evidence.cross_session_targeting === 'enabled'
        ? 'present'
        : 'unknown';
    case 'dispatch-accepted':
    case 'tool-accepted':
    case 'tool-invoke-accepted':
      return evidence.tool_accepted || evidence.prompt_sent ? 'present' : 'unknown';
    case 'parent-wake-event':
    case 'parent-return-event':
      return evidence.parent_wake_observed || evidence.parent_return ? 'present' : 'unknown';
    case 'no-channel-delivery':
      return evidence.channel_message_observed === false ? 'present' : 'unknown';
    case 'trace-id':
    case 'tempo-trace-json':
      return evidence.trace_id ? 'present' : 'missing';
    default:
      return 'unknown';
  }
}

async function normalizeFromRunDir(runDir) {
  const files = await readdir(runDir);
  const manifest = files.includes('row-manifest.json') ? await readJson(path.join(runDir, 'row-manifest.json')) : {};
  const runResult = files.includes('run-result.json') ? await readJson(path.join(runDir, 'run-result.json')) : {};
  const metadata = files.includes('runner-metadata.json') ? await readJson(path.join(runDir, 'runner-metadata.json')) : {};
  const candidate = files.includes('candidate-run-result.json')
    ? await readOptionalJson(path.join(runDir, 'candidate-run-result.json'))
    : null;
  const readiness = files.includes('seat-readiness.json') ? await readJson(path.join(runDir, 'seat-readiness.json')) : null;
  const evidenceRows = files.includes('evidence.jsonl') ? await readEvidenceJsonl(path.join(runDir, 'evidence.jsonl')) : [];
  const summaryName = pickSummaryFile(files);
  const summary = summaryName ? await readJson(path.join(runDir, summaryName)) : {};
  const rCd2Required = isRcd2AuthorityRequired({
    runDir,
    envelope: candidate,
    manifest,
    metadata,
    runResult,
    summary,
    evidence: evidenceRows[0],
  });
  if (
    rCd2Required &&
    files.includes('candidate-run-result.json') &&
    !candidateEnvelopeMatchesSiblings({
      envelope: candidate,
      manifest,
      metadata,
      runResult,
      runDir,
    })
  ) {
    throw new Error('R-CD-2 candidate sidecar is invalid');
  }
  const authority = rCd2Required
    ? consumeRcd2Authority({
        runDir,
        envelope: candidate,
        manifest,
        metadata,
        runResult,
        summary,
        evidence: evidenceRows[0],
      })
    : null;

  const rowId = authority?.identity.row || metadata.row || manifest.rowId || summary.row || 'unknown';
  const candidateSha = authority?.identity.candidateSha || metadata.candidateSha || manifest.candidateSha || summary.sha || 'unknown';
  const seat = authority?.identity.seat || metadata.seat || manifest.seat || summary.seat || 'unknown';
  const scenario = authority?.identity.scenario || metadata.scenario || manifest?.scenario?.name || manifest?.scenario?.file?.replace(/\.js$/, '') || 'unknown';
  const effectiveExitCode = Number(runResult.effectiveExitCode ?? runResult.k6ExitCode ?? 0);
  const outcome = authority?.outcome || runResult.verdict || summary.verdict ||
    (effectiveExitCode === 0 ? 'PASS-candidate' : 'FAIL-candidate');
  const proofFailures = Number(
    summary?.metrics?.failures ?? runResult.proofFailures ?? (effectiveExitCode === 0 ? 0 : 1),
  );
  const candidateOnly = authority?.candidateOnly ??
    (runResult.candidateOnly !== undefined ? Boolean(runResult.candidateOnly) : true);
  const foldRequiresReview = authority?.foldRequiresReview ??
    (runResult.foldRequiresReview !== undefined ? Boolean(runResult.foldRequiresReview) : true);

  return {
    schema: 'openclaw.k6.proof-row-result.v1',
    runId: path.basename(runDir),
    generatedAt: runResult.endedAt || summary.timestamp || new Date().toISOString(),
    rowId,
    candidateSha,
    seat,
    scenario,
    toolSurface: manifest.toolSurface || 'unknown',
    transport: manifest.transport || 'unknown',
    outcome,
    metrics: {
      proofFailures,
      checksRate: checksRateFromSummary(summary),
      durationMs: durationFromSummary(summary),
    },
    receipts: receiptRowsFrom({ result: {}, manifest, runResult }).map((receipt) => ({
      ...receipt,
      status: receipt.status === 'unknown' ? receiptStatusFromEvidence(receipt.name, evidenceRows, readiness) : receipt.status,
    })),
    failureClass: proofFailures > 0 ? 'threshold' : (runResult?.review?.pendingReceipts?.length ? 'missing-receipt' : 'none'),
    candidateOnly,
    foldRequiresReview,
    observability: runResult.observability || null,
    review: authority?.review || runResult.review || null,
  };
}

async function normalizeInput(args) {
  if (args['row-result'] && args['run-dir']) throw new Error('choose exactly one of --row-result or --run-dir');
  if (args['row-result']) {
    const rowResultPath = path.resolve(args['row-result']);
    const result = await readJson(rowResultPath);
    const runDir = path.dirname(rowResultPath);
    const files = await readdir(runDir);
    const [manifest, metadata, runResult, candidate] = await Promise.all([
      files.includes('row-manifest.json') ? readJson(path.join(runDir, 'row-manifest.json')) : {},
      files.includes('runner-metadata.json') ? readJson(path.join(runDir, 'runner-metadata.json')) : {},
      files.includes('run-result.json') ? readJson(path.join(runDir, 'run-result.json')) : null,
      files.includes('candidate-run-result.json')
        ? readOptionalJson(path.join(runDir, 'candidate-run-result.json'))
        : null,
    ]);
    const rCd2Required = isRcd2AuthorityRequired({
      runDir,
      envelope: candidate,
      manifest,
      metadata,
      runResult,
      rowResult: result,
    });
    if (
      rCd2Required &&
      files.includes('candidate-run-result.json') &&
      !candidateEnvelopeMatchesSiblings({
        envelope: candidate,
        manifest,
        metadata,
        runResult,
        runDir,
      })
    ) {
      throw new Error('R-CD-2 candidate sidecar is invalid');
    }
    if (rCd2Required) {
      const authority = consumeRcd2Authority({
        runDir,
        envelope: candidate,
        manifest,
        metadata,
        runResult,
        rowResult: result,
      });
      return {
        ...result,
        rowId: authority.identity.row,
        runId: authority.identity.runId,
        candidateSha: authority.identity.candidateSha,
        seat: authority.identity.seat,
        scenario: authority.identity.scenario,
        outcome: authority.outcome,
        candidateOnly: authority.candidateOnly,
        foldRequiresReview: authority.foldRequiresReview,
        review: authority.review,
      };
    }
    return result;
  }
  if (args['run-dir']) return normalizeFromRunDir(args['run-dir']);
  throw new Error('missing --row-result or --run-dir');
}

function buildMetricSamples(result) {
  const base = {
    row_id: safeLabelValue(result.rowId),
    seat: safeLabelValue(result.seat),
    candidate_sha: safeLabelValue(result.candidateSha),
    scenario: safeLabelValue(result.scenario),
  };
  const runScoped = {
    ...base,
    run_id: safeLabelValue(result.runId),
  };
  const full = {
    ...runScoped,
    tool_surface: safeLabelValue(result.toolSurface),
    transport: safeLabelValue(result.transport),
    outcome: safeLabelValue(result.outcome),
    candidate_only: boolLabel(result.candidateOnly),
    fold_requires_review: boolLabel(result.foldRequiresReview),
    failure_class: safeLabelValue(result.failureClass || 'none'),
  };
  const pendingReview = Boolean(result.candidateOnly && result.foldRequiresReview)
    || result?.review?.status === 'review-pending'
    || (result?.review?.pendingReceipts || []).length > 0;

  const samples = [
    { name: `${METRIC_PREFIX}_run_total`, type: 'sum', labels: full, value: 1, int: true },
    { name: `${METRIC_PREFIX}_proof_failures_total`, type: 'sum', labels: { ...runScoped, scenario: full.scenario, failure_class: full.failure_class }, value: Number(result.metrics?.proofFailures ?? 0), int: true },
    { name: `${METRIC_PREFIX}_candidate_pending_review`, type: 'gauge', labels: { row_id: base.row_id, seat: base.seat, candidate_sha: base.candidate_sha, run_id: runScoped.run_id, outcome: full.outcome, fold_requires_review: full.fold_requires_review }, value: pendingReview ? 1 : 0, int: true },
  ];

  if (result.metrics?.durationMs !== null && result.metrics?.durationMs !== undefined) {
    samples.push({ name: `${METRIC_PREFIX}_duration_ms`, type: 'gauge', labels: { ...runScoped, outcome: full.outcome }, value: Number(result.metrics.durationMs), int: false });
  }
  if (result.metrics?.checksRate !== null && result.metrics?.checksRate !== undefined) {
    samples.push({ name: `${METRIC_PREFIX}_checks_rate`, type: 'gauge', labels: runScoped, value: Number(result.metrics.checksRate), int: false });
  }

  for (const receipt of result.receipts || []) {
    const status = safeLabelValue(receipt.status, 'unknown');
    samples.push({
      name: `${METRIC_PREFIX}_receipt_status`,
      type: 'gauge',
      labels: {
        row_id: base.row_id,
        seat: base.seat,
        candidate_sha: base.candidate_sha,
        run_id: safeLabelValue(result.runId),
        receipt_name: safeLabelValue(receipt.name),
        receipt_required: boolLabel(receipt.required),
        receipt_status: status,
      },
      value: status === 'present' ? 1 : 0,
      int: true,
    });
  }

  return samples;
}

function prometheusText(samples) {
  const names = new Set();
  const lines = [];
  for (const sample of samples) {
    if (!names.has(sample.name)) {
      names.add(sample.name);
      lines.push(`# TYPE ${sample.name} ${sample.type === 'sum' ? 'counter' : 'gauge'}`);
    }
    const labelText = Object.entries(sample.labels || {})
      .map(([key, value]) => `${key}="${escapeProm(value)}"`)
      .join(',');
    lines.push(`${sample.name}{${labelText}} ${Number(sample.value)}`);
  }
  return `${lines.join('\n')}\n`;
}

function otlpJson(samples) {
  const timeUnixNano = nowNs();
  const metrics = samples.map((sample) => {
    const dataPoint = {
      attributes: Object.entries(sample.labels || {}).map(([key, value]) => stringAttr(key, value)),
      timeUnixNano,
      [sample.int ? 'asInt' : 'asDouble']: sample.int ? String(Math.trunc(Number(sample.value))) : Number(sample.value),
    };
    if (sample.type === 'sum') {
      return {
        name: sample.name,
        sum: {
          aggregationTemporality: 2,
          isMonotonic: true,
          dataPoints: [dataPoint],
        },
      };
    }
    return { name: sample.name, gauge: { dataPoints: [dataPoint] } };
  });
  return {
    resourceMetrics: [{
      resource: { attributes: [stringAttr('service.name', 'openclaw-k6-proofs')] },
      scopeMetrics: [{
        scope: { name: 'openclaw-k6-proofs-exporter', version: '1' },
        metrics,
      }],
    }],
  };
}

async function pushOtlp(endpoint, body) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`OTLP push failed: HTTP ${response.status} ${response.statusText} ${text}`.trim());
  }
  return { status: response.status, ok: response.ok };
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv);
  } catch (error) {
    usage();
    throw error;
  }

  const result = await normalizeInput(args);
  const samples = buildMetricSamples(result);
  const otlp = otlpJson(samples);
  const prom = prometheusText(samples);

  if (args['prometheus-out']) await writeFile(args['prometheus-out'], prom);
  if (args['otlp-out']) await writeFile(args['otlp-out'], `${JSON.stringify(otlp, null, 2)}\n`);

  let push = null;
  if (args['push-otlp']) push = await pushOtlp(args['push-otlp'], otlp);

  console.log(JSON.stringify({
    schema: 'openclaw.k6.proof-metrics-export.v1',
    rowId: result.rowId,
    candidateSha: result.candidateSha,
    seat: result.seat,
    outcome: result.outcome,
    sampleCount: samples.length,
    metricNames: [...new Set(samples.map((s) => s.name))],
    prometheusOut: args['prometheus-out'] ? path.basename(args['prometheus-out']) : null,
    otlpOut: args['otlp-out'] ? path.basename(args['otlp-out']) : null,
    push,
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
