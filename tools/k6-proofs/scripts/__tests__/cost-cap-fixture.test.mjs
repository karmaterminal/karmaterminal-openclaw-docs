import test from 'node:test';
import assert from 'node:assert/strict';

import { parseArgs } from '../run-cost-cap-fixture.mjs';

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
