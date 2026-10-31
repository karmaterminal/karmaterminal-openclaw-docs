import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

// 🌊's F″ method ruling (Discord 1565895695586558120, 2026-10-31; bound to
// openclaw-bootstrap#1727): R-CW-5A/6A leave the required proof tally and become
// required preflight attachments of R-CW-5/6. A live row is PASS only when its
// preflight receipt passes at the same candidate. The corpora folded before the
// ruling (every manifest-bearing PROOFS dir at docs f17d784d, F′ included) keep
// the method they were folded under; every other corpus is held to the ruling.
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
const CAP_NOTE = 'a live row without a passing same-candidate preflight is capped at partial';
// F′ is 38 required rows with R-CW-5A/6A missing; retiring them leaves 36.
const FDOUBLE_ROLLUP = { total_rows: 36, pass: 29, partial: 3, thin: 0, fail: 0, honest_limit: 0, missing: 4 };

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

/** The F″ seed: F′ with R-CW-5A/6A retired from rows, required_rows and firing buckets. */
function fDouble({ attachments = ['R-CW-5A', 'R-CW-6A'] } = {}) {
  const manifest = fprimeAt(SHA);
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
  assert.deepEqual(report.checks.map((c) => c.name), [...LEGACY_CHECKS, ...ROW_SET_CHECKS, ...PREFLIGHT_CHECKS]);
  assert.match(check(report, 'row-sets-defined').detail, /^36 required \(required_rows\), 0 supplemental/);
  assert.match(check(report, 'firing-buckets-cover-required').detail, /cover the 36 required rows exactly once/);
  assert.deepEqual(report.requiredRollup, FDOUBLE_ROLLUP);
  assert.deepEqual(report.talliedRollup, FDOUBLE_ROLLUP);
  // The attachment directories are declared by preflight_attachments, not orphans.
  assert.match(check(report, 'no-orphan-row-dirs').detail, /^36 on-disk row dirs all referenced/);
  assert.match(check(report, 'preflight-attachments-valid').detail, /^2 preflight attachments: R-CW-5A→R-CW-5 pass, R-CW-6A→R-CW-6 pass/);
  assert.equal(
    check(report, 'live-rows-gated-by-preflights').detail,
    `R-CW-5 pass with R-CW-5A passed at ${SHORT}; R-CW-6 pass with R-CW-6A passed at ${SHORT}`,
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
      'total_rows: index=38 required-tally=36; missing: index=6 required-tally=4',
    );
  });
});

test('(a) an F″ R-CW-5 or R-CW-6 pass with no preflight receipt fails the live-row gate', async () => {
  for (const [live, preflight] of [['R-CW-5', 'R-CW-5A'], ['R-CW-6', 'R-CW-6A']]) {
    const withoutReceipt = passingReceipts();
    delete withoutReceipt[receiptPath(preflight)];
    const declaredMissing = fDouble();
    const index = declaredMissing.preflight_attachments.findIndex((entry) => entry.attachment === preflight);
    declaredMissing.preflight_attachments[index] = attachment(preflight, 'missing');
    await assertRejected(declaredMissing, withoutReceipt, {
      'live-rows-gated-by-preflights': new RegExp(`^${live} is pass but its required preflight ${preflight} is missing at ${SHORT}; ${CAP_NOTE}$`),
    }).catch((error) => { error.message = `${live} declared missing: ${error.message}`; throw error; });

    // No attachment entry at all; nothing is on disk for it either.
    const absent = fDouble({ attachments: Object.keys(PREFLIGHTS).filter((id) => id !== preflight) });
    await assertRejected(absent, withoutReceipt, {
      'live-rows-gated-by-preflights': new RegExp(`^${live} is pass but its required preflight ${preflight} is missing`),
    }).catch((error) => { error.message = `${live} no entry: ${error.message}`; throw error; });

    // Declared pass with the receipt file absent.
    await assertRejected(fDouble(), withoutReceipt, {
      'preflight-attachments-valid': new RegExp(`${preflight} declares pass but its receipt is missing: .*not found`),
      'live-rows-gated-by-preflights': new RegExp(`^${live} is pass but its required preflight ${preflight} is missing`),
    }).catch((error) => { error.message = `${live} receipt file absent: ${error.message}`; throw error; });
  }
});

