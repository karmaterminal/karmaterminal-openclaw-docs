import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { checkProofRowManifests } from '../check-proof-row-manifests.mjs';

async function makeFixture(t, { extraDirectory } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'proof-row-manifests-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sha = 'a'.repeat(40);
  const corpusDir = path.join(root, 'PROOFS', sha);
  const manifestsDir = path.join(root, 'tools', 'k6-proofs', 'manifests');

  await Promise.all([
    mkdir(path.join(corpusDir, 'R-CD-4'), { recursive: true }),
    mkdir(path.join(corpusDir, 'artifacts'), { recursive: true }),
    mkdir(path.join(corpusDir, 'gates'), { recursive: true }),
    mkdir(path.join(corpusDir, '_scratch'), { recursive: true }),
    mkdir(manifestsDir, { recursive: true }),
  ]);
  if (extraDirectory) await mkdir(path.join(corpusDir, extraDirectory));

  await Promise.all([
    writeFile(path.join(root, 'PROOFS', 'INDEX.json'), JSON.stringify({ current_sha: sha })),
    writeFile(
      path.join(corpusDir, 'proofs-manifest.json'),
      JSON.stringify({ rows: [{ row: 'R-CD-4', dir: `PROOFS/${sha}/R-CD-4/` }] }),
    ),
    writeFile(path.join(manifestsDir, 'r-cd-4.json'), JSON.stringify({ rowId: 'R-CD-4' })),
  ]);
  return root;
}

test('manifest-declared rows ignore generated support directories', async (t) => {
  const root = await makeFixture(t);
  const result = checkProofRowManifests(root);

  assert.deepEqual(result.proofRows, ['R-CD-4']);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.undeclaredDirectories, []);
  assert.deepEqual(result.failures, []);
});

test('an undeclared row directory remains a hard failure', async (t) => {
  const root = await makeFixture(t, { extraDirectory: 'R-UNDECLARED' });
  const result = checkProofRowManifests(root);

  assert.deepEqual(result.undeclaredDirectories, ['R-UNDECLARED']);
  assert.deepEqual(result.failures, ['undeclared proof row directories: R-UNDECLARED']);
});
