import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
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

function corepackAtNode(node) {
  const prefix = path.resolve(path.dirname(node), '..');
  for (const candidate of [
    path.join(path.dirname(node), 'corepack'),
    path.join(prefix, 'lib/node_modules/corepack/dist/corepack.js'),
  ]) {
    try {
      const resolved = realpathSync(candidate);
      if (lstatSync(resolved).isFile()) return resolved;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return null;
}

export function resolveTrustedCorepack(trustedNode = realpathSync(process.execPath)) {
  const adjacent = corepackAtNode(trustedNode);
  if (adjacent) return adjacent;
  const home = os.userInfo().homedir;
  const roots = [
    path.join(home, '.nvm/versions/node'),
    path.join(home, 'actions-runner/_work/_tool/node'),
  ];
  const candidates = [];
  for (const root of roots) {
    let versions = [];
    try {
      versions = readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
        .reverse();
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    for (const version of versions) {
      candidates.push(path.join(root, version, 'x64/bin/node'));
      candidates.push(path.join(root, version, 'bin/node'));
    }
  }
  for (const candidate of candidates) {
    try {
      const corepack = corepackAtNode(realpathSync(candidate));
      if (corepack) return corepack;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  throw new Error('verifier-controlled Corepack installation is unavailable');
}

function gitIdentity(checkout, env) {
  const head = requireSuccess(execute('git', ['-C', checkout, 'rev-parse', 'HEAD'], { env }),
    'authenticated product HEAD').stdout.trim();
  const tree = requireSuccess(execute('git', ['-C', checkout, 'rev-parse', 'HEAD^{tree}'], { env }),
    'authenticated product tree').stdout.trim();
  const status = requireSuccess(execute('git', [
    '-C', checkout, 'status', '--porcelain', '--untracked-files=all',
  ], { env }), 'authenticated product status').stdout.trim();
  return { head, tree, status };
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
    const initialIdentity = gitIdentity(checkout, cleanEnv);
    if (initialIdentity.head !== candidateSha || initialIdentity.status) {
      throw new Error('authenticated product checkout identity mismatch');
    }

    const packageJson = JSON.parse(readFileSync(path.join(checkout, 'package.json'), 'utf8'));
    const packageManager = String(packageJson.packageManager || '');
    const managerMatch = /^pnpm@([0-9]+\.[0-9]+\.[0-9]+)\+sha512\.[A-Za-z0-9+/=]+$/u.exec(packageManager);
    if (!managerMatch) throw new Error('candidate packageManager must pin pnpm version and sha512');
    const trustedNode = realpathSync(process.execPath);
    const corepack = resolveTrustedCorepack(trustedNode);
    const managerVersion = requireSuccess(execute(trustedNode, [corepack, 'pnpm', '--version'],
      { cwd: checkout, env: cleanEnv }), 'pinned package manager version').stdout.trim();
    if (managerVersion !== managerMatch[1]) throw new Error('executing package manager version mismatch');

    requireSuccess(execute(trustedNode, [corepack,
      'pnpm', 'install', '--frozen-lockfile', '--force', '--ignore-scripts',
    ], { cwd: checkout, env: cleanEnv }), 'authenticated dependency installation');
    const installedIdentity = gitIdentity(checkout, cleanEnv);
    if (installedIdentity.head !== candidateSha ||
        installedIdentity.tree !== initialIdentity.tree ||
        installedIdentity.status) {
      throw new Error('authenticated dependency installation changed product identity');
    }

    const installedGraph = requireSuccess(execute(trustedNode, [corepack,
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
    const result = execute(trustedNode, [
      path.join(checkout, 'scripts/run-vitest.mjs'),
      ...testArgs,
    ], { cwd: checkout, env: cleanEnv });
    const finalIdentity = gitIdentity(checkout, cleanEnv);
    if (finalIdentity.head !== candidateSha ||
        finalIdentity.tree !== initialIdentity.tree ||
        finalIdentity.status ||
        RUNNER_FILES.some((name) =>
          digestFile(path.join(checkout, name)) !== runnerDigests[name])) {
      throw new Error('authenticated product changed during test execution');
    }
    return {
      ...result,
      attestation: {
        schema: 'openclaw.k6.authenticated-test-runtime.v1',
        candidateSha,
        nodeVersion: process.version,
        nodeExecutableSha256: digestFile(trustedNode),
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
