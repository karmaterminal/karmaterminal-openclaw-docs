import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { assertPnpmDependencyProvenance } from '../fixture-dependency-provenance.mjs';

async function fixture({
  candidateLock = 'lockfileVersion: 9.0\n',
  installedLock = candidateLock,
  packageManager = 'pnpm@11.2.2',
} = {}) {
  const source = await mkdtemp(path.join(os.tmpdir(), 'proof-dependency-provenance-'));
  await mkdir(path.join(source, 'node_modules', '.pnpm'), { recursive: true });
  await mkdir(path.join(source, 'node_modules', '.bin'), { recursive: true });
  await writeFile(path.join(source, 'package.json'), JSON.stringify({ name: 'fixture', packageManager }));
  await writeFile(path.join(source, 'pnpm-lock.yaml'), candidateLock);
  await writeFile(path.join(source, 'node_modules', '.pnpm', 'lock.yaml'), installedLock);
  await writeFile(
    path.join(source, 'node_modules', '.modules.yaml'),
    JSON.stringify({ layoutVersion: 5, virtualStoreDir: '.pnpm' }),
  );
  await writeFile(path.join(source, 'node_modules', '.bin', 'tsx'), '#!/bin/sh\n');
  await writeFile(path.join(source, 'node_modules', '.bin', 'vitest'), '#!/bin/sh\n');
  return source;
}

test('accepts a pinned pnpm tree whose installed lock matches the candidate lock', async () => {
  const source = await fixture();
  const receipt = assertPnpmDependencyProvenance(source, { requiredExecutables: ['tsx', 'vitest'] });
  assert.equal(receipt.lockfileMatchesCandidate, true);
  assert.equal(receipt.candidateLockfileSha256, receipt.installedLockfileSha256);
  assert.equal(receipt.packageManager, 'pnpm@11.2.2');
  assert.deepEqual(receipt.requiredExecutables, ['tsx', 'vitest']);
});

test('rejects a stale or unrelated installed virtual-store lockfile', async () => {
  const source = await fixture({ installedLock: 'lockfileVersion: 8.0\n' });
  assert.throws(
    () => assertPnpmDependencyProvenance(source, { requiredExecutables: ['tsx', 'vitest'] }),
    /installed dependency lockfile does not match/,
  );
});

test('rejects an unpinned package manager or missing local executable', async () => {
  const unpinned = await fixture({ packageManager: '' });
  assert.throws(() => assertPnpmDependencyProvenance(unpinned), /pin pnpm via packageManager/);

  const missing = await fixture();
  assert.throws(
    () => assertPnpmDependencyProvenance(missing, { requiredExecutables: ['missing-runner'] }),
    /missing node_modules\/.bin\/missing-runner/,
  );
});

test('rejects a local executable that resolves outside node_modules', async () => {
  const source = await fixture();
  const outside = path.join(source, 'outside-runner');
  await writeFile(outside, '#!/bin/sh\n');
  await symlink(outside, path.join(source, 'node_modules', '.bin', 'outside'));
  assert.throws(
    () => assertPnpmDependencyProvenance(source, { requiredExecutables: ['outside'] }),
    /resolves outside the verified dependency tree/,
  );
});
