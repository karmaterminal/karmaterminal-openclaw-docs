/**
 * Extracted-runtime resolution: the artifact alone must satisfy every sanctioned
 * entrypoint, with no symlink, no alias, and no reliance on the product tree.
 *
 * These run real `node` against an artifact-shaped payload, because resolution
 * is the one property that cannot be established by reading the producer.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function write(file, text) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, text, { mode: 0o600 });
}

/**
 * Payload shaped like the artifact: `payload/dist` is the mount, and the root
 * package is materialised at `payload/node_modules/openclaw` with its own copy
 * of the selected dist closure, because package exports may not escape their
 * package root.
 */
async function makePayload(root, { withRootPackage, extensionHasManifest }) {
  const payload = path.join(root, 'payload');
  await write(
    path.join(payload, 'dist/plugin-sdk/channel-entry-contract.js'),
    'export const defineBundledChannelEntry = (value) => value;\n',
  );
  if (extensionHasManifest) {
    await write(
      path.join(payload, 'dist/extensions/demo/package.json'),
      `${JSON.stringify({ name: '@openclaw/demo', type: 'module' }, null, 2)}\n`,
    );
  }
  await write(
    path.join(payload, 'dist/extensions/demo/index.js'),
    [
      'import { defineBundledChannelEntry } from "openclaw/plugin-sdk/channel-entry-contract";',
      'console.log("RESOLVED", typeof defineBundledChannelEntry);',
      '',
    ].join('\n'),
  );
  if (withRootPackage) {
    await write(
      path.join(payload, 'node_modules/openclaw/package.json'),
      `${JSON.stringify({
        name: 'openclaw',
        version: '1.0.0',
        type: 'module',
        exports: {
          './plugin-sdk/channel-entry-contract':
            './dist/plugin-sdk/channel-entry-contract.js',
        },
      }, null, 2)}\n`,
    );
    await write(
      path.join(payload, 'node_modules/openclaw/dist/plugin-sdk/channel-entry-contract.js'),
      'export const defineBundledChannelEntry = (value) => value;\n',
    );
  }
  return payload;
}

test('extracted runtime resolves a sanctioned root-package entrypoint from the artifact alone', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'rcv-resolution-ok-'));
  try {
    const payload = await makePayload(root, {
      withRootPackage: true,
      extensionHasManifest: true,
    });
    const { stdout } = await execFileAsync(
      process.execPath,
      [path.join(payload, 'dist/extensions/demo/index.js')],
      { encoding: 'utf8' },
    );
    assert.match(stdout, /RESOLVED function/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a bundled manifest shadows package self-reference, so the root package materialisation is required', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'rcv-resolution-shadow-'));
  try {
    // Same payload minus node_modules/openclaw, plus a root manifest beside the
    // payload: self-reference cannot reach it because the extension carries its
    // own manifest, which is the real shape of every bundled extension.
    const payload = await makePayload(root, {
      withRootPackage: false,
      extensionHasManifest: true,
    });
    await write(
      path.join(payload, 'package.json'),
      `${JSON.stringify({
        name: 'openclaw',
        type: 'module',
        exports: {
          './plugin-sdk/channel-entry-contract':
            './dist/plugin-sdk/channel-entry-contract.js',
        },
      }, null, 2)}\n`,
    );
    await assert.rejects(
      execFileAsync(
        process.execPath,
        [path.join(payload, 'dist/extensions/demo/index.js')],
        { encoding: 'utf8' },
      ),
      (error) =>
        /ERR_MODULE_NOT_FOUND/.test(`${error?.stderr ?? ''}`) &&
        /Cannot find package 'openclaw'/.test(`${error?.stderr ?? ''}`),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('package exports may not escape the package root, so an out-of-package target is rejected', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'rcv-resolution-escape-'));
  try {
    const payload = await makePayload(root, {
      withRootPackage: false,
      extensionHasManifest: true,
    });
    await write(
      path.join(payload, 'node_modules/openclaw/package.json'),
      `${JSON.stringify({
        name: 'openclaw',
        type: 'module',
        exports: {
          './plugin-sdk/channel-entry-contract':
            '../../dist/plugin-sdk/channel-entry-contract.js',
        },
      }, null, 2)}\n`,
    );
    await assert.rejects(
      execFileAsync(
        process.execPath,
        [path.join(payload, 'dist/extensions/demo/index.js')],
        { encoding: 'utf8' },
      ),
      (error) => /ERR_INVALID_PACKAGE_TARGET/.test(`${error?.stderr ?? ''}`),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('the artifact carries no symlink and no aliased file in either dist location', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'rcv-resolution-alias-'));
  try {
    const payload = await makePayload(root, {
      withRootPackage: true,
      extensionHasManifest: true,
    });
    const { lstat, readdir } = await import('node:fs/promises');
    const seen = [];
    const walk = async (directory) => {
      for (const entry of (await readdir(directory, { withFileTypes: true })).toSorted(
        (left, right) => left.name.localeCompare(right.name),
      )) {
        const child = path.join(directory, entry.name);
        const info = await lstat(child, { bigint: true });
        assert.equal(info.isSymbolicLink(), false, `symlink present: ${child}`);
        if (info.isDirectory()) {
          await walk(child);
          continue;
        }
        assert.equal(info.nlink, 1n, `hard-linked file present: ${child}`);
        seen.push(`${info.dev}:${info.ino}`);
      }
    };
    await walk(payload);
    assert.equal(
      new Set(seen).size,
      seen.length,
      'two payload files share an inode, so the tree is aliased',
    );
    // The two dist locations hold identical bytes as independent objects, which
    // is the bounded duplication the root-package export target requires.
    const { readFile } = await import('node:fs/promises');
    const [mounted, inPackage] = await Promise.all([
      readFile(path.join(payload, 'dist/plugin-sdk/channel-entry-contract.js'), 'utf8'),
      readFile(
        path.join(payload, 'node_modules/openclaw/dist/plugin-sdk/channel-entry-contract.js'),
        'utf8',
      ),
    ]);
    assert.equal(mounted, inPackage);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
