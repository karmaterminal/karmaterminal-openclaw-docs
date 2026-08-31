import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmod,
  copyFile,
  cp,
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { canonicalJson } from '../../lib/canonical-json.mjs';
import {
  createReturnCovenantRuntimeArtifact,
  materializeReturnCovenantRuntimeArtifact,
  RETURN_COVENANT_RUNTIME_ARTIFACT_BINDING_SCHEMA,
  RETURN_COVENANT_RUNTIME_ARTIFACT_SCHEMA,
  validateReturnCovenantRuntimeArtifactBinding,
  verifyReturnCovenantRuntimeArtifact,
} from '../../lib/return-covenant-runtime-artifact.mjs';

const RUN_ID = 'rcv-0123456789abcdef0123456789abcdef';
const ROW_ID = 'R-CD-RETURN-COVENANT-AUTHORITY';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function git(directory, args) {
  const result = spawnSync('git', args, {
    cwd: directory,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

async function makeWritable(target) {
  let info;
  try {
    info = await lstat(target);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  if (info.isSymbolicLink()) return;
  if (info.isDirectory()) {
    await chmod(target, 0o700);
    for (const entry of await readdir(target)) {
      await makeWritable(path.join(target, entry));
    }
    return;
  }
  await chmod(target, 0o600);
}

async function removeTree(target) {
  await makeWritable(target);
  await rm(target, { recursive: true, force: true });
}

async function createSyntheticSource(root, { packageManagerVersion = '1.2.3' } = {}) {
  const sourceDir = path.join(root, 'source');
  const toolDir = path.join(root, 'tool');
  await Promise.all([
    mkdir(sourceDir, { mode: 0o700 }),
    mkdir(toolDir, { mode: 0o700 }),
  ]);
  const files = new Map([
    ['package.json', JSON.stringify({
      name: 'synthetic-openclaw',
      packageManager: `pnpm@${packageManagerVersion}+sha512.synthetic`,
      scripts: { build: 'synthetic' },
    }, null, 2)],
    ['pnpm-lock.yaml', 'lockfileVersion: synthetic\n'],
    ['pnpm-workspace.yaml', 'packages: []\n'],
    ['node-version.mjs', 'export const supported = true;\n'],
    ['scripts/build-all.mts', 'export {};\n'],
    ['scripts/tsx.mjs', 'export {};\n'],
    ['tsdown.ai.config.ts', 'export default {};\n'],
    ['tsdown.config.ts', 'export default {};\n'],
  ]);
  for (const [relative, contents] of files) {
    const file = path.join(sourceDir, relative);
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    await writeFile(file, contents, { mode: 0o600 });
  }
  await Promise.all([
    mkdir(path.join(sourceDir, 'node_modules/runtime-package'), {
      recursive: true,
      mode: 0o700,
    }),
    mkdir(path.join(sourceDir, 'dist'), { mode: 0o700 }),
  ]);
  await Promise.all([
    writeFile(
      path.join(sourceDir, 'node_modules/runtime-package/index.js'),
      'export const runtimeDependency = true;\n',
      { mode: 0o600 },
    ),
    writeFile(
      path.join(sourceDir, 'dist/entry.js'),
      'export const builtEntry = true;\n',
      { mode: 0o700 },
    ),
  ]);
  const packageManager = path.join(toolDir, 'pnpm');
  await writeFile(
    packageManager,
    [
      '#!/usr/bin/env node',
      `const version = ${JSON.stringify(packageManagerVersion)};`,
      "if (process.argv[2] === '--version') {",
      '  process.stdout.write(`${version}\\n`);',
      "} else if (process.argv[2] === 'run' && process.argv[3] === 'build') {",
      "  process.stdout.write('synthetic build complete\\n');",
      '} else {',
      "  process.stderr.write('unexpected synthetic package-manager command\\n');",
      '  process.exitCode = 2;',
      '}',
      '',
    ].join('\n'),
    { mode: 0o700 },
  );
  await git(sourceDir, ['init', '--quiet']);
  await git(sourceDir, ['config', 'user.name', 'Runtime Artifact Test']);
  await git(sourceDir, ['config', 'user.email', 'runtime-artifact@example.invalid']);
  await git(sourceDir, ['add', ...files.keys()]);
  await git(sourceDir, [
    '-c',
    'commit.gpgsign=false',
    'commit',
    '--quiet',
    '-m',
    'synthetic product',
  ]);
  return {
    sourceDir,
    packageManager,
    head: await git(sourceDir, ['rev-parse', 'HEAD']),
    tree: await git(sourceDir, ['rev-parse', 'HEAD^{tree}']),
  };
}

async function createArtifactFixture(root) {
  const source = await createSyntheticSource(root);
  const artifactDir = path.join(root, 'artifact');
  const created = await createReturnCovenantRuntimeArtifact({
    sourceDir: source.sourceDir,
    outputDir: artifactDir,
    runId: RUN_ID,
    docsHarnessSha: source.head,
    packageManagerCommand: [source.packageManager],
  });
  return {
    ...source,
    artifactDir,
    manifest: created.manifest,
    binding: created.binding,
    expected: {
      rowId: ROW_ID,
      runId: RUN_ID,
      productSha: source.head,
      productTreeSha: source.tree,
      docsHarnessSha: source.head,
      manifestSha256: created.binding.manifestSha256,
    },
  };
}

async function cloneArtifact(fixture, name) {
  const clone = path.join(path.dirname(fixture.artifactDir), name);
  await cp(fixture.artifactDir, clone, {
    recursive: true,
    preserveTimestamps: true,
  });
  return clone;
}

async function rewriteManifest(artifactDir, transform) {
  const manifestPath = path.join(artifactDir, 'manifest.json');
  await chmod(artifactDir, 0o700);
  await chmod(manifestPath, 0o600);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  transform(manifest);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await chmod(manifestPath, 0o444);
  await chmod(artifactDir, 0o555);
  return {
    manifest,
    manifestSha256: sha256(canonicalJson(manifest)),
  };
}

test('runtime artifact producer and verifier bind an immutable complete closure', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'return-covenant-runtime-'));
  try {
    const fixture = await createArtifactFixture(root);
    const verified = await verifyReturnCovenantRuntimeArtifact({
      artifactDir: fixture.artifactDir,
      sourceDir: fixture.sourceDir,
      expected: fixture.expected,
    });
    assert.equal(
      verified.manifest.schema,
      RETURN_COVENANT_RUNTIME_ARTIFACT_SCHEMA,
    );
    assert.equal(
      verified.binding.schema,
      RETURN_COVENANT_RUNTIME_ARTIFACT_BINDING_SCHEMA,
    );
    assert.equal(validateReturnCovenantRuntimeArtifactBinding(
      verified.binding,
    ), true);
    assert.equal(verified.binding.productSha, fixture.head);
    assert.equal(verified.binding.productTreeSha, fixture.tree);
    assert.deepEqual(
      verified.binding.mounts.map((entry) => ({
        kind: entry.kind,
        candidatePath: entry.candidatePath,
        readOnly: entry.readOnly,
      })),
      [
        {
          kind: 'dependency-closure',
          candidatePath: 'node_modules',
          readOnly: true,
        },
        {
          kind: 'build-output',
          candidatePath: 'dist',
          readOnly: true,
        },
      ],
    );
    const privateArtifact = path.join(root, 'private-artifact');
    const materialized = await materializeReturnCovenantRuntimeArtifact({
      artifactDir: fixture.artifactDir,
      destinationDir: privateArtifact,
      sourceDir: fixture.sourceDir,
      expected: fixture.expected,
    });
    assert.deepEqual(materialized.binding, verified.binding);
    const sourceFile = await lstat(path.join(
      fixture.artifactDir,
      'payload/dist/entry.js',
    ));
    const privateFile = await lstat(path.join(
      privateArtifact,
      'payload/dist/entry.js',
    ));
    assert.notEqual(sourceFile.ino, privateFile.ino);
    assert.equal(privateFile.nlink, 1);
  } finally {
    await removeTree(root);
  }
});

test('runtime artifact producer rejects the wrong package-manager identity', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'return-covenant-runtime-pm-'));
  try {
    const source = await createSyntheticSource(root, {
      packageManagerVersion: '1.2.3',
    });
    const wrongPackageManager = path.join(root, 'wrong-pnpm');
    await copyFile(source.packageManager, wrongPackageManager);
    await chmod(wrongPackageManager, 0o700);
    await writeFile(
      wrongPackageManager,
      "#!/usr/bin/env node\nif (process.argv[2] === '--version') console.log('9.9.9');\n",
      { mode: 0o700 },
    );
    const outputDir = path.join(root, 'rejected-artifact');
    await assert.rejects(
      createReturnCovenantRuntimeArtifact({
        sourceDir: source.sourceDir,
        outputDir,
        runId: RUN_ID,
        docsHarnessSha: source.head,
        packageManagerCommand: [wrongPackageManager],
      }),
      /package-manager version differs/,
    );
    await assert.rejects(lstat(outputDir), (error) => error?.code === 'ENOENT');
  } finally {
    await removeTree(root);
  }
});

