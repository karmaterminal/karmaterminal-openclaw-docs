#!/usr/bin/env node
/**
 * validate-corpus.mjs — k6 PROOFS corpus integration validator.
 *
 * Validates the integration invariants enforced when row PRs are folded into
 * PROOFS/<sha>/. Node built-ins only; ESM. Sibling to evidence-writer.mjs and
 * postprocess-k6-summary.mjs.
 *
 * Usage:
 *   node tools/k6-proofs/scripts/validate-corpus.mjs --sha <40-char-sha>
 *   node tools/k6-proofs/scripts/validate-corpus.mjs --all
 *   node tools/k6-proofs/scripts/validate-corpus.mjs --index
 *   node tools/k6-proofs/scripts/validate-corpus.mjs --index --json
 *
 * Optional:
 *   --root <path>   PROOFS parent (defaults to CWD, matching sibling scripts).
 *   --json          Emit a machine-readable JSON result on stdout.
 *
 * Exit code is non-zero on any check failure; 0 on clean validation.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const STALE_TOKENS = [
  'pending_push',
  'pending push',
  'upload-blame',
  'TODO-UPLOAD',
  'pending_upload',
];

const ROLLUP_KEYS = ['total_rows', 'pass', 'partial', 'thin', 'fail', 'honest_limit', 'missing'];
const STATE_KEYS = ['pass', 'partial', 'thin', 'fail', 'honest_limit', 'missing'];

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      out._.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function usage() {
  console.error(
    `Usage:\n` +
      `  node tools/k6-proofs/scripts/validate-corpus.mjs --sha <40-char-sha>\n` +
      `  node tools/k6-proofs/scripts/validate-corpus.mjs --all\n` +
      `  node tools/k6-proofs/scripts/validate-corpus.mjs --index\n` +
      `Options: --root <path>  --json`,
  );
}

function tryParseJson(filePath) {
  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (err) {
    return { ok: false, error: `read failed: ${err.message}` };
  }
  try {
    return { ok: true, value: JSON.parse(raw), raw };
  } catch (err) {
    return { ok: false, error: `JSON parse failed: ${err.message}` };
  }
}

function listSubdirs(dirPath) {
  try {
    return readdirSync(dirPath, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch (err) {
    return null;
  }
}

function walkFiles(dirPath) {
  const out = [];
  const stack = [dirPath];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = join(cur, ent.name);
      if (ent.isDirectory()) stack.push(full);
      else if (ent.isFile()) out.push(full);
    }
  }
  return out;
}

function findStaleTokenHits(rootDir) {
  const hits = [];
  if (!existsSync(rootDir)) return hits;
  for (const file of walkFiles(rootDir)) {
    if (!/\.(md|json|ndjson|txt)$/i.test(file)) continue;
    let raw;
    try {
      raw = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const tok of STALE_TOKENS) {
      if (raw.includes(tok)) hits.push({ file, token: tok });
    }
  }
  return hits;
}

function pushCheck(report, name, ok, detail) {
  report.checks.push({ name, ok, detail: detail || null });
  if (!ok) report.failed += 1;
  else report.passed += 1;
}

function validateSha(root, sha, { manifestRequired = true } = {}) {
  const report = { sha, checks: [], passed: 0, failed: 0, skipped: false };
  const shaDir = join(root, 'PROOFS', sha);
  const manifestPath = join(shaDir, 'proofs-manifest.json');

  if (!existsSync(shaDir)) {
    pushCheck(report, 'sha-dir-exists', false, `PROOFS/${sha}/ not found`);
    return report;
  }
  if (!existsSync(manifestPath)) {
    if (manifestRequired) {
      pushCheck(report, 'manifest-present', false, `no proofs-manifest.json in PROOFS/${sha}/`);
      return report;
    }
    report.skipped = true;
    report.reason = 'no manifest';
    return report;
  }

  const parsed = tryParseJson(manifestPath);
  pushCheck(report, 'json-parse-manifest', parsed.ok, parsed.ok ? manifestPath : parsed.error);
  if (!parsed.ok) return report;
  const manifest = parsed.value;

  const schemaOk = manifest.schema === 'openclaw.proofs.manifest.v1';
  pushCheck(
    report,
    'schema-manifest',
    schemaOk,
    schemaOk ? 'openclaw.proofs.manifest.v1' : `expected openclaw.proofs.manifest.v1, got ${JSON.stringify(manifest.schema)}`,
  );

  const hasCaptureSha = typeof manifest.capture_sha === 'string' && manifest.capture_sha.length > 0;
  pushCheck(
    report,
    'schema-manifest-capture-sha',
    hasCaptureSha,
    hasCaptureSha ? manifest.capture_sha : 'missing capture_sha',
  );

  const hasRows = Array.isArray(manifest.rows);
  pushCheck(
    report,
    'schema-manifest-rows',
    hasRows,
    hasRows ? `${manifest.rows.length} rows` : 'rows[] missing or not an array',
  );
  if (!hasRows) return report;

  const captureMatches = manifest.capture_sha === sha;
  pushCheck(
    report,
    'capture-sha-agreement',
    captureMatches,
    captureMatches
      ? `capture_sha == dir name (${sha})`
      : `capture_sha=${manifest.capture_sha} != dir ${sha}`,
  );

  const evidenceMisses = [];
  for (const row of manifest.rows) {
    if (!row.evidence_doc) {
      evidenceMisses.push({ row: row.row, evidence_doc: '(none declared)' });
      continue;
    }
    const evPath = join(root, row.evidence_doc);
    if (!existsSync(evPath)) {
      evidenceMisses.push({ row: row.row, evidence_doc: row.evidence_doc });
    }
  }
  pushCheck(
    report,
    'evidence-doc-exists',
    evidenceMisses.length === 0,
    evidenceMisses.length === 0
      ? `${manifest.rows.length}/${manifest.rows.length} evidence_doc paths exist`
      : `${evidenceMisses.length} missing: ${evidenceMisses.map((m) => `${m.row}→${m.evidence_doc}`).join('; ')}`,
  );

  const declaredDirs = new Set();
  const dirMisses = [];
  for (const row of manifest.rows) {
    if (!row.dir) {
      dirMisses.push({ row: row.row, dir: '(none declared)' });
      continue;
    }
    const dirNoSlash = row.dir.replace(/\/+$/, '');
    declaredDirs.add(dirNoSlash);
    const fullDir = join(root, row.dir);
    if (!existsSync(fullDir) || !statSync(fullDir).isDirectory()) {
      dirMisses.push({ row: row.row, dir: row.dir });
    }
  }
  pushCheck(
    report,
    'row-dirs-exist',
    dirMisses.length === 0,
    dirMisses.length === 0
      ? `${manifest.rows.length}/${manifest.rows.length} row dirs exist`
      : `${dirMisses.length} missing: ${dirMisses.map((m) => `${m.row}→${m.dir}`).join('; ')}`,
  );

  const onDiskRowDirs = listSubdirs(shaDir) || [];
  const supportDirs = new Set(['gates']);
  const ignoredSupportDirs = [];
  const orphanDirs = [];
  for (const sub of onDiskRowDirs) {
    if (supportDirs.has(sub)) {
      ignoredSupportDirs.push(`PROOFS/${sha}/${sub}/`);
      continue;
    }
    const candidate = join('PROOFS', sha, sub);
    if (!declaredDirs.has(candidate)) {
      orphanDirs.push(`PROOFS/${sha}/${sub}/`);
    }
  }
  pushCheck(
    report,
    'no-orphan-row-dirs',
    orphanDirs.length === 0,
    orphanDirs.length === 0
      ? `${onDiskRowDirs.length - ignoredSupportDirs.length} on-disk row dirs all referenced; ignored support dirs: ${ignoredSupportDirs.length ? ignoredSupportDirs.join(', ') : 'none'}`
      : `orphans: ${orphanDirs.join(', ')}`,
  );

  const tallied = { pass: 0, partial: 0, thin: 0, fail: 0, honest_limit: 0, missing: 0 };
  const unknownStates = [];
  for (const row of manifest.rows) {
    if (Object.prototype.hasOwnProperty.call(tallied, row.state)) tallied[row.state] += 1;
    else unknownStates.push({ row: row.row, state: row.state });
  }
  tallied.total_rows = manifest.rows.length;
  pushCheck(
    report,
    'state-values-known',
    unknownStates.length === 0,
    unknownStates.length === 0
      ? 'all states ∈ {pass,partial,thin,fail,honest_limit,missing}'
      : unknownStates.map((u) => `${u.row}→${JSON.stringify(u.state)}`).join('; '),
  );
  report.talliedRollup = tallied;

  const stale = findStaleTokenHits(shaDir);
  pushCheck(
    report,
    'no-stale-pending-tokens',
    stale.length === 0,
    stale.length === 0
      ? `no occurrences of ${STALE_TOKENS.map((t) => `\`${t}\``).join(', ')}`
      : stale.map((h) => `${relative(root, h.file)}:${h.token}`).join('; '),
  );

  return report;
}

function validateIndex(root) {
  const indexPath = join(root, 'PROOFS', 'INDEX.json');
  const report = { kind: 'index', checks: [], passed: 0, failed: 0, indexPath };

  const parsed = tryParseJson(indexPath);
  pushCheck(report, 'json-parse-index', parsed.ok, parsed.ok ? indexPath : parsed.error);
  if (!parsed.ok) return report;
  const index = parsed.value;

  const schemaOk = index.schema === 'openclaw.proofs.index.v1';
  pushCheck(
    report,
    'schema-index',
    schemaOk,
    schemaOk ? 'openclaw.proofs.index.v1' : `expected openclaw.proofs.index.v1, got ${JSON.stringify(index.schema)}`,
  );

  const requiredKeys = ['current_sha', 'corpus_path', 'manifest_path', 'rollup'];
  const missingKeys = requiredKeys.filter((k) => !(k in index));
  pushCheck(
    report,
    'schema-index-keys',
    missingKeys.length === 0,
    missingKeys.length === 0 ? requiredKeys.join(', ') : `missing keys: ${missingKeys.join(', ')}`,
  );

  if (!index.current_sha) return report;

  report.shaReport = validateSha(root, index.current_sha, { manifestRequired: true });

  if (index.rollup && report.shaReport.talliedRollup) {
    const tallied = report.shaReport.talliedRollup;
    const diffs = [];
    for (const k of ROLLUP_KEYS) {
      const got = index.rollup[k];
      const expect = tallied[k];
      if (got !== expect) diffs.push(`${k}: index=${got} tallied=${expect}`);
    }
    pushCheck(
      report,
      'rollup-matches-manifest',
      diffs.length === 0,
      diffs.length === 0
        ? `INDEX rollup matches manifest tally (${ROLLUP_KEYS.map((k) => `${k}=${tallied[k]}`).join(', ')})`
        : diffs.join('; '),
    );
  } else if (!index.rollup) {
    pushCheck(report, 'rollup-matches-manifest', false, 'INDEX.rollup missing');
  }

  return report;
}

function validateAll(root) {
  const proofsDir = join(root, 'PROOFS');
  const subs = listSubdirs(proofsDir) || [];
  const reports = [];
  for (const sub of subs) {
    const manifestPath = join(proofsDir, sub, 'proofs-manifest.json');
    if (!existsSync(manifestPath)) {
      reports.push({ sha: sub, skipped: true, reason: 'no manifest', checks: [], passed: 0, failed: 0 });
      continue;
    }
    reports.push(validateSha(root, sub, { manifestRequired: true }));
  }
  return reports;
}

function renderReport(report, opts) {
  const lines = [];
  if (report.kind === 'index') {
    lines.push(`INDEX: ${report.indexPath}`);
  } else if (report.skipped) {
    lines.push(`SHA ${report.sha}: skipped (${report.reason})`);
    return lines.join('\n');
  } else {
    lines.push(`SHA: ${report.sha}`);
  }
  for (const c of report.checks) {
    lines.push(`  ${c.ok ? '✓' : '✗'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  }
  if (report.shaReport) {
    lines.push('  -- current_sha manifest --');
    if (report.shaReport.skipped) {
      lines.push(`  · SHA ${report.shaReport.sha}: skipped (${report.shaReport.reason})`);
    } else {
      for (const c of report.shaReport.checks) {
        lines.push(`  · ${c.ok ? '✓' : '✗'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
      }
    }
  }
  lines.push(`  ${report.failed === 0 ? 'OK' : 'FAIL'}: ${report.passed} passed, ${report.failed} failed`);
  return lines.join('\n');
}

function reportFailed(report) {
  if (report.failed > 0) return true;
  if (report.shaReport && report.shaReport.failed > 0) return true;
  return false;
}

function main() {
  const args = parseArgs(process.argv);
  const root = args.root || process.cwd();
  const wantJson = Boolean(args.json);

  let modeCount = 0;
  if (args.sha) modeCount += 1;
  if (args.all) modeCount += 1;
  if (args.index) modeCount += 1;
  if (modeCount !== 1) {
    usage();
    process.exitCode = 2;
    return;
  }

  let payload;
  let failed = false;
  let skipped = 0;

  if (args.sha) {
    if (typeof args.sha !== 'string' || !/^[0-9a-f]{40}$/.test(args.sha)) {
      console.error(`ERROR: --sha must be a 40-character hex string (got: ${JSON.stringify(args.sha)})`);
      process.exitCode = 2;
      return;
    }
    const report = validateSha(root, args.sha, { manifestRequired: true });
    failed = reportFailed(report);
    payload = { mode: 'sha', root, reports: [report] };
    if (!wantJson) console.log(renderReport(report));
  } else if (args.all) {
    const reports = validateAll(root);
    for (const r of reports) {
      if (r.skipped) skipped += 1;
      if (reportFailed(r)) failed = true;
      if (!wantJson) console.log(renderReport(r));
    }
    if (!wantJson) {
      const validated = reports.length - skipped;
      const okCount = reports.filter((r) => !r.skipped && !reportFailed(r)).length;
      console.log(`\n--all summary: ${validated} validated (${okCount} OK), ${skipped} skipped (no manifest)`);
    }
    payload = { mode: 'all', root, reports };
  } else {
    const report = validateIndex(root);
    failed = reportFailed(report);
    payload = { mode: 'index', root, reports: [report] };
    if (!wantJson) console.log(renderReport(report));
  }

  if (wantJson) {
    payload.failed = failed;
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
  }
  process.exitCode = failed ? 1 : 0;
}

main();
