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
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import { resolveCandidateNodeBin } from './lib/candidate-executables.mjs';
import {
  candidateVitestEnv,
  runCandidateVitestSuite,
  selectCandidateVitestConfig,
} from './lib/candidate-vitest-suite.mjs';
import { readPnpmEnvDocumentPins, splitPnpmLockfile } from './lib/pnpm-lockfile-documents.mjs';

const DEFAULT_CAP = 100;
const CHILD_OUTPUT_LIMIT_BYTES = 64 * 1024 * 1024;
const TRUSTED_GIT = '/usr/bin/git';
const TRUSTED_SH = '/bin/sh';
const DISPATCH_SUITE = 'src/auto-reply/continuation/delegate-dispatch.cost-cap-exhaustion.test.ts';
const SOURCE_MARKERS = [
  'src/auto-reply/continuation/scheduler.ts',
  DISPATCH_SUITE,
  'package.json',
  'pnpm-lock.yaml',
];
const TOOL_SURFACE_FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/r-cw-5');
const TOOL_SURFACE_TEST_FILE = 'test/r-cw-5-fixture/cost-cap-tool-surface.test.ts';
const OVER_CAP_TOOL_TEST = 'rejects exhausted typed-tool elections without a durable continuation';
// Where a candidate records continuation work durably, chosen by the store
// module its runtime writes through. Continuation custody (fork #1408) runs
// through the shared-state worker, so its template runs as the infra project,
// which hosts the database-worker-core suites and collects the template from
// the include file the candidate's scoped configs read. A candidate whose
// custody runtime predates its test support (d71e6bcd3d..91aaf10f9f^) fails
// closed on that missing import rather than falling back to a TaskFlow
// registry nothing writes. Upstream 6652f7eac8 removed the TaskFlow runtime,
// which the auto-reply shard ran through --dir. Each template's positive
// control must see the store record a below-cap election, so that "no
// record" over the cap cannot hold vacuously.
const TOOL_SURFACE_STORES = [
  {
    durableStore: 'continuation-custody',
    marker: 'src/auto-reply/continuation/custody/custody-store.ts',
    template: 'cost-cap-tool-surface.custody.test.ts',
    config: 'test/vitest/vitest.infra.config.ts',
    collectBy: 'include-file',
    expectedTests: {
      overCapRejected: [OVER_CAP_TOOL_TEST],
      belowCapSchedulesDurableWork: ['schedules a below-cap typed-tool election as one durable custody record'],
    },
  },
  {
    durableStore: 'task-flow',
    marker: 'src/tasks/task-flow-registry.ts',
    template: 'cost-cap-tool-surface.test.ts',
    config: 'test/vitest/vitest.auto-reply.config.ts',
    collectBy: 'dir',
    expectedTests: {
      overCapRejected: [OVER_CAP_TOOL_TEST],
      belowCapSchedulesDurableWork: ['schedules a below-cap typed-tool election as one durable TaskFlow'],
    },
  },
];

function usage() {
  return `Usage: node tools/k6-proofs/scripts/run-cost-cap-fixture.mjs \\
  --source-dir <exact-candidate-worktree> \\
  --candidate-sha <40-hex-sha> \\
  --artifact-dir <safe-output-dir> [--cap <positive-int>] [--json]`;
}

export function parseArgs(argv, env = process.env) {
  const args = {
    sourceDir: env.OPENCLAW_RCW5_SOURCE_DIR || '',
    candidateSha: env.OPENCLAW_CANDIDATE_SHA || '',
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
    else if (arg === '--artifact-dir') args.artifactDir = next();
    else if (arg === '--cap') args.cap = Number(next());
    else throw new Error(`unexpected argument: ${arg}`);
  }
  return args;
}

function assertArgs(args) {
  if (!args.sourceDir) throw new Error('--source-dir or OPENCLAW_RCW5_SOURCE_DIR is required');
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
  const packageManager = packageJson?.packageManager;
  const match = typeof packageManager === 'string' &&
    /^pnpm@(\d+\.\d+\.\d+)\+sha512\.([a-f0-9]{128})$/u.exec(packageManager);
  if (!match) {
    throw new Error('candidate package.json must pin pnpm with an exact version and sha512 integrity');
  }
  return { packageManager, pnpmVersion: match[1], integrityHex: match[2] };
}

