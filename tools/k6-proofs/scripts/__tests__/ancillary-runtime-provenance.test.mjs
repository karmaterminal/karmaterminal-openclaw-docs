import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  readAncillaryRuntimeContract,
  validateAncillaryRuntimeProvenance,
} from '../../lib/ancillary-runtime-provenance.mjs';
import { resolveRepositoryFile } from '../../lib/repo-root.mjs';

const git = (root, args) =>
  execFileSync('/usr/bin/git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
const hash = (value) => createHash('sha256').update(value).digest('hex');
const harnessRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const validator = path.join(harnessRoot, 'tools/k6-proofs/scripts/validate-ancillary-runtime-provenance.mjs');
const contractRelative = 'tools/k6-proofs/contracts/ancillary-runtime/test-contract.json';

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

async function buildHarness(contract) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ancillary-contract-root-'));
  const proofs = path.join(root, 'tools/k6-proofs');
  const contractPath = path.join(root, contractRelative);
  await mkdir(path.join(proofs, 'manifests'), { recursive: true });
  await mkdir(path.join(proofs, 'scenarios'), { recursive: true });
  await mkdir(path.dirname(contractPath), { recursive: true });
  await mkdir(path.join(proofs, 'scripts/nested'), { recursive: true });
  await writeFile(contractPath, `${JSON.stringify(contract, null, 2)}\n`);
  return { root, proofs, contractPath };
}

function invokeValidator({ cwd, docsRoot, runtime, contract = contractRelative, out }) {
  return spawnSync(process.execPath, [
    validator,
    '--repo-root', docsRoot,
    '--contract', contract,
    '--source-dir', runtime.root,
    '--row', 'R-CD-TOKEN',
    '--candidate-sha', runtime.contract.canonicalSha,
    '--runtime-sha', runtime.contract.runtimeSha,
    '--out', out,
  ], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, OPENCLAW_PROOFS_REPO_ROOT: '' },
  });
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

test('rejected-base cwd lookup reproduces ENOENT while repository-root resolution is identical', async () => {
  const runtime = await buildRepository();
  const docs = await buildHarness(runtime.contract);
  try {
    assert.throws(
      () => readAncillaryRuntimeContract(path.resolve(docs.proofs, contractRelative)),
      /ENOENT/,
    );

    const workingDirectories = [
      docs.root,
      docs.proofs,
      path.join(docs.proofs, 'scripts/nested'),
    ];
    const receipts = [];
    for (const [index, cwd] of workingDirectories.entries()) {
      const out = path.join(docs.root, `receipt-${index}.json`);
      const result = invokeValidator({ cwd, docsRoot: docs.root, runtime, out });
      assert.equal(result.status, 0, result.stderr);
      receipts.push(JSON.parse(await readFile(out, 'utf8')));
    }
    assert.deepEqual(receipts[1], receipts[0]);
    assert.deepEqual(receipts[2], receipts[0]);
    assert.equal(receipts[0].contractSha256, hash(`${JSON.stringify(runtime.contract)}\n`));
  } finally {
    await rm(docs.root, { recursive: true, force: true });
    await rm(runtime.root, { recursive: true, force: true });
  }
});

test('repository contract resolver rejects escape, symlink, missing, nonregular, and cwd ambiguity', async () => {
  const runtime = await buildRepository();
  const docs = await buildHarness(runtime.contract);
  const outside = path.join(path.dirname(docs.root), `${path.basename(docs.root)}-outside.json`);
  const linked = path.join(path.dirname(docs.contractPath), 'linked.json');
  const nested = path.join(docs.proofs, 'scripts/nested');
  try {
    await writeFile(outside, '{}\n');
    await symlink(docs.contractPath, linked);
    await mkdir(path.join(docs.root, 'directory-contract'));

    assert.throws(
      () => resolveRepositoryFile(docs.root, `../${path.basename(outside)}`),
      /escapes repository root/,
    );
    assert.throws(
      () => resolveRepositoryFile(docs.root, path.relative(docs.root, linked)),
      /symbolic link/,
    );
    assert.throws(
      () => resolveRepositoryFile(docs.root, 'tools/k6-proofs/contracts/missing.json'),
      /does not exist/,
    );
    assert.throws(
      () => resolveRepositoryFile(docs.root, 'directory-contract'),
      /regular file/,
    );
    assert.equal(
      resolveRepositoryFile(docs.root, docs.contractPath),
      docs.contractPath,
    );
    assert.throws(
      () => resolveRepositoryFile(docs.root, outside),
      /escapes repository root/,
    );

    const shadow = path.resolve(nested, contractRelative);
    await mkdir(path.dirname(shadow), { recursive: true });
    await writeFile(shadow, '{}\n');
    assert.throws(
      () => resolveRepositoryFile(docs.root, contractRelative, { cwd: nested }),
      /ambiguous relative to the caller working directory/,
    );
  } finally {
    await rm(outside, { force: true });
    await rm(docs.root, { recursive: true, force: true });
    await rm(runtime.root, { recursive: true, force: true });
  }
});
