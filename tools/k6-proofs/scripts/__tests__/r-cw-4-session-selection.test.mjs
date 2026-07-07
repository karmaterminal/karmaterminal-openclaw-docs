import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const scenarioPath = join(repoRoot, 'tools/k6-proofs/scenarios/r-cw-4-chain-depth.js');
const manifestPath = join(repoRoot, 'tools/k6-proofs/manifests/r-cw-4.json');

test('R-CW-4 uses runner-provisioned subagent sessions instead of custom main-lane sessions', async () => {
  const source = await readFile(scenarioPath, 'utf8');
  assert.match(source, /function isRunnerProvisionedSession\(key\)/);
  assert.match(source, /includes\(':subagent:continuation-'\)/);
  assert.match(
    source,
    /&& !isRunnerProvisionedSession\(requestedSessionKey\)/,
    'global disposable-session env must not override the runner-provisioned continuation subagent session',
  );
});

test('R-CW-4 manifest documents supplied-session preference', async () => {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.match(manifest.scenario.registryNotes, /supplied runner-provisioned session/);
});
