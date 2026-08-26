import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  mkdir,
  mkdtemp,
  rm,
  symlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  analyzeContinuationAcceptanceManifest,
  buildContinuationAcceptanceManifest,
  isContinuationAcceptanceManifest,
  loadContinuationAcceptancePolicy,
  REQUIRED_TARGET_ROLLUP,
  SUPPLEMENTAL_ROW_IDS,
  SUPPLEMENTAL_TARGET_ROLLUP,
} from '../lib/continuation-acceptance-matrix.mjs';

const REJECTED_BASE = '45cf1ae59ba0f32031a90dde193fe2d48d494e25';
const CURRENT_SHA = '4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd';
const CURRENT_MANIFEST = `PROOFS/${CURRENT_SHA}/proofs-manifest.json`;
const ALLOCATION_MANIFEST =
  'PROOFS/c3a0e5a314ecbf572911d4b2e84595bd06f64d69/proofs-manifest.json';
const RRC2_RECEIPT =
  `PROOFS/${CURRENT_SHA}/R-RC-2/catalog/` +
  'live-rc2-isolated-20260825T103519Z-r-rc-2-489d7712-run-result.json';
const SUPPLEMENTAL = [
  'R-OBS-CONT-PROVENANCE',
  'R-OBS-PROOF-MARKER',
  'R-OBS-TERMINAL-OUTCOME',
];
const CORPUS_VALIDATOR = 'tools/k6-proofs/scripts/validate-corpus.mjs';
const CATALOG_VALIDATOR = 'tools/k6-proofs/scripts/check-proof-row-manifests.mjs';

