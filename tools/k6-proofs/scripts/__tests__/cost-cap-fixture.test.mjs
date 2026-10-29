import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertSource,
  assertCandidateWorktreeIntegrity,
  assertSafeLocalGitConfig,
  assertTrackedTreeBytes,
  assertTrackedSourceClean,
  assertVirtualStoreLockMatchesCandidate,
  buildReadiness,
  parseArgs,
  privatePackageManagerEnv,
  prepareArtifactDir,
  resolveCandidateLocalExecutable,
  resolvePinnedPnpm,
  renderToolSurfaceTemplate,
  runDispatchBoundarySuite,
  selectToolSurface,
  verifyInstalledPinnedPnpm,
} from '../run-cost-cap-fixture.mjs';
import {
  COST_CAP_SUITE,
  CUSTODY_TEST_SUPPORT,
  INFRA_CONFIG,
  TASK_FLOW_REGISTRY,
  costCapSuiteAt293c977f62,
  costCapSuiteBefore311bc66fca,
  modeledVitestCandidate,
} from './helpers/modeled-vitest-candidate.mjs';
import {
  PNPM_12_SHIMS,
  modeledCandidateNodeModules,
  modeledToolEntry,
} from './helpers/candidate-node-modules-fixture.mjs';
import {
  LOCKFILE_DOCUMENT,
  PLATFORM_PACKAGE,
  PNPM_12_15_0,
  PNPM_12_ENV_PREFIX,
  modeledIntegrity,
  pnpmEnvPrefix,
  sha256,
  writePnpmToolchain,
} from './helpers/pnpm-toolchain-fixture.mjs';
import { chmod, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const PNPM_11_2_2 =
  'pnpm@11.2.2+sha512.36e6621fad506178936455e70247b8808ef4ec25797a9f437a93281a020484e2607f6a469a22e982987c3dbb8866e3071514ab10a4a1749e06edcd1ec118436f';

const PNPM_12_TARBALL = modeledIntegrity('modeled pnpm 12.15.0 tarball');
const PNPM_12_NATIVE = modeledIntegrity('modeled pnpm 12.15.0 native binary package');
const PNPM_12_PIN = {
  packageManager: `pnpm@12.15.0+sha512.${PNPM_12_TARBALL.hex}`,
  pnpmVersion: '12.15.0',
  integrityHex: PNPM_12_TARBALL.hex,
};

function pnpm12Lockfile(envOverrides = {}) {
  return Buffer.concat([
    pnpmEnvPrefix({
      version: '12.15.0',
      pnpmIntegrity: PNPM_12_TARBALL.sri,
      platformPackages: { [PLATFORM_PACKAGE]: PNPM_12_NATIVE.sri },
      ...envOverrides,
    }),
    LOCKFILE_DOCUMENT,
  ]);
}

// A worktree laid out like the fixture's: the committed candidate lockfile at
// its root and the npm-installed pnpm toolchain in its reserved private path.
async function modeledPinnedToolchain({ candidateLockfile, ...toolchain }) {
  const worktree = await mkdtemp(path.join(os.tmpdir(), 'r-cw-5-modeled-toolchain-'));
  await writeFile(path.join(worktree, 'pnpm-lock.yaml'), candidateLockfile);
  const toolchainDir = path.join(worktree, '.r-cw-5-pnpm-toolchain');
  await writePnpmToolchain(toolchainDir, toolchain);
  return { worktree, toolchainDir };
}

function verifyModeledToolchain({ worktree, toolchainDir }, pin, candidateLockfile) {
  return verifyInstalledPinnedPnpm({
    worktreeDir: worktree,
    toolchainDir,
    pin,
    packageManagerEnv: privatePackageManagerEnv(worktree),
    candidateLockfile: candidateLockfile ?? readFileSync(path.join(worktree, 'pnpm-lock.yaml')),
  });
}

function modeledPnpm12({ candidateLockfile = pnpm12Lockfile(), ...toolchain } = {}) {
  return modeledPinnedToolchain({
    layout: 'pnpm12',
    version: '12.15.0',
    integrityHex: PNPM_12_TARBALL.hex,
    platformPackages: { [PLATFORM_PACKAGE]: PNPM_12_NATIVE.sri },
    candidateLockfile,
    ...toolchain,
  });
}

// The fixture hands each candidate-local tool to the trusted Node binary.
function runUnderNode(executable, args) {
  try {
    const stdout = execFileSync(process.execPath, [executable, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    return {
      status: typeof error.status === 'number' ? error.status : 1,
      stdout: error.stdout?.toString() ?? '',
      stderr: error.stderr?.toString() ?? error.message,
    };
  }
}

async function virtualStoreWorktree(installedLock) {
  const worktree = await mkdtemp(path.join(os.tmpdir(), 'r-cw-5-virtual-store-'));
  await mkdir(path.join(worktree, 'node_modules', '.pnpm'), { recursive: true });
  await writeFile(path.join(worktree, 'node_modules', '.pnpm', 'lock.yaml'), installedLock);
  return worktree;
}

test('R-CW-5 fixture accepts an explicit isolated source contract', () => {
  const parsed = parseArgs([
    'node',
    'run-cost-cap-fixture.mjs',
    '--source-dir',
    '/tmp/exact-openclaw',
    '--candidate-sha',
    '6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d',
    '--artifact-dir',
    '/tmp/rcw5-artifacts',
    '--cap',
    '100',
    '--json',
  ], {});
  assert.deepEqual(parsed, {
    sourceDir: '/tmp/exact-openclaw',
    candidateSha: '6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d',
    artifactDir: '/tmp/rcw5-artifacts',
    cap: 100,
    json: true,
  });
});

test('R-CW-5 fixture refuses unknown arguments', () => {
  assert.throws(
    () => parseArgs(['node', 'run-cost-cap-fixture.mjs', '--mutate-live-config'], {}),
    /unexpected argument: --mutate-live-config/,
  );
});

test('R-CW-5 fixture refuses to overwrite or expose an artifact directory', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'r-cw-5-artifact-test-'));
  const nonEmpty = path.join(root, 'existing');
  await mkdir(nonEmpty, { mode: 0o700 });
  await writeFile(path.join(nonEmpty, 'old-receipt.json'), '{}');
  assert.throws(() => prepareArtifactDir(nonEmpty), /must be empty/);

  const fresh = path.join(root, 'fresh');
  assert.equal(prepareArtifactDir(fresh), fresh);

  const privateParent = path.join(root, 'private-parent');
  const linkedParent = path.join(root, 'linked-parent');
  await mkdir(privateParent, { mode: 0o700 });
  await symlink(privateParent, linkedParent);
  assert.throws(
    () => prepareArtifactDir(path.join(linkedParent, 'new-artifacts')),
    /must not contain a symlink component/,
  );
});

