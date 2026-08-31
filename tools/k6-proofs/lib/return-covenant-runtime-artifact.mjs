import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { canonicalJson } from './canonical-json.mjs';
import {
  RETURN_COVENANT_RUNTIME_ARTIFACT_BINDING_SCHEMA,
  RETURN_COVENANT_RUNTIME_ARTIFACT_SCHEMA,
  RETURN_COVENANT_RUNTIME_MOUNTS,
  validateReturnCovenantRuntimeArtifactBinding,
} from './return-covenant-runtime-artifact-contract.mjs';

export {
  RETURN_COVENANT_RUNTIME_ARTIFACT_BINDING_SCHEMA,
  RETURN_COVENANT_RUNTIME_ARTIFACT_SCHEMA,
  RETURN_COVENANT_RUNTIME_MOUNTS,
  validateReturnCovenantRuntimeArtifactBinding,
} from './return-covenant-runtime-artifact-contract.mjs';

export const RETURN_COVENANT_RUNTIME_BUILD_INPUTS = Object.freeze([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'node-version.mjs',
  'scripts/build-all.mts',
  'scripts/tsx.mjs',
  'tsdown.ai.config.ts',
  'tsdown.config.ts',
]);

const execFileAsync = promisify(execFile);
const SHA_40 = /^[a-f0-9]{40}$/u;
const SHA_256 = /^[a-f0-9]{64}$/u;
const RUN_ID = /^rcv-[a-f0-9]{32}$/u;
const GIT_BLOB = /^(100644|100755) blob ([a-f0-9]{40,64})\t(.+)$/u;
const MAX_MANIFEST_BYTES = 128 * 1024 * 1024;
const MAX_ARTIFACT_ENTRIES = 500_000;
const MAX_ARTIFACT_BYTES = 8 * 1024 * 1024 * 1024;
const COPY_BUFFER_BYTES = 1024 * 1024;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function exactKeys(value, keys) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const actual = Object.keys(value).toSorted();
  const expected = [...keys].toSorted();
  return actual.length === expected.length &&
    actual.every((entry, index) => entry === expected[index]);
}

function pathWithin(child, parent) {
  const relative = path.relative(parent, child);
  return relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function safeArtifactPath(value) {
  return typeof value === 'string' &&
    value.length > 0 &&
    !value.includes('\\') &&
    !path.posix.isAbsolute(value) &&
    path.posix.normalize(value) === value &&
    value !== '..' &&
    !value.startsWith('../');
}

function immutableMode(info, expected, label) {
  const mode = Number(info.mode & 0o777n);
  if (mode !== expected) {
    throw new Error(
      `${label} must have immutable mode ${expected.toString(8)}, observed ${mode.toString(8)}`,
    );
  }
  return mode;
}

function sameFileIdentity(before, after) {
  return before.dev === after.dev &&
    before.ino === after.ino &&
    before.size === after.size &&
    before.mtimeNs === after.mtimeNs &&
    before.mode === after.mode &&
    before.nlink === after.nlink;
}

async function git(directory, args) {
  const { stdout } = await execFileAsync('git', ['-C', directory, ...args], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    env: {
      ...process.env,
      GIT_DIR: undefined,
      GIT_WORK_TREE: undefined,
      GIT_INDEX_FILE: undefined,
      GIT_OBJECT_DIRECTORY: undefined,
      GIT_ALTERNATE_OBJECT_DIRECTORIES: undefined,
      GIT_NO_REPLACE_OBJECTS: '1',
    },
  });
  return stdout.trim();
}

