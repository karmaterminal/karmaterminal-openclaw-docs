import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

// Supplemental-aware corpus validation (docs#613). The fossil projects the F′
// manifest at docs main 96b4335b (38 required rows) and at #613's head
// 729f9b36 (35 required + 3 supplemental); see its `extraction` field.
const repoRoot = new URL('../../../..', import.meta.url).pathname;
const validator = join(repoRoot, 'tools/k6-proofs/scripts/validate-corpus.mjs');
const fossil = JSON.parse(
  await readFile(new URL('./fixtures/docs-613-fprime-supplemental-manifests.json', import.meta.url), 'utf8'),
);
const SHA = fossil.manifests.head.capture_sha;
const SUPPLEMENTAL = ['R-CD-RETURN-COVENANT-AUTHORITY', 'R-CW-5A', 'R-CW-6A'];
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
const REQUIRED_ROLLUP = { total_rows: 35, pass: 31, partial: 3, thin: 0, fail: 0, honest_limit: 1, missing: 0 };
const ALL_ROWS_ROLLUP = { total_rows: 38, pass: 31, partial: 3, thin: 0, fail: 0, honest_limit: 1, missing: 3 };

function head() {
  return structuredClone(fossil.manifests.head);
}

function base() {
  return structuredClone(fossil.manifests.base);
}

function rowOf(manifest, id) {
  const row = manifest.rows.find((candidate) => candidate.row === id);
  assert.ok(row, `fixture has no ${id}`);
  return row;
}

function extraRow(id, state = 'pass') {
  return {
    row: id,
    state,
    owner: 'emeric',
    dir: `PROOFS/${SHA}/${id}/`,
    evidence_doc: `PROOFS/${SHA}/${id}/EVIDENCE.md`,
  };
}

