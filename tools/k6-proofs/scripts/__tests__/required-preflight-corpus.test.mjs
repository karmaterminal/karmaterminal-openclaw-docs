import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

// 🌊's F″ method ruling (Discord 1565895695586558120, 2026-10-31; bound to
// openclaw-bootstrap#1727): R-CW-5A/6A leave the required proof tally and become
// required preflight attachments of R-CW-5/6. A preflight receipt that passed at
// the same candidate is necessary for a live row, never sufficient: 🌊's ruling on
// docs#616 (Discord 1565925290008387728) keeps R-CW-5/6 at partial, the cap their
// manifests declare in `verdictCap`, while their only producer is a process-local
// fixture. The corpora folded before the ruling (every manifest-bearing PROOFS dir
// at docs f17d784d, F′ included) keep the method they were folded under; every
// other corpus is held to the ruling.
const repoRoot = new URL('../../../..', import.meta.url).pathname;
const validator = join(repoRoot, 'tools/k6-proofs/scripts/validate-corpus.mjs');
const legacyList = join(repoRoot, 'tools/k6-proofs/scripts/pre-f2-ruling-corpora.json');
const fossil = JSON.parse(
  await readFile(new URL('./fixtures/docs-f17d784d-fprime-manifest.json', import.meta.url), 'utf8'),
);
const BASE_REF = 'f17d784debae6eb1866d5c60c9518d06f49a3632';
const FPRIME_SHA = fossil.manifest.capture_sha;
const PRE_RULING_SHA = '4c235d8c1997e8964160117f8d6bf650ad1e8203';
// The F″ test corpus sits at a SHA no pre-ruling corpus has.
const SHA = 'f2'.repeat(20);
const SHORT = SHA.slice(0, 10);
const OTHER_SHA = 'a'.repeat(40);
const PREFLIGHTS = { 'R-CW-5A': 'R-CW-5', 'R-CW-6A': 'R-CW-6' };
const LEGACY_CHECKS = [
  'json-parse-manifest',
  'schema-manifest',
  'schema-manifest-capture-sha',
  'schema-manifest-rows',
  'capture-sha-agreement',
  'evidence-doc-exists',
  'row-dirs-exist',
  'no-orphan-row-dirs',
  'r-cd-2-reviewed-authority',
  'state-values-known',
  'no-stale-pending-tokens',
];
const ROW_SET_CHECKS = [
  'row-sets-defined',
  'row-sets-disjoint',
  'rows-match-row-sets',
  'supplemental-flags-agree',
  'firing-buckets-cover-required',
  'manifest-rollup-matches-required',
  'rollup-supplemental-matches',
];
const PREFLIGHT_CHECKS = ['preflight-attachments-valid', 'live-rows-gated-by-preflights'];
const ROW_CAP_CHECKS = ['rows-within-declared-cap'];
const CAP_NOTE = 'a live row without a passing same-candidate preflight is capped at partial';
const ROW_CAP_NOTE =
  'a passing preflight is necessary, not sufficient; lifting a declared cap needs a superseding authority ' +
  'receipt from a different artifact class, adopted by an explicit method change';
/** The cap-check problem for one live row recorded above its declared cap. */
const OVER_CAP = (live) => new RegExp(
  `${live} is pass, above the PARTIAL-candidate cap ${live.toLowerCase()}\\.json declares \\(verdictCap\\.rowCap; process-local-fixture\\)`,
);
// F′ is 38 required rows with R-CW-5A/6A missing; retiring them leaves 36. R-CW-5/6
// are partial, as F′ was corrected on docs main 7e544c04.
const FDOUBLE_ROLLUP = { total_rows: 36, pass: 27, partial: 5, thin: 0, fail: 0, honest_limit: 0, missing: 4 };

function receiptPath(attachment, sha = SHA) {
  return `PROOFS/${sha}/${attachment}/static-validator-20261031T000000Z/required-preflight-receipt.json`;
}

/** The receipt static-corpus-row-validator.js writes for a preflight attachment run. */
function receipt(attachment, overrides = {}) {
  const passed = overrides.preflightStatus !== 'failed';
  return {
    schema: 'openclaw.k6.required-preflight-receipt.v1',
    preflightRow: attachment,
    attachedTo: PREFLIGHTS[attachment],
    candidateSha: SHA,
    sourceEvidenceSha: SHA,
    evidenceBinding: 'exact-candidate-sha',
    verdict: passed ? 'construct-only' : 'FAIL-candidate',
    preflightStatus: passed ? 'passed' : 'failed',
    checks: { sourceGuard: passed, exactCandidateBinding: true, materialNamesCandidate: true, nonLiveBoundary: true },
    ...overrides,
  };
}

function attachment(id, state = 'pass') {
  return {
    attachment: id,
    attached_to: PREFLIGHTS[id],
    manifest: `tools/k6-proofs/manifests/${id.toLowerCase()}-static.json`,
    state,
    candidate_sha: SHA,
    dir: `PROOFS/${SHA}/${id}/`,
    evidence_doc: `PROOFS/${SHA}/${id}/EVIDENCE.md`,
    ...(state === 'missing' ? {} : { receipt: receiptPath(id) }),
  };
}

/** The F′ fossil moved to `sha`: the same rows, R-CW-5A/6A still required rows. */
function fprimeAt(sha) {
  const manifest = structuredClone(fossil.manifest);
  manifest.capture_sha = sha;
  for (const row of manifest.rows) {
    row.dir = row.dir.replace(FPRIME_SHA, sha);
    row.evidence_doc = row.evidence_doc.replace(FPRIME_SHA, sha);
  }
  return manifest;
}

/**
 * The F″ seed: F′ as corrected (R-CW-5/6 partial), with R-CW-5A/6A retired from
 * rows, required_rows and firing buckets.
 */
function fDouble({ attachments = ['R-CW-5A', 'R-CW-6A'] } = {}) {
  const manifest = fprimeAt(SHA);
  for (const id of ['R-CW-5', 'R-CW-6']) rowOf(manifest, id).state = 'partial';
  const retired = new Set(Object.keys(PREFLIGHTS));
  manifest.required_rows = manifest.required_rows.filter((id) => !retired.has(id));
  manifest.rows = manifest.rows.filter((row) => !retired.has(row.row));
  for (const [bucket, ids] of Object.entries(manifest.dispatch_allocation)) {
    manifest.dispatch_allocation[bucket] = ids.filter((id) => !retired.has(id));
  }
  manifest.rollup = { ...FDOUBLE_ROLLUP };
  if (attachments !== null) manifest.preflight_attachments = attachments.map((id) => attachment(id));
  return manifest;
}