async function readRegularFile(file, {
  expectedMode,
  maxBytes = MAX_ARTIFACT_BYTES,
  label = file,
} = {}) {
  const pathInfo = await lstat(file, { bigint: true });
  if (!pathInfo.isFile() || pathInfo.isSymbolicLink()) {
    throw new Error(`${label} must be a regular non-symlink file`);
  }
  if (pathInfo.nlink !== 1n) {
    throw new Error(`${label} must not be hard-linked`);
  }
  if (expectedMode !== undefined) {
    immutableMode(pathInfo, expectedMode, label);
  }
  if (pathInfo.size > BigInt(maxBytes)) {
    throw new Error(`${label} exceeds its byte bound`);
  }
  const handle = await open(
    file,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
  );
  try {
    const openedInfo = await handle.stat({ bigint: true });
    if (!openedInfo.isFile() || !sameFileIdentity(pathInfo, openedInfo)) {
      throw new Error(`${label} changed during no-follow open`);
    }
    const bytes = await handle.readFile();
    const finalInfo = await handle.stat({ bigint: true });
    if (!sameFileIdentity(openedInfo, finalInfo)) {
      throw new Error(`${label} changed while being read`);
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

async function regularFileSha256(file) {
  return sha256(await readRegularFile(file));
}

export async function currentReturnCovenantNodeIdentity() {
  const executablePath = await realpath(process.execPath);
  const reportHeader = process.report?.getReport()?.header;
  const libc = process.platform === 'linux'
    ? reportHeader?.glibcVersionRuntime
      ? 'glibc'
      : 'musl'
    : 'none';
  return {
    version: process.version,
    platform: process.platform,
    arch: process.arch,
    libc,
    modules: process.versions.modules,
    napi: process.versions.napi,
    executableSha256: await regularFileSha256(executablePath),
  };
}

async function copyRegularFile(source, destination, sourceInfo) {
  const sourceHandle = await open(
    source,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
  );
  const executable = (Number(sourceInfo.mode & 0o111n) !== 0);
  const finalMode = executable ? 0o555 : 0o444;
  const destinationHandle = await open(
    destination,
    fsConstants.O_WRONLY |
      fsConstants.O_CREAT |
      fsConstants.O_EXCL,
    0o600,
  );
  const digest = createHash('sha256');
  let total = 0;
  try {
    const openedInfo = await sourceHandle.stat({ bigint: true });
    if (!openedInfo.isFile() || !sameFileIdentity(sourceInfo, openedInfo)) {
      throw new Error(`prepared runtime file changed during open: ${source}`);
    }
    const buffer = Buffer.allocUnsafe(COPY_BUFFER_BYTES);
    let position = 0;
    while (true) {
      const { bytesRead } = await sourceHandle.read(
        buffer,
        0,
        buffer.length,
        position,
      );
      if (bytesRead === 0) break;
      const chunk = buffer.subarray(0, bytesRead);
      digest.update(chunk);
      let written = 0;
      while (written < bytesRead) {
        const result = await destinationHandle.write(
          chunk,
          written,
          bytesRead - written,
        );
        written += result.bytesWritten;
      }
      position += bytesRead;
      total += bytesRead;
      if (total > MAX_ARTIFACT_BYTES) {
        throw new Error('prepared runtime file exceeds the artifact byte bound');
      }
    }
    const finalSourceInfo = await sourceHandle.stat({ bigint: true });
    if (!sameFileIdentity(openedInfo, finalSourceInfo)) {
      throw new Error(`prepared runtime file changed while copying: ${source}`);
    }
  } finally {
    await Promise.all([
      sourceHandle.close(),
      destinationHandle.close(),
    ]);
  }
  await chmod(destination, finalMode);
  return { bytes: total, sha256: digest.digest('hex') };
}

async function copyPreparedEntry({
  source,
  destination,
  allowedRoots,
  activeDirectories,
  budget,
}) {
  let sourcePath = source;
  let info = await lstat(sourcePath, { bigint: true });
  if (info.isSymbolicLink()) {
    sourcePath = await realpath(sourcePath);
    if (!allowedRoots.some((root) => pathWithin(sourcePath, root))) {
      throw new Error(`prepared runtime symlink escapes its allowed roots: ${source}`);
    }
    info = await lstat(sourcePath, { bigint: true });
    if (info.isSymbolicLink()) {
      throw new Error(`prepared runtime symlink did not resolve: ${source}`);
    }
  }
  budget.entries += 1;
  if (budget.entries > MAX_ARTIFACT_ENTRIES) {
    throw new Error('prepared runtime exceeds the artifact entry bound');
  }
  if (info.isDirectory()) {
    const realSource = await realpath(sourcePath);
    const identity = `${info.dev}:${info.ino}`;
    if (activeDirectories.has(identity)) {
      throw new Error(`prepared runtime contains a directory cycle: ${source}`);
    }
    activeDirectories.add(identity);
    await mkdir(destination, { mode: 0o700 });
    try {
      for (const entry of (await readdir(realSource)).toSorted()) {
        await copyPreparedEntry({
          source: path.join(realSource, entry),
          destination: path.join(destination, entry),
          allowedRoots,
          activeDirectories,
          budget,
        });
      }
    } finally {
      activeDirectories.delete(identity);
    }
    await chmod(destination, 0o555);
    return;
  }
  if (!info.isFile()) {
    throw new Error(`prepared runtime contains a special file: ${source}`);
  }
  const copied = await copyRegularFile(sourcePath, destination, info);
  budget.bytes += copied.bytes;
  if (budget.bytes > MAX_ARTIFACT_BYTES) {
    throw new Error('prepared runtime exceeds the artifact byte bound');
  }
}

function inventoryEntryPath(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

async function scanImmutableEntry(root, file, entries, budget) {
  const relativePath = inventoryEntryPath(root, file);
  if (!safeArtifactPath(relativePath)) {
    throw new Error(`runtime artifact inventory path is unsafe: ${relativePath}`);
  }
  const info = await lstat(file, { bigint: true });
  budget.entries += 1;
  if (budget.entries > MAX_ARTIFACT_ENTRIES) {
    throw new Error('runtime artifact exceeds the entry bound');
  }
  if (info.isSymbolicLink()) {
    throw new Error(`runtime artifact symlinks are forbidden: ${relativePath}`);
  }
  if (info.isDirectory()) {
    const mode = immutableMode(info, 0o555, relativePath);
    entries.push({
      path: relativePath,
      type: 'directory',
      mode,
    });
    for (const entry of (await readdir(file)).toSorted()) {
      await scanImmutableEntry(root, path.join(file, entry), entries, budget);
    }
    return;
  }
  if (!info.isFile()) {
    throw new Error(`runtime artifact contains a special file: ${relativePath}`);
  }
  if (info.nlink !== 1n) {
    throw new Error(`runtime artifact file is hard-linked: ${relativePath}`);
  }
  const mode = Number(info.mode & 0o777n);
  if (mode !== 0o444 && mode !== 0o555) {
    throw new Error(
      `runtime artifact file must be immutable: ${relativePath}`,
    );
  }
  if (info.size > BigInt(MAX_ARTIFACT_BYTES)) {
    throw new Error(`runtime artifact file exceeds the byte bound: ${relativePath}`);
  }
  const handle = await open(
    file,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
  );
  const digest = createHash('sha256');
  let total = 0;
  try {
    const openedInfo = await handle.stat({ bigint: true });
    if (!openedInfo.isFile() || !sameFileIdentity(info, openedInfo)) {
      throw new Error(`runtime artifact file changed during open: ${relativePath}`);
    }
    const buffer = Buffer.allocUnsafe(COPY_BUFFER_BYTES);
    let position = 0;
    while (true) {
      const { bytesRead } = await handle.read(
        buffer,
        0,
        buffer.length,
        position,
      );
      if (bytesRead === 0) break;
      digest.update(buffer.subarray(0, bytesRead));
      position += bytesRead;
      total += bytesRead;
    }
    const finalInfo = await handle.stat({ bigint: true });
    if (!sameFileIdentity(openedInfo, finalInfo)) {
      throw new Error(`runtime artifact file changed while hashing: ${relativePath}`);
    }
  } finally {
    await handle.close();
  }
  budget.bytes += total;
  if (budget.bytes > MAX_ARTIFACT_BYTES) {
    throw new Error('runtime artifact exceeds the byte bound');
  }
  entries.push({
    path: relativePath,
    type: 'file',
    mode,
    size: total,
    sha256: digest.digest('hex'),
  });
}

function summarizeInventoryRoot(entries, mount) {
  const selected = entries.filter((entry) =>
    entry.path === mount.artifactPath ||
    entry.path.startsWith(`${mount.artifactPath}/`));
  const files = selected.filter((entry) => entry.type === 'file');
  return {
    kind: mount.kind,
    path: mount.artifactPath,
    entryCount: selected.length,
    fileCount: files.length,
    directoryCount: selected.length - files.length,
    totalBytes: files.reduce((total, entry) => total + entry.size, 0),
    sha256: sha256(canonicalJson(selected)),
  };
}

async function scanRuntimeArtifactPayload(artifactRoot) {
  const payloadPath = path.join(artifactRoot, 'payload');
  const payloadInfo = await lstat(payloadPath, { bigint: true });
  if (!payloadInfo.isDirectory() || payloadInfo.isSymbolicLink()) {
    throw new Error('runtime artifact payload must be a real directory');
  }
  const entries = [];
  const budget = { entries: 0, bytes: 0 };
  await scanImmutableEntry(artifactRoot, payloadPath, entries, budget);
  entries.sort((left, right) => left.path.localeCompare(right.path));
  const roots = RETURN_COVENANT_RUNTIME_MOUNTS.map((mount) =>
    summarizeInventoryRoot(entries, mount));
  if (roots.some((root) => root.fileCount < 1)) {
    throw new Error(
      'runtime artifact requires nonempty dependency and build-output closures',
    );
  }
  return {
    roots,
    entryCount: entries.length,
    fileCount: entries.filter((entry) => entry.type === 'file').length,
    directoryCount: entries.filter((entry) => entry.type === 'directory').length,
    totalBytes: budget.bytes,
    sha256: sha256(canonicalJson(entries)),
    entries,
  };
}

async function gitBuildInputIdentity(sourceDir, relativePath, productSha) {
  const treeEntry = await git(sourceDir, [
    'ls-tree',
    productSha,
    '--',
    relativePath,
  ]);
  const match = treeEntry.match(GIT_BLOB);
  if (!match || match[3] !== relativePath) {
    throw new Error(`runtime build input is not a regular Git blob: ${relativePath}`);
  }
  const file = path.join(sourceDir, relativePath);
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error(`runtime build input is not a regular file: ${relativePath}`);
  }
  const workingBlob = await git(sourceDir, ['hash-object', '--', relativePath]);
  if (workingBlob !== match[2]) {
    throw new Error(`runtime build input differs from Git: ${relativePath}`);
  }
  return {
    path: relativePath,
    gitBlob: match[2],
    sha256: await regularFileSha256(file),
  };
}

export async function verifyReturnCovenantTrackedCommand({
  sourceDir,
  relativePath,
  productSha,
  expectedSha256,
}) {
  if (!safeArtifactPath(relativePath)) {
    throw new Error('candidate command path must be normalized and relative');
  }
  const sourceRoot = await realpath(sourceDir);
  const target = path.resolve(sourceRoot, relativePath);
  const [targetInfo, targetReal, treeEntry] = await Promise.all([
    lstat(target),
    realpath(target),
    git(sourceRoot, ['ls-tree', productSha, '--', relativePath]),
  ]);
  if (
    !pathWithin(targetReal, sourceRoot) ||
    targetReal !== target ||
    !targetInfo.isFile() ||
    targetInfo.isSymbolicLink()
  ) {
    throw new Error('candidate command must be a contained regular non-symlink file');
  }
  const treeMatch = treeEntry.match(GIT_BLOB);
  if (!treeMatch || treeMatch[3] !== relativePath) {
    throw new Error('candidate command is not a regular Git blob');
  }
  const handle = await open(
    target,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
  );
  try {
    const handleInfo = await handle.stat();
    if (
      !handleInfo.isFile() ||
      handleInfo.dev !== targetInfo.dev ||
      handleInfo.ino !== targetInfo.ino
    ) {
      throw new Error('candidate command changed during verification');
    }
    const bytes = await handle.readFile();
    const workingBlob = await git(
      sourceRoot,
      ['hash-object', '--', relativePath],
    );
    const commandSha256 = sha256(bytes);
    if (
      workingBlob !== treeMatch[2] ||
      commandSha256 !== expectedSha256
    ) {
      throw new Error('candidate command bytes differ from the frozen plan');
    }
    return {
      path: target,
      gitMode: treeMatch[1],
      gitBlob: treeMatch[2],
      sha256: commandSha256,
    };
  } finally {
    await handle.close();
  }
}

function validateNodeIdentity(value) {
  return exactKeys(value, [
    'version',
    'platform',
    'arch',
    'libc',
    'modules',
    'napi',
    'executableSha256',
  ]) &&
    typeof value.version === 'string' &&
    typeof value.platform === 'string' &&
    typeof value.arch === 'string' &&
    ['glibc', 'musl', 'none'].includes(value.libc) &&
    typeof value.modules === 'string' &&
    typeof value.napi === 'string' &&
    SHA_256.test(value.executableSha256 || '');
}

function validatePackageManagerIdentity(value) {
  return exactKeys(value, [
    'name',
    'version',
    'packageManagerField',
    'executableSha256',
    'commandArgs',
    'commandSha256',
  ]) &&
    value.name === 'pnpm' &&
    typeof value.version === 'string' &&
    value.version.length > 0 &&
    typeof value.packageManagerField === 'string' &&
    value.packageManagerField.match(/^pnpm@([^+]+)(?:\+.*)?$/u)?.[1] ===
      value.version &&
    SHA_256.test(value.executableSha256 || '') &&
    Array.isArray(value.commandArgs) &&
    value.commandArgs.every((entry) =>
      typeof entry === 'string' && entry.length > 0) &&
    SHA_256.test(value.commandSha256 || '') &&
    value.commandSha256 === sha256(canonicalJson({
      executableSha256: value.executableSha256,
      commandArgs: value.commandArgs,
    }));
}

function validateInventoryEntry(entry) {
  if (
    !safeArtifactPath(entry?.path) ||
    !['directory', 'file'].includes(entry?.type)
  ) {
    return false;
  }
  if (entry.type === 'directory') {
    return exactKeys(entry, ['path', 'type', 'mode']) &&
      entry.mode === 0o555;
  }
  return exactKeys(entry, ['path', 'type', 'mode', 'size', 'sha256']) &&
    (entry.mode === 0o444 || entry.mode === 0o555) &&
    Number.isSafeInteger(entry.size) &&
    entry.size >= 0 &&
    SHA_256.test(entry.sha256 || '');
}

function validateInventoryRoot(root, mount) {
  return exactKeys(root, [
    'kind',
    'path',
    'entryCount',
    'fileCount',
    'directoryCount',
    'totalBytes',
    'sha256',
  ]) &&
    root.kind === mount.kind &&
    root.path === mount.artifactPath &&
    Number.isSafeInteger(root.entryCount) &&
    root.entryCount >= 2 &&
    Number.isSafeInteger(root.fileCount) &&
    root.fileCount >= 1 &&
    Number.isSafeInteger(root.directoryCount) &&
    root.directoryCount >= 1 &&
    root.entryCount === root.fileCount + root.directoryCount &&
    Number.isSafeInteger(root.totalBytes) &&
    root.totalBytes >= 0 &&
    SHA_256.test(root.sha256 || '');
}

function validateManifestShape(manifest) {
  if (!exactKeys(manifest, [
    'schema',
    'rowId',
    'runId',
    'product',
    'docsHarnessSha',
    'build',
    'toolchain',
    'inventory',
  ])) {
    throw new Error('runtime artifact manifest has unexpected fields');
  }
  if (
    manifest.schema !== RETURN_COVENANT_RUNTIME_ARTIFACT_SCHEMA ||
    manifest.rowId !== 'R-CD-RETURN-COVENANT-AUTHORITY' ||
    !RUN_ID.test(manifest.runId || '') ||
    !exactKeys(manifest.product, ['commitSha', 'treeSha']) ||
    !SHA_40.test(manifest.product.commitSha || '') ||
    !SHA_40.test(manifest.product.treeSha || '') ||
    !SHA_40.test(manifest.docsHarnessSha || '')
  ) {
    throw new Error('runtime artifact manifest identity is invalid');
  }
  if (
    !exactKeys(manifest.build, [
      'inputTreeSha',
      'command',
      'dependencyCommand',
      'inputs',
    ]) ||
    manifest.build.inputTreeSha !== manifest.product.treeSha ||
    canonicalJson(manifest.build.command) !==
      canonicalJson(['pnpm', 'run', 'build']) ||
    canonicalJson(manifest.build.dependencyCommand) !==
      canonicalJson([
        'pnpm',
        'install',
        '--prod',
        '--frozen-lockfile',
        '--os',
        manifest.toolchain?.node?.platform,
        '--cpu',
        manifest.toolchain?.node?.arch,
        '--libc',
        manifest.toolchain?.node?.libc,
      ]) ||
    !Array.isArray(manifest.build.inputs) ||
    manifest.build.inputs.length !== RETURN_COVENANT_RUNTIME_BUILD_INPUTS.length
  ) {
    throw new Error('runtime artifact build identity is invalid');
  }
  if (
    !exactKeys(manifest.toolchain, ['node', 'packageManager']) ||
    !validateNodeIdentity(manifest.toolchain.node) ||
    !validatePackageManagerIdentity(manifest.toolchain.packageManager)
  ) {
    throw new Error('runtime artifact toolchain identity is invalid');
  }
  if (
    !exactKeys(manifest.inventory, [
      'roots',
      'entryCount',
      'fileCount',
      'directoryCount',
      'totalBytes',
      'sha256',
      'entries',
    ]) ||
    !Array.isArray(manifest.inventory.roots) ||
    manifest.inventory.roots.length !== RETURN_COVENANT_RUNTIME_MOUNTS.length ||
    !manifest.inventory.roots.every((root, index) =>
      validateInventoryRoot(root, RETURN_COVENANT_RUNTIME_MOUNTS[index])) ||
    !Array.isArray(manifest.inventory.entries) ||
    manifest.inventory.entries.length < 5 ||
    manifest.inventory.entries.length > MAX_ARTIFACT_ENTRIES ||
    !manifest.inventory.entries.every(validateInventoryEntry) ||
    !Number.isSafeInteger(manifest.inventory.totalBytes) ||
    manifest.inventory.totalBytes < 1 ||
    manifest.inventory.totalBytes > MAX_ARTIFACT_BYTES ||
    !SHA_256.test(manifest.inventory.sha256 || '')
  ) {
    throw new Error('runtime artifact inventory shape is invalid');
  }
}

function buildRuntimeArtifactBinding(manifest) {
  return {
    schema: RETURN_COVENANT_RUNTIME_ARTIFACT_BINDING_SCHEMA,
    rowId: manifest.rowId,
    runId: manifest.runId,
    productSha: manifest.product.commitSha,
    productTreeSha: manifest.product.treeSha,
    docsHarnessSha: manifest.docsHarnessSha,
    manifestSha256: sha256(canonicalJson(manifest)),
    closureSha256: manifest.inventory.sha256,
    node: manifest.toolchain.node,
    mounts: RETURN_COVENANT_RUNTIME_MOUNTS.map((mount, index) => ({
      ...mount,
      readOnly: true,
      inventorySha256: manifest.inventory.roots[index].sha256,
    })),
  };
}

async function verifyBuildInputs(manifest, sourceDir) {
  const actual = await Promise.all(
    RETURN_COVENANT_RUNTIME_BUILD_INPUTS.map((relativePath) =>
      gitBuildInputIdentity(
        sourceDir,
        relativePath,
        manifest.product.commitSha,
      )),
  );
  if (canonicalJson(actual) !== canonicalJson(manifest.build.inputs)) {
    throw new Error('runtime artifact build inputs differ from the product tree');
  }
  const packageJson = JSON.parse(
    await readFile(path.join(sourceDir, 'package.json'), 'utf8'),
  );
  if (
    packageJson.packageManager !==
      manifest.toolchain.packageManager.packageManagerField
  ) {
    throw new Error('runtime artifact package-manager identity is stale');
  }
}

export async function verifyReturnCovenantRuntimeArtifact({
  artifactDir,
  sourceDir,
  expected,
}) {
  if (!artifactDir) {
    throw new Error('a return-covenant runtime artifact is required');
  }
  const artifactPath = path.resolve(artifactDir);
  const sourcePath = await realpath(sourceDir);
  const artifactInfo = await lstat(artifactPath, { bigint: true });
  if (!artifactInfo.isDirectory() || artifactInfo.isSymbolicLink()) {
    throw new Error('runtime artifact root must be a real directory');
  }
  immutableMode(artifactInfo, 0o555, 'runtime artifact root');
  const rootEntries = (await readdir(artifactPath)).toSorted();
  if (canonicalJson(rootEntries) !== canonicalJson(['manifest.json', 'payload'])) {
    throw new Error('runtime artifact root has missing or extra entries');
  }
  const payloadEntries = (await readdir(path.join(artifactPath, 'payload')))
    .toSorted();
  if (canonicalJson(payloadEntries) !== canonicalJson(['dist', 'node_modules'])) {
    throw new Error('runtime artifact payload has missing or extra mount roots');
  }
  const manifestBytes = await readRegularFile(
    path.join(artifactPath, 'manifest.json'),
    {
      expectedMode: 0o444,
      maxBytes: MAX_MANIFEST_BYTES,
      label: 'runtime artifact manifest',
    },
  );
  let manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString('utf8'));
  } catch (error) {
    throw new Error(`runtime artifact manifest is malformed: ${error.message}`);
  }
  validateManifestShape(manifest);
  const manifestSha256 = sha256(canonicalJson(manifest));
  if (
    manifest.rowId !== expected.rowId ||
    manifest.runId !== expected.runId ||
    manifest.product.commitSha !== expected.productSha ||
    manifest.product.treeSha !== expected.productTreeSha ||
    manifest.docsHarnessSha !== expected.docsHarnessSha ||
    manifestSha256 !== expected.manifestSha256
  ) {
    throw new Error('runtime artifact identity differs from the frozen plan');
  }
  const [sourceHead, sourceTree, sourceStatus, nodeIdentity] = await Promise.all([
    git(sourcePath, ['rev-parse', 'HEAD']),
    git(sourcePath, ['rev-parse', 'HEAD^{tree}']),
    git(sourcePath, ['status', '--porcelain=v1', '--untracked-files=no']),
    currentReturnCovenantNodeIdentity(),
  ]);
  if (
    sourceHead !== manifest.product.commitSha ||
    sourceTree !== manifest.product.treeSha ||
    sourceStatus !== ''
  ) {
    throw new Error('runtime artifact product commit/tree is not the candidate snapshot');
  }
  if (canonicalJson(nodeIdentity) !== canonicalJson(manifest.toolchain.node)) {
    throw new Error('runtime artifact Node identity differs from the launcher');
  }
  await verifyBuildInputs(manifest, sourcePath);
  const inventory = await scanRuntimeArtifactPayload(artifactPath);
  if (canonicalJson(inventory) !== canonicalJson(manifest.inventory)) {
    throw new Error('runtime artifact inventory or payload digest differs');
  }
  const binding = buildRuntimeArtifactBinding(manifest);
  if (!validateReturnCovenantRuntimeArtifactBinding(binding)) {
    throw new Error('runtime artifact binding could not be derived');
  }
  return {
    artifactDir: artifactPath,
    manifest,
    binding,
  };
}

async function writeRuntimeArtifactManifest(outputDir, manifest) {
  await writeFile(
    path.join(outputDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { mode: 0o600, flag: 'wx' },
  );
  await chmod(path.join(outputDir, 'manifest.json'), 0o444);
  await chmod(outputDir, 0o555);
}

async function copyRuntimePayload({
  dependencyDir,
  buildOutputDir,
  outputDir,
  allowedRoots,
}) {
  const payloadDir = path.join(outputDir, 'payload');
  await mkdir(payloadDir, { mode: 0o700 });
  const budget = { entries: 0, bytes: 0 };
  await copyPreparedEntry({
    source: dependencyDir,
    destination: path.join(payloadDir, 'node_modules'),
    allowedRoots,
    activeDirectories: new Set(),
    budget,
  });
  await copyPreparedEntry({
    source: buildOutputDir,
    destination: path.join(payloadDir, 'dist'),
    allowedRoots,
    activeDirectories: new Set(),
    budget,
  });
  await chmod(payloadDir, 0o555);
}

async function makeCreatedTreeWritable(target) {
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
      await makeCreatedTreeWritable(path.join(target, entry));
    }
    return;
  }
  await chmod(target, 0o600);
}

