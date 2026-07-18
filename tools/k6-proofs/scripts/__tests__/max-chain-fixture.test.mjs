import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

async function writeCandidateFixture(source, lock = 'lockfileVersion: 9.0\n') {
  await mkdir(path.join(source, 'src/auto-reply/continuation'), { recursive: true });
  await mkdir(path.join(source, 'src/agents/command'), { recursive: true });
  await writeFile(path.join(source, 'pnpm-lock.yaml'), lock);
  await writeFile(path.join(source, 'src/auto-reply/continuation/scheduler.ts'), 'export const clean = true;\n');
  await writeFile(path.join(source, 'src/auto-reply/continuation/work-dispatch.ts'), '// marker\n');
  await writeFile(path.join(source, 'src/auto-reply/continuation/delegate-dispatch.chain-depth-exhaustion.test.ts'), '// marker\n');
  await writeFile(path.join(source, 'src/agents/command/attempt-execution.ts'), '// marker\n');
  await writeFile(path.join(source, 'package.json'), '{"name":"r-cw-6-test","packageManager":"pnpm@11.2.2"}\n');
}

import {
  assertExecutingPnpmVersion,
  assertInstalledPnpmDependencyTree,
  assertPublicArtifactSafe,
  assertSource,
  assertCandidateWorktree,
  assertTrackedSourceClean,
  buildReadiness,
  candidateLocalExecutables,
  installCandidateDependencies,
  parseArgs,
  parsePinnedPnpmPackageManager,
  prepareArtifactDir,
  renderToolSurfaceTemplate,
  verifyInstalledCandidateDependencies,
} from '../run-max-chain-fixture.mjs';

async function writeInstalledPnpmTree(source, {
  candidateLock = 'lockfileVersion: 9.0\n',
  installedLock = candidateLock,
  packageManager = 'pnpm@11.2.2',
  virtualStoreDir = '.pnpm',
} = {}) {
  await mkdir(path.join(source, 'node_modules', '.pnpm'), { recursive: true });
  await mkdir(path.join(source, 'node_modules', '.bin'), { recursive: true });
  await writeFile(path.join(source, 'pnpm-lock.yaml'), candidateLock);
  await writeFile(path.join(source, 'node_modules', '.pnpm', 'lock.yaml'), installedLock);
  await writeFile(
    path.join(source, 'node_modules', '.modules.yaml'),
    `${JSON.stringify({ layoutVersion: 5, packageManager, virtualStoreDir }, null, 2)}\n`,
  );
  for (const executable of ['tsx', 'vitest']) {
    await writeFile(path.join(source, 'node_modules', '.bin', executable), '#!/bin/sh\nexit 0\n');
    await chmod(path.join(source, 'node_modules', '.bin', executable), 0o700);
  }
}

test('R-CW-6 fixture accepts an explicit isolated source contract', () => {
  const parsed = parseArgs([
    'node',
    'run-max-chain-fixture.mjs',
    '--source-dir',
    '/tmp/exact-openclaw',
    '--candidate-sha',
    '6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d',
    '--artifact-dir',
    '/tmp/rcw6-artifacts',
    '--max-chain-length',
    '3',
    '--json',
  ], {});
  assert.deepEqual(parsed, {
    sourceDir: '/tmp/exact-openclaw',
    candidateSha: '6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d',
    artifactDir: '/tmp/rcw6-artifacts',
    maxChainLength: 3,
    json: true,
  });
});

test('R-CW-6 fixture refuses unknown or live-mutation arguments', () => {
  assert.throws(
    () => parseArgs(['node', 'run-max-chain-fixture.mjs', '--restart-gateway'], {}),
    /unexpected argument: --restart-gateway/,
  );
  assert.throws(
    () => parseArgs(['node', 'run-max-chain-fixture.mjs', '--config-patch', '1'], {}),
    /unexpected argument: --config-patch/,
  );
});

test('R-CW-6 fixture refuses to overwrite or expose an artifact directory', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'r-cw-6-artifact-test-'));
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