test('runtime artifact verifier rejects absence and stale identities before use', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'return-covenant-runtime-id-'));
  try {
    const fixture = await createArtifactFixture(root);
    await assert.rejects(
      verifyReturnCovenantRuntimeArtifact({
        artifactDir: null,
        sourceDir: fixture.sourceDir,
        expected: fixture.expected,
      }),
      /runtime artifact is required/,
    );
    for (const [field, value] of [
      ['runId', 'rcv-fedcba9876543210fedcba9876543210'],
      ['rowId', 'R-CD-WRONG-ROW'],
      ['productSha', '1'.repeat(40)],
      ['productTreeSha', '2'.repeat(40)],
      ['docsHarnessSha', '3'.repeat(40)],
      ['manifestSha256', '4'.repeat(64)],
    ]) {
      await assert.rejects(
        verifyReturnCovenantRuntimeArtifact({
          artifactDir: fixture.artifactDir,
          sourceDir: fixture.sourceDir,
          expected: { ...fixture.expected, [field]: value },
        }),
        /identity differs from the frozen plan/,
        field,
      );
    }
  } finally {
    await removeTree(root);
  }
});

test('runtime artifact verifier rejects manifest and payload digest alteration', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'return-covenant-runtime-digest-'));
  try {
    const fixture = await createArtifactFixture(root);
    const manifestArtifact = await cloneArtifact(fixture, 'manifest-altered');
    await rewriteManifest(manifestArtifact, (manifest) => {
      manifest.build.command = ['pnpm', 'run', 'wrong-build'];
    });
    await assert.rejects(
      verifyReturnCovenantRuntimeArtifact({
        artifactDir: manifestArtifact,
        sourceDir: fixture.sourceDir,
        expected: fixture.expected,
      }),
      /build identity|identity differs/,
    );

    const payloadArtifact = await cloneArtifact(fixture, 'payload-altered');
    const payloadFile = path.join(payloadArtifact, 'payload/dist/entry.js');
    await chmod(payloadArtifact, 0o700);
    await chmod(path.dirname(payloadFile), 0o700);
    await chmod(payloadFile, 0o600);
    await writeFile(payloadFile, 'altered build output\n');
    await chmod(payloadFile, 0o444);
    await chmod(path.dirname(payloadFile), 0o555);
    await chmod(payloadArtifact, 0o555);
    await assert.rejects(
      verifyReturnCovenantRuntimeArtifact({
        artifactDir: payloadArtifact,
        sourceDir: fixture.sourceDir,
        expected: fixture.expected,
      }),
      /inventory or payload digest differs/,
    );
  } finally {
    await removeTree(root);
  }
});

