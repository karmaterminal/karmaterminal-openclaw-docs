#!/usr/bin/env node
/**
 * Isolated R-CW-5 cost-cap fixture.
 *
 * This fixture deliberately does not write OpenClaw config, state, or a
 * workspace.  It runs the exact candidate's production continuation module
 * plus the dispatch boundary suite from a source-only worktree.  That gives
 * the proof harness a deterministic below/equal/over boundary and a
 * no-spawn assertion without changing a fleet gateway.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import {
  parseExactPnpmPackageManager,
  resolvePinnedPnpmFromNodeModules,
  verifyPnpmLockProvenance,
} from '../lib/pnpm-provenance.mjs';

const DEFAULT_CAP = 100;
const CHILD_OUTPUT_LIMIT_BYTES = 64 * 1024 * 1024;
const TRUSTED_GIT = '/usr/bin/git';
const SOURCE_MARKERS = [
  'src/auto-reply/continuation/scheduler.ts',
  'src/auto-reply/continuation/delegate-dispatch.cost-cap-exhaustion.test.ts',
  'package.json',
  'pnpm-lock.yaml',
];
const TOOL_SURFACE_TEMPLATE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../fixtures/r-cw-5/cost-cap-tool-surface.test.ts',
);

function usage() {
  return `Usage: node tools/k6-proofs/scripts/run-cost-cap-fixture.mjs \\
  --source-dir <exact-candidate-worktree> \\
  --candidate-sha <40-hex-sha> \\
  --pnpm-node-modules <preinstalled-pnpm-node_modules> \\
  --artifact-dir <safe-output-dir> [--cap <positive-int>] [--json]`;
}

export function parseArgs(argv, env = process.env) {
  const args = {
    sourceDir: env.OPENCLAW_RCW5_SOURCE_DIR || '',
    candidateSha: env.OPENCLAW_CANDIDATE_SHA || '',
    packageManagerRoot: env.OPENCLAW_RCW5_PNPM_NODE_MODULES || '',
    artifactDir: env.OPENCLAW_RCW5_ARTIFACT_DIR || '',
    cap: Number(env.OPENCLAW_RCW5_CAP || DEFAULT_CAP),
    json: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help') return { help: true };
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    const next = () => {
      const value = argv[++i];
      if (!value) throw new Error(`${arg} requires a value`);
      return value;
    };
    if (arg === '--source-dir') args.sourceDir = next();
    else if (arg === '--candidate-sha') args.candidateSha = next();
    else if (arg === '--pnpm-node-modules') args.packageManagerRoot = next();
    else if (arg === '--artifact-dir') args.artifactDir = next();
    else if (arg === '--cap') args.cap = Number(next());
    else throw new Error(`unexpected argument: ${arg}`);
  }
  return args;
}

function assertArgs(args) {
  if (!args.sourceDir) throw new Error('--source-dir or OPENCLAW_RCW5_SOURCE_DIR is required');
  if (!args.packageManagerRoot) {
    throw new Error(
      '--pnpm-node-modules or OPENCLAW_RCW5_PNPM_NODE_MODULES is required; package-manager download is forbidden',
    );
  }
  if (!args.artifactDir) throw new Error('--artifact-dir or OPENCLAW_RCW5_ARTIFACT_DIR is required');
  if (!/^[0-9a-f]{40}$/u.test(args.candidateSha)) {
    throw new Error('--candidate-sha or OPENCLAW_CANDIDATE_SHA must be a 40-character lowercase SHA');
  }
  if (!Number.isInteger(args.cap) || args.cap < 2) throw new Error('--cap must be an integer of at least 2');
}

function run(command, args, options) {
  try {
    const stdout = execFileSync(command, args, {
      ...options,
      encoding: 'utf8',
      maxBuffer: CHILD_OUTPUT_LIMIT_BYTES,
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

function trustedGitEnv() {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith('GIT_')) env[key] = value;
  }
  return {
    ...env,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_NO_REPLACE_OBJECTS: '1',
    GIT_TERMINAL_PROMPT: '0',
  };
}

export function assertSafeLocalGitConfig(repositoryDir) {
  const unsafe = runGit([
    '-C',
    repositoryDir,
    'config',
    '--local',
    '--no-includes',
    '--name-only',
    '--get-regexp',
    '^(filter\\.|include\\.|includeif\\.|core\\.attributesfile$)',
  ]);
  if (unsafe.ok && unsafe.stdout.trim()) {
    throw new Error(`candidate repository has unsafe local Git configuration: ${unsafe.stdout.trim()}`);
  }
  if (!unsafe.ok && unsafe.exitCode !== 1) {
    throw new Error(`cannot inspect candidate local Git configuration: ${unsafe.stderr.trim()}`);
  }
}

function preparePrivateWorktreeDirectory(worktreeDir, relativePath) {
  const root = realpathSync(worktreeDir);
  const directory = path.resolve(root, relativePath);
  if (!isInside(directory, root)) throw new Error(`private fixture path escapes worktree: ${relativePath}`);
  let current = root;
  for (const component of path.relative(root, directory).split(path.sep)) {
    if (!component) continue;
    current = path.join(current, component);
    try {
      const stats = lstatSync(current);
      if (!stats.isDirectory() || stats.isSymbolicLink()) {
        throw new Error(`private fixture path contains a non-directory or symlink: ${relativePath}`);
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      mkdirSync(current, { mode: 0o700 });
    }
  }
  if (!isInside(realpathSync(directory), root)) {
    throw new Error(`private fixture path resolves outside worktree: ${relativePath}`);
  }
  return directory;
}

function assertReservedPathAbsent(worktreeDir, relativePath) {
  const reservedPath = path.join(worktreeDir, relativePath);
  try {
    lstatSync(reservedPath);
    throw new Error(`candidate tree already contains reserved fixture path: ${relativePath}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

export function privatePackageManagerEnv(worktreeDir) {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!/^(?:npm|pnpm|corepack)_/iu.test(key)) env[key] = value;
  }
  const reservedPaths = [
    '.r-cw-5-home',
    '.r-cw-5-cache',
    '.r-cw-5-config',
    '.r-cw-5-data',
    '.r-cw-5-state',
  ];
  for (const reservedPath of reservedPaths) assertReservedPathAbsent(worktreeDir, reservedPath);
  const privateHome = preparePrivateWorktreeDirectory(worktreeDir, reservedPaths[0]);
  const privateCache = preparePrivateWorktreeDirectory(worktreeDir, reservedPaths[1]);
  const privateConfig = preparePrivateWorktreeDirectory(worktreeDir, reservedPaths[2]);
  const privateData = preparePrivateWorktreeDirectory(worktreeDir, reservedPaths[3]);
  const privateState = preparePrivateWorktreeDirectory(worktreeDir, reservedPaths[4]);
  const npmUserConfig = path.join(privateConfig, 'npm-user.rc');
  const npmGlobalConfig = path.join(privateConfig, 'npm-global.rc');
  writeFileSync(npmUserConfig, '', { flag: 'a', mode: 0o600 });
  writeFileSync(npmGlobalConfig, '', { flag: 'a', mode: 0o600 });
  return {
    ...env,
    HOME: privateHome,
    PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`,
    XDG_CACHE_HOME: privateCache,
    XDG_CONFIG_HOME: privateConfig,
    XDG_DATA_HOME: privateData,
    XDG_STATE_HOME: privateState,
    NPM_CONFIG_CACHE: path.join(privateCache, 'npm'),
    NPM_CONFIG_GLOBALCONFIG: npmGlobalConfig,
    NPM_CONFIG_USERCONFIG: npmUserConfig,
    PNPM_HOME: path.join(privateData, 'pnpm-home'),
  };
}

function runGit(args, options = {}) {
  if (!existsSync(TRUSTED_GIT) || !lstatSync(TRUSTED_GIT).isFile()) {
    throw new Error(`trusted git executable is unavailable: ${TRUSTED_GIT}`);
  }
  return run(
    TRUSTED_GIT,
    ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', ...args],
    { ...options, env: trustedGitEnv() },
  );
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function gitHead(sourceDir) {
  const result = runGit(['-C', sourceDir, 'rev-parse', 'HEAD']);
  if (!result.ok) throw new Error(`cannot resolve source HEAD: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function fileSha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function isInside(child, parent) {
  const relative = path.relative(parent, child);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

function requireCandidatePackageManager(worktreeDir) {
  const packageJson = JSON.parse(readFileSync(path.join(worktreeDir, 'package.json'), 'utf8'));
  return parseExactPnpmPackageManager(packageJson?.packageManager, {
    requireIntegrity: true,
  });
}

export function resolvePinnedPnpm(worktreeDir, packageManagerRoot) {
  const manager = requireCandidatePackageManager(worktreeDir);
  const packageManagerEnv = privatePackageManagerEnv(worktreeDir);
  const resolved = resolvePinnedPnpmFromNodeModules({
    candidatePackageManager: manager,
    candidateLock: readFileSync(path.join(worktreeDir, 'pnpm-lock.yaml'), 'utf8'),
    nodeModulesDir: packageManagerRoot,
    runVersion: (executable) => {
      const result = run(executable, ['--version'], {
        cwd: worktreeDir,
        env: packageManagerEnv,
      });
      if (!result.ok) {
        throw new Error(`cannot execute candidate-pinned pnpm: ${result.stderr.trim()}`);
      }
      return result.stdout.trim();
    },
  });
  return {
    packageManager: resolved.packageManager,
    pnpmVersion: resolved.pnpmVersion,
    pnpmIntegritySha512: resolved.pnpmIntegritySha512,
    pnpmScript: resolved.executable,
    packageManagerExecutableSha256: resolved.executableSha256,
    packageManagerMetadataSha256: resolved.metadataLockSha256,
    nativePackage: resolved.nativePackage,
    nativePackageIntegrity: resolved.nativePackageIntegrity,
    packageManagerEnv,
  };
}

function resolveCandidateLocalExecutable(worktreeDir, name) {
  const nodeModules = realpathSync(path.join(worktreeDir, 'node_modules'));
  const bin = path.join(worktreeDir, 'node_modules', '.bin', name);
  if (!existsSync(bin)) throw new Error(`candidate-local ${name} executable is missing after frozen install`);
  const executable = realpathSync(bin);
  if (!isInside(executable, nodeModules)) {
    throw new Error(`candidate-local ${name} executable resolves outside disposable node_modules`);
  }
  return executable;
}

function trackedSourceStatus(sourceDir) {
  const result = runGit(['-C', sourceDir, 'status', '--porcelain', '--untracked-files=no']);
  if (!result.ok) throw new Error(`cannot inspect tracked source state: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

export function assertTrackedSourceClean(sourceDir, phase) {
  const status = trackedSourceStatus(sourceDir);
  if (status) {
    throw new Error(
      `candidate source has tracked staged or unstaged changes before ${phase}; refusing exact-source certification`,
    );
  }
}

function blobObjectId(content, objectFormat) {
  const header = Buffer.from(`blob ${content.length}\0`);
  return createHash(objectFormat).update(header).update(content).digest('hex');
}

export function assertTrackedTreeBytes(worktreeDir, candidateSha, phase) {
  const format = runGit(['-C', worktreeDir, 'rev-parse', '--show-object-format']);
  if (!format.ok) throw new Error(`cannot resolve repository object format: ${format.stderr.trim()}`);
  const objectFormat = format.stdout.trim();
  if (objectFormat !== 'sha1' && objectFormat !== 'sha256') {
    throw new Error(`unsupported repository object format: ${objectFormat || '<missing>'}`);
  }
  const tree = runGit(['-C', worktreeDir, 'ls-tree', '-rz', '--full-tree', '-r', candidateSha]);
  if (!tree.ok) throw new Error(`cannot enumerate committed candidate tree: ${tree.stderr.trim()}`);
  const root = realpathSync(worktreeDir);
  for (const rawEntry of tree.stdout.split('\0')) {
    if (!rawEntry) continue;
    const match = /^([0-7]{6}) (blob|commit) ([a-f0-9]+)\t([\s\S]+)$/u.exec(rawEntry);
    if (!match) throw new Error('candidate tree contains an unparsable entry');
    const [, mode, type, expectedObjectId, relativePath] = match;
    if (type !== 'blob') {
      throw new Error(`candidate tree contains unsupported non-blob entry: ${relativePath}`);
    }
    const file = path.resolve(root, relativePath);
    if (!isInside(file, root)) throw new Error(`candidate tree path escapes worktree: ${relativePath}`);
    if (!existsSync(file)) throw new Error(`candidate tracked path is missing before ${phase}: ${relativePath}`);
    const stats = lstatSync(file);
    let content;
    if (mode === '120000') {
      if (!stats.isSymbolicLink()) {
        throw new Error(`candidate symlink type changed before ${phase}: ${relativePath}`);
      }
      content = Buffer.from(readlinkSync(file));
    } else {
      if (!stats.isFile() || stats.isSymbolicLink()) {
        throw new Error(`candidate file type changed before ${phase}: ${relativePath}`);
      }
      const expectedExecutable = mode === '100755';
      const actualExecutable = Boolean(stats.mode & 0o111);
      if (expectedExecutable !== actualExecutable) {
        throw new Error(`candidate executable mode changed before ${phase}: ${relativePath}`);
      }
      content = readFileSync(file);
    }
    if (blobObjectId(content, objectFormat) !== expectedObjectId) {
      throw new Error(`candidate tracked bytes differ from committed ${candidateSha} before ${phase}: ${relativePath}`);
    }
  }
}

export function assertCandidateWorktreeIntegrity(worktreeDir, candidateSha, phase) {
  const head = gitHead(worktreeDir);
  if (head !== candidateSha) {
    throw new Error(`disposable candidate HEAD changed before ${phase}: expected ${candidateSha}, found ${head}`);
  }
  assertTrackedSourceClean(worktreeDir, phase);
  assertTrackedTreeBytes(worktreeDir, candidateSha, phase);
  const candidateFiles = ['package.json', 'pnpm-lock.yaml'];
  const fileHashes = {};
  for (const file of candidateFiles) {
    const actual = fileSha256(path.join(worktreeDir, file));
    const committed = runGit(['-C', worktreeDir, 'show', `${candidateSha}:${file}`]);
    if (!committed.ok) throw new Error(`cannot read committed ${file} from candidate ${candidateSha}`);
    const expected = createHash('sha256').update(committed.stdout).digest('hex');
    if (actual !== expected) throw new Error(`disposable candidate ${file} differs from committed ${candidateSha} before ${phase}`);
    fileHashes[file] = actual;
  }
  return { head, trackedClean: true, candidateFileSha256: fileHashes };
}

export function assertSource(sourceDir, candidateSha) {
  const resolved = path.resolve(sourceDir);
  assertSafeLocalGitConfig(resolved);
  for (const marker of SOURCE_MARKERS) {
    if (!existsSync(path.join(resolved, marker))) throw new Error(`source dir is missing ${marker}`);
  }
  const lockfile = path.join(resolved, 'pnpm-lock.yaml');
  if (!lstatSync(lockfile).isFile() || lstatSync(lockfile).isSymbolicLink()) {
    throw new Error('candidate pnpm-lock.yaml must be a real regular file');
  }
  const head = gitHead(resolved);
  if (head !== candidateSha) throw new Error(`candidate/source mismatch: requested ${candidateSha}, source is ${head}`);
  assertTrackedSourceClean(resolved, 'fixture execution');
  assertTrackedTreeBytes(resolved, candidateSha, 'fixture execution');
  return { resolved, head, lockfileSha256: fileSha256(lockfile) };
}

export function renderToolSurfaceTemplate(template, cap) {
  if (!Number.isInteger(cap) || cap < 2) throw new Error('tool-surface cap must be an integer of at least 2');
  const overCap = cap + 1;
  if (!template.includes('__RCW5_CAP__') || !template.includes('__RCW5_OVER_CAP__')) {
    throw new Error('tool-surface template is missing required cap placeholders');
  }
  return template
    .replaceAll('__RCW5_CAP__', String(cap))
    .replaceAll('__RCW5_OVER_CAP__', String(overCap));
}

export function buildReadiness({ candidateSha, head, cap, lockfileSha256 }) {
  return {
    schema: 'openclaw.project81.r-cw-5.fixture-readiness.v1',
    candidateSha,
    sourceHeadMatchesCandidate: head === candidateSha,
    sourceTrackedCleanBefore: true,
    productionConfigTouched: false,
    productionStateTouched: false,
    fixtureKind: 'source-only-production-module-plus-dispatch-boundary-suite',
    lockfileSha256,
    dependencyTree: 'fresh-disposable-pnpm-install-frozen-lockfile; source node_modules never trusted',
    cap,
  };
}

export function prepareArtifactDir(input) {
  const artifactDir = path.resolve(input);
  // `mkdir({ recursive: true })` follows a symlink in an existing ancestor.
  // Checking only an existing final directory would therefore let a caller
  // place a fresh receipt under a symlinked parent. Walk every existing path
  // component before making the directory so the private receipt boundary
  // cannot be redirected through an indirect path.
  const parsed = path.parse(artifactDir);
  let componentPath = parsed.root;
  for (const component of path.relative(parsed.root, artifactDir).split(path.sep)) {
    if (!component) continue;
    componentPath = path.join(componentPath, component);
    if (!existsSync(componentPath)) break;
    if (lstatSync(componentPath).isSymbolicLink()) {
      throw new Error('artifact dir path must not contain a symlink component');
    }
  }
  if (existsSync(artifactDir)) {
    const stats = lstatSync(artifactDir);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error('artifact dir must be a real directory, not a file or symlink');
    }
    if ((stats.mode & 0o077) !== 0) {
      throw new Error('artifact dir must not be group/world accessible (mode 0700 required)');
    }
    if (readdirSync(artifactDir).length !== 0) {
      throw new Error('artifact dir must be empty; refusing to overwrite an earlier receipt');
    }
  } else {
    mkdirSync(artifactDir, { recursive: true, mode: 0o700 });
  }
  return artifactDir;
}

function matrixEval(cap) {
  // JSON only: the fixture invokes the exact production TypeScript module via
  // tsx, so this string is not a second implementation of the cap policy.
  return [
    'import { checkContinuationBudget } from "./src/auto-reply/continuation/scheduler.ts";',
    `const cap = ${cap};`,
    'const config = { enabled: true, minDelayMs: 1, maxDelayMs: 60_000, maxChainLength: 4, maxDelegatesPerTurn: 4, maxPendingWork: 32, crossSessionTargeting: "enabled", costCapTokens: cap };',
    'const cases = [cap - 1, cap, cap + 1].map((accumulatedChainTokens) => ({ accumulatedChainTokens, outcome: checkContinuationBudget({ chainState: { currentChainCount: 0, chainStartedAt: 0, accumulatedChainTokens }, config, sessionKey: "r-cw-5-isolated" }) }));',
    'console.log(JSON.stringify({ cap, cases }));',
  ].join('\n');
}

function parseLastJson(stdout, label) {
  const line = stdout.trim().split('\n').findLast((entry) => entry.trim().startsWith('{'));
  if (!line) throw new Error(`${label} emitted no JSON receipt`);
  return JSON.parse(line);
}

function runToolSurface({ worktreeDir, cap, vitestExecutable }) {
  if (!existsSync(TOOL_SURFACE_TEMPLATE)) {
    throw new Error(`tool-surface template missing: ${TOOL_SURFACE_TEMPLATE}`);
  }
  const testDirPath = path.join(worktreeDir, 'test', 'r-cw-5-fixture');
  try {
    lstatSync(testDirPath);
    throw new Error('typed-tool fixture path already exists in candidate worktree');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const testDir = preparePrivateWorktreeDirectory(worktreeDir, 'test/r-cw-5-fixture');
  writeFileSync(
    path.join(testDir, 'cost-cap-tool-surface.test.ts'),
    renderToolSurfaceTemplate(readFileSync(TOOL_SURFACE_TEMPLATE, 'utf8'), cap),
    { mode: 0o600 },
  );
  const test = run(
    process.execPath,
    [vitestExecutable, 'run', '--config', 'test/vitest/vitest.auto-reply.config.ts', '--dir', 'test/r-cw-5-fixture', '--reporter=verbose'],
    { cwd: worktreeDir },
  );
  return {
    passed: test.ok && /1 passed/u.test(test.stdout),
    exitCode: test.exitCode,
    asserted: {
      typedToolCaptured: /disposable typed tool surface/u.test(test.stdout),
      overCapRejected: /rejects exhausted typed-tool elections/u.test(test.stdout),
      rejectedHopNoDurableWork: /1 passed/u.test(test.stdout),
    },
  };
}

function runVerifiedCandidateWorktree({
  sourceDir,
  candidateSha,
  artifactDir,
  cap,
  sourceLockfileSha256,
  packageManagerRoot,
}) {
  assertSafeLocalGitConfig(sourceDir);
  const worktreeDir = path.join(artifactDir, `.r-cw-5-verified-${process.pid}-${Date.now()}`);
  const cleanup = { disposableWorktreeCreated: false, disposableWorktreeRemoved: false };
  const add = runGit(['-C', sourceDir, 'worktree', 'add', '--detach', worktreeDir, candidateSha]);
  if (!add.ok) throw new Error(`cannot create disposable candidate worktree: ${add.stderr.trim()}`);
  cleanup.disposableWorktreeCreated = true;
  try {
    const beforeInstall = assertCandidateWorktreeIntegrity(worktreeDir, candidateSha, 'dependency install');
    const lockfileSha256 = beforeInstall.candidateFileSha256['pnpm-lock.yaml'];
    if (lockfileSha256 !== sourceLockfileSha256) {
      throw new Error('disposable candidate lockfile does not match the verified source lockfile');
    }
    const packageManager = resolvePinnedPnpm(worktreeDir, packageManagerRoot);
    assertReservedPathAbsent(worktreeDir, '.r-cw-5-pnpm-store');
    const pnpmStoreDir = preparePrivateWorktreeDirectory(worktreeDir, '.r-cw-5-pnpm-store');
    const install = run(
      packageManager.pnpmScript,
      [
        'install',
        '--frozen-lockfile',
        '--prefer-offline',
        '--ignore-scripts',
        '--ignore-pnpmfile',
        '--store-dir',
        pnpmStoreDir,
        '--virtual-store-dir',
        'node_modules/.pnpm',
      ],
      { cwd: worktreeDir, env: packageManager.packageManagerEnv },
    );
    if (!install.ok) throw new Error(`frozen-lockfile install failed: ${install.stderr.trim()}`);
    const dependencyDir = path.join(worktreeDir, 'node_modules');
    if (!existsSync(dependencyDir) || !lstatSync(dependencyDir).isDirectory() || lstatSync(dependencyDir).isSymbolicLink()) {
      throw new Error('frozen-lockfile install did not create a real disposable node_modules directory');
    }
    const virtualStoreLock = path.join(worktreeDir, 'node_modules', '.pnpm', 'lock.yaml');
    if (!existsSync(virtualStoreLock)) {
      throw new Error('disposable pnpm virtual-store lock is missing');
    }
    const lockProvenance = verifyPnpmLockProvenance({
      candidateLock: readFileSync(path.join(worktreeDir, 'pnpm-lock.yaml')),
      installedLock: readFileSync(virtualStoreLock),
      packageManager: packageManager.packageManager,
    });
    const afterInstall = assertCandidateWorktreeIntegrity(worktreeDir, candidateSha, 'proof execution after install');
    const tsxExecutable = resolveCandidateLocalExecutable(worktreeDir, 'tsx');
    const vitestExecutable = resolveCandidateLocalExecutable(worktreeDir, 'vitest');
    const matrixRun = run(process.execPath, [tsxExecutable, '--eval', matrixEval(cap)], { cwd: worktreeDir });
    const matrix = matrixRun.ok ? parseLastJson(matrixRun.stdout, 'boundary matrix') : null;
    const dispatchRun = run(
      process.execPath,
      [
        vitestExecutable, 'run', '--config', 'test/vitest/vitest.auto-reply.config.ts',
        'src/auto-reply/continuation/delegate-dispatch.cost-cap-exhaustion.test.ts', '--reporter=verbose',
      ],
      { cwd: worktreeDir },
    );
    const toolSurface = runToolSurface({ worktreeDir, cap, vitestExecutable });
    const afterExecution = assertCandidateWorktreeIntegrity(worktreeDir, candidateSha, 'final receipt emission');
    return {
      matrixRun,
      matrix,
      dispatchRun,
      toolSurface,
      dependency: {
        packageManager: packageManager.packageManager,
        pnpmVersion: packageManager.pnpmVersion,
        pnpmIntegritySha512: packageManager.pnpmIntegritySha512,
        packageManagerExecutableSha256: packageManager.packageManagerExecutableSha256,
        packageManagerMetadataSha256: packageManager.packageManagerMetadataSha256,
        nativePackage: packageManager.nativePackage,
        nativePackageIntegrity: packageManager.nativePackageIntegrity,
        installCommand: [
          'node',
          '<candidate-pinned-pnpm>',
          'install',
          '--frozen-lockfile',
          '--prefer-offline',
          '--ignore-scripts',
          '--ignore-pnpmfile',
          '--store-dir',
          '<private-disposable-store>',
          '--virtual-store-dir',
          'node_modules/.pnpm',
        ],
        packageManagerStateConfinedToDisposableWorktree: true,
        lockfileSha256,
        virtualStoreLockSha256: lockProvenance.installedLockfileSha256,
        workspaceGraphSha256: lockProvenance.candidateWorkspaceGraphSha256,
        installedGraphMatchesCandidate: lockProvenance.installedGraphMatchesCandidate,
        packageManagerBootstrapValidated: lockProvenance.packageManagerBootstrapValidated,
        frozenLockfileVerified: true,
        sourceNodeModulesTrusted: false,
        executionWorktreeIntegrity: { beforeInstall, afterInstall, afterExecution },
        cleanup,
      },
    };
  } finally {
    const remove = runGit(['-C', sourceDir, 'worktree', 'remove', '--force', worktreeDir]);
    if (!remove.ok) throw new Error(`cannot remove disposable candidate worktree: ${remove.stderr.trim()}`);
    if (existsSync(worktreeDir)) throw new Error('disposable candidate worktree still exists after cleanup');
    cleanup.disposableWorktreeRemoved = true;
  }
}

export function runFixture(args) {
  assertArgs(args);
  const { resolved: sourceDir, head, lockfileSha256 } = assertSource(args.sourceDir, args.candidateSha);
  const artifactDir = prepareArtifactDir(args.artifactDir);

  const readiness = buildReadiness({ candidateSha: args.candidateSha, head, cap: args.cap, lockfileSha256 });
  writeJson(path.join(artifactDir, 'fixture-readiness.json'), readiness);

  const verified = runVerifiedCandidateWorktree({
    sourceDir,
    candidateSha: args.candidateSha,
    artifactDir,
    cap: args.cap,
    sourceLockfileSha256: lockfileSha256,
    packageManagerRoot: args.packageManagerRoot,
  });
  const { matrixRun, matrix, dispatchRun, toolSurface } = verified;
  const matrixPassed = Boolean(
    matrix?.cases?.length === 3 &&
    matrix.cases[0]?.outcome === null &&
    matrix.cases[1]?.outcome === null &&
    matrix.cases[2]?.outcome === 'cost-capped',
  );
  writeJson(path.join(artifactDir, 'boundary-matrix.json'), {
    schema: 'openclaw.project81.r-cw-5.boundary-matrix.v1',
    cap: args.cap,
    passed: matrixPassed,
    ...(matrix || {}),
    command: ['node', '<candidate-local-tsx>', '--eval', '<production-module-eval>'],
    exitCode: matrixRun.exitCode,
    dependency: verified.dependency,
  });

  const dispatchAssertions = {
    belowCapAllowsSpawn: /allows dispatch when accumulatedChainTokens is 1 below costCapTokens/u.test(dispatchRun.stdout),
    exactCapAllowsSpawn: /rejects at exact boundary \(accumulatedChainTokens === costCapTokens is NOT over\)/u.test(dispatchRun.stdout),
    overCapRejectsSpawn: /rejects dispatch when accumulatedChainTokens exceeds costCapTokens by 1/u.test(dispatchRun.stdout),
    overCapMarksFlowFailed: /marks TaskFlow records as failed for cost-cap-rejected delegates/u.test(dispatchRun.stdout),
  };
  // A green process alone is insufficient: this fixture must keep pinning the
  // four observable contract points, especially the rejected-hop no-spawn
  // behavior and durable failed-flow side effect.
  const dispatchPassed = dispatchRun.ok && Object.values(dispatchAssertions).every(Boolean);
  writeJson(path.join(artifactDir, 'dispatch-boundary-suite.json'), {
    schema: 'openclaw.project81.r-cw-5.dispatch-boundary-suite.v1',
    passed: dispatchPassed,
    exitCode: dispatchRun.exitCode,
    command: ['node', '<candidate-local-vitest>', 'run', '--config', 'test/vitest/vitest.auto-reply.config.ts', 'src/auto-reply/continuation/delegate-dispatch.cost-cap-exhaustion.test.ts', '--reporter=verbose'],
    // Test names, not raw logs, are public-safe and pin the no-spawn/cascade
    // assertion without copying arbitrary candidate output into the corpus.
    asserted: dispatchAssertions,
    dependency: verified.dependency,
  });

  const toolSurfacePassed = toolSurface.passed && Object.values(toolSurface.asserted).every(Boolean);
  writeJson(path.join(artifactDir, 'typed-tool-surface.json'), {
    schema: 'openclaw.project81.r-cw-5.typed-tool-surface.v1',
    passed: toolSurfacePassed,
    cap: args.cap,
    fixtureKind: 'frozen-lockfile-verified-disposable-exact-candidate-worktree-with-real-attempt-execution-and-typed-tool-capture',
    productionConfigTouched: false,
    productionStateTouched: false,
    sourceDirMutated: false,
    disposableWorktreeCreated: true,
    disposableWorktreeRemoved: true,
    dependency: verified.dependency,
    ...toolSurface,
  });

  // The proof surfaces execute against the disposable exact-candidate
  // worktree. Recheck the original source as well so a concurrent tracked
  // mutation cannot be hidden by an unchanged requested SHA.
  const finalSource = assertSource(sourceDir, args.candidateSha);

  const verdict = matrixPassed && dispatchPassed && toolSurfacePassed ? 'PASS-candidate' : 'FAIL-fixture';
  const result = {
    schema: 'openclaw.project81.r-cw-5.fixture-result.v1',
    verdict,
    candidateSha: args.candidateSha,
    cap: args.cap,
    receipts: {
      fixtureReadiness: 'fixture-readiness.json',
      boundaryMatrix: 'boundary-matrix.json',
      dispatchBoundarySuite: 'dispatch-boundary-suite.json',
      typedToolSurface: 'typed-tool-surface.json',
      cleanup: 'cleanup.json',
    },
    checks: { matrixPassed, dispatchPassed, toolSurfacePassed, noRejectedHopSpawn: dispatchPassed && toolSurfacePassed },
  };
  writeJson(path.join(artifactDir, 'cleanup.json'), {
    schema: 'openclaw.project81.r-cw-5.cleanup.v1',
    productionConfigTouched: false,
    productionStateTouched: false,
    sourceMutated: false,
    sourceHeadMatchesCandidateAfter: finalSource.head === args.candidateSha,
    sourceTrackedCleanAfter: true,
    executionWorktreeIntegrity: verified.dependency.executionWorktreeIntegrity,
    disposableWorktreeRemoved: verified.dependency.cleanup.disposableWorktreeRemoved,
    cleanupRequired: false,
    result: 'source-only fixture left no gateway/config/state process to restore',
  });
  writeJson(path.join(artifactDir, 'fixture-result.json'), result);
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) try {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
  } else {
    const result = runFixture(args);
    if (args.json) console.log(JSON.stringify(result));
    else console.log(`R-CW-5 fixture: ${result.verdict} (${result.candidateSha})`);
    process.exitCode = result.verdict === 'PASS-candidate' ? 0 : 1;
  }
} catch (error) {
  console.error(`R-CW-5 fixture failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
}
