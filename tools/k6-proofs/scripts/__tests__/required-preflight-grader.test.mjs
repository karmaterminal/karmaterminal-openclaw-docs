import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// The grader joins a live cap row's behavioral verdict (the fixture's
// fixture-result.json) with its required preflight receipts, per 🌊's F″ method
// ruling: PASS-candidate survives only when every preflight the row manifest
// requires passed at the same candidate. The live results below are the real
// F′ fixture outputs, so the grader is exercised on what the fixtures write.
const repoRoot = new URL('../../../..', import.meta.url).pathname;
const grader = join(repoRoot, 'tools/k6-proofs/scripts/grade-preflight-gated-row.mjs');
const FPRIME_SHA = 'f15237ec921879d918482cdf372b0718d4c1aab9';
const OTHER_SHA = 'b'.repeat(40);
const ROWS = {
  'R-CW-5': {
    preflight: 'R-CW-5A',
    manifest: join(repoRoot, 'tools/k6-proofs/manifests/r-cw-5.json'),
    liveResult: join(repoRoot, `PROOFS/${FPRIME_SHA}/R-CW-5/fixture-ronan/fixture-result.json`),
  },
  'R-CW-6': {
    preflight: 'R-CW-6A',
    manifest: join(repoRoot, 'tools/k6-proofs/manifests/r-cw-6.json'),
    liveResult: join(repoRoot, `PROOFS/${FPRIME_SHA}/R-CW-6/fixture-ronan/fixture-result.json`),
  },
};

function receipt(live, overrides = {}) {
  const passed = overrides.preflightStatus !== 'failed';
  return {
    schema: 'openclaw.k6.required-preflight-receipt.v1',
    preflightRow: ROWS[live].preflight,
    attachedTo: live,
    candidateSha: FPRIME_SHA,
    sourceEvidenceSha: FPRIME_SHA,
    evidenceBinding: 'exact-candidate-sha',
    verdict: passed ? 'construct-only' : 'FAIL-candidate',
    preflightStatus: passed ? 'passed' : 'failed',
    checks: { sourceGuard: passed, exactCandidateBinding: true, nonLiveBoundary: true },
    ...overrides,
  };
}

async function withDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'k6-preflight-grader-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function writeJson(dir, name, value) {
  const file = join(dir, name);
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
  return file;
}

function grade(args) {
  const result = spawnSync(process.execPath, [grader, ...args, '--json'], { encoding: 'utf8' });
  let payload = null;
  try { payload = JSON.parse(result.stdout); } catch { /* usage errors print nothing */ }
  return { status: result.status, stderr: result.stderr, payload };
}

async function gradeRow(live, receipts, { liveResult = ROWS[live].liveResult } = {}) {
  return withDir(async (dir) => {
    const args = ['--manifest', ROWS[live].manifest, '--live-result', liveResult];
    for (const [index, value] of receipts.entries()) {
      args.push('--preflight-receipt', await writeJson(dir, `receipt-${index}.json`, value));
    }
    return grade(args);
  });
}

test('the real F′ fixture results are PASS-candidate at F′, so every cap below comes from the gate', async () => {
  for (const live of Object.keys(ROWS)) {
    const result = JSON.parse(await readFile(ROWS[live].liveResult, 'utf8'));
    assert.equal(result.verdict, 'PASS-candidate');
    assert.equal(result.candidateSha, FPRIME_SHA);
  }
});

test('(a) a live PASS-candidate with no preflight receipt is capped at PARTIAL-candidate', async () => {
  for (const [live, { preflight }] of Object.entries(ROWS)) {
    const { status, payload, stderr } = await gradeRow(live, []);
    assert.equal(status, 1, stderr);
    assert.equal(payload.schema, 'openclaw.k6.preflight-gated-row-verdict.v1');
    assert.equal(payload.row, live);
    assert.equal(payload.candidateSha, FPRIME_SHA);
    assert.equal(payload.behavioralVerdict, 'PASS-candidate');
    assert.equal(payload.verdict, 'PARTIAL-candidate');
    assert.equal(payload.capped, true);
    assert.equal(payload.candidateOnly, true);
    assert.equal(payload.foldRequiresReview, true);
    assert.deepEqual(payload.preflights, [{
      rowId: preflight, status: 'missing', reasons: ['no receipt supplied'], receiptFile: null, receiptSha256: null,
    }]);
  }
});

test('(b) a failed preflight caps the live row at PARTIAL-candidate', async () => {
  for (const [live, { preflight }] of Object.entries(ROWS)) {
    const { status, payload } = await gradeRow(live, [receipt(live, { preflightStatus: 'failed' })]);
    assert.equal(status, 1);
    assert.equal(payload.verdict, 'PARTIAL-candidate');
    assert.equal(payload.capped, true);
    assert.equal(payload.preflights[0].rowId, preflight);
    assert.equal(payload.preflights[0].status, 'failed');
    assert.deepEqual(payload.preflights[0].reasons, ['preflightStatus=failed', 'verdict=FAIL-candidate', 'failed checks: sourceGuard']);
  }
});

test('(c) a passing preflight at a different SHA does not count', async () => {
  for (const [label, overrides, reason] of [
    ['candidate', { candidateSha: OTHER_SHA }, `candidateSha ${OTHER_SHA} is not the candidate ${FPRIME_SHA}`],
    ['carried evidence', { sourceEvidenceSha: '1cc8f4e3d617ef6f173283ef83d7b739a4995734' }, `sourceEvidenceSha 1cc8f4e3d617ef6f173283ef83d7b739a4995734 is not the candidate ${FPRIME_SHA}`],
    ['binding', { evidenceBinding: 'index-static-evidence-sha' }, 'evidenceBinding is "index-static-evidence-sha", expected exact-candidate-sha'],
  ]) {
    for (const live of Object.keys(ROWS)) {
      const { status, payload } = await gradeRow(live, [receipt(live, overrides)]);
      assert.equal(status, 1, `${label} ${live}`);
      assert.equal(payload.verdict, 'PARTIAL-candidate', `${label} ${live}`);
      assert.equal(payload.preflights[0].status, 'wrong-candidate', `${label} ${live}`);
      assert.deepEqual(payload.preflights[0].reasons, [reason], `${label} ${live}`);
    }
  }
});

