import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Regression for the Project 86 plan transformer.
 *
 * PR #452 review, MEDIUM (idempotence): the transformer rejected its own output,
 * and the verification report's "idempotence" evidence only re-ran the *original*
 * input twice, which proves determinism and says nothing about idempotence.
 *
 * PR #452 review, MEDIUM (MC-11): R-OBS-1 declared the both-forms mandate
 * required, named `None` as its token sibling, and declared a single-surface row
 * INCOMPLETE. That completion contract could never be satisfied.
 */

const repoRoot = new URL('../../../../', import.meta.url).pathname;
const transformer = join(repoRoot, 'analysis/apply-project86-plan-corrections.mjs');
const report = join(repoRoot, 'analysis/project86-fold-readiness.json');
const corrected = join(repoRoot, 'analysis/project86-proof-issue-plan.corrected.json');

function apply(planPath, outPath, extra = []) {
  return spawnSync(
    process.execPath,
    [transformer, '--plan', planPath, '--report', report, '--out', outPath, ...extra],
    { cwd: repoRoot, encoding: 'utf8' },
  );
}

async function withTmp(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'p86-idem-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Assert that a drifted variant of the corrected plan is refused fail-closed. */
async function assertRejected(label, mutate) {
  await withTmp(async (dir) => {
    const raw = await readFile(corrected, 'utf8');
    const drifted = mutate(raw);
    assert.notEqual(drifted, raw, `${label}: mutation produced no drift`);
    const planPath = join(dir, 'drifted.json');
    const outPath = join(dir, 'out.json');
    await writeFile(planPath, drifted);
    const run = apply(planPath, outPath);
    assert.equal(run.status, 2, `${label}: expected fail-closed exit 2, got ${run.status}`);
    assert.match(run.stderr, /FAIL-CLOSED/, `${label}: ${run.stderr}`);
  });
}

test('the exact corrected plan is a byte-identical no-op', async () => {
  await withTmp(async (dir) => {
    const outPath = join(dir, 'again.json');
    const run = apply(corrected, outPath, ['--stdout-summary']);
    assert.equal(run.status, 0, run.stderr);

    const summary = JSON.parse(run.stdout);
    assert.equal(summary.input_mode, 'corrected-no-op');
    assert.equal(summary.candidate_sha, null);
    assert.equal(summary.rows, 38);

    const before = await readFile(corrected, 'utf8');
    const after = await readFile(outPath, 'utf8');
    assert.equal(after, before, 'the transformer did not reproduce its own output byte for byte');
  });
});

test('applying the transformer a third time reaches the same fixed point', async () => {
  await withTmp(async (dir) => {
    const first = join(dir, 'first.json');
    const second = join(dir, 'second.json');
    assert.equal(apply(corrected, first).status, 0);
    assert.equal(apply(first, second).status, 0);
    assert.equal(await readFile(second, 'utf8'), await readFile(corrected, 'utf8'));
  });
});

test('drifted, partial and re-serialized forms are still refused', async () => {
  await assertRejected('single byte flipped in a row body', (raw) =>
    raw.replace('--conflict-exit-code 75', '--conflict-exit-code 76'));

  await assertRejected('lock preamble removed from one row', (raw) =>
    raw.replace('command -v flock >/dev/null &&\\n', ''));

  await assertRejected('flock wrapper reverted to the superseded metadata-only form', (raw) =>
    raw.replace('--shell --require-lock', '--json'));

  await assertRejected('candidate_sha speculatively filled in', (raw) =>
    raw.replace('"candidate_sha": null', '"candidate_sha": "2723dbee783c113cae70e4fb63a4cff9f55402e3"'));

  await assertRejected('final-candidate placeholder substituted early', (raw) =>
    raw.replace('<FINAL_CANDIDATE_SHA>', '2723dbee783c113cae70e4fb63a4cff9f55402e3'));

  await assertRejected('re-serialized with different formatting', (raw) =>
    `${JSON.stringify(JSON.parse(raw), null, 4)}\n`);

  await assertRejected('R-OBS-1 reverted to the unsatisfiable both-forms contract', (raw) =>
    raw.replace('**Both-forms mandate:** not applicable', '**Both-forms mandate:** required'));
});

test('a tampered report is refused even when the plan is the exact corrected form', async () => {
  await withTmp(async (dir) => {
    const tampered = join(dir, 'report.json');
    const raw = await readFile(report, 'utf8');
    await writeFile(tampered, raw.replace('"verdict"', '"verdict "'));
    const run = spawnSync(
      process.execPath,
      [transformer, '--plan', corrected, '--report', tampered, '--out', join(dir, 'out.json')],
      { cwd: repoRoot, encoding: 'utf8' },
    );
    assert.equal(run.status, 2);
    assert.match(run.stderr, /FAIL-CLOSED: review report: SHA-256 pin mismatch/);
  });
});

test('every both-forms completion contract in the corrected plan is satisfiable', async () => {
  const plan = JSON.parse(await readFile(corrected, 'utf8'));
  const ids = new Set(plan.rows.map((r) => r.row_id));
  let required = 0;
  let notApplicable = 0;

  for (const row of plan.rows) {
    const mandates = row.body.match(/^\*\*Both-forms mandate:\*\* (.+)$/gm) ?? [];
    assert.equal(mandates.length, 1, `${row.row_id} declares ${mandates.length} both-forms mandates`);
    const value = /\*\* (.+)$/.exec(mandates[0])[1].trim();
    assert.ok(['required', 'not applicable'].includes(value), `${row.row_id}: unknown mandate "${value}"`);

    const block = row.body.slice(row.body.indexOf(mandates[0]));
    const incomplete = block.includes('proving only one surface is **INCOMPLETE**');

    if (value === 'not applicable') {
      notApplicable += 1;
      assert.ok(!incomplete, `${row.row_id} is not applicable yet still declares a single surface INCOMPLETE`);
      continue;
    }

    required += 1;
    assert.ok(incomplete, `${row.row_id} requires both forms but never says a single surface is incomplete`);
    const siblings = [...block.matchAll(/(Tool|Token)-form sibling row: `([^`]+)`/g)];
    assert.equal(siblings.length, 2, `${row.row_id} names ${siblings.length} sibling rows, expected 2`);
    for (const [, form, sibling] of siblings) {
      assert.notEqual(sibling, 'None', `${row.row_id} requires both forms but its ${form}-form sibling is None`);
      assert.ok(ids.has(sibling), `${row.row_id} names a ${form}-form sibling ${sibling} that is not in the plan`);
    }
  }

  assert.ok(required > 0 && notApplicable > 0, 'expected a mix of required and not-applicable rows');
  const obs1 = plan.rows.find((r) => r.row_id === 'R-OBS-1');
  assert.match(obs1.body, /\*\*Both-forms mandate:\*\* not applicable/);
});

test('the superseded reviewed payloads are recorded with their exact pre-image hashes', async () => {
  const plan = JSON.parse(await readFile(corrected, 'utf8'));
  const superseded = plan.corrections.superseded;
  assert.deepEqual(Object.keys(superseded).sort(), ['MC-03', 'MC-11/R-OBS-1']);
  for (const [id, record] of Object.entries(superseded)) {
    assert.match(record.reviewed_text_sha256, /^[0-9a-f]{64}$/, `${id} has no reviewed pre-image hash`);
    assert.ok(record.finding.length > 0);
    assert.ok(record.resolution.length > 0);
  }
  assert.equal(plan.corrections.ledger.find((e) => e.id === 'MC-03').sites, 36);
});