test('runtime artifact verifier rejects missing, extra, and partial closures', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'return-covenant-runtime-shape-'));
  try {
    const fixture = await createArtifactFixture(root);
    for (const [name, mutate, message] of [
      [
        'missing-file',
        async (artifact) => {
          const directory = path.join(artifact, 'payload/dist');
          await chmod(artifact, 0o700);
          await chmod(directory, 0o700);
          await unlink(path.join(directory, 'entry.js'));
          await chmod(directory, 0o555);
          await chmod(artifact, 0o555);
        },
        /nonempty|inventory/,
      ],
      [
        'extra-file',
        async (artifact) => {
          const directory = path.join(artifact, 'payload/dist');
          await chmod(artifact, 0o700);
          await chmod(directory, 0o700);
          await writeFile(path.join(directory, 'extra.js'), 'extra\n', {
            mode: 0o444,
          });
          await chmod(directory, 0o555);
          await chmod(artifact, 0o555);
        },
        /inventory/,
      ],
      [
        'missing-build-output',
        async (artifact) => {
          await chmod(artifact, 0o700);
          await chmod(path.join(artifact, 'payload'), 0o700);
          await makeWritable(path.join(artifact, 'payload/dist'));
          await rm(path.join(artifact, 'payload/dist'), {
            recursive: true,
            force: true,
          });
          await chmod(path.join(artifact, 'payload'), 0o555);
          await chmod(artifact, 0o555);
        },
        /missing or extra mount roots/,
      ],
      [
        'missing-dependency-closure',
        async (artifact) => {
          await chmod(artifact, 0o700);
          await chmod(path.join(artifact, 'payload'), 0o700);
          await makeWritable(path.join(artifact, 'payload/node_modules'));
          await rm(path.join(artifact, 'payload/node_modules'), {
            recursive: true,
            force: true,
          });
          await chmod(path.join(artifact, 'payload'), 0o555);
          await chmod(artifact, 0o555);
        },
        /missing or extra mount roots/,
      ],
    ]) {
      const artifact = await cloneArtifact(fixture, name);
      await mutate(artifact);
      await assert.rejects(
        verifyReturnCovenantRuntimeArtifact({
          artifactDir: artifact,
          sourceDir: fixture.sourceDir,
          expected: fixture.expected,
        }),
        message,
        name,
      );
    }
  } finally {
    await removeTree(root);
  }
});

