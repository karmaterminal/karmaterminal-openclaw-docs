import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function readRequired(file, label) {
  if (!existsSync(file)) throw new Error(`dependency provenance is missing ${label}`);
  return readFileSync(file);
}

export function assertPnpmDependencyProvenance(sourceDir, { requiredExecutables = [] } = {}) {
  const resolvedSource = path.resolve(sourceDir);
  const dependencyDir = path.join(resolvedSource, 'node_modules');
  if (!existsSync(dependencyDir)) {
    throw new Error('source dir has no node_modules; fixture refuses to install dependencies or mutate the candidate worktree');
  }
  if (!lstatSync(dependencyDir).isDirectory() || lstatSync(dependencyDir).isSymbolicLink()) {
    throw new Error('source node_modules must be a real directory; fixture refuses an indirect mutable dependency tree');
  }

  const packageJsonPath = path.join(resolvedSource, 'package.json');
  let packageJson;
  try {
    packageJson = JSON.parse(readRequired(packageJsonPath, 'package.json').toString('utf8'));
  } catch (error) {
    throw new Error(`dependency provenance cannot parse package.json: ${error.message}`);
  }
  if (typeof packageJson.packageManager !== 'string' || !/^pnpm@[^\s]+$/u.test(packageJson.packageManager)) {
    throw new Error('dependency provenance requires the candidate package.json to pin pnpm via packageManager');
  }

  const candidateLock = readRequired(path.join(resolvedSource, 'pnpm-lock.yaml'), 'candidate pnpm-lock.yaml');
  const installedLock = readRequired(
    path.join(dependencyDir, '.pnpm', 'lock.yaml'),
    'installed node_modules/.pnpm/lock.yaml',
  );
  const candidateLockfileSha256 = sha256(candidateLock);
  const installedLockfileSha256 = sha256(installedLock);
  if (candidateLockfileSha256 !== installedLockfileSha256) {
    throw new Error('installed dependency lockfile does not match the candidate pnpm-lock.yaml');
  }

  let modulesMetadata;
  try {
    modulesMetadata = JSON.parse(
      readRequired(path.join(dependencyDir, '.modules.yaml'), 'node_modules/.modules.yaml').toString('utf8'),
    );
  } catch (error) {
    throw new Error(`dependency provenance cannot parse node_modules/.modules.yaml: ${error.message}`);
  }
  if (modulesMetadata.virtualStoreDir !== '.pnpm' || !Number.isInteger(modulesMetadata.layoutVersion)) {
    throw new Error('dependency provenance requires a pnpm virtual store rooted at node_modules/.pnpm');
  }

  const dependencyRealPath = realpathSync(dependencyDir);
  for (const executable of requiredExecutables) {
    if (!/^[a-z0-9._-]+$/iu.test(executable)) {
      throw new Error(`invalid dependency executable name: ${executable}`);
    }
    const executablePath = path.join(dependencyDir, '.bin', executable);
    if (!existsSync(executablePath)) {
      throw new Error(`dependency provenance is missing node_modules/.bin/${executable}`);
    }
    const executableRealPath = realpathSync(executablePath);
    if (
      executableRealPath !== dependencyRealPath &&
      !executableRealPath.startsWith(`${dependencyRealPath}${path.sep}`)
    ) {
      throw new Error(`node_modules/.bin/${executable} resolves outside the verified dependency tree`);
    }
  }

  return {
    model: 'preinstalled-pnpm-virtual-store-lockfile-aligned',
    packageManager: packageJson.packageManager,
    candidateLockfileSha256,
    installedLockfileSha256,
    lockfileMatchesCandidate: true,
    virtualStoreDir: '.pnpm',
    layoutVersion: modulesMetadata.layoutVersion,
    requiredExecutables: [...requiredExecutables],
  };
}