async function rethrowAfterCreatedTreeCleanup(target, originalError) {
  try {
    await makeCreatedTreeWritable(target);
    await rm(target, { recursive: true, force: true });
  } catch (cleanupError) {
    throw new AggregateError(
      [originalError, cleanupError],
      `${originalError.message}; runtime artifact cleanup also failed: ${cleanupError.message}`,
    );
  }
  throw originalError;
}

export async function removeReturnCovenantRuntimeArtifact(artifactDir) {
  const artifactPath = path.resolve(artifactDir);
  if (path.basename(artifactPath) !== 'runtime-artifact') {
    throw new Error('refusing to remove a non-runtime-artifact path');
  }
  await makeCreatedTreeWritable(artifactPath);
  await rm(artifactPath, { recursive: true, force: true });
}

async function packageManagerIdentity({
  command,
  packageManagerField,
  sourceDir,
}) {
  if (
    !Array.isArray(command) ||
    command.length < 1 ||
    !path.isAbsolute(command[0]) ||
    command.some((entry) => typeof entry !== 'string' || entry.length === 0)
  ) {
    throw new Error('package-manager command must be a nonempty absolute argv');
  }
  const executablePath = await realpath(command[0]);
  const executableInfo = await lstat(executablePath);
  if (!executableInfo.isFile() || executableInfo.isSymbolicLink()) {
    throw new Error('package-manager executable must resolve to a regular file');
  }
  const { NODE_OPTIONS: _nodeOptions, ...environment } = process.env;
  const { stdout } = await execFileAsync(
    command[0],
    [...command.slice(1), '--version'],
    {
      cwd: sourceDir,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
      env: environment,
    },
  );
  const version = stdout.trim();
  const expectedVersion =
    packageManagerField.match(/^pnpm@([^+]+)(?:\+.*)?$/u)?.[1];
  if (
    version.length === 0 ||
    expectedVersion !== version
  ) {
    throw new Error(
      'package-manager version differs from the product packageManager field',
    );
  }
  const executableSha256 = await regularFileSha256(executablePath);
  const commandArgs = command.slice(1);
  return {
    identity: {
      name: 'pnpm',
      version,
      packageManagerField,
      executableSha256,
      commandArgs,
      commandSha256: sha256(canonicalJson({
        executableSha256,
        commandArgs,
      })),
    },
    environment,
  };
}

