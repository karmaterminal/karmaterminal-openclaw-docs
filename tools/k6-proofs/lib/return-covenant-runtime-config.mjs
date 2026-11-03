import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  lstat,
  readFile,
  realpath,
} from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { canonicalJson } from './canonical-json.mjs';
import {
  RETURN_COVENANT_RUNTIME_CONFIG_RELATIVE_PATH,
} from './return-covenant-scenario-contract.mjs';

const execFileAsync = promisify(execFile);
const GIT_BLOB = /^(100644|100755) blob ([a-f0-9]{40,64})\t(.+)$/u;
const MAX_RUNTIME_CONFIG_BYTES = 64 * 1024;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
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

export async function verifyPublishedReturnCovenantRuntimeConfig({
  docsDir,
  docsHarnessSha,
  runtimeConfigPath,
  expected,
}) {
  if (
    expected?.relativePath !==
      RETURN_COVENANT_RUNTIME_CONFIG_RELATIVE_PATH
  ) {
    throw new Error('runtime config plan path is not the published fixture');
  }
  const docsPath = await realpath(docsDir);
  const publishedPath = path.join(docsPath, expected.relativePath);
  const suppliedPath = path.resolve(runtimeConfigPath);
  const [info, resolvedPath] = await Promise.all([
    lstat(suppliedPath),
    realpath(suppliedPath),
  ]);
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    info.size < 2 ||
    info.size > MAX_RUNTIME_CONFIG_BYTES ||
    suppliedPath !== publishedPath ||
    resolvedPath !== publishedPath
  ) {
    throw new Error(
      '--runtime-config must be the published tracked runtime config fixture',
    );
  }
  const [raw, treeEntry, workingBlob] = await Promise.all([
    readFile(publishedPath),
    git(docsPath, [
      'ls-tree',
      docsHarnessSha,
      '--',
      expected.relativePath,
    ]),
    git(docsPath, ['hash-object', '--', expected.relativePath]),
  ]);
  const match = treeEntry.match(GIT_BLOB);
  if (
    !match ||
    match[2] !== expected.gitBlob ||
    workingBlob !== expected.gitBlob ||
    match[3] !== expected.relativePath
  ) {
    throw new Error(
      'published runtime config Git blob differs from the frozen plan',
    );
  }
  let config;
  try {
    config = JSON.parse(raw.toString('utf8'));
  } catch (error) {
    throw new Error(`published runtime config is malformed: ${error.message}`);
  }
  if (sha256(canonicalJson(config)) !== expected.sha256) {
    throw new Error(
      'published runtime config content digest differs from the frozen plan',
    );
  }
  return {
    config,
    authority: {
      relativePath: expected.relativePath,
      gitBlob: expected.gitBlob,
      sha256: expected.sha256,
    },
  };
}
