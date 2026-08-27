import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRepoRoot = fileURLToPath(new URL('../../../..', import.meta.url));
const repoRoot = process.env.OPENCLAW_PROOFS_REPO_ROOT || defaultRepoRoot;
const historicalCorpusSha = '446f4b22d321cb7f5f26a4fbc2247f54da72d2a4';
const excludedRows = [
  'R-OBS-BACKEND-DISPOSITION',
  'R-OBS-CONT-PROVENANCE',
  'R-OBS-PROOF-MARKER',
  'R-OBS-TERMINAL-OUTCOME',
];
const expectedPartialRows = [
  'R-CD-2',
  'R-CD-CHAINED-DEPTH-2',
  'R-CD-TOKEN',
  'R-CW-6',
];
const expectedRollup = {
  total_rows: 37,
  pass: 32,
  partial: 4,
  thin: 0,
  fail: 0,
  honest_limit: 1,
  missing: 0,
};

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function listFiles(root) {
  const files = [];
  const pending = [root];
  while (pending.length > 0) {
    const directory = pending.pop();
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(directory, entry.name);
      assert.equal(entry.isSymbolicLink(), false, `unexpected symlink: ${path}`);
      if (entry.isDirectory()) pending.push(path);
      if (entry.isFile()) files.push(relative(root, path));
    }
  }
  return files.sort();
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

test('current corpus exposes only the 37 feature-acceptance rows', async () => {
  const index = await readJson(join(repoRoot, 'PROOFS/INDEX.json'));
  const manifest = await readJson(join(repoRoot, index.manifest_path));
  const corpusRoot = join(repoRoot, index.corpus_path);
  const readme = await readFile(join(repoRoot, index.readme_path), 'utf8');
  const clawsweeper = await readFile(join(repoRoot, index.clawsweeper_path), 'utf8');
  const rowIds = manifest.rows.map((row) => row.row);
  const stateRows = (state) => manifest.rows
    .filter((row) => row.state === state)
    .map((row) => row.row)
    .sort();

  assert.equal(manifest.capture_sha, index.current_sha);
  assert.equal(manifest.required_rows.length, 37);
  assert.equal(manifest.rows.length, 37);
  assert.deepEqual([...manifest.required_rows].sort(), [...rowIds].sort());
  assert.deepEqual(
    [...readme.matchAll(/^\| (R-[^ |]+) \|/gm)].map((match) => match[1]).sort(),
    [...rowIds].sort(),
  );
  assert.deepEqual(manifest.rollup, expectedRollup);
  assert.deepEqual(index.rollup, expectedRollup);
  assert.deepEqual(stateRows('partial'), expectedPartialRows);
  assert.deepEqual(stateRows('honest_limit'), ['R-RC-2']);
  assert.deepEqual(stateRows('fail'), []);
  assert.deepEqual(stateRows('missing'), []);

  const activeSurfaces = [
    ['manifest', JSON.stringify(manifest)],
    ['README', readme],
    ['ClawSweeper guidance', clawsweeper],
    ['INDEX disposition', index.disposition_note],
  ];
  if (manifest.dispatch_allocation !== undefined) {
    activeSurfaces.push(['dispatch allocation', JSON.stringify(manifest.dispatch_allocation)]);
  }

  for (const rowId of excludedRows) {
    for (const [surface, content] of activeSurfaces) {
      assert.doesNotMatch(content, new RegExp(rowId), `${rowId} remains in ${surface}`);
    }
    await assert.rejects(
      access(join(corpusRoot, rowId)),
      (error) => error?.code === 'ENOENT',
      `${rowId} must not have a directory in the current corpus`,
    );
    await access(join(repoRoot, 'PROOFS', historicalCorpusSha, rowId, 'EVIDENCE.md'));
  }

  for (const row of manifest.rows) {
    assert.equal(row.exact_target_execution, false, `${row.row} exact_target_execution`);
    assert.equal(row.exact_target_mode_b, false, `${row.row} exact_target_mode_b`);
    assert.match(row.dir, new RegExp(`^PROOFS/${index.current_sha}/`));
    assert.match(row.evidence_doc, new RegExp(`^PROOFS/${index.current_sha}/`));
  }
  assert.equal(manifest.exact_target_execution, false);
  assert.equal(manifest.exact_target_mode_b, false);
  assert.equal(manifest.target_mode_b.exact_target_mode_b, false);
  assert.match(readme, /not acceptance-complete/i);
  assert.match(clawsweeper, /not acceptance-complete/i);
});