test('R-CW-5 fixture refuses staged or unstaged tracked candidate changes', async () => {
  const source = await mkdtemp(path.join(os.tmpdir(), 'r-cw-5-dirty-source-'));
  await mkdir(path.join(source, 'src/auto-reply/continuation'), { recursive: true });
  await mkdir(path.join(source, 'node_modules'));
  await writeFile(path.join(source, 'src/auto-reply/continuation/scheduler.ts'), 'export const clean = true;\n');
  await writeFile(path.join(source, 'src/auto-reply/continuation/delegate-dispatch.cost-cap-exhaustion.test.ts'), '// marker\n');
  await writeFile(path.join(source, 'package.json'), '{"name":"r-cw-5-test"}\n');
  await writeFile(path.join(source, 'pnpm-lock.yaml'), 'lockfileVersion: "9.0"\n');
  execFileSync('git', ['init'], { cwd: source, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'proof@example.invalid'], { cwd: source });
  execFileSync('git', ['config', 'user.name', 'R-CW-5 fixture test'], { cwd: source });
  execFileSync('git', ['add', 'src', 'package.json', 'pnpm-lock.yaml'], { cwd: source });
  execFileSync('git', ['commit', '-m', 'candidate'], { cwd: source, stdio: 'ignore' });
  const candidateSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim();

  assert.doesNotThrow(() => assertSource(source, candidateSha));

  await writeFile(path.join(source, 'src/auto-reply/continuation/scheduler.ts'), 'export const clean = false;\n');
  assert.throws(
    () => assertSource(source, candidateSha),
    /tracked staged or unstaged changes/,
  );

  execFileSync('git', ['add', 'src/auto-reply/continuation/scheduler.ts'], { cwd: source });
  assert.throws(
    () => assertSource(source, candidateSha),
    /tracked staged or unstaged changes/,
  );
  assert.throws(
    () => assertTrackedSourceClean(source, 'final cleanup/result receipt'),
    /before final cleanup\/result receipt/,
  );
});

test('R-CW-5 fixture rechecks committed candidate files after disposable worktree mutation', async () => {
  const worktree = await mkdtemp(path.join(os.tmpdir(), 'r-cw-5-worktree-integrity-'));
  await writeFile(path.join(worktree, 'package.json'), `${JSON.stringify({ packageManager: PNPM_11_2_2 })}\n`);
  await writeFile(path.join(worktree, 'pnpm-lock.yaml'), 'lockfileVersion: "9.0"\n');
  execFileSync('git', ['init'], { cwd: worktree, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'proof@example.invalid'], { cwd: worktree });
  execFileSync('git', ['config', 'user.name', 'R-CW-5 fixture test'], { cwd: worktree });
  execFileSync('git', ['add', 'package.json', 'pnpm-lock.yaml'], { cwd: worktree });
  execFileSync('git', ['commit', '-m', 'candidate'], { cwd: worktree, stdio: 'ignore' });
  const candidateSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: worktree, encoding: 'utf8' }).trim();

  assert.doesNotThrow(() => assertCandidateWorktreeIntegrity(worktree, candidateSha, 'proof execution after install'));
  await writeFile(path.join(worktree, 'package.json'), '{"packageManager":"pnpm@0.0.0"}\n');
  assert.throws(
    () => assertCandidateWorktreeIntegrity(worktree, candidateSha, 'final receipt emission'),
    /tracked staged or unstaged changes|differs from committed/,
  );
});

test('R-CW-5 fixture ignores fake PATH pnpm and verifies version plus integrity', async () => {
  const worktree = await mkdtemp(path.join(os.tmpdir(), 'r-cw-5-pinned-pnpm-'));
  await writeFile(path.join(worktree, 'package.json'), `${JSON.stringify({ packageManager: PNPM_11_2_2 })}\n`);
  // pnpm 11 commits a single-document lockfile.
  await writeFile(path.join(worktree, 'pnpm-lock.yaml'), LOCKFILE_DOCUMENT);
  const fakeBin = await mkdtemp(path.join(os.tmpdir(), 'r-cw-5-fake-pnpm-'));
  const fakePnpm = path.join(fakeBin, 'pnpm');
  await writeFile(fakePnpm, '#!/bin/sh\necho FAKE-PNPM-RAN >&2\nexit 97\n');
  await chmod(fakePnpm, 0o700);
  const priorPath = process.env.PATH;
  try {
    process.env.PATH = fakeBin;
    const pinned = resolvePinnedPnpm(worktree, LOCKFILE_DOCUMENT);
    assert.equal(pinned.pnpmVersion, '11.2.2');
    assert.equal(pinned.packageManager, PNPM_11_2_2);
    assert.equal(pinned.pnpmIntegritySha512, PNPM_11_2_2.split('+sha512.')[1]);
  } finally {
    process.env.PATH = priorPath;
  }
});

