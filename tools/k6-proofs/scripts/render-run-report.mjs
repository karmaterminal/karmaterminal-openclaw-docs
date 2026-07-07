#!/usr/bin/env node
/**
 * Render a public-safe HTML summary for one Project 81 k6 proof run root.
 *
 * Input is a run OUT_ROOT containing row run dirs, usually:
 *   <OUT_ROOT>/<candidate>/<row>/<seat>/<run>/...
 *
 * The report intentionally uses the same public-safe row-result fields as the
 * metrics exporter. It must not include tokens, session keys, prompts, nonces,
 * raw events, raw responses, or private absolute paths.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

function usage() {
  console.error('Usage: node render-run-report.mjs --root <run-out-root> [--out report.html]');
}

function parseArgs(argv) {
  const out = { out: null };
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

async function readJson(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch { return null; }
}

async function walk(dir, basename, out = []) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch { return out; }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) await walk(full, basename, out);
    else if (ent.isFile() && ent.name === basename) out.push(full);
  }
  return out;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeText(value, fallback = 'unknown') {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  return text.replace(/[^A-Za-z0-9_.:+\-]/g, '_').slice(0, 160) || fallback;
}

function pickSummary(files) {
  return files.filter((name) => /summary\.json$/i.test(name) && name !== 'run-summary.json').sort()[0] || null;
}

function numberFromDuration(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'object') return Number(raw.avg ?? raw.med ?? raw.max ?? raw.min ?? 0);
  return Number(raw);
}

function receiptSummary({ manifest, runResult, evidenceRows }) {
  const receipts = [];
  for (const name of manifest?.liveRunSafety?.requiredReceipts || []) {
    receipts.push({ name: safeText(name), required: true, status: 'unknown' });
  }
  const pending = runResult?.review?.pendingReceipts || [];
  for (const name of pending) {
    const safe = safeText(name);
    const existing = receipts.find((r) => r.name === safe);
    if (existing) existing.status = 'missing';
    else receipts.push({ name: safe, required: true, status: 'missing' });
  }
  const traceStatus = runResult?.observability?.traceStatus;
  if (traceStatus === 'missing') {
    const existing = receipts.find((r) => r.name === 'tempo-trace-json' || r.name === 'trace-id');
    if (existing) existing.status = 'missing';
  }
  const evidence = evidenceRows[0] || {};
  for (const receipt of receipts) {
    if (receipt.status !== 'unknown') continue;
    if ((receipt.name === 'dispatch-accepted' || receipt.name === 'tool-accepted') && (evidence.tool_accepted || evidence.prompt_sent)) receipt.status = 'present';
    if ((receipt.name === 'parent-wake-event' || receipt.name === 'parent-return-event') && (evidence.parent_wake_observed || evidence.parent_return)) receipt.status = 'present';
    if (receipt.name === 'no-channel-delivery' && evidence.channel_message_observed === false) receipt.status = 'present';
    if ((receipt.name === 'trace-id' || receipt.name === 'tempo-trace-json') && evidence.trace_id) receipt.status = 'present';
  }
  return receipts;
}

async function readEvidenceJsonl(file) {
  const text = await readFile(file, 'utf8').catch(() => '');
  return text.split(/\r?\n/).filter(Boolean).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

async function rowFromRunResult(root, runResultPath) {
  const runDir = path.dirname(runResultPath);
  const files = await readdir(runDir).catch(() => []);
  const manifest = files.includes('row-manifest.json') ? await readJson(path.join(runDir, 'row-manifest.json')) : {};
  const metadata = files.includes('runner-metadata.json') ? await readJson(path.join(runDir, 'runner-metadata.json')) : {};
  const runResult = await readJson(runResultPath) || {};
  const summaryName = pickSummary(files);
  const summary = summaryName ? await readJson(path.join(runDir, summaryName)) : {};
  const evidenceRows = files.includes('evidence.jsonl') ? await readEvidenceJsonl(path.join(runDir, 'evidence.jsonl')) : [];
  const rel = path.relative(root, runDir).split(path.sep).join('/');
  const proofFailures = Number(summary?.metrics?.failures ?? runResult.proofFailures ?? (runResult.k6ExitCode === 0 ? 0 : 1));
  const outcome = safeText(summary?.verdict || (runResult.k6ExitCode === 0 ? 'PASS-candidate' : 'FAIL-candidate'));
  return {
    rowId: safeText(metadata?.row || manifest?.rowId),
    candidateSha: safeText(metadata?.candidateSha || manifest?.candidateSha || summary?.sha),
    seat: safeText(metadata?.seat || manifest?.seat || summary?.seat),
    scenario: safeText(metadata?.scenario || manifest?.scenario?.name || manifest?.scenario?.file),
    outcome,
    reviewStatus: safeText(runResult?.review?.status || (runResult?.review?.pendingReceipts?.length ? 'review-pending' : 'ready-for-human-review')),
    proofFailures,
    durationMs: numberFromDuration(summary?.metrics?.duration_ms),
    checksRate: summary?.metrics?.checks?.rate ?? summary?.metrics?.checksRate ?? null,
    traceStatus: safeText(runResult?.observability?.traceStatus || 'unknown'),
    receipts: receiptSummary({ manifest, runResult, evidenceRows }),
    rel,
  };
}

function render(rows) {
  const generated = new Date().toISOString();
  const totals = rows.reduce((acc, row) => {
    acc.total += 1;
    acc[row.outcome] = (acc[row.outcome] || 0) + 1;
    if (row.reviewStatus === 'review-pending') acc.reviewPending += 1;
    if (row.traceStatus === 'missing') acc.traceMissing += 1;
    return acc;
  }, { total: 0, reviewPending: 0, traceMissing: 0 });
  const receiptCells = (row) => row.receipts.map((r) => `<span class="receipt ${escapeHtml(r.status)}">${escapeHtml(r.name)}: ${escapeHtml(r.status)}</span>`).join(' ');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Project 81 k6 PROOFS report</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:2rem;background:#111827;color:#e5e7eb}a{color:#93c5fd}.card{background:#1f2937;border:1px solid #374151;border-radius:12px;padding:1rem;margin:1rem 0}.summary{display:flex;gap:1rem;flex-wrap:wrap}.pill{background:#374151;border-radius:999px;padding:.35rem .75rem}table{width:100%;border-collapse:collapse;background:#1f2937;border-radius:12px;overflow:hidden}th,td{border-bottom:1px solid #374151;padding:.55rem;text-align:left;vertical-align:top}th{background:#111827}.receipt{display:inline-block;border-radius:999px;padding:.15rem .45rem;margin:.1rem;background:#4b5563}.present{background:#065f46}.missing{background:#7f1d1d}.unknown{background:#78350f}.note{color:#9ca3af;font-size:.92rem}</style>
</head>
<body>
<h1>Project 81 k6 PROOFS report</h1>
<p class="note">Generated ${escapeHtml(generated)}. Candidate artifacts are review aids only; they are not canonical PROOFS folds until human review.</p>
<div class="summary card">
<span class="pill">rows: ${totals.total}</span>
<span class="pill">PASS-candidate: ${totals['PASS-candidate'] || 0}</span>
<span class="pill">FAIL-candidate: ${totals['FAIL-candidate'] || 0}</span>
<span class="pill">review-pending: ${totals.reviewPending}</span>
<span class="pill">trace-missing: ${totals.traceMissing}</span>
</div>
<table>
<thead><tr><th>row</th><th>seat</th><th>candidate</th><th>outcome</th><th>review</th><th>duration</th><th>receipts</th><th>artifact</th></tr></thead>
<tbody>
${rows.map((row) => `<tr><td>${escapeHtml(row.rowId)}</td><td>${escapeHtml(row.seat)}</td><td><code>${escapeHtml(row.candidateSha)}</code></td><td>${escapeHtml(row.outcome)}</td><td>${escapeHtml(row.reviewStatus)}</td><td>${row.durationMs ?? 'n/a'} ms</td><td>${receiptCells(row)}</td><td><code>${escapeHtml(row.rel)}</code></td></tr>`).join('\n')}
</tbody>
</table>
</body>
</html>
`;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { usage(); return; }
  if (!args.root) throw new Error('missing --root');
  const root = path.resolve(args.root);
  const files = await walk(root, 'run-result.json');
  const rows = [];
  for (const file of files.sort()) rows.push(await rowFromRunResult(root, file));
  const html = render(rows);
  const out = args.out ? path.resolve(args.out) : path.join(root, 'report.html');
  await writeFile(out, html);
  console.log(JSON.stringify({ schema: 'openclaw.k6.proofs-report.v1', out, rows: rows.length }, null, 2));
}

main().catch((error) => {
  usage();
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
