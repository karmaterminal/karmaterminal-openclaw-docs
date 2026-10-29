import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { resolveCandidateNodeBin } from '../lib/candidate-executables.mjs';
import {
  PNPM_12_SHIMS,
  modeledCandidateNodeModules,
  modeledToolEntry,
} from './helpers/candidate-node-modules-fixture.mjs';

test('a pnpm 12 cmd-shim resolves to the entry its package declares', async () => {
  const worktree = await modeledCandidateNodeModules({ layout: 'pnpm12' });
  assert.deepEqual(resolveCandidateNodeBin(worktree, 'tsx'), {
    binName: 'tsx',
    packageName: 'tsx',
    packageVersion: '4.23.15',
    entry: 'dist/cli.mjs',
    binLink: 'cmd-shim',
    script: await realpath(modeledToolEntry(worktree, 'tsx')),
  });
  const vitest = resolveCandidateNodeBin(worktree, 'vitest');
  assert.equal(vitest.entry, 'vitest.mjs');
  assert.equal(vitest.binLink, 'cmd-shim');
  assert.equal(vitest.script, await realpath(modeledToolEntry(worktree, 'vitest')));
});

test('a pnpm 11 symlink resolves to the same entry', async () => {
  const worktree = await modeledCandidateNodeModules({ layout: 'pnpm11' });
  const tsx = resolveCandidateNodeBin(worktree, 'tsx');
  assert.equal(tsx.binLink, 'symlink');
  assert.equal(tsx.script, await realpath(modeledToolEntry(worktree, 'tsx')));
});

test('an absolute cmd-shim target, as pnpm 12.3 wrote it, is accepted', async () => {
  const worktree = await modeledCandidateNodeModules({ layout: 'pnpm12', tools: ['tsx'] });
  const absolute = path.join(worktree, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const shim = PNPM_12_SHIMS.tsx.toString('utf8').replace(
    /^# cmd-shim-target=.*$/mu,
    `# cmd-shim-target=${absolute}`,
  );
  await writeFile(path.join(worktree, 'node_modules', '.bin', 'tsx'), shim);
  assert.equal(resolveCandidateNodeBin(worktree, 'tsx').binLink, 'cmd-shim');
});

test('a missing .bin link is refused', async () => {
  const worktree = await modeledCandidateNodeModules({ layout: 'pnpm12', tools: ['tsx'] });
  await rm(path.join(worktree, 'node_modules', '.bin', 'tsx'));
  assert.throws(
    () => resolveCandidateNodeBin(worktree, 'tsx'),
    /candidate-local tsx executable is missing after frozen install/,
  );
});

test('a .bin link that leaves node_modules is refused', async () => {
  const worktree = await modeledCandidateNodeModules({ layout: 'pnpm12', tools: ['tsx'] });
  const outside = await mkdtemp(path.join(os.tmpdir(), 'candidate-bin-outside-'));
  await writeFile(path.join(outside, 'tsx'), '#!/usr/bin/env node\n');
  await rm(path.join(worktree, 'node_modules', '.bin', 'tsx'));
  await symlink(path.join(outside, 'tsx'), path.join(worktree, 'node_modules', '.bin', 'tsx'));
  assert.throws(
    () => resolveCandidateNodeBin(worktree, 'tsx'),
    /candidate-local tsx executable resolves outside disposable node_modules/,
  );
});

test('a dependency link that leaves node_modules is refused', async () => {
  const worktree = await modeledCandidateNodeModules({ layout: 'pnpm12', tools: ['tsx'] });
  const outside = await mkdtemp(path.join(os.tmpdir(), 'candidate-package-outside-'));
  await mkdir(path.join(outside, 'dist'));
  await writeFile(path.join(outside, 'package.json'), '{"name":"tsx","bin":"./dist/cli.mjs"}\n');
  await writeFile(path.join(outside, 'dist', 'cli.mjs'), '#!/usr/bin/env node\n');
  await rm(path.join(worktree, 'node_modules', 'tsx'));
  await symlink(outside, path.join(worktree, 'node_modules', 'tsx'));
  assert.throws(
    () => resolveCandidateNodeBin(worktree, 'tsx'),
    /candidate-local tsx package tsx resolves outside disposable node_modules/,
  );
});

test('a package that declares no such bin is refused', async () => {
  const worktree = await modeledCandidateNodeModules({
    layout: 'pnpm12',
    tools: ['vitest'],
    overrides: { vitest: { bin: { 'vitest-other': './vitest.mjs' } } },
  });
  assert.throws(() => resolveCandidateNodeBin(worktree, 'vitest'), /package vitest declares no vitest bin/);
});

test('a declared bin entry outside its package is refused', async () => {
  const worktree = await modeledCandidateNodeModules({
    layout: 'pnpm12',
    tools: ['tsx'],
    overrides: { tsx: { bin: '../../../../tsx/dist/cli.mjs' } },
  });
  assert.throws(() => resolveCandidateNodeBin(worktree, 'tsx'), /candidate-local tsx bin entry escapes package tsx/);
});

test('a declared bin entry that is not a Node script is refused', async () => {
  const worktree = await modeledCandidateNodeModules({
    layout: 'pnpm12',
    tools: ['tsx'],
    overrides: { tsx: { entrySource: '#!/usr/bin/env python3\nprint("tsx")\n' } },
  });
  assert.throws(
    () => resolveCandidateNodeBin(worktree, 'tsx'),
    /candidate-local tsx bin entry requires an unsupported interpreter: #!\/usr\/bin\/env python3/,
  );
});

test('a .bin file that is neither a symlink nor a cmd-shim is refused', async () => {
  const worktree = await modeledCandidateNodeModules({
    layout: 'pnpm12',
    tools: ['tsx'],
    overrides: { tsx: { shim: '#!/bin/sh\nexec node "$(dirname "$0")/../tsx/dist/cli.mjs" "$@"\n' } },
  });
  assert.throws(
    () => resolveCandidateNodeBin(worktree, 'tsx'),
    /candidate-local tsx \.bin entry is neither a symlink nor a cmd-shim naming one target/,
  );
});

test('a pnpm 11 symlink to another file in the package is refused', async () => {
  const worktree = await modeledCandidateNodeModules({ layout: 'pnpm11', tools: ['tsx'] });
  const packageDir = path.dirname(path.dirname(modeledToolEntry(worktree, 'tsx')));
  await writeFile(path.join(packageDir, 'dist', 'other.mjs'), '#!/usr/bin/env node\n');
  await rm(path.join(worktree, 'node_modules', '.bin', 'tsx'));
  await symlink('../tsx/dist/other.mjs', path.join(worktree, 'node_modules', '.bin', 'tsx'));
  assert.throws(
    () => resolveCandidateNodeBin(worktree, 'tsx'),
    /candidate-local tsx \.bin link does not resolve to the bin entry its package declares/,
  );
});