async function writeCorpus(root, sha, manifest) {
  await mkdir(join(root, 'PROOFS', sha), { recursive: true });
  for (const row of manifest.rows) {
    if (row.dir) await mkdir(join(root, row.dir), { recursive: true });
    if (row.evidence_doc) {
      await mkdir(dirname(join(root, row.evidence_doc)), { recursive: true });
      await writeFile(join(root, row.evidence_doc), `# ${row.row}\n`);
    }
  }
  await writeFile(join(root, 'PROOFS', sha, 'proofs-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function writeIndex(root, sha, rollup) {
  await writeFile(
    join(root, 'PROOFS', 'INDEX.json'),
    `${JSON.stringify({
      schema: 'openclaw.proofs.index.v1',
      current_sha: sha,
      corpus_path: `PROOFS/${sha}/`,
      manifest_path: `PROOFS/${sha}/proofs-manifest.json`,
      rollup,
    }, null, 2)}\n`,
  );
}

async function withRoot(fn) {
  const root = await mkdtemp(join(tmpdir(), 'k6-validate-corpus-supplemental-'));
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

async function validateManifest(manifest) {
  return withRoot(async (root) => {
    await writeCorpus(root, SHA, manifest);
    const { status, payload } = run(root, ['--sha', SHA]);
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

/** Assert the manifest fails exactly the named checks, each detail matching. */
async function assertRejected(manifest, expected) {
  const { status, report } = await validateManifest(manifest);
  assert.equal(status, 1);
  assert.deepEqual(failedChecks(report).sort(), Object.keys(expected).sort());
  for (const [name, detail] of Object.entries(expected)) {
    assert.match(check(report, name).detail, detail, name);
  }
  return report;
}

test('#613 head shape passes --sha with 35 required and 3 supplemental rows', async () => {
  const { status, report } = await validateManifest(head());
  assert.equal(status, 0, JSON.stringify(failedChecks(report)));
  assert.equal(report.failed, 0);
  assert.deepEqual(report.checks.map((c) => c.name), [...LEGACY_CHECKS, ...ROW_SET_CHECKS]);
  assert.match(check(report, 'row-sets-defined').detail, /^35 required \(required_rows\), 3 supplemental/);
  assert.match(check(report, 'evidence-doc-exists').detail, /^38\/38 evidence_doc paths exist/);
  assert.match(check(report, 'row-dirs-exist').detail, /^38\/38 row dirs exist/);
  assert.match(check(report, 'firing-buckets-cover-required').detail, /^4 firing buckets cover the 35 required rows/);
  assert.deepEqual(report.requiredRollup, REQUIRED_ROLLUP);
  assert.deepEqual(report.supplementalRollup, {
    total_rows: 3, pass: 0, partial: 0, thin: 0, fail: 0, honest_limit: 0, missing: 3,
  });
  // The all-rows tally is still reported unchanged; nothing gates on it here.
  assert.deepEqual(report.talliedRollup, ALL_ROWS_ROLLUP);
});

test('#613 base shape (38 required, no supplemental bucket) passes with the required tally equal to all rows', async () => {
  const { status, report } = await validateManifest(base());
  assert.equal(status, 0, JSON.stringify(failedChecks(report)));
  assert.match(check(report, 'row-sets-defined').detail, /^38 required \(required_rows\), 0 supplemental/);
  assert.match(check(report, 'rollup-supplemental-matches').detail, /^not applicable/);
  assert.deepEqual(report.requiredRollup, ALL_ROWS_ROLLUP);
  assert.deepEqual(report.requiredRollup, report.talliedRollup);
});

test('overlap between the sets fails row-sets-disjoint', async () => {
  // Keep every other invariant true so only disjointness can fail.
  const manifest = head();
  manifest.required_rows.push('R-CW-5A');
  manifest.dispatch_allocation['frond-scribe-static'].push('R-CW-5A');
  manifest.rollup = { ...REQUIRED_ROLLUP, total_rows: 36, missing: 1 };
  await assertRejected(manifest, { 'row-sets-disjoint': /in both required_rows and dispatch_allocation\.supplemental: R-CW-5A/ });
});

test('a row in neither set fails rows-match-row-sets', async () => {
  const manifest = head();
  manifest.rows.push(extraRow('R-UNDECLARED'));
  await assertRejected(manifest, { 'rows-match-row-sets': /in neither set: "R-UNDECLARED"/ });
});

test('a supplemental row that also sits in a firing bucket fails firing-buckets-cover-required', async () => {
  const manifest = head();
  manifest.dispatch_allocation.emeric.push('R-CW-6A');
  await assertRejected(manifest, {
    'firing-buckets-cover-required': /non-required rows in firing buckets: R-CW-6A/,
  });
});

test('a row listed twice in rows[] fails rows-match-row-sets', async () => {
  const manifest = head();
  manifest.rows.push(structuredClone(rowOf(manifest, 'R-CW-1')));
  await assertRejected(manifest, {
    'rows-match-row-sets': /duplicate rows\[\] entries: "R-CW-1"/,
    // The duplicate is tallied too, so the declared rollup no longer matches.
    'manifest-rollup-matches-required': /total_rows: manifest=35 required-tally=36/,
  });
});

test('a declared row missing from rows[] fails rows-match-row-sets', async () => {
  const manifest = head();
  manifest.rows = manifest.rows.filter((row) => row.row !== 'R-CW-6A');
  await assertRejected(manifest, {
    'rows-match-row-sets': /declared but absent from rows\[\]: R-CW-6A/,
    'rollup-supplemental-matches': /total_rows: rollup_supplemental=3 supplemental-tally=2/,
  });
});

test('a supplemental row without "supplemental": true fails supplemental-flags-agree', async () => {
  for (const [label, mutate] of [
    ['flag removed', (row) => { delete row.supplemental; }],
    ['flag false', (row) => { row.supplemental = false; }],
    ['flag a string', (row) => { row.supplemental = 'true'; }],
    ['required true', (row) => { row.required = true; }],
  ]) {
    const manifest = head();
    mutate(rowOf(manifest, 'R-CW-5A'));
    await assertRejected(manifest, { 'supplemental-flags-agree': /supplemental row R-CW-5A has / }).catch((error) => {
      error.message = `${label}: ${error.message}`;
      throw error;
    });
  }
});

test('a required row flagged supplemental fails supplemental-flags-agree', async () => {
  for (const [label, mutate, detail] of [
    ['supplemental true', (row) => { row.supplemental = true; }, /non-supplemental row "R-CW-1" has supplemental=true/],
    ['required false', (row) => { row.required = false; }, /non-supplemental row "R-CW-1" has required=false/],
  ]) {
    const manifest = head();
    mutate(rowOf(manifest, 'R-CW-1'));
    await assertRejected(manifest, { 'supplemental-flags-agree': detail }).catch((error) => {
      error.message = `${label}: ${error.message}`;
      throw error;
    });
  }
  // Explicit agreeing flags on a required row are accepted.
  const manifest = head();
  Object.assign(rowOf(manifest, 'R-CW-1'), { required: true, supplemental: false });
  assert.equal((await validateManifest(manifest)).status, 0);
});

test('a firing bucket missing a required row fails firing-buckets-cover-required', async () => {
  const manifest = head();
  manifest.dispatch_allocation['frond-scribe-static'] = manifest.dispatch_allocation['frond-scribe-static']
    .filter((id) => id !== 'R-CW-7');
  await assertRejected(manifest, { 'firing-buckets-cover-required': /required rows in no firing bucket: R-CW-7$/ });
});

test('a firing bucket duplicating a required row fails firing-buckets-cover-required', async () => {
  const across = head();
  across.dispatch_allocation.unfired.push('R-CW-1');
  await assertRejected(across, { 'firing-buckets-cover-required': /required rows allocated more than once: R-CW-1×2$/ });

  const within = head();
  within.dispatch_allocation['frond-scribe-fixture'].push('R-CW-5');
  await assertRejected(within, { 'firing-buckets-cover-required': /required rows allocated more than once: R-CW-5×2$/ });
});

test('a firing bucket that is not a row list fails firing-buckets-cover-required', async () => {
  const manifest = head();
  manifest.dispatch_allocation.seat = 'emeric';
  await assertRejected(manifest, { 'firing-buckets-cover-required': /bucket seat is not an array of row ids/ });
});

test('the manifest rollup not matching the required tally fails manifest-rollup-matches-required', async () => {
  // The pre-#613 all-rows rollup left in place after the move.
  const allRows = head();
  allRows.rollup = { ...ALL_ROWS_ROLLUP };
  await assertRejected(allRows, {
    'manifest-rollup-matches-required': /total_rows: manifest=38 required-tally=35; missing: manifest=3 required-tally=0/,
  });

  // Every ROLLUP_KEYS key is required, including zero counts.
  const sparse = head();
  delete sparse.rollup.thin;
  await assertRejected(sparse, {
    'manifest-rollup-matches-required': /^thin: manifest=undefined required-tally=0$/,
  });

  const absent = head();
  delete absent.rollup;
  await assertRejected(absent, { 'manifest-rollup-matches-required': /^manifest rollup is missing$/ });
});

test('a wrong rollup_supplemental fails rollup-supplemental-matches', async () => {
  for (const [label, rollupSupplemental, detail] of [
    ['wrong count', { total_rows: 3, missing: 2 }, /missing: rollup_supplemental=2 supplemental-tally=3/],
    ['wrong total', { total_rows: 2, missing: 3 }, /total_rows: rollup_supplemental=2 supplemental-tally=3/],
    ['a state the rows do not have', { total_rows: 3, missing: 3, pass: 1 }, /pass: rollup_supplemental=1 supplemental-tally=0/],
    ['total_rows absent', { missing: 3 }, /total_rows missing/],
    ['misspelled state', { total_rows: 3, mising: 3 }, /unknown keys: mising.*missing: rollup_supplemental=\(absent\) supplemental-tally=3/],
    ['not an object', [3], /rollup_supplemental is not an object/],
  ]) {
    const manifest = head();
    manifest.rollup_supplemental = rollupSupplemental;
    await assertRejected(manifest, { 'rollup-supplemental-matches': detail }).catch((error) => {
      error.message = `${label}: ${error.message}`;
      throw error;
    });
  }
  // Writing out the zero states is equivalent to omitting them.
  const full = head();
  full.rollup_supplemental = { total_rows: 3, pass: 0, partial: 0, thin: 0, fail: 0, honest_limit: 0, missing: 3 };
  assert.equal((await validateManifest(full)).status, 0);
});

test('malformed row sets fail row-sets-defined', async () => {
  const duplicateRequired = head();
  duplicateRequired.required_rows.push('R-CW-1');
  await assertRejected(duplicateRequired, { 'row-sets-defined': /required_rows lists R-CW-1 twice/ });

  const disagreeing = head();
  disagreeing.supplemental_rows = ['R-CW-5A', 'R-CW-6A'];
  await assertRejected(disagreeing, {
    'row-sets-defined': /supplemental_rows disagrees with dispatch_allocation\.supplemental; only in the bucket: R-CD-RETURN-COVENANT-AUTHORITY/,
  });

  const notArray = head();
  notArray.dispatch_allocation.supplemental = 'R-CW-5A';
  const report = await assertRejected(notArray, {
    'row-sets-defined': /dispatch_allocation\.supplemental is not an array/,
    // With no usable supplemental set, the flagged rows are in neither set.
    'rows-match-row-sets': /in neither set/,
    'supplemental-flags-agree': /non-supplemental row/,
    'rollup-supplemental-matches': /supplemental-tally=0/,
  });
  assert.equal(report.supplementalRollup.total_rows, 0);
});

test('supplemental markers without required_rows fail instead of being ignored', async () => {
  const manifest = head();
  delete manifest.required_rows;
  const report = await assertRejected(manifest, {
    'supplemental-requires-required-rows':
      /dispatch_allocation\.supplemental; supplemental_rows; rollup_supplemental; rows flagged as not required: "R-CD-RETURN-COVENANT-AUTHORITY", "R-CW-5A", "R-CW-6A"$/,
  });
  assert.equal(report.requiredRollup, undefined);

  // Each marker fails on its own.
  for (const [label, mutate, detail] of [
    ['row supplemental true', (m) => { rowOf(m, 'R-CW-1').supplemental = true; }, /^[^;]*rows flagged as not required: "R-CW-1"$/],
    ['row required false', (m) => { rowOf(m, 'R-CW-1').required = false; }, /rows flagged as not required: "R-CW-1"$/],
    ['rollup_supplemental alone', (m) => { m.rollup_supplemental = { total_rows: 0 }; }, /markers: rollup_supplemental$/],
    ['supplemental bucket alone', (m) => { m.dispatch_allocation = { emeric: [], supplemental: [] }; }, /markers: dispatch_allocation\.supplemental$/],
  ]) {
    const legacy = base();
    delete legacy.required_rows;
    delete legacy.dispatch_allocation;
    mutate(legacy);
    await assertRejected(legacy, { 'supplemental-requires-required-rows': detail }).catch((error) => {
      error.message = `${label}: ${error.message}`;
      throw error;
    });
  }

  // Flags that agree with "every row is required" are not markers.
  const agreeing = base();
  delete agreeing.required_rows;
  delete agreeing.dispatch_allocation;
  Object.assign(rowOf(agreeing, 'R-CW-1'), { required: true, supplemental: false });
  const { status, report: agreeingReport } = await validateManifest(agreeing);
  assert.equal(status, 0);
  assert.deepEqual(agreeingReport.checks.map((c) => c.name), LEGACY_CHECKS);
});

test('supplemental rows keep their evidence: a missing EVIDENCE.md or row dir fails', async () => {
  // writeCorpus materializes every declared path, so point one supplemental row
  // at paths that are never written.
  const evidence = head();
  rowOf(evidence, 'R-CW-5A').evidence_doc = `PROOFS/${SHA}/R-CW-5A/NOT-WRITTEN.md`;
  await withRoot(async (root) => {
    await writeCorpus(root, SHA, evidence);
    await rm(join(root, 'PROOFS', SHA, 'R-CW-5A', 'NOT-WRITTEN.md'));
    const { status, payload } = run(root, ['--sha', SHA]);
    const [report] = payload.reports;
    assert.equal(status, 1);
    assert.deepEqual(failedChecks(report), ['evidence-doc-exists']);
    assert.equal(
      check(report, 'evidence-doc-exists').detail,
      `1 missing: R-CW-5A→PROOFS/${SHA}/R-CW-5A/NOT-WRITTEN.md`,
    );
  });

  await withRoot(async (root) => {
    await writeCorpus(root, SHA, head());
    await rm(join(root, 'PROOFS', SHA, 'R-CW-6A'), { recursive: true });
    const { status, payload } = run(root, ['--sha', SHA]);
    const [report] = payload.reports;
    assert.equal(status, 1);
    assert.deepEqual(failedChecks(report).sort(), ['evidence-doc-exists', 'row-dirs-exist']);
    assert.match(check(report, 'evidence-doc-exists').detail, /^1 missing: R-CW-6A→/);
    assert.equal(check(report, 'row-dirs-exist').detail, `1 missing: R-CW-6A→PROOFS/${SHA}/R-CW-6A/`);
  });
});

test('rollup total_rows must equal the declared required count, not only the rows present', async () => {
  // A required row dropped from rows[] with the rollup recounted to match: the
  // tally agrees, but total_rows no longer equals required_rows.
  const manifest = head();
  manifest.rows = manifest.rows.filter((row) => row.row !== 'R-CW-1');
  manifest.rollup = { ...REQUIRED_ROLLUP, total_rows: 34, pass: 30 };
  assert.equal(rowOf(head(), 'R-CW-1').state, 'pass');
  await assertRejected(manifest, {
    'rows-match-row-sets': /^declared but absent from rows\[\]: R-CW-1$/,
    'manifest-rollup-matches-required': /^total_rows: manifest=34 required_rows=35$/,
  });
});

test('remaining malformed shapes fail the check that owns them', async () => {
  for (const [label, mutate, expected] of [
    ['required_rows not an array', (m) => { m.required_rows = 'R-CW-1'; }, {
      'row-sets-defined': /^required_rows is not an array$/,
      // The required set is then empty, so nothing is required or tallied.
      'rows-match-row-sets': /^in neither set: /,
      'firing-buckets-cover-required': /^non-required rows in firing buckets: /,
      'manifest-rollup-matches-required': /^total_rows: manifest=35 required-tally=0; .*total_rows: manifest=35 required_rows=0$/,
    }],
    ['required_rows with a non-string id', (m) => { m.required_rows.push(7); }, {
      'row-sets-defined': /^required_rows has a non-string or empty entry 7$/,
    }],
    ['only in supplemental_rows', (m) => { m.supplemental_rows = [...SUPPLEMENTAL, 'R-CW-1']; }, {
      'row-sets-defined': /^supplemental_rows disagrees with dispatch_allocation\.supplemental; only in supplemental_rows: R-CW-1$/,
    }],
    ['dispatch_allocation null', (m) => { m.dispatch_allocation = null; }, {
      'firing-buckets-cover-required': /^dispatch_allocation is null, not row buckets; required rows in no firing bucket: /,
      // With no bucket, the flagged rows are no longer supplemental.
      'row-sets-defined': /only in supplemental_rows/,
      'rows-match-row-sets': /in neither set/,
      'supplemental-flags-agree': /non-supplemental row/,
      'rollup-supplemental-matches': /supplemental-tally=0/,
    }],
    ['manifest rollup not an object', (m) => { m.rollup = [35]; }, {
      'manifest-rollup-matches-required': /^manifest rollup is not an object$/,
    }],
  ]) {
    const manifest = head();
    mutate(manifest);
    await assertRejected(manifest, expected).catch((error) => {
      error.message = `${label}: ${error.message}`;
      throw error;
    });
  }

  // A scalar dispatch_allocation on a manifest without supplemental rows.
  const scalar = base();
  scalar.dispatch_allocation = 'emeric';
  await assertRejected(scalar, {
    'firing-buckets-cover-required': /^dispatch_allocation is string, not row buckets; required rows in no firing bucket: /,
  });
});

test('required_rows without dispatch_allocation reports bucket coverage as not applicable', async () => {
  const manifest = base();
  delete manifest.dispatch_allocation;
  const { status, report } = await validateManifest(manifest);
  assert.equal(status, 0);
  assert.equal(check(report, 'firing-buckets-cover-required').detail, 'not applicable: no dispatch_allocation');
});

test('a per-row dispatch_allocation list is checked for required coverage', async () => {
  // The shape of PROOFS/c3a0e5a314…: one { row, owner, status } entry per row.
  const manifest = base();
  manifest.dispatch_allocation = manifest.required_rows.map((row) => ({ row, owner: 'ronan', status: 'fired' }));
  assert.equal((await validateManifest(manifest)).status, 0);

  const duplicated = structuredClone(manifest);
  duplicated.dispatch_allocation.push({ row: 'R-CW-1', owner: 'emeric', status: 'fired' });
  await assertRejected(duplicated, {
    'firing-buckets-cover-required': /^required rows allocated more than once: R-CW-1×2$/,
  });

  manifest.dispatch_allocation.pop();
  manifest.dispatch_allocation.push({ owner: 'ronan' });
  await assertRejected(manifest, {
    'firing-buckets-cover-required': /dispatch_allocation\[37\] has no row id; required rows in no firing bucket: R-TRACE-REDACTION-1121/,
  });
});

test('an unauthorized R-CD-2 pass fails every rollup comparison in a supplemental corpus', async () => {
  const manifest = head();
  rowOf(manifest, 'R-CD-2').state = 'pass';
  manifest.rollup = { ...REQUIRED_ROLLUP, pass: 32, partial: 2 };
  await assertRejected(manifest, {
    'r-cd-2-reviewed-authority': /explicitly selected reviewed_run/,
    // The unauthorized pass is not tallied, exactly as for the all-rows tally.
    'manifest-rollup-matches-required': /^R-CD-2 reviewed authority failed; total_rows: manifest=35 required-tally=34; pass: manifest=32 required-tally=31$/,
    'rollup-supplemental-matches': /^R-CD-2 reviewed authority failed$/,
  });
});

test('--index passes on the 35-row required rollup and fails on the 38-row all-rows tally', async () => {
  await withRoot(async (root) => {
    await writeCorpus(root, SHA, head());
    await writeIndex(root, SHA, REQUIRED_ROLLUP);
    for (const mode of ['--index', '--current']) {
      const { status, payload } = run(root, [mode]);
      const [report] = payload.reports;
      assert.equal(status, 0, `${mode}: ${JSON.stringify(report.checks.filter((c) => !c.ok))}`);
      assert.equal(report.shaReport.failed, 0);
      assert.match(
        check(report, 'rollup-matches-manifest').detail,
        /^INDEX rollup matches manifest required-row tally \(total_rows=35, pass=31, partial=3, thin=0, fail=0, honest_limit=1, missing=0\); 3 supplemental rows excluded$/,
      );
    }

    await writeIndex(root, SHA, ALL_ROWS_ROLLUP);
    const { status, payload } = run(root, ['--index']);
    const [report] = payload.reports;
    assert.equal(status, 1);
    assert.equal(report.shaReport.failed, 0, 'the corpus itself is valid; only the INDEX rollup is wrong');
    assert.deepEqual(failedChecks(report), ['rollup-matches-manifest']);
    assert.equal(
      check(report, 'rollup-matches-manifest').detail,
      'total_rows: index=38 required-tally=35; missing: index=3 required-tally=0',
    );
  });
});

test('--index fails an unauthorized R-CD-2 pass in a supplemental corpus even on a matching rollup', async () => {
  await withRoot(async (root) => {
    const manifest = head();
    rowOf(manifest, 'R-CD-2').state = 'pass';
    manifest.rollup = { ...REQUIRED_ROLLUP, pass: 32, partial: 2 };
    await writeCorpus(root, SHA, manifest);
    // Even an INDEX that matches the tally without the unauthorized pass fails.
    await writeIndex(root, SHA, { ...REQUIRED_ROLLUP, total_rows: 34, partial: 2 });
    const { status, payload } = run(root, ['--index']);
    const [report] = payload.reports;
    assert.equal(status, 1);
    assert.equal(check(report, 'rollup-matches-manifest').detail, 'R-CD-2 reviewed authority failed');
    assert.deepEqual(report.shaReport.requiredRollup, { ...REQUIRED_ROLLUP, total_rows: 34, partial: 2 });
  });
});

test('--index fails when the INDEX points at a corpus whose own row sets are invalid', async () => {
  await withRoot(async (root) => {
    const manifest = head();
    manifest.rows.push(extraRow('R-UNDECLARED'));
    await writeCorpus(root, SHA, manifest);
    await writeIndex(root, SHA, REQUIRED_ROLLUP);
    const { status, payload } = run(root, ['--index']);
    assert.equal(status, 1);
    assert.deepEqual(failedChecks(payload.reports[0].shaReport), ['rows-match-row-sets']);
  });
});

test('--all reports a supplemental corpus failure as archival unless --strict', async () => {
  await withRoot(async (root) => {
    const otherSha = 'f'.repeat(40);
    const broken = head();
    broken.capture_sha = otherSha;
    for (const row of broken.rows) {
      row.dir = row.dir.replace(SHA, otherSha);
      row.evidence_doc = row.evidence_doc.replace(SHA, otherSha);
    }
    broken.dispatch_allocation.emeric.push('R-CW-6A');
    await writeCorpus(root, SHA, head());
    await writeCorpus(root, otherSha, broken);

    const archival = run(root, ['--all']);
    assert.equal(archival.status, 0);
    assert.equal(archival.payload.archivalFailed, true);
    const bySha = Object.fromEntries(archival.payload.reports.map((report) => [report.sha, report]));
    assert.equal(bySha[SHA].failed, 0);
    assert.deepEqual(failedChecks(bySha[otherSha]), ['firing-buckets-cover-required']);

    assert.equal(run(root, ['--all', '--strict']).status, 1);
  });
});

test('legacy manifests without required_rows validate exactly as before', async () => {
  const manifest = base();
  delete manifest.required_rows;
  delete manifest.dispatch_allocation;
  const { status, report } = await validateManifest(manifest);
  assert.equal(status, 0);
  assert.deepEqual(report.checks.map((c) => c.name), LEGACY_CHECKS);
  assert.deepEqual(Object.keys(report).sort(), [
    'checks', 'failed', 'passed', 'rCd2AuthorityValid', 'sha', 'skipped', 'talliedRollup',
  ]);
  assert.deepEqual(report.talliedRollup, ALL_ROWS_ROLLUP);

  // Unchanged: without required_rows the manifest's own rollup is not compared.
  manifest.rollup = { ...ALL_ROWS_ROLLUP, pass: 0 };
  assert.equal((await validateManifest(manifest)).status, 0);

  // Unchanged: --index compares a legacy manifest against the all-rows tally.
  await withRoot(async (root) => {
    manifest.rollup = { ...ALL_ROWS_ROLLUP };
    await writeCorpus(root, SHA, manifest);
    await writeIndex(root, SHA, ALL_ROWS_ROLLUP);
    const { status: indexStatus, payload } = run(root, ['--index']);
    assert.equal(indexStatus, 0);
    assert.equal(
      check(payload.reports[0], 'rollup-matches-manifest').detail,
      'INDEX rollup matches manifest tally (total_rows=38, pass=31, partial=3, thin=0, fail=0, honest_limit=1, missing=3)',
    );
  });
});
