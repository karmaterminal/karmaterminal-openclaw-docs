import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const scenarioPath = join(repoRoot, 'tools/k6-proofs/scenarios/r-cw-4-chain-depth.js');

test('R-CW-4 observation window tolerates delayed continuation delivery', async () => {
  const source = await readFile(scenarioPath, 'utf8');
  assert.match(source, /maxDuration:\s*'10m'/, 'scenario maxDuration should cover multi-minute idle-retry delays');
  assert.match(source, /r_cw_4_duration:\s*\['p\(95\)<600000'\]/, 'duration threshold should match the 10m observation window');
  assert.match(
    source,
    /socket\.setTimeout\(\(\) => socket\.close\(\), Math\.max\(600000, \(inv\.delaySeconds \* 4 \+ 360\) \* 1000\)\)/,
    'websocket observer should remain open long enough to catch delayed hop receipts',
  );
});