function json(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function clone(value) {
  return structuredClone(value);
}

function generated() {
  return buildContinuationAcceptanceManifest(json(CURRENT_MANIFEST), {
    allocationManifest: json(ALLOCATION_MANIFEST),
    honestLimitReceipts: { 'R-RC-2': RRC2_RECEIPT },
    root: process.cwd(),
  });
}

test('rejected base promoted the three fleet telemetry rows into required acceptance', () => {
  const rejected = JSON.parse(execFileSync(
    'git',
    ['show', `${REJECTED_BASE}:${CURRENT_MANIFEST}`],
    { encoding: 'utf8' },
  ));
  assert.equal(rejected.required_rows.length, 41);
  for (const row of SUPPLEMENTAL) assert.ok(rejected.required_rows.includes(row));
  assert.equal(rejected.supplemental_rows, undefined);
  assert.deepEqual(json(CURRENT_MANIFEST).rows, rejected.rows);
});

test('successor current matrix has 38 required rows and three typed supplemental rows', () => {
  const manifest = json(CURRENT_MANIFEST);
  const analysis = analyzeContinuationAcceptanceManifest(manifest, {
    root: process.cwd(),
  });
  assert.equal(analysis.valid, true, analysis.failures.join('\n'));
  assert.equal(analysis.requiredRows.length, 38);
  assert.deepEqual(analysis.supplementalRows, SUPPLEMENTAL);
  assert.ok(analysis.requiredRows.includes('R-OBS-BACKEND-DISPOSITION'));
  assert.deepEqual(analysis.dispatchRows.sort(), [...analysis.requiredRows].sort());
});

test('current/index validator exposes required and supplemental arithmetic', () => {
  const result = JSON.parse(execFileSync(
    process.execPath,
    [CORPUS_VALIDATOR, '--current', '--json'],
    { encoding: 'utf8' },
  ));
  assert.equal(result.failed, false);
  const matrix = result.reports[0].shaReport.continuationAcceptance;
  assert.equal(matrix.valid, true, matrix.failures.join('\n'));
  assert.equal(matrix.requiredRollup.total_rows, 38);
  assert.equal(matrix.supplementalRollup.total_rows, 3);
  assert.equal(matrix.acceptance.complete, false);
  assert.throws(
    () => execFileSync(
      process.execPath,
      [CORPUS_VALIDATOR, '--current', '--require-acceptance'],
      { encoding: 'utf8', stdio: 'pipe' },
    ),
    (error) => {
      assert.match(
        `${error.stdout || ''}${error.stderr || ''}`,
        /R-CD-2:partial.*R-OBS-BACKEND-DISPOSITION:missing/s,
      );
      return true;
    },
  );
});

test('catalog validator reports required and supplemental collections separately', () => {
  const output = execFileSync(
    process.execPath,
    [CATALOG_VALIDATOR],
    { encoding: 'utf8' },
  );
  assert.match(output, /Required acceptance rows: 38/);
  assert.match(
    output,
    /Supplemental\/future rows: 3 \(R-OBS-CONT-PROVENANCE, R-OBS-PROOF-MARKER, R-OBS-TERMINAL-OUTCOME\)/,
  );
});

test('generator preserves rows and evidence while correcting classification and allocation', () => {
  const source = json(CURRENT_MANIFEST);
  const manifest = generated();
  assert.deepEqual(manifest.rows, source.rows);
  assert.deepEqual(manifest.rollup, source.rollup);
  assert.equal(manifest.required_rows.length, 38);
  assert.deepEqual(manifest.supplemental_rows.map((entry) => entry.row), SUPPLEMENTAL);
  assert.equal(manifest.dispatch_allocation.length, 38);
  for (const row of SUPPLEMENTAL) {
    assert.ok(!manifest.required_rows.includes(row));
    assert.ok(!manifest.dispatch_allocation.some((entry) => entry.row === row));
  }
});

test('current evidence remains honest and reports the final semantic target separately', () => {
  const analysis = analyzeContinuationAcceptanceManifest(generated(), {
    root: process.cwd(),
  });
  assert.equal(analysis.valid, true, analysis.failures.join('\n'));
  assert.deepEqual(analysis.requiredRollup, {
    total_rows: 38,
    pass: 32,
    partial: 4,
    thin: 0,
    fail: 0,
    honest_limit: 1,
    missing: 1,
  });
  assert.deepEqual(analysis.supplementalRollup, {
    total_rows: 3,
    pass: 0,
    partial: 0,
    thin: 0,
    fail: 0,
    honest_limit: 0,
    missing: 3,
  });
  assert.equal(analysis.acceptance.complete, false);
  assert.deepEqual(
    analysis.acceptance.blockers.map((entry) => entry.row),
    ['R-CD-2', 'R-CD-CHAINED-DEPTH-2', 'R-CD-TOKEN', 'R-CW-6', 'R-OBS-BACKEND-DISPOSITION'],
  );
  assert.equal(analysis.acceptance.receipt.valid, true);
});

test('37 PASS plus receipt-backed R-RC-2 honest limit is the only complete required target', () => {
  const manifest = generated();
  for (const row of manifest.rows) {
    if (manifest.required_rows.includes(row.row) && row.row !== 'R-RC-2') {
      row.state = 'pass';
      row.candidate_verdict = 'PASS-candidate';
    }
  }
  manifest.rollup = {
    total_rows: 41,
    pass: 37,
    partial: 0,
    thin: 0,
    fail: 0,
    honest_limit: 1,
    missing: 3,
  };
  manifest.acceptance.required_rollup = {
    total_rows: 38,
    pass: 37,
    partial: 0,
    thin: 0,
    fail: 0,
    honest_limit: 1,
    missing: 0,
  };
  manifest.acceptance.complete = true;
  manifest.acceptance.blocking_required_rows = [];
  const analysis = analyzeContinuationAcceptanceManifest(manifest, {
    root: process.cwd(),
  });
  assert.equal(analysis.valid, true, analysis.failures.join('\n'));
  assert.equal(analysis.acceptance.complete, true);
});

test('validator rejects duplicate, unclassified, dropped, and cross-classified rows', async (t) => {
  const cases = [
    ['duplicate required row', (manifest) => {
      manifest.required_rows.push(manifest.required_rows[0]);
    }, /required_rows.*canonical|duplicates/],
    ['duplicate supplemental row', (manifest) => {
      manifest.supplemental_rows.push(clone(manifest.supplemental_rows[0]));
    }, /supplemental_rows.*typed|duplicates/],
    ['unclassified row', (manifest) => {
      manifest.rows.push({ row: 'R-UNCLASSIFIED', state: 'missing' });
      manifest.rollup.total_rows += 1;
      manifest.rollup.missing += 1;
    }, /unclassified/],
    ['silently dropped row', (manifest) => {
      manifest.rows = manifest.rows.filter((row) => row.row !== 'R-CW-1');
      manifest.rollup.total_rows -= 1;
      manifest.rollup.pass -= 1;
    }, /missing from rows|exactly 41/],
    ['supplemental row re-entered required allocation', (manifest) => {
      manifest.dispatch_allocation.push({
        row: SUPPLEMENTAL[0],
        owner: 'frond-followup',
        status: 'not-fired',
      });
    }, /non-required rows/],
    ['required row dropped from allocation', (manifest) => {
      manifest.dispatch_allocation =
        manifest.dispatch_allocation.filter((entry) => entry.row !== 'R-CW-1');
    }, /missing dispatch allocation/],
  ];
  for (const [name, mutate, expected] of cases) {
    await t.test(name, () => {
      const manifest = generated();
      mutate(manifest);
      const analysis = analyzeContinuationAcceptanceManifest(manifest, {
        root: process.cwd(),
      });
      assert.equal(analysis.valid, false);
      assert.match(analysis.failures.join('\n'), expected);
    });
  }
});

test('supplemental missing rows cannot become PASS or lose missing state', async (t) => {
  await t.test('PASS-candidate claim', () => {
    const manifest = generated();
    manifest.rows.find((row) => row.row === SUPPLEMENTAL[0]).candidate_verdict =
      'PASS-candidate';
    const analysis = analyzeContinuationAcceptanceManifest(manifest, {
      root: process.cwd(),
    });
    assert.equal(analysis.valid, false);
    assert.match(analysis.failures.join('\n'), /supplemental\/missing.*cannot claim PASS/);
  });
  await t.test('state promotion', () => {
    const manifest = generated();
    const row = manifest.rows.find((entry) => entry.row === SUPPLEMENTAL[0]);
    row.state = 'pass';
    row.candidate_verdict = 'PASS-candidate';
    manifest.rollup.pass += 1;
    manifest.rollup.missing -= 1;
    manifest.supplemental_rollup.pass += 1;
    manifest.supplemental_rollup.missing -= 1;
    const analysis = analyzeContinuationAcceptanceManifest(manifest, {
      root: process.cwd(),
    });
    assert.equal(analysis.valid, false);
    assert.match(analysis.failures.join('\n'), /supplemental state must remain missing/);
  });
});

test('R-RC-2 is the sole receipt-backed required non-PASS path', async (t) => {
  await t.test('another honest limit', () => {
    const manifest = generated();
    const row = manifest.rows.find((entry) => entry.row === 'R-CW-1');
    row.state = 'honest_limit';
    row.candidate_verdict = 'HONEST-LIMIT-candidate';
    manifest.rollup.pass -= 1;
    manifest.rollup.honest_limit += 1;
    manifest.acceptance.required_rollup.pass -= 1;
    manifest.acceptance.required_rollup.honest_limit += 1;
    const analysis = analyzeContinuationAcceptanceManifest(manifest, {
      root: process.cwd(),
    });
    assert.equal(analysis.valid, false);
    assert.match(analysis.failures.join('\n'), /reserved for R-RC-2/);
  });
  await t.test('missing R-RC-2 receipt', () => {
    const manifest = generated();
    manifest.acceptance.honest_limit_receipts = {};
    const analysis = analyzeContinuationAcceptanceManifest(manifest, {
      root: process.cwd(),
    });
    assert.equal(analysis.valid, false);
    assert.match(analysis.failures.join('\n'), /not receipt-backed/);
  });
});

test('R-RC-2 receipt validation refuses a symlink that escapes the corpus root', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'continuation-matrix-receipt-'));
  const receiptDir = path.join(root, 'PROOFS', CURRENT_SHA, 'R-RC-2');
  await mkdir(receiptDir, { recursive: true });
  try {
    const manifest = generated();
    const escaped = path.join(receiptDir, 'escaped-run-result.json');
    await symlink(path.resolve(RRC2_RECEIPT), escaped);
    manifest.acceptance.honest_limit_receipts['R-RC-2'] =
      `PROOFS/${CURRENT_SHA}/R-RC-2/escaped-run-result.json`;
    manifest.acceptance.blocking_required_rows.push({
      row: 'R-RC-2',
      state: 'honest_limit',
      reason: 'receipt path is missing, unsafe, or absent',
    });
    const analysis = analyzeContinuationAcceptanceManifest(manifest, { root });
    assert.equal(analysis.valid, false);
    assert.match(analysis.failures.join('\n'), /R-RC-2 honest_limit is not receipt-backed/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('policy itself pins backend disposition and the exact supplemental provenance', () => {
  const policy = loadContinuationAcceptancePolicy();
  assert.equal(policy.required_rows.length, 38);
  assert.ok(policy.required_rows.includes('R-OBS-BACKEND-DISPOSITION'));
  assert.deepEqual(policy.supplemental_rows.map((entry) => entry.row), SUPPLEMENTAL);
  assert.deepEqual(SUPPLEMENTAL_ROW_IDS, SUPPLEMENTAL);
  assert.deepEqual(policy.target_rollup, REQUIRED_TARGET_ROLLUP);
  assert.deepEqual(policy.supplemental_target_rollup, SUPPLEMENTAL_TARGET_ROLLUP);
  for (const entry of policy.supplemental_rows) {
    assert.equal(entry.issue, 'karmaterminal/openclaw#1254');
    assert.equal(entry.state, 'missing');
    assert.equal(entry.introduced_commit, '5a061227cbb438572bc9aecdb1dbc902dc585452');
  }
});

test('a continuation matrix cannot downgrade itself to legacy validation', () => {
  const manifest = generated();
  delete manifest.acceptance;
  delete manifest.supplemental_rows;
  delete manifest.supplemental_rollup;
  assert.equal(isContinuationAcceptanceManifest(manifest), true);
  const analysis = analyzeContinuationAcceptanceManifest(manifest, {
    root: process.cwd(),
  });
  assert.equal(analysis.valid, false);
  assert.match(
    analysis.failures.join('\n'),
    /supplemental_rows.*typed|acceptance\.schema/,
  );
});

test('policy rejects moving a supplemental row back into required acceptance', () => {
  const policy = loadContinuationAcceptancePolicy();
  const moved = clone(policy);
  const [entry] = moved.supplemental_rows.splice(0, 1);
  moved.required_rows.push(entry.row);
  const manifest = generated();
  const analysis = analyzeContinuationAcceptanceManifest(manifest, {
    policy: moved,
    root: process.cwd(),
  });
  assert.equal(analysis.valid, false);
  assert.match(analysis.failures.join('\n'), /supplemental_rows must be exactly/);
});
