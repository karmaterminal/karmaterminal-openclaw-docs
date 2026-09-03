import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  readAncillaryRuntimeContract,
  validateAncillaryRuntimeProvenance,
} from '../../lib/ancillary-runtime-provenance.mjs';

const git = (root, args) =>
  execFileSync('/usr/bin/git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
const hash = (value) => createHash('sha256').update(value).digest('hex');

async function buildRepository() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ancillary-runtime-'));
  git(root, ['init', '--quiet']);
  git(root, ['config', 'user.name', 'Runtime Contract']);
  git(root, ['config', 'user.email', 'runtime@example.invalid']);
  await mkdir(path.join(root, 'src/owner'), { recursive: true });
  await writeFile(path.join(root, 'src/owner/token.ts'), 'export const owner = true;\n');
  git(root, ['add', '.']);
  git(root, ['commit', '--quiet', '-m', 'pure']);
  const canonicalSha = git(root, ['rev-parse', 'HEAD']);
  const canonicalTree = git(root, ['rev-parse', 'HEAD^{tree}']);

  const paths = Array.from({ length: 22 }, (_, index) => `components/path-${index}.txt`);
  for (const relative of paths.slice(0, 11)) {
    await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
    await writeFile(path.join(root, relative), `${relative}\n`);
  }
  git(root, ['add', '.']);
  git(root, ['commit', '--quiet', '-m', 'component one']);
  const first = git(root, ['rev-parse', 'HEAD']);
  const firstTree = git(root, ['rev-parse', 'HEAD^{tree}']);
  const firstPatch = `${git(root, ['diff', `${first}^`, first, '--'])}\n`;

  for (const relative of paths.slice(11)) {
    await writeFile(path.join(root, relative), `${relative}\n`);
  }
  git(root, ['add', '.']);
  git(root, ['commit', '--quiet', '-m', 'component two']);
  const runtimeSha = git(root, ['rev-parse', 'HEAD']);
  const runtimeTree = git(root, ['rev-parse', 'HEAD^{tree}']);
  const secondPatch = `${git(root, ['diff', `${runtimeSha}^`, runtimeSha, '--'])}\n`;

  return {
    root,
    contract: {
      schema: 'openclaw.k6.ancillary-runtime-contract.v1',
      row: 'R-CD-TOKEN',
      canonicalSha,
      canonicalTree,
      runtimeSha,
      runtimeTree,
      commits: [
        {
          sha: first,
          parent: canonicalSha,
          tree: firstTree,
          component: 'one',
          patchSha256: hash(firstPatch),
        },
        {
          sha: runtimeSha,
          parent: first,
          tree: runtimeTree,
          component: 'two',
          patchSha256: hash(secondPatch),
        },
      ],
      changedPaths: paths,
      materiality: {
        classification: 'ancillary-runtime-only',
        canonicalIdentityRemainsPure: true,
        allowedRows: ['R-CD-TOKEN'],
        rowOwnerPaths: ['src/owner/token.ts'],
      },
    },
  };
}

test('strict ancillary runtime provenance accepts only the reviewed two-commit union', async () => {
  const { root, contract } = await buildRepository();
  const receipt = validateAncillaryRuntimeProvenance({
    contract,
    row: 'R-CD-TOKEN',
    canonicalSha: contract.canonicalSha,
    runtimeSha: contract.runtimeSha,
    sourceDir: root,
  });
  assert.equal(receipt.valid, true);
  assert.equal(receipt.changedPathCount, 22);
  assert.equal(receipt.ownerPathsUnchanged, true);
  assert.equal(receipt.canonicalIdentityRemainsPure, true);
});

test('ancillary runtime provenance rejects arbitrary descendants and tampered owner bytes', async () => {
  const { root, contract } = await buildRepository();
  await writeFile(path.join(root, 'unreviewed.txt'), 'unreviewed\n');
  git(root, ['add', '.']);
  git(root, ['commit', '--quiet', '-m', 'unreviewed']);
  const unreviewed = git(root, ['rev-parse', 'HEAD']);
  assert.throws(
    () => validateAncillaryRuntimeProvenance({
      contract,
      row: 'R-CD-TOKEN',
      canonicalSha: contract.canonicalSha,
      runtimeSha: unreviewed,
      sourceDir: root,
    }),
    /shape or row materiality|runtimeSha|contract/,
  );

  const tampered = structuredClone(contract);
  tampered.commits[1].patchSha256 = '0'.repeat(64);
  assert.throws(
    () => validateAncillaryRuntimeProvenance({
      contract: tampered,
      row: 'R-CD-TOKEN',
      canonicalSha: tampered.canonicalSha,
      runtimeSha: tampered.runtimeSha,
      sourceDir: root,
    }),
    /differs from reviewed bytes/,
  );
});

test('committed 129388 contract keeps pure identity and exact reviewed runtime', async () => {
  const contract = readAncillaryRuntimeContract(
    new URL('../../contracts/ancillary-runtime/129388-pure5035-dbf5795.json', import.meta.url),
  );
  assert.equal(contract.canonicalSha, '5035aac3a96df18f0a5d5a5c3e91a516a32daf32');
  assert.equal(contract.runtimeSha, 'dbf5795bd5dd406f586575d883a7878288e591ad');
  assert.equal(contract.changedPaths.length, 22);
  assert.deepEqual(contract.materiality.allowedRows, ['R-CD-TOKEN']);
});
