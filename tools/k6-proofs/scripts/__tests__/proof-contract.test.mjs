import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { checkProofContracts } from '../check-proof-contracts.mjs';
import { resolveRunVerdict } from '../resolve-run-verdict.mjs';

const repoRoot = new URL('../../../..', import.meta.url).pathname;

test('canonical manifests define the complete reusable scenario contract matrix', () => {
  const result = checkProofContracts(repoRoot);
  assert.equal(result.failures.length, 0, result.failures.join('\n'));
  assert.equal(result.rows.length, 38);
  assert.deepEqual(result.unregistered.sort(), [
    'r-cd-collection-on-collapse.js',
    'r-cw-1.js',
    'r-cw-5-cost-cap-reject.js',
    'r-cw-6-max-chain-length.js',
    'r-cw.js',
    'r-rc-2.js',
  ]);
  assert.ok(result.rows.some((row) => row.applicability === 'live'));
  assert.ok(result.rows.some((row) => row.applicability === 'static'));
  assert.ok(result.rows.some((row) => row.applicability === 'fixture'));
  assert.ok(result.rows.some((row) => row.tempoStrategy === 'bounded-reason-fingerprint'));
});

test('run verdict resolution preserves pass, fail, and no-verdict distinctly', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'proof-verdict-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const log = path.join(root, 'k6.log');
  await writeFile(log, '');

  const valid = path.join(root, 'valid');
  await mkdir(valid);
  await writeFile(path.join(valid, 'row-summary.json'), JSON.stringify({ verdict: 'PASS-candidate' }));
  assert.equal((await resolveRunVerdict(valid, log)).verdict, 'PASS-candidate');

  const malformed = path.join(root, 'malformed');
  await mkdir(malformed);
  await writeFile(path.join(malformed, 'row-summary.json'), '{bad json');
  assert.equal((await resolveRunVerdict(malformed, log)).verdict, 'NO-VERDICT-candidate');

  const missing = path.join(root, 'missing');
  await mkdir(missing);
  assert.equal((await resolveRunVerdict(missing, log)).verdict, 'NO-VERDICT-candidate');

  const vuOnly = path.join(root, 'vu-only');
  await mkdir(vuOnly);
  await writeFile(log, 'R-CONFIG-DEFAULTS VERDICT: PASS-candidate\n');
  const vuOnlyResult = await resolveRunVerdict(vuOnly, log);
  assert.equal(vuOnlyResult.verdict, 'PASS-candidate');
  assert.equal(vuOnlyResult.verdictSource, 'vu-log');

  const conflicting = path.join(root, 'conflicting');
  await mkdir(conflicting);
  await writeFile(path.join(conflicting, 'row-summary.json'), JSON.stringify({ verdict: 'FAIL-candidate' }));
  assert.equal((await resolveRunVerdict(conflicting, log)).verdict, 'NO-VERDICT-candidate');

  await writeFile(log, '');
  const failed = path.join(root, 'failed');
  await mkdir(failed);
  await writeFile(path.join(failed, 'row-summary.json'), JSON.stringify({ verdict: 'BAD_PROOF' }));
  assert.equal((await resolveRunVerdict(failed, log)).verdict, 'FAIL-candidate');
});