// Real published bytes: pnpm@12.15.0 declares a shebang-less `pnpm` shell
// launcher, ships no bin/pnpm.cjs, and runs its native binary from the
// @pnpm/exe.<target> package npm installs beside it. The candidate pins both
// through its lockfile env document.
test('R-CW-5 installs, binds, and runs the real pnpm 12.15.0 package the candidate pins', async () => {
  const worktree = await mkdtemp(path.join(os.tmpdir(), 'r-cw-5-real-pnpm-12-'));
  await writeFile(path.join(worktree, 'package.json'), `${JSON.stringify({ packageManager: PNPM_12_15_0 })}\n`);
  const candidateLockfile = Buffer.concat([PNPM_12_ENV_PREFIX, LOCKFILE_DOCUMENT]);
  await writeFile(path.join(worktree, 'pnpm-lock.yaml'), candidateLockfile);
  const fakeBin = await mkdtemp(path.join(os.tmpdir(), 'r-cw-5-fake-pnpm-'));
  const fakePnpm = path.join(fakeBin, 'pnpm');
  await writeFile(fakePnpm, '#!/bin/sh\necho FAKE-PNPM-RAN >&2\nexit 97\n');
  await chmod(fakePnpm, 0o700);
  const priorPath = process.env.PATH;
  try {
    process.env.PATH = fakeBin;
    const pinned = resolvePinnedPnpm(worktree, candidateLockfile);
    assert.equal(pinned.pnpmVersion, '12.15.0');
    assert.equal(pinned.packageManager, PNPM_12_15_0);
    assert.equal(pinned.pnpmIntegritySha512, PNPM_12_15_0.split('+sha512.')[1]);
    assert.equal(pinned.pnpmEntry, 'pnpm');
    assert.equal(pinned.pnpmLauncher, 'sh');
    assert.equal(pinned.candidateLockfileLayout, 'env-and-lockfile-documents');
    assert.deepEqual(pinned.packageManagerDependencies, { pnpm: '12.15.0' });
    assert.ok(pinned.toolchainPackages.includes('pnpm@12.15.0'));
    assert.equal(
      pinned.toolchainPackages.filter((entry) => /^@pnpm\/exe\.[a-z0-9-]+@12\.15\.0$/u.test(entry)).length,
      1,
    );
  } finally {
    process.env.PATH = priorPath;
  }
});

test('R-CW-5 runs pinned pnpm 12 through the shell launcher its package.json bin declares', async () => {
  const modeled = await modeledPnpm12();
  const pinned = verifyModeledToolchain(modeled, PNPM_12_PIN);
  assert.equal(pinned.pnpmVersion, '12.15.0');
  assert.equal(pinned.pnpmIntegritySha512, PNPM_12_TARBALL.hex);
  assert.equal(pinned.pnpmEntry, 'pnpm');
  assert.equal(pinned.pnpmLauncher, 'sh');
  assert.equal(
    pinned.pnpmScript,
    await realpath(path.join(modeled.toolchainDir, 'node_modules', 'pnpm', 'pnpm')),
  );
});

test('R-CW-5 still runs a pnpm whose bin is bin/pnpm.cjs with a single-document lockfile', async () => {
  const pnpm10 = modeledIntegrity('modeled pnpm 10.20.0 tarball');
  const modeled = await modeledPinnedToolchain({
    layout: 'pnpm10',
    version: '10.20.0',
    integrityHex: pnpm10.hex,
    candidateLockfile: LOCKFILE_DOCUMENT,
  });
  const pinned = verifyModeledToolchain(modeled, {
    packageManager: `pnpm@10.20.0+sha512.${pnpm10.hex}`,
    pnpmVersion: '10.20.0',
    integrityHex: pnpm10.hex,
  });
  assert.equal(pinned.pnpmVersion, '10.20.0');
  assert.equal(pinned.pnpmIntegritySha512, pnpm10.hex);
  assert.ok(pinned.pnpmScript.endsWith(path.join('node_modules', 'pnpm', 'bin', 'pnpm.cjs')));
});

test('R-CW-5 runs the entry the pinned package declares, not a file it merely ships', async () => {
  const pnpm11 = modeledIntegrity('modeled pnpm 11.22.0 tarball');
  const modeled = await modeledPinnedToolchain({
    layout: 'pnpm11',
    version: '11.22.0',
    integrityHex: pnpm11.hex,
    candidateLockfile: LOCKFILE_DOCUMENT,
  });
  const pinned = verifyModeledToolchain(modeled, {
    packageManager: `pnpm@11.22.0+sha512.${pnpm11.hex}`,
    pnpmVersion: '11.22.0',
    integrityHex: pnpm11.hex,
  });
  assert.equal(pinned.pnpmVersion, '11.22.0');
  assert.equal(pinned.pnpmEntry, 'bin/pnpm.mjs');
  assert.equal(pinned.pnpmLauncher, 'node');
  assert.ok(pinned.pnpmScript.endsWith(path.join('node_modules', 'pnpm', 'bin', 'pnpm.mjs')));
});

test('R-CW-5 rejects a pinned pnpm bin entry outside its own package', async () => {
  const modeled = await modeledPnpm12({ bin: { pnpm: '../escape/pnpm' } });
  await mkdir(path.join(modeled.toolchainDir, 'node_modules', 'escape'), { recursive: true });
  await writeFile(
    path.join(modeled.toolchainDir, 'node_modules', 'escape', 'pnpm'),
    '#!/usr/bin/env node\nconsole.log("12.15.0");\n',
  );
  assert.throws(() => verifyModeledToolchain(modeled, PNPM_12_PIN), /bin entry escapes the pinned pnpm package/);
});

test('R-CW-5 rejects a symlinked pinned pnpm bin entry', async () => {
  const modeled = await modeledPnpm12();
  const launcher = path.join(modeled.toolchainDir, 'node_modules', 'pnpm', 'pnpm');
  await rm(launcher);
  await symlink('bin/pnpm.mjs', launcher);
  assert.throws(
    () => verifyModeledToolchain(modeled, PNPM_12_PIN),
    /candidate-pinned pnpm install did not produce a real pnpm script/,
  );
});

test('R-CW-5 rejects a pinned pnpm bin entry for an interpreter it cannot pin', async () => {
  const modeled = await modeledPnpm12({ entrySource: '#!/usr/bin/env python3\nprint("12.15.0")\n' });
  assert.throws(
    () => verifyModeledToolchain(modeled, PNPM_12_PIN),
    /pinned pnpm bin entry requires an unsupported interpreter/,
  );
});

