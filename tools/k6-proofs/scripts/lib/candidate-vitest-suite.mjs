// Candidate Vitest suites for the process-local proof fixtures.
//
// A candidate can move a suite between Vitest configs: fork #1408 L4
// (311bc66fca) moved the continuation delegate-dispatch suites onto real
// custody, into the database-worker-core lane that vitest.infra.config.ts runs
// and vitest.auto-reply.config.ts excludes. Run under the config that no longer
// owns it, Vitest prints "No test files found" and exits 0. So the fixtures ask
// the candidate's own Vitest which of the configs that have owned a suite
// collects it now, and require exactly one.
//
// A green exit and test names on stdout do not show that a contract test ran.
// A skipped test prints its name with exit 0. The candidate's reporter also
// redacts credential-looking spans of a test name, and on stdout a second pass
// swallows the duration after it. So the fixtures read Vitest's JSON report
// instead and require that it lists exactly the selected files, that every
// test in it passed, none skipped or todo and at least one ran, and that
// every contract test passed.
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';

const CHILD_OUTPUT_LIMIT_BYTES = 64 * 1024 * 1024;
const REDACTION_MARKER = /<redacted len=(\d+)>/gu;
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;

/**
 * The environment for a candidate Vitest run: the caller's, without its
 * OPENCLAW_VITEST_* selection knobs, plus `overrides`. The candidate's scoped
 * configs replace their include list with the files an inherited
 * OPENCLAW_VITEST_INCLUDE_FILE names, which would change what the fixture's
 * own selection and run see.
 */
export function candidateVitestEnv(overrides = {}, base = process.env) {
  const env = {};
  for (const [key, value] of Object.entries(base)) {
    if (!key.startsWith('OPENCLAW_VITEST_')) env[key] = value;
  }
  return { ...env, ...overrides };
}

function runNode(script, args, { cwd, env }) {
  try {
    const stdout = execFileSync(process.execPath, [script, ...args], {
      cwd,
      env,
      encoding: 'utf8',
      maxBuffer: CHILD_OUTPUT_LIMIT_BYTES,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, exitCode: 0, stdout };
  } catch (error) {
    return {
      ok: false,
      exitCode: typeof error.status === 'number' ? error.status : 1,
      stdout: error.stdout?.toString() || '',
    };
  }
}

function worktreeRelative(worktreeDir, file) {
  for (const root of new Set([path.resolve(worktreeDir), realpathSync(worktreeDir)])) {
    const relative = path.relative(root, path.resolve(root, file));
    if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
      return relative.split(path.sep).join('/');
    }
  }
  return null;
}

// `vitest list --filesOnly` prints one collected file per line, after a
// `[project] ` prefix when the config names its project.
function listedFiles(worktreeDir, stdout) {
  const files = new Set();
  for (const raw of stripVTControlCharacters(stdout).split('\n')) {
    const line = raw.trim().replace(/^\[[^\]]+\]\s+/u, '');
    if (!TEST_FILE.test(line)) continue;
    files.add(worktreeRelative(worktreeDir, line) ?? line);
  }
  return [...files];
}

/**
 * Pick the one config, of those that have owned `suite`, whose Vitest collects
 * it at this candidate. `config` is null unless exactly one collects exactly
 * that file.
 */
export function selectCandidateVitestConfig({
  worktreeDir,
  vitestScript,
  suite,
  ownerConfigs,
  env = candidateVitestEnv(),
}) {
  const probes = ownerConfigs.map((config) => {
    const configFile = path.join(worktreeDir, config);
    if (!existsSync(configFile) || !lstatSync(configFile).isFile()) {
      return { config, present: false, collected: false };
    }
    const listing = runNode(vitestScript, ['list', '--config', config, '--filesOnly', suite], {
      cwd: worktreeDir,
      env,
    });
    const files = listing.ok ? listedFiles(worktreeDir, listing.stdout) : [];
    return {
      config,
      present: true,
      exitCode: listing.exitCode,
      collected: files.length === 1 && files[0] === suite,
      collectedFileCount: files.length,
    };
  });
  const owners = probes.filter((probe) => probe.collected);
  return { suite, config: owners.length === 1 ? owners[0].config : null, probes };
}

function escapeRegExp(text) {
  return text.replace(/[\\^$.*+?()[\]{}|/]/gu, '\\$&');
}

/**
 * Whether a reported test title is `expected`, allowing for the candidate's
 * reporter having replaced spans with `<redacted len=N>`: each marker stands
 * for exactly N characters of the expected name.
 */
export function reportedTitleMatches(title, expected) {
  if (typeof title !== 'string') return { matched: false, redacted: false };
  if (title === expected) return { matched: true, redacted: false };
  let pattern = '^';
  let consumed = 0;
  let redacted = false;
  for (const marker of title.matchAll(REDACTION_MARKER)) {
    const length = Number(marker[1]);
    if (!Number.isSafeInteger(length) || length < 1) return { matched: false, redacted: true };
    pattern += `${escapeRegExp(title.slice(consumed, marker.index))}[\\s\\S]{${length}}`;
    consumed = marker.index + marker[0].length;
    redacted = true;
  }
  if (!redacted) return { matched: false, redacted: false };
  pattern += `${escapeRegExp(title.slice(consumed))}$`;
  return { matched: new RegExp(pattern).test(expected), redacted: true };
}

