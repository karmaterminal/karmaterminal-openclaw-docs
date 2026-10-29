// A modeled candidate Vitest CLI for the fixtures' suite selection and result
// checks, run offline in place of the candidate's real Vitest.
//
// It reproduces the I/O of the candidate's Vitest 5.0.5, captured at exact
// candidate 293c977f629f872a643fb94892603310b887293b:
//   - `list --config C --filesOnly F` prints `[project] file` for each file C
//     collects and exits 0, printing nothing when C collects none;
//   - `run --config C F` under a config that collects nothing prints
//     "No test files found, exiting with code 0" and exits 0;
//   - verbose lines mark passed, failed and skipped tests ✓, × and ↓, and a
//     skipped test still prints its name and exits 0;
//   - the JSON report (`--outputFile.json=P`) lists each file with its
//     assertionResults, and a skipped test is `skipped` and counted pending;
//   - the candidate's reporter redacts a credential-looking span of a test
//     name to `<redacted len=N>` in the report, and on stdout a second pass
//     also swallows the duration after it.
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const COST_CAP_SUITE = 'src/auto-reply/continuation/delegate-dispatch.cost-cap-exhaustion.test.ts';
export const INFRA_CONFIG = 'test/vitest/vitest.infra.config.ts';
export const AUTO_REPLY_CONFIG = 'test/vitest/vitest.auto-reply.config.ts';

const COST_CAP_DESCRIBE = ['cost-cap exhaustion mid-chain'];
const EXACT_BOUNDARY = 'rejects at exact boundary (accumulatedChainTokens === costCapTokens is NOT over)';

function costCapTests(failedRecordName) {
  return [
    { name: 'allows dispatch when accumulatedChainTokens is 1 below costCapTokens' },
    { name: 'rejects dispatch when accumulatedChainTokens exceeds costCapTokens by 1' },
    { name: 'rejects all remaining queued delegates once cost cap is crossed' },
    { name: failedRecordName },
    { name: EXACT_BOUNDARY },
  ].map((test) => ({ ancestorTitles: COST_CAP_DESCRIBE, status: 'passed', ...test }));
}

/**
 * The cost-cap suite as exact candidate 293c977f62 runs it: in the
 * database-worker-core lane of the infra config (fork 311bc66fca), with the
 * failed-record test renamed onto custody and the exact-boundary name redacted.
 */
export function costCapSuiteAt293c977f62() {
  return {
    configs: {
      [INFRA_CONFIG]: { project: 'infra', files: [COST_CAP_SUITE], includeFile: true, passWithNoTests: true },
      [AUTO_REPLY_CONFIG]: { project: 'auto-reply', files: [], passWithNoTests: true },
    },
    suites: {
      [COST_CAP_SUITE]: costCapTests('marks custody records as failed for cost-cap-rejected delegates').map((test) =>
        test.name === EXACT_BOUNDARY
          ? {
            ...test,
            title: 'rejects at exact boundary (accumulatedChainTokens =<redacted len=29>',
            stdoutTitle: 'rejects at exact boundary (accumulatedChainTokens =<redacted len=24>',
          }
          : test),
    },
  };
}

/** The same suite before 311bc66fca: auto-reply shard, TaskFlow name, no redaction. */
export function costCapSuiteBefore311bc66fca() {
  return {
    configs: {
      [INFRA_CONFIG]: { project: 'infra', files: [], passWithNoTests: true },
      [AUTO_REPLY_CONFIG]: { project: 'auto-reply', files: [COST_CAP_SUITE], passWithNoTests: true },
    },
    suites: {
      [COST_CAP_SUITE]: costCapTests('marks TaskFlow records as failed for cost-cap-rejected delegates'),
    },
  };
}

