import { constants as fsConstants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

function pathWithin(value, root) {
  const relative = path.relative(root, value);
  return relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

export async function attestReturnCovenantRuntimeArtifactSource({
  suppliedPath,
  resolvedPath,
  homePath,
  expectedUid = typeof process.getuid === 'function' ? process.getuid() : null,
}) {
  if (!homePath || !pathWithin(resolvedPath, homePath)) {
    return { homeContained: false };
  }
  if (resolvedPath === homePath) {
    throw new Error('--runtime-artifact cannot be the HOME root');
  }
  if (path.resolve(suppliedPath) !== resolvedPath) {
    throw new Error('--runtime-artifact HOME path must not traverse a symlink');
  }
  let current = homePath;
  for (const component of path.relative(homePath, resolvedPath).split(path.sep)) {
    if (!component) continue;
    current = path.join(current, component);
    const info = await lstat(current);
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new Error('--runtime-artifact HOME path contains a symlink or non-directory');
    }
    if (expectedUid !== null && info.uid !== expectedUid) {
      throw new Error('--runtime-artifact HOME path is not owned by the current user');
    }
  }
  const rootInfo = await lstat(resolvedPath);
  if ((rootInfo.mode & 0o022) !== 0) {
    throw new Error('--runtime-artifact HOME root must not be group/world writable');
  }
  const handle = await open(
    resolvedPath,
    fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW,
  );
  try {
    const opened = await handle.stat();
    if (
      opened.dev !== rootInfo.dev ||
      opened.ino !== rootInfo.ino ||
      (expectedUid !== null && opened.uid !== expectedUid)
    ) {
      throw new Error('--runtime-artifact HOME root changed during no-follow identity check');
    }
  } finally {
    await handle.close();
  }
  return {
    homeContained: true,
    ownerUid: rootInfo.uid,
    mode: rootInfo.mode & 0o777,
    device: rootInfo.dev,
    inode: rootInfo.ino,
  };
}
