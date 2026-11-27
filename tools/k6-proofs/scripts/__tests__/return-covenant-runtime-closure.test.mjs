import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  CLOSURE_REASONS,
  CLOSURE_SKIPS,
  collectClosureRoots,
  collectExportTargets,
  collectSelectedPackageFiles,
  platformAdmits,
  scanModuleReferences,
  selectClosurePackages,
  selectFirstPartyFileClosure,
  specifierPackageName,
} from '../../lib/return-covenant-runtime-closure.mjs';

const IDENTITY = Object.freeze({ platform: 'linux', arch: 'arm64', libc: 'glibc' });

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

async function writeText(file, text) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, text, { mode: 0o600 });
}

/** A synthetic product root with a pnpm-shaped node_modules. */
async function makeTree(root, rootManifest) {
  const source = path.join(root, 'source');
  await writeJson(path.join(source, 'package.json'), {
    name: 'openclaw',
    version: '1.0.0',
    type: 'module',
    ...rootManifest,
  });
  return source;
}

async function addPackage(source, relativeDir, manifest, files = {}) {
  const dir = path.join(source, relativeDir);
  await writeJson(path.join(dir, 'package.json'), manifest);
  for (const [name, contents] of Object.entries(files)) {
    await writeText(path.join(dir, name), contents);
  }
  return dir;
}