// `candidateLockfile` is the committed pnpm-lock.yaml the caller has already
// verified. The env-document pins that bind the toolchain come from those
// bytes, never from a later read of the worktree.
export function resolvePinnedPnpm(worktreeDir, candidateLockfile) {
  const { packageManager, pnpmVersion, integrityHex } = requireCandidatePackageManager(worktreeDir);
  const nodePrefix = path.resolve(path.dirname(process.execPath), '..');
  const npmScript = path.join(nodePrefix, 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js');
  if (!existsSync(npmScript) || !lstatSync(npmScript).isFile() || lstatSync(npmScript).isSymbolicLink()) {
    throw new Error('runner has no real Node-local npm script for installing the candidate packageManager pin');
  }
  const resolvedNpmScript = realpathSync(npmScript);
  assertReservedPathAbsent(worktreeDir, '.r-cw-5-pnpm-toolchain');
  const toolchainDir = preparePrivateWorktreeDirectory(worktreeDir, '.r-cw-5-pnpm-toolchain');
  const packageManagerEnv = privatePackageManagerEnv(worktreeDir);
  const install = run(
    process.execPath,
    [
      resolvedNpmScript,
      'install',
      '--prefix',
      toolchainDir,
      '--ignore-scripts',
      '--package-lock=true',
      '--save=false',
      '--no-audit',
      '--no-fund',
      '--prefer-offline',
      '--registry=https://registry.npmjs.org',
      `pnpm@${pnpmVersion}`,
    ],
    { cwd: toolchainDir, env: packageManagerEnv },
  );
  if (!install.ok) {
    throw new Error(`cannot install candidate-pinned pnpm: ${install.stderr.trim()}`);
  }
  return verifyInstalledPinnedPnpm({
    worktreeDir,
    toolchainDir,
    pin: { packageManager, pnpmVersion, integrityHex },
    packageManagerEnv,
    candidateLockfile,
  });
}

export function verifyInstalledPinnedPnpm({ worktreeDir, toolchainDir, pin, packageManagerEnv, candidateLockfile }) {
  const { packageManager, pnpmVersion, integrityHex } = pin;
  if (!Buffer.isBuffer(candidateLockfile)) {
    throw new Error('pinned pnpm verification requires the verified candidate lockfile bytes');
  }
  const toolchainLock = JSON.parse(
    readFileSync(path.join(toolchainDir, 'node_modules', '.package-lock.json'), 'utf8'),
  );
  const installedIntegrity = toolchainLock?.packages?.['node_modules/pnpm']?.integrity;
  if (sha512IntegrityHex(installedIntegrity) !== integrityHex) {
    throw new Error('installed pnpm integrity does not match candidate packageManager pin');
  }
  const toolchain = assertToolchainPinnedByCandidateLockfile({
    toolchainLock,
    candidateLockfile: splitPnpmLockfile(candidateLockfile),
    pin,
  });
  const { entry, script } = resolvePinnedPnpmEntry(toolchainDir);
  const { launcher, interpreter } = pinnedPnpmLauncher(script);
  // pnpm 12's launcher downloads a native binary next to itself when npm
  // installed no platform package, and no candidate integrity pins that
  // binary. A pinned pnpm must run from its toolchain as installed.
  const toolchainBefore = toolchainInventory(toolchainDir);
  const versionResult = run(
    interpreter,
    [script, '--version'],
    { cwd: worktreeDir, env: packageManagerEnv },
  );
  if (toolchainInventory(toolchainDir).join('\n') !== toolchainBefore.join('\n')) {
    throw new Error('candidate-pinned pnpm changed its private toolchain while running');
  }
  if (!versionResult.ok) {
    throw new Error(`cannot execute candidate-pinned pnpm: ${versionResult.stderr.trim()}`);
  }
  const version = versionResult.stdout.trim();
  if (version !== pnpmVersion) {
    throw new Error(`installed pnpm version ${version || '<missing>'} does not match candidate pin ${pnpmVersion}`);
  }
  return {
    packageManager,
    pnpmVersion,
    pnpmIntegritySha512: integrityHex,
    pnpmEntry: entry,
    pnpmLauncher: launcher,
    pnpmInterpreter: interpreter,
    pnpmScript: script,
    ...toolchain,
    packageManagerEnv,
  };
}

function sha512IntegrityHex(integrity) {
  const match = typeof integrity === 'string' && /^sha512-([A-Za-z0-9+/]+={0,2})$/u.exec(integrity);
  return match ? Buffer.from(match[1], 'base64').toString('hex') : '';
}

const TOOLCHAIN_LOCK_LOCATION = /^node_modules\/(?:(?:@[^/]+\/)?[^/@][^/]*\/node_modules\/)*((?:@[^/]+\/)?[^/@][^/]*)$/u;

// The packageManager sha512 pins only the pnpm tarball, and pnpm 12 runs a
// native binary from a second package. Every package npm put in the private
// toolchain must therefore be pinned, integrity for integrity, by the
// candidate's own lockfile env document, which records exactly those packages.
function assertToolchainPinnedByCandidateLockfile({ toolchainLock, candidateLockfile, pin }) {
  const pins = candidateLockfile.envDocument === null
    ? null
    : readPnpmEnvDocumentPins(candidateLockfile.envDocument, pin.pnpmVersion);
  if (pins !== null && sha512IntegrityHex(pins.packageIntegrities[`pnpm@${pin.pnpmVersion}`]) !== pin.integrityHex) {
    throw new Error(
      `candidate pnpm-lock.yaml env document integrity for pnpm@${pin.pnpmVersion} does not match the candidate packageManager pin`,
    );
  }
  const toolchainPackages = [];
  for (const [location, installed] of Object.entries(toolchainLock?.packages ?? {})) {
    const name = TOOLCHAIN_LOCK_LOCATION.exec(location)?.[1];
    if (!name) throw new Error(`private pnpm toolchain lock has an unexpected entry: ${location}`);
    const packageId = `${name}@${installed?.version}`;
    toolchainPackages.push(packageId);
    if (location === 'node_modules/pnpm') continue;
    if (pins === null) {
      throw new Error(`candidate pnpm-lock.yaml has no env document to pin private toolchain package ${packageId}`);
    }
    const pinned = pins.packageIntegrities[packageId];
    if (pinned === undefined) {
      throw new Error(`private pnpm toolchain package ${packageId} is not pinned by the candidate pnpm-lock.yaml env document`);
    }
    if (installed.integrity !== pinned) {
      throw new Error(
        `private pnpm toolchain package ${packageId} does not match its candidate pnpm-lock.yaml env document integrity`,
      );
    }
  }
  return {
    candidateLockfileLayout: candidateLockfile.layout,
    packageManagerDependencies: pins?.packageManagerDependencies ?? null,
    toolchainPackages: toolchainPackages.toSorted(),
  };
}

// The pinned package's own package.json names its pnpm command. Published
// layouts differ: pnpm <=10 declares bin/pnpm.cjs, pnpm 11 bin/pnpm.mjs, and
// pnpm 12 a `pnpm` launcher at the package root with no bin/pnpm.cjs at all.
function resolvePinnedPnpmEntry(toolchainDir) {
  const packageDir = path.join(toolchainDir, 'node_modules', 'pnpm');
  const manifest = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
  const declared = typeof manifest?.bin === 'string' ? manifest.bin : manifest?.bin?.pnpm;
  if (typeof declared !== 'string' || declared === '') {
    throw new Error('candidate-pinned pnpm package declares no pnpm bin entry');
  }
  const entry = path.resolve(packageDir, declared);
  if (!isInside(entry, packageDir)) {
    throw new Error('candidate-pinned pnpm bin entry escapes the pinned pnpm package');
  }
  if (!existsSync(entry) || !lstatSync(entry).isFile() || lstatSync(entry).isSymbolicLink()) {
    throw new Error('candidate-pinned pnpm install did not produce a real pnpm script');
  }
  const script = realpathSync(entry);
  if (!isInside(script, realpathSync(path.join(toolchainDir, 'node_modules')))) {
    throw new Error('candidate-pinned pnpm script resolves outside the private toolchain');
  }
  return { entry: path.relative(packageDir, entry).split(path.sep).join('/'), script };
}

// npm links a declared bin and the kernel runs it: a `#!` line names the
// interpreter, and a file without one is retried under the POSIX shell. pnpm
// 12's launcher is shebang-less on purpose. Both kinds run here through a
// trusted absolute interpreter, so PATH can substitute neither.
function pinnedPnpmLauncher(script) {
  const content = readFileSync(script);
  if (content.subarray(0, 2).toString('latin1') === '#!') {
    const newline = content.indexOf(0x0a);
    const shebang = content.subarray(2, newline === -1 ? content.length : newline).toString('utf8').trim();
    const words = shebang.split(/\s+/u);
    const interpreter = words[0] === '/usr/bin/env' ? words.slice(1) : words;
    if (interpreter.length === 1 && path.basename(interpreter[0]) === 'node') {
      return { launcher: 'node', interpreter: process.execPath };
    }
    throw new Error(`candidate-pinned pnpm bin entry requires an unsupported interpreter: #!${shebang}`);
  }
  if (content.includes(0)) {
    throw new Error('candidate-pinned pnpm bin entry is neither a script nor a shell launcher');
  }
  if (statSync(TRUSTED_SH, { throwIfNoEntry: false })?.isFile() !== true) {
    throw new Error(`trusted shell is unavailable: ${TRUSTED_SH}`);
  }
  return { launcher: 'sh', interpreter: TRUSTED_SH };
}

function toolchainInventory(toolchainDir) {
  return readdirSync(toolchainDir, { recursive: true, withFileTypes: true })
    .map((dirent) => {
      const file = path.join(dirent.parentPath, dirent.name);
      const stats = lstatSync(file);
      return `${path.relative(toolchainDir, file)}\0${stats.mode}\0${stats.size}\0${stats.mtimeMs}`;
    })
    .toSorted();
}

// pnpm installs from, and writes to .pnpm/lock.yaml, only the lockfile
// document. A pnpm 12 candidate commits an env document before it.
export function assertVirtualStoreLockMatchesCandidate(worktreeDir, candidateLockfile) {
  const { layout, lockfileDocument } = splitPnpmLockfile(candidateLockfile);
  const virtualStoreLock = path.join(worktreeDir, 'node_modules', '.pnpm', 'lock.yaml');
  const installed = existsSync(virtualStoreLock) ? readFileSync(virtualStoreLock) : null;
  if (installed === null || !installed.equals(lockfileDocument)) {
    throw new Error('disposable pnpm virtual-store lock does not byte-match the committed candidate lockfile document');
  }
  return {
    lockfileLayout: layout,
    lockfileDocumentSha256: createHash('sha256').update(lockfileDocument).digest('hex'),
    virtualStoreLockSha256: createHash('sha256').update(installed).digest('hex'),
  };
}

// The JS entry, not the .bin link: pnpm 12 links bins as sh cmd-shims, which
// Node cannot run (see lib/candidate-executables.mjs).
export function resolveCandidateLocalExecutable(worktreeDir, name) {
  return resolveCandidateNodeBin(worktreeDir, name).script;
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

// The configs that have owned the dispatch boundary suite, newest first.
// Candidate 311bc66fca (fork #1408 L4) moved it onto real continuation custody,
// into the database-worker-core lane that vitest.infra.config.ts runs and
// vitest.auto-reply.config.ts excludes.
const DISPATCH_SUITE_CONFIGS = ['test/vitest/vitest.infra.config.ts', 'test/vitest/vitest.auto-reply.config.ts'];

// The four observable contract points, by the names their tests have carried.
// 311bc66fca renamed the failed-flow test when TaskFlow records became custody
// records; either name pins the same rejected-and-marked-failed contract.
const DISPATCH_CONTRACT_TESTS = {
  belowCapAllowsSpawn: ['allows dispatch when accumulatedChainTokens is 1 below costCapTokens'],
  exactCapAllowsSpawn: ['rejects at exact boundary (accumulatedChainTokens === costCapTokens is NOT over)'],
  overCapRejectsSpawn: ['rejects dispatch when accumulatedChainTokens exceeds costCapTokens by 1'],
  overCapMarksFlowFailed: [
    'marks custody records as failed for cost-cap-rejected delegates',
    'marks TaskFlow records as failed for cost-cap-rejected delegates',
  ],
};

export function runDispatchBoundarySuite({ worktreeDir, vitestExecutable, reportDir }) {
  const suiteSelection = selectCandidateVitestConfig({
    worktreeDir,
    vitestScript: vitestExecutable,
    suite: DISPATCH_SUITE,
    ownerConfigs: DISPATCH_SUITE_CONFIGS,
  });
  const suiteRun = suiteSelection.config
    ? runCandidateVitestSuite({
      worktreeDir,
      vitestScript: vitestExecutable,
      config: suiteSelection.config,
      files: [DISPATCH_SUITE],
      reportPath: path.join(reportDir, 'dispatch-boundary-suite.vitest.json'),
      expectedTests: DISPATCH_CONTRACT_TESTS,
    })
    : null;
  const asserted = Object.fromEntries(
    Object.keys(DISPATCH_CONTRACT_TESTS).map((key) => [key, suiteRun?.tests[key]?.passed === true]),
  );
  return {
    // A green process alone is insufficient: this fixture must keep pinning the
    // four observable contract points, especially the rejected-hop no-spawn
    // behavior and durable failed-flow side effect, each by a test that passed.
    passed: suiteRun?.passed === true && Object.values(asserted).every(Boolean),
    exitCode: suiteRun?.exitCode ?? null,
    command: suiteRun
      ? ['node', '<candidate-local-vitest>', ...suiteRun.args.map((arg) =>
        arg.startsWith('--outputFile.json=') ? '--outputFile.json=<private-vitest-report>' : arg)]
      : null,
    asserted,
    suiteSelection,
    results: suiteRun ? { ...suiteRun.results, tests: suiteRun.tests } : null,
  };
}

// The typed-tool template the fixture renders into the candidate, and the
// Vitest config it runs under, for the durable store the candidate has.
export function selectToolSurface(worktreeDir) {
  const store = TOOL_SURFACE_STORES.find(({ marker }) =>
    statSync(path.join(worktreeDir, marker), { throwIfNoEntry: false })?.isFile() === true);
  return store ? { ...store, template: path.join(TOOL_SURFACE_FIXTURES, store.template) } : null;
}

export function runToolSurface({ worktreeDir, cap, vitestExecutable, reportDir }) {
  const surface = selectToolSurface(worktreeDir);
  if (!surface) {
    return {
      passed: false,
      exitCode: null,
      durableStore: null,
      command: null,
      asserted: { typedToolCaptured: false, overCapRejected: false, rejectedHopNoDurableWork: false },
      results: null,
    };
  }
  if (!existsSync(surface.template)) {
    throw new Error(`tool-surface template missing: ${surface.template}`);
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
    path.join(testDir, path.basename(TOOL_SURFACE_TEST_FILE)),
    renderToolSurfaceTemplate(readFileSync(surface.template, 'utf8'), cap),
    { mode: 0o600 },
  );
  let env = candidateVitestEnv();
  let extraArgs = [];
  // A --dir run names no file: the auto-reply config would narrow its include
  // list to a command-line file outside src/auto-reply and collect nothing.
  let filters = [];
  if (surface.collectBy === 'include-file') {
    const includeFile = path.join(reportDir, 'typed-tool-surface.include.json');
    writeFileSync(includeFile, `${JSON.stringify([TOOL_SURFACE_TEST_FILE])}\n`, { mode: 0o600, flag: 'wx' });
    env = candidateVitestEnv({ OPENCLAW_VITEST_INCLUDE_FILE: includeFile });
    filters = [TOOL_SURFACE_TEST_FILE];
  } else {
    extraArgs = ['--dir', 'test/r-cw-5-fixture'];
  }
  const suiteRun = runCandidateVitestSuite({
    worktreeDir,
    vitestScript: vitestExecutable,
    config: surface.config,
    files: [TOOL_SURFACE_TEST_FILE],
    filters,
    extraArgs,
    env,
    reportPath: path.join(reportDir, 'typed-tool-surface.vitest.json'),
    expectedTests: surface.expectedTests,
  });
  // The over-cap test asserts the system event that names both typed
  // elections, so its pass shows the real attempt runner captured them.
  const overCapRejected = suiteRun.tests.overCapRejected.passed;
  // Its "no durable work" counts only beside the passing positive control, so
  // that it cannot hold vacuously.
  const asserted = {
    typedToolCaptured: overCapRejected,
    overCapRejected,
    rejectedHopNoDurableWork: overCapRejected && suiteRun.tests.belowCapSchedulesDurableWork.passed,
  };
  return {
    passed: suiteRun.passed && Object.values(asserted).every(Boolean),
    exitCode: suiteRun.exitCode,
    durableStore: surface.durableStore,
    command: [
      ...(surface.collectBy === 'include-file' ? ['OPENCLAW_VITEST_INCLUDE_FILE=<private-include-file>'] : []),
      'node', '<candidate-local-vitest>',
      ...suiteRun.args.map((arg) =>
        arg.startsWith('--outputFile.json=') ? '--outputFile.json=<private-vitest-report>' : arg),
    ],
    asserted,
    results: { ...suiteRun.results, tests: suiteRun.tests },
  };
}

function runVerifiedCandidateWorktree({ sourceDir, candidateSha, artifactDir, cap, sourceLockfileSha256 }) {
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
    const candidateLockfile = readFileSync(path.join(worktreeDir, 'pnpm-lock.yaml'));
    if (createHash('sha256').update(candidateLockfile).digest('hex') !== lockfileSha256) {
      throw new Error('disposable candidate lockfile changed after its integrity check');
    }
    const packageManager = resolvePinnedPnpm(worktreeDir, candidateLockfile);
    assertReservedPathAbsent(worktreeDir, '.r-cw-5-pnpm-store');
    const pnpmStoreDir = preparePrivateWorktreeDirectory(worktreeDir, '.r-cw-5-pnpm-store');
    const install = run(
      packageManager.pnpmInterpreter,
      [
        packageManager.pnpmScript,
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
    const virtualStore = assertVirtualStoreLockMatchesCandidate(worktreeDir, candidateLockfile);
    const afterInstall = assertCandidateWorktreeIntegrity(worktreeDir, candidateSha, 'proof execution after install');
    const tsxExecutable = resolveCandidateLocalExecutable(worktreeDir, 'tsx');
    const vitestExecutable = resolveCandidateLocalExecutable(worktreeDir, 'vitest');
    const matrixRun = run(process.execPath, [tsxExecutable, '--eval', matrixEval(cap)], { cwd: worktreeDir });
    const matrix = matrixRun.ok ? parseLastJson(matrixRun.stdout, 'boundary matrix') : null;
    assertReservedPathAbsent(worktreeDir, '.r-cw-5-reports');
    const reportDir = preparePrivateWorktreeDirectory(worktreeDir, '.r-cw-5-reports');
    const dispatchSuite = runDispatchBoundarySuite({ worktreeDir, vitestExecutable, reportDir });
    const toolSurface = runToolSurface({ worktreeDir, cap, vitestExecutable, reportDir });
    const afterExecution = assertCandidateWorktreeIntegrity(worktreeDir, candidateSha, 'final receipt emission');
    return {
      matrixRun,
      matrix,
      dispatchSuite,
      toolSurface,
      dependency: {
        packageManager: packageManager.packageManager,
        pnpmVersion: packageManager.pnpmVersion,
        pnpmIntegritySha512: packageManager.pnpmIntegritySha512,
        pnpmEntry: packageManager.pnpmEntry,
        pnpmLauncher: packageManager.pnpmLauncher,
        installCommand: [
          packageManager.pnpmLauncher,
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
        pnpmToolchainPackages: packageManager.toolchainPackages,
        packageManagerDependencies: packageManager.packageManagerDependencies,
        lockfileSha256,
        lockfileLayout: virtualStore.lockfileLayout,
        lockfileDocumentSha256: virtualStore.lockfileDocumentSha256,
        virtualStoreLockSha256: virtualStore.virtualStoreLockSha256,
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
  });
  const { matrixRun, matrix, dispatchSuite, toolSurface } = verified;
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

  const dispatchPassed = dispatchSuite.passed;
  writeJson(path.join(artifactDir, 'dispatch-boundary-suite.json'), {
    schema: 'openclaw.project81.r-cw-5.dispatch-boundary-suite.v1',
    passed: dispatchPassed,
    exitCode: dispatchSuite.exitCode,
    command: dispatchSuite.command,
    // Test names, not raw logs, are public-safe and pin the no-spawn/cascade
    // assertion without copying arbitrary candidate output into the corpus.
    asserted: dispatchSuite.asserted,
    suiteSelection: dispatchSuite.suiteSelection,
    results: dispatchSuite.results,
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