test('(a) a corpus that records a CW-5/6 pass without declaring preflight_attachments fails, whatever its shape', async () => {
  // The F″ shape with the attachment field forgotten.
  const forgotten = fDouble({ attachments: null });
  const { status, report } = await validate(forgotten, {});
  assert.equal(status, 1);
  assert.deepEqual(failedChecks(report), ['live-rows-gated-by-preflights']);
  assert.deepEqual(report.checks.map((c) => c.name), [...LEGACY_CHECKS, ...ROW_SET_CHECKS, ...PREFLIGHT_CHECKS]);
  assert.equal(check(report, 'preflight-attachments-valid').detail, 'no preflight attachments declared');
  assert.equal(
    check(report, 'live-rows-gated-by-preflights').detail,
    `no preflight_attachments are declared; R-CW-5 is pass but its required preflight R-CW-5A is missing at ${SHORT}; ` +
      `R-CW-6 is pass but its required preflight R-CW-6A is missing at ${SHORT}; ${CAP_NOTE}`,
  );

  // Without required_rows (the all-rows legacy shape), the same passes are still gated.
  const noRequiredRows = fDouble({ attachments: null });
  delete noRequiredRows.required_rows;
  delete noRequiredRows.dispatch_allocation;
  const legacyShape = await validate(noRequiredRows, {});
  assert.equal(legacyShape.status, 1);
  assert.deepEqual(failedChecks(legacyShape.report), ['live-rows-gated-by-preflights']);
  assert.deepEqual(legacyShape.report.checks.map((c) => c.name), [...LEGACY_CHECKS, ...PREFLIGHT_CHECKS]);

  // The same shapes with both live rows capped at partial validate: nothing passes ungated.
  for (const shape of [fDouble({ attachments: null }), noRequiredRows]) {
    const capped = structuredClone(shape);
    rowOf(capped, 'R-CW-5').state = 'partial';
    rowOf(capped, 'R-CW-6').state = 'partial';
    capped.rollup = { ...FDOUBLE_ROLLUP, pass: 27, partial: 5 };
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
  assert.deepEqual(failedChecks(report).sort(), PREFLIGHT_CHECKS.slice().sort());
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

test('a gated row id spelled another way is refused, not ungated', async () => {
  for (const spelling of ['r-cw-5', 'R-CW-5 ', ' R-CW-5', 'R‐CW‐5', 'R-CW-5​']) {
    // Declared attachments: R-CW-5's own attachment is present and passing, but the
    // live row it gates is spelled differently.
    const declared = fDouble();
    renameRow(declared, 'R-CW-5', spelling);
    const { status, report } = await validate(declared);
    assert.equal(status, 1, JSON.stringify(spelling));
    assert.ok(failedChecks(report).includes('live-rows-gated-by-preflights'), `${JSON.stringify(spelling)}: ${failedChecks(report)}`);
    assert.match(
      check(report, 'live-rows-gated-by-preflights').detail,
      new RegExp(`row id ${JSON.stringify(spelling).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} is a non-canonical spelling of R-CW-5`),
      JSON.stringify(spelling),
    );

    // No attachments declared: the misspelled pass is still gated.
    const undeclared = fDouble({ attachments: null });
    renameRow(undeclared, 'R-CW-5', spelling);
    const bare = await validate(undeclared, {});
    assert.equal(bare.status, 1, JSON.stringify(spelling));
    assert.match(check(bare.report, 'live-rows-gated-by-preflights').detail, /R-CW-5 is pass but its required preflight R-CW-5A is missing/);
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

    const stillPass = fDouble();
    attachmentOf(stillPass, preflight).state = 'fail';
    await assertRejected(stillPass, receipts, {
      'live-rows-gated-by-preflights': new RegExp(`^${live} is pass but its required preflight ${preflight} is failed at ${SHORT}`),
    }).catch((error) => { error.message = `${live}: ${error.message}`; throw error; });

    const capped = fDouble();
    attachmentOf(capped, preflight).state = 'fail';
    rowOf(capped, live).state = 'partial';
    capped.rollup = { ...FDOUBLE_ROLLUP, pass: 28, partial: 4 };
    const { status, report } = await validate(capped, receipts);
    assert.equal(status, 0, `${live}: ${JSON.stringify(report.checks.filter((c) => !c.ok))}`);
    assert.match(check(report, 'live-rows-gated-by-preflights').detail, new RegExp(`${live} partial \\(capped\\): ${preflight} failed`));
  }
});

test('(b) a failed receipt declared pass is a false attachment record', async () => {
  const receipts = { ...passingReceipts(), [receiptPath('R-CW-5A')]: receipt('R-CW-5A', { preflightStatus: 'failed' }) };
  await assertRejected(fDouble(), receipts, {
    'preflight-attachments-valid': /R-CW-5A declares pass but its receipt is failed: preflightStatus=failed, verdict=FAIL-candidate, failed checks: sourceGuard/,
    'live-rows-gated-by-preflights': /^R-CW-5 is pass but its required preflight R-CW-5A is failed/,
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
    await assertRejected(fDouble(), mutated, {
      'preflight-attachments-valid': detail,
      'live-rows-gated-by-preflights': /^R-CW-5 is pass but its required preflight R-CW-5A is (failed|invalid)/,
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
    await assertRejected(fDouble(), receipts, {
      'preflight-attachments-valid': /R-CW-6A declares pass but its receipt is wrong-candidate: /,
      'live-rows-gated-by-preflights': new RegExp(`^R-CW-6 is pass but its required preflight R-CW-6A is wrong-candidate at ${SHORT}`),
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
  rowOf(manifest, 'R-CW-6').state = 'partial';
  manifest.rollup = { ...FDOUBLE_ROLLUP, pass: 28, partial: 4 };
  const { status, report } = await validate(manifest, receipts);
  assert.equal(status, 0, JSON.stringify(report.checks.filter((c) => !c.ok)));
  assert.equal(
    check(report, 'live-rows-gated-by-preflights').detail,
    `R-CW-5 pass with R-CW-5A passed at ${SHORT}; R-CW-6 partial (capped): R-CW-6A failed`,
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
    await assertRejected(fDouble(), receipts, {
      'preflight-attachments-valid': detail,
      'live-rows-gated-by-preflights': /^R-CW-5 is pass but its required preflight R-CW-5A is invalid/,
    }).catch((error) => { error.message = `${label}: ${error.message}`; throw error; });
  }

  // A valid R-CW-5A receipt sits at each resolved path, so only the location is wrong.
  // The traversal resolves to the attachment's own receipt: `..` is refused as written.
  for (const [label, path] of [
    ['traversal', `PROOFS/${SHA}/R-CW-5A/../R-CW-5A/static-validator-20261031T000000Z/required-preflight-receipt.json`],
    ['another corpus', receiptPath('R-CW-5A', OTHER_SHA)],
    ['outside its dir', `PROOFS/${SHA}/R-CW-5/required-preflight-receipt.json`],
  ]) {
    const manifest = fDouble();
    attachmentOf(manifest, 'R-CW-5A').receipt = path;
    await assertRejected(manifest, { ...passingReceipts(), [path]: receipt('R-CW-5A') }, {
      'preflight-attachments-valid': new RegExp(`R-CW-5A receipt .* is not a file under PROOFS/${SHA}/R-CW-5A/`),
      'live-rows-gated-by-preflights': /^R-CW-5 is pass but its required preflight R-CW-5A is invalid/,
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
  rowOf(manifest, 'R-CW-6').state = 'partial';
  manifest.rollup = { ...FDOUBLE_ROLLUP, pass: 28, partial: 4 };
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
  manifest.rollup = { ...FDOUBLE_ROLLUP, total_rows: 34, pass: 27 };
  const { status, report } = await validate(manifest, {});
  assert.equal(status, 0, JSON.stringify(report.checks.filter((c) => !c.ok)));
  assert.deepEqual(report.checks.map((c) => c.name), [...LEGACY_CHECKS, ...ROW_SET_CHECKS]);
});

test('(d) F′ validates 18/18 unchanged: R-CW-5A/6A stay required MISSING rows under the method F′ was folded under', () => {
  const { status, payload } = run(repoRoot, ['--sha', FPRIME_SHA]);
  const [report] = payload.reports;
  assert.equal(status, 0, JSON.stringify(report.checks.filter((c) => !c.ok)));
  assert.equal(report.passed, 18);
  assert.equal(report.failed, 0);
  assert.deepEqual(report.checks.map((c) => c.name), [...LEGACY_CHECKS, ...ROW_SET_CHECKS]);
  assert.equal(report.preflightAttachments, undefined);
  assert.match(check(report, 'row-sets-defined').detail, /^38 required \(required_rows\), 0 supplemental/);
  assert.match(check(report, 'manifest-rollup-matches-required').detail, /total_rows=38, pass=29, partial=3, thin=0, fail=0, honest_limit=0, missing=6/);
});

test('(d) the F′ fossil validates 18/18 in isolation too', async () => {
  const { status, report } = await validate(structuredClone(fossil.manifest), {});
  assert.equal(status, 0, JSON.stringify(report.checks.filter((c) => !c.ok)));
  assert.equal(report.passed, 18);
  assert.deepEqual(report.checks.map((c) => c.name), [...LEGACY_CHECKS, ...ROW_SET_CHECKS]);
  assert.deepEqual(report.requiredRollup, fossil.manifest.rollup);
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