test('closure preserves distinct versions of the same package name', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'rcv-closure-versions-'));
  try {
    // Both versions must be genuinely reachable: the root declares shared@1.0.0
    // and top declares shared@2.0.0, so a correct closure keeps them distinct.
    const source = await makeTree(root, {
      dependencies: { top: '1.0.0', shared: '1.0.0' },
    });
    await addPackage(source, 'node_modules/top', {
      name: 'top',
      version: '1.0.0',
      dependencies: { shared: '2.0.0' },
    });
    await addPackage(source, 'node_modules/shared', { name: 'shared', version: '1.0.0' });
    await addPackage(source, 'node_modules/top/node_modules/shared', {
      name: 'shared',
      version: '2.0.0',
    });
    const result = await selectClosurePackages({
      dependencyDir: path.join(source, 'node_modules'),
      nodeIdentity: IDENTITY,
    });
    const shared = result.packages.filter((entry) => entry.name === 'shared');
    assert.deepEqual(shared.map((entry) => entry.version).toSorted(), ['1.0.0', '2.0.0']);
    assert.equal(new Set(shared.map((entry) => entry.directory)).size, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('closure fails closed on a required dependency and a required peer that do not resolve', async () => {
  for (const field of ['dependencies', 'peerDependencies']) {
    const root = await mkdtemp(path.join(tmpdir(), 'rcv-closure-required-'));
    try {
      const source = await makeTree(root, { dependencies: { host: '1.0.0' } });
      await addPackage(source, 'node_modules/host', {
        name: 'host',
        version: '1.0.0',
        [field]: { absent: '1.0.0' },
      });
      await assert.rejects(
        selectClosurePackages({
          dependencyDir: path.join(source, 'node_modules'),
          nodeIdentity: IDENTITY,
        }),
        (error) => /does not resolve inside the closure: absent/.test(error.message),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test('closure records optional and platform skips deterministically with reasons', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'rcv-closure-optional-'));
  try {
    const source = await makeTree(root, {
      dependencies: { host: '1.0.0' },
      optionalDependencies: { 'absent-optional': '1.0.0' },
    });
    await addPackage(source, 'node_modules/host', {
      name: 'host',
      version: '1.0.0',
      optionalDependencies: { 'wrong-platform': '1.0.0' },
      peerDependencies: { 'absent-peer': '1.0.0' },
      peerDependenciesMeta: { 'absent-peer': { optional: true } },
    });
    await addPackage(source, 'node_modules/wrong-platform', {
      name: 'wrong-platform',
      version: '1.0.0',
      os: ['win32'],
    });
    const first = await selectClosurePackages({
      dependencyDir: path.join(source, 'node_modules'),
      nodeIdentity: IDENTITY,
    });
    assert.deepEqual(first.skipped, [
      { name: 'absent-peer', from: 'host@1.0.0', reason: CLOSURE_SKIPS.PEER_OPTIONAL_ABSENT },
      { name: 'wrong-platform', from: 'host@1.0.0', reason: CLOSURE_SKIPS.OPTIONAL_INCOMPATIBLE },
      { name: 'absent-optional', from: '<root>', reason: CLOSURE_SKIPS.OPTIONAL_ABSENT },
    ].toSorted((left, right) =>
      left.from.localeCompare(right.from) || left.name.localeCompare(right.name)));
    assert.equal(first.packages.some((entry) => entry.name === 'wrong-platform'), false);
    const second = await selectClosurePackages({
      dependencyDir: path.join(source, 'node_modules'),
      nodeIdentity: IDENTITY,
    });
    assert.deepEqual(second, first, 'selection must be byte-deterministic');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('closure fails closed on a required platform-incompatible dependency', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'rcv-closure-platform-'));
  try {
    const source = await makeTree(root, { dependencies: { native: '1.0.0' } });
    await addPackage(source, 'node_modules/native', {
      name: 'native',
      version: '1.0.0',
      cpu: ['x64'],
    });
    await assert.rejects(
      selectClosurePackages({
        dependencyDir: path.join(source, 'node_modules'),
        nodeIdentity: IDENTITY,
      }),
      (error) => /declares an incompatible platform: native/.test(error.message),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('selected package files include native and data sidecars but never nested node_modules', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'rcv-closure-sidecar-'));
  try {
    const source = await makeTree(root, {});
    const dir = await addPackage(source, 'node_modules/native', {
      name: 'native',
      version: '1.0.0',
    }, {
      'index.js': 'export const n = 1;\n',
      'build/Release/addon.node': 'binary',
      'data/table.json': '{"k":1}\n',
      'engine.wasm': 'wasm',
    });
    await addPackage(source, 'node_modules/native/node_modules/inner', {
      name: 'inner',
      version: '9.9.9',
    }, { 'index.js': 'export const inner = true;\n' });
    const files = (await collectSelectedPackageFiles(dir, source))
      .map((file) => path.relative(dir, file))
      .toSorted();
    assert.deepEqual(files, [
      'build/Release/addon.node',
      'data/table.json',
      'engine.wasm',
      'index.js',
      'package.json',
    ]);
    assert.equal(files.some((file) => file.includes('node_modules')), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('closure roots cover every export target and fail closed on a missing runtime file', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'rcv-closure-roots-'));
  try {
    const source = await makeTree(root, {
      main: 'dist/index.js',
      bin: { openclaw: 'openclaw.mjs' },
      exports: {
        '.': { default: './dist/index.js' },
        './a': { types: './dist/a.d.ts', default: './dist/a.js' },
      },
    });
    for (const file of ['dist/index.js', 'dist/a.js', 'dist/a.d.ts', 'openclaw.mjs', 'drv.mjs']) {
      await writeText(path.join(source, file), 'export const x = 1;\n');
    }
    const roots = await collectClosureRoots({
      sourceDir: source,
      fixtureCommandRelativePath: 'drv.mjs',
      buildInputRelativePaths: ['package.json'],
    });
    const byPath = new Map(roots.map((entry) => [entry.relativePath, entry.reason]));
    assert.equal(byPath.get('dist/a.js'), CLOSURE_REASONS.ROOT_EXPORT);
    assert.equal(byPath.get('dist/a.d.ts'), CLOSURE_REASONS.ROOT_EXPORT);
    assert.equal(byPath.get('openclaw.mjs'), CLOSURE_REASONS.ROOT_BIN);
    assert.equal(byPath.get('drv.mjs'), CLOSURE_REASONS.ROOT_FIXTURE_COMMAND);
    assert.equal(byPath.get('package.json'), CLOSURE_REASONS.ROOT_BUILD_INPUT);

    await rm(path.join(source, 'dist/a.js'));
    await assert.rejects(
      collectClosureRoots({ sourceDir: source, fixtureCommandRelativePath: 'drv.mjs' }),
      (error) => /declared runtime root is absent from the frozen tree: dist\/a\.js/
        .test(error.message),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('first-party closure admits a finite enumerated dynamic specifier and fails closed on an unbounded one', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'rcv-closure-dynamic-'));
  try {
    const source = await makeTree(root, {});
    await writeText(
      path.join(source, 'dist/entry.js'),
      'const which = globalThis.pick;\nawait import(which);\n',
    );
    await writeText(path.join(source, 'dist/lazy.js'), 'export const lazy = 1;\n');
    const roots = [{ relativePath: 'dist/entry.js', reason: CLOSURE_REASONS.ROOT_EXPORT }];
    await assert.rejects(
      selectFirstPartyFileClosure({
        sourceDir: source,
        roots,
        selectedPackageNames: [],
        productPackageName: 'openclaw',
      }),
      (error) => /dynamic runtime reference has no enumerated finite target set/
        .test(error.message),
    );
    const admitted = await selectFirstPartyFileClosure({
      sourceDir: source,
      roots,
      selectedPackageNames: [],
      productPackageName: 'openclaw',
      dynamicPolicy: { 'dist/entry.js': ['./lazy.js'] },
    });
    assert.deepEqual(
      admitted.map((entry) => entry.relativePath),
      ['dist/entry.js', 'dist/lazy.js'],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('first-party closure fails closed on an undeclared dependency and a missing relative file', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'rcv-closure-undeclared-'));
  try {
    const source = await makeTree(root, {});
    await writeText(
      path.join(source, 'dist/entry.js'),
      'import "not-declared";\n',
    );
    const roots = [{ relativePath: 'dist/entry.js', reason: CLOSURE_REASONS.ROOT_EXPORT }];
    await assert.rejects(
      selectFirstPartyFileClosure({
        sourceDir: source,
        roots,
        selectedPackageNames: ['declared'],
        productPackageName: 'openclaw',
      }),
      (error) => /does not resolve inside the closure[\s\S]*not-declared/.test(error.message),
    );
    await writeText(path.join(source, 'dist/entry.js'), 'import "./gone.js";\n');
    await assert.rejects(
      selectFirstPartyFileClosure({
        sourceDir: source,
        roots,
        selectedPackageNames: [],
        productPackageName: 'openclaw',
      }),
      (error) => /does not resolve inside the closure[\s\S]*\.\/gone\.js/.test(error.message),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('closure fails closed on a path escape out of the fence', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'rcv-closure-escape-'));
  try {
    const source = await makeTree(root, {});
    const outside = path.join(root, 'outside');
    await writeText(path.join(outside, 'secret.js'), 'export const secret = 1;\n');
    const dir = await addPackage(source, 'node_modules/leaky', {
      name: 'leaky',
      version: '1.0.0',
    }, { 'index.js': 'export const l = 1;\n' });
    await symlink(path.join(outside, 'secret.js'), path.join(dir, 'escape.js'));
    await assert.rejects(
      collectSelectedPackageFiles(dir, source),
      (error) => /selected package file escapes the fence/.test(error.message),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('closure omits unselected workspace and dev packages', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'rcv-closure-unselected-'));
  try {
    const source = await makeTree(root, {
      dependencies: { kept: '1.0.0' },
      devDependencies: { 'dev-only': '1.0.0' },
    });
    await addPackage(source, 'node_modules/kept', { name: 'kept', version: '1.0.0' });
    await addPackage(source, 'node_modules/dev-only', { name: 'dev-only', version: '1.0.0' });
    await addPackage(source, 'node_modules/.pnpm/node_modules/@openclaw/unused', {
      name: '@openclaw/unused',
      version: '1.0.0',
    });
    const result = await selectClosurePackages({
      dependencyDir: path.join(source, 'node_modules'),
      nodeIdentity: IDENTITY,
    });
    const names = result.packages.map((entry) => entry.name).toSorted();
    assert.deepEqual(names, ['kept']);
    assert.equal(names.includes('dev-only'), false);
    assert.equal(names.includes('@openclaw/unused'), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('closure reference scanner and helpers behave as the policy assumes', () => {
  assert.equal(specifierPackageName('./rel.js'), null);
  assert.equal(specifierPackageName('node:fs'), null);
  assert.equal(specifierPackageName('pkg/sub/path'), 'pkg');
  assert.equal(specifierPackageName('@scope/pkg/sub'), '@scope/pkg');
  assert.deepEqual(
    collectExportTargets({ '.': { types: './a.d.ts', default: './a.js' }, './b': './b.js' }),
    ['./a.d.ts', './a.js', './b.js'],
  );
  assert.equal(platformAdmits({ os: ['linux'] }, IDENTITY), true);
  assert.equal(platformAdmits({ os: ['win32'] }, IDENTITY), false);
  assert.equal(platformAdmits({ os: ['!win32'] }, IDENTITY), true);
  assert.equal(platformAdmits({ cpu: ['arm64'], libc: ['glibc'] }, IDENTITY), true);
  const scanned = scanModuleReferences(
    'import a from "x";\nexport {b} from "./y.js";\nrequire("z");\nawait import(dyn);\n',
  );
  // The real ESM parser answers, not a pattern: `require("z")` is a call
  // expression in a module, not a dependency, so it must not appear.
  assert.deepEqual(scanned.statics, ['./y.js', 'x']);
  assert.equal(scanned.dynamicSites, 1);
  // String and template content that a regular expression would mistake for a
  // specifier contributes nothing.
  const noisy = scanModuleReferences(
    [
      'import real from "./real.js";',
      'const a = ", () => import(";',
      'const b = `${interpolated}`;',
      'const c = "In Progress";',
      '',
    ].join('\n'),
  );
  assert.deepEqual(noisy.statics, ['./real.js']);
});