test('R-CW-6 fixture refuses staged or unstaged tracked candidate changes', async () => {
  const source = await mkdtemp(path.join(os.tmpdir(), 'r-cw-6-dirty-source-'));
  await writeCandidateFixture(source);
  execFileSync('git', ['init'], { cwd: source, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'proof@example.invalid'], { cwd: source });
  execFileSync('git', ['config', 'user.name', 'R-CW-6 fixture test'], { cwd: source });
  execFileSync('git', ['add', 'src', 'package.json', 'pnpm-lock.yaml'], { cwd: source });
  execFileSync('git', ['commit', '-m', 'candidate'], { cwd: source, stdio: 'ignore' });
  const candidateSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim();

  assert.doesNotThrow(() => assertSource(source, candidateSha));

  await writeFile(path.join(source, 'src/auto-reply/continuation/scheduler.ts'), 'export const clean = false;\n');
  assert.throws(() => assertSource(source, candidateSha), /tracked staged or unstaged changes/);

  execFileSync('git', ['add', 'src/auto-reply/continuation/scheduler.ts'], { cwd: source });
  assert.throws(() => assertSource(source, candidateSha), /tracked staged or unstaged changes/);
  assert.throws(
    () => assertTrackedSourceClean(source, 'final cleanup/result receipt'),
    /before final cleanup\/result receipt/,
  );
});

test('R-CW-6 ignores source node_modules and requires a committed candidate lockfile', async () => {
  const source = await mkdtemp(path.join(os.tmpdir(), 'r-cw-6-candidate-source-'));
  await writeCandidateFixture(source);
  await mkdir(path.join(source, 'source-node-modules'), { recursive: true });
  await symlink(path.join(source, 'source-node-modules'), path.join(source, 'node_modules'));
  execFileSync('git', ['init'], { cwd: source, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'proof@example.invalid'], { cwd: source });
  execFileSync('git', ['config', 'user.name', 'R-CW-6 fixture test'], { cwd: source });
  execFileSync('git', ['add', 'src', 'package.json', 'pnpm-lock.yaml'], { cwd: source });
  execFileSync('git', ['commit', '-m', 'candidate'], { cwd: source, stdio: 'ignore' });
  const candidateSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim();

  assert.doesNotThrow(() => assertSource(source, candidateSha));

  execFileSync('git', ['rm', 'pnpm-lock.yaml'], { cwd: source, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'candidate without lockfile'], { cwd: source, stdio: 'ignore' });
  const missingLockSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim();
  assert.throws(
    () => assertCandidateWorktree(source, missingLockSha),
    /missing pnpm-lock\.yaml|requires committed pnpm-lock\.yaml/,
  );
});

test('R-CW-6 accepts only a fixed pnpm packageManager declaration and exact executing version', () => {
  for (const invalid of ['pnpm@latest', 'pnpm@^11.2.2', 'pnpm@11', 'npm@11.2.2', 'pnpm@11.2.2 || pnpm@11.3.0']) {
    assert.throws(
      () => parsePinnedPnpmPackageManager(invalid),
      /exact pnpm@<semver>/,
      `${invalid} must not identify one candidate pnpm release`,
    );
  }
  const pinned = parsePinnedPnpmPackageManager('pnpm@11.2.2+sha512.abcd_ef-1');
  assert.equal(pinned.version, '11.2.2');
  assert.equal(pinned.integritySuffix, '+sha512.abcd_ef-1');
  assert.equal(assertExecutingPnpmVersion(pinned, '11.2.2'), '11.2.2');
  assert.throws(
    () => assertExecutingPnpmVersion(pinned, '11.2.3'),
    /does not equal candidate packageManager version 11\.2\.2/,
  );
});