test('R-CW-5 refuses a pinned pnpm that changes its own toolchain while running', async () => {
  // No platform package was installed, so the pnpm 12 wrapper fetches a native
  // binary next to itself: code that no candidate integrity pins.
  const modeled = await modeledPnpm12({ platformPackages: {} });
  assert.throws(
    () => verifyModeledToolchain(modeled, PNPM_12_PIN),
    /candidate-pinned pnpm changed its private toolchain while running/,
  );
  const wrapperFiles = await readdir(path.join(modeled.toolchainDir, 'node_modules', 'pnpm'));
  assert.ok(wrapperFiles.includes('pnpm-native'), 'the modeled wrapper did take its download path');
});

test('R-CW-5 compares the virtual-store lock with the lockfile document of a pnpm 12 lockfile', async () => {
  const candidate = Buffer.concat([PNPM_12_ENV_PREFIX, LOCKFILE_DOCUMENT]);
  const worktree = await virtualStoreWorktree(LOCKFILE_DOCUMENT);
  const verified = assertVirtualStoreLockMatchesCandidate(worktree, candidate);
  assert.equal(verified.virtualStoreLockSha256, sha256(LOCKFILE_DOCUMENT));
  assert.equal(verified.lockfileDocumentSha256, sha256(LOCKFILE_DOCUMENT));
  assert.equal(verified.lockfileLayout, 'env-and-lockfile-documents');
});

test('R-CW-5 still byte-matches a single-document lockfile', async () => {
  const worktree = await virtualStoreWorktree(LOCKFILE_DOCUMENT);
  const verified = assertVirtualStoreLockMatchesCandidate(worktree, LOCKFILE_DOCUMENT);
  assert.equal(verified.virtualStoreLockSha256, sha256(LOCKFILE_DOCUMENT));
});

test('R-CW-5 rejects lockfile drift in either lockfile layout', async () => {
  const drifted = Buffer.from(LOCKFILE_DOCUMENT.toString('utf8').replace('version: 7.0.0', 'version: 7.0.1'));
  const worktree = await virtualStoreWorktree(drifted);
  for (const candidate of [LOCKFILE_DOCUMENT, Buffer.concat([PNPM_12_ENV_PREFIX, LOCKFILE_DOCUMENT])]) {
    assert.throws(
      () => assertVirtualStoreLockMatchesCandidate(worktree, candidate),
      /virtual-store lock does not byte-match the committed candidate lockfile/,
    );
  }
});

test('R-CW-5 rejects a virtual-store lock that carries the env document pnpm never installs', async () => {
  const candidate = Buffer.concat([PNPM_12_ENV_PREFIX, LOCKFILE_DOCUMENT]);
  const worktree = await virtualStoreWorktree(candidate);
  assert.throws(
    () => assertVirtualStoreLockMatchesCandidate(worktree, candidate),
    /virtual-store lock does not byte-match the committed candidate lockfile/,
  );
});

test('R-CW-5 rejects a candidate lockfile with more than two YAML documents', async () => {
  const candidate = Buffer.concat([PNPM_12_ENV_PREFIX, LOCKFILE_DOCUMENT, Buffer.from('---\n'), LOCKFILE_DOCUMENT]);
  const worktree = await virtualStoreWorktree(LOCKFILE_DOCUMENT);
  assert.throws(
    () => assertVirtualStoreLockMatchesCandidate(worktree, candidate),
    /more than two YAML documents/,
  );
});

test('R-CW-5 requires the env document to pin the pnpm version it resolved', async () => {
  const modeled = await modeledPnpm12({ candidateLockfile: pnpm12Lockfile({ pinnedVersion: '12.14.0' }) });
  assert.throws(
    () => verifyModeledToolchain(modeled, PNPM_12_PIN),
    /env document pins pnpm 12\.14\.0, not the resolved pnpm 12\.15\.0/,
  );
});

test('R-CW-5 requires the env document pnpm integrity to equal the packageManager pin', async () => {
  const other = modeledIntegrity('a different pnpm 12.15.0 tarball');
  const modeled = await modeledPnpm12({ candidateLockfile: pnpm12Lockfile({ pnpmIntegrity: other.sri }) });
  assert.throws(
    () => verifyModeledToolchain(modeled, PNPM_12_PIN),
    /env document integrity for pnpm@12\.15\.0 does not match the candidate packageManager pin/,
  );
});

test('R-CW-5 binds the installed native-binary package to the candidate env document', async () => {
  const other = modeledIntegrity('a different native binary package');
  const modeled = await modeledPnpm12({
    candidateLockfile: pnpm12Lockfile({ platformPackages: { [PLATFORM_PACKAGE]: other.sri } }),
  });
  assert.throws(
    () => verifyModeledToolchain(modeled, PNPM_12_PIN),
    (error) => error.message.includes(
      `${PLATFORM_PACKAGE}@12.15.0 does not match its candidate pnpm-lock.yaml env document integrity`,
    ),
  );
});

test('R-CW-5 takes env pins from the verified lockfile bytes, not a later read of the worktree', async () => {
  // The worktree copy agrees with the installed toolchain; the bytes whose
  // sha256 the fixture verified pin a different native binary.
  const modeled = await modeledPnpm12();
  const verified = pnpm12Lockfile({
    platformPackages: { [PLATFORM_PACKAGE]: modeledIntegrity('the committed native binary package').sri },
  });
  assert.throws(
    () => verifyModeledToolchain(modeled, PNPM_12_PIN, verified),
    (error) => error.message.includes(
      `${PLATFORM_PACKAGE}@12.15.0 does not match its candidate pnpm-lock.yaml env document integrity`,
    ),
  );
});

test('R-CW-5 refuses toolchain packages the candidate lockfile does not pin', async () => {
  const unpinned = await modeledPnpm12({ candidateLockfile: pnpm12Lockfile({ platformPackages: {} }) });
  assert.throws(
    () => verifyModeledToolchain(unpinned, PNPM_12_PIN),
    /@12\.15\.0 is not pinned by the candidate pnpm-lock\.yaml env document/,
  );
  const singleDocument = await modeledPnpm12({ candidateLockfile: LOCKFILE_DOCUMENT });
  assert.throws(
    () => verifyModeledToolchain(singleDocument, PNPM_12_PIN),
    /has no env document to pin private toolchain package/,
  );
});