test('runtime artifact verifier rejects writable, linked, traversing, and special entries', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'return-covenant-runtime-escape-'));
  try {
    const fixture = await createArtifactFixture(root);
    const targetRelative = 'payload/dist/entry.js';
    for (const [name, mutate, message] of [
      [
        'writable-root',
        async (artifact) => chmod(artifact, 0o755),
        /immutable mode/,
      ],
      [
        'writable-file',
        async (artifact) => {
          await chmod(artifact, 0o700);
          await chmod(path.join(artifact, targetRelative), 0o644);
          await chmod(artifact, 0o555);
        },
        /must be immutable/,
      ],
      [
        'symlink',
        async (artifact) => {
          const file = path.join(artifact, targetRelative);
          await chmod(artifact, 0o700);
          await chmod(path.dirname(file), 0o700);
          await unlink(file);
          await symlink('/etc/passwd', file);
          await chmod(path.dirname(file), 0o555);
          await chmod(artifact, 0o555);
        },
        /symlinks are forbidden/,
      ],
      [
        'hardlink',
        async (artifact) => {
          const file = path.join(artifact, targetRelative);
          const peer = path.join(artifact, 'payload/dist/hardlink.js');
          await chmod(artifact, 0o700);
          await chmod(path.dirname(file), 0o700);
          await link(file, peer);
          await chmod(path.dirname(file), 0o555);
          await chmod(artifact, 0o555);
        },
        /hard-linked/,
      ],
      [
        'fifo',
        async (artifact) => {
          const file = path.join(artifact, targetRelative);
          await chmod(artifact, 0o700);
          await chmod(path.dirname(file), 0o700);
          await unlink(file);
          const made = spawnSync('mkfifo', [file], { encoding: 'utf8' });
          assert.equal(made.status, 0, made.stderr);
          await chmod(path.dirname(file), 0o555);
          await chmod(artifact, 0o555);
        },
        /special file/,
      ],
    ]) {
      const artifact = await cloneArtifact(fixture, name);
      await mutate(artifact);
      await assert.rejects(
        verifyReturnCovenantRuntimeArtifact({
          artifactDir: artifact,
          sourceDir: fixture.sourceDir,
          expected: fixture.expected,
        }),
        message,
        name,
      );
    }

    const traversal = await cloneArtifact(fixture, 'path-traversal');
    const rewritten = await rewriteManifest(traversal, (manifest) => {
      manifest.inventory.entries[0].path = '../escape';
    });
    await assert.rejects(
      verifyReturnCovenantRuntimeArtifact({
        artifactDir: traversal,
        sourceDir: fixture.sourceDir,
        expected: {
          ...fixture.expected,
          manifestSha256: rewritten.manifestSha256,
        },
      }),
      /inventory shape is invalid/,
    );
  } finally {
    await removeTree(root);
  }
});

test('runtime artifact verifier rejects wrong Node and package-manager identities', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'return-covenant-runtime-toolchain-'));
  try {
    const fixture = await createArtifactFixture(root);
    const wrongNode = await cloneArtifact(fixture, 'wrong-node');
    const nodeManifest = await rewriteManifest(wrongNode, (manifest) => {
      manifest.toolchain.node.version = 'v0.0.0';
    });
    await assert.rejects(
      verifyReturnCovenantRuntimeArtifact({
        artifactDir: wrongNode,
        sourceDir: fixture.sourceDir,
        expected: {
          ...fixture.expected,
          manifestSha256: nodeManifest.manifestSha256,
        },
      }),
      /Node identity differs/,
    );

    const wrongPackageManager = await cloneArtifact(
      fixture,
      'wrong-package-manager',
    );
    const packageManagerManifest = await rewriteManifest(
      wrongPackageManager,
      (manifest) => {
        manifest.toolchain.packageManager.version = '9.9.9';
        manifest.toolchain.packageManager.packageManagerField =
          'pnpm@9.9.9+sha512.synthetic';
      },
    );
    await assert.rejects(
      verifyReturnCovenantRuntimeArtifact({
        artifactDir: wrongPackageManager,
        sourceDir: fixture.sourceDir,
        expected: {
          ...fixture.expected,
          manifestSha256: packageManagerManifest.manifestSha256,
        },
      }),
      /package-manager identity is stale/,
    );
  } finally {
    await removeTree(root);
  }
});
