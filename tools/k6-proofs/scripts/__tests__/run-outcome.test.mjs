import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveArtifactOutcome } from '../run-outcome.mjs';

test('resolves explicit outcomes before legacy exit-code fallback', () => {
  assert.equal(
    resolveArtifactOutcome({
      runResult: { outcome: 'PASS-candidate', verdict: 'FAIL-candidate', k6ExitCode: 99 },
      summary: { verdict: 'FAIL-candidate' },
    }),
    'PASS-candidate',
  );
  assert.equal(
    resolveArtifactOutcome({
      runResult: { verdict: 'FAIL-candidate', k6ExitCode: 0 },
      summary: { verdict: 'PASS-candidate' },
    }),
    'FAIL-candidate',
  );
  assert.equal(
    resolveArtifactOutcome({
      runResult: { k6ExitCode: 99 },
      summary: { verdict: 'PASS-candidate' },
    }),
    'PASS-candidate',
  );
});

test('preserves explicit abstention instead of synthesizing a candidate verdict', () => {
  for (const value of [null, undefined, '', '   ']) {
    assert.equal(
      resolveArtifactOutcome({
        runResult: { verdict: value, k6ExitCode: 99 },
        summary: { verdict: 'FAIL-candidate' },
      }),
      'NO-VERDICT',
    );
  }
  assert.equal(resolveArtifactOutcome({ runResult: { k6ExitCode: 0 } }), 'PASS-candidate');
  assert.equal(resolveArtifactOutcome({ runResult: { k6ExitCode: 99 } }), 'FAIL-candidate');
});