// pnpm 12.15.0 links node_modules/.bin/tsx and .bin/vitest as sh cmd-shims, not
// symlinks, so `node <realpath(.bin/x)>` hands Node a shell script.
test('R-CW-5 runs pnpm 12 cmd-shim tools through the JS entry their package declares', async () => {
  const worktree = await modeledCandidateNodeModules({ layout: 'pnpm12' });
  for (const name of ['tsx', 'vitest']) {
    const executable = resolveCandidateLocalExecutable(worktree, name);
    const result = runUnderNode(executable, ['--probe']);
    assert.equal(result.status, 0, `node <candidate-local ${name}> failed:\n${result.stderr}`);
    assert.deepEqual(JSON.parse(result.stdout), { tool: name, argv: ['--probe'] });
  }
});

test('R-CW-5 still runs pnpm 11 symlinked tools from the same JS entry', async () => {
  const worktree = await modeledCandidateNodeModules({ layout: 'pnpm11' });
  for (const name of ['tsx', 'vitest']) {
    const executable = resolveCandidateLocalExecutable(worktree, name);
    assert.equal(executable, await realpath(modeledToolEntry(worktree, name)));
    const result = runUnderNode(executable, ['--probe']);
    assert.equal(result.status, 0, `node <candidate-local ${name}> failed:\n${result.stderr}`);
    assert.deepEqual(JSON.parse(result.stdout), { tool: name, argv: ['--probe'] });
  }
});

test('R-CW-5 refuses a cmd-shim that targets anything but the declared entry', async () => {
  const shim = PNPM_12_SHIMS.tsx.toString('utf8').replaceAll('/dist/cli.mjs', '/dist/other.mjs');
  const worktree = await modeledCandidateNodeModules({ layout: 'pnpm12', tools: ['tsx'], overrides: { tsx: { shim } } });
  await writeFile(path.join(path.dirname(modeledToolEntry(worktree, 'tsx')), 'other.mjs'), 'console.log("other");\n');
  assert.throws(
    () => resolveCandidateLocalExecutable(worktree, 'tsx'),
    /candidate-local tsx \.bin cmd-shim does not target the bin entry its package declares/,
  );
});

const DISPATCH_CONTRACT_KEYS = ['belowCapAllowsSpawn', 'exactCapAllowsSpawn', 'overCapRejectsSpawn', 'overCapMarksFlowFailed'];

async function runModeledDispatchSuite(model) {
  const candidate = await modeledVitestCandidate(model);
  return runDispatchBoundarySuite({
    worktreeDir: candidate.worktree,
    vitestExecutable: candidate.vitestScript,
    reportDir: candidate.reportDir,
  });
}

// Candidate 311bc66fca moved the cost-cap dispatch suite into the
// database-worker-core lane, which vitest.auto-reply.config.ts excludes, and
// renamed its TaskFlow test onto custody. The candidate's reporter also
// redacts the exact-boundary test name.
test('R-CW-5 proves the dispatch boundary where candidate 293c977f62 now runs it', async () => {
  const result = await runModeledDispatchSuite(costCapSuiteAt293c977f62());
  assert.deepEqual(result.asserted, Object.fromEntries(DISPATCH_CONTRACT_KEYS.map((key) => [key, true])));
  assert.equal(result.passed, true);
});

test('R-CW-5 still proves the dispatch boundary in the auto-reply shard before 311bc66fca', async () => {
  const result = await runModeledDispatchSuite(costCapSuiteBefore311bc66fca());
  assert.deepEqual(result.asserted, Object.fromEntries(DISPATCH_CONTRACT_KEYS.map((key) => [key, true])));
  assert.equal(result.passed, true);
});

test('R-CW-5 never counts a skipped dispatch contract test as proved', async () => {
  const model = costCapSuiteBefore311bc66fca();
  model.suites[COST_CAP_SUITE] = model.suites[COST_CAP_SUITE].map((entry) =>
    entry.name === 'rejects dispatch when accumulatedChainTokens exceeds costCapTokens by 1'
      ? { ...entry, status: 'skipped' }
      : entry);
  const result = await runModeledDispatchSuite(model);
  assert.equal(result.asserted.overCapRejectsSpawn, false);
  assert.equal(result.passed, false);
});

test('R-CW-5 never passes a dispatch suite in which no test ran', async () => {
  for (const model of [costCapSuiteBefore311bc66fca(), costCapSuiteAt293c977f62()]) {
    model.suites[COST_CAP_SUITE] = [];
    const result = await runModeledDispatchSuite(model);
    assert.deepEqual(result.asserted, Object.fromEntries(DISPATCH_CONTRACT_KEYS.map((key) => [key, false])));
    assert.equal(result.passed, false);
  }
});

test('R-CW-5 records which candidate config owns the dispatch suite and how each name matched', async () => {
  const result = await runModeledDispatchSuite(costCapSuiteAt293c977f62());
  assert.equal(result.suiteSelection.config, INFRA_CONFIG);
  assert.deepEqual(
    result.suiteSelection.probes.map(({ config, collected }) => ({ config, collected })),
    [
      { config: INFRA_CONFIG, collected: true },
      { config: 'test/vitest/vitest.auto-reply.config.ts', collected: false },
    ],
  );
  assert.deepEqual(result.command.slice(0, 6), ['node', '<candidate-local-vitest>', 'run', '--config', INFRA_CONFIG, COST_CAP_SUITE]);
  assert.ok(result.command.includes('--outputFile.json=<private-vitest-report>'));
  assert.deepEqual(result.results.totals, { tests: 5, passed: 5, failed: 0, skipped: 0, todo: 0 });
  assert.deepEqual(result.results.tests.exactCapAllowsSpawn, {
    passed: true,
    name: 'rejects at exact boundary (accumulatedChainTokens === costCapTokens is NOT over)',
    status: 'passed',
    reportedTitleRedacted: true,
    declaredVerbatimInSuite: true,
  });
  assert.equal(result.results.tests.overCapMarksFlowFailed.name, 'marks custody records as failed for cost-cap-rejected delegates');
  assert.doesNotMatch(JSON.stringify(result), /modeled-vitest-(?:candidate|reports)-/u);
});

