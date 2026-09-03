#!/usr/bin/env node
/**
 * Isolated R-CW-6 max-chain fixture.
 *
 * The fixture never writes fleet OpenClaw config/state and never starts a
 * gateway. It executes the exact candidate's production continuation budget,
 * durable work scheduler, typed continue_work capture, and delegate dispatch
 * boundary from a disposable worktree. Missing receipts fail closed.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import {
  parseExactPnpmPackageManager,
  verifyPnpmLockProvenance,
} from '../lib/pnpm-provenance.mjs';

const DEFAULT_MAX_CHAIN_LENGTH = 3;
const SOURCE_MARKERS = [
  'src/auto-reply/continuation/scheduler.ts',
  'src/auto-reply/continuation/work-dispatch.ts',
  'src/auto-reply/continuation/delegate-dispatch.chain-depth-exhaustion.test.ts',
  'src/agents/command/attempt-execution.ts',
  'package.json',
  'pnpm-lock.yaml',
];
const TOOL_SURFACE_TEMPLATE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../fixtures/r-cw-6/max-chain-tool-surface.test.ts',
);
const DELEGATE_BOUNDARY_TEMPLATE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../fixtures/r-cw-6/max-chain-delegate-boundary.test.ts',
);
function usage() {
  return `Usage: node tools/k6-proofs/scripts/run-max-chain-fixture.mjs \\
  --source-dir <exact-candidate-worktree> \\
  --candidate-sha <40-hex-sha> \\
  --artifact-dir <safe-output-dir> [--max-chain-length <integer-at-least-2>] [--json]`;
}

export function parseArgs(argv, env = process.env) {
  const args = {
    sourceDir: env.OPENCLAW_RCW6_SOURCE_DIR || '',
    candidateSha: env.OPENCLAW_CANDIDATE_SHA || '',
    artifactDir: env.OPENCLAW_RCW6_ARTIFACT_DIR || '',
    maxChainLength: Number(env.OPENCLAW_RCW6_MAX_CHAIN_LENGTH || DEFAULT_MAX_CHAIN_LENGTH),
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
    else if (arg === '--artifact-dir') args.artifactDir = next();
    else if (arg === '--max-chain-length') args.maxChainLength = Number(next());
    else throw new Error(`unexpected argument: ${arg}`);
  }
  return args;
}

function assertArgs(args) {
  if (!args.sourceDir) throw new Error('--source-dir or OPENCLAW_RCW6_SOURCE_DIR is required');
  if (!args.artifactDir) throw new Error('--artifact-dir or OPENCLAW_RCW6_ARTIFACT_DIR is required');
  if (!/^[0-9a-f]{40}$/u.test(args.candidateSha)) {
    throw new Error('--candidate-sha or OPENCLAW_CANDIDATE_SHA must be a 40-character lowercase SHA');
  }
  if (!Number.isInteger(args.maxChainLength) || args.maxChainLength < 2) {
    throw new Error('--max-chain-length must be an integer of at least 2');
  }
}

function run(command, args, options = {}) {
  try {
    const stdout = execFileSync(command, args, {
      ...options,
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

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function readJsonIfValid(file) {
  try {
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  } catch {
    return null;
  }
}

function gitHead(sourceDir) {
  const result = run('git', ['-C', sourceDir, 'rev-parse', 'HEAD']);
  if (!result.ok) throw new Error(`cannot resolve source HEAD: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function trackedSourceStatus(sourceDir) {
  const result = run('git', ['-C', sourceDir, 'status', '--porcelain', '--untracked-files=no']);
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

export function assertSource(sourceDir, candidateSha) {
  const resolved = path.resolve(sourceDir);
  for (const marker of SOURCE_MARKERS) {
    if (!existsSync(path.join(resolved, marker))) throw new Error(`source dir is missing ${marker}`);
  }
  const head = gitHead(resolved);
  if (head !== candidateSha) throw new Error(`candidate/source mismatch: requested ${candidateSha}, source is ${head}`);
  assertTrackedSourceClean(resolved, 'fixture execution');
  return { resolved, head };
}

function sha256File(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function isPathInside(root, target) {
  return target === root || target.startsWith(`${root}${path.sep}`);
}

function assertRealFile(file, label) {
  if (!existsSync(file)) throw new Error(`dependency provenance is missing ${label}`);
  const stats = lstatSync(file);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error(`dependency provenance requires ${label} to be a real file`);
  }
  return file;
}

function assertRealDirectory(directory, label) {
  if (!existsSync(directory)) throw new Error(`dependency provenance is missing ${label}`);
  const stats = lstatSync(directory);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error(`dependency provenance requires ${label} to be a real directory`);
  }
  return directory;
}

export function parsePinnedPnpmPackageManager(declaration, label = 'candidate package.json packageManager') {
  try {
    const parsed = parseExactPnpmPackageManager(declaration, { label });
    return {
      declaration: parsed.declaration,
      version: parsed.version,
      integritySuffix: parsed.integrityHex ? `+sha512.${parsed.integrityHex}` : '',
      integrityHex: parsed.integrityHex,
    };
  } catch (error) {
    throw new Error(`dependency provenance requires ${error.message}`);
  }
}

function yamlScalar(raw, field) {
  // pnpm 11 currently writes `.modules.yaml` as JSON despite the filename;
  // older trees may still use ordinary YAML scalars. Accept both encodings,
  // but only return a top-level string value.
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof parsed[field] === 'string') {
      return parsed[field].trim();
    }
  } catch {
    // Fall through to the legacy YAML-scalar form.
  }
  const escaped = field.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const match = raw.match(new RegExp(`^${escaped}:\\s*(?:"([^"]*)"|'([^']*)'|([^#\\r\\n]*?))\\s*(?:#.*)?$`, 'mu'));
  if (!match) return null;
  return (match[1] ?? match[2] ?? match[3] ?? '').trim();
}

export function assertExecutingPnpmVersion(candidatePackageManager, executingVersion) {
  if (typeof executingVersion !== 'string' || !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u.test(executingVersion.trim())) {
    throw new Error('pnpm --version must emit one exact semantic version');
  }
  if (executingVersion.trim() !== candidatePackageManager.version) {
    throw new Error(
      `executing pnpm version ${executingVersion.trim()} does not equal candidate packageManager version ${candidatePackageManager.version}`,
    );
  }
  return executingVersion.trim();
}

export function assertInstalledPnpmDependencyTree(worktreeDir, candidatePackageManager) {
  const dependencyDir = assertRealDirectory(path.join(worktreeDir, 'node_modules'), 'candidate node_modules');
  const dependencyRealPath = realpathSync(dependencyDir);
  const candidateLockPath = assertRealFile(path.join(worktreeDir, 'pnpm-lock.yaml'), 'candidate pnpm-lock.yaml');
  assertRealDirectory(path.join(dependencyDir, '.pnpm'), 'node_modules/.pnpm');
  const installedLockPath = assertRealFile(
    path.join(dependencyDir, '.pnpm', 'lock.yaml'),
    'node_modules/.pnpm/lock.yaml',
  );
  const lockProvenance = verifyPnpmLockProvenance({
    candidateLock: readFileSync(candidateLockPath),
    installedLock: readFileSync(installedLockPath),
    packageManager: candidatePackageManager.declaration,
  });

  const modulesPath = assertRealFile(path.join(dependencyDir, '.modules.yaml'), 'node_modules/.modules.yaml');
  const modulesRaw = readFileSync(modulesPath, 'utf8');
  const installedPackageManagerDeclaration = yamlScalar(modulesRaw, 'packageManager');
  let installedPackageManager;
  try {
    installedPackageManager = parsePinnedPnpmPackageManager(
      installedPackageManagerDeclaration,
      'node_modules/.modules.yaml packageManager',
    );
  } catch (error) {
    throw new Error(`dependency provenance rejects installed package manager metadata: ${error.message}`);
  }
  if (
    installedPackageManager.version !== candidatePackageManager.version ||
    (installedPackageManager.integritySuffix &&
      installedPackageManager.declaration !== candidatePackageManager.declaration)
  ) {
    throw new Error('node_modules/.modules.yaml packageManager is incompatible with candidate packageManager');
  }

  const virtualStoreDir = yamlScalar(modulesRaw, 'virtualStoreDir');
  if (!virtualStoreDir || path.isAbsolute(virtualStoreDir) || path.win32.isAbsolute(virtualStoreDir)) {
    throw new Error('node_modules/.modules.yaml virtualStoreDir must be a relative candidate-local path');
  }
  const virtualStorePath = path.resolve(dependencyDir, virtualStoreDir);
  if (!isPathInside(dependencyDir, virtualStorePath)) {
    throw new Error('node_modules/.modules.yaml virtualStoreDir escapes candidate node_modules');
  }
  assertRealDirectory(virtualStorePath, 'candidate pnpm virtual store');
  const virtualStoreRealPath = realpathSync(virtualStorePath);
  if (!isPathInside(dependencyRealPath, virtualStoreRealPath)) {
    throw new Error('candidate pnpm virtual store resolves outside candidate node_modules');
  }

  return {
    candidateLockfileSha256: lockProvenance.candidateLockfileSha256,
    installedLockfileSha256: lockProvenance.installedLockfileSha256,
    candidateWorkspaceGraphSha256: lockProvenance.candidateWorkspaceGraphSha256,
    packageManagerBootstrapSha256: lockProvenance.packageManagerBootstrapSha256,
    installedGraphMatchesCandidate: lockProvenance.installedGraphMatchesCandidate,
    packageManagerBootstrapValidated: lockProvenance.packageManagerBootstrapValidated,
    installedPackageManager: installedPackageManager.declaration,
    installedPackageManagerVersion: installedPackageManager.version,
    virtualStoreDir,
    virtualStoreContainedWithinCandidateNodeModules: true,
    dependencyDir,
    dependencyRealPath,
  };
}

export function candidateLocalExecutables(worktreeDir, verifiedDependencyTree) {
  if (!verifiedDependencyTree?.dependencyRealPath) {
    throw new Error('candidate-local executable checks require a verified dependency tree');
  }
  const dependencyDir = path.join(worktreeDir, 'node_modules');
  const paths = {};
  const contract = {};
  for (const executable of ['tsx', 'vitest']) {
    const executablePath = path.resolve(dependencyDir, '.bin', executable);
    if (!existsSync(executablePath)) {
      throw new Error(`candidate frozen install is missing node_modules/.bin/${executable}`);
    }
    const executableRealPath = realpathSync(executablePath);
    if (!isPathInside(verifiedDependencyTree.dependencyRealPath, executableRealPath)) {
      throw new Error(`candidate node_modules/.bin/${executable} resolves outside verified dependency tree`);
    }
    paths[executable] = executablePath;
    contract[executable] = {
      path: `node_modules/.bin/${executable}`,
      realpathWithinVerifiedDependencyTree: true,
    };
  }
  return { paths, contract };
}

function assertTrackedCandidateFile(worktreeDir, relativePath) {
  const file = path.join(worktreeDir, relativePath);
  if (!existsSync(file)) throw new Error(`candidate worktree is missing ${relativePath}`);
  const tracked = run('git', ['-C', worktreeDir, 'ls-files', '--error-unmatch', '--', relativePath]);
  if (!tracked.ok) {
    throw new Error(`candidate worktree requires committed ${relativePath}`);
  }
  return file;
}

export function assertCandidateWorktree(worktreeDir, candidateSha, phase = 'candidate worktree execution') {
  const head = gitHead(worktreeDir);
  if (head !== candidateSha) {
    throw new Error(`candidate worktree SHA mismatch before ${phase}: expected ${candidateSha}, found ${head}`);
  }
  assertTrackedSourceClean(worktreeDir, phase);
  for (const marker of SOURCE_MARKERS) assertTrackedCandidateFile(worktreeDir, marker);
  const packageJson = assertRealFile(
    assertTrackedCandidateFile(worktreeDir, 'package.json'),
    'candidate package.json',
  );
  let packageManager;
  try {
    packageManager = parsePinnedPnpmPackageManager(
      JSON.parse(readFileSync(packageJson, 'utf8')).packageManager,
    );
  } catch (error) {
    throw new Error(`candidate worktree cannot use committed package.json: ${error.message}`);
  }
  const lockfile = assertRealFile(
    assertTrackedCandidateFile(worktreeDir, 'pnpm-lock.yaml'),
    'candidate pnpm-lock.yaml',
  );
  return {
    head,
    candidateLockfileSha256: sha256File(lockfile),
    candidatePackageManager: packageManager,
  };
}

export function installCandidateDependencies(worktreeDir, candidatePackageManager, { env = process.env } = {}) {
  const version = run('pnpm', ['--version'], { cwd: worktreeDir, env });
  if (!version.ok) {
    throw new Error(`candidate pnpm --version failed with exit ${version.exitCode}`);
  }
  const executingPackageManagerVersion = assertExecutingPnpmVersion(candidatePackageManager, version.stdout.trim());
  const command = ['pnpm', 'install', '--frozen-lockfile', '--prefer-offline', '--ignore-scripts'];
  const install = run(command[0], command.slice(1), { cwd: worktreeDir, env });
  if (!install.ok) {
    throw new Error(`candidate frozen pnpm install failed with exit ${install.exitCode}`);
  }
  return { command, exitCode: install.exitCode, executingPackageManagerVersion };
}

export function verifyInstalledCandidateDependencies(worktreeDir, candidatePackageManager) {
  const dependencyProvenance = assertInstalledPnpmDependencyTree(worktreeDir, candidatePackageManager);
  const localExecutables = candidateLocalExecutables(worktreeDir, dependencyProvenance);
  return {
    dependencyProvenance,
    executables: localExecutables.paths,
    localExecutableContract: localExecutables.contract,
  };
}

export function prepareArtifactDir(input) {
  const artifactDir = path.resolve(input);
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

export function renderToolSurfaceTemplate(template, maxChainLength) {
  if (!Number.isInteger(maxChainLength) || maxChainLength < 2) {
    throw new Error('tool-surface maxChainLength must be an integer of at least 2');
  }
  if (!template.includes('__RCW6_MAX_CHAIN_LENGTH__')) {
    throw new Error('tool-surface template is missing required max-chain placeholder');
  }
  return template.replaceAll('__RCW6_MAX_CHAIN_LENGTH__', String(maxChainLength));
}

export function buildReadiness({ candidateSha, head, candidateRuntime, maxChainLength }) {
  return {
    schema: 'openclaw.project81.r-cw-6.fixture-readiness.v1',
    candidateSha,
    sourceHeadMatchesCandidate: head === candidateSha,
    sourceTrackedCleanBefore: true,
    productionConfigTouched: false,
    productionStateTouched: false,
    gatewayStarted: false,
    fixtureKind: 'disposable-exact-candidate-production-runtime-boundary-plus-dispatch-suite',
    dependencyTree: 'candidate-worktree-pnpm-install-frozen-lockfile-prefer-offline-ignore-scripts; lockfile/tree/version-aligned; source-node_modules-ignored',
    hostToolchainHermetic: false,
    candidateLockfileSha256: candidateRuntime.candidateLockfileSha256,
    installedLockfileSha256: candidateRuntime.installedLockfileSha256,
    candidateWorkspaceGraphSha256: candidateRuntime.candidateWorkspaceGraphSha256,
    packageManagerBootstrapSha256: candidateRuntime.packageManagerBootstrapSha256,
    installedGraphMatchesCandidate: candidateRuntime.installedGraphMatchesCandidate,
    packageManagerBootstrapValidated: candidateRuntime.packageManagerBootstrapValidated,
    candidatePackageManager: candidateRuntime.candidatePackageManager,
    candidatePackageManagerVersion: candidateRuntime.candidatePackageManagerVersion,
    executingPackageManagerVersion: candidateRuntime.executingPackageManagerVersion,
    installedPackageManager: candidateRuntime.installedPackageManager,
    installedPackageManagerVersion: candidateRuntime.installedPackageManagerVersion,
    virtualStoreDir: candidateRuntime.virtualStoreDir,
    virtualStoreContainedWithinCandidateNodeModules:
      candidateRuntime.virtualStoreContainedWithinCandidateNodeModules,
    installCommand: candidateRuntime.installCommand,
    localExecutableContract: candidateRuntime.localExecutableContract,
    worktreeIntegrity: candidateRuntime.worktreeIntegrity,
    maxChainLength,
  };
}

export function assertPublicArtifactSafe(value, { label = 'artifact', privatePaths = [] } = {}) {
  const serialized = JSON.stringify(value);
  for (const privatePath of privatePaths) {
    if (privatePath && serialized.includes(privatePath)) {
      throw new Error(`${label} contains a private filesystem path`);
    }
  }
  const forbiddenKeyPatterns = [
    /(?:access|api|auth|bearer|gateway|private|refresh|secret)(?:keys?|tokens?)$/u,
    /^(?:keys?|tokens?)$/u,
    /(?:authorization|bearer|cookies?|setcookies?|credentials?|passwords?|secrets?)/u,
    /session(?:id|identifier|key)/u,
    /(?:^|process)(?:env|environment)(?:dump|variables|vars)?$/u,
    /(?:stdout|stderr|output|logs?|errors?|exception|stack|stacktrace)/u,
    /(?:artifact|private|source|worktree)(?:dir|path)$/u,
  ];
  const normalizedKey = (key) => key.toLowerCase().replaceAll(/[^a-z0-9]/gu, '');
  const containsAbsolutePath = (entry) => {
    if (typeof entry !== 'string') return false;
    return /(?:^|[\s("'=])\/(?:[^/\s"'()]+\/?)+/u.test(entry) ||
      /(?:^|[\s("'=])[a-z]:\\(?:[^\\\s"'()]+\\?)+/iu.test(entry) ||
      /(?:^|[\s("'=])[a-z]:\/(?:[^/\s"'()]+\/?)+/iu.test(entry) ||
      /(?:^|[\s("'=])\\\\[^\\\s"'()]+\\[^\\\s"'()]+/u.test(entry) ||
      /\bfile:\/\//iu.test(entry) ||
      /(?:^|[\s("'=])~[\\/]/u.test(entry);
  };
  const visit = (entry) => {
    if (containsAbsolutePath(entry)) {
      throw new Error(`${label} contains an absolute filesystem path`);
    }
    if (typeof entry === 'string' && /\bagent:[a-z0-9:_-]+\b/iu.test(entry)) {
      throw new Error(`${label} contains a session identifier`);
    }
    if (!entry || typeof entry !== 'object') return;
    for (const [key, nested] of Object.entries(entry)) {
      const normalized = normalizedKey(key);
      if (forbiddenKeyPatterns.some((pattern) => pattern.test(normalized))) {
        throw new Error(`${label} contains forbidden public-artifact key ${key}`);
      }
      visit(nested);
    }
  };
  visit(value);
}

function matrixEval(maxChainLength) {
  const start = maxChainLength - 2;
  return [
    'import { checkContinuationBudget } from "./src/auto-reply/continuation/scheduler.ts";',
    `const maxChainLength = ${maxChainLength};`,
    'const config = { enabled: true, minDelayMs: 1, maxDelayMs: 60_000, defaultDelayMs: 1, maxChainLength, maxDelegatesPerTurn: 4, maxPendingWork: 32, crossSessionTargeting: "enabled", costCapTokens: 50_000_000, busySkipBackoff: { baseMs: 1000, ceilingMs: 60000, factor: 2 } };',
    `const cases = [${start}, ${start + 1}, ${maxChainLength}].map((currentChainCount) => ({ currentChainCount, attemptedHop: currentChainCount + 1, outcome: checkContinuationBudget({ chainState: { currentChainCount, chainStartedAt: 0, accumulatedChainTokens: 0 }, config, sessionKey: "r-cw-6-isolated" }) }));`,
    'console.log(JSON.stringify({ maxChainLength, cases }));',
  ].join('\n');
}

function parseLastJson(stdout, label) {
  const line = stdout.trim().split('\n').findLast((entry) => entry.trim().startsWith('{'));
  if (!line) throw new Error(`${label} emitted no JSON receipt`);
  return JSON.parse(line);
}

function runDisposableToolSurface({ sourceDir, candidateSha, artifactDir, maxChainLength }) {
  for (const template of [TOOL_SURFACE_TEMPLATE, DELEGATE_BOUNDARY_TEMPLATE]) {
    if (!existsSync(template)) throw new Error(`fixture template missing: ${template}`);
  }
  const worktreeDir = path.join(artifactDir, `.r-cw-6-runtime-${process.pid}-${Date.now()}`);
  const add = run('git', ['-C', sourceDir, 'worktree', 'add', '--detach', worktreeDir, candidateSha]);
  if (!add.ok) throw new Error(`cannot create disposable candidate worktree: ${add.stderr.trim()}`);
  const rawRuntimeReceiptPath = path.join(artifactDir, '.runtime-boundary.raw.json');
  const rawTypedReceiptPath = path.join(artifactDir, '.typed-surface.raw.json');
  const rawDelegateReceiptPath = path.join(artifactDir, '.delegate-boundary.raw.json');
  let result;
  try {
    const candidateBeforeInstall = assertCandidateWorktree(worktreeDir, candidateSha, 'frozen install');
    const installation = installCandidateDependencies(
      worktreeDir,
      candidateBeforeInstall.candidatePackageManager,
    );
    // This must be the first candidate-integrity check after `pnpm install`.
    // The installer is allowed to create ignored dependency files, but never to
    // change the candidate commit or any tracked candidate content.
    const candidateAfterInstall = assertCandidateWorktree(
      worktreeDir,
      candidateSha,
      'post-install dependency verification',
    );
    const verifiedDependencies = verifyInstalledCandidateDependencies(
      worktreeDir,
      candidateBeforeInstall.candidatePackageManager,
    );
    const candidateRuntime = {
      candidateWorktreeHead: candidateBeforeInstall.head,
      candidateLockfileSha256: candidateBeforeInstall.candidateLockfileSha256,
      installedLockfileSha256: verifiedDependencies.dependencyProvenance.installedLockfileSha256,
      candidateWorkspaceGraphSha256:
        verifiedDependencies.dependencyProvenance.candidateWorkspaceGraphSha256,
      packageManagerBootstrapSha256:
        verifiedDependencies.dependencyProvenance.packageManagerBootstrapSha256,
      installedGraphMatchesCandidate:
        verifiedDependencies.dependencyProvenance.installedGraphMatchesCandidate,
      packageManagerBootstrapValidated:
        verifiedDependencies.dependencyProvenance.packageManagerBootstrapValidated,
      candidatePackageManager: candidateBeforeInstall.candidatePackageManager.declaration,
      candidatePackageManagerVersion: candidateBeforeInstall.candidatePackageManager.version,
      executingPackageManagerVersion: installation.executingPackageManagerVersion,
      installedPackageManager: verifiedDependencies.dependencyProvenance.installedPackageManager,
      installedPackageManagerVersion: verifiedDependencies.dependencyProvenance.installedPackageManagerVersion,
      virtualStoreDir: verifiedDependencies.dependencyProvenance.virtualStoreDir,
      virtualStoreContainedWithinCandidateNodeModules:
        verifiedDependencies.dependencyProvenance.virtualStoreContainedWithinCandidateNodeModules,
      installCommand: installation.command,
      installExitCode: installation.exitCode,
      localExecutableContract: verifiedDependencies.localExecutableContract,
      worktreeIntegrity: {
        beforeInstall: { headMatchesCandidate: true, trackedClean: true },
        afterInstall: {
          headMatchesCandidate: candidateAfterInstall.head === candidateSha,
          trackedClean: true,
        },
        afterProofSurfaces: null,
      },
      hostToolchainHermetic: false,
    };
    const runtimeTestDir = path.join(worktreeDir, 'test', 'r-cw-6-runtime-fixture');
    const delegateTestDir = path.join(worktreeDir, 'test', 'r-cw-6-delegate-fixture');
    mkdirSync(runtimeTestDir, { recursive: true, mode: 0o700 });
    mkdirSync(delegateTestDir, { recursive: true, mode: 0o700 });
    writeFileSync(
      path.join(runtimeTestDir, 'max-chain-tool-surface.test.ts'),
      renderToolSurfaceTemplate(readFileSync(TOOL_SURFACE_TEMPLATE, 'utf8'), maxChainLength),
      { mode: 0o600 },
    );
    writeFileSync(
      path.join(delegateTestDir, 'max-chain-delegate-boundary.test.ts'),
      renderToolSurfaceTemplate(readFileSync(DELEGATE_BOUNDARY_TEMPLATE, 'utf8'), maxChainLength),
      { mode: 0o600 },
    );
    const stateDir = path.join(worktreeDir, '.rcw6-state');
    mkdirSync(stateDir, { recursive: true, mode: 0o700 });
    const isolatedEnv = { ...process.env, OPENCLAW_STATE_DIR: stateDir };

    const matrixRun = run(
      verifiedDependencies.executables.tsx,
      ['--eval', matrixEval(maxChainLength)],
      { cwd: worktreeDir, env: isolatedEnv },
    );
    let matrix = null;
    if (matrixRun.ok) {
      try {
        matrix = parseLastJson(matrixRun.stdout, 'boundary matrix');
      } catch {
        matrix = null;
      }
    }

    const dispatchRun = run(
      verifiedDependencies.executables.vitest,
      [
        'run',
        '--config',
        'test/vitest/vitest.auto-reply.config.ts',
        'src/auto-reply/continuation/delegate-dispatch.chain-depth-exhaustion.test.ts',
        '--reporter=verbose',
      ],
      { cwd: worktreeDir, env: isolatedEnv },
    );
    const dispatchAssertions = {
      atLimitRejectsBeforeSpawn: /rejects a delegate when currentChainCount equals maxChainLength/u.test(
        dispatchRun.stdout,
      ),
      boundaryHopSpawnsThenNextRejects:
        /accepts a delegate at count 9\/10, then rejects the next at 10\/10/u.test(dispatchRun.stdout),
      rejectedFlowMarkedFailed:
        /marks the TaskFlow record as failed for chain-depth-rejected delegates/u.test(dispatchRun.stdout),
    };

    const selectedDelegateRun = run(
      verifiedDependencies.executables.vitest,
      [
        'run',
        '--config',
        'test/vitest/vitest.auto-reply.config.ts',
        '--dir',
        'test/r-cw-6-delegate-fixture',
        '--reporter=verbose',
      ],
      {
        cwd: worktreeDir,
        env: { ...isolatedEnv, RCW6_DELEGATE_RECEIPT_PATH: rawDelegateReceiptPath },
      },
    );
    const selectedDelegateReceipt = selectedDelegateRun.ok
      ? readJsonIfValid(rawDelegateReceiptPath)
      : null;

    const test = run(
      verifiedDependencies.executables.vitest,
      [
        'run',
        '--config',
        'test/vitest/vitest.auto-reply.config.ts',
        '--dir',
        'test/r-cw-6-runtime-fixture',
        '--reporter=verbose',
      ],
      {
        cwd: worktreeDir,
        env: {
          ...isolatedEnv,
          RCW6_RUNTIME_RECEIPT_PATH: rawRuntimeReceiptPath,
          RCW6_TYPED_RECEIPT_PATH: rawTypedReceiptPath,
        },
      },
    );
    const runtimeReceipt = test.ok ? readJsonIfValid(rawRuntimeReceiptPath) : null;
    const typedReceipt = test.ok ? readJsonIfValid(rawTypedReceiptPath) : null;
    result = {
      passed: test.ok && /2 passed/u.test(test.stdout),
      exitCode: test.exitCode,
      asserted: {
        runtimeBoundary: /proves below-limit, at-limit, and first-over-limit with durable recovery/u.test(test.stdout),
        typedToolBoundary: /captures typed continue_work elections and creates no first-over-limit flow/u.test(test.stdout),
      },
      matrixRun,
      matrix,
      dispatchRun,
      dispatchAssertions,
      selectedDelegateRun,
      selectedDelegateReceipt,
      runtimeReceipt,
      typedReceipt,
      candidateRuntime,
    };
    const candidateAfterProofSurfaces = assertCandidateWorktree(
      worktreeDir,
      candidateSha,
      'all runtime proof surfaces',
    );
    candidateRuntime.worktreeIntegrity.afterProofSurfaces = {
      headMatchesCandidate: candidateAfterProofSurfaces.head === candidateSha,
      trackedClean: true,
    };
  } finally {
    const remove = run('git', ['-C', sourceDir, 'worktree', 'remove', '--force', worktreeDir]);
    if (!remove.ok) throw new Error(`cannot remove disposable candidate worktree: ${remove.stderr.trim()}`);
    if (existsSync(worktreeDir)) throw new Error('disposable candidate worktree still exists after cleanup');
  }
  return { ...result, disposableWorktreeRemoved: true, privateWorktreePath: worktreeDir };
}

export function runFixture(args) {
  assertArgs(args);
  const { resolved: sourceDir, head } = assertSource(args.sourceDir, args.candidateSha);
  const artifactDir = prepareArtifactDir(args.artifactDir);

  const runtimeSurface = runDisposableToolSurface({
    sourceDir,
    candidateSha: args.candidateSha,
    artifactDir,
    maxChainLength: args.maxChainLength,
  });
  const readiness = buildReadiness({
    candidateSha: args.candidateSha,
    head,
    candidateRuntime: runtimeSurface.candidateRuntime,
    maxChainLength: args.maxChainLength,
  });
  writeJson(path.join(artifactDir, 'fixture-readiness.json'), readiness);
  const candidateRuntimeReceipt = {
    candidateWorktreeHead: runtimeSurface.candidateRuntime.candidateWorktreeHead,
    candidateLockfileSha256: runtimeSurface.candidateRuntime.candidateLockfileSha256,
    installedLockfileSha256: runtimeSurface.candidateRuntime.installedLockfileSha256,
    candidateWorkspaceGraphSha256:
      runtimeSurface.candidateRuntime.candidateWorkspaceGraphSha256,
    packageManagerBootstrapSha256:
      runtimeSurface.candidateRuntime.packageManagerBootstrapSha256,
    installedGraphMatchesCandidate:
      runtimeSurface.candidateRuntime.installedGraphMatchesCandidate,
    packageManagerBootstrapValidated:
      runtimeSurface.candidateRuntime.packageManagerBootstrapValidated,
    candidatePackageManager: runtimeSurface.candidateRuntime.candidatePackageManager,
    candidatePackageManagerVersion: runtimeSurface.candidateRuntime.candidatePackageManagerVersion,
    executingPackageManagerVersion: runtimeSurface.candidateRuntime.executingPackageManagerVersion,
    installedPackageManager: runtimeSurface.candidateRuntime.installedPackageManager,
    installedPackageManagerVersion: runtimeSurface.candidateRuntime.installedPackageManagerVersion,
    virtualStoreDir: runtimeSurface.candidateRuntime.virtualStoreDir,
    virtualStoreContainedWithinCandidateNodeModules:
      runtimeSurface.candidateRuntime.virtualStoreContainedWithinCandidateNodeModules,
    installCommand: runtimeSurface.candidateRuntime.installCommand,
    installExitCode: runtimeSurface.candidateRuntime.installExitCode,
    localExecutableContract: runtimeSurface.candidateRuntime.localExecutableContract,
    worktreeIntegrity: runtimeSurface.candidateRuntime.worktreeIntegrity,
    hostToolchainHermetic: runtimeSurface.candidateRuntime.hostToolchainHermetic,
  };
  const matrixRun = runtimeSurface.matrixRun;
  const matrix = runtimeSurface.matrix;
  const matrixPassed = Boolean(
    matrixRun.ok &&
    matrix?.cases?.length === 3 &&
      matrix.cases[0]?.outcome === null &&
      matrix.cases[1]?.outcome === null &&
      matrix.cases[2]?.outcome === 'chain-capped' &&
      matrix.cases[0]?.attemptedHop === args.maxChainLength - 1 &&
      matrix.cases[1]?.attemptedHop === args.maxChainLength &&
      matrix.cases[2]?.attemptedHop === args.maxChainLength + 1,
  );
  const boundaryMatrixReceipt = {
    schema: 'openclaw.project81.r-cw-6.boundary-matrix.v1',
    maxChainLength: args.maxChainLength,
    passed: matrixPassed,
    ...(matrix || {}),
    command: ['node_modules/.bin/tsx', '--eval', '<production-module-eval>'],
    exitCode: matrixRun.exitCode,
    exactCandidateDisposableWorktree: true,
    ...candidateRuntimeReceipt,
  };
  writeJson(path.join(artifactDir, 'boundary-matrix.json'), boundaryMatrixReceipt);

  const dispatchRun = runtimeSurface.dispatchRun;
  const dispatchAssertions = runtimeSurface.dispatchAssertions;
  const selectedDelegateReceipt = runtimeSurface.selectedDelegateReceipt;
  const selectedDelegateAssertions = {
    selectedMaximum: selectedDelegateReceipt?.configuredMaximum === args.maxChainLength,
    startsOneBelowMaximum:
      selectedDelegateReceipt?.initialCurrentChainCount === args.maxChainLength - 1,
    attemptsAtAndFirstOver:
      JSON.stringify(selectedDelegateReceipt?.attemptedHops) ===
      JSON.stringify([args.maxChainLength, args.maxChainLength + 1]),
    oneDispatchOneReject:
      selectedDelegateReceipt?.dispatched === 1 && selectedDelegateReceipt?.rejected === 1,
    rejectedBeforeSecondSpawn: selectedDelegateReceipt?.rejectedBeforeSecondSpawn === true,
    rejectedFlowFailed: selectedDelegateReceipt?.rejectedFlowStatus === 'failed',
    chainCappedNoticeObserved: selectedDelegateReceipt?.chainCappedNoticeObserved === true,
    resultingCountAtMaximum:
      selectedDelegateReceipt?.resultingChainCount === args.maxChainLength,
  };
  const selectedDelegatePassed =
    runtimeSurface.selectedDelegateRun.ok &&
    /proves the selected max-chain delegate boundary before spawn and fails the rejected flow/u.test(
      runtimeSurface.selectedDelegateRun.stdout,
    ) &&
    Object.values(selectedDelegateAssertions).every(Boolean);
  const candidateDispatchSuitePassed =
    dispatchRun.ok && Object.values(dispatchAssertions).every(Boolean);
  const dispatchPassed = candidateDispatchSuitePassed && selectedDelegatePassed;
  const dispatchBoundaryReceipt = {
    schema: 'openclaw.project81.r-cw-6.dispatch-boundary-suite.v1',
    passed: dispatchPassed,
    configuredMaximum: args.maxChainLength,
    selectedBoundary: {
      ...selectedDelegateReceipt,
      passed: selectedDelegatePassed,
      asserted: selectedDelegateAssertions,
      command: [
        'node_modules/.bin/vitest',
        'run',
        '--config',
        'test/vitest/vitest.auto-reply.config.ts',
        '--dir',
        'test/r-cw-6-delegate-fixture',
        '--reporter=verbose',
      ],
      exitCode: runtimeSurface.selectedDelegateRun.exitCode,
    },
    candidateRegressionSuite: {
      passed: candidateDispatchSuitePassed,
      command: [
        'node_modules/.bin/vitest', 'run', '--config', 'test/vitest/vitest.auto-reply.config.ts',
        'src/auto-reply/continuation/delegate-dispatch.chain-depth-exhaustion.test.ts', '--reporter=verbose',
      ],
      exitCode: dispatchRun.exitCode,
      asserted: dispatchAssertions,
    },
    exactCandidateDisposableWorktree: true,
    ...candidateRuntimeReceipt,
  };
  writeJson(path.join(artifactDir, 'dispatch-boundary-suite.json'), dispatchBoundaryReceipt);
  const runtimeReceipt = runtimeSurface.runtimeReceipt;
  const typedReceipt = runtimeSurface.typedReceipt;
  const structuredReceiptPassed = Boolean(
    runtimeReceipt?.configuredMaximum === args.maxChainLength &&
      runtimeReceipt?.structuredRejection?.code === 'chain-capped' &&
      runtimeReceipt?.structuredRejection?.currentChainCount === args.maxChainLength &&
      runtimeReceipt?.structuredRejection?.attemptedHop === args.maxChainLength + 1 &&
      runtimeReceipt?.noSpawn?.flowCountBeforeRejectedHop === runtimeReceipt?.noSpawn?.flowCountAfterRejectedHop &&
      runtimeReceipt?.noSpawn?.rejectedReasonAbsentFromDurableFlows === true &&
      runtimeReceipt?.noSpawn?.chainCountUnchanged === true,
  );
  const durableRecoveryPassed = Boolean(
    runtimeReceipt?.durableState?.persistedCount === args.maxChainLength &&
      runtimeReceipt?.durableState?.reloadedCount === args.maxChainLength &&
      runtimeReceipt?.durableState?.recoveredBudgetReason === 'chain-capped' &&
      runtimeReceipt?.durableState?.recoveredAttemptScheduled === false,
  );
  const typedSurfacePassed = Boolean(
    typedReceipt?.configuredMaximum === args.maxChainLength &&
      typedReceipt?.registeredContinueWorkTools === 1 &&
      typedReceipt?.continueWorkToolExecutions === 3 &&
      typedReceipt?.realToolExecutorInvoked === true &&
      typedReceipt?.capturedElections === 3 &&
      typedReceipt?.scheduledFlows?.length === 2 &&
      typedReceipt?.firstOverLimitFlowPresent === false &&
      typedReceipt?.finalInMemoryCount === args.maxChainLength &&
      typedReceipt?.finalPersistedCount === args.maxChainLength &&
      typedReceipt?.capNoticeObserved === true,
  );
  const runtimeSurfacePassed =
    runtimeSurface.passed &&
    Object.values(runtimeSurface.asserted).every(Boolean) &&
    structuredReceiptPassed &&
    durableRecoveryPassed &&
    typedSurfacePassed;

  const runtimeBoundaryReceipt = {
    ...runtimeReceipt,
    passed: structuredReceiptPassed,
    fixtureKind: 'production-scheduleContinuationWorkBatch-plus-recovered-scheduleContinuationWork',
    ...candidateRuntimeReceipt,
  };
  const durableStateRecoveryReceipt = {
    schema: 'openclaw.project81.r-cw-6.durable-state-recovery.v1',
    passed: durableRecoveryPassed,
    configuredMaximum: args.maxChainLength,
    ...runtimeReceipt?.durableState,
    ...candidateRuntimeReceipt,
  };
  const typedToolSurfaceReceipt = {
    ...typedReceipt,
    passed: typedSurfacePassed,
    fixtureKind: 'disposable-exact-candidate-worktree-with-real-attempt-execution-and-typed-tool-capture',
    productionConfigTouched: false,
    productionStateTouched: false,
    sourceDirMutated: false,
    disposableWorktreeCreated: true,
    disposableWorktreeRemoved: runtimeSurface.disposableWorktreeRemoved,
    ...candidateRuntimeReceipt,
  };
  writeJson(path.join(artifactDir, 'runtime-boundary.json'), runtimeBoundaryReceipt);
  writeJson(path.join(artifactDir, 'durable-state-recovery.json'), durableStateRecoveryReceipt);
  writeJson(path.join(artifactDir, 'typed-tool-surface.json'), typedToolSurfaceReceipt);

  for (const raw of [
    '.runtime-boundary.raw.json',
    '.typed-surface.raw.json',
    '.delegate-boundary.raw.json',
  ]) {
    const rawPath = path.join(artifactDir, raw);
    if (existsSync(rawPath)) unlinkSync(rawPath);
  }

  const finalHead = gitHead(sourceDir);
  if (finalHead !== args.candidateSha) {
    throw new Error(`candidate source HEAD changed during fixture: expected ${args.candidateSha}, found ${finalHead}`);
  }
  assertTrackedSourceClean(sourceDir, 'final cleanup/result receipt');
  const verdict = matrixPassed && dispatchPassed && runtimeSurfacePassed ? 'PASS-candidate' : 'FAIL-fixture';
  const cleanupReceipt = {
    schema: 'openclaw.project81.r-cw-6.cleanup.v1',
    productionConfigTouched: false,
    productionStateTouched: false,
    gatewayStarted: false,
    sourceMutated: false,
    sourceHeadMatchesCandidateAfter: finalHead === args.candidateSha,
    sourceTrackedCleanAfter: true,
    disposableWorktreeRemoved: runtimeSurface.disposableWorktreeRemoved,
    cleanupRequired: false,
    result: 'disposable process-local fixture left no gateway/config/fleet-state process to restore',
    ...candidateRuntimeReceipt,
  };
  writeJson(path.join(artifactDir, 'cleanup.json'), cleanupReceipt);
  const result = {
    schema: 'openclaw.project81.r-cw-6.fixture-result.v1',
    verdict,
    candidateSha: args.candidateSha,
    maxChainLength: args.maxChainLength,
    dependencyProvenance: candidateRuntimeReceipt,
    receipts: {
      fixtureReadiness: 'fixture-readiness.json',
      boundaryMatrix: 'boundary-matrix.json',
      runtimeBoundary: 'runtime-boundary.json',
      durableStateRecovery: 'durable-state-recovery.json',
      typedToolSurface: 'typed-tool-surface.json',
      dispatchBoundarySuite: 'dispatch-boundary-suite.json',
      cleanup: 'cleanup.json',
      publicArtifactSafety: 'public-artifact-safety.json',
    },
    checks: {
      matrixPassed,
      dispatchPassed,
      runtimeSurfacePassed,
      structuredChainCapped: structuredReceiptPassed,
      noRejectedHopSpawn: structuredReceiptPassed && dispatchPassed && typedSurfacePassed,
      durableRecoveryPassed,
      typedSurfacePassed,
      exactCandidateDisposableWorktree: runtimeSurface.disposableWorktreeRemoved,
      candidatePackageManagerVersionMatchesExecuting:
        candidateRuntimeReceipt.candidatePackageManagerVersion ===
        candidateRuntimeReceipt.executingPackageManagerVersion,
      installedGraphMatchesCandidate: candidateRuntimeReceipt.installedGraphMatchesCandidate,
      verifiedDependencyTreeContainsLocalExecutables: Object.values(
        candidateRuntimeReceipt.localExecutableContract,
      ).every((contract) => contract.realpathWithinVerifiedDependencyTree === true),
      worktreeIntegrityAfterInstall:
        candidateRuntimeReceipt.worktreeIntegrity.afterInstall.headMatchesCandidate === true &&
        candidateRuntimeReceipt.worktreeIntegrity.afterInstall.trackedClean === true,
      worktreeIntegrityAfterProofSurfaces:
        candidateRuntimeReceipt.worktreeIntegrity.afterProofSurfaces?.headMatchesCandidate === true &&
        candidateRuntimeReceipt.worktreeIntegrity.afterProofSurfaces?.trackedClean === true,
      publicArtifactsSafe: true,
    },
  };
  const publicReceiptEntries = [
    ['fixture-readiness.json', readiness],
    ['boundary-matrix.json', boundaryMatrixReceipt],
    ['runtime-boundary.json', runtimeBoundaryReceipt],
    ['durable-state-recovery.json', durableStateRecoveryReceipt],
    ['typed-tool-surface.json', typedToolSurfaceReceipt],
    ['dispatch-boundary-suite.json', dispatchBoundaryReceipt],
    ['cleanup.json', cleanupReceipt],
    ['fixture-result.json', result],
  ];
  const expectedPreFinalFiles = publicReceiptEntries
    .slice(0, -1)
    .map(([label]) => label)
    .toSorted();
  const actualPreFinalFiles = readdirSync(artifactDir).toSorted();
  if (JSON.stringify(actualPreFinalFiles) !== JSON.stringify(expectedPreFinalFiles)) {
    throw new Error('artifact directory contains a missing or unexpected file before final receipts');
  }
  const privatePaths = [sourceDir, artifactDir, runtimeSurface.privateWorktreePath];
  for (const [label, value] of publicReceiptEntries) {
    assertPublicArtifactSafe(value, { label, privatePaths });
  }
  const publicArtifactSafetyReceipt = {
    schema: 'openclaw.project81.r-cw-6.public-artifact-safety.v1',
    passed: true,
    checkedReceipts: publicReceiptEntries.map(([label]) => label),
    privateFilesystemPathsAbsent: true,
    prohibitedFieldsAbsent: true,
  };
  assertPublicArtifactSafe(publicArtifactSafetyReceipt, {
    label: 'public-artifact-safety.json',
    privatePaths,
  });
  writeJson(path.join(artifactDir, 'public-artifact-safety.json'), publicArtifactSafetyReceipt);
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
    else console.log(`R-CW-6 fixture: ${result.verdict} (${result.candidateSha})`);
    process.exitCode = result.verdict === 'PASS-candidate' ? 0 : 1;
  }
} catch (error) {
  console.error(`R-CW-6 fixture failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
}
