import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const script = join(repoRoot, 'tools/k6-proofs/scripts/check-proof-row-manifests.mjs');
const SHA = '0123456789abcdef0123456789abcdef01234567';

async function withFixture({ rows = ['R-OK'], manifests = [{ file: 'r-ok.json', rowId: 'R-OK' }] }, fn) {
  const root = await mkdtemp(join(tmpdir(), 'p81-proof-row-manifests-'));
  try {
    const corpus = join(root, 'PROOFS', SHA);
    const manifestsDir = join(root, 'tools/k6-proofs/manifests');
    await mkdir(corpus, { recursive: true });
    await mkdir(manifestsDir, { recursive: true });
    // Both catalog directories define a harness root (see lib/repo-root.mjs).
    await mkdir(join(root, 'tools/k6-proofs/scenarios'), { recursive: true });
    await writeFile(join(root, 'PROOFS/INDEX.json'), `${JSON.stringify({ current_sha: SHA })}\n`);
    for (const row of rows) await mkdir(join(corpus, row), { recursive: true });
    for (const manifest of manifests) {
      const content = manifest.raw ?? `${JSON.stringify({ rowId: manifest.rowId })}\n`;
      await writeFile(join(manifestsDir, manifest.file), content);
    }
    return await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function run(root) {
  return spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
}

test('ignores proof-corpus support directories while checking real rows', async () => {
  await withFixture({ rows: ['R-OK', '_execution-control', 'artifacts', 'gates'] }, async (root) => {
    const result = run(root);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Proof rows: 1/);
    assert.match(result.stdout, /Missing manifests: 0/);
  });
});

test('fails closed for missing, invalid, and duplicate manifests', async (t) => {
  await t.test('missing manifest', async () => {
    await withFixture({ rows: ['R-MISSING'], manifests: [] }, async (root) => {
      const result = run(root);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /proof rows missing manifest entries: R-MISSING/);
    });
  });

  await t.test('invalid manifest JSON', async () => {
    await withFixture({ manifests: [{ file: 'r-ok.json', raw: '{not json}\n' }] }, async (root) => {
      const result = run(root);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /SyntaxError/);
    });
  });

  await t.test('duplicate row ID', async () => {
    await withFixture({ manifests: [
      { file: 'r-ok-a.json', rowId: 'R-OK' },
      { file: 'r-ok-b.json', rowId: 'r-ok' },
    ] }, async (root) => {
      const result = run(root);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /duplicate manifest row IDs: R-OK/);
    });
  });

  await t.test('case-mismatched row ID', async () => {
    await withFixture({ rows: ['R-CONFIG-DEFAULTS'], manifests: [
      { file: 'r-config-defaults.json', rowId: 'R-CONFIG-defaults' },
    ] }, async (root) => {
      const result = run(root);
      assert.notEqual(result.status, 0);
      assert.match(
        result.stderr,
        /proof row\/manifest ID case mismatches: R-CONFIG-DEFAULTS != R-CONFIG-defaults/,
      );
    });
  });
});