export async function createReturnCovenantRuntimeArtifact({
  sourceDir,
  outputDir,
  runId,
  rowId = 'R-CD-RETURN-COVENANT-AUTHORITY',
  docsHarnessSha,
  packageManagerCommand,
}) {
  if (
    rowId !== 'R-CD-RETURN-COVENANT-AUTHORITY' ||
    !RUN_ID.test(runId || '') ||
    !SHA_40.test(docsHarnessSha || '')
  ) {
    throw new Error('runtime artifact run/docs identity is invalid');
  }
  const sourcePath = await realpath(sourceDir);
  const outputPath = path.resolve(outputDir);
  const outputParent = await realpath(path.dirname(outputPath));
  if (
    outputPath === '/' ||
    outputPath === outputParent ||
    pathWithin(outputPath, sourcePath) ||
    pathWithin(sourcePath, outputPath)
  ) {
    throw new Error('runtime artifact output must be outside the product source');
  }
  try {
    await stat(outputPath);
    throw new Error('runtime artifact output must not already exist');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const [productSha, productTreeSha, sourceStatus, packageJson] =
    await Promise.all([
      git(sourcePath, ['rev-parse', 'HEAD']),
      git(sourcePath, ['rev-parse', 'HEAD^{tree}']),
      git(sourcePath, ['status', '--porcelain=v1', '--untracked-files=no']),
      readFile(path.join(sourcePath, 'package.json'), 'utf8').then(JSON.parse),
    ]);
  if (
    !SHA_40.test(productSha) ||
    !SHA_40.test(productTreeSha) ||
    sourceStatus !== ''
  ) {
    throw new Error('runtime artifact source must be an exact clean Git commit');
  }
  const packageManager = await packageManagerIdentity({
    command: packageManagerCommand,
    packageManagerField: packageJson.packageManager,
    sourceDir: sourcePath,
  });
  const created = { value: false };
  try {
    await mkdir(outputPath, { mode: 0o700 });
    created.value = true;
    const { stdout, stderr } = await execFileAsync(
      packageManagerCommand[0],
      [...packageManagerCommand.slice(1), 'run', 'build'],
      {
        cwd: sourcePath,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        timeout: 30 * 60_000,
        env: packageManager.environment,
      },
    );
    const nodeIdentity = await currentReturnCovenantNodeIdentity();
    const dependencyCommand = [
      'install',
      '--prod',
      '--frozen-lockfile',
      '--os',
      nodeIdentity.platform,
      '--cpu',
      nodeIdentity.arch,
      '--libc',
      nodeIdentity.libc,
    ];
    const dependencyInstall = await execFileAsync(
      packageManagerCommand[0],
      [...packageManagerCommand.slice(1), ...dependencyCommand],
      {
        cwd: sourcePath,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        timeout: 30 * 60_000,
        env: {
          ...packageManager.environment,
          CI: '1',
        },
      },
    );
    if ((await git(
      sourcePath,
      ['status', '--porcelain=v1', '--untracked-files=no'],
    )) !== '') {
      throw new Error('runtime build modified tracked product files');
    }
    const dependencyDir = path.join(sourcePath, 'node_modules');
    const buildOutputDir = path.join(sourcePath, 'dist');
    const [dependencyInfo, buildInfo] = await Promise.all([
      lstat(dependencyDir),
      lstat(buildOutputDir),
    ]);
    if (
      !dependencyInfo.isDirectory() ||
      dependencyInfo.isSymbolicLink() ||
      !buildInfo.isDirectory() ||
      buildInfo.isSymbolicLink()
    ) {
      throw new Error(
        'runtime build must produce real node_modules and dist directories',
      );
    }
    const allowedRoots = [
      sourcePath,
      await realpath(dependencyDir),
      await realpath(buildOutputDir),
    ];
    await copyRuntimePayload({
      dependencyDir,
      buildOutputDir,
      outputDir: outputPath,
      allowedRoots,
    });
    const [buildInputs, inventory] = await Promise.all([
      Promise.all(RETURN_COVENANT_RUNTIME_BUILD_INPUTS.map((relativePath) =>
        gitBuildInputIdentity(sourcePath, relativePath, productSha))),
      scanRuntimeArtifactPayload(outputPath),
    ]);
    const manifest = {
      schema: RETURN_COVENANT_RUNTIME_ARTIFACT_SCHEMA,
      rowId,
      runId,
      product: {
        commitSha: productSha,
        treeSha: productTreeSha,
      },
      docsHarnessSha,
      build: {
        inputTreeSha: productTreeSha,
        command: ['pnpm', 'run', 'build'],
        dependencyCommand: ['pnpm', ...dependencyCommand],
        inputs: buildInputs,
      },
      toolchain: {
        node: nodeIdentity,
        packageManager: packageManager.identity,
      },
      inventory,
    };
    validateManifestShape(manifest);
    await writeRuntimeArtifactManifest(outputPath, manifest);
    return {
      artifactDir: outputPath,
      manifest,
      binding: buildRuntimeArtifactBinding(manifest),
      buildOutput: {
        stdout,
        stderr,
        dependencyStdout: dependencyInstall.stdout,
        dependencyStderr: dependencyInstall.stderr,
      },
    };
  } catch (error) {
    if (created.value) {
      await rethrowAfterCreatedTreeCleanup(outputPath, error);
    }
    throw error;
  }
}

export async function materializeReturnCovenantRuntimeArtifact({
  artifactDir,
  destinationDir,
  sourceDir,
  expected,
}) {
  const verified = await verifyReturnCovenantRuntimeArtifact({
    artifactDir,
    sourceDir,
    expected,
  });
  const destinationPath = path.resolve(destinationDir);
  try {
    await stat(destinationPath);
    throw new Error('private runtime artifact destination must not exist');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  await mkdir(destinationPath, { mode: 0o700 });
  try {
    await copyRuntimePayload({
      dependencyDir: path.join(verified.artifactDir, 'payload/node_modules'),
      buildOutputDir: path.join(verified.artifactDir, 'payload/dist'),
      outputDir: destinationPath,
      allowedRoots: [verified.artifactDir],
    });
    await writeRuntimeArtifactManifest(destinationPath, verified.manifest);
    const privateCopy = await verifyReturnCovenantRuntimeArtifact({
      artifactDir: destinationPath,
      sourceDir,
      expected,
    });
    if (
      canonicalJson(privateCopy.binding) !==
        canonicalJson(verified.binding)
    ) {
      throw new Error('private runtime artifact copy changed its binding');
    }
    return {
      ...privateCopy,
      mounts: privateCopy.binding.mounts.map((mount) => ({
        ...mount,
        source: path.join(destinationPath, mount.artifactPath),
      })),
    };
  } catch (error) {
    await rethrowAfterCreatedTreeCleanup(destinationPath, error);
  }
}
