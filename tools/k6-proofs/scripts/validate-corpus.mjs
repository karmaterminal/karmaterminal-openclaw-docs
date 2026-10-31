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
 * keep exactly the old checks, plus one that fails only if they carry a
 * supplemental marker (supplemental-requires-required-rows).
 *
 * Required preflight attachments (🌊's F″ method ruling, Discord
 * 1565895695586558120): R-CW-5A/6A are not proof rows of a corpus folded after
 * the ruling but required preflights of R-CW-5/6, as the row manifests'
 * `requiredPreflights` declare. Such a corpus records them in
 * `preflight_attachments` ([{ attachment, attached_to, state, candidate_sha, dir,
 * receipt, … }]), never in a row set, so the required tally and rollup leave them
 * out. The corpora folded before the ruling are frozen by name in
 * pre-f2-ruling-corpora.json (every manifest-bearing PROOFS dir at docs f17d784d,
 * F′ included) and keep exactly the checks above. Every other corpus that
 * declares `preflight_attachments`, carries a gated live row, or carries a
 * preflight row gets two checks: `preflight-attachments-valid` (no preflight is a
 * row; each record names a catalog preflight of a row of this corpus, its receipt
 * lies under PROOFS/<sha>/<attachment>/, and its declared state agrees with the
 * receipt judged at this corpus's SHA) and `live-rows-gated-by-preflights` (a gated
 * live row, its id compared canonically and required to be spelled canonically,
 * is not `pass` unless every required preflight's receipt passed at this SHA).
 * A passing preflight is necessary, not sufficient.
 *
 * Declared row caps (🌊's ruling on docs#616, Discord 1565925290008387728): a row
 * manifest may declare `verdictCap` (lib/row-verdict-cap.mjs), and a process-local
 * row must; R-CW-5/6 declare PARTIAL-candidate. Every corpus not frozen in
 * pre-f2-ruling-corpora.json that carries such a row, its id compared
 * canonically, gets `rows-within-declared-cap`: the row is not recorded above its
 * cap (state `pass`), whatever its preflights say. Lifting a cap needs a
 * superseding authority receipt from a different artifact class, adopted by an
 * explicit method change; none is adopted, so a `superseding_authority` on the
 * row does not lift it either. A row is bound to a capped row by its id, any
 * segment of its normalized `dir`, or its `manifest`, so an alias (`R-CW-05` in
 * R-CW-5's directory, or a row filed under it) is refused and capped. A row that
 * names none of them (`R-CW-05` in its own directory, no `manifest`) is outside
 * this check: a corpus naming only catalog rows is the seed method's to require. A state that is not a known state at or below the cap (a
 * typo, `passed`) fails too. If the catalog's cap declarations cannot be trusted,
 * every corpus that is not exempt gets the check, failed.
 *
 * The pre-ruling corpora are exempt by the same list (52 of the 71 record
 * R-CW-5/6 `pass`; F′ was corrected to partial on docs main 7e544c04), but only
 * for capped rows that still record what they recorded at the cap ruling:
 * pre-cap-ruling-capped-row-states.json pins each frozen corpus's R-CW-5/6 states
 * at 7e544c04. A capped row in a frozen-named corpus that is new, changed (F′'s
 * correction reverted) or an alias is held to its cap; the corpus keeps its
 * pre-ruling method for every other check. A new fold in a frozen directory is
 * held to the cap unless its capped rows record exactly the pinned states: in the
 * 52 frozen corpora pinned at pass, the validator cannot tell such a re-fold from
 * the historical record.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { basename, join, posix, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { consumeRcd2Authority } from '../lib/r-cd-2-authority-context.mjs';
import {
  canonicalRowId,
  catalogPreflightFailures,
  evaluateRequiredPreflight,
  preflightCatalog,
} from '../lib/required-preflight.mjs';
import {
  canonicalCorpusState,
  catalogVerdictCapFailures,
  corpusStateAboveCap,
  corpusStateWithinCap,
  ROW_CAP_NOTE,
  verdictCapCatalog,
} from '../lib/row-verdict-cap.mjs';

const STALE_TOKENS = [
  'pending_push',
  'pending push',
  'upload-blame',
  'TODO-UPLOAD',
  'pending_upload',
];

const ROLLUP_KEYS = ['total_rows', 'pass', 'partial', 'thin', 'fail', 'honest_limit', 'missing'];
const STATE_KEYS = ['pass', 'partial', 'thin', 'fail', 'honest_limit', 'missing'];

// The row-manifest catalog that declares which live rows require which
// preflights, and which rows are capped. It is the harness's own catalog, next to
// this script, so a corpus under --root is judged by the method this checkout
// carries.
const PREFLIGHT_CATALOG_DIR = fileURLToPath(new URL('../manifests/', import.meta.url));
const ATTACHMENT_STATES = ['pass', 'fail', 'missing'];
const PREFLIGHT_CAP_NOTE = 'a live row without a passing same-candidate preflight is capped at partial';
// The corpora folded before the ruling, frozen by name; see the header.
const PRE_RULING_CORPORA_FILE = fileURLToPath(new URL('./pre-f2-ruling-corpora.json', import.meta.url));
// Their capped rows' states at the cap ruling; see the header.
const PRE_CAP_RULING_PINS_FILE = fileURLToPath(new URL('./pre-cap-ruling-capped-row-states.json', import.meta.url));
// A corpus folded after the ruling spells every row id in plain ASCII. Canonical
// comparison catches the common variants, but no denylist can catch every
// invisible character or look-alike letter, so anything else is refused.
const PLAIN_ROW_ID = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

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
  // A declared preflight attachment's directory is referenced too; its own
  // check (preflight-attachments-valid) judges what is in it.
  const attachmentDirs = new Set(
    (Array.isArray(manifest.preflight_attachments) ? manifest.preflight_attachments : [])
      .filter((entry) => typeof entry?.dir === 'string')
      .map((entry) => entry.dir.replace(/\/+$/, '')),
  );
  const ignoredSupportDirs = [];
  const referencedAttachmentDirs = [];
  const orphanDirs = [];
  for (const sub of onDiskRowDirs) {
    if (supportDirs.has(sub) || sub.startsWith('_')) {
      ignoredSupportDirs.push(`PROOFS/${sha}/${sub}/`);
      continue;
    }
    const candidate = join('PROOFS', sha, sub);
    if (declaredDirs.has(candidate)) continue;
    if (attachmentDirs.has(candidate)) referencedAttachmentDirs.push(`PROOFS/${sha}/${sub}/`);
    else orphanDirs.push(`PROOFS/${sha}/${sub}/`);
  }
  const rowDirCount = onDiskRowDirs.length - ignoredSupportDirs.length - referencedAttachmentDirs.length;
  pushCheck(
    report,
    'no-orphan-row-dirs',
    orphanDirs.length === 0,
    orphanDirs.length === 0
      ? `${rowDirCount} on-disk row dirs all referenced; ` +
          `${referencedAttachmentDirs.length ? `preflight attachment dirs: ${referencedAttachmentDirs.join(', ')}; ` : ''}` +
          `ignored support dirs: ${ignoredSupportDirs.length ? ignoredSupportDirs.join(', ') : 'none'}`
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
    // Legacy manifests keep exactly the checks above, and every row counts as
    // required. A supplemental marker would contradict that silently, so it fails.
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

  validatePreflightAttachments(report, root, sha, manifest);
  validateDeclaredCaps(report, sha, manifest);

  return report;
}

let preflightCatalogCache;

/**
 * The catalog's preflight and cap indexes, plus every reason each cannot be
 * trusted: `errors` for the preflight index, `capErrors` for the cap index.
 */
function loadPreflightCatalog() {
  if (preflightCatalogCache) return preflightCatalogCache;
  const entries = [];
  const readErrors = [];
  let files = [];
  try {
    files = readdirSync(PREFLIGHT_CATALOG_DIR).filter((name) => name.endsWith('.json')).sort();
  } catch (err) {
    readErrors.push(`manifest catalog unreadable: ${err.message}`);
  }
  for (const file of files) {
    try {
      entries.push({ file, manifest: JSON.parse(readFileSync(join(PREFLIGHT_CATALOG_DIR, file), 'utf8')) });
    } catch (err) {
      readErrors.push(`${file}: ${err.message}`);
    }
  }
  if (!readErrors.length && entries.length === 0) readErrors.push('manifest catalog is empty');
  // Canonical ids, so a corpus row spelled another way still finds its cap.
  const capsByRow = new Map([...verdictCapCatalog(entries)].map(([rowId, cap]) => [canonicalRowId(rowId), cap]));
  // By manifest basename, so a corpus row's `manifest` binds it to its cap too.
  const cappedRowByFile = new Map([...capsByRow].map(([rowId, cap]) => [cap.file, rowId]));
  preflightCatalogCache = {
    ...preflightCatalog(entries),
    errors: [...readErrors, ...catalogPreflightFailures(entries)],
    capsByRow,
    cappedRowByFile,
    capErrors: [...readErrors, ...catalogVerdictCapFailures(entries)],
  };
  return preflightCatalogCache;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function listIds(ids) {
  return ids.length <= 2 ? ids.join(' and ') : `${ids.slice(0, -1).join(', ')} and ${ids.at(-1)}`;
}

/** A receipt path is a plain relative file path under the attachment's own directory. */
function receiptPathIsUnder(path, dir) {
  if (typeof path !== 'string' || !path.startsWith(dir) || path.length <= dir.length) return false;
  return path.split('/').every((segment) => segment && segment !== '.' && segment !== '..');
}

/**
 * Judge one attachment's receipt at this corpus's SHA. The receipt is read from
 * disk and re-judged; a record's declared state is never taken on its word.
 */
function judgeAttachmentReceipt(root, sha, entry, requirement, liveRowId) {
  const dir = `PROOFS/${sha}/${entry.attachment}/`;
  if (!hasOwn(entry, 'receipt')) return { status: 'missing', reasons: ['no receipt declared'] };
  if (!receiptPathIsUnder(entry.receipt, dir)) {
    return { status: 'invalid', reasons: [`receipt ${entry.receipt} is not a file under ${dir}`], location: true };
  }
  const file = join(root, entry.receipt);
  if (!existsSync(file) || !statSync(file).isFile()) return { status: 'missing', reasons: [`${entry.receipt} not found`] };
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    return { status: 'invalid', reasons: [`receipt is not JSON (${err.message})`] };
  }
  return evaluateRequiredPreflight({ requirement, liveRowId, candidateSha: sha, receipt });
}

let preRulingCache;

/** The frozen pre-ruling corpus names. Unreadable, it is empty: every corpus is held to the ruling. */
function loadPreRulingCorpora() {
  if (preRulingCache) return preRulingCache;
  try {
    const parsed = JSON.parse(readFileSync(PRE_RULING_CORPORA_FILE, 'utf8'));
    if (!Array.isArray(parsed?.corpora) || parsed.corpora.some((name) => typeof name !== 'string')) {
      throw new Error('corpora is not a list of PROOFS directory names');
    }
    preRulingCache = { corpora: new Set(parsed.corpora), error: null };
  } catch (err) {
    preRulingCache = { corpora: new Set(), error: `the pre-ruling corpus list is unreadable (${err.message})` };
  }
  return preRulingCache;
}

let capPinsCache;

/** A recorded state as the pins compare it: exactly as written, null for none. */
function pinnedState(state) {
  return JSON.stringify(state === undefined ? null : state);
}

/**
 * The frozen corpora's capped-row states at the cap ruling, as
 * `Map<sha, Map<rowId, string[]>>` of pinnedState values. Unreadable, it pins
 * nothing, so no frozen capped row is exempt.
 */
function loadCapPins() {
  if (capPinsCache) return capPinsCache;
  try {
    const parsed = JSON.parse(readFileSync(PRE_CAP_RULING_PINS_FILE, 'utf8'));
    const corpora = isPlainObject(parsed?.corpora) ? Object.entries(parsed.corpora) : [];
    const wellFormed = corpora.every(([, rows]) => isPlainObject(rows) && Object.values(rows).every((states) => Array.isArray(states) && states.length > 0));
    if (parsed?.schema !== 'openclaw.k6.pre-cap-ruling-capped-row-states.v1' || !corpora.length || !wellFormed) {
      throw new Error('corpora is not a map of PROOFS directory names to capped-row state lists');
    }
    const pins = new Map(corpora.map(([sha, rows]) => [sha, new Map(Object.entries(rows).map(([rowId, states]) => [rowId, states.map(pinnedState)]))]));
    capPinsCache = { pins, error: null };
  } catch (err) {
    capPinsCache = { pins: new Map(), error: `the pre-cap-ruling capped-row states are unreadable (${err.message})` };
  }
  return capPinsCache;
}

/**
 * The F″ required-preflight checks (see the header). A pre-ruling corpus, or one
 * with no gated live row, no preflight row and no preflight_attachments, gets no
 * check, so F′ and every older corpus keep exactly their previous report.
 */
function validatePreflightAttachments(report, root, sha, manifest) {
  const preRuling = loadPreRulingCorpora();
  if (preRuling.corpora.has(sha)) return;
  const catalog = loadPreflightCatalog();
  const declared = hasOwn(manifest, 'preflight_attachments');
  const short = sha.slice(0, 10);

  // Every row set the manifest declares, compared canonically, so a preflight
  // or a gated row spelled another way is still found.
  const rowSets = [
    ['rows[]', manifest.rows.map((row) => row?.row)],
    ['required_rows', stringIds(manifest.required_rows)],
    ['dispatch_allocation.supplemental', isPlainObject(manifest.dispatch_allocation) ? stringIds(manifest.dispatch_allocation.supplemental) : []],
    ['supplemental_rows', stringIds(manifest.supplemental_rows)],
  ];
  const preflightRows = new Map();
  for (const [label, ids] of rowSets) {
    for (const raw of ids) {
      const id = canonicalRowId(raw);
      if (!catalog.liveRowByPreflight.has(id)) continue;
      const found = preflightRows.get(id) || { sets: [], spellings: [] };
      if (!found.sets.includes(label)) found.sets.push(label);
      if (raw !== id && !found.spellings.includes(raw)) found.spellings.push(raw);
      preflightRows.set(id, found);
    }
  }
  const gatedRows = manifest.rows
    .map((row) => ({ row, id: canonicalRowId(row?.row) }))
    .filter(({ id }) => catalog.requirementsByLiveRow.has(id));
  const liveRowIds = new Set(gatedRows.map(({ id }) => id));
  // Ids that are not plain ASCII and that canonical comparison did not already
  // tie to a gated or preflight row, which are reported on their own.
  const oddIds = [];
  for (const [, ids] of rowSets) {
    for (const raw of ids) {
      if (typeof raw === 'string' && PLAIN_ROW_ID.test(raw)) continue;
      const id = canonicalRowId(raw);
      if (catalog.requirementsByLiveRow.has(id) || catalog.liveRowByPreflight.has(id)) continue;
      if (!oddIds.includes(raw)) oddIds.push(raw);
    }
  }
  if (!declared && gatedRows.length === 0 && preflightRows.size === 0 && oddIds.length === 0) return;

  const problems = [];
  if (preRuling.error) problems.push(preRuling.error);
  if (catalog.errors.length) problems.push(`the preflight catalog is inconsistent: ${catalog.errors.join('; ')}`);
  for (const [id, { sets, spellings }] of preflightRows) {
    problems.push(
      `${id} is a retired preflight attachment and cannot be a row of a corpus folded after the F″ ruling ` +
        `(in ${sets.join(', ')}${spellings.length ? `; spelled ${spellings.map(showId).join(', ')}` : ''})`,
    );
  }

  const records = new Map();
  if (declared) {
    if (!hasOwn(manifest, 'required_rows')) {
      problems.push('preflight_attachments requires required_rows (the tally its attachments are retired from)');
    }
    const list = manifest.preflight_attachments;
    if (!Array.isArray(list)) problems.push('preflight_attachments is not an array');
    for (const [index, entry] of (Array.isArray(list) ? list : []).entries()) {
      if (!isPlainObject(entry) || typeof entry.attachment !== 'string' || !entry.attachment) {
        problems.push(`preflight_attachments[${index}] has no attachment id`);
        continue;
      }
      const id = entry.attachment;
      const canonical = canonicalRowId(id);
      if (id !== canonical && catalog.liveRowByPreflight.has(canonical)) {
        problems.push(`attachment id ${showId(id)} must be spelled ${canonical}`);
        continue;
      }
      if (records.has(id)) {
        problems.push(`${id} is listed twice`);
        continue;
      }
      const live = catalog.liveRowByPreflight.get(id);
      if (!live) {
        problems.push(`${id} is not a required preflight of any catalog row`);
        continue;
      }
      if (entry.attached_to !== live) problems.push(`${id} is attached to ${entry.attached_to}, but the catalog attaches it to ${live}`);
      if (!liveRowIds.has(live)) problems.push(`${id} is attached to ${live}, which is not a row of this corpus`);
      const requirement = catalog.requirementsByLiveRow.get(live).find((candidate) => candidate.rowId === id);
      if (hasOwn(entry, 'manifest') && entry.manifest !== requirement.manifestPath) {
        problems.push(`${id} manifest ${entry.manifest} is not ${requirement.manifestPath}`);
      }
      if (!ATTACHMENT_STATES.includes(entry.state)) {
        problems.push(`${id} state ${showId(entry.state)} is not one of ${ATTACHMENT_STATES.join(', ')}`);
      }
      if (entry.candidate_sha !== sha) problems.push(`${id} candidate_sha ${entry.candidate_sha} is not this corpus (${sha})`);
      const dir = `PROOFS/${sha}/${id}/`;
      if (hasOwn(entry, 'dir')) {
        const fullDir = typeof entry.dir === 'string' ? join(root, entry.dir) : null;
        if (entry.dir !== dir || !fullDir || !existsSync(fullDir) || !statSync(fullDir).isDirectory()) {
          problems.push(`${id} dir ${entry.dir} is not ${dir} on disk`);
        }
      }
      if (hasOwn(entry, 'evidence_doc') && (typeof entry.evidence_doc !== 'string' || !existsSync(join(root, entry.evidence_doc)))) {
        problems.push(`${id} evidence_doc ${entry.evidence_doc} does not exist`);
      }
      const judged = judgeAttachmentReceipt(root, sha, entry, requirement, live);
      if (judged.location) problems.push(`${id} ${judged.reasons[0]}`);
      else if (entry.state === 'pass' && judged.status !== 'passed') {
        problems.push(`${id} declares pass but its receipt is ${judged.status}: ${judged.reasons.join(', ')}`);
      } else if (entry.state === 'fail' && judged.status !== 'failed') {
        problems.push(`${id} declares fail but its receipt is ${judged.status}: ${judged.reasons.join(', ') || 'it passed'}`);
      } else if (entry.state === 'missing' && hasOwn(entry, 'receipt')) {
        problems.push(`${id} declares missing but its receipt is ${judged.status}`);
      }
      records.set(id, { entry, status: judged.status });
    }
    report.preflightAttachments = [...records.values()].map(({ entry, status }) => ({
      attachment: entry.attachment,
      attachedTo: entry.attached_to,
      state: entry.state,
      receiptStatus: status,
    }));
  }
  pushCheck(
    report,
    'preflight-attachments-valid',
    problems.length === 0,
    problems.length
      ? problems.join('; ')
      : declared
        ? `${records.size} preflight attachment${records.size === 1 ? '' : 's'}: ` +
            (records.size ? [...records.values()].map(({ entry }) => `${entry.attachment}→${entry.attached_to} ${entry.state}`).join(', ') : 'none')
        : 'no preflight attachments declared',
  );

  // The gate: the receipt decides, and a passing receipt also needs a record
  // that says pass. Anything else leaves the live row capped below pass.
  const gateProblems = [];
  if (catalog.errors.length) gateProblems.push('the preflight catalog is inconsistent, so no live row can be shown gated');
  for (const raw of oddIds) {
    gateProblems.push(
      `row id ${showId(raw)} is not a plain row id (${PLAIN_ROW_ID.source}); a corpus folded after the F″ ruling ` +
        'spells every row id in plain ASCII, so no gated row can hide behind another spelling',
    );
  }
  const gateLines = [];
  for (const { row, id } of gatedRows) {
    if (row.row !== id) gateProblems.push(`row id ${showId(row.row)} is a non-canonical spelling of ${id}`);
    const statuses = catalog.requirementsByLiveRow.get(id).map((requirement) => {
      const record = records.get(requirement.rowId);
      let status = record ? record.status : 'missing';
      if (status === 'passed' && record.entry.state !== 'pass') status = `declared ${record.entry.state}`;
      return { preflight: requirement.rowId, status };
    });
    const blocked = statuses.filter(({ status }) => status !== 'passed');
    const passedText = `${statuses.map(({ preflight }) => `${preflight} passed`).join(', ')} at ${short}`;
    if (row.state === 'pass') {
      for (const { preflight, status } of blocked) {
        gateProblems.push(`${id} is pass but its required preflight ${preflight} is ${status} at ${short}`);
      }
      // The gate is satisfied; whether pass is allowed at all is rows-within-declared-cap's call.
      if (!blocked.length) gateLines.push(`${id} pass; ${passedText}`);
    } else if (blocked.length) {
      gateLines.push(`${id} ${row.state} (capped): ${blocked.map(({ preflight, status }) => `${preflight} ${status}`).join(', ')}`);
    } else {
      gateLines.push(`${id} ${row.state}; ${passedText}`);
    }
  }
  pushCheck(
    report,
    'live-rows-gated-by-preflights',
    gateProblems.length === 0,
    gateProblems.length
      ? [...(declared ? [] : ['no preflight_attachments are declared']), ...gateProblems, PREFLIGHT_CAP_NOTE].join('; ')
      : gateLines.length
        ? gateLines.join('; ')
        : 'no row of this corpus requires a preflight',
  );
}

/**
 * The declared-cap check (see the header): a row bound to a capped catalog row,
 * by its id, `dir` or `manifest`, is recorded under that row's own id and in a
 * known state at or below its cap. In a pre-ruling corpus, a capped row that
 * still records its pinned states is exempt. A corpus with no capped row left to
 * judge under a trustworthy catalog gets no check.
 */
function validateDeclaredCaps(report, sha, manifest) {
  const problems = [];
  const frozen = loadPreRulingCorpora().corpora.has(sha);
  const pins = frozen ? loadCapPins() : null;
  if (pins?.error) problems.push(pins.error);
  const catalog = loadPreflightCatalog();
  const bound = [];
  for (const row of manifest.rows) {
    const own = canonicalRowId(row?.row);
    const bindings = new Map();
    const bind = (id, how) => bindings.set(id, [...(bindings.get(id) || []), how]);
    if (typeof row?.dir === 'string') {
      // Every segment of the normalized path, so a row filed under a capped row's
      // directory (R-CW-5/fixture-ronan/, R-CW-5/.) is bound to it as well.
      for (const segment of new Set(posix.normalize(row.dir).split('/').map(canonicalRowId))) {
        if (catalog.capsByRow.has(segment)) bind(segment, `its dir ${row.dir}`);
      }
    }
    if (typeof row?.manifest === 'string' && catalog.cappedRowByFile.has(basename(row.manifest))) {
      bind(catalog.cappedRowByFile.get(basename(row.manifest)), `its manifest ${row.manifest}`);
    }
    const capId = catalog.capsByRow.has(own) ? own : bindings.keys().next().value;
    if (capId === undefined) continue;
    const aliases = [...bindings].filter(([id]) => id !== own);
    bound.push({ row, capId, label: own || showId(row?.row), cap: catalog.capsByRow.get(capId), aliases });
  }
  // A frozen corpus's capped row is exempt while the rows recorded under its own
  // id still carry exactly the pinned states, in order. An alias never is.
  let capped = bound;
  if (frozen && !pins.error) {
    const corpusPins = pins.pins.get(sha) || new Map();
    const recorded = new Map();
    for (const entry of bound) {
      if (entry.aliases.length || entry.label !== entry.capId) continue;
      recorded.set(entry.capId, [...(recorded.get(entry.capId) || []), pinnedState(entry.row.state)]);
    }
    const unchanged = new Set(
      [...recorded].filter(([id, states]) => JSON.stringify(states) === JSON.stringify(corpusPins.get(id) || [])).map(([id]) => id),
    );
    capped = bound.filter((entry) => entry.aliases.length || entry.label !== entry.capId || !unchanged.has(entry.capId));
  }
  if (capped.length === 0 && catalog.capErrors.length === 0 && problems.length === 0) return;

  if (catalog.capErrors.length) problems.push(`the verdict-cap catalog is inconsistent: ${catalog.capErrors.join('; ')}`);
  const lines = [];
  for (const { row, label, cap, aliases } of capped) {
    for (const [id, hows] of aliases) {
      problems.push(
        `row ${typeof row?.row === 'string' ? row.row : showId(row?.row)} is bound to the capped row ${id} by ${hows.join(' and ')}; ` +
          'a capped row is recorded under its own id',
      );
    }
    const state = canonicalCorpusState(row.state);
    const written = state === '' ? showId(row.state) : row.state === state ? state : `${state} (recorded as ${showId(row.state)})`;
    if (corpusStateWithinCap(row.state, cap.rowCap)) {
      if (!aliases.length) lines.push(`${label} ${written}, within the ${cap.rowCap} cap ${cap.file} declares (${cap.artifactClass})`);
      continue;
    }
    const relation = corpusStateAboveCap(row.state, cap.rowCap) ? 'above' : 'not a state known to lie within';
    // No superseding authority is adopted (the catalog rule keeps
    // supersedingAuthorities empty), so a declared one cannot lift the cap.
    const authority = hasOwn(row, 'superseding_authority')
      ? `its superseding_authority ${showId(row.superseding_authority)} is not adopted: ${cap.file} adopts no superseding authority`
      : 'it declares no superseding authority';
    problems.push(`${label} is ${written}, ${relation} the ${cap.rowCap} cap ${cap.file} declares (verdictCap.rowCap; ${cap.artifactClass}), and ${authority}`);
  }
  pushCheck(
    report,
    'rows-within-declared-cap',
    problems.length === 0,
    problems.length ? [...problems, ROW_CAP_NOTE].join('; ') : lines.join('; '),
  );
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
  const flaggedRows = manifest.rows.filter((row) => notRequiredFlags(row).length).map((row) => showId(row?.row));
  if (flaggedRows.length) markers.push(`rows flagged as not required: ${flaggedRows.join(', ')}`);
  return markers;
}

/** Flags on a row that is counted as required: `supplemental` must be absent or false, `required` absent or true. */
function notRequiredFlags(row) {
  const flags = [];
  if (hasOwn(row, 'supplemental') && row.supplemental !== false) flags.push(`supplemental=${JSON.stringify(row.supplemental)}`);
  if (hasOwn(row, 'required') && row.required !== true) flags.push(`required=${JSON.stringify(row.required)}`);
  return flags;
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
      for (const flag of notRequiredFlags(row)) flagProblems.push(`non-supplemental row ${showId(id)} has ${flag}`);
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
  // total_rows is the declared required count too, not only the rows[] entries
  // that happen to carry a required id.
  if (rollupIsObject && declaredRollup.total_rows !== required.size) {
    rollupDiffs.push(`total_rows: manifest=${declaredRollup.total_rows} required_rows=${required.size}`);
  }
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
