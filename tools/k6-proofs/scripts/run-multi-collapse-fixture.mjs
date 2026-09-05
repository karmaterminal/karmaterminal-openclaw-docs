#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  assertCanonicalGitCheckout,
  withoutGitControlVariables,
} from '../lib/git-execution-environment.mjs';
import { runAuthenticatedVitest } from '../lib/authenticated-product-tests.mjs';

const ROW = 'R-CW-MULTI-COLLAPSE';
const DISPATCH = 'src/auto-reply/continuation/work-dispatch.ts';
const CLASSIFICATION_TEST =
  'src/auto-reply/continuation/work-dispatch.classification-and-cap.test.ts';
const REQUIRED_CASES = {
  newestDrives: 'keeps the newest even if it is itself overdue, folds only stale older',
  withinGraceOlderDrives: 'preserves a close burst that is not yet stale (within grace)',
  staleQueuedOlderFolds: 'still folds a stale queued member into a newer election (Guard 2 intact)',
  runningNeverFolds: 'never supersedes a recovered running member even when stale and not newest',
};

function usage() {
  return `Usage: node tools/k6-proofs/scripts/run-multi-collapse-fixture.mjs \\
  --source-dir <exact-candidate-worktree> \\
  --candidate-sha <40-hex-sha> \\
  --artifact-dir <safe-output-dir> [--json]`;
}

