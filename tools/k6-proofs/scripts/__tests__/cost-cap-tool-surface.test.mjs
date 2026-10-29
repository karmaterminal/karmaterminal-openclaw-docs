import test from 'node:test';
import assert from 'node:assert/strict';

import { runToolSurface } from '../run-cost-cap-fixture.mjs';
import {
  INFRA_CONFIG,
  TOOL_SURFACE_TEST_FILE,
  modeledVitestCandidate,
  typedToolSurfaceWithCustody,
  typedToolSurfaceWithTaskFlow,
} from './helpers/modeled-vitest-candidate.mjs';

async function runModeledToolSurface(model) {
  const candidate = await modeledVitestCandidate(model);
  return runToolSurface({
    worktreeDir: candidate.worktree,
    cap: 100,
    vitestExecutable: candidate.vitestScript,
    reportDir: candidate.reportDir,
  });
}

test('R-CW-5 runs the custody typed-tool surface in the database-worker lane', async () => {
  const result = await runModeledToolSurface(typedToolSurfaceWithCustody());
  assert.equal(result.durableStore, 'continuation-custody');
  assert.deepEqual(result.asserted, { typedToolCaptured: true, overCapRejected: true, rejectedHopNoDurableWork: true });
  assert.equal(result.passed, true);
  assert.deepEqual(result.command.slice(0, 7), [
    'OPENCLAW_VITEST_INCLUDE_FILE=<private-include-file>',
    'node', '<candidate-local-vitest>', 'run', '--config', INFRA_CONFIG, TOOL_SURFACE_TEST_FILE,
  ]);
  assert.deepEqual(result.results.files, [TOOL_SURFACE_TEST_FILE]);
  assert.deepEqual(result.results.totals, { tests: 2, passed: 2, failed: 0, skipped: 0, todo: 0 });
});

test('R-CW-5 counts no durable work only beside a passing positive control', async () => {
  const failing = typedToolSurfaceWithCustody();
  failing.suites[TOOL_SURFACE_TEST_FILE][1].status = 'failed';
  const missing = typedToolSurfaceWithCustody();
  missing.suites[TOOL_SURFACE_TEST_FILE] = missing.suites[TOOL_SURFACE_TEST_FILE].slice(0, 1);
  for (const model of [failing, missing]) {
    const result = await runModeledToolSurface(model);
    assert.equal(result.asserted.overCapRejected, true);
    assert.equal(result.asserted.rejectedHopNoDurableWork, false);
    assert.equal(result.passed, false);
  }
});

test('R-CW-5 still runs the TaskFlow typed-tool surface through the auto-reply --dir run', async () => {
  const result = await runModeledToolSurface(typedToolSurfaceWithTaskFlow());
  assert.equal(result.durableStore, 'task-flow');
  assert.deepEqual(result.asserted, { typedToolCaptured: true, overCapRejected: true, rejectedHopNoDurableWork: true });
  assert.equal(result.passed, true);
  assert.ok(result.command.includes('--dir'));
  assert.ok(result.command.includes('test/vitest/vitest.auto-reply.config.ts'));
});

test('R-CW-5 fails the typed-tool surface closed for a candidate with no known durable store', async () => {
  const model = typedToolSurfaceWithCustody();
  model.markers = [];
  const result = await runModeledToolSurface(model);
  assert.equal(result.durableStore, null);
  assert.equal(result.passed, false);
});