function declaresTestName(source, name) {
  return [JSON.stringify(name), `'${name}'`, `\`${name}\``].some((literal) => source.includes(literal));
}

function readReport(reportPath) {
  if (!existsSync(reportPath) || !lstatSync(reportPath).isFile() || lstatSync(reportPath).isSymbolicLink()) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(reportPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Run `files` under `config` and judge Vitest's JSON report.
 *
 * `expectedTests` maps a receipt key to the names its contract test has
 * carried; exactly one reported test must match one of them and pass. A title
 * the candidate's reporter redacted counts only when the committed suite
 * declares the full expected name verbatim.
 */
export function runCandidateVitestSuite({
  worktreeDir,
  vitestScript,
  config,
  files,
  reportPath,
  expectedTests,
  extraArgs = [],
  env = candidateVitestEnv(),
}) {
  if (lstatSync(reportPath, { throwIfNoEntry: false })) {
    throw new Error('candidate Vitest report path already exists; refusing a stale report');
  }
  const args = [
    'run', '--config', config, ...files, ...extraArgs,
    '--reporter=verbose', '--reporter=json', `--outputFile.json=${reportPath}`,
  ];
  const vitestRun = runNode(vitestScript, args, { cwd: worktreeDir, env });
  const report = readReport(reportPath);
  const problems = [];
  if (!vitestRun.ok) problems.push(`vitest exited ${vitestRun.exitCode}`);
  if (!report) problems.push('vitest wrote no readable JSON report');

  const testResults = Array.isArray(report?.testResults) ? report.testResults : [];
  const reportedFiles = testResults.map((result) => worktreeRelative(worktreeDir, String(result?.name ?? '')));
  const assertions = testResults.flatMap((result, fileIndex) =>
    (Array.isArray(result?.assertionResults) ? result.assertionResults : [])
      .map((assertion) => ({ ...assertion, fileIndex })));
  const selectedFiles = [...files].sort();
  const filesExact = reportedFiles.length === selectedFiles.length &&
    [...reportedFiles].sort().every((file, index) => file === selectedFiles[index]);
  if (report && !filesExact) problems.push('report does not list exactly the selected files');
  const totals = {
    tests: assertions.length,
    passed: assertions.filter((assertion) => assertion.status === 'passed').length,
    failed: assertions.filter((assertion) => assertion.status === 'failed').length,
    skipped: assertions.filter((assertion) => ['skipped', 'pending', 'disabled'].includes(assertion.status)).length,
    todo: assertions.filter((assertion) => assertion.status === 'todo').length,
  };
  const everyTestPassed = Boolean(report) &&
    totals.tests > 0 &&
    totals.passed === totals.tests &&
    report.numTotalTests === totals.tests &&
    report.numFailedTests === 0 &&
    report.numPendingTests === 0 &&
    report.numTodoTests === 0 &&
    report.numFailedTestSuites === 0 &&
    testResults.every((result) => result?.status === 'passed');
  if (report && totals.tests === 0) problems.push('no test ran');
  else if (report && !everyTestPassed) {
    problems.push(`not every test passed (${totals.passed}/${totals.tests}, ${totals.skipped} skipped, ${totals.todo} todo)`);
  }

  const sources = new Map();
  const suiteSource = (fileIndex) => {
    if (!sources.has(fileIndex)) {
      const file = reportedFiles[fileIndex];
      sources.set(fileIndex, file ? readFileSync(path.join(worktreeDir, file), 'utf8') : '');
    }
    return sources.get(fileIndex);
  };
  const claimed = new Set();
  const tests = {};
  for (const [key, names] of Object.entries(expectedTests)) {
    const matches = names.flatMap((name) => assertions.flatMap((assertion, index) => {
      const match = reportedTitleMatches(assertion.title, name);
      return match.matched ? [{ name, index, assertion, redacted: match.redacted }] : [];
    }));
    if (matches.length !== 1) {
      problems.push(`${key}: ${matches.length === 0 ? 'no reported test' : `${matches.length} reported tests`} matched`);
      tests[key] = { passed: false, name: null, status: null, reportedTitleRedacted: null, declaredVerbatimInSuite: null };
      continue;
    }
    const [{ name, index, assertion, redacted }] = matches;
    const declaredVerbatimInSuite = redacted ? declaresTestName(suiteSource(assertion.fileIndex), name) : null;
    const unique = !claimed.has(index);
    claimed.add(index);
    const passed = assertion.status === 'passed' && unique && declaredVerbatimInSuite !== false;
    if (!passed) problems.push(`${key}: matched test did not pass this check`);
    tests[key] = {
      passed,
      name,
      status: typeof assertion.status === 'string' ? assertion.status : null,
      reportedTitleRedacted: redacted,
      declaredVerbatimInSuite,
    };
  }

  return {
    passed: vitestRun.ok && filesExact && everyTestPassed && Object.values(tests).every((test) => test.passed),
    exitCode: vitestRun.exitCode,
    args,
    results: {
      reportParsed: Boolean(report),
      files: reportedFiles,
      totals,
      everyTestPassed,
      problems,
    },
    tests,
  };
}
