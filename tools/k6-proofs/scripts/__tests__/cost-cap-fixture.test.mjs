import test from 'node:test';
import assert from 'node:assert/strict';

import { parseArgs } from '../run-cost-cap-fixture.mjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

test('R-CW-5 fixture accepts an explicit isolated source contract', () => {
  const parsed = parseArgs([
    'node',
    'run-cost-cap-fixture.mjs',
    '--source-dir',
    '/tmp/exact-openclaw',
    '--candidate-sha',
    '6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d',
    '--artifact-dir',
    '/tmp/rcw5-artifacts',
    '--cap',
    '100',
    '--json',
  ], {});
  assert.deepEqual(parsed, {
    sourceDir: '/tmp/exact-openclaw',
    candidateSha: '6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d',
    artifactDir: '/tmp/rcw5-artifacts',
    cap: 100,
    json: true,
  });
});

test('R-CW-5 fixture refuses unknown arguments', () => {
  assert.throws(
    () => parseArgs(['node', 'run-cost-cap-fixture.mjs', '--mutate-live-config'], {}),
    /unexpected argument: --mutate-live-config/,
  );
});

test('R-CW-5 typed tool-surface template asserts no durable work after exhausted elections', async () => {
  const template = await readFile(
    fileURLToPath(new URL('../../fixtures/r-cw-5/cost-cap-tool-surface.test.ts', import.meta.url)),
    'utf8',
  );
  assert.match(template, /runAgentAttempt/);
  assert.match(template, /continueWorkOpts/);
  assert.match(template, /continuationChainTokens:\s*101/);
  assert.match(template, /listTaskFlowsForOwnerKey\(sessionKey\)\)\.toHaveLength\(0\)/);
  assert.match(template, /2 of 2 continue_work elections were not scheduled/);
});