test('a passing same-candidate preflight leaves the behavioral verdict in place', async () => {
  for (const live of Object.keys(ROWS)) {
    await withDir(async (dir) => {
      const receiptFile = await writeJson(dir, 'required-preflight-receipt.json', receipt(live));
      const out = join(dir, 'preflight-gate.json');
      const { status, payload } = grade([
        '--manifest', ROWS[live].manifest,
        '--live-result', ROWS[live].liveResult,
        '--preflight-receipt', receiptFile,
        '--out', out,
      ]);
      assert.equal(status, 0);
      assert.equal(payload.verdict, 'PASS-candidate');
      assert.equal(payload.capped, false);
      assert.equal(payload.preflights[0].status, 'passed');
      assert.deepEqual(payload.preflights[0].reasons, []);
      assert.equal(payload.preflights[0].receiptFile, 'required-preflight-receipt.json');
      assert.equal(
        payload.preflights[0].receiptSha256,
        createHash('sha256').update(await readFile(receiptFile)).digest('hex'),
      );
      const written = await readFile(out, 'utf8');
      assert.deepEqual(JSON.parse(written), payload);
      // Public-safe: no private filesystem path reaches the verdict file.
      assert.doesNotMatch(written, new RegExp(dir.replaceAll('/', '\\/')));
      assert.doesNotMatch(written, new RegExp(repoRoot.replaceAll('/', '\\/')));
    });
  }
});

test('the gate never upgrades: a failed fixture stays failed with a passing preflight', async () => {
  await withDir(async (dir) => {
    const failed = JSON.parse(await readFile(ROWS['R-CW-5'].liveResult, 'utf8'));
    failed.verdict = 'FAIL-fixture';
    const liveResult = await writeJson(dir, 'fixture-result.json', failed);
    const { status, payload } = await gradeRow('R-CW-5', [receipt('R-CW-5')], { liveResult });
    assert.equal(status, 1);
    assert.equal(payload.behavioralVerdict, 'FAIL-fixture');
    assert.equal(payload.verdict, 'FAIL-fixture');
    assert.equal(payload.capped, false);
  });
});

test('ambiguous or malformed receipts are invalid, never a pass', async () => {
  const twice = await gradeRow('R-CW-5', [receipt('R-CW-5'), receipt('R-CW-5')]);
  assert.equal(twice.status, 1);
  assert.equal(twice.payload.verdict, 'PARTIAL-candidate');
  assert.equal(twice.payload.preflights[0].status, 'invalid');
  assert.deepEqual(twice.payload.preflights[0].reasons, ['2 receipts supplied for R-CW-5A']);

  for (const [label, value, reason] of [
    ['wrong schema', receipt('R-CW-5', { schema: 'x' }), /^schema is "x", expected openclaw\.k6\.required-preflight-receipt\.v1$/],
    ['wrong live row', receipt('R-CW-5', { attachedTo: 'R-CW-6' }), /^attachedTo is "R-CW-6", expected R-CW-5$/],
    ['no checks', receipt('R-CW-5', { checks: {} }), /^checks is not a non-empty object of booleans$/],
  ]) {
    const { status, payload } = await gradeRow('R-CW-5', [value]);
    assert.equal(status, 1, label);
    assert.equal(payload.verdict, 'PARTIAL-candidate', label);
    assert.equal(payload.preflights[0].status, 'invalid', label);
    assert.match(payload.preflights[0].reasons.join('; '), reason, label);
  }
});

test('the grader refuses inputs it cannot bind', async () => {
  await withDir(async (dir) => {
    // A receipt for a preflight this row does not require.
    const foreign = grade([
      '--manifest', ROWS['R-CW-5'].manifest,
      '--live-result', ROWS['R-CW-5'].liveResult,
      '--preflight-receipt', await writeJson(dir, 'foreign.json', receipt('R-CW-6')),
    ]);
    assert.equal(foreign.status, 2);
    assert.match(foreign.stderr, /receipt foreign\.json is for R-CW-6A, which is not a required preflight of R-CW-5/);

    // The other row's fixture result.
    const crossed = grade(['--manifest', ROWS['R-CW-5'].manifest, '--live-result', ROWS['R-CW-6'].liveResult]);
    assert.equal(crossed.status, 2);
    assert.match(crossed.stderr, /live result is for R-CW-6, not R-CW-5/);

    // A row with no required preflight.
    const ungated = grade([
      '--manifest', join(repoRoot, 'tools/k6-proofs/manifests/r-cw-7.json'),
      '--live-result', ROWS['R-CW-5'].liveResult,
    ]);
    assert.equal(ungated.status, 2);
    assert.match(ungated.stderr, /R-CW-7 declares no requiredPreflights/);

    // A live result with no exact candidate.
    const unbound = JSON.parse(await readFile(ROWS['R-CW-5'].liveResult, 'utf8'));
    unbound.candidateSha = 'f15237ec92';
    const noSha = grade([
      '--manifest', ROWS['R-CW-5'].manifest,
      '--live-result', await writeJson(dir, 'short.json', unbound),
    ]);
    assert.equal(noSha.status, 2);
    assert.match(noSha.stderr, /live result candidateSha must be a 40-character SHA/);
  });
});
