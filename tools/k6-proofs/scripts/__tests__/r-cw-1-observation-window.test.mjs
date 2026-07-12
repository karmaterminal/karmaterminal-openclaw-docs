import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const scenarioPath = path.join(
  repoRoot,
  'tools/k6-proofs/scenarios/r-cw-1-tool-schedule-wake.js',
);
const manifestPath = path.join(repoRoot, 'tools/k6-proofs/manifests/r-cw-1.json');

test('R-CW-1 observation window tolerates delayed continuation delivery', async () => {
  const source = await readFile(scenarioPath, 'utf8');
  assert.match(source, /r_cw_1_duration:\s*\['p\(95\)<110000'\]/);
  assert.match(
    source,
    /const closeDelta = Math\.max\(\(inv\.delaySeconds \+ 75\) \* 1000, 90000\)/,
  );
});

test('R-CW-1 manifest timeout contains the extended observation window', async () => {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.equal(manifest.timeoutSeconds, 120);
});