const MODELED_VITEST_CLI = `#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const model = JSON.parse(readFileSync(path.join(process.cwd(), 'modeled-vitest.json'), 'utf8'));
const [command, ...rest] = process.argv.slice(2);
const configPath = rest[rest.indexOf('--config') + 1];
const config = model.configs[configPath];
if (rest.indexOf('--config') === -1 || !config) {
  console.error('modeled vitest: unknown config ' + configPath);
  process.exit(1);
}
const filters = rest.filter((arg, index) => !arg.startsWith('-') && rest[index - 1] !== '--config');
const selected = config.files.filter((file) => filters.length === 0 || filters.some((filter) => file.includes(filter)));
if (command === 'list') {
  for (const file of selected) console.log(config.project ? '[' + config.project + '] ' + file : file);
  process.exit(0);
}
if (command !== 'run') {
  console.error('modeled vitest: unsupported command ' + command);
  process.exit(1);
}
console.log('\\n RUN  v5.0.5 ' + process.cwd() + '\\n');
if (selected.length === 0) {
  console.log('No test files found, exiting with code ' + (config.passWithNoTests ? 0 : 1) + '\\n');
  console.log('filter: ' + filters.join(' '));
  process.exit(config.passWithNoTests ? 0 : 1);
}
const label = config.project ? '|' + config.project + '| ' : '';
const marks = { passed: '✓', failed: '×', skipped: '↓', todo: '↓' };
const testResults = selected.map((file) => {
  const tests = model.suites[file] ?? [];
  for (const test of tests) {
    const title = test.stdoutTitle ?? test.title ?? test.name;
    const duration = test.status === 'passed' && !test.stdoutTitle ? ' 1000ms' : '';
    console.log(' ' + marks[test.status] + ' ' + label + file + ' > ' + [...test.ancestorTitles, title].join(' > ') + duration);
  }
  const empty = tests.length === 0;
  return {
    assertionResults: tests.map((test) => ({
      ancestorTitles: test.ancestorTitles,
      fullName: [...test.ancestorTitles, test.title ?? test.name].join(' '),
      status: test.status,
      title: test.title ?? test.name,
      duration: 1000,
      failureMessages: test.status === 'failed' ? ['AssertionError: modeled failure'] : [],
      meta: {},
      tags: [],
      benchmarks: [],
    })),
    name: path.join(process.cwd(), file),
    status: tests.some((test) => test.status === 'failed') || (empty && !config.passWithNoTests) ? 'failed' : 'passed',
    message: empty && !config.passWithNoTests ? 'No test suite found in file ' + path.join(process.cwd(), file) : '',
  };
});
const all = testResults.flatMap((result) => result.assertionResults);
const count = (...statuses) => all.filter((test) => statuses.includes(test.status)).length;
const failedSuites = testResults.filter((result) => result.status === 'failed').length;
console.log('\\n Test Files  ' + (failedSuites ? failedSuites + ' failed' : testResults.length + ' passed') + ' (' + testResults.length + ')');
console.log('      Tests  ' + (all.length === 0 ? 'no tests' : count('passed') + ' passed' + (count('skipped') ? ' | ' + count('skipped') + ' skipped' : '') + ' (' + all.length + ')'));
const outputFile = rest.find((arg) => arg.startsWith('--outputFile.json='));
if (outputFile) {
  writeFileSync(outputFile.slice('--outputFile.json='.length), JSON.stringify({
    numTotalTestSuites: testResults.length,
    numPassedTestSuites: testResults.length - failedSuites,
    numFailedTestSuites: failedSuites,
    numPendingTestSuites: 0,
    numTotalTests: all.length,
    numPassedTests: count('passed'),
    numFailedTests: count('failed'),
    numPendingTests: count('skipped', 'pending'),
    numTodoTests: count('todo'),
    snapshot: {},
    startTime: 0,
    success: failedSuites === 0 && count('failed') === 0,
    testResults,
  }));
}
process.exit(failedSuites || count('failed') ? 1 : 0);
`;

/**
 * A candidate worktree holding the modeled suites and configs, with the
 * modeled Vitest CLI at `vitestScript`. Each suite's source declares its tests
 * by their full, unredacted names.
 */
export async function modeledVitestCandidate(model) {
  const worktree = await mkdtemp(path.join(os.tmpdir(), 'modeled-vitest-candidate-'));
  await writeFile(path.join(worktree, 'modeled-vitest.json'), `${JSON.stringify(model, null, 2)}\n`);
  for (const config of Object.keys(model.configs)) {
    await mkdir(path.dirname(path.join(worktree, config)), { recursive: true });
    await writeFile(path.join(worktree, config), '// modeled Vitest config\n');
  }
  for (const [file, tests] of Object.entries(model.suites)) {
    await mkdir(path.dirname(path.join(worktree, file)), { recursive: true });
    const declarations = tests.map((test) => `  it(${JSON.stringify(test.name)}, async () => {});`);
    await writeFile(
      path.join(worktree, file),
      `describe(${JSON.stringify(tests[0]?.ancestorTitles?.[0] ?? 'suite')}, () => {\n${declarations.join('\n')}\n});\n`,
    );
  }
  const vitestScript = path.join(worktree, 'modeled-vitest.mjs');
  await writeFile(vitestScript, MODELED_VITEST_CLI);
  const reportDir = await mkdtemp(path.join(os.tmpdir(), 'modeled-vitest-reports-'));
  return { worktree, vitestScript, reportDir };
}
