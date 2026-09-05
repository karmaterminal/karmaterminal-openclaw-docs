import { createHash } from 'node:crypto';
import {
  constants,
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const EXACT_PNPM =
  /^pnpm@((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)(?:\+sha512\.([a-f0-9]{128}))?$/u;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function isInside(child, parent) {
  const relative = path.relative(parent, child);
  return relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function realFile(file, label) {
  if (!existsSync(file)) throw new Error(`${label} is missing`);
  const info = lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error(`${label} must be a regular non-symlink file`);
  }
  return realpathSync(file);
}

function realDirectory(directory, label) {
  if (!existsSync(directory)) throw new Error(`${label} is missing`);
  const info = lstatSync(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error(`${label} must be a real non-symlink directory`);
  }
  return realpathSync(directory);
}

export function parseExactPnpmPackageManager(declaration, {
  requireIntegrity = false,
  label = 'candidate package.json packageManager',
} = {}) {
  const match = typeof declaration === 'string' ? EXACT_PNPM.exec(declaration) : null;
  if (!match || (requireIntegrity && !match[2])) {
    throw new Error(
      `${label} must pin pnpm@<semver>${requireIntegrity ? '+sha512.<128-hex>' : ' with an optional +sha512.<128-hex>'}`,
    );
  }
  return {
    declaration,
    version: match[1],
    integrityHex: match[2] || '',
    integrityBase64: match[2] ? Buffer.from(match[2], 'hex').toString('base64') : '',
  };
}

export function splitPnpmLockDocuments(raw) {
  const normalized = String(raw).replaceAll('\r\n', '\n');
  const documents = [];
  let current = [];
  for (const line of normalized.split('\n')) {
    if (line === '---') {
      if (current.some((entry) => entry.length > 0)) {
        documents.push(`${current.join('\n').replace(/\n+$/u, '')}\n`);
      }
      current = [];
      continue;
    }
    current.push(line);
  }
  if (current.some((entry) => entry.length > 0)) {
    documents.push(`${current.join('\n').replace(/\n+$/u, '')}\n`);
  }
  return documents;
}

function packageIntegrity(lockDocument, packageName, version) {
  const escaped = `${packageName}@${version}`.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const block = lockDocument.match(
    new RegExp(`^  ['"]?${escaped}['"]?:\\n((?: {4}.*\\n|\\n)*)`, 'mu'),
  )?.[1];
  return block?.match(/resolution:\s*\{[^}]*integrity:\s*(sha512-[A-Za-z0-9+/]+={0,2})/u)?.[1] ?? null;
}

function packageManagerBootstrapDocument(documents) {
  return documents.find((document) => /^    packageManagerDependencies:/mu.test(document)) ?? null;
}

export function verifyPnpmLockProvenance({
  candidateLock,
  installedLock,
  packageManager,
}) {
  const parsedManager = typeof packageManager === 'string'
    ? parseExactPnpmPackageManager(packageManager)
    : packageManager;
  const documents = splitPnpmLockDocuments(candidateLock);
  if (documents.length === 0) throw new Error('candidate pnpm lockfile has no YAML document');

  const bootstrap = packageManagerBootstrapDocument(documents);
  const workspaceDocuments = documents.filter((document) => document !== bootstrap);
  if (workspaceDocuments.length !== 1) {
    throw new Error('candidate pnpm lockfile must contain exactly one workspace graph document');
  }
  if (bootstrap) {
    const specifier = bootstrap.match(/^\s+specifier:\s*([^\s]+)\s*$/mu)?.[1];
    const version = bootstrap.match(/^\s+version:\s*([^\s]+)\s*$/mu)?.[1];
    if (specifier !== parsedManager.version || version !== parsedManager.version) {
      throw new Error('candidate package-manager lock document does not match packageManager version');
    }
    if (parsedManager.integrityBase64) {
      const integrity = packageIntegrity(bootstrap, 'pnpm', parsedManager.version);
      if (integrity !== `sha512-${parsedManager.integrityBase64}`) {
        throw new Error('candidate package-manager lock integrity does not match packageManager pin');
      }
    }
  }

  const workspaceGraph = workspaceDocuments[0];
  const normalizedInstalled = `${String(installedLock)
    .replaceAll('\r\n', '\n')
    .replace(/^---\n/u, '')
    .replace(/\n+$/u, '')}\n`;
  if (workspaceGraph !== normalizedInstalled) {
    throw new Error(
      'installed virtual-store workspace graph/importers/package integrity differ from candidate lockfile',
    );
  }
  return {
    candidateLockfileSha256: sha256(Buffer.from(candidateLock)),
    installedLockfileSha256: sha256(Buffer.from(installedLock)),
    candidateWorkspaceGraphSha256: sha256(Buffer.from(workspaceGraph)),
    packageManagerBootstrapSha256: bootstrap ? sha256(Buffer.from(bootstrap)) : null,
    installedGraphMatchesCandidate: true,
    packageManagerBootstrapValidated: Boolean(bootstrap),
  };
}

function nativePnpmPackageName({ platform = process.platform, arch = process.arch, libc } = {}) {
  if (platform === 'darwin' && (arch === 'arm64' || arch === 'x64')) {
    return `@pnpm/exe.darwin-${arch}`;
  }
  if (platform === 'win32' && (arch === 'arm64' || arch === 'x64')) {
    return `@pnpm/exe.win32-${arch}`;
  }
  if (platform === 'linux' && (arch === 'arm64' || arch === 'x64')) {
    const runtimeLibc =
      libc ?? (process.report?.getReport?.().header?.glibcVersionRuntime ? 'glibc' : 'musl');
    return `@pnpm/exe.linux-${arch}${runtimeLibc === 'musl' ? '-musl' : ''}`;
  }
  throw new Error(`unsupported pnpm native platform: ${platform}/${arch}`);
}

export function resolvePinnedPnpmFromNodeModules({
  candidatePackageManager,
  candidateLock,
  nodeModulesDir,
  runVersion,
  platform,
  arch,
  libc,
}) {
  const manager = typeof candidatePackageManager === 'string'
    ? parseExactPnpmPackageManager(candidatePackageManager, { requireIntegrity: true })
    : candidatePackageManager;
  const nodeModules = realDirectory(nodeModulesDir, 'pinned package-manager node_modules');
  const lockPath = realFile(path.join(nodeModules, '.package-lock.json'), 'pinned package metadata');
  const packageLock = JSON.parse(readFileSync(lockPath, 'utf8'));
  const pnpmLockEntry = packageLock?.packages?.['node_modules/pnpm'];
  if (
    pnpmLockEntry?.version !== manager.version ||
    pnpmLockEntry?.integrity !== `sha512-${manager.integrityBase64}`
  ) {
    throw new Error('installed pnpm package metadata does not match candidate version/integrity');
  }

  const pnpmRoot = realDirectory(path.join(nodeModules, 'pnpm'), 'installed pnpm package');
  const pnpmPackage = JSON.parse(
    readFileSync(realFile(path.join(pnpmRoot, 'package.json'), 'installed pnpm package.json'), 'utf8'),
  );
  if (
    pnpmPackage?.version !== manager.version ||
    typeof pnpmPackage?.bin?.pnpm !== 'string'
  ) {
    throw new Error('installed pnpm package.json does not match candidate metadata');
  }
  const declaredBin = path.resolve(pnpmRoot, pnpmPackage.bin.pnpm);
  if (!isInside(declaredBin, pnpmRoot)) {
    throw new Error('installed pnpm package.json bin entry escapes its package root');
  }

  const nativeName = nativePnpmPackageName({ platform, arch, libc });
  if (pnpmPackage?.optionalDependencies?.[nativeName] !== manager.version) {
    throw new Error('installed pnpm package does not declare the exact native executable package');
  }
  const nativeRelative = `node_modules/${nativeName}`;
  const nativeLockEntry = packageLock?.packages?.[nativeRelative];
  if (nativeLockEntry?.version !== manager.version || typeof nativeLockEntry?.integrity !== 'string') {
    throw new Error('native pnpm package metadata is missing or version-mismatched');
  }
  const lockDocuments = splitPnpmLockDocuments(candidateLock);
  const bootstrap = packageManagerBootstrapDocument(lockDocuments);
  if (!bootstrap) throw new Error('candidate lockfile has no package-manager bootstrap document');
  if (packageIntegrity(bootstrap, nativeName, manager.version) !== nativeLockEntry.integrity) {
    throw new Error('native pnpm package integrity differs from the candidate lockfile');
  }

  const nativeRoot = realDirectory(path.join(nodeModules, nativeName), 'native pnpm package');
  const nativePackage = JSON.parse(
    readFileSync(realFile(path.join(nativeRoot, 'package.json'), 'native pnpm package.json'), 'utf8'),
  );
  if (nativePackage?.name !== nativeName || nativePackage?.version !== manager.version) {
    throw new Error('native pnpm package.json identity is invalid');
  }
  const executable = realFile(path.join(nativeRoot, 'pnpm'), 'native pnpm executable');
  if (!isInside(executable, nodeModules)) {
    throw new Error('native pnpm executable resolves outside pinned node_modules');
  }
  const mode = lstatSync(executable).mode;
  if ((mode & constants.S_IXUSR) === 0) {
    throw new Error('native pnpm executable is not owner-executable');
  }
  const version = runVersion(executable);
  if (version !== manager.version) {
    throw new Error(`native pnpm version ${version || '<missing>'} differs from candidate pin`);
  }
  return {
    packageManager: manager.declaration,
    pnpmVersion: manager.version,
    pnpmIntegritySha512: manager.integrityHex,
    executable,
    executableSha256: sha256(readFileSync(executable)),
    declaredBin: path.relative(nodeModules, declaredBin),
    nativePackage: nativeName,
    nativePackageIntegrity: nativeLockEntry.integrity,
    metadataLockSha256: sha256(readFileSync(lockPath)),
  };
}
