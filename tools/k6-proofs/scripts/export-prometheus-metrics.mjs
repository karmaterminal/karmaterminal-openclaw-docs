#!/usr/bin/env node
/**
 * export-prometheus-metrics.mjs — convert Project 81 candidate proof artifacts
 * into the public-safe Prometheus text exposition contract documented in
 * tools/k6-proofs/METRICS.md.
 *
 * Default input root is PROOFS/. The exporter scans for row-result.json and
 * run-result.json files from both postprocessor artifacts and row-list runner artifacts, derives
 * candidate/row/seat/run ids from the artifact path, and prints normalized
 * openclaw_proofs_k6_* samples to stdout (or --out <path>).
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const out = { root: 'PROOFS', out: null };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root' || arg === '--out') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error(`missing value for ${arg}`);
      out[arg.slice(2)] = value;
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      out.help = true;
    } else {
      throw new Error(`unexpected argument: ${arg}`);
    }
  }
  return out;
}

function usage() {
  console.error(`Usage: node tools/k6-proofs/scripts/export-prometheus-metrics.mjs [--root PROOFS] [--out metrics.prom]`);
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function walk(dir, basename, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, basename, out);
    else if (ent.isFile() && ent.name === basename) out.push(full);
  }
  return out;
}

function labelValue(value) {
  return String(value ?? 'unknown')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/"/g, '\\"');
}

function labels(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `${k}="${labelValue(v)}"`)
    .join(',');
}

function metric(name, labelObj, value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  return `${name}{${labels(labelObj)}} ${Number(value)}`;
}

function boolLabel(value) {
  return value ? 'true' : 'false';
}

function findSiblingSummary(runDir) {
  const names = readdirSync(runDir, { withFileTypes: true })
    .filter((e) => e.isFile() && /summary\.json$/i.test(e.name))
    .map((e) => e.name)
    .sort();
  for (const name of names) {
    const parsed = readJson(path.join(runDir, name));
    if (parsed) return parsed;
  }
  return null;
}

function parseArtifactPath(root, resultPath) {
  const rel = path.relative(root, resultPath).split(path.sep);
  const resultName = rel[rel.length - 1];
  const idx = rel.lastIndexOf(resultName);
  const parts = idx >= 0 ? rel.slice(0, idx) : rel.slice(0, -1);
  // Expected: <sha>/<row>/<seat>/<run>/row-result.json
  return {
    candidateSha: parts[0] || 'unknown',
    rowId: parts[1] || 'unknown',
    seat: parts[2] || 'unknown',
    runId: parts[3] || 'unknown',
  };
}

function numberFromDuration(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'object') return Number(raw.avg ?? raw.med ?? raw.max ?? 0);
  return Number(raw);
}

function normalizeRun(root, resultPath) {
  const result = readJson(resultPath);
  if (!result) return null;
  const runDir = path.dirname(resultPath);
  const pathInfo = parseArtifactPath(root, resultPath);
  const manifest = readJson(path.join(runDir, 'row-manifest.json')) || {};
  const summary = findSiblingSummary(runDir) || {};

  const rowId = result.rowId || summary.row || manifest.rowId || pathInfo.rowId;
  const candidateSha = result.candidateSha || summary.sha || manifest.candidateSha || pathInfo.candidateSha;
  const seat = result.seat || summary.seat || manifest.seat || pathInfo.seat;
  const runId = result.runId || pathInfo.runId;
  const outcome = result.outcome || summary.verdict || (result.k6ExitCode === 0 ? 'PASS-candidate' : 'FAIL-candidate');
  const scenario = result.scenario || manifest?.scenario?.name || manifest?.scenario?.file?.replace(/\.js$/, '') || 'unknown';
  const toolSurface = result.toolSurface || manifest.toolSurface || 'unknown';
  const transport = result.transport || manifest.transport || 'unknown';
  const candidateOnly = result.candidateOnly !== false;
  const foldRequiresReview = result.foldRequiresReview !== false;
  const failureClass = result.failureClass || (result.k6ExitCode && result.k6ExitCode !== 0 ? 'postprocess' : 'none');
  const proofFailures = result.metrics?.proofFailures ?? summary.metrics?.failures ?? (result.k6ExitCode === 0 ? 0 : 1);
  const durationMs = result.metrics?.durationMs ?? numberFromDuration(summary.metrics?.duration_ms);
  const checksRate = result.metrics?.checksRate ?? (result.k6ExitCode === 0 ? 1 : null);

  const base = {
    row_id: rowId,
    seat,
    candidate_sha: candidateSha,
    scenario,
  };
  const runLabels = {
    ...base,
    tool_surface: toolSurface,
    transport,
    outcome,
    candidate_only: boolLabel(candidateOnly),
    fold_requires_review: boolLabel(foldRequiresReview),
    failure_class: failureClass,
  };

  const lines = [];
  lines.push(metric('openclaw_proofs_k6_run_total', runLabels, 1));
  lines.push(metric('openclaw_proofs_k6_proof_failures_total', { ...base, failure_class: failureClass }, proofFailures));
  lines.push(metric('openclaw_proofs_k6_duration_ms', { ...base, outcome }, durationMs));
  lines.push(metric('openclaw_proofs_k6_checks_rate', base, checksRate));
  lines.push(metric('openclaw_proofs_k6_candidate_pending_review', { row_id: rowId, seat, candidate_sha: candidateSha, outcome }, candidateOnly && foldRequiresReview ? 1 : 0));

  const receipts = Array.isArray(result.receipts) ? [...result.receipts] : [];
  const pending = result.review?.pendingReceipts || summary.review?.pendingReceipts || [];
  for (const name of pending) {
    if (!receipts.some((r) => r.name === name)) receipts.push({ name, required: true, status: 'missing' });
  }
  for (const receipt of receipts) {
    const status = receipt.status || 'unknown';
    lines.push(metric('openclaw_proofs_k6_receipt_status', {
      row_id: rowId,
      seat,
      candidate_sha: candidateSha,
      run_id: runId,
      receipt_name: receipt.name || 'unknown',
      receipt_required: boolLabel(Boolean(receipt.required)),
      receipt_status: status,
    }, status === 'present' ? 1 : 0));
  }

  return lines.filter(Boolean);
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv);
  } catch (error) {
    usage();
    throw error;
  }
  if (args.help) {
    usage();
    return;
  }

  const root = path.resolve(args.root);
  if (!existsSync(root)) throw new Error(`root not found: ${root}`);
  const resultFiles = [];
  const seenRunDirs = new Set();
  for (const file of walk(root, 'row-result.json').sort()) {
    resultFiles.push(file);
    seenRunDirs.add(path.dirname(file));
  }
  for (const file of walk(root, 'run-result.json').sort()) {
    if (!seenRunDirs.has(path.dirname(file))) resultFiles.push(file);
  }
  resultFiles.sort();
  const lines = [
    '# HELP openclaw_proofs_k6_run_total Project 81 k6 proof candidate runs.',
    '# TYPE openclaw_proofs_k6_run_total counter',
    '# HELP openclaw_proofs_k6_proof_failures_total Project 81 proof failure count per run.',
    '# TYPE openclaw_proofs_k6_proof_failures_total gauge',
    '# HELP openclaw_proofs_k6_duration_ms Project 81 proof run duration in milliseconds.',
    '# TYPE openclaw_proofs_k6_duration_ms gauge',
    '# HELP openclaw_proofs_k6_checks_rate k6 checks pass rate for Project 81 proof run.',
    '# TYPE openclaw_proofs_k6_checks_rate gauge',
    '# HELP openclaw_proofs_k6_receipt_status Required/optional proof receipt status.',
    '# TYPE openclaw_proofs_k6_receipt_status gauge',
    '# HELP openclaw_proofs_k6_candidate_pending_review Candidate proof run awaiting human review before corpus fold.',
    '# TYPE openclaw_proofs_k6_candidate_pending_review gauge',
  ];
  for (const file of resultFiles) {
    const metrics = normalizeRun(root, file);
    if (metrics) lines.push(...metrics);
  }
  const output = `${lines.join('\n')}\n`;
  if (args.out) writeFileSync(args.out, output);
  else process.stdout.write(output);
}

main();
