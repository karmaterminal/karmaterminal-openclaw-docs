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
 *   node tools/k6-proofs/scripts/validate-corpus.mjs --current
 *   node tools/k6-proofs/scripts/validate-corpus.mjs --index --json
 *
 * Optional:
 *   --root <path>   PROOFS parent (defaults to CWD, matching sibling scripts).
 *   --json          Emit a machine-readable JSON result on stdout.
 *   --strict        Make archival --all failures fatal. By default --all is
 *                   informational; use --index/--current for current-board gating.
 *
 * Exit code is non-zero on current-board check failure; --all exits 0 unless
 * --strict is supplied.
 *
 * Supplemental rows: when a manifest declares `required_rows`, its required set
 * is `required_rows` and its supplemental set is `dispatch_allocation.supplemental`
 * (absent means empty). The two sets must be disjoint, `rows[]` must be exactly
 * their union, only supplemental rows carry `"supplemental": true`, the firing
 * buckets (every other `dispatch_allocation` key) must allocate each required
 * row exactly once, `rollup` must equal the required-row tally, and
 * `rollup_supplemental` (when present) must equal the supplemental-row tally.
 * `--index` compares INDEX.rollup with the required-row tally. Evidence and row
 * directory checks still cover every row. Manifests without `required_rows`
 * validate exactly as before.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { consumeRcd2Authority } from '../lib/r-cd-2-authority-context.mjs';

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
      `  node tools/k6-proofs/scripts/validate-corpus.mjs --current\n` +
      `Options: --root <path>  --json  --strict`,
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
  const supportDirs = new Set(['artifacts', 'gates']);
  const ignoredSupportDirs = [];
  const orphanDirs = [];
  for (const sub of onDiskRowDirs) {
    if (supportDirs.has(sub) || sub.startsWith('_')) {
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

  const rCd2AuthorityFailures = [];
  const unauthorizedRcd2Passes = new Set();
  for (const [index, row] of manifest.rows.entries()) {
    if (String(row?.row || '').trim().toUpperCase() !== 'R-CD-2' || row?.state !== 'pass') continue;
    if (row.row !== 'R-CD-2') {
      rCd2AuthorityFailures.push('R-CD-2 pass row identifier must use canonical uppercase spelling');
      unauthorizedRcd2Passes.add(index);
      continue;
    }
    const reviewedRun = row.reviewed_run;
    const expectedPrefix = `PROOFS/${sha}/R-CD-2/`;
    const parts = typeof reviewedRun === 'string' ? reviewedRun.split('/') : [];
    if (
      typeof reviewedRun !== 'string' ||
      !reviewedRun.startsWith(expectedPrefix) ||
      parts.length !== 5 ||
      parts.some((part) => !part || part === '.' || part === '..')
    ) {
      rCd2AuthorityFailures.push(
        'R-CD-2 pass requires an explicitly selected reviewed_run under its canonical row',
      );
      unauthorizedRcd2Passes.add(index);
      continue;
    }
    try {
      const authority = consumeRcd2Authority({
        root,
        runDir: join(root, reviewedRun),
      });
      if (authority.outcome !== 'PASS-candidate') {
        throw new Error(`selected authority verdict is ${authority.outcome}`);
      }
    } catch (error) {
      rCd2AuthorityFailures.push(`R-CD-2 reviewed authority invalid: ${error.message}`);
      unauthorizedRcd2Passes.add(index);
    }
  }
  pushCheck(
    report,
    'r-cd-2-reviewed-authority',
    rCd2AuthorityFailures.length === 0,
    rCd2AuthorityFailures.length
      ? rCd2AuthorityFailures.join('; ')
      : 'every R-CD-2 pass is bound to an explicitly selected reviewed run with complete authority',
  );
  report.rCd2AuthorityValid = rCd2AuthorityFailures.length === 0;

  const { tallied, unknownStates } = tallyRows(manifest.rows, unauthorizedRcd2Passes);
  pushCheck(
    report,
    'state-values-known',
    unknownStates.length === 0,
    unknownStates.length === 0
      ? 'all authorized states ∈ {pass,partial,thin,fail,honest_limit,missing}'
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

  if (hasOwn(manifest, 'required_rows')) {
    validateRowSets(report, manifest, unauthorizedRcd2Passes);
  } else {
    // Legacy manifests keep exactly the checks above. Supplemental markers are
    // only meaningful against required_rows, so they may not appear without it.
    const markers = supplementalMarkers(manifest);
    if (markers.length) {
      pushCheck(
        report,
        'supplemental-requires-required-rows',
        false,
        `manifest has no required_rows but carries supplemental markers: ${markers.join('; ')}`,
      );
    }
  }

  return report;
}

function hasOwn(value, key) {
  return value !== null && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key);
}

/**
 * Tally row states, skipping excluded row indexes and rows that fail `include`.
 * total_rows counts every included row, including rows with an unknown state.
 */
function tallyRows(rows, excludedIndexes, include = () => true) {
  const tallied = { pass: 0, partial: 0, thin: 0, fail: 0, honest_limit: 0, missing: 0 };
  const unknownStates = [];
  let includedRowCount = 0;
  for (const [index, row] of rows.entries()) {
    if (excludedIndexes.has(index) || !include(row)) continue;
    includedRowCount += 1;
    if (Object.prototype.hasOwnProperty.call(tallied, row.state)) tallied[row.state] += 1;
    else unknownStates.push({ row: row.row, state: row.state });
  }
  tallied.total_rows = includedRowCount;
  return { tallied, unknownStates };
}

function formatRollup(rollup) {
  return ROLLUP_KEYS.map((k) => `${k}=${rollup[k]}`).join(', ');
}

/** Describe each row-id list problem: not an array, a non-string or empty id, a duplicate. */
function rowListProblems(label, value) {
  if (!Array.isArray(value)) return [`${label} is not an array`];
  const problems = [];
  const seen = new Set();
  for (const id of value) {
    if (typeof id !== 'string' || id.length === 0) {
      problems.push(`${label} has a non-string or empty entry ${JSON.stringify(id)}`);
      continue;
    }
    if (seen.has(id)) problems.push(`${label} lists ${id} twice`);
    seen.add(id);
  }
  return problems;
}

function showId(id) {
  return JSON.stringify(id) ?? String(id);
}

function stringIds(value) {
  return Array.isArray(value) ? value.filter((id) => typeof id === 'string' && id.length > 0) : [];
}

function supplementalMarkers(manifest) {
  const markers = [];
  if (hasOwn(manifest.dispatch_allocation, 'supplemental')) markers.push('dispatch_allocation.supplemental');
  if (hasOwn(manifest, 'supplemental_rows')) markers.push('supplemental_rows');
  if (hasOwn(manifest, 'rollup_supplemental')) markers.push('rollup_supplemental');
  const flaggedRows = manifest.rows
    .filter((row) => hasOwn(row, 'supplemental') || hasOwn(row, 'required'))
    .map((row) => row?.row);
  if (flaggedRows.length) markers.push(`rows with a supplemental/required flag: ${flaggedRows.join(', ')}`);
  return markers;
}

/**
 * Supplemental-aware row-set checks, run only when the manifest declares
 * required_rows. The required set is required_rows; the supplemental set is
 * dispatch_allocation.supplemental (absent means empty). Supplemental rows keep
 * their rows[] entry, directory and evidence (checked above with every row) but
 * are excluded from the required tally that manifest.rollup and INDEX.rollup
 * must match.
 */
function validateRowSets(report, manifest, unauthorizedRcd2Passes) {
  const allocation = manifest.dispatch_allocation;
  const keyedAllocation = allocation !== null && typeof allocation === 'object' && !Array.isArray(allocation);
  const hasSupplementalBucket = keyedAllocation && hasOwn(allocation, 'supplemental');

  const setProblems = [
    ...rowListProblems('required_rows', manifest.required_rows),
    ...(hasSupplementalBucket
      ? rowListProblems('dispatch_allocation.supplemental', allocation.supplemental)
      : []),
  ];
  const requiredIds = stringIds(manifest.required_rows);
  const supplementalIds = hasSupplementalBucket ? stringIds(allocation.supplemental) : [];
  const required = new Set(requiredIds);
  const supplemental = new Set(supplementalIds);
  if (hasOwn(manifest, 'supplemental_rows')) {
    const listProblems = rowListProblems('supplemental_rows', manifest.supplemental_rows);
    setProblems.push(...listProblems);
    if (!listProblems.length) {
      const declared = new Set(manifest.supplemental_rows);
      const onlyDeclared = [...declared].filter((id) => !supplemental.has(id));
      const onlyBucket = [...supplemental].filter((id) => !declared.has(id));
      if (onlyDeclared.length || onlyBucket.length) {
        setProblems.push(
          'supplemental_rows disagrees with dispatch_allocation.supplemental' +
            `${onlyDeclared.length ? `; only in supplemental_rows: ${onlyDeclared.join(', ')}` : ''}` +
            `${onlyBucket.length ? `; only in the bucket: ${onlyBucket.join(', ')}` : ''}`,
        );
      }
    }
  }
  pushCheck(
    report,
    'row-sets-defined',
    setProblems.length === 0,
    setProblems.length === 0
      ? `${required.size} required (required_rows), ${supplemental.size} supplemental (dispatch_allocation.supplemental${hasSupplementalBucket ? '' : ' absent'})`
      : setProblems.join('; '),
  );

  const overlap = requiredIds.filter((id) => supplemental.has(id));
  pushCheck(
    report,
    'row-sets-disjoint',
    overlap.length === 0,
    overlap.length === 0
      ? 'no row is both required and supplemental'
      : `in both required_rows and dispatch_allocation.supplemental: ${overlap.join(', ')}`,
  );

  const seenRows = new Set();
  const duplicateRows = [];
  const unknownRows = [];
  for (const row of manifest.rows) {
    const id = row?.row;
    if (seenRows.has(id)) duplicateRows.push(id);
    seenRows.add(id);
    if (!required.has(id) && !supplemental.has(id)) unknownRows.push(id);
  }
  const absentRows = [...new Set([...requiredIds, ...supplementalIds])].filter((id) => !seenRows.has(id));
  const rowProblems = [
    ...(unknownRows.length ? [`in neither set: ${unknownRows.map(showId).join(', ')}`] : []),
    ...(duplicateRows.length ? [`duplicate rows[] entries: ${duplicateRows.map(showId).join(', ')}`] : []),
    ...(absentRows.length ? [`declared but absent from rows[]: ${absentRows.join(', ')}`] : []),
  ];
  pushCheck(
    report,
    'rows-match-row-sets',
    rowProblems.length === 0,
    rowProblems.length === 0
      ? `rows[] is exactly required ∪ supplemental (${manifest.rows.length} rows)`
      : rowProblems.join('; '),
  );

  const flagProblems = [];
  for (const row of manifest.rows) {
    const id = row?.row;
    if (supplemental.has(id)) {
      if (row?.supplemental !== true) {
        flagProblems.push(`supplemental row ${id} has supplemental=${JSON.stringify(row?.supplemental)}, expected true`);
      }
      if (hasOwn(row, 'required') && row.required !== false) {
        flagProblems.push(`supplemental row ${id} has required=${JSON.stringify(row.required)}`);
      }
    } else {
      if (hasOwn(row, 'supplemental') && row.supplemental !== false) {
        flagProblems.push(`non-supplemental row ${showId(id)} has supplemental=${JSON.stringify(row.supplemental)}`);
      }
      if (hasOwn(row, 'required') && row.required !== true) {
        flagProblems.push(`non-supplemental row ${showId(id)} has required=${JSON.stringify(row.required)}`);
      }
    }
  }
  pushCheck(
    report,
    'supplemental-flags-agree',
    flagProblems.length === 0,
    flagProblems.length === 0
      ? `exactly the ${supplemental.size} supplemental rows carry "supplemental": true`
      : flagProblems.join('; '),
  );

  pushFiringBucketCheck(report, allocation, keyedAllocation, required);

  const authorityValid = report.rCd2AuthorityValid !== false;
  const { tallied: requiredRollup } = tallyRows(manifest.rows, unauthorizedRcd2Passes, (row) => required.has(row?.row));
  const { tallied: supplementalRollup } = tallyRows(
    manifest.rows,
    unauthorizedRcd2Passes,
    (row) => supplemental.has(row?.row),
  );
  report.requiredRollup = requiredRollup;
  report.supplementalRollup = supplementalRollup;

  const declaredRollup = manifest.rollup;
  const rollupIsObject = declaredRollup !== null && typeof declaredRollup === 'object' && !Array.isArray(declaredRollup);
  const rollupDiffs = rollupIsObject
    ? ROLLUP_KEYS.filter((k) => declaredRollup[k] !== requiredRollup[k]).map(
        (k) => `${k}: manifest=${declaredRollup[k]} required-tally=${requiredRollup[k]}`,
      )
    : [`manifest rollup is ${declaredRollup === undefined ? 'missing' : 'not an object'}`];
  pushCheck(
    report,
    'manifest-rollup-matches-required',
    authorityValid && rollupDiffs.length === 0,
    authorityValid && rollupDiffs.length === 0
      ? `manifest rollup matches the required-row tally (${formatRollup(requiredRollup)})`
      : [...(!authorityValid ? ['R-CD-2 reviewed authority failed'] : []), ...rollupDiffs].join('; '),
  );

  if (!hasOwn(manifest, 'rollup_supplemental')) {
    pushCheck(report, 'rollup-supplemental-matches', true, 'not applicable: no rollup_supplemental declared');
    return;
  }
  // rollup_supplemental may omit a state whose supplemental tally is zero (the
  // #607/#613 shape is {"total_rows":3,"missing":3}); total_rows is required and
  // unknown keys are rejected so a misspelled state cannot hide a count.
  const declaredSupplemental = manifest.rollup_supplemental;
  const supplementalProblems = [];
  if (declaredSupplemental === null || typeof declaredSupplemental !== 'object' || Array.isArray(declaredSupplemental)) {
    supplementalProblems.push('rollup_supplemental is not an object');
  } else {
    const unknownKeys = Object.keys(declaredSupplemental).filter((k) => !ROLLUP_KEYS.includes(k));
    if (unknownKeys.length) supplementalProblems.push(`unknown keys: ${unknownKeys.join(', ')}`);
    if (!hasOwn(declaredSupplemental, 'total_rows')) supplementalProblems.push('total_rows missing');
    for (const k of ROLLUP_KEYS) {
      const declared = hasOwn(declaredSupplemental, k) ? declaredSupplemental[k] : 0;
      if (declared !== supplementalRollup[k]) {
        supplementalProblems.push(
          `${k}: rollup_supplemental=${hasOwn(declaredSupplemental, k) ? JSON.stringify(declared) : '(absent)'} supplemental-tally=${supplementalRollup[k]}`,
        );
      }
    }
  }
  pushCheck(
    report,
    'rollup-supplemental-matches',
    authorityValid && supplementalProblems.length === 0,
    authorityValid && supplementalProblems.length === 0
      ? `rollup_supplemental matches the supplemental-row tally (${formatRollup(supplementalRollup)})`
      : [...(!authorityValid ? ['R-CD-2 reviewed authority failed'] : []), ...supplementalProblems].join('; '),
  );
}

/**
 * Firing buckets are every dispatch_allocation key except `supplemental`; together
 * they must allocate each required row exactly once and nothing else. A
 * per-row list (`[{ row, owner, status }]`, an older allocation shape) is
 * checked the same way. Corpora that predate dispatch_allocation have nothing
 * to check.
 */
function pushFiringBucketCheck(report, allocation, keyedAllocation, required) {
  if (allocation === undefined) {
    pushCheck(report, 'firing-buckets-cover-required', true, 'not applicable: no dispatch_allocation');
    return;
  }
  const problems = [];
  const allocations = [];
  let bucketCount = 0;
  if (Array.isArray(allocation)) {
    for (const [index, entry] of allocation.entries()) {
      if (typeof entry?.row === 'string' && entry.row.length > 0) allocations.push(entry.row);
      else problems.push(`dispatch_allocation[${index}] has no row id`);
    }
    bucketCount = allocation.length;
  } else if (keyedAllocation) {
    for (const [bucket, ids] of Object.entries(allocation)) {
      if (bucket === 'supplemental') continue;
      bucketCount += 1;
      if (!Array.isArray(ids)) {
        problems.push(`bucket ${bucket} is not an array of row ids`);
        continue;
      }
      for (const id of ids) {
        if (typeof id === 'string' && id.length > 0) allocations.push(id);
        else problems.push(`bucket ${bucket} has a non-string or empty entry ${JSON.stringify(id)}`);
      }
    }
  } else {
    problems.push(`dispatch_allocation is ${allocation === null ? 'null' : typeof allocation}, not row buckets`);
  }
  const counts = new Map();
  for (const id of allocations) counts.set(id, (counts.get(id) || 0) + 1);
  const uncovered = [...required].filter((id) => !counts.has(id));
  const repeated = [...counts]
    .filter(([id, count]) => required.has(id) && count > 1)
    .map(([id, count]) => `${id}×${count}`);
  const notRequired = [...counts.keys()].filter((id) => !required.has(id));
  if (uncovered.length) problems.push(`required rows in no firing bucket: ${uncovered.join(', ')}`);
  if (repeated.length) problems.push(`required rows allocated more than once: ${repeated.join(', ')}`);
  if (notRequired.length) problems.push(`non-required rows in firing buckets: ${notRequired.join(', ')}`);
  pushCheck(
    report,
    'firing-buckets-cover-required',
    problems.length === 0,
    problems.length === 0
      ? Array.isArray(allocation)
        ? `per-row dispatch_allocation covers the ${required.size} required rows exactly once`
        : `${bucketCount} firing buckets cover the ${required.size} required rows exactly once`
      : problems.join('; '),
  );
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
    // A manifest that declares required_rows is gated on its required-row tally,
    // so supplemental rows never count toward the current board. Legacy
    // manifests keep the all-rows tally.
    const requiredOnly = report.shaReport.requiredRollup !== undefined;
    const tallied = requiredOnly ? report.shaReport.requiredRollup : report.shaReport.talliedRollup;
    const tallyLabel = requiredOnly ? 'required-tally' : 'tallied';
    const diffs = [];
    for (const k of ROLLUP_KEYS) {
      const got = index.rollup[k];
      const expect = tallied[k];
      if (got !== expect) diffs.push(`${k}: index=${got} ${tallyLabel}=${expect}`);
    }
    const authorityValid = report.shaReport.rCd2AuthorityValid !== false;
    pushCheck(
      report,
      'rollup-matches-manifest',
      authorityValid && diffs.length === 0,
      authorityValid && diffs.length === 0
        ? requiredOnly
          ? `INDEX rollup matches manifest required-row tally (${formatRollup(tallied)}); ` +
            `${report.shaReport.supplementalRollup.total_rows} supplemental rows excluded`
          : `INDEX rollup matches manifest tally (${formatRollup(tallied)})`
        : [
            ...(!authorityValid ? ['R-CD-2 reviewed authority failed'] : []),
            ...diffs,
          ].join('; '),
    );
  } else if (!index.rollup) {
    pushCheck(report, 'rollup-matches-manifest', false, 'INDEX.rollup missing');
  }

  return report;
}

