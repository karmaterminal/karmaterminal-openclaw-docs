import test from 'node:test';
import assert from 'node:assert/strict';
import { extractGraceContract, parseArgs } from '../run-multi-collapse-fixture.mjs';

test('R-CW-MULTI-COLLAPSE fixture parses isolated source args', () => {
  const parsed = parseArgs([
    'node',
    'run-multi-collapse-fixture.mjs',
    '--source-dir',
    '/tmp/exact-openclaw',
    '--candidate-sha',
    '7cb9d71f622250bedbf565e327bd7d7b9d90b567',
    '--artifact-dir',
    '/tmp/rcw-multi-collapse',
    '--private-diagnostics-dir',
    '/proof-private/rcw-multi-collapse',
    '--json',
  ], {});
  assert.deepEqual(parsed, {
    sourceDir: '/tmp/exact-openclaw',
    candidateSha: '7cb9d71f622250bedbf565e327bd7d7b9d90b567',
    artifactDir: '/tmp/rcw-multi-collapse',
    diagnosticsDir: '/proof-private/rcw-multi-collapse',
    json: true,
  });
});

test('grace contract extracts newest/within-grace/stale-queued/running-never and multiplier 2', () => {
  const source = `
const SUPERSEDED_GRACE_MULTIPLIER = 2;
const supersededGraceMs = runtimeConfig.maxDelayMs * SUPERSEDED_GRACE_MULTIPLIER;
export function partitionSupersededWork(works, graceMs, now) {
  // A recovered running member is NEVER supersede-eligible, regardless of staleness
  if (work.status === "running") {
    drive.push(work);
  }
}
// The single newest-elected member always drives (live intent).
// Non-stale members (close bursts) always drive; the newest-elected always drives.
// -1 fold-side write-guard: only \`queued\` members are supersede-eligible.
`;
  const contract = extractGraceContract(source);
  assert.equal(contract.multiplier, 2);
  assert.equal(contract.formulaPresent, true);
  assert.equal(contract.partitionPresent, true);
  assert.equal(contract.newestDrives, true);
  assert.equal(contract.withinGraceOlderDrives, true);
  assert.equal(contract.staleQueuedOlderFolds, true);
  assert.equal(contract.runningNeverFolds, true);
});
