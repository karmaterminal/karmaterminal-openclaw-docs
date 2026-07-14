#!/usr/bin/env node
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { candidateEnvelopeMatchesSiblings } from './candidate-run-result-contract.mjs';

function usage() {
  return `Usage: node tools/k6-proofs/scripts/summarize-review-debt.mjs --run-root <candidate-run-dir> [--json]\n\nScans row run-result.json files and summarizes review-pending receipts.\nFor tempo-trace-json debt, distinguishes fetchable trace ids from trace-missing rows where no Tempo fetch can be attempted.\n`;
}

function parseArgs(argv) {
  const args = { json: false, runRoot: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') args.json = true;
    else if (arg === '--run-root') args.runRoot = argv[++i] || '';
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

async function walk(dir, names, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(p, names, out);
    else if (entry.isFile() && names.has(entry.name)) out.push(p);
  }
  return out;
}

function rowFromPath(file) {
  const parts = file.split(path.sep);
  for (const part of parts) {
    if (/^R-[A-Z0-9-]+$/.test(part)) return part;
  }
  return null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

function classifyPending(row, receipt) {
  if (receipt !== 'tempo-trace-json') return { receipt, class: 'manual-review', fetchable: null, action: 'supply-or-accept-review-receipt' };
  const traceId = row.traceId || null;
  if (traceId) {
    return { receipt, class: 'tempo-trace-fetchable', fetchable: true, traceId, action: 'run fetch-tempo-trace.mjs --trace-id and commit trace JSON' };
  }
  return {
    receipt,
    class: 'tempo-trace-unfetchable',
    fetchable: false,
    traceId: null,
    action: 'rerun with trace emission or explicitly accept trace-missing as an honest review limit',
  };
}

async function loadRows(root) {
  const candidateFiles = await walk(root, new Set(['candidate-run-result.json']));
  const files = await walk(root, new Set(['run-result.json']));
  const rows = [];
  for (const file of candidateFiles.sort()) {
    const dir = path.dirname(file);
    let raw;
    let manifest;
    let metadata;
    let runResult;
    try {
      [raw, manifest, metadata, runResult] = await Promise.all([
        readJson(file),
        readJson(path.join(dir, 'row-manifest.json')),
        readJson(path.join(dir, 'runner-metadata.json')),
        readJson(path.join(dir, 'run-result.json')),
      ]);
    } catch {
      continue;
    }
    if (!candidateEnvelopeMatchesSiblings({ envelope: raw, manifest, metadata, runResult, runDir: dir })) continue;
    const pendingReceipts = asArray(raw.review?.pendingReceipts);
    rows.push({
      rowId: raw.run?.rowId || rowFromPath(file) || 'unknown-row',
      file: path.relative(root, file),
      reviewStatus: raw.review?.status || 'unknown',
      pendingReceipts,
      traceId: null,
      pending: pendingReceipts.map((receipt) => classifyPending({ traceId: null }, receipt)),
    });
  }
  for (const file of files.sort()) {
    const dir = path.dirname(file);
    const candidate = await readJson(path.join(dir, 'candidate-run-result.json')).catch(() => null);
    const [manifest, metadata, raw] = await Promise.all([
      readJson(path.join(dir, 'row-manifest.json')).catch(() => null),
      readJson(path.join(dir, 'runner-metadata.json')).catch(() => null),
      readJson(file),
    ]);
    if (candidateEnvelopeMatchesSiblings({ envelope: candidate, manifest, metadata, runResult: raw, runDir: dir })) continue;
    const pendingReceipts = asArray(raw.review?.pendingReceipts);
    const rowId = raw.rowId || raw.row || rowFromPath(file) || 'unknown-row';
    const traceId = raw.observability?.traceId || raw.traceId || null;
    rows.push({
      rowId,
      file: path.relative(root, file),
      reviewStatus: raw.review?.status || (pendingReceipts.length ? 'review-pending' : 'ready-for-human-review'),
      pendingReceipts,
      traceId,
      pending: pendingReceipts.map((receipt) => classifyPending({ traceId }, receipt)),
    });
  }
  return rows;
}

function summarize(rows) {
  const pendingRows = rows.filter((row) => row.pendingReceipts.length > 0 || row.reviewStatus === 'review-pending');
  const byClass = {};
  for (const row of pendingRows) {
    for (const item of row.pending) byClass[item.class] = (byClass[item.class] || 0) + 1;
  }
  return {
    totalRows: rows.length,
    pendingRows: pendingRows.length,
    byClass,
    pending: pendingRows,
  };
}

function renderText(summary) {
  const lines = [];
  lines.push(`rows: ${summary.totalRows}`);
  lines.push(`review-pending rows: ${summary.pendingRows}`);
  for (const [klass, count] of Object.entries(summary.byClass).sort()) lines.push(`${klass}: ${count}`);
  if (summary.pending.length) {
    lines.push('');
    for (const row of summary.pending) {
      lines.push(`- ${row.rowId}: ${row.pendingReceipts.join(', ') || row.reviewStatus}`);
      for (const item of row.pending) lines.push(`  - ${item.class}: ${item.action}${item.traceId ? ` (${item.traceId})` : ''}`);
      lines.push(`  - ${row.file}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return;
  }
  if (!args.runRoot) throw new Error('missing --run-root');
  const root = path.resolve(args.runRoot);
  const st = await stat(root).catch(() => null);
  if (!st?.isDirectory()) throw new Error(`run root is not a directory: ${root}`);
  const rows = await loadRows(root);
  const summary = summarize(rows);
  if (args.json) process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  else process.stdout.write(renderText(summary));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