/** Record partial rows as pass, the over-credit 🌊's ruling forbids, keeping the rollup tallied. */
function overCredit(manifest, ids) {
  for (const id of ids) {
    const row = rowOf(manifest, id);
    assert.equal(row.state, 'partial', id);
    row.state = 'pass';
  }
  manifest.rollup = { ...manifest.rollup, pass: manifest.rollup.pass + ids.length, partial: manifest.rollup.partial - ids.length };
  return manifest;
}

/** Rename a row everywhere the manifest names it. */
function renameRow(manifest, from, to) {
  for (const row of manifest.rows) if (row.row === from) row.row = to;
  manifest.required_rows = manifest.required_rows.map((id) => (id === from ? to : id));
  for (const [bucket, ids] of Object.entries(manifest.dispatch_allocation)) {
    manifest.dispatch_allocation[bucket] = ids.map((id) => (id === from ? to : id));
  }
}

function rowOf(manifest, id) {
  const row = manifest.rows.find((candidate) => candidate.row === id);
  assert.ok(row, `no ${id}`);
  return row;
}

function attachmentOf(manifest, id) {
  const entry = manifest.preflight_attachments.find((candidate) => candidate.attachment === id);
  assert.ok(entry, `no attachment ${id}`);
  return entry;
}

async function writeCorpus(root, sha, manifest, receipts = {}) {
  await mkdir(join(root, 'PROOFS', sha), { recursive: true });
  for (const row of manifest.rows) {
    if (row.dir) await mkdir(join(root, row.dir), { recursive: true });
    if (row.evidence_doc) {
      await mkdir(dirname(join(root, row.evidence_doc)), { recursive: true });
      await writeFile(join(root, row.evidence_doc), `# ${row.row}\n`);
    }
  }
  for (const entry of Array.isArray(manifest.preflight_attachments) ? manifest.preflight_attachments : []) {
    if (typeof entry?.dir === 'string') await mkdir(join(root, entry.dir), { recursive: true });
    if (typeof entry?.evidence_doc === 'string') {
      await mkdir(dirname(join(root, entry.evidence_doc)), { recursive: true });
      await writeFile(join(root, entry.evidence_doc), `# ${entry.attachment}\n`);
    }
  }
  for (const [path, content] of Object.entries(receipts)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`);
  }
  await writeFile(join(root, 'PROOFS', sha, 'proofs-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

function passingReceipts() {
  return {
    [receiptPath('R-CW-5A')]: receipt('R-CW-5A'),
    [receiptPath('R-CW-6A')]: receipt('R-CW-6A'),
  };
}

async function withRoot(fn) {
  const root = await mkdtemp(join(tmpdir(), 'k6-required-preflight-corpus-'));
  try {
    return await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function run(root, args) {
  const result = spawnSync(process.execPath, [validator, '--root', root, ...args, '--json'], { encoding: 'utf8' });
  assert.equal(result.stderr, '', result.stderr);
  return { status: result.status, payload: JSON.parse(result.stdout) };
}

async function validate(manifest, receipts = passingReceipts(), sha = manifest.capture_sha) {
  return withRoot(async (root) => {
    await writeCorpus(root, sha, manifest, receipts);
    const { status, payload } = run(root, ['--sha', sha]);
    return { status, report: payload.reports[0] };
  });
}

function failedChecks(report) {
  return report.checks.filter((check) => !check.ok).map((check) => check.name);
}

function check(report, name) {
  const found = report.checks.find((candidate) => candidate.name === name);
  assert.ok(found, `no ${name} check in ${report.checks.map((c) => c.name).join(', ')}`);
  return found;
}

/** Assert the corpus fails exactly the named checks, each detail matching. */
async function assertRejected(manifest, receipts, expected) {
  const { status, report } = await validate(manifest, receipts);
  assert.equal(status, 1, JSON.stringify(report.checks.filter((c) => !c.ok)));
  assert.deepEqual(failedChecks(report).sort(), Object.keys(expected).sort());
  for (const [name, detail] of Object.entries(expected)) assert.match(check(report, name).detail, detail, name);
  return report;
}

test('(e) an F″ corpus without R-CW-5A/6A in required_rows validates, and its rollup is the 36-row tally', async () => {
  const { status, report } = await validate(fDouble());
  assert.equal(status, 0, JSON.stringify(report.checks.filter((c) => !c.ok)));
  assert.deepEqual(report.checks.map((c) => c.name), [...LEGACY_CHECKS, ...ROW_SET_CHECKS, ...PREFLIGHT_CHECKS, ...ROW_CAP_CHECKS]);
  assert.match(check(report, 'row-sets-defined').detail, /^36 required \(required_rows\), 0 supplemental/);
  assert.match(check(report, 'firing-buckets-cover-required').detail, /cover the 36 required rows exactly once/);
  assert.deepEqual(report.requiredRollup, FDOUBLE_ROLLUP);
  assert.deepEqual(report.talliedRollup, FDOUBLE_ROLLUP);
  // The attachment directories are declared by preflight_attachments, not orphans.
  assert.match(check(report, 'no-orphan-row-dirs').detail, /^36 on-disk row dirs all referenced/);
  assert.match(check(report, 'preflight-attachments-valid').detail, /^2 preflight attachments: R-CW-5A→R-CW-5 pass, R-CW-6A→R-CW-6 pass/);
  assert.equal(
    check(report, 'live-rows-gated-by-preflights').detail,
    `R-CW-5 partial; R-CW-5A passed at ${SHORT}; R-CW-6 partial; R-CW-6A passed at ${SHORT}`,
  );
  // Both preflights passed, and both live rows are still partial: their cap.
  assert.equal(
    check(report, 'rows-within-declared-cap').detail,
    'R-CW-5 partial, within the PARTIAL-candidate cap r-cw-5.json declares (process-local-fixture); ' +
      'R-CW-6 partial, within the PARTIAL-candidate cap r-cw-6.json declares (process-local-fixture)',
  );
  assert.deepEqual(report.preflightAttachments, [
    { attachment: 'R-CW-5A', attachedTo: 'R-CW-5', state: 'pass', receiptStatus: 'passed' },
    { attachment: 'R-CW-6A', attachedTo: 'R-CW-6', state: 'pass', receiptStatus: 'passed' },
  ]);
});

test('(e) --index on the F″ corpus compares INDEX with the 36-row required tally', async () => {
  await withRoot(async (root) => {
    await writeCorpus(root, SHA, fDouble(), passingReceipts());
    const writeIndex = (rollup) => writeFile(join(root, 'PROOFS/INDEX.json'), `${JSON.stringify({
      schema: 'openclaw.proofs.index.v1',
      current_sha: SHA,
      corpus_path: `PROOFS/${SHA}/`,
      manifest_path: `PROOFS/${SHA}/proofs-manifest.json`,
      rollup,
    }, null, 2)}\n`);

    await writeIndex(FDOUBLE_ROLLUP);
    const ok = run(root, ['--index']);
    assert.equal(ok.status, 0, JSON.stringify(ok.payload.reports[0].checks.filter((c) => !c.ok)));
    assert.equal(ok.payload.reports[0].shaReport.failed, 0);

    // F′'s 38-row rollup no longer describes the F″ corpus.
    await writeIndex(fossil.manifest.rollup);
    const stale = run(root, ['--index']);
    assert.equal(stale.status, 1);
    assert.equal(
      check(stale.payload.reports[0], 'rollup-matches-manifest').detail,
      // The fossil is F′ as folded (29/3); the F″ seed starts from F′ as corrected (27/5).
      'total_rows: index=38 required-tally=36; pass: index=29 required-tally=27; partial: index=3 required-tally=5; missing: index=6 required-tally=4',
    );
  });
});

test('(a) an F″ R-CW-5 or R-CW-6 pass with no preflight receipt fails the live-row gate', async () => {
  for (const [live, preflight] of [['R-CW-5', 'R-CW-5A'], ['R-CW-6', 'R-CW-6A']]) {
    const withoutReceipt = passingReceipts();
    delete withoutReceipt[receiptPath(preflight)];
    const declaredMissing = overCredit(fDouble(), [live]);
    const index = declaredMissing.preflight_attachments.findIndex((entry) => entry.attachment === preflight);
    declaredMissing.preflight_attachments[index] = attachment(preflight, 'missing');
    await assertRejected(declaredMissing, withoutReceipt, {
      'live-rows-gated-by-preflights': new RegExp(`^${live} is pass but its required preflight ${preflight} is missing at ${SHORT}; ${CAP_NOTE}$`),
      'rows-within-declared-cap': OVER_CAP(live),
    }).catch((error) => { error.message = `${live} declared missing: ${error.message}`; throw error; });

    // No attachment entry at all; nothing is on disk for it either.
    const absent = overCredit(fDouble({ attachments: Object.keys(PREFLIGHTS).filter((id) => id !== preflight) }), [live]);
    await assertRejected(absent, withoutReceipt, {
      'live-rows-gated-by-preflights': new RegExp(`^${live} is pass but its required preflight ${preflight} is missing`),
      'rows-within-declared-cap': OVER_CAP(live),
    }).catch((error) => { error.message = `${live} no entry: ${error.message}`; throw error; });

    // Declared pass with the receipt file absent.
    await assertRejected(overCredit(fDouble(), [live]), withoutReceipt, {
      'preflight-attachments-valid': new RegExp(`${preflight} declares pass but its receipt is missing: .*not found`),
      'live-rows-gated-by-preflights': new RegExp(`^${live} is pass but its required preflight ${preflight} is missing`),
      'rows-within-declared-cap': OVER_CAP(live),
    }).catch((error) => { error.message = `${live} receipt file absent: ${error.message}`; throw error; });
  }
});

test('(a) a corpus that records a CW-5/6 pass without declaring preflight_attachments fails, whatever its shape', async () => {
  // The F″ shape with the attachment field forgotten, and both live rows over-credited.
  const forgotten = overCredit(fDouble({ attachments: null }), ['R-CW-5', 'R-CW-6']);
  const { status, report } = await validate(forgotten, {});
  assert.equal(status, 1);
  assert.deepEqual(failedChecks(report), ['live-rows-gated-by-preflights', 'rows-within-declared-cap']);
  assert.deepEqual(report.checks.map((c) => c.name), [...LEGACY_CHECKS, ...ROW_SET_CHECKS, ...PREFLIGHT_CHECKS, ...ROW_CAP_CHECKS]);
  assert.equal(check(report, 'preflight-attachments-valid').detail, 'no preflight attachments declared');
  assert.equal(
    check(report, 'live-rows-gated-by-preflights').detail,
    `no preflight_attachments are declared; R-CW-5 is pass but its required preflight R-CW-5A is missing at ${SHORT}; ` +
      `R-CW-6 is pass but its required preflight R-CW-6A is missing at ${SHORT}; ${CAP_NOTE}`,
  );

  // Without required_rows (the all-rows legacy shape), the same passes are still gated and capped.
  const noRequiredRows = overCredit(fDouble({ attachments: null }), ['R-CW-5', 'R-CW-6']);
  delete noRequiredRows.required_rows;
  delete noRequiredRows.dispatch_allocation;
  const legacyShape = await validate(noRequiredRows, {});
  assert.equal(legacyShape.status, 1);
  assert.deepEqual(failedChecks(legacyShape.report), ['live-rows-gated-by-preflights', 'rows-within-declared-cap']);
  assert.deepEqual(legacyShape.report.checks.map((c) => c.name), [...LEGACY_CHECKS, ...PREFLIGHT_CHECKS, ...ROW_CAP_CHECKS]);

  // The same shapes with both live rows capped at partial validate: nothing passes ungated.
  for (const shape of [forgotten, noRequiredRows]) {
    const capped = structuredClone(shape);
    rowOf(capped, 'R-CW-5').state = 'partial';
    rowOf(capped, 'R-CW-6').state = 'partial';
    capped.rollup = { ...FDOUBLE_ROLLUP };
    const ok = await validate(capped, {});
    assert.equal(ok.status, 0, JSON.stringify(ok.report.checks.filter((c) => !c.ok)));
    assert.equal(
      check(ok.report, 'live-rows-gated-by-preflights').detail,
      'R-CW-5 partial (capped): R-CW-5A missing; R-CW-6 partial (capped): R-CW-6A missing',
    );
  }
});

test('(a) a corpus folded after the ruling may not keep R-CW-5A/6A as rows: the F′ shape at a new SHA fails', async () => {
  // The F′ method, row for row, at a SHA that is not a pre-ruling corpus: 5A/6A
  // are required rows (here even `fail`) and R-CW-5/6 still pass.
  const manifest = fprimeAt(OTHER_SHA);
  rowOf(manifest, 'R-CW-5A').state = 'fail';
  rowOf(manifest, 'R-CW-6A').state = 'fail';
  manifest.rollup = { ...fossil.manifest.rollup, fail: 2, missing: 4 };
  const { status, report } = await validate(manifest, {});
  assert.equal(status, 1);
  assert.deepEqual(failedChecks(report).sort(), [...PREFLIGHT_CHECKS, ...ROW_CAP_CHECKS].sort());
  assert.match(check(report, 'rows-within-declared-cap').detail, OVER_CAP('R-CW-5'));
  assert.match(check(report, 'rows-within-declared-cap').detail, OVER_CAP('R-CW-6'));
  assert.match(
    check(report, 'preflight-attachments-valid').detail,
    /^R-CW-5A is a retired preflight attachment and cannot be a row of a corpus folded after the F″ ruling \(in rows\[\], required_rows\); R-CW-6A is a retired preflight attachment/,
  );
  assert.match(check(report, 'live-rows-gated-by-preflights').detail, /R-CW-5 is pass but its required preflight R-CW-5A is missing at aaaaaaaaaa/);

  // Nor as a supplemental row (the docs#613 route).
  const supplemental = fDouble();
  supplemental.dispatch_allocation.supplemental = ['R-CW-6A'];
  const asSupplemental = await validate(supplemental);
  assert.equal(asSupplemental.status, 1);
  assert.match(
    check(asSupplemental.report, 'preflight-attachments-valid').detail,
    /R-CW-6A is a retired preflight attachment and cannot be a row of a corpus folded after the F″ ruling \(in dispatch_allocation\.supplemental\)/,
  );
});

// Spellings a reader cannot tell from R-CW-5: case, padding, dash look-alikes,
// invisible format and bidi characters, a combining joiner, a variation selector,
// and a Cyrillic С. A denylist cannot cover them; only plain ASCII ids pass.
const GATED_SPELLINGS = [
  'r-cw-5', 'R-CW-5 ', ' R-CW-5', 'R‐CW‐5', 'R-CW-5​', 'R-CW-5‎', 'R-CW-5‏', 'R-CW-5‬',
  '⁦R-CW-5', 'R-CW⁢5', 'R-CW-5͏', 'R-CW-5️', 'R-СW-5', 'R⁃CW⁃5',
];
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const ODD_ID_DETAIL = (spelling) => new RegExp(
  `row id ${escapeRegExp(JSON.stringify(spelling))} (is a non-canonical spelling of R-CW-5|is not a plain row id)`,
);

test('a gated row id spelled another way is refused, not ungated', async () => {
  for (const spelling of GATED_SPELLINGS) {
    // Declared attachments: R-CW-5's own attachment is present and passing, but the
    // live row it gates is spelled differently.
    const declared = fDouble();
    renameRow(declared, 'R-CW-5', spelling);
    const { status, report } = await validate(declared);
    assert.equal(status, 1, JSON.stringify(spelling));
    assert.ok(failedChecks(report).includes('live-rows-gated-by-preflights'), `${JSON.stringify(spelling)}: ${failedChecks(report)}`);
    assert.match(check(report, 'live-rows-gated-by-preflights').detail, ODD_ID_DETAIL(spelling), JSON.stringify(spelling));

    // No attachments declared, and R-CW-6 gone too, so the disguised row is the
    // corpus's only candidate for a gated row: it still cannot pass unchecked.
    const alone = fDouble({ attachments: null });
    renameRow(alone, 'R-CW-5', spelling);
    alone.required_rows = alone.required_rows.filter((id) => id !== 'R-CW-6');
    alone.rows = alone.rows.filter((row) => row.row !== 'R-CW-6');
    for (const [bucket, ids] of Object.entries(alone.dispatch_allocation)) {
      alone.dispatch_allocation[bucket] = ids.filter((id) => id !== 'R-CW-6');
    }
    alone.rollup = { ...FDOUBLE_ROLLUP, total_rows: 35, partial: 4 };
    const bare = await validate(alone, {});
    assert.equal(bare.status, 1, JSON.stringify(spelling));
    assert.deepEqual(failedChecks(bare.report), ['live-rows-gated-by-preflights'], JSON.stringify(spelling));
    assert.match(check(bare.report, 'live-rows-gated-by-preflights').detail, ODD_ID_DETAIL(spelling), JSON.stringify(spelling));
  }

  // A disguised preflight row cannot slip back into the tally either.
  for (const spelling of ['R-CW-5A‎', 'R-СW-5A']) {
    const manifest = fDouble();
    manifest.required_rows.push(spelling);
    manifest.rows.push({ row: spelling, state: 'missing', owner: 'frond-scribe-static', dir: `PROOFS/${SHA}/odd-5a/`, evidence_doc: `PROOFS/${SHA}/odd-5a/EVIDENCE.md` });
    manifest.dispatch_allocation['frond-scribe-static'].push(spelling);
    manifest.rollup = { ...FDOUBLE_ROLLUP, total_rows: 37, missing: 5 };
    const { status, report } = await validate(manifest);
    assert.equal(status, 1, JSON.stringify(spelling));
    assert.match(
      `${check(report, 'preflight-attachments-valid').detail}; ${check(report, 'live-rows-gated-by-preflights').detail}`,
      new RegExp(`(R-CW-5A is a retired preflight attachment|row id ${escapeRegExp(JSON.stringify(spelling))} is not a plain row id)`),
      JSON.stringify(spelling),
    );
  }

  // A preflight row spelled another way is still a retired row.
  const misspelledPreflight = fDouble();
  misspelledPreflight.required_rows.push('r-cw-5a');
  misspelledPreflight.rows.push({ row: 'r-cw-5a', state: 'missing', owner: 'frond-scribe-static', dir: `PROOFS/${SHA}/r-cw-5a/`, evidence_doc: `PROOFS/${SHA}/r-cw-5a/EVIDENCE.md` });
  misspelledPreflight.dispatch_allocation['frond-scribe-static'].push('r-cw-5a');
  misspelledPreflight.rollup = { ...FDOUBLE_ROLLUP, total_rows: 37, missing: 5 };
  const { report } = await validate(misspelledPreflight);
  assert.match(check(report, 'preflight-attachments-valid').detail, /R-CW-5A is a retired preflight attachment .*spelled "r-cw-5a"/);
});

test('(b) a failed preflight caps the live row: pass fails validation, partial validates', async () => {
  for (const [live, preflight] of [['R-CW-5', 'R-CW-5A'], ['R-CW-6', 'R-CW-6A']]) {
    const receipts = { ...passingReceipts(), [receiptPath(preflight)]: receipt(preflight, { preflightStatus: 'failed' }) };

    const stillPass = overCredit(fDouble(), [live]);
    attachmentOf(stillPass, preflight).state = 'fail';
    await assertRejected(stillPass, receipts, {
      'live-rows-gated-by-preflights': new RegExp(`^${live} is pass but its required preflight ${preflight} is failed at ${SHORT}`),
      'rows-within-declared-cap': OVER_CAP(live),
    }).catch((error) => { error.message = `${live}: ${error.message}`; throw error; });

    const capped = fDouble();
    attachmentOf(capped, preflight).state = 'fail';
    const { status, report } = await validate(capped, receipts);
    assert.equal(status, 0, `${live}: ${JSON.stringify(report.checks.filter((c) => !c.ok))}`);
    assert.match(check(report, 'live-rows-gated-by-preflights').detail, new RegExp(`${live} partial \\(capped\\): ${preflight} failed`));
  }
});

test('(b) a failed receipt declared pass is a false attachment record', async () => {
  const receipts = { ...passingReceipts(), [receiptPath('R-CW-5A')]: receipt('R-CW-5A', { preflightStatus: 'failed' }) };
  await assertRejected(overCredit(fDouble(), ['R-CW-5']), receipts, {
    'preflight-attachments-valid': /R-CW-5A declares pass but its receipt is failed: preflightStatus=failed, verdict=FAIL-candidate, failed checks: sourceGuard/,
    'live-rows-gated-by-preflights': /^R-CW-5 is pass but its required preflight R-CW-5A is failed/,
    'rows-within-declared-cap': OVER_CAP('R-CW-5'),
  });

  // A receipt that passes overall but carries a false check, the wrong verdict,
  // no checks, or not the binding checks, is not a pass.
  for (const [label, overrides, detail] of [
    ['false check', { checks: { ...receipt('R-CW-5A').checks, sourceGuard: false } }, /failed checks: sourceGuard/],
    ['wrong verdict', { verdict: 'PASS-candidate' }, /verdict=PASS-candidate/],
    ['no checks', { checks: {} }, /receipt is invalid: checks is not a non-empty object of booleans/],
    ['unpinned checks', { checks: { x: true } }, /receipt is invalid: checks lacks exactCandidateBinding, materialNamesCandidate, nonLiveBoundary/],
  ]) {
    const mutated = { ...passingReceipts(), [receiptPath('R-CW-5A')]: receipt('R-CW-5A', overrides) };
    await assertRejected(overCredit(fDouble(), ['R-CW-5']), mutated, {
      'preflight-attachments-valid': detail,
      'live-rows-gated-by-preflights': /^R-CW-5 is pass but its required preflight R-CW-5A is (failed|invalid)/,
      'rows-within-declared-cap': OVER_CAP('R-CW-5'),
    }).catch((error) => { error.message = `${label}: ${error.message}`; throw error; });
  }
});

test('(c) a passing preflight receipt bound to a different SHA does not count', async () => {
  for (const [label, overrides] of [
    ['candidateSha', { candidateSha: OTHER_SHA }],
    ['sourceEvidenceSha (the INDEX static_evidence_sha carry)', { sourceEvidenceSha: '1cc8f4e3d617ef6f173283ef83d7b739a4995734' }],
    ['evidenceBinding', { evidenceBinding: 'index-static-evidence-sha' }],
  ]) {
    const receipts = { ...passingReceipts(), [receiptPath('R-CW-6A')]: receipt('R-CW-6A', overrides) };
    await assertRejected(overCredit(fDouble(), ['R-CW-6']), receipts, {
      'preflight-attachments-valid': /R-CW-6A declares pass but its receipt is wrong-candidate: /,
      'live-rows-gated-by-preflights': new RegExp(`^R-CW-6 is pass but its required preflight R-CW-6A is wrong-candidate at ${SHORT}`),
      'rows-within-declared-cap': OVER_CAP('R-CW-6'),
    }).catch((error) => { error.message = `${label}: ${error.message}`; throw error; });
  }

  // The attachment's own candidate_sha must be this corpus too.
  const manifest = fDouble();
  attachmentOf(manifest, 'R-CW-5A').candidate_sha = OTHER_SHA;
  await assertRejected(manifest, passingReceipts(), {
    'preflight-attachments-valid': new RegExp(`R-CW-5A candidate_sha aaaaaaaaaa.* is not this corpus \\(${SHORT}`),
  });
});

test('partial failure: one passing and one failed preflight gate only their own live row', async () => {
  const receipts = { ...passingReceipts(), [receiptPath('R-CW-6A')]: receipt('R-CW-6A', { preflightStatus: 'failed' }) };
  const manifest = fDouble();
  attachmentOf(manifest, 'R-CW-6A').state = 'fail';
  const { status, report } = await validate(manifest, receipts);
  assert.equal(status, 0, JSON.stringify(report.checks.filter((c) => !c.ok)));
  assert.equal(
    check(report, 'live-rows-gated-by-preflights').detail,
    `R-CW-5 partial; R-CW-5A passed at ${SHORT}; R-CW-6 partial (capped): R-CW-6A failed`,
  );
});

test('a receipt that is malformed, for the wrong row, or outside the corpus is invalid', async () => {
  for (const [label, mutate, detail] of [
    ['not JSON', (r) => { r[receiptPath('R-CW-5A')] = '{not json'; }, /R-CW-5A declares pass but its receipt is invalid: .*JSON/],
    ['wrong schema', (r) => { r[receiptPath('R-CW-5A')] = receipt('R-CW-5A', { schema: 'x' }); }, /receipt is invalid: schema is "x"/],
    ['other preflight row', (r) => { r[receiptPath('R-CW-5A')] = receipt('R-CW-6A'); }, /receipt is invalid: preflightRow is "R-CW-6A", expected R-CW-5A/],
  ]) {
    const receipts = passingReceipts();
    mutate(receipts);
    await assertRejected(overCredit(fDouble(), ['R-CW-5']), receipts, {
      'preflight-attachments-valid': detail,
      'live-rows-gated-by-preflights': /^R-CW-5 is pass but its required preflight R-CW-5A is invalid/,
      'rows-within-declared-cap': OVER_CAP('R-CW-5'),
    }).catch((error) => { error.message = `${label}: ${error.message}`; throw error; });
  }

  // A valid R-CW-5A receipt sits at each resolved path, so only the location is wrong.
  // The traversal resolves to the attachment's own receipt: `..` is refused as written.
  for (const [label, path] of [
    ['traversal', `PROOFS/${SHA}/R-CW-5A/../R-CW-5A/static-validator-20261031T000000Z/required-preflight-receipt.json`],
    ['another corpus', receiptPath('R-CW-5A', OTHER_SHA)],
    ['outside its dir', `PROOFS/${SHA}/R-CW-5/required-preflight-receipt.json`],
  ]) {
    const manifest = overCredit(fDouble(), ['R-CW-5']);
    attachmentOf(manifest, 'R-CW-5A').receipt = path;
    await assertRejected(manifest, { ...passingReceipts(), [path]: receipt('R-CW-5A') }, {
      'preflight-attachments-valid': new RegExp(`R-CW-5A receipt .* is not a file under PROOFS/${SHA}/R-CW-5A/`),
      'live-rows-gated-by-preflights': /^R-CW-5 is pass but its required preflight R-CW-5A is invalid/,
      'rows-within-declared-cap': OVER_CAP('R-CW-5'),
    }).catch((error) => { error.message = `${label}: ${error.message}`; throw error; });
  }
});

test('a retired preflight cannot also be a proof row of an F″ corpus', async () => {
  const manifest = fDouble();
  manifest.required_rows.push('R-CW-5A');
  manifest.rows.push({ row: 'R-CW-5A', state: 'missing', owner: 'frond-scribe-static', dir: `PROOFS/${SHA}/R-CW-5A/`, evidence_doc: `PROOFS/${SHA}/R-CW-5A/EVIDENCE.md` });
  manifest.dispatch_allocation['frond-scribe-static'].push('R-CW-5A');
  manifest.rollup = { ...FDOUBLE_ROLLUP, total_rows: 37, missing: 5 };
  await assertRejected(manifest, passingReceipts(), {
    'preflight-attachments-valid': /^R-CW-5A is a retired preflight attachment and cannot be a row of a corpus folded after the F″ ruling \(in rows\[\], required_rows\)$/,
  });
});

test('malformed preflight_attachments records fail preflight-attachments-valid', async () => {
  for (const [label, mutate, detail] of [
    ['not an array', (m) => { m.preflight_attachments = {}; }, /^preflight_attachments is not an array/],
    ['unknown attachment', (m) => { m.preflight_attachments.push({ ...attachment('R-CW-5A'), attachment: 'R-CW-9A' }); }, /R-CW-9A is not a required preflight of any catalog row/],
    ['misspelled attachment', (m) => { attachmentOf(m, 'R-CW-5A').attachment = 'r-cw-5a'; }, /attachment id "r-cw-5a" must be spelled R-CW-5A/],
    ['wrong live row', (m) => { attachmentOf(m, 'R-CW-5A').attached_to = 'R-CW-6'; }, /R-CW-5A is attached to R-CW-6, but the catalog attaches it to R-CW-5/],
    ['duplicate', (m) => { m.preflight_attachments.push(attachment('R-CW-5A')); }, /R-CW-5A is listed twice/],
    ['unknown state', (m) => { attachmentOf(m, 'R-CW-5A').state = 'passed'; }, /R-CW-5A state "passed" is not one of pass, fail, missing/],
    ['dir absent', (m) => { attachmentOf(m, 'R-CW-5A').dir = `PROOFS/${SHA}/R-CW-5A-NOT-WRITTEN/`; }, new RegExp(`R-CW-5A dir PROOFS/.*R-CW-5A-NOT-WRITTEN/ is not PROOFS/${SHA}/R-CW-5A/`)],
    ['missing state with a passing receipt', (m) => { attachmentOf(m, 'R-CW-5A').state = 'missing'; }, /R-CW-5A declares missing but its receipt is passed/],
  ]) {
    const manifest = fDouble();
    mutate(manifest);
    const { status, report } = await validate(manifest);
    assert.equal(status, 1, label);
    assert.ok(failedChecks(report).includes('preflight-attachments-valid'), `${label}: ${failedChecks(report)}`);
    assert.match(check(report, 'preflight-attachments-valid').detail, detail, label);
  }

  // preflight_attachments needs the required-row tally it retires rows from.
  const legacy = fDouble();
  delete legacy.required_rows;
  delete legacy.dispatch_allocation;
  const { report } = await validate(legacy);
  assert.match(check(report, 'preflight-attachments-valid').detail, /preflight_attachments requires required_rows/);
});

test('an undeclared attachment directory in an F″ corpus is still an orphan', async () => {
  // Only declared attachment dirs are exempt from no-orphan-row-dirs.
  const manifest = fDouble({ attachments: ['R-CW-5A'] });
  await withRoot(async (root) => {
    await writeCorpus(root, SHA, manifest, passingReceipts());
    await mkdir(join(root, 'PROOFS', SHA, 'R-CW-6A'), { recursive: true });
    const { status, payload } = run(root, ['--sha', SHA]);
    const [report] = payload.reports;
    assert.equal(status, 1);
    assert.deepEqual(failedChecks(report), ['no-orphan-row-dirs']);
    assert.match(check(report, 'no-orphan-row-dirs').detail, new RegExp(`orphans: PROOFS/${SHA}/R-CW-6A/$`));
  });
});

test('a corpus with neither gated live rows nor preflights gets no preflight check', async () => {
  const manifest = fDouble({ attachments: null });
  const gone = new Set(['R-CW-5', 'R-CW-6']);
  manifest.required_rows = manifest.required_rows.filter((id) => !gone.has(id));
  manifest.rows = manifest.rows.filter((row) => !gone.has(row.row));
  for (const [bucket, ids] of Object.entries(manifest.dispatch_allocation)) {
    manifest.dispatch_allocation[bucket] = ids.filter((id) => !gone.has(id));
  }
  manifest.rollup = { ...FDOUBLE_ROLLUP, total_rows: 34, partial: 3 };
  const { status, report } = await validate(manifest, {});
  assert.equal(status, 0, JSON.stringify(report.checks.filter((c) => !c.ok)));
  assert.deepEqual(report.checks.map((c) => c.name), [...LEGACY_CHECKS, ...ROW_SET_CHECKS]);
});

test('(d) F′ validates 18/18 unchanged: R-CW-5A/6A stay required MISSING rows under the method F′ was folded under', async () => {
  const { status, payload } = run(repoRoot, ['--sha', FPRIME_SHA]);
  const [report] = payload.reports;
  assert.equal(status, 0, JSON.stringify(report.checks.filter((c) => !c.ok)));
  assert.equal(report.passed, 18);
  assert.equal(report.failed, 0);
  assert.deepEqual(report.checks.map((c) => c.name), [...LEGACY_CHECKS, ...ROW_SET_CHECKS]);
  assert.equal(report.preflightAttachments, undefined);
  assert.match(check(report, 'row-sets-defined').detail, /^38 required \(required_rows\), 0 supplemental/);
  // F′ as corrected on docs main 7e544c04 (🌊's ruling on this PR): R-CW-5/6
  // pass → partial, so the rollup is 27/5/0/6 rather than the fold's 29/3/0/6.
  assert.match(check(report, 'manifest-rollup-matches-required').detail, /total_rows=38, pass=27, partial=5, thin=0, fail=0, honest_limit=0, missing=6/);
  const corrected = JSON.parse(await readFile(join(repoRoot, 'PROOFS', FPRIME_SHA, 'proofs-manifest.json'), 'utf8'));
  for (const id of ['R-CW-5', 'R-CW-6']) {
    assert.equal(rowOf(corrected, id).state, 'partial', id);
    assert.deepEqual({ from: rowOf(corrected, id).correction.from, to: rowOf(corrected, id).correction.to }, { from: 'pass', to: 'partial' }, id);
  }
  for (const id of ['R-CW-5A', 'R-CW-6A']) assert.equal(rowOf(corrected, id).state, 'missing', id);
});

test('(d) the F′ fossil validates 18/18 in isolation too', async () => {
  // The fossil is F′ as folded (R-CW-5/6 pass, before the correction): F′ is a
  // pre-ruling corpus, so neither the preflight gate nor the cap check runs on it.
  const { status, report } = await validate(structuredClone(fossil.manifest), {});
  assert.equal(status, 0, JSON.stringify(report.checks.filter((c) => !c.ok)));
  assert.equal(report.passed, 18);
  assert.deepEqual(report.checks.map((c) => c.name), [...LEGACY_CHECKS, ...ROW_SET_CHECKS]);
  assert.deepEqual(report.requiredRollup, fossil.manifest.rollup);
});

// 🌊's ruling on docs#616 (Discord 1565925290008387728; review 5720773113): the
// row verdict is the minimum of the fixture's verdict, the cap the row manifest
// declares (verdictCap.rowCap) and the preflight cap. A passing preflight is
// necessary, not sufficient, and R-CW-5/6 stay partial while their only producer
// is a process-local fixture.
test('cap (d): a passing preflight never lifts R-CW-5/6 above partial; a pass without a superseding authority fails', async () => {
  for (const live of ['R-CW-5', 'R-CW-6']) {
    const preflight = `${live}A`;
    const { status, report } = await validate(overCredit(fDouble(), [live]));
    assert.equal(status, 1, live);
    // The preflight gate is satisfied, so the cap is the only failure.
    assert.deepEqual(failedChecks(report), ['rows-within-declared-cap'], live);
    assert.match(check(report, 'live-rows-gated-by-preflights').detail, new RegExp(`${live} pass; ${preflight} passed at ${SHORT}`), live);
    assert.match(
      check(report, 'rows-within-declared-cap').detail,
      new RegExp(`^${OVER_CAP(live).source}, and it declares no superseding authority; ${ROW_CAP_NOTE}$`),
      live,
    );
  }

  const both = await validate(overCredit(fDouble(), ['R-CW-5', 'R-CW-6']));
  assert.equal(both.status, 1);
  assert.deepEqual(failedChecks(both.report), ['rows-within-declared-cap']);
  assert.match(check(both.report, 'rows-within-declared-cap').detail, new RegExp(`^${OVER_CAP('R-CW-5').source}.*; ${OVER_CAP('R-CW-6').source}`));
});

test('cap (d): a superseding authority the method has not adopted does not lift the cap', async () => {
  const supersedingReceipt = `PROOFS/${SHA}/R-CW-5/live-gateway/superseding-authority-receipt.json`;
  const manifest = overCredit(fDouble(), ['R-CW-5']);
  rowOf(manifest, 'R-CW-5').superseding_authority = { authority: 'live-gateway-fire', receipt: supersedingReceipt };
  await assertRejected(manifest, { ...passingReceipts(), [supersedingReceipt]: { schema: 'x', candidateSha: SHA, verdict: 'PASS-candidate' } }, {
    'rows-within-declared-cap': new RegExp(
      `^${OVER_CAP('R-CW-5').source}, and its superseding_authority \\{"authority":"live-gateway-fire",.*\\} is not adopted: ` +
        `r-cw-5\\.json adopts no superseding authority; ${ROW_CAP_NOTE}$`,
    ),
  });
});

test('cap (d): a capped row spelled or stated another way is still capped', async () => {
  for (const spelling of ['r-cw-5', 'R‐CW‐5', 'R-CW-5 ']) {
    const manifest = overCredit(fDouble(), ['R-CW-5']);
    renameRow(manifest, 'R-CW-5', spelling);
    const { status, report } = await validate(manifest);
    assert.equal(status, 1, JSON.stringify(spelling));
    assert.ok(failedChecks(report).includes('rows-within-declared-cap'), `${JSON.stringify(spelling)}: ${failedChecks(report)}`);
    assert.match(check(report, 'rows-within-declared-cap').detail, OVER_CAP('R-CW-5'), JSON.stringify(spelling));
  }

  // An upper-case state fails state-values-known, and it is still not under the cap.
  const shouted = fDouble();
  rowOf(shouted, 'R-CW-5').state = 'PASS';
  const { status, report } = await validate(shouted);
  assert.equal(status, 1);
  assert.ok(failedChecks(report).includes('state-values-known'), JSON.stringify(failedChecks(report)));
  assert.ok(failedChecks(report).includes('rows-within-declared-cap'), JSON.stringify(failedChecks(report)));
  assert.match(check(report, 'rows-within-declared-cap').detail, /^R-CW-5 is pass \(recorded as "PASS"\), above the PARTIAL-candidate cap/);

  // A state that is not a known state at or below the cap is refused, not read as under it.
  for (const state of ['passed', 'PASS-candidate']) {
    const odd = fDouble();
    rowOf(odd, 'R-CW-6').state = state;
    const result = await validate(odd);
    assert.equal(result.status, 1, state);
    assert.ok(failedChecks(result.report).includes('rows-within-declared-cap'), `${state}: ${failedChecks(result.report)}`);
    assert.match(
      check(result.report, 'rows-within-declared-cap').detail,
      new RegExp(`^R-CW-6 is ${state.toLowerCase()}(?: \\(recorded as "${state}"\\))?, not a state known to lie within the PARTIAL-candidate cap r-cw-6\\.json declares`),
      state,
    );
  }
});

test('cap (d): a catalog that loses a process-local row\'s verdictCap cannot un-cap it', async () => {
  // The validator judges every corpus by the catalog next to it, so run a copy
  // of the harness whose R-CW-5 manifest has lost its verdictCap.
  await withRoot(async (root) => {
    const harness = join(root, 'harness');
    await cp(join(repoRoot, 'tools/k6-proofs/scripts'), join(harness, 'scripts'), {
      recursive: true,
      filter: (source) => !source.includes('__tests__'),
    });
    await cp(join(repoRoot, 'tools/k6-proofs/lib'), join(harness, 'lib'), { recursive: true });
    await cp(join(repoRoot, 'tools/k6-proofs/manifests'), join(harness, 'manifests'), { recursive: true });
    const r5 = join(harness, 'manifests/r-cw-5.json');
    const uncapped = JSON.parse(await readFile(r5, 'utf8'));
    delete uncapped.verdictCap;
    await writeFile(r5, `${JSON.stringify(uncapped, null, 2)}\n`);

    const runCopy = (sha) => {
      const result = spawnSync(process.execPath, [join(harness, 'scripts/validate-corpus.mjs'), '--root', root, '--sha', sha, '--json'], { encoding: 'utf8' });
      assert.equal(result.stderr, '', result.stderr);
      return { status: result.status, report: JSON.parse(result.stdout).reports[0] };
    };
    const inconsistent = /^the verdict-cap catalog is inconsistent: r-cw-5\.json: R-CW-5 is process-local, so it must declare verdictCap/;

    await writeCorpus(root, SHA, overCredit(fDouble(), ['R-CW-5']), passingReceipts());
    const over = runCopy(SHA);
    assert.equal(over.status, 1);
    assert.deepEqual(failedChecks(over.report), ['rows-within-declared-cap']);
    assert.match(check(over.report, 'rows-within-declared-cap').detail, inconsistent);

    // Even a corpus with no capped row is held to the broken catalog: the cap
    // check cannot know which rows the catalog would have capped.
    const noCappedRows = fDouble({ attachments: null });
    const gone = new Set(['R-CW-5', 'R-CW-6']);
    noCappedRows.required_rows = noCappedRows.required_rows.filter((id) => !gone.has(id));
    noCappedRows.rows = noCappedRows.rows.filter((row) => !gone.has(row.row));
    for (const [bucket, ids] of Object.entries(noCappedRows.dispatch_allocation)) {
      noCappedRows.dispatch_allocation[bucket] = ids.filter((id) => !gone.has(id));
    }
    noCappedRows.capture_sha = OTHER_SHA;
    for (const row of noCappedRows.rows) {
      row.dir = row.dir.replace(SHA, OTHER_SHA);
      row.evidence_doc = row.evidence_doc.replace(SHA, OTHER_SHA);
    }
    noCappedRows.rollup = { ...FDOUBLE_ROLLUP, total_rows: 34, partial: 3 };
    await writeCorpus(root, OTHER_SHA, noCappedRows);
    const bare = runCopy(OTHER_SHA);
    assert.equal(bare.status, 1);
    assert.deepEqual(failedChecks(bare.report), ['rows-within-declared-cap']);
    assert.match(check(bare.report, 'rows-within-declared-cap').detail, inconsistent);
  });
});

test('cap: the 71 pre-ruling corpora keep their method; 52 of them record R-CW-5/6 pass and none gets the cap check', async () => {
  const list = JSON.parse(await readFile(legacyList, 'utf8'));
  const overCredited = [];
  for (const sha of list.corpora) {
    const manifest = JSON.parse(await readFile(join(repoRoot, 'PROOFS', sha, 'proofs-manifest.json'), 'utf8'));
    // Three early corpora key their rows by id instead of listing them.
    const rows = Array.isArray(manifest.rows)
      ? manifest.rows
      : Object.entries(manifest.rows || {}).map(([row, value]) => ({ ...value, row }));
    if (rows.some((row) => (row?.row === 'R-CW-5' || row?.row === 'R-CW-6') && row.state === 'pass')) overCredited.push(sha);
  }
  // The cap rule therefore applies only to corpora seeded after the ruling, by
  // the same frozen list as the F″ preflight checks.
  assert.equal(overCredited.length, 52);
  assert.ok(!overCredited.includes(FPRIME_SHA), 'F′ is corrected to partial on docs main 7e544c04');

  const result = spawnSync(process.execPath, [validator, '--root', repoRoot, '--all', '--json'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  const reports = JSON.parse(result.stdout).reports.filter((report) => list.corpora.includes(report.sha));
  assert.equal(reports.length, 71);
  for (const report of reports) {
    const names = report.checks.map((c) => c.name);
    assert.ok(!names.includes('rows-within-declared-cap'), report.sha);
    assert.ok(!names.some((name) => PREFLIGHT_CHECKS.includes(name)), report.sha);
  }
});

test('the pre-ruling corpora are frozen by name: exactly the manifest-bearing corpora at docs f17d784d', async () => {
  const list = JSON.parse(await readFile(legacyList, 'utf8'));
  assert.equal(list.schema, 'openclaw.k6.pre-ruling-corpora.v1');
  assert.equal(list.frozenAt, BASE_REF);
  assert.match(list.ruling, /1565895695586558120/);
  // Two narrow queries: a recursive listing of PROOFS overflows spawnSync's buffer.
  const git = (...args) => {
    const result = spawnSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.split('\n').filter(Boolean);
  };
  const dirs = git('ls-tree', '-d', '--name-only', `${BASE_REF}:PROOFS`);
  const atBase = git('ls-tree', '--name-only', BASE_REF, '--', ...dirs.map((dir) => `PROOFS/${dir}/proofs-manifest.json`))
    .map((path) => path.split('/')[1])
    .sort();
  assert.equal(atBase.length, 71);
  assert.deepEqual(list.corpora, atBase);
  assert.ok(list.corpora.includes(FPRIME_SHA));
  assert.ok(list.corpora.includes(PRE_RULING_SHA));
});

test('a pre-ruling corpus keeps its method; the same shape at any other SHA is held to the ruling', async () => {
  // 4c235d8c (folded 2026-07-19) declares required_rows, records R-CW-5/6 pass and
  // never carried R-CW-5A/6A rows.
  const legacy = JSON.parse(await readFile(join(repoRoot, 'PROOFS', PRE_RULING_SHA, 'proofs-manifest.json'), 'utf8'));
  assert.equal(rowOf(legacy, 'R-CW-5').state, 'pass');
  assert.equal(legacy.rows.some((row) => row.row in PREFLIGHTS), false);
  const { payload } = run(repoRoot, ['--sha', PRE_RULING_SHA]);
  assert.deepEqual(payload.reports[0].checks.map((c) => c.name), [...LEGACY_CHECKS, ...ROW_SET_CHECKS]);

  const moved = structuredClone(legacy);
  moved.capture_sha = OTHER_SHA;
  for (const row of moved.rows) {
    row.dir = row.dir.replace(PRE_RULING_SHA, OTHER_SHA);
    row.evidence_doc = row.evidence_doc.replace(PRE_RULING_SHA, OTHER_SHA);
  }
  const { report } = await validate(moved, {});
  assert.ok(failedChecks(report).includes('live-rows-gated-by-preflights'), JSON.stringify(failedChecks(report)));
  assert.ok(failedChecks(report).includes('rows-within-declared-cap'), JSON.stringify(failedChecks(report)));
});

test('the docs#613 supplemental shape at F′ stays a pre-ruling corpus', async () => {
  const proposal = JSON.parse(
    await readFile(new URL('./fixtures/docs-613-fprime-supplemental-manifests.json', import.meta.url), 'utf8'),
  ).manifests.head;
  assert.equal(proposal.capture_sha, FPRIME_SHA);
  const { status, report } = await validate(proposal, {});
  assert.equal(status, 0, JSON.stringify(report.checks.filter((c) => !c.ok)));
  assert.deepEqual(report.checks.map((c) => c.name), [...LEGACY_CHECKS, ...ROW_SET_CHECKS]);
});