function isLegacySchemaReport(report) {
  if (!report || report.skipped) return false;
  return (report.checks || []).some((c) =>
    c.ok === false && (c.name === 'schema-manifest' || c.name === 'schema-manifest-capture-sha'),
  );
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
  if (args.current) args.index = true;
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
    let archivalFailed = false;
    for (const r of reports) {
      if (r.skipped) skipped += 1;
      if (reportFailed(r)) archivalFailed = true;
      if (!wantJson) console.log(renderReport(r));
    }
    const validated = reports.length - skipped;
    const okCount = reports.filter((r) => !r.skipped && !reportFailed(r)).length;
    const failedReports = reports.filter((r) => !r.skipped && reportFailed(r)).length;
    const legacySchemaReports = reports.filter(isLegacySchemaReport).length;
    const archivalSummary = {
      archival: true,
      fatalOnlyWithStrict: true,
      reportCount: reports.length,
      validated,
      ok: okCount,
      skippedNoManifest: skipped,
      failedReports,
      legacySchemaReports,
    };
    failed = Boolean(args.strict) && archivalFailed;
    if (!wantJson) {
      console.log(
        `\n--all archival summary: ${validated} validated (${okCount} OK), ` +
          `${failedReports} failed historical reports, ${legacySchemaReports} legacy-schema reports, ` +
          `${skipped} skipped (no manifest). Use --index/--current for current-board gating; add --strict to make archival failures fatal.`,
      );
    }
    payload = { mode: 'all', root, archivalSummary, archivalFailed, reports };
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