// The candidate's scoped configs replace their include list with the files an
// OPENCLAW_VITEST_INCLUDE_FILE names, so an operator's inherited one would
// change which files the fixture's own selection and run see.
test('R-CW-5 selects and runs the dispatch suite regardless of an inherited Vitest include file', async () => {
  const candidate = await modeledVitestCandidate(costCapSuiteAt293c977f62());
  const inherited = path.join(candidate.reportDir, 'inherited-include.json');
  await writeFile(inherited, JSON.stringify(['src/auto-reply/continuation/delegate-dispatch.test.ts']));
  const prior = process.env.OPENCLAW_VITEST_INCLUDE_FILE;
  process.env.OPENCLAW_VITEST_INCLUDE_FILE = inherited;
  try {
    const result = runDispatchBoundarySuite({
      worktreeDir: candidate.worktree,
      vitestExecutable: candidate.vitestScript,
      reportDir: candidate.reportDir,
    });
    assert.equal(result.suiteSelection.config, INFRA_CONFIG);
    assert.equal(result.passed, true);
  } finally {
    if (prior === undefined) delete process.env.OPENCLAW_VITEST_INCLUDE_FILE;
    else process.env.OPENCLAW_VITEST_INCLUDE_FILE = prior;
  }
});

test('R-CW-5 fails closed when no candidate config, or more than one, collects the dispatch suite', async () => {
  const unowned = costCapSuiteAt293c977f62();
  unowned.configs[INFRA_CONFIG].files = [];
  const ambiguous = costCapSuiteAt293c977f62();
  ambiguous.configs['test/vitest/vitest.auto-reply.config.ts'].files = [COST_CAP_SUITE];
  for (const model of [unowned, ambiguous]) {
    const result = await runModeledDispatchSuite(model);
    assert.equal(result.suiteSelection.config, null);
    assert.equal(result.passed, false);
    assert.equal(result.exitCode, null);
  }
});

// The candidate modules the typed-tool templates import, as each candidate
// tree has them. Upstream 6652f7eac8 removed the TaskFlow registry; custody
// test support arrived with fork 91aaf10f9f; 91aaf10f9f..311bc66fca ship both.
const TEMPLATE_RUNTIME_MODULES = [
  'src/config/config.ts',
  'src/config/sessions/session-accessor.ts',
  'src/config/sessions.ts',
  'src/config/types.openclaw.ts',
  'src/infra/system-events.ts',
  'src/agents/command/attempt-execution.ts',
  'src/agents/cli-runner.ts',
  'src/agents/model-selection.ts',
  'src/agents/provider-auth-aliases.ts',
  'src/agents/model-runtime-aliases.ts',
  'src/agents/embedded-agent.ts',
];
const CANDIDATE_TEMPLATE_MODULES = {
  '293c977f62': [...TEMPLATE_RUNTIME_MODULES, CUSTODY_TEST_SUPPORT],
  '311bc66fca': [...TEMPLATE_RUNTIME_MODULES, CUSTODY_TEST_SUPPORT, TASK_FLOW_REGISTRY],
  '80311e8a': [...TEMPLATE_RUNTIME_MODULES, TASK_FLOW_REGISTRY],
};

async function candidateTree(modules) {
  const worktree = await mkdtemp(path.join(os.tmpdir(), 'r-cw-5-candidate-tree-'));
  for (const module of modules) {
    await mkdir(path.dirname(path.join(worktree, module)), { recursive: true });
    await writeFile(path.join(worktree, module), '// modeled candidate module\n');
  }
  return worktree;
}

// Every `../../src/...js` specifier a template imports or mocks, as the
// candidate TypeScript module it names from test/r-cw-5-fixture.
function templateCandidateImports(source) {
  return [...new Set([...source.matchAll(/["'](\.\.\/\.\.\/src\/[^"']+)\.js["']/gu)]
    .map((match) => path.posix.join('test/r-cw-5-fixture', `${match[1]}.ts`)))].sort();
}

// The TaskFlow-era template imports src/tasks/task-flow-registry.js, which
// candidate 293c977f62 no longer has: its typed-tool test died with
// "Cannot find module '/src/tasks/task-flow-registry.js'".
test('R-CW-5 renders a typed-tool template whose candidate imports the candidate has', async () => {
  const modules = CANDIDATE_TEMPLATE_MODULES['293c977f62'];
  const surface = selectToolSurface(await candidateTree(modules));
  const imports = templateCandidateImports(await readFile(surface.template, 'utf8'));
  assert.deepEqual(imports.filter((module) => !modules.includes(module)), []);
});

test('R-CW-5 still renders the TaskFlow template for a TaskFlow-era candidate', async () => {
  const modules = CANDIDATE_TEMPLATE_MODULES['80311e8a'];
  const surface = selectToolSurface(await candidateTree(modules));
  const imports = templateCandidateImports(await readFile(surface.template, 'utf8'));
  assert.ok(imports.includes(TASK_FLOW_REGISTRY));
  assert.deepEqual(imports.filter((module) => !modules.includes(module)), []);
});

test('R-CW-5 picks the custody template where a candidate ships both stores, and none where it ships neither', async () => {
  const both = selectToolSurface(await candidateTree(CANDIDATE_TEMPLATE_MODULES['311bc66fca']));
  assert.equal(both.durableStore, 'continuation-custody');
  assert.equal(both.config, INFRA_CONFIG);
  assert.equal(path.basename(both.template), 'cost-cap-tool-surface.custody.test.ts');
  assert.equal(selectToolSurface(await candidateTree(TEMPLATE_RUNTIME_MODULES)), null);
});