export function parseArgs(argv, env = process.env) {
  const args = {
    sourceDir: env.OPENCLAW_RCW_MULTI_COLLAPSE_SOURCE_DIR || '',
    candidateSha: env.OPENCLAW_CANDIDATE_SHA || '',
    artifactDir: env.OPENCLAW_RCW_MULTI_COLLAPSE_ARTIFACT_DIR || '',
    json: false,
  };
  for (let index = 2; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help') return { help: true };
    if (argument === '--json') {
      args.json = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value`);
    if (argument === '--source-dir') args.sourceDir = value;
    else if (argument === '--candidate-sha') args.candidateSha = value;
    else if (argument === '--artifact-dir') args.artifactDir = value;
    else throw new Error(`unexpected argument: ${argument}`);
    index += 1;
  }
  return args;
}

function run(command, args, options = {}) {
  try {
    const stdout = execFileSync(command, args, {
      ...options,
      env: withoutGitControlVariables(options.env),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, exitCode: 0, stdout, stderr: '' };
  } catch (error) {
    return {
      ok: false,
      exitCode: typeof error.status === 'number' ? error.status : 1,
      stdout: error.stdout?.toString() || '',
      stderr: error.stderr?.toString() || error.message,
    };
  }
}

function git(sourceDir, args) {
  const result = run('git', ['-C', sourceDir, ...args]);
  if (!result.ok) throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

export function extractGraceContract(sourceText, testText) {
  const multiplier = sourceText.match(/const SUPERSEDED_GRACE_MULTIPLIER = (\d+)/u);
  const tests = Object.fromEntries(
    Object.entries(REQUIRED_CASES).map(([name, title]) => [name, testText.includes(`it("${title}"`)]),
  );
  return {
    multiplier: multiplier ? Number(multiplier[1]) : null,
    formulaPresent: /maxDelayMs \* SUPERSEDED_GRACE_MULTIPLIER/u.test(sourceText),
    partitionPresent: /export function partitionSupersededWork\(/u.test(sourceText),
    strictStaleBoundary: /now - work\.dueAt > graceMs/u.test(sourceText),
    queuedOnly: /work\.status === "running"/u.test(sourceText) &&
      /Only `queued` backlog members can be coalesced/u.test(sourceText),
    tests,
  };
}

function assertSource(args) {
  if (!args.sourceDir) throw new Error('--source-dir is required');
  if (!args.artifactDir) throw new Error('--artifact-dir is required');
  if (!/^[0-9a-f]{40}$/u.test(args.candidateSha)) {
    throw new Error('--candidate-sha must be a 40-character lowercase SHA');
  }
  const sourceDir = assertCanonicalGitCheckout(args.sourceDir, git);
  for (const file of [DISPATCH, CLASSIFICATION_TEST, 'package.json']) {
    if (!existsSync(path.join(sourceDir, file))) throw new Error(`source dir is missing ${file}`);
  }
  const sourceHead = git(sourceDir, ['rev-parse', 'HEAD']);
  if (sourceHead !== args.candidateSha) {
    throw new Error(`candidate/source mismatch: requested ${args.candidateSha}, source is ${sourceHead}`);
  }
  const sourceStatus = git(sourceDir, ['status', '--porcelain', '--untracked-files=all']);
  if (sourceStatus) throw new Error('exact-candidate source checkout must be clean');
  const tree = git(sourceDir, ['rev-parse', 'HEAD^{tree}']);
  const contract = extractGraceContract(
    readFileSync(path.join(sourceDir, DISPATCH), 'utf8'),
    readFileSync(path.join(sourceDir, CLASSIFICATION_TEST), 'utf8'),
  );
  if (contract.multiplier !== 2 ||
      !contract.formulaPresent ||
      !contract.partitionPresent ||
      !contract.strictStaleBoundary ||
      !contract.queuedOnly ||
      Object.values(contract.tests).some((present) => !present)) {
    throw new Error('exact product collapse contract or one of its four hostile cases is missing');
  }
  return { sourceDir, sourceHead, sourceStatus, tree, contract };
}

function runClassificationSuite(sourceDir, candidateSha, artifactDir, env) {
  const result = runAuthenticatedVitest({
    sourceDir,
    candidateSha,
    artifactDir,
    env,
    testArgs: [
    '--config',
    'test/vitest/vitest.auto-reply.config.ts',
    CLASSIFICATION_TEST,
    '-t',
    'partitionSupersededWork',
    '--reporter=json',
    ],
  });
  return {
    ...result,
    ok: result.status === 0 && !result.error,
    exitCode: typeof result.status === 'number' ? result.status : 1,
  };
}

export function requiredCaseResults(suite) {
  try {
    const report = JSON.parse(suite.stdout);
    const assertions = (report.testResults || []).flatMap((result) => result.assertionResults || []);
    return Object.fromEntries(Object.entries(REQUIRED_CASES).map(([name, title]) => {
      const matches = assertions.filter((assertion) => assertion.fullName?.includes(title));
      return [name, matches.length === 1 && matches[0].status === 'passed'];
    }));
  } catch {
    return Object.fromEntries(Object.keys(REQUIRED_CASES).map((name) => [name, false]));
  }
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

export async function main(argv = process.argv, env = process.env) {
  const args = parseArgs(argv, env);
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  const source = assertSource(args);
  const maxDelayMs = Number(env.OPENCLAW_RCW_MULTI_COLLAPSE_MAX_DELAY_MS || 5_000);
  if (!Number.isInteger(maxDelayMs) || maxDelayMs <= 0) {
    throw new Error('OPENCLAW_RCW_MULTI_COLLAPSE_MAX_DELAY_MS must be a positive integer');
  }
  const graceMs = maxDelayMs * source.contract.multiplier;
  const suite = runClassificationSuite(
    source.sourceDir,
    args.candidateSha,
    args.artifactDir,
    env,
  );
  const afterHead = git(source.sourceDir, ['rev-parse', 'HEAD']);
  const afterTree = git(source.sourceDir, ['rev-parse', 'HEAD^{tree}']);
  const afterStatus = git(source.sourceDir, ['status', '--porcelain', '--untracked-files=all']);
  const baselineRestored = afterHead === source.sourceHead &&
    afterTree === source.tree &&
    afterStatus === source.sourceStatus;
  const executedCases = requiredCaseResults(suite);
  const receipts = {
    'newest-drives': source.contract.tests.newestDrives && executedCases.newestDrives && suite.ok,
    'within-grace-older-drives':
      source.contract.tests.withinGraceOlderDrives && executedCases.withinGraceOlderDrives && suite.ok,
    'stale-queued-older-folds':
      source.contract.tests.staleQueuedOlderFolds && executedCases.staleQueuedOlderFolds && suite.ok,
    'running-never-folds':
      source.contract.tests.runningNeverFolds && executedCases.runningNeverFolds && suite.ok,
    'baseline-restored': baselineRestored,
  };
  const passed = Object.values(receipts).every(Boolean);
  const result = {
    schema: 'openclaw.k6.process-local-result.v1',
    rowId: ROW,
    classification: 'process-local',
    candidateSha: args.candidateSha,
    sourceTree: source.tree,
    maxDelayMs,
    graceMultiplier: source.contract.multiplier,
    graceMs,
    graceFormula: 'maxDelayMs * SUPERSEDED_GRACE_MULTIPLIER',
    boundary: 'within grace when now - dueAt <= graceMs; stale only when greater',
    tests: REQUIRED_CASES,
    receipts,
    suite: {
      ok: suite.ok,
      exitCode: suite.exitCode,
      requiredCases: executedCases,
      stdoutBytes: Buffer.byteLength(suite.stdout),
      stdoutSha256: createHash('sha256').update(suite.stdout).digest('hex'),
      stderrBytes: Buffer.byteLength(suite.stderr),
      stderrSha256: createHash('sha256').update(suite.stderr).digest('hex'),
      authenticatedRuntime: suite.attestation,
    },
    verdict: passed ? 'PASS-candidate' : 'FAIL-candidate',
    diagnosticOnly: true,
  };
  mkdirSync(args.artifactDir, { recursive: true });
  writeJson(path.join(args.artifactDir, 'row-result.json'), result);
  if (args.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else process.stdout.write(`[${ROW}] ${result.verdict}\n`);
  return passed ? 0 : 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}
