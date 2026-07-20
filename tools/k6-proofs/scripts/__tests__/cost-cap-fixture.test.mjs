import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertSource,
  assertCandidateWorktreeIntegrity,
  assertSafeLocalGitConfig,
  assertTrackedTreeBytes,
  assertTrackedSourceClean,
  buildReadiness,
  parseArgs,
  privatePackageManagerEnv,
  prepareArtifactDir,
  resolvePinnedPnpm,
  renderToolSurfaceTemplate,
} from '../run-cost-cap-fixture.mjs';
import { chmod, mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const PNPM_11_2_2 =
  'pnpm@11.2.2+sha512.36e6621fad506178936455e70247b8808ef4ec25797a9f437a93281a020484e2607f6a469a22e982987c3dbb8866e3071514ab10a4a1749e06edcd1ec118436f';

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
  const fakeBin = await mkdtemp(path.join(os.tmpdir(), 'r-cw-5-fake-pnpm-'));
  const fakePnpm = path.join(fakeBin, 'pnpm');
  await writeFile(fakePnpm, '#!/bin/sh\necho FAKE-PNPM-RAN >&2\nexit 97\n');
  await chmod(fakePnpm, 0o700);
  const priorPath = process.env.PATH;
  try {
    process.env.PATH = fakeBin;
    const pinned = resolvePinnedPnpm(worktree);
    assert.equal(pinned.pnpmVersion, '11.2.2');
    assert.equal(pinned.packageManager, PNPM_11_2_2);
    assert.equal(pinned.pnpmIntegritySha512, PNPM_11_2_2.split('+sha512.')[1]);
  } finally {
    process.env.PATH = priorPath;
  }
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

test('R-CW-5 typed tool-surface template asserts no durable work after exhausted elections', async () => {
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

test('R-CW-5 renders the typed tool surface at the selected cap', async () => {
  const template = await readFile(
    fileURLToPath(new URL('../../fixtures/r-cw-5/cost-cap-tool-surface.test.ts', import.meta.url)),
    'utf8',
  );
  const rendered = renderToolSurfaceTemplate(template, 200);
  assert.match(rendered, /costCapTokens:\s*200/);
  assert.match(rendered, /continuationChainTokens:\s*201/);
  assert.doesNotMatch(rendered, /__RCW5_(?:CAP|OVER_CAP)__/);
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
    'TaskFlow.assert-no-row',
  ]);
  assert.equal(manifest.liveRunSafety.requiresLiveGatewayToken, false);
  assert.equal(manifest.liveRunSafety.requiresExternalAgentOrToolInvocation, false);
  assert.match(methodDoc, /not\s+externally invocable through the gateway loopback/);
  assert.match(methodDoc, /Any missing or failed receipt is `FAIL-fixture`, never a PASS/);
});
