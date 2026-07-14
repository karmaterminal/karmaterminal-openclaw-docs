import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const listScript = join(repoRoot, 'tools/k6-proofs/scripts/list-runnable-rows.mjs');
const docs = [
  'RUNBOOKS/project-81/README.md',
  'RUNBOOKS/project-81/EXECUTABLE-SUITE.md',
];

function runnableCatalog() {
  const result = spawnSync(process.execPath, [listScript, '--live-suite'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function documentedCatalog(markdown) {
  const codeBlocks = [...markdown.matchAll(/```text\n([\s\S]*?)\n```/g)]
    .map((match) => match[1].trim());
  return codeBlocks.find((block) => block.includes('R-CD-1'));
}

test('Project 81 runbooks publish the exact live-suite catalog', async () => {
  const actual = runnableCatalog();
  for (const relativePath of docs) {
    const markdown = await readFile(join(repoRoot, relativePath), 'utf8');
    const documented = documentedCatalog(markdown);
    assert.ok(documented, `${relativePath} lacks a live-suite catalog code block`);
    assert.equal(documented, actual, `${relativePath} catalog drifted from --live-suite`);
  }
});
