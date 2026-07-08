import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const scenarioPath = join(repoRoot, 'tools/k6-proofs/scenarios/r-cw-3-reason-telemetry.js');
const manifestPath = join(repoRoot, 'tools/k6-proofs/manifests/r-cw-3.json');

test('R-CW-3 observation window tolerates delayed continuation delivery', async () => {
  const source = await readFile(scenarioPath, 'utf8');
  assert.match(source, /maxDuration:\s*'10m'/, 'scenario maxDuration should cover multi-minute continuation delivery delays');
  assert.match(source, /r_cw_3_duration:\s*\['p\(95\)<600000'\]/, 'duration threshold should match the 10m observation window');
  assert.match(
    source,
    /socket\.setTimeout\(\(\) => socket\.close\(\), Math\.max\(600000, \(inv\.delaySeconds \+ 540\) \* 1000\)\)/,
    'websocket observer should remain open long enough to catch delayed wake receipts',
  );
});

test('R-CW-3 manifest timeout matches the long observation window', async () => {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.equal(manifest.timeoutSeconds, 600);
});
