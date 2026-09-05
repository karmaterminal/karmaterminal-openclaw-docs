import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractGraceContract,
  parseArgs,
  requiredCaseResults,
} from '../run-multi-collapse-fixture.mjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

test('multi-collapse fixture binds an exact product checkout and private result directory', () => {
  assert.deepEqual(parseArgs([
    'node',
    'run-multi-collapse-fixture.mjs',
    '--source-dir',
    '/tmp/openclaw-7cb',
    '--candidate-sha',
    '7cb9d71f622250bedbf565e327bd7d7b9d90b567',
    '--artifact-dir',
    '/tmp/row-result',
    '--json',
  ], {}), {
    sourceDir: '/tmp/openclaw-7cb',
    candidateSha: '7cb9d71f622250bedbf565e327bd7d7b9d90b567',
    artifactDir: '/tmp/row-result',
    json: true,
  });
});

test('multi-collapse contract requires all four behavioral cases and strict grace timing', () => {
  const source = `
const SUPERSEDED_GRACE_MULTIPLIER = 2;
const supersededGraceMs = runtimeConfig.maxDelayMs * SUPERSEDED_GRACE_MULTIPLIER;
export function partitionSupersededWork(works, graceMs, now) {
  // Only \`queued\` backlog members can be coalesced.
  if (work.status === "running") return work;
  const isStale = now - work.dueAt > graceMs;
}
`;
  const tests = `
it("keeps the newest even if it is itself overdue, folds only stale older", () => {});
it("preserves a close burst that is not yet stale (within grace)", () => {});
it("still folds a stale queued member into a newer election (Guard 2 intact)", () => {});
it("never supersedes a recovered running member even when stale and not newest", () => {});
`;
  assert.deepEqual(extractGraceContract(source, tests), {
    multiplier: 2,
    formulaPresent: true,
    partitionPresent: true,
    strictStaleBoundary: true,
    queuedOnly: true,
    tests: {
      newestDrives: true,
      withinGraceOlderDrives: true,
      staleQueuedOlderFolds: true,
      runningNeverFolds: true,
    },
  });
});

test('multi-collapse hostile contract rejects equality-as-stale and missing running guard', () => {
  const contract = extractGraceContract(
    'const SUPERSEDED_GRACE_MULTIPLIER = 2; export function partitionSupersededWork() { const isStale = now - work.dueAt >= graceMs; }',
    '',
  );
  assert.equal(contract.strictStaleBoundary, false);
  assert.equal(contract.queuedOnly, false);
  assert.ok(Object.values(contract.tests).every((present) => present === false));
});

test('multi-collapse receipts require each named test to execute and pass', () => {
  const assertions = [
    ['keeps the newest even if it is itself overdue, folds only stale older', 'passed'],
    ['preserves a close burst that is not yet stale (within grace)', 'passed'],
    ['still folds a stale queued member into a newer election (Guard 2 intact)', 'passed'],
    ['never supersedes a recovered running member even when stale and not newest', 'passed'],
  ].map(([fullName, status]) => ({ fullName: `partitionSupersededWork ${fullName}`, status }));
  const suite = {
    stdout: JSON.stringify({ testResults: [{ assertionResults: assertions }] }),
  };
  assert.deepEqual(requiredCaseResults(suite), {
    newestDrives: true,
    withinGraceOlderDrives: true,
    staleQueuedOlderFolds: true,
    runningNeverFolds: true,
  });
  assertions[2].status = 'skipped';
  suite.stdout = JSON.stringify({ testResults: [{ assertionResults: assertions }] });
  assert.equal(requiredCaseResults(suite).staleQueuedOlderFolds, false);
  assert.ok(Object.values(requiredCaseResults({ stdout: 'not-json' })).every((value) => !value));
});

test('multi-collapse result never publishes raw product stderr', async () => {
  const source = await readFile(
    fileURLToPath(new URL('../run-multi-collapse-fixture.mjs', import.meta.url)),
    'utf8',
  );
  assert.match(source, /stderrSha256/u);
  assert.match(source, /stderrBytes/u);
  assert.doesNotMatch(source, /stderr:\s*suite\.stderr/u);
  assert.doesNotMatch(source, /stdout:\s*suite\.stdout/u);
});