test('R-CW-5 fixture confines package-manager state and rejects inherited hooks', async () => {
  const worktree = await mkdtemp(path.join(os.tmpdir(), 'r-cw-5-private-pm-env-'));
  const prior = {
    npmConfigPnpmfile: process.env.npm_config_pnpmfile,
    pnpmConfigGlobalPnpmfile: process.env.PNPM_CONFIG_GLOBAL_PNPMFILE,
  };
  try {
    process.env.npm_config_pnpmfile = '/tmp/untrusted-pnpmfile.cjs';
    process.env.PNPM_CONFIG_GLOBAL_PNPMFILE = '/tmp/untrusted-global-pnpmfile.cjs';
    const env = privatePackageManagerEnv(worktree);
    assert.equal(env.npm_config_pnpmfile, undefined);
    assert.equal(env.PNPM_CONFIG_GLOBAL_PNPMFILE, undefined);
    assert.equal(env.HOME, path.join(worktree, '.r-cw-5-home'));
    assert.equal(env.NPM_CONFIG_CACHE, path.join(worktree, '.r-cw-5-cache', 'npm'));
    assert.equal(env.NPM_CONFIG_USERCONFIG, path.join(worktree, '.r-cw-5-config', 'npm-user.rc'));
    assert.equal(env.NPM_CONFIG_GLOBALCONFIG, path.join(worktree, '.r-cw-5-config', 'npm-global.rc'));
    assert.equal(env.PNPM_HOME, path.join(worktree, '.r-cw-5-data', 'pnpm-home'));
    assert.equal(env.PATH, `${path.dirname(process.execPath)}:/usr/bin:/bin`);
  } finally {
    if (prior.npmConfigPnpmfile === undefined) delete process.env.npm_config_pnpmfile;
    else process.env.npm_config_pnpmfile = prior.npmConfigPnpmfile;
    if (prior.pnpmConfigGlobalPnpmfile === undefined) delete process.env.PNPM_CONFIG_GLOBAL_PNPMFILE;
    else process.env.PNPM_CONFIG_GLOBAL_PNPMFILE = prior.pnpmConfigGlobalPnpmfile;
  }
});

test('R-CW-5 fixture rejects candidate-owned reserved package-manager paths', async () => {
  const worktree = await mkdtemp(path.join(os.tmpdir(), 'r-cw-5-reserved-pm-path-'));
  await mkdir(path.join(worktree, '.r-cw-5-cache'), { mode: 0o700 });
  await symlink('/tmp', path.join(worktree, '.r-cw-5-cache', 'npm'));
  assert.throws(
    () => privatePackageManagerEnv(worktree),
    /candidate tree already contains reserved fixture path/,
  );
});

test('R-CW-5 fixture ignores a fake PATH git for candidate provenance', async () => {
  const source = await mkdtemp(path.join(os.tmpdir(), 'r-cw-5-trusted-git-'));
  await mkdir(path.join(source, 'src/auto-reply/continuation'), { recursive: true });
  await writeFile(path.join(source, 'src/auto-reply/continuation/scheduler.ts'), 'export const clean = true;\n');
  await writeFile(path.join(source, 'src/auto-reply/continuation/delegate-dispatch.cost-cap-exhaustion.test.ts'), '// marker\n');
  await writeFile(path.join(source, 'package.json'), `${JSON.stringify({ packageManager: PNPM_11_2_2 })}\n`);
  await writeFile(path.join(source, 'pnpm-lock.yaml'), 'lockfileVersion: "9.0"\n');
  execFileSync('/usr/bin/git', ['init'], { cwd: source, stdio: 'ignore' });
  execFileSync('/usr/bin/git', ['config', 'user.email', 'proof@example.invalid'], { cwd: source });
  execFileSync('/usr/bin/git', ['config', 'user.name', 'R-CW-5 fixture test'], { cwd: source });
  execFileSync('/usr/bin/git', ['add', 'src', 'package.json', 'pnpm-lock.yaml'], { cwd: source });
  execFileSync('/usr/bin/git', ['commit', '-m', 'candidate'], { cwd: source, stdio: 'ignore' });
  const candidateSha = execFileSync('/usr/bin/git', ['rev-parse', 'HEAD'], {
    cwd: source,
    encoding: 'utf8',
  }).trim();
  const fakeBin = await mkdtemp(path.join(os.tmpdir(), 'r-cw-5-fake-git-'));
  const fakeGit = path.join(fakeBin, 'git');
  await writeFile(fakeGit, '#!/bin/sh\necho FAKE-GIT-RAN >&2\nexit 97\n');
  await chmod(fakeGit, 0o700);
  const priorPath = process.env.PATH;
  try {
    process.env.PATH = fakeBin;
    assert.doesNotThrow(() => assertSource(source, candidateSha));
  } finally {
    process.env.PATH = priorPath;
  }
});

test('R-CW-5 fixture rejects repository-local filters before Git can execute them', async () => {
  const source = await mkdtemp(path.join(os.tmpdir(), 'r-cw-5-filtered-git-'));
  await writeFile(path.join(source, 'proof.ts'), 'expected\n');
  execFileSync('/usr/bin/git', ['init'], { cwd: source, stdio: 'ignore' });
  execFileSync('/usr/bin/git', ['config', 'user.email', 'proof@example.invalid'], { cwd: source });
  execFileSync('/usr/bin/git', ['config', 'user.name', 'R-CW-5 fixture test'], { cwd: source });
  execFileSync('/usr/bin/git', ['add', 'proof.ts'], { cwd: source });
  execFileSync('/usr/bin/git', ['commit', '-m', 'candidate'], { cwd: source, stdio: 'ignore' });
  const candidateSha = execFileSync('/usr/bin/git', ['rev-parse', 'HEAD'], {
    cwd: source,
    encoding: 'utf8',
  }).trim();
  execFileSync('/usr/bin/git', ['config', 'filter.fixture.clean', 'sed s/forged/expected/'], {
    cwd: source,
  });
  assert.throws(
    () => assertSafeLocalGitConfig(source),
    /unsafe local Git configuration/,
  );
  execFileSync('/usr/bin/git', ['config', '--unset-all', 'filter.fixture.clean'], { cwd: source });
  assert.doesNotThrow(() => assertTrackedTreeBytes(source, candidateSha, 'unfiltered proof execution'));
});

