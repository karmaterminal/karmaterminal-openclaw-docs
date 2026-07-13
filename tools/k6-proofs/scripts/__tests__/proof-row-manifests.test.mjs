import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const script = join(repoRoot, 'tools/k6-proofs/scripts/check-proof-row-manifests.mjs');

async function createCorpusFixture() {
  const root = await mkdtemp(join(tmpdir(), 'openclaw-proof-row-manifests-'));
  const sha = 'a'.repeat(40);
  const corpus = join(root, 'PROOFS', sha);
  const manifests = join(root, 'tools', 'k6-proofs', 'manifests');
  await mkdir(join(corpus, 'R-GOOD'), { recursive: true });
  await mkdir(join(corpus, 'artifacts'), { recursive: true });
  await mkdir(join(corpus, 'gates'), { recursive: true });
  await mkdir(manifests, { recursive: true });
  await writeFile(join(root, 'PROOFS', 'INDEX.json'), `${JSON.stringify({ current_sha: sha })}\n`);
  return { root, manifests };
}

function runChecker(root) {
  return spawnSync(process.execPath, [script, '--root', root], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

test('proof-row manifest checker ignores corpus artifact directories', async () => {
  const fixture = await createCorpusFixture();
  try {
    await writeFile(join(fixture.manifests, 'r-good.json'), `${JSON.stringify({ rowId: 'R-GOOD' })}\n`);
    const run = runChecker(fixture.root);
    assert.equal(run.status, 0, run.stderr || run.stdout);
    assert.match(run.stdout, /Proof rows: 1/);
    assert.match(run.stdout, /Missing manifests: 0/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('proof-row manifest checker fails closed for malformed and duplicate manifests', async () => {
  const fixture = await createCorpusFixture();
  try {
    await writeFile(join(fixture.manifests, 'r-good.json'), '{ not json }\n');
    let run = runChecker(fixture.root);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /invalid manifest JSON: r-good\.json/);

    await writeFile(join(fixture.manifests, 'r-good.json'), `${JSON.stringify({ rowId: 'R-GOOD' })}\n`);
    await writeFile(join(fixture.manifests, 'r-good-copy.json'), `${JSON.stringify({ rowId: 'R-GOOD' })}\n`);
    run = runChecker(fixture.root);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /duplicate manifest row IDs: R-GOOD/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});
