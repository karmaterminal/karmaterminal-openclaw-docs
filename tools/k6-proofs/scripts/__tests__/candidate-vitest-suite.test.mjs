import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  reportedTitleMatches,
  runCandidateVitestSuite,
  selectCandidateVitestConfig,
} from '../lib/candidate-vitest-suite.mjs';
import {
  AUTO_REPLY_CONFIG,
  COST_CAP_SUITE,
  INFRA_CONFIG,
  costCapSuiteAt293c977f62,
  modeledVitestCandidate,
} from './helpers/modeled-vitest-candidate.mjs';

const EXACT_BOUNDARY = 'rejects at exact boundary (accumulatedChainTokens === costCapTokens is NOT over)';
const OWNER_CONFIGS = [INFRA_CONFIG, AUTO_REPLY_CONFIG];

function runSuite(candidate, expectedTests, overrides = {}) {
  return runCandidateVitestSuite({
    worktreeDir: candidate.worktree,
    vitestScript: candidate.vitestScript,
    config: INFRA_CONFIG,
    files: [COST_CAP_SUITE],
    reportPath: path.join(candidate.reportDir, 'suite.json'),
    expectedTests,
    ...overrides,
  });
}

test('a redacted title matches only a name whose hidden span has the marked length', () => {
  const title = 'rejects at exact boundary (accumulatedChainTokens =<redacted len=29>';
  assert.deepEqual(reportedTitleMatches(title, EXACT_BOUNDARY), { matched: true, redacted: true });
  assert.equal(reportedTitleMatches(title, `${EXACT_BOUNDARY}!`).matched, false);
  assert.equal(reportedTitleMatches(title, 'rejects at exact boundary (otherChainTokens === costCapTokens is NOT over)').matched, false);
  assert.deepEqual(reportedTitleMatches(EXACT_BOUNDARY, EXACT_BOUNDARY), { matched: true, redacted: false });
  assert.deepEqual(reportedTitleMatches('allows dispatch', 'allows dispatch.'), { matched: false, redacted: false });
  assert.equal(reportedTitleMatches('a (b) <redacted len=0>', 'a (b) ').matched, false);
  assert.equal(reportedTitleMatches('a.c<redacted len=1>', 'abcd').matched, false);
  assert.equal(reportedTitleMatches(undefined, EXACT_BOUNDARY).matched, false);
});

test('selection names the one owner config whose Vitest collects the suite', async () => {
  const candidate = await modeledVitestCandidate(costCapSuiteAt293c977f62());
  const selection = selectCandidateVitestConfig({
    worktreeDir: candidate.worktree,
    vitestScript: candidate.vitestScript,
    suite: COST_CAP_SUITE,
    ownerConfigs: [...OWNER_CONFIGS, 'test/vitest/vitest.retired.config.ts'],
  });
  assert.equal(selection.config, INFRA_CONFIG);
  assert.deepEqual(selection.probes, [
    { config: INFRA_CONFIG, present: true, exitCode: 0, collected: true, collectedFileCount: 1 },
    { config: AUTO_REPLY_CONFIG, present: true, exitCode: 0, collected: false, collectedFileCount: 0 },
    { config: 'test/vitest/vitest.retired.config.ts', present: false, collected: false },
  ]);
});

test('selection refuses a config that collects other files beside the suite', async () => {
  const model = costCapSuiteAt293c977f62();
  model.configs[INFRA_CONFIG].files.push(`${COST_CAP_SUITE.replace('.test.ts', '')}-copy.test.ts`);
  const candidate = await modeledVitestCandidate(model);
  const selection = selectCandidateVitestConfig({
    worktreeDir: candidate.worktree,
    vitestScript: candidate.vitestScript,
    suite: 'delegate-dispatch.cost-cap-exhaustion',
    ownerConfigs: OWNER_CONFIGS,
  });
  assert.equal(selection.config, null);
  assert.equal(selection.probes[0].collectedFileCount, 2);
});