test('R-CW-5 TaskFlow typed tool-surface template asserts no durable work after exhausted elections', async () => {
  const template = await readFile(
    fileURLToPath(new URL('../../fixtures/r-cw-5/cost-cap-tool-surface.test.ts', import.meta.url)),
    'utf8',
  );
  assert.match(template, /runAgentAttempt/);
  assert.match(template, /continueWorkOpts/);
  assert.match(template, /continuationChainTokens:\s*__RCW5_OVER_CAP__/);
  assert.match(template, /listTaskFlowsForOwnerKey\(sessionKey\)\)\.toHaveLength\(0\)/);
  assert.match(template, /2 of 2 continue_work elections were not scheduled/);
});

test('R-CW-5 custody typed tool-surface template asserts no custody record, against a positive control', async () => {
  const template = await readFile(
    fileURLToPath(new URL('../../fixtures/r-cw-5/cost-cap-tool-surface.custody.test.ts', import.meta.url)),
    'utf8',
  );
  assert.match(template, /runAgentAttempt/);
  assert.match(template, /continueWorkOpts/);
  assert.match(template, /^useContinuationCustodyTestState\(\);$/mu);
  assert.match(template, /seedSession\(__RCW5_OVER_CAP__\)/);
  assert.match(template, /listCustodyRecordsForTest\(\{ ownerSessionKey: sessionKey \}\)\)\.toHaveLength\(0\)/);
  assert.match(template, /listCustodyRecordsForTest\(\)\)\.toHaveLength\(0\)/);
  assert.match(template, /2 of 2 continue_work elections were not scheduled/);
  assert.match(template, /it\("schedules a below-cap typed-tool election as one durable custody record"/);
  assert.match(template, /seedSession\(__RCW5_CAP__ - 1\)/);
  assert.match(template, /toMatchObject\(\{ kind: "work", status: "queued", ownerSessionKey: sessionKey \}\)/);
  assert.doesNotMatch(template, /task-flow-registry/);
});

test('R-CW-5 renders both typed tool surfaces at the selected cap', async () => {
  const taskFlow = renderToolSurfaceTemplate(await readFile(
    fileURLToPath(new URL('../../fixtures/r-cw-5/cost-cap-tool-surface.test.ts', import.meta.url)),
    'utf8',
  ), 200);
  assert.match(taskFlow, /costCapTokens:\s*200/);
  assert.match(taskFlow, /continuationChainTokens:\s*201/);
  assert.doesNotMatch(taskFlow, /__RCW5_(?:CAP|OVER_CAP)__/);
  const custody = renderToolSurfaceTemplate(await readFile(
    fileURLToPath(new URL('../../fixtures/r-cw-5/cost-cap-tool-surface.custody.test.ts', import.meta.url)),
    'utf8',
  ), 200);
  assert.match(custody, /costCapTokens:\s*200/);
  assert.match(custody, /seedSession\(201\)/);
  assert.match(custody, /seedSession\(200 - 1\)/);
  assert.match(custody, /toBe\(201\)/);
  assert.doesNotMatch(custody, /__RCW5_(?:CAP|OVER_CAP)__/);
});

test('R-CW-5 public readiness has no private source path', () => {
  const privatePath = '/home/figs/flesh_beast_tmp/openclaw';
  const readiness = buildReadiness({
    candidateSha: '6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d',
    head: '6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d',
    cap: 200,
    lockfileSha256: 'a'.repeat(64),
  });
  assert.equal(readiness.sourceHeadMatchesCandidate, true);
  assert.equal(readiness.lockfileSha256, 'a'.repeat(64));
  assert.match(readiness.dependencyTree, /frozen-lockfile/);
  assert.doesNotMatch(JSON.stringify(readiness), new RegExp(privatePath.replaceAll('/', '\\/')));
});

test('R-CW-5 executes only in a disposable frozen-lockfile dependency tree', async () => {
  const runner = await readFile(
    fileURLToPath(new URL('../run-cost-cap-fixture.mjs', import.meta.url)),
    'utf8',
  );
  assert.match(runner, /resolvePinnedPnpm/);
  // Env pins must come from the lockfile bytes whose sha256 was just verified.
  assert.match(runner, /resolvePinnedPnpm\(worktreeDir, candidateLockfile\)/);
  assert.match(runner, /--ignore-scripts/);
  assert.match(runner, /resolveCandidateLocalExecutable\(worktreeDir, 'tsx'\)/);
  assert.match(runner, /resolveCandidateLocalExecutable\(worktreeDir, 'vitest'\)/);
  const toolSurfaceIndex = runner.indexOf('const toolSurface = runToolSurface(');
  const finalIntegrityIndex = runner.indexOf(
    "assertCandidateWorktreeIntegrity(worktreeDir, candidateSha, 'final receipt emission')",
  );
  assert.ok(toolSurfaceIndex >= 0 && finalIntegrityIndex > toolSurfaceIndex);
  assert.doesNotMatch(runner, /run\('pnpm'/);
  assert.doesNotMatch(runner, /run\('git'/);
  assert.match(runner, /--ignore-pnpmfile/);
  assert.match(runner, /packageManagerStateConfinedToDisposableWorktree: true/);
  assert.match(runner, /sourceNodeModulesTrusted: false/);
  assert.doesNotMatch(runner, /symlinkSync\(path\.join\(sourceDir, 'node_modules'\)/);
});

test('R-CW-5 fails closed instead of pretending the internal tool is websocket-invocable', async () => {
  const manifestPath = fileURLToPath(new URL('../../manifests/r-cw-5.json', import.meta.url));
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const methodDoc = await readFile(
    fileURLToPath(new URL('../../docs/R-CW-5-ISOLATED-TOOL-SURFACE.md', import.meta.url)),
    'utf8',
  );
  assert.equal(manifest.transport, 'process-local');
  assert.equal(manifest.scenario.status, 'scaffold');
  assert.deepEqual(manifest.scenario.methods, [
    'runAgentAttempt',
    'continueWorkOpts.requestContinuation',
    'durable-work.assert-none',
  ]);
  assert.equal(manifest.liveRunSafety.requiresLiveGatewayToken, false);
  assert.equal(manifest.liveRunSafety.requiresExternalAgentOrToolInvocation, false);
  assert.match(methodDoc, /not\s+externally invocable through the gateway loopback/);
  assert.match(methodDoc, /Any missing or failed receipt is `FAIL-fixture`, never a PASS/);
});