test('R-CW-6 verifies installed lock bytes, pnpm metadata, and candidate-contained virtual store', async () => {
  const candidate = parsePinnedPnpmPackageManager('pnpm@11.2.2+sha512.candidate');

  const staleLock = await mkdtemp(path.join(os.tmpdir(), 'r-cw-6-stale-lock-'));
  await writeInstalledPnpmTree(staleLock, {
    packageManager: 'pnpm@11.2.2',
    installedLock: 'lockfileVersion: 8.0\n',
  });
  assert.throws(
    () => assertInstalledPnpmDependencyTree(staleLock, candidate),
    /lock\.yaml bytes do not match candidate pnpm-lock\.yaml/,
  );

  const incompatibleMetadata = await mkdtemp(path.join(os.tmpdir(), 'r-cw-6-incompatible-metadata-'));
  await writeInstalledPnpmTree(incompatibleMetadata, { packageManager: 'pnpm@11.2.3' });
  assert.throws(
    () => assertInstalledPnpmDependencyTree(incompatibleMetadata, candidate),
    /packageManager is incompatible with candidate packageManager/,
  );

  const escapedStore = await mkdtemp(path.join(os.tmpdir(), 'r-cw-6-escaped-store-'));
  await writeInstalledPnpmTree(escapedStore, { packageManager: 'pnpm@11.2.2', virtualStoreDir: '../outside' });
  assert.throws(
    () => assertInstalledPnpmDependencyTree(escapedStore, candidate),
    /virtualStoreDir escapes candidate node_modules/,
  );

  const linkedStore = await mkdtemp(path.join(os.tmpdir(), 'r-cw-6-linked-store-'));
  await writeInstalledPnpmTree(linkedStore, { packageManager: 'pnpm@11.2.2', virtualStoreDir: 'virtual-store' });
  const outside = await mkdtemp(path.join(os.tmpdir(), 'r-cw-6-virtual-store-outside-'));
  await symlink(outside, path.join(linkedStore, 'node_modules', 'virtual-store'));
  assert.throws(
    () => assertInstalledPnpmDependencyTree(linkedStore, candidate),
    /requires candidate pnpm virtual store to be a real directory/,
  );

  const legacyYaml = await mkdtemp(path.join(os.tmpdir(), 'r-cw-6-legacy-yaml-metadata-'));
  await writeInstalledPnpmTree(legacyYaml, { packageManager: 'pnpm@11.2.2' });
  await writeFile(
    path.join(legacyYaml, 'node_modules', '.modules.yaml'),
    'layoutVersion: 5\npackageManager: pnpm@11.2.2\nvirtualStoreDir: .pnpm\n',
  );
  assert.equal(
    assertInstalledPnpmDependencyTree(legacyYaml, candidate).installedPackageManagerVersion,
    '11.2.2',
  );
});