test('target retains every source byte except explicit rows and metadata glue', async () => {
  const index = await readJson(join(repoRoot, 'PROOFS/INDEX.json'));
  const sourceRoot = join(repoRoot, 'PROOFS', historicalCorpusSha);
  const targetRoot = join(repoRoot, 'PROOFS', index.current_sha);
  const sourceFiles = await listFiles(sourceRoot);
  const targetFiles = await listFiles(targetRoot);
  const sourceSet = new Set(sourceFiles);
  const targetSet = new Set(targetFiles);
  const sourceOnly = sourceFiles.filter((path) => !targetSet.has(path));
  const targetOnly = targetFiles.filter((path) => !sourceSet.has(path));
  const expectedSourceOnly = excludedRows.map((row) => `${row}/EVIDENCE.md`).sort();
  const metadataGlue = new Set([
    'ARTIFACTS.md',
    'CLAWSSWEEPER.md',
    'METHOD.md',
    'README.md',
    'RESOLVED-SHA.md',
    'TRANSPOSED-FROM.md',
    'proofs-manifest.json',
  ]);

  assert.equal(sourceFiles.length, 403);
  assert.equal(targetFiles.length, 399);
  assert.deepEqual(sourceOnly, expectedSourceOnly);
  assert.deepEqual(targetOnly, []);

  let identicalFiles = 0;
  for (const path of targetFiles) {
    if (metadataGlue.has(path)) continue;
    assert.equal(
      await sha256(join(targetRoot, path)),
      await sha256(join(sourceRoot, path)),
      `${path} changed outside the target-facing metadata/glue allowlist`,
    );
    identicalFiles += 1;
  }
  assert.equal(identicalFiles, 392);

  const sourceManifest = await readJson(join(sourceRoot, 'proofs-manifest.json'));
  const targetManifest = await readJson(join(targetRoot, 'proofs-manifest.json'));
  const sourceRows = new Map(sourceManifest.rows.map((row) => [row.row, row]));
  const preservedRowKeys = [
    'title',
    'owner',
    'state',
    'manifest',
    'scenario_status',
    'live_run_classification',
    'candidate_verdict',
    'review_status',
    'pending_receipts',
    'fired',
    'issue',
    'summary',
    'test_cases_executed',
  ];
  const preservedModeBKeys = [
    'exact_source_mode_b',
    'run',
    'product_sha',
    'workflow_sha',
    'conclusion',
    'passed_tests',
    'failed_counts',
    'deterministic_failures',
    'load_flakes_greened',
    'candidate_caused_failures',
  ];

  assert.equal(targetManifest.execution_runtime_sha, sourceManifest.execution_runtime_sha);
  assert.equal(targetManifest.harness_sha, sourceManifest.harness_sha);
  assert.deepEqual(targetManifest.transposition.previous, sourceManifest.transposition);
  assert.deepEqual(targetManifest.execution.previous, sourceManifest.execution);
  assert.deepEqual(
    targetManifest.execution_runtime_provenance.previous,
    sourceManifest.execution_runtime_provenance,
  );
  assert.deepEqual(targetManifest.target_mode_b.previous, sourceManifest.target_mode_b);
  assert.deepEqual(
    Object.fromEntries(preservedModeBKeys.map((key) => [key, targetManifest.source_mode_b[key]])),
    Object.fromEntries(preservedModeBKeys.map((key) => [key, sourceManifest.source_mode_b[key]])),
  );

  for (const targetRow of targetManifest.rows) {
    const sourceRow = sourceRows.get(targetRow.row);
    assert.ok(sourceRow, `missing source row: ${targetRow.row}`);
    assert.deepEqual(
      Object.fromEntries(preservedRowKeys.map((key) => [key, targetRow[key]])),
      Object.fromEntries(preservedRowKeys.map((key) => [key, sourceRow[key]])),
      `${targetRow.row} changed a preserved row field`,
    );
    assert.deepEqual(
      targetRow.transposition.previous,
      sourceRow.transposition,
      `${targetRow.row} lost immediate-source transposition history`,
    );
  }
});