test('a passing suite reports totals, names, and redaction without host paths', async () => {
  const candidate = await modeledVitestCandidate(costCapSuiteAt293c977f62());
  const result = runSuite(candidate, { exact: [EXACT_BOUNDARY] });
  assert.equal(result.passed, true);
  assert.deepEqual(result.results, {
    reportParsed: true,
    files: [COST_CAP_SUITE],
    totals: { tests: 5, passed: 5, failed: 0, skipped: 0, todo: 0 },
    everyTestPassed: true,
    problems: [],
  });
  assert.deepEqual(result.tests.exact, {
    passed: true,
    name: EXACT_BOUNDARY,
    status: 'passed',
    reportedTitleRedacted: true,
    declaredVerbatimInSuite: true,
  });
});

test('a redacted title counts only if the committed suite declares the full name', async () => {
  const candidate = await modeledVitestCandidate(costCapSuiteAt293c977f62());
  const suiteFile = path.join(candidate.worktree, COST_CAP_SUITE);
  await writeFile(suiteFile, (await readFile(suiteFile, 'utf8')).replace(EXACT_BOUNDARY, 'renamed away'));
  const result = runSuite(candidate, { exact: [EXACT_BOUNDARY] });
  assert.equal(result.passed, false);
  assert.equal(result.tests.exact.declaredVerbatimInSuite, false);
});

test('a contract name that two reported tests match fails closed', async () => {
  const model = costCapSuiteAt293c977f62();
  model.suites[COST_CAP_SUITE].push({ ...model.suites[COST_CAP_SUITE][0] });
  const candidate = await modeledVitestCandidate(model);
  const result = runSuite(candidate, { below: ['allows dispatch when accumulatedChainTokens is 1 below costCapTokens'] });
  assert.equal(result.passed, false);
  assert.deepEqual(result.results.problems, ['below: 2 reported tests matched']);
});

test('two contract keys cannot claim the same reported test', async () => {
  const candidate = await modeledVitestCandidate(costCapSuiteAt293c977f62());
  const name = 'allows dispatch when accumulatedChainTokens is 1 below costCapTokens';
  const result = runSuite(candidate, { first: [name], second: [name] });
  assert.equal(result.tests.first.passed, true);
  assert.equal(result.tests.second.passed, false);
  assert.equal(result.passed, false);
});

test('a failed test anywhere in the file fails the suite', async () => {
  const model = costCapSuiteAt293c977f62();
  model.suites[COST_CAP_SUITE][2] = { ...model.suites[COST_CAP_SUITE][2], status: 'failed' };
  const candidate = await modeledVitestCandidate(model);
  const result = runSuite(candidate, { exact: [EXACT_BOUNDARY] });
  assert.equal(result.tests.exact.passed, true);
  assert.equal(result.results.everyTestPassed, false);
  assert.equal(result.passed, false);
});

test('a run under a config that collects nothing is not a pass', async () => {
  const candidate = await modeledVitestCandidate(costCapSuiteAt293c977f62());
  const result = runSuite(candidate, { exact: [EXACT_BOUNDARY] }, { config: AUTO_REPLY_CONFIG });
  assert.equal(result.exitCode, 0);
  assert.equal(result.passed, false);
  assert.equal(result.results.reportParsed, false);
});

test('a report path that already exists is refused before Vitest runs', async () => {
  const candidate = await modeledVitestCandidate(costCapSuiteAt293c977f62());
  await writeFile(path.join(candidate.reportDir, 'suite.json'), '{"testResults":[]}');
  assert.throws(() => runSuite(candidate, {}), /report path already exists; refusing a stale report/);
  await rm(path.join(candidate.reportDir, 'suite.json'));
  await symlink('/nonexistent/report.json', path.join(candidate.reportDir, 'suite.json'));
  assert.throws(() => runSuite(candidate, {}), /report path already exists; refusing a stale report/);
});