test('R-CW-6 rejects a fake PATH pnpm that reports the candidate version but cannot produce the required tree metadata', async () => {
  const worktree = await mkdtemp(path.join(os.tmpdir(), 'r-cw-6-fake-pnpm-worktree-'));
  const fakeBin = await mkdtemp(path.join(os.tmpdir(), 'r-cw-6-fake-pnpm-bin-'));
  const candidate = parsePinnedPnpmPackageManager('pnpm@11.2.2');
  await writeFile(path.join(worktree, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
  const fakePnpm = path.join(fakeBin, 'pnpm');
  await writeFile(fakePnpm, [
    '#!/bin/sh',
    'if [ "$1" = "--version" ]; then printf "11.2.2\\n"; exit 0; fi',
    'if [ "$1" = "install" ]; then',
    '  mkdir -p node_modules/.pnpm node_modules/.bin',
    '  printf "lockfileVersion: 8.0\\n" > node_modules/.pnpm/lock.yaml',
    '  printf "packageManager: pnpm@11.2.2\\nvirtualStoreDir: .pnpm\\n" > node_modules/.modules.yaml',
    '  : > node_modules/.bin/tsx',
    '  : > node_modules/.bin/vitest',
    '  exit 0',
    'fi',
    'exit 64',
    '',
  ].join('\n'));
  await chmod(fakePnpm, 0o700);
  const env = { ...process.env, PATH: `${fakeBin}${path.delimiter}${process.env.PATH}` };
  const installation = installCandidateDependencies(worktree, candidate, { env });
  assert.equal(installation.executingPackageManagerVersion, '11.2.2');
  assert.deepEqual(installation.command, ['pnpm', 'install', '--frozen-lockfile', '--prefer-offline', '--ignore-scripts']);
  assert.throws(
    () => verifyInstalledCandidateDependencies(worktree, candidate),
    /lock\.yaml bytes do not match candidate pnpm-lock\.yaml/,
  );
});

test('R-CW-6 detects a tracked candidate mutation when the post-install integrity check runs', async () => {
  const source = await mkdtemp(path.join(os.tmpdir(), 'r-cw-6-post-install-mutation-'));
  await writeCandidateFixture(source);
  execFileSync('git', ['init'], { cwd: source, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'proof@example.invalid'], { cwd: source });
  execFileSync('git', ['config', 'user.name', 'R-CW-6 fixture test'], { cwd: source });
  execFileSync('git', ['add', 'src', 'package.json', 'pnpm-lock.yaml'], { cwd: source });
  execFileSync('git', ['commit', '-m', 'candidate'], { cwd: source, stdio: 'ignore' });
  const candidateSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim();
  assert.doesNotThrow(() => assertCandidateWorktree(source, candidateSha, 'post-install dependency verification'));
  await writeFile(path.join(source, 'package.json'), '{"name":"mutated-after-install","packageManager":"pnpm@11.2.2"}\n');
  assert.throws(
    () => assertCandidateWorktree(source, candidateSha, 'post-install dependency verification'),
    /tracked staged or unstaged changes before post-install dependency verification/,
  );
});

test('R-CW-6 proof executables are candidate-local absolute binaries, not PATH substitutions', async () => {
  const worktree = await mkdtemp(path.join(os.tmpdir(), 'r-cw-6-local-bin-'));
  const candidateBin = path.join(worktree, 'node_modules', '.bin');
  const fakeBin = await mkdtemp(path.join(os.tmpdir(), 'r-cw-6-fake-path-'));
  await writeInstalledPnpmTree(worktree);
  for (const executable of ['tsx', 'vitest']) {
    await writeFile(path.join(candidateBin, executable), '#!/bin/sh\nprintf candidate-' + executable + '\n');
    await chmod(path.join(candidateBin, executable), 0o700);
    await writeFile(path.join(fakeBin, executable), '#!/bin/sh\nprintf fake-' + executable + '\n');
    await chmod(path.join(fakeBin, executable), 0o700);
  }
  const originalPath = process.env.PATH;
  process.env.PATH = `${fakeBin}${path.delimiter}${originalPath}`;
  try {
    const verifiedTree = assertInstalledPnpmDependencyTree(
      worktree,
      parsePinnedPnpmPackageManager('pnpm@11.2.2'),
    );
    const executables = candidateLocalExecutables(worktree, verifiedTree);
    assert.equal(executables.paths.tsx, path.join(worktree, 'node_modules', '.bin', 'tsx'));
    assert.equal(executables.paths.vitest, path.join(worktree, 'node_modules', '.bin', 'vitest'));
    assert.equal(execFileSync(executables.paths.tsx, [], { encoding: 'utf8' }).trim(), 'candidate-tsx');
    assert.equal(execFileSync(executables.paths.vitest, [], { encoding: 'utf8' }).trim(), 'candidate-vitest');
    assert.deepEqual(executables.contract, {
      tsx: { path: 'node_modules/.bin/tsx', realpathWithinVerifiedDependencyTree: true },
      vitest: { path: 'node_modules/.bin/vitest', realpathWithinVerifiedDependencyTree: true },
    });
  } finally {
    process.env.PATH = originalPath;
  }
});

test('R-CW-6 creates the detached candidate worktree, frozen-installs it, then uses local proof binaries', async () => {
  const script = await readFile(
    fileURLToPath(new URL('../run-max-chain-fixture.mjs', import.meta.url)),
    'utf8',
  );
  assert.match(script, /worktree', 'add', '--detach', worktreeDir, candidateSha/);
  assert.match(script, /\['pnpm', 'install', '--frozen-lockfile', '--prefer-offline', '--ignore-scripts'\]/);
  assert.match(script, /run\('pnpm', \['--version'\]/);
  assert.match(script, /assertExecutingPnpmVersion/);
  assert.match(script, /post-install dependency verification/);
  assert.match(script, /all runtime proof surfaces/);
  assert.match(script, /verifyInstalledCandidateDependencies/);
  assert.match(script, /verifiedDependencies\.executables\.tsx/);
  assert.match(script, /verifiedDependencies\.executables\.vitest/);
  assert.doesNotMatch(script, /symlinkSync\(path\.join\(sourceDir, 'node_modules'\)/);
});

test('R-CW-6 runtime template proves the real budget and durable recovery path', async () => {
  const template = await readFile(
    fileURLToPath(new URL('../../fixtures/r-cw-6/max-chain-tool-surface.test.ts', import.meta.url)),
    'utf8',
  );
  assert.match(template, /scheduleContinuationWorkBatch/);
  assert.match(template, /scheduleContinuationWork/);
  assert.match(template, /checkContinuationBudget/);
  assert.match(template, /persistContinuationChainState/);
  assert.match(template, /loadSessionStore/);
  assert.match(template, /reason:\s*structuredReason/);
  assert.match(template, /flowCountBeforeRejectedHop/);
  assert.match(template, /flowCountAfterRejectedHop/);
  assert.match(template, /recoveredAttemptScheduled/);
});

test('R-CW-6 typed template enters runAgentAttempt and omits the rejected flow', async () => {
  const template = await readFile(
    fileURLToPath(new URL('../../fixtures/r-cw-6/max-chain-tool-surface.test.ts', import.meta.url)),
    'utf8',
  );
  assert.match(template, /runAgentAttempt/);
  assert.match(template, /createOpenClawContinuationTools/);
  assert.match(template, /tool\.name === "continue_work"/);
  assert.match(template, /continueWorkTool\.execute/);
  assert.match(template, /continueWorkOpts/);
  assert.match(template, /typed first-over-limit/);
  assert.match(template, /firstOverLimitFlowPresent:\s*false/);
  assert.match(template, /capNoticeObserved/);
});

test('R-CW-6 delegate template uses the selected maximum and proves reject-before-spawn', async () => {
  const template = await readFile(
    fileURLToPath(new URL('../../fixtures/r-cw-6/max-chain-delegate-boundary.test.ts', import.meta.url)),
    'utf8',
  );
  const rendered = renderToolSurfaceTemplate(template, 7);
  assert.match(rendered, /const maxChainLength = 7/);
  assert.match(rendered, /currentChainCount: maxChainLength - 1/);
  assert.match(rendered, /rejectedBeforeSecondSpawn/);
  assert.match(rendered, /rejectedFlowStatus/);
  assert.match(rendered, /chainCappedNoticeObserved/);
  assert.doesNotMatch(rendered, /__RCW6_MAX_CHAIN_LENGTH__/);
});

test('R-CW-6 renders every runtime layer at the selected max chain length', async () => {
  const template = await readFile(
    fileURLToPath(new URL('../../fixtures/r-cw-6/max-chain-tool-surface.test.ts', import.meta.url)),
    'utf8',
  );
  const rendered = renderToolSurfaceTemplate(template, 7);
  assert.match(rendered, /const maxChainLength = 7/);
  assert.doesNotMatch(rendered, /__RCW6_MAX_CHAIN_LENGTH__/);
});

test('R-CW-6 public readiness has no private source path or fleet mutation claim', () => {
  const privatePath = '/home/figs/flesh_beast_tmp/openclaw';
  const readiness = buildReadiness({
    candidateSha: '6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d',
    head: '6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d',
    candidateRuntime: {
      candidateLockfileSha256: 'b'.repeat(64),
      installedLockfileSha256: 'b'.repeat(64),
      lockfileMatchesCandidate: true,
      candidatePackageManager: 'pnpm@11.2.2+sha512.candidate',
      candidatePackageManagerVersion: '11.2.2',
      executingPackageManagerVersion: '11.2.2',
      installedPackageManager: 'pnpm@11.2.2',
      installedPackageManagerVersion: '11.2.2',
      virtualStoreDir: '.pnpm',
      virtualStoreContainedWithinCandidateNodeModules: true,
      installCommand: ['pnpm', 'install', '--frozen-lockfile', '--prefer-offline', '--ignore-scripts'],
      localExecutableContract: {
        tsx: { path: 'node_modules/.bin/tsx', realpathWithinVerifiedDependencyTree: true },
        vitest: { path: 'node_modules/.bin/vitest', realpathWithinVerifiedDependencyTree: true },
      },
      worktreeIntegrity: {
        beforeInstall: { headMatchesCandidate: true, trackedClean: true },
        afterInstall: { headMatchesCandidate: true, trackedClean: true },
        afterProofSurfaces: { headMatchesCandidate: true, trackedClean: true },
      },
    },
    maxChainLength: 7,
  });
  assert.equal(readiness.sourceHeadMatchesCandidate, true);
  assert.equal(readiness.productionConfigTouched, false);
  assert.equal(readiness.productionStateTouched, false);
  assert.equal(readiness.gatewayStarted, false);
  assert.equal(readiness.candidateLockfileSha256, 'b'.repeat(64));
  assert.equal(readiness.installedLockfileSha256, 'b'.repeat(64));
  assert.equal(readiness.candidatePackageManager, 'pnpm@11.2.2+sha512.candidate');
  assert.equal(readiness.executingPackageManagerVersion, '11.2.2');
  assert.equal(readiness.installedPackageManager, 'pnpm@11.2.2');
  assert.equal(readiness.hostToolchainHermetic, false);
  assert.deepEqual(readiness.installCommand, ['pnpm', 'install', '--frozen-lockfile', '--prefer-offline', '--ignore-scripts']);
  assert.doesNotMatch(JSON.stringify(readiness), new RegExp(privatePath.replaceAll('/', '\\/')));
});

test('R-CW-6 public artifact guard rejects private paths and sensitive fields', () => {
  assert.doesNotThrow(() =>
    assertPublicArtifactSafe(
      { schema: 'safe.v1', candidateSha: '6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d' },
      { label: 'safe.json', privatePaths: ['/private/source'] },
    ),
  );
  assert.throws(
    () =>
      assertPublicArtifactSafe(
        { schema: 'unsafe.v1', detail: '/private/source/src/index.ts' },
        { label: 'unsafe-path.json', privatePaths: ['/private/source'] },
      ),
    /contains a private filesystem path/,
  );
  assert.throws(
    () => assertPublicArtifactSafe({ schema: 'unsafe.v1', sessionKey: 'agent:main:private' }),
    /forbidden public-artifact key sessionKey/,
  );
  assert.throws(
    () => assertPublicArtifactSafe({ schema: 'unsafe.v1', gatewayToken: 'do-not-publish' }),
    /forbidden public-artifact key gatewayToken/,
  );
  assert.throws(
    () => assertPublicArtifactSafe({ schema: 'unsafe.v1', detail: '/tmp/other-private-artifact/trace.txt' }),
    /contains an absolute filesystem path/,
  );
  assert.throws(
    () => assertPublicArtifactSafe({ schema: 'unsafe.v1', session_id: 'agent:main:private' }),
    /forbidden public-artifact key session_id/,
  );
  assert.throws(
    () => assertPublicArtifactSafe({ schema: 'unsafe.v1', environment: { SAFE: 'not-safe-to-publish' } }),
    /forbidden public-artifact key environment/,
  );
  assert.throws(
    () => assertPublicArtifactSafe({ schema: 'unsafe.v1', process_output: 'raw child stdout' }),
    /forbidden public-artifact key process_output/,
  );
  assert.throws(
    () => assertPublicArtifactSafe({ schema: 'unsafe.v1', detail: 'agent:main:private' }),
    /contains a session identifier/,
  );
  const recursiveAliases = [
    ['windows backslash path', { nested: { detail: 'C:\\Windows\\System32' } }, /absolute filesystem path/],
    ['windows forward path', { nested: { detail: 'C:/Windows/System32' } }, /absolute filesystem path/],
    ['UNC path', { nested: { detail: '\\\\server\\share\\private.txt' } }, /absolute filesystem path/],
    ['file URL', { nested: { detail: 'file:///tmp/private.txt' } }, /absolute filesystem path/],
    ['home path', { nested: { detail: '~/.ssh/id_private' } }, /absolute filesystem path/],
    ['env', { nested: { env: { PATH: 'x' } } }, /forbidden public-artifact key env/],
    ['environmentVariables', { nested: { environmentVariables: { PATH: 'x' } } }, /forbidden public-artifact key environmentVariables/],
    ['envVars', { nested: { envVars: { PATH: 'x' } } }, /forbidden public-artifact key envVars/],
    ['errorMessage', { nested: { errorMessage: 'raw' } }, /forbidden public-artifact key errorMessage/],
    ['errorDetail', { nested: { errorDetail: 'raw' } }, /forbidden public-artifact key errorDetail/],
    ['stack', { nested: { stack: 'raw' } }, /forbidden public-artifact key stack/],
    ['exception', { nested: { exception: 'raw' } }, /forbidden public-artifact key exception/],
    ['apiKey', { nested: { apiKey: 'secret' } }, /forbidden public-artifact key apiKey/],
    ['accessKey', { nested: { accessKey: 'secret' } }, /forbidden public-artifact key accessKey/],
    ['privateKey', { nested: { privateKey: 'secret' } }, /forbidden public-artifact key privateKey/],
    ['bearerToken', { nested: { bearerToken: 'secret' } }, /forbidden public-artifact key bearerToken/],
    ['cookie', { nested: { cookie: 'secret' } }, /forbidden public-artifact key cookie/],
    ['setCookie', { nested: { setCookie: 'secret' } }, /forbidden public-artifact key setCookie/],
  ];
  for (const [name, value, expected] of recursiveAliases) {
    assert.throws(
      () => assertPublicArtifactSafe(value, { label: `${name}.json` }),
      expected,
      `${name} unexpectedly passed the public-artifact guard`,
    );
  }
});

test('R-CW-6 manifest and method fail closed instead of patching a shared gateway', async () => {
  const manifestPath = fileURLToPath(new URL('../../manifests/r-cw-6.json', import.meta.url));
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const methodDoc = await readFile(
    fileURLToPath(new URL('../../docs/R-CW-6-ISOLATED-MAX-CHAIN.md', import.meta.url)),
    'utf8',
  );
  assert.equal(manifest.transport, 'process-local');
  assert.equal(manifest.mutates, false);
  assert.equal(manifest.scenario.status, 'scaffold');
  assert.deepEqual(manifest.scenario.methods, [
    'scheduleContinuationWorkBatch',
    'scheduleContinuationWork',
    'runAgentAttempt',
    'TaskFlow.assert-no-rejected-row',
  ]);
  assert.equal(manifest.liveRunSafety.requiresLiveGatewayToken, false);
  assert.equal(manifest.liveRunSafety.requiresExternalAgentOrToolInvocation, false);
  assert.equal(manifest.liveRunSafety.expectedArtifactClass, 'PASS-candidate');
  assert.ok(manifest.liveRunSafety.requiredReceipts.includes('public-artifact-safety'));
  assert.match(methodDoc, /does not patch or restart a gateway/);
  assert.match(methodDoc, /manual-only\s+component fixture/);
  assert.match(methodDoc, /lockfile\/tree\/version alignment, not a hermetic or cryptographic/);
  assert.match(methodDoc, /--ignore-scripts/);
  assert.match(methodDoc, /Any missing or failed receipt is `FAIL-fixture`, never a PASS/);
});

test('R-CW-6 canonical guidance uses the process-local fixture, not live cap mutation', async () => {
  const corpusMethod = await readFile(
    fileURLToPath(new URL('../../../../RUNBOOKS/PROOF-CORPUS-METHOD.md', import.meta.url)),
    'utf8',
  );
  const skill = await readFile(
    fileURLToPath(new URL('../../skill/SKILL.md', import.meta.url)),
    'utf8',
  );
  for (const guidance of [corpusMethod, skill]) {
    assert.match(guidance, /run-max-chain-fixture\.mjs/);
    assert.match(guidance, /process-local/);
  }
  assert.doesNotMatch(
    skill,
    /For rows that test cap exhaustion \(R-CW-5, R-CW-6\):\s*1\. Lower caps in `openclaw\.json`/u,
  );
});
