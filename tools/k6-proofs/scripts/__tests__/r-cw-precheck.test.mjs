import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const scenarioPath = join(repoRoot, 'tools/k6-proofs/scenarios/r-cw.js');

test('R-CW combined runner is a non-evidentiary readiness precheck, not a proof path', async () => {
  const source = await readFile(scenarioPath, 'utf8');

  assert.match(source, /evidenceClass: 'preflight-only'/);
  assert.match(source, /canonicalProofEvidence: false/);
  assert.match(source, /r-cw-precheck-summary\.json/);
  assert.match(source, /PRECHECK:/);
  assert.doesNotMatch(source, /VERDICT:/);
  assert.doesNotMatch(source, /r-cw-summary\.json/);
  assert.doesNotMatch(source, /'R-CW-5'\s*:/);
  assert.doesNotMatch(source, /'R-CW-6'\s*:/);
  assert.doesNotMatch(source, /R-CW-5/);
  assert.doesNotMatch(source, /R-CW-6/);
});
