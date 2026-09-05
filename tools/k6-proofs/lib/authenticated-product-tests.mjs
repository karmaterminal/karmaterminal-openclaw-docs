import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { withoutGitControlVariables } from './git-execution-environment.mjs';

const RUNNER_FILES = [
  'scripts/run-vitest.mjs',
  'scripts/run-vitest-child.mts',
  'scripts/lib/tsx-cli-shim.mjs',
];

function digestFile(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

export function sourceVitestMatchesAuthenticated(sourceVitest, installedVitest) {
  return existsSync(sourceVitest) &&
    lstatSync(sourceVitest).isFile() &&
    digestFile(sourceVitest) === digestFile(installedVitest);
}

function execute(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 100 * 1024 * 1024,
    env: withoutGitControlVariables(options.env),
    ...options,
  });
}

function requireSuccess(result, label) {
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} failed (${result.status}): ${(result.stderr || '').trim()}`);
  }
  return result;
}

export function runAuthenticatedVitest({
  sourceDir,
  candidateSha,
  testArgs,
  artifactDir,
  env = process.env,
}) {
  const cleanEnv = withoutGitControlVariables(env);
  const checkout = mkdtempSync(path.join(path.resolve(artifactDir, '..'), '.authenticated-product-'));
  try {
    requireSuccess(execute('git', ['clone', '--quiet', '--local', '--no-hardlinks', sourceDir, checkout],
      { env: cleanEnv }), 'authenticated product clone');
    requireSuccess(execute('git', ['-C', checkout, 'checkout', '--quiet', '--detach', candidateSha],
      { env: cleanEnv }), 'authenticated product checkout');
    const head = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'],
      { encoding: 'utf8', env: cleanEnv }).trim();
    if (head !== candidateSha) throw new Error('authenticated product checkout identity mismatch');

    const packageJson = JSON.parse(readFileSync(path.join(checkout, 'package.json'), 'utf8'));
    const packageManager = String(packageJson.packageManager || '');
    const managerMatch = /^pnpm@([0-9]+\.[0-9]+\.[0-9]+)\+sha512\.[A-Za-z0-9+/=]+$/u.exec(packageManager);
    if (!managerMatch) throw new Error('candidate packageManager must pin pnpm version and sha512');
    const corepack = realpathSync(cleanEnv.OPENCLAW_COREPACK_BIN ||
      path.join(path.dirname(realpathSync(process.execPath)), 'corepack'));
    const managerVersion = requireSuccess(execute(corepack, ['pnpm', '--version'],
      { cwd: checkout, env: cleanEnv }), 'pinned package manager version').stdout.trim();
    if (managerVersion !== managerMatch[1]) throw new Error('executing package manager version mismatch');

    requireSuccess(execute(corepack, [
      'pnpm', 'install', '--frozen-lockfile', '--force', '--ignore-scripts',
    ], { cwd: checkout, env: cleanEnv }), 'authenticated dependency installation');
    const changedTrackedFiles = requireSuccess(execute('git', [
      '-C', checkout, 'status', '--porcelain', '--untracked-files=no',
    ], { env: cleanEnv }), 'authenticated product post-install identity').stdout.trim();
    if (changedTrackedFiles) {
      throw new Error('authenticated dependency installation modified tracked product bytes');
    }

    const installedGraph = requireSuccess(execute(corepack, [
      'pnpm', 'list', '--json', '--depth', 'Infinity',
    ], { cwd: checkout, env: cleanEnv }), 'installed dependency graph');
    const installedVitest = path.join(checkout, 'node_modules/.bin/vitest');
    if (!existsSync(installedVitest) || !lstatSync(installedVitest).isFile()) {
      throw new Error('authenticated Vitest executable is missing or wrong-type');
    }
    const sourceVitest = path.join(sourceDir, 'node_modules/.bin/vitest');
    if (existsSync(sourceVitest) &&
        !sourceVitestMatchesAuthenticated(sourceVitest, installedVitest)) {
      throw new Error('source checkout contains an unauthenticated Vitest executable');
    }

    const runnerDigests = Object.fromEntries(RUNNER_FILES.map((name) => [
      name,
      digestFile(path.join(checkout, name)),
    ]));
    const result = execute(process.execPath, [
      path.join(checkout, 'scripts/run-vitest.mjs'),
      ...testArgs,
    ], { cwd: checkout, env: cleanEnv });
    return {
      ...result,
      attestation: {
        schema: 'openclaw.k6.authenticated-test-runtime.v1',
        candidateSha,
        nodeVersion: process.version,
        nodeExecutableSha256: digestFile(realpathSync(process.execPath)),
        corepackSha256: digestFile(corepack),
        packageManager,
        lockfileSha256: digestFile(path.join(checkout, 'pnpm-lock.yaml')),
        dependencyGraphSha256: createHash('sha256').update(installedGraph.stdout).digest('hex'),
        vitestShimSha256: digestFile(installedVitest),
        runnerDigests,
      },
    };
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
}
