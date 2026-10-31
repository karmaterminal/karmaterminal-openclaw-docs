import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

// 🌊's F″ method ruling (Discord 1565895695586558120, 2026-10-31; bound to
// openclaw-bootstrap#1727): R-CW-5A/6A leave the required proof tally and become
// required preflight attachments of R-CW-5/6. A live row is PASS only when its
// preflight receipt passes at the same candidate; F′ and older corpora keep the
// method they were folded under.
const repoRoot = new URL('../../../..', import.meta.url).pathname;
const validator = join(repoRoot, 'tools/k6-proofs/scripts/validate-corpus.mjs');
const fossil = JSON.parse(
  await readFile(new URL('./fixtures/docs-f17d784d-fprime-manifest.json', import.meta.url), 'utf8'),
);
const SHA = fossil.manifest.capture_sha;
const OTHER_SHA = 'a'.repeat(40);
const FPRIME_SHA = 'f15237ec921879d918482cdf372b0718d4c1aab9';
const PRE_RULING_SHA = '4c235d8c1997e8964160117f8d6bf650ad1e8203';
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
    checks: { sourceGuard: passed, exactCandidateBinding: true, nonLiveBoundary: true },
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

/** The F″ seed: F′ with R-CW-5A/6A retired from rows, required_rows and firing buckets. */
function fDouble({ attachments = ['R-CW-5A', 'R-CW-6A'] } = {}) {
  const manifest = structuredClone(fossil.manifest);
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

async function validate(manifest, receipts = passingReceipts(), sha = SHA) {
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
  assert.match(
    check(report, 'live-rows-gated-by-preflights').detail,
    /^R-CW-5 pass with R-CW-5A passed at f15237ec92; R-CW-6 pass with R-CW-6A passed at f15237ec92$/,
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
    // Declared missing: the attachment record is consistent, the live pass is not.
    const withoutReceipt = passingReceipts();
    delete withoutReceipt[receiptPath(preflight)];
    const declaredMissing = fDouble();
    const index = declaredMissing.preflight_attachments.findIndex((entry) => entry.attachment === preflight);
    declaredMissing.preflight_attachments[index] = attachment(preflight, 'missing');
    await assertRejected(declaredMissing, withoutReceipt, {
      'live-rows-gated-by-preflights': new RegExp(`^${live} is pass but its required preflight ${preflight} is missing at f15237ec92; a live row without a passing same-candidate preflight is capped at partial$`),
    }).catch((error) => { error.message = `${live} declared missing: ${error.message}`; throw error; });

    // No attachment entry at all.
    // Nothing is on disk for it either, so no-orphan-row-dirs stays green.
    const absent = fDouble({ attachments: Object.keys(PREFLIGHTS).filter((id) => id !== preflight) });
    await assertRejected(absent, withoutReceipt, {
      'live-rows-gated-by-preflights': new RegExp(`^${live} is pass but its required preflight ${preflight} is missing`),
    }).catch((error) => { error.message = `${live} no entry: ${error.message}`; throw error; });

    // Declared pass with the receipt file absent.
    const receipts = passingReceipts();
    delete receipts[receiptPath(preflight)];
    await assertRejected(fDouble(), receipts, {
      'preflight-attachments-valid': new RegExp(`${preflight} declares pass but its receipt is missing: .*not found`),
      'live-rows-gated-by-preflights': new RegExp(`^${live} is pass but its required preflight ${preflight} is missing`),
    }).catch((error) => { error.message = `${live} receipt file absent: ${error.message}`; throw error; });
  }
});

test('(a) a retired-shape corpus that records a CW-5/6 pass without declaring preflight_attachments fails', async () => {
  const manifest = fDouble({ attachments: null });
  const { status, report } = await validate(manifest, {});
  assert.equal(status, 1);
  assert.deepEqual(failedChecks(report), ['live-rows-gated-by-preflights']);
  assert.deepEqual(report.checks.map((c) => c.name), [...LEGACY_CHECKS, ...ROW_SET_CHECKS, 'live-rows-gated-by-preflights']);
  assert.equal(
    check(report, 'live-rows-gated-by-preflights').detail,
    'R-CW-5A and R-CW-6A are not rows of this corpus and no preflight_attachments are declared; ' +
      'R-CW-5 is pass but its required preflight R-CW-5A is missing at f15237ec92; ' +
      'R-CW-6 is pass but its required preflight R-CW-6A is missing at f15237ec92; ' +
      'a live row without a passing same-candidate preflight is capped at partial',
  );

  // The same shape with both live rows capped at partial validates: nothing passes ungated.
  const capped = fDouble({ attachments: null });
  rowOf(capped, 'R-CW-5').state = 'partial';
  rowOf(capped, 'R-CW-6').state = 'partial';
  capped.rollup = { ...FDOUBLE_ROLLUP, pass: 27, partial: 5 };
  const ok = await validate(capped, {});
  assert.equal(ok.status, 0, JSON.stringify(ok.report.checks.filter((c) => !c.ok)));
  assert.deepEqual(ok.report.checks.map((c) => c.name), [...LEGACY_CHECKS, ...ROW_SET_CHECKS]);
});

