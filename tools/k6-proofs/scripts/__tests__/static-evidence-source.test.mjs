import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const index = JSON.parse(await readFile(join(repoRoot, 'PROOFS/INDEX.json'), 'utf8'));

test('static evidence source is explicit and contains every static row', async () => {
  assert.match(index.static_evidence_sha, /^[0-9a-f]{40}$/);

  const rowRoots = [
    ['R-CD-RETURN-OVERLAP', 'cael-dgx'],
    ['R-OBS-2', 'cael-dgx'],
    ['R-REGRESSION-TRAP-TESTS', 'cael-dgx'],
    ['R-TRACE-REDACTION-1121'],
    ['R-CW-7', 'cael-dgx'],
    ['R-CW-DELEGATE-CHILD-LIVE', 'cael-dgx'],
    ['R-CW-DELEGATE-TOKEN', 'cael-dgx'],
    ['R-CW-MULTI', 'cael-dgx'],
    ['R-CW-MULTI-COLLAPSE', 'cael-dgx'],
    ['R-CD-COLLECTION-ON-COLLAPSE', 'cael-dgx'],
  ];

  for (const parts of rowRoots) {
    await access(join(repoRoot, 'PROOFS', index.static_evidence_sha, ...parts));
  }
});

test('every static scenario records active and source evidence SHAs', async () => {
  const scenarios = [
    'r-cd-return-overlap.js',
    'r-obs-2.js',
    'r-regression-trap-tests.js',
    'r-trace-redaction-1121.js',
    'static-corpus-row-validator.js',
  ];

  for (const scenario of scenarios) {
    const source = await readFile(join(repoRoot, 'tools/k6-proofs/scenarios', scenario), 'utf8');
    assert.match(source, /index\.static_evidence_sha \|\| currentSha/);
    assert.match(source, /currentProofSha: currentSha/);
    assert.match(source, /sourceEvidenceSha/);
  }
});
