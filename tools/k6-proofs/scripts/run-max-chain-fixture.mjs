#!/usr/bin/env node
/**
 * Isolated R-CW-6 max-chain fixture.
 *
 * The fixture never writes fleet OpenClaw config/state and never starts a
 * gateway. It executes the exact candidate's production continuation budget,
 * durable work scheduler, typed continue_work capture, and delegate dispatch
 * boundary from a disposable worktree. Missing receipts fail closed.
 */
import { spawnSync } from 'node:child_process';
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
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import { readPnpmEnvDocumentPins, splitPnpmLockfile } from './lib/pnpm-lockfile-documents.mjs';

const DEFAULT_MAX_CHAIN_LENGTH = 3;
const CANDIDATE_DELEGATE_SUITE = 'src/auto-reply/continuation/delegate-dispatch.chain-depth-exhaustion.test.ts';
const SOURCE_MARKERS = [
  'src/auto-reply/continuation/scheduler.ts',
  'src/auto-reply/continuation/work-dispatch.ts',
  CANDIDATE_DELEGATE_SUITE,
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
const RUNTIME_FIXTURE_FILE = 'test/r-cw-6-runtime-fixture/max-chain-tool-surface.test.ts';
const DELEGATE_FIXTURE_FILE = 'test/r-cw-6-delegate-fixture/max-chain-delegate-boundary.test.ts';
// Continuation custody suites run only in the candidate's database-worker lane:
// the infra config, whose forked pool reaches the host SQLite broker. The
// auto-reply config excludes them, and a file filter it excludes exits 0 with
// no tests. Generated tests join the lane through the candidate's include-file
// override; that variable is never inherited from the operator's shell.
const DATABASE_WORKER_VITEST_CONFIG = 'test/vitest/vitest.infra.config.ts';
const VITEST_INCLUDE_FILE_ENV = 'OPENCLAW_VITEST_INCLUDE_FILE';
const PROOF_SURFACE_VITEST_RUNS = Object.freeze({
  candidateDelegateSuite: {
    args: ['run', '--config', DATABASE_WORKER_VITEST_CONFIG, CANDIDATE_DELEGATE_SUITE, '--reporter=verbose'],
    includeFiles: [],
  },
  selectedDelegateBoundary: {
    args: ['run', '--config', DATABASE_WORKER_VITEST_CONFIG, '--reporter=verbose'],
    includeFiles: [DELEGATE_FIXTURE_FILE],
  },
  runtimeTypedSurface: {
    args: ['run', '--config', DATABASE_WORKER_VITEST_CONFIG, '--reporter=verbose'],
    includeFiles: [RUNTIME_FIXTURE_FILE],
  },
});

function publicVitestCommand(surface) {
  const { args, includeFiles } = PROOF_SURFACE_VITEST_RUNS[surface];
  return {
    command: ['node_modules/.bin/vitest', ...args],
    ...(includeFiles.length > 0 ? { includeFiles } : {}),
  };
}

// A candidate must name one fixed pnpm release.  Corepack-style integrity
// suffixes are allowed only when they begin with `sha`; ranges, tags, and
// alternate package managers never identify one executable version.
const EXACT_PNPM_PACKAGE_MANAGER = /^pnpm@((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)(\+sha[0-9A-Za-z._~+/=-]+)?$/u;

function usage() {
  return `Usage: node tools/k6-proofs/scripts/run-max-chain-fixture.mjs \\
  --source-dir <exact-candidate-worktree> \\
  --candidate-sha <40-hex-sha> \\
  --artifact-dir <safe-output-dir> [--private-dir <private-diagnostics-dir>] \
  [--max-chain-length <integer-at-least-2>] [--json]

A failed proof surface leaves its raw output in --private-dir (default
<artifact-dir>.private), never in the publishable artifact dir.`;
}

export function parseArgs(argv, env = process.env) {
  const args = {
    sourceDir: env.OPENCLAW_RCW6_SOURCE_DIR || '',
    candidateSha: env.OPENCLAW_CANDIDATE_SHA || '',
    artifactDir: env.OPENCLAW_RCW6_ARTIFACT_DIR || '',
    maxChainLength: Number(env.OPENCLAW_RCW6_MAX_CHAIN_LENGTH || DEFAULT_MAX_CHAIN_LENGTH),
    json: false,
    ...(env.OPENCLAW_RCW6_PRIVATE_DIR ? { privateDir: env.OPENCLAW_RCW6_PRIVATE_DIR } : {}),
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
    else if (arg === '--private-dir') args.privateDir = next();
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

// Both streams are kept whatever the exit status: a proof run can exit 0 and
// still fail its surface (for example, a filter that selects no test files).
function run(command, args, options = {}) {
  const child = spawnSync(command, args, {
    ...options,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
  const ok = !child.error && child.status === 0;
  return {
    ok,
    exitCode: typeof child.status === 'number' ? child.status : 1,
    stdout: child.stdout || '',
    stderr: child.stderr || (ok ? '' : child.error?.message || `${command} exited with status ${child.status}`),
  };
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
  if (typeof declaration !== 'string') {
    throw new Error(`dependency provenance requires ${label} to be an exact pnpm@<semver> declaration`);
  }
  const match = EXACT_PNPM_PACKAGE_MANAGER.exec(declaration);
  if (!match) {
    throw new Error(
      `dependency provenance requires ${label} to be exact pnpm@<semver> (optional +sha... suffix only)`,
    );
  }
  return {
    declaration,
    version: match[1],
    integritySuffix: match[2] || '',
  };
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
  const candidateLock = readFileSync(candidateLockPath);
  const installedLock = readFileSync(installedLockPath);
  const candidateLockfileSha256 = createHash('sha256').update(candidateLock).digest('hex');
  const installedLockfileSha256 = createHash('sha256').update(installedLock).digest('hex');
  // pnpm installs from, and writes to .pnpm/lock.yaml, only the lockfile
  // document. A pnpm 12 candidate commits an env document before it.
  const candidateLockfile = splitPnpmLockfile(candidateLock);
  const candidateLockfileDocumentSha256 = createHash('sha256')
    .update(candidateLockfile.lockfileDocument)
    .digest('hex');
  if (
    !candidateLockfile.lockfileDocument.equals(installedLock) ||
    candidateLockfileDocumentSha256 !== installedLockfileSha256
  ) {
    throw new Error(
      'installed node_modules/.pnpm/lock.yaml bytes do not match candidate pnpm-lock.yaml lockfile document',
    );
  }
  const packageManagerDependencies = candidateLockfile.envDocument === null
    ? null
    : readPnpmEnvDocumentPins(candidateLockfile.envDocument, candidatePackageManager.version)
      .packageManagerDependencies;

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
    candidateLockfileSha256,
    candidateLockfileLayout: candidateLockfile.layout,
    candidateLockfileDocumentSha256,
    packageManagerDependencies,
    installedLockfileSha256,
    lockfileMatchesCandidate: true,
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

// A new or empty 0700 directory with no symlink anywhere on its path.
function assertFreshPrivateDirectory(directory, label) {
  const parsed = path.parse(directory);
  let componentPath = parsed.root;
  for (const component of path.relative(parsed.root, directory).split(path.sep)) {
    if (!component) continue;
    componentPath = path.join(componentPath, component);
    if (!existsSync(componentPath)) break;
    if (lstatSync(componentPath).isSymbolicLink()) {
      throw new Error(`${label} path must not contain a symlink component`);
    }
  }
  if (!existsSync(directory)) return false;
  const stats = lstatSync(directory);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error(`${label} must be a real directory, not a file or symlink`);
  }
  if ((stats.mode & 0o077) !== 0) {
    throw new Error(`${label} must not be group/world accessible (mode 0700 required)`);
  }
  if (readdirSync(directory).length !== 0) {
    throw new Error(`${label} must be empty; refusing to overwrite an earlier receipt`);
  }
  return true;
}

export function prepareArtifactDir(input) {
  const artifactDir = path.resolve(input);
  if (!assertFreshPrivateDirectory(artifactDir, 'artifact dir')) {
    mkdirSync(artifactDir, { recursive: true, mode: 0o700 });
  }
  return artifactDir;
}

export function privateDiagnosticsDirFor({ artifactDir, privateDir }) {
  return path.resolve(privateDir || `${path.resolve(artifactDir)}.private`);
}

/**
 * Validate where raw proof-surface output may be retained. The directory is
 * created only when a surface fails, and never inside the publishable
 * artifact dir (or around it).
 */
export function resolvePrivateDiagnosticsDir({ artifactDir, privateDir }) {
  const resolvedArtifactDir = path.resolve(artifactDir);
  const resolved = privateDiagnosticsDirFor({ artifactDir: resolvedArtifactDir, privateDir });
  if (isPathInside(resolvedArtifactDir, resolved) || isPathInside(resolved, resolvedArtifactDir)) {
    throw new Error('private diagnostics dir must be outside the public artifact dir');
  }
  assertFreshPrivateDirectory(resolved, 'private diagnostics dir');
  return resolved;
}

const TERMINAL_SEQUENCES = [
  /\u001b\[[0-9;?]*[ -/]*[@-~]/gu, // CSI
  /\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)?/gu, // OSC: hyperlinks, titles
  /\u001b[ -/]*[0-~]?/gu, // any other escape
];
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/gu;
// Characters that end a path or an identifier inside prose or punctuation.
const TOKEN_END = String.raw`\s"'()<>[\]{}` + '`' + ',;';
const FAILURE_SIGNAL = /\b(?:FAIL|Error|AssertionError|expected|Cannot find|No test files|Test Files|Tests)\b|[×→❯]/u;

/**
 * A public excerpt of a failed proof run: terminal sequences and control
 * characters stripped, private paths replaced by placeholders, any other
 * absolute path, session identifier, or credential-shaped value redacted, the
 * failure lines kept (or the tail when none match), bounded in count and width.
 */
export function sanitizeFailureExcerpt(raw, { replacements = [], maxLines = 40, maxLineLength = 240 } = {}) {
  let text = String(raw).replaceAll('\r', '');
  for (const sequence of TERMINAL_SEQUENCES) text = text.replaceAll(sequence, '');
  text = text.replaceAll(CONTROL_CHARACTERS, '');
  for (const [privatePath, placeholder] of replacements
    .filter(([privatePath]) => privatePath)
    .toSorted(([left], [right]) => right.length - left.length)) {
    text = text.replaceAll(privatePath, placeholder);
  }
  const notInsideToken = String.raw`(?<![\w.>/\\])`;
  text = text
    // Vitest prints candidate module ids root-relative (/src/x.ts); keep
    // those readable, but only source files under the candidate's own roots.
    .replace(
      new RegExp(String.raw`${notInsideToken}\/((?:src|test|extensions|packages)\/[^${TOKEN_END}]*?\.(?:[cm]?[jt]sx?|json))(?=$|[${TOKEN_END}:])`, 'gmu'),
      '$1',
    )
    // Every other absolute path, whatever punctuation precedes it.
    .replace(new RegExp(String.raw`${notInsideToken}\/[^/${TOKEN_END}]+(?:\/[^/${TOKEN_END}]*)*`, 'gmu'), '<path>')
    .replace(new RegExp(String.raw`(?<!\w)[a-z]:[\\/][^${TOKEN_END}]*`, 'gimu'), '<path>')
    .replace(new RegExp(String.raw`(?<!\\)\\\\[^\\${TOKEN_END}]+\\[^${TOKEN_END}]*`, 'gmu'), '<path>')
    .replace(/\bfile:\/\/\S+/giu, '<path>')
    .replace(new RegExp(String.raw`(?<![\w.])~[\\/][^${TOKEN_END}]*`, 'gmu'), '<path>')
    .replace(new RegExp(String.raw`\bagent:[^${TOKEN_END}]+`, 'giu'), '<session-key>')
    .replace(/\b(Bearer|Basic)\s+[^\s"'`,;]+/giu, '$1 <redacted>')
    .replace(
      /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{8,}|\bgh[pousr]_[A-Za-z0-9]{16,}|\bgithub_pat_[A-Za-z0-9_]{16,}|\bxox[abprs]-[A-Za-z0-9-]{8,}|\bAKIA[0-9A-Z]{16}\b|\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/gu,
      '<redacted>',
    )
    .replace(
      /\b((?:api[_-]?key|access[_-]?key|token|secret|password|passwd|authorization|cookie)s?)(\s*[=:]\s*)[^\s"'`,;]+/giu,
      '$1$2<redacted>',
    );
  const lines = text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() && !line.trim().startsWith('[sqlite-test-lifecycle]'));
  const failureLines = lines.filter((line) => FAILURE_SIGNAL.test(line));
  return (failureLines.length > 0 ? failureLines : lines.slice(-20))
    .slice(0, maxLines)
    .map((line) => (line.length > maxLineLength ? `${line.slice(0, maxLineLength - 1)}…` : line));
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
    candidateLockfileLayout: candidateRuntime.candidateLockfileLayout,
    candidateLockfileDocumentSha256: candidateRuntime.candidateLockfileDocumentSha256,
    candidatePackageManagerDependencies: candidateRuntime.candidatePackageManagerDependencies,
    installedLockfileSha256: candidateRuntime.installedLockfileSha256,
    lockfileMatchesCandidate: candidateRuntime.lockfileMatchesCandidate,
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
      candidateLockfileLayout: verifiedDependencies.dependencyProvenance.candidateLockfileLayout,
      candidateLockfileDocumentSha256: verifiedDependencies.dependencyProvenance.candidateLockfileDocumentSha256,
      candidatePackageManagerDependencies: verifiedDependencies.dependencyProvenance.packageManagerDependencies,
      installedLockfileSha256: verifiedDependencies.dependencyProvenance.installedLockfileSha256,
      lockfileMatchesCandidate: verifiedDependencies.dependencyProvenance.lockfileMatchesCandidate,
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
    for (const [file, template] of [
      [RUNTIME_FIXTURE_FILE, TOOL_SURFACE_TEMPLATE],
      [DELEGATE_FIXTURE_FILE, DELEGATE_BOUNDARY_TEMPLATE],
    ]) {
      mkdirSync(path.dirname(path.join(worktreeDir, file)), { recursive: true, mode: 0o700 });
      writeFileSync(
        path.join(worktreeDir, file),
        renderToolSurfaceTemplate(readFileSync(template, 'utf8'), maxChainLength),
        { mode: 0o600 },
      );
    }
    const stateDir = path.join(worktreeDir, '.rcw6-state');
    mkdirSync(stateDir, { recursive: true, mode: 0o700 });
    const isolatedEnv = { ...process.env, OPENCLAW_STATE_DIR: stateDir };
    delete isolatedEnv[VITEST_INCLUDE_FILE_ENV];
    const runVitestSurface = (surface, extraEnv = {}) => {
      const { args, includeFiles } = PROOF_SURFACE_VITEST_RUNS[surface];
      const env = { ...isolatedEnv, ...extraEnv };
      if (includeFiles.length > 0) {
        const includeFile = path.join(stateDir, `${surface}.include.json`);
        writeFileSync(includeFile, `${JSON.stringify(includeFiles)}\n`, { mode: 0o600 });
        env[VITEST_INCLUDE_FILE_ENV] = includeFile;
      }
      return run(verifiedDependencies.executables.vitest, args, { cwd: worktreeDir, env });
    };

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

    const dispatchRun = runVitestSurface('candidateDelegateSuite');
    const dispatchAssertions = {
      atLimitRejectsBeforeSpawn: /rejects a delegate when currentChainCount equals maxChainLength/u.test(
        dispatchRun.stdout,
      ),
      boundaryHopSpawnsThenNextRejects:
        /accepts a delegate at count 9\/10, then rejects the next at 10\/10/u.test(dispatchRun.stdout),
      rejectedFlowMarkedFailed:
        /marks the custody record as failed for chain-depth-rejected delegates/u.test(dispatchRun.stdout),
    };

    const selectedDelegateRun = runVitestSurface('selectedDelegateBoundary', {
      RCW6_DELEGATE_RECEIPT_PATH: rawDelegateReceiptPath,
    });
    const selectedDelegateReceipt = selectedDelegateRun.ok
      ? readJsonIfValid(rawDelegateReceiptPath)
      : null;

    const test = runVitestSurface('runtimeTypedSurface', {
      RCW6_RUNTIME_RECEIPT_PATH: rawRuntimeReceiptPath,
      RCW6_TYPED_RECEIPT_PATH: rawTypedReceiptPath,
    });
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
      runtimeRun: test,
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

// The private dir is created at the first failure, never earlier. Its last
// component is made without `recursive`, and the result is validated again,
// so a directory another process created after the start-up check (a second
// run sharing it, another user under a shared temp root) is refused, never
// reused. Files are created exclusively.
function openPrivateDiagnosticsDir(privateDir) {
  mkdirSync(path.dirname(privateDir), { recursive: true, mode: 0o700 });
  try {
    mkdirSync(privateDir, { mode: 0o700 });
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
  }
  assertFreshPrivateDirectory(privateDir, 'private diagnostics dir');
}

// Raw output of a failed proof surface goes to the private dir; its receipt
// carries only a sanitized excerpt that has already passed the public guard.
// A private copy that cannot be written never costs the public receipts.
function createFailureRetainer({ privateDir, candidateSha, replacements, privatePaths }) {
  const retained = [];
  const notRetained = [];
  let opened = false;
  return {
    retained,
    notRetained,
    retain(surface, run, passed, commandInfo) {
      if (passed) return undefined;
      let privateCopyRetained = false;
      try {
        if (!opened) {
          openPrivateDiagnosticsDir(privateDir);
          opened = true;
        }
        const privateCopy = {
          schema: 'openclaw.project81.r-cw-6.private-proof-surface-diagnostics.v1',
          surface,
          candidateSha,
          ...commandInfo,
          exitCode: run.exitCode,
          stdout: run.stdout,
          stderr: run.stderr,
        };
        writeFileSync(path.join(privateDir, `${surface}.json`), `${JSON.stringify(privateCopy, null, 2)}\n`, {
          mode: 0o600,
          flag: 'wx',
        });
        privateCopyRetained = true;
      } catch {
        // Reported through privateCopyRetained and privateDiagnosticsNotRetainedFor.
      }
      (privateCopyRetained ? retained : notRetained).push(surface);
      let excerpt = sanitizeFailureExcerpt(`${run.stdout}\n${run.stderr}`, { replacements });
      try {
        assertPublicArtifactSafe({ excerpt }, { label: `${surface} failure excerpt`, privatePaths });
      } catch {
        excerpt = ['<excerpt withheld: sanitized text failed public-artifact safety; see the private copy>'];
      }
      return { surface, privateCopyRetained, exitCode: run.exitCode, excerpt };
    },
  };
}

function hostPathReplacements() {
  const tmp = os.tmpdir();
  let realTmp = tmp;
  try {
    realTmp = realpathSync(tmp);
  } catch {
    // An unresolvable temp dir is still replaced by its spelled path.
  }
  return [
    [os.homedir(), '<home>'],
    [tmp, '<tmp>'],
    [realTmp, '<tmp>'],
  ].filter(([hostPath]) => hostPath && hostPath !== path.parse(hostPath).root);
}

export function runFixture(args) {
  assertArgs(args);
  const { resolved: sourceDir, head } = assertSource(args.sourceDir, args.candidateSha);
  const artifactDir = prepareArtifactDir(args.artifactDir);
  const privateDir = resolvePrivateDiagnosticsDir({ artifactDir, privateDir: args.privateDir });

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
  const privatePaths = [sourceDir, artifactDir, privateDir, runtimeSurface.privateWorktreePath];
  const diagnostics = createFailureRetainer({
    privateDir,
    candidateSha: args.candidateSha,
    replacements: [
      [runtimeSurface.privateWorktreePath, '<candidate-worktree>'],
      [artifactDir, '<artifact-dir>'],
      [privateDir, '<private-dir>'],
      [sourceDir, '<source-dir>'],
      ...hostPathReplacements(),
    ],
    privatePaths,
  });
  const candidateRuntimeReceipt = {
    candidateWorktreeHead: runtimeSurface.candidateRuntime.candidateWorktreeHead,
    candidateLockfileSha256: runtimeSurface.candidateRuntime.candidateLockfileSha256,
    candidateLockfileLayout: runtimeSurface.candidateRuntime.candidateLockfileLayout,
    candidateLockfileDocumentSha256: runtimeSurface.candidateRuntime.candidateLockfileDocumentSha256,
    candidatePackageManagerDependencies: runtimeSurface.candidateRuntime.candidatePackageManagerDependencies,
    installedLockfileSha256: runtimeSurface.candidateRuntime.installedLockfileSha256,
    lockfileMatchesCandidate: runtimeSurface.candidateRuntime.lockfileMatchesCandidate,
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
  const matrixCommand = ['node_modules/.bin/tsx', '--eval', '<production-module-eval>'];
  const matrixDiagnostics = diagnostics.retain('boundary-matrix', matrixRun, matrixPassed, {
    command: matrixCommand,
  });
  const boundaryMatrixReceipt = {
    schema: 'openclaw.project81.r-cw-6.boundary-matrix.v1',
    maxChainLength: args.maxChainLength,
    passed: matrixPassed,
    ...(matrix || {}),
    command: matrixCommand,
    exitCode: matrixRun.exitCode,
    ...(matrixDiagnostics ? { failureDiagnostics: matrixDiagnostics } : {}),
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
    spawnedOnlyAcceptedDelegate: selectedDelegateReceipt?.spawnedOnlyAcceptedDelegate === true,
    rejectedFlowFailed: selectedDelegateReceipt?.rejectedFlowStatus === 'failed',
    rejectedRecordFailedForChainCap: selectedDelegateReceipt?.rejectedRecordFailedForChainCap === true,
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
  const selectedDelegateDiagnostics = diagnostics.retain(
    'selected-delegate-boundary',
    runtimeSurface.selectedDelegateRun,
    selectedDelegatePassed,
    publicVitestCommand('selectedDelegateBoundary'),
  );
  const candidateSuiteDiagnostics = diagnostics.retain(
    'candidate-delegate-suite',
    dispatchRun,
    candidateDispatchSuitePassed,
    publicVitestCommand('candidateDelegateSuite'),
  );
  const dispatchBoundaryReceipt = {
    schema: 'openclaw.project81.r-cw-6.dispatch-boundary-suite.v1',
    passed: dispatchPassed,
    configuredMaximum: args.maxChainLength,
    selectedBoundary: {
      ...selectedDelegateReceipt,
      passed: selectedDelegatePassed,
      asserted: selectedDelegateAssertions,
      ...publicVitestCommand('selectedDelegateBoundary'),
      exitCode: runtimeSurface.selectedDelegateRun.exitCode,
      ...(selectedDelegateDiagnostics ? { failureDiagnostics: selectedDelegateDiagnostics } : {}),
    },
    candidateRegressionSuite: {
      passed: candidateDispatchSuitePassed,
      ...publicVitestCommand('candidateDelegateSuite'),
      exitCode: dispatchRun.exitCode,
      asserted: dispatchAssertions,
      ...(candidateSuiteDiagnostics ? { failureDiagnostics: candidateSuiteDiagnostics } : {}),
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
  // One run feeds three receipts; when it fails, all three carry its excerpt.
  const runtimeDiagnostics = diagnostics.retain(
    'runtime-typed-surface',
    runtimeSurface.runtimeRun,
    runtimeSurfacePassed,
    publicVitestCommand('runtimeTypedSurface'),
  );
  const runtimeFailure = runtimeDiagnostics ? { failureDiagnostics: runtimeDiagnostics } : {};

  const runtimeBoundaryReceipt = {
    ...runtimeReceipt,
    passed: structuredReceiptPassed,
    fixtureKind: 'production-scheduleContinuationWorkBatch-plus-recovered-scheduleContinuationWork',
    ...publicVitestCommand('runtimeTypedSurface'),
    ...runtimeFailure,
    ...candidateRuntimeReceipt,
  };
  const durableStateRecoveryReceipt = {
    schema: 'openclaw.project81.r-cw-6.durable-state-recovery.v1',
    passed: durableRecoveryPassed,
    configuredMaximum: args.maxChainLength,
    ...runtimeReceipt?.durableState,
    ...runtimeFailure,
    ...candidateRuntimeReceipt,
  };
  const typedToolSurfaceReceipt = {
    ...typedReceipt,
    passed: typedSurfacePassed,
    fixtureKind: 'disposable-exact-candidate-worktree-with-real-attempt-execution-and-typed-tool-capture',
    ...publicVitestCommand('runtimeTypedSurface'),
    ...runtimeFailure,
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
    privateDiagnosticsRetainedFor: diagnostics.retained,
    privateDiagnosticsNotRetainedFor: diagnostics.notRetained,
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
      installedLockMatchesCandidate: candidateRuntimeReceipt.lockfileMatchesCandidate,
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
    if (result.privateDiagnosticsRetainedFor.length > 0) {
      console.error(
        `R-CW-6 private diagnostics for ${result.privateDiagnosticsRetainedFor.join(', ')} retained in ${privateDiagnosticsDirFor(args)}`,
      );
    }
    if (result.privateDiagnosticsNotRetainedFor.length > 0) {
      console.error(
        `R-CW-6 could not retain private diagnostics for ${result.privateDiagnosticsNotRetainedFor.join(', ')}: ${privateDiagnosticsDirFor(args)} was not a fresh private directory or was not writable`,
      );
    }
    if (args.json) console.log(JSON.stringify(result));
    else console.log(`R-CW-6 fixture: ${result.verdict} (${result.candidateSha})`);
    process.exitCode = result.verdict === 'PASS-candidate' ? 0 : 1;
  }
} catch (error) {
  console.error(`R-CW-6 fixture failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
}