test('(b) a failed preflight caps the live row: pass fails validation, partial validates', async () => {
  for (const [live, preflight] of [['R-CW-5', 'R-CW-5A'], ['R-CW-6', 'R-CW-6A']]) {
    const receipts = { ...passingReceipts(), [receiptPath(preflight)]: receipt(preflight, { preflightStatus: 'failed' }) };

    const stillPass = fDouble();
    attachmentOf(stillPass, preflight).state = 'fail';
    await assertRejected(stillPass, receipts, {
      'live-rows-gated-by-preflights': new RegExp(`^${live} is pass but its required preflight ${preflight} is failed at f15237ec92`),
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

  // A receipt that passes overall but carries a false check, or the wrong verdict, is not a pass.
  for (const [label, overrides, detail] of [
    ['false check', { checks: { sourceGuard: false, exactCandidateBinding: true } }, /failed checks: sourceGuard/],
    ['wrong verdict', { verdict: 'PASS-candidate' }, /verdict=PASS-candidate/],
    ['no checks', { checks: {} }, /receipt is invalid: checks is not a non-empty object of booleans/],
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
      'live-rows-gated-by-preflights': /^R-CW-6 is pass but its required preflight R-CW-6A is wrong-candidate at f15237ec92/,
    }).catch((error) => { error.message = `${label}: ${error.message}`; throw error; });
  }

  // The attachment's own candidate_sha must be this corpus too.
  const manifest = fDouble();
  attachmentOf(manifest, 'R-CW-5A').candidate_sha = OTHER_SHA;
  await assertRejected(manifest, passingReceipts(), {
    'preflight-attachments-valid': /R-CW-5A candidate_sha aaaaaaaaaa.* is not this corpus \(f15237ec92/,
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
    'R-CW-5 pass with R-CW-5A passed at f15237ec92; R-CW-6 partial (capped): R-CW-6A failed',
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
      'preflight-attachments-valid': /R-CW-5A receipt .* is not a file under PROOFS\/f15237ec92.*\/R-CW-5A\//,
      'live-rows-gated-by-preflights': /^R-CW-5 is pass but its required preflight R-CW-5A is invalid/,
    }).catch((error) => { error.message = `${label}: ${error.message}`; throw error; });
  }
});

test('a retired preflight cannot also be a proof row of an F″ corpus', async () => {
  // The docs#613 supplemental route kept them as rows; 🌊's ruling retires them.
  const manifest = fDouble();
  manifest.required_rows.push('R-CW-5A');
  manifest.rows.push({ row: 'R-CW-5A', state: 'missing', owner: 'frond-scribe-static', dir: `PROOFS/${SHA}/R-CW-5A/`, evidence_doc: `PROOFS/${SHA}/R-CW-5A/EVIDENCE.md` });
  manifest.dispatch_allocation['frond-scribe-static'].push('R-CW-5A');
  manifest.rollup = { ...FDOUBLE_ROLLUP, total_rows: 37, missing: 5 };
  await assertRejected(manifest, passingReceipts(), {
    'preflight-attachments-valid': /R-CW-5A is a retired preflight attachment and cannot also be in rows\[\] or required_rows/,
  });
});

test('malformed preflight_attachments records fail preflight-attachments-valid', async () => {
  for (const [label, mutate, detail] of [
    ['not an array', (m) => { m.preflight_attachments = {}; }, /^preflight_attachments is not an array/],
    ['unknown attachment', (m) => { m.preflight_attachments.push({ ...attachment('R-CW-5A'), attachment: 'R-CW-9A' }); }, /R-CW-9A is not a required preflight of any catalog row/],
    ['wrong live row', (m) => { attachmentOf(m, 'R-CW-5A').attached_to = 'R-CW-6'; }, /R-CW-5A is attached to R-CW-6, but the catalog attaches it to R-CW-5/],
    ['duplicate', (m) => { m.preflight_attachments.push(attachment('R-CW-5A')); }, /R-CW-5A is listed twice/],
    ['unknown state', (m) => { attachmentOf(m, 'R-CW-5A').state = 'passed'; }, /R-CW-5A state "passed" is not one of pass, fail, missing/],
    ['dir absent', (m) => { attachmentOf(m, 'R-CW-5A').dir = `PROOFS/${SHA}/R-CW-5A-NOT-WRITTEN/`; }, /R-CW-5A dir PROOFS\/.*R-CW-5A-NOT-WRITTEN\/ is not PROOFS\/f15237ec92.*\/R-CW-5A\//],
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

test('the one pre-ruling corpus with the retired shape keeps its method; the same shape anywhere else is gated', async () => {
  // 4c235d8c (folded 2026-07-19) declares required_rows, records R-CW-5/6 pass and
  // never carried R-CW-5A/6A rows. It predates the ruling, so it is not re-judged.
  const legacy = JSON.parse(await readFile(join(repoRoot, 'PROOFS', PRE_RULING_SHA, 'proofs-manifest.json'), 'utf8'));
  assert.ok(Array.isArray(legacy.required_rows));
  assert.equal(rowOf(legacy, 'R-CW-5').state, 'pass');
  assert.equal(rowOf(legacy, 'R-CW-6').state, 'pass');
  assert.equal(legacy.rows.some((row) => row.row in PREFLIGHTS), false);
  const { payload } = run(repoRoot, ['--sha', PRE_RULING_SHA]);
  const names = payload.reports[0].checks.map((c) => c.name);
  assert.deepEqual(names, [...LEGACY_CHECKS, ...ROW_SET_CHECKS]);

  // Moved to any other SHA, the identical shape is an F″ corpus recording ungated passes.
  const moved = structuredClone(legacy);
  moved.capture_sha = OTHER_SHA;
  for (const row of moved.rows) {
    row.dir = row.dir.replace(PRE_RULING_SHA, OTHER_SHA);
    row.evidence_doc = row.evidence_doc.replace(PRE_RULING_SHA, OTHER_SHA);
  }
  const { report } = await validate(moved, {}, OTHER_SHA);
  assert.ok(failedChecks(report).includes('live-rows-gated-by-preflights'), JSON.stringify(failedChecks(report)));
});
