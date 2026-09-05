/**
 * catalog-root-contract.test.mjs — #495.
 *
 * The Project 86 matrix ran its catalog checks from `tools/k6-proofs`, where the
 * validators prepended `tools/k6-proofs` a second time and reported
 * `ENOENT ... /tools/k6-proofs/tools/k6-proofs/scenarios` as an empty catalog.
 * Those rows were then emitted as immediate product failures.
 *
 * These tests pin the repaired contract: every catalog validator resolves one
 * repository root and produces byte-identical output and exit status from the
 * repository root, from `tools/k6-proofs`, and from `tools/k6-proofs/scripts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const CHECKS = ['check-manifest-scenarios.mjs', 'check-scenario-alignment.mjs', 'check-proof-row-manifests.mjs', 'check-telemetry-contracts.mjs'];
const CATALOG_READERS = [...CHECKS, 'list-runnable-rows.mjs'];
const scriptPath = (name) => path.join(repoRoot, 'tools/k6-proofs/scripts', name);
const CORPUS_SHA = '0123456789abcdef0123456789abcdef01234567';

const WORKFLOW = `name: k6-proof
on:
  workflow_dispatch:
    inputs:
      scenario:
        description: "scenario basename"
        required: true
        type: choice
        options:
          - r-ok
`;

function manifest({ rowId = 'R-OK', file = 'r-ok.js' } = {}) {
  return {
    schema: 'openclaw.k6.proof-row-manifest.v1',
    rowId,
    scenario: { status: 'runnable', name: 'r-ok', file },
  };
}

async function fixtureRepo({ scenarios = ['r-ok.js'], manifests = [manifest()] } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'p81-catalog-root-'));
  const proofs = path.join(root, 'tools/k6-proofs');
  await mkdir(path.join(proofs, 'manifests'), { recursive: true });
  await mkdir(path.join(proofs, 'scenarios'), { recursive: true });
  await mkdir(path.join(proofs, 'scripts'), { recursive: true });
  await mkdir(path.join(proofs, 'qualification'), { recursive: true });
  await mkdir(path.join(root, '.github/workflows'), { recursive: true });
  await mkdir(path.join(root, 'PROOFS', CORPUS_SHA, 'R-OK'), { recursive: true });
  await writeFile(path.join(root, '.github/workflows/k6-proof.yml'), WORKFLOW);
  await writeFile(path.join(root, 'PROOFS/INDEX.json'), `${JSON.stringify({ current_sha: CORPUS_SHA })}\n`);
  for (const scenario of scenarios) {
    await writeFile(path.join(proofs, 'scenarios', scenario), 'export default function () {}\n');
  }
  for (const entry of manifests) {
    await writeFile(path.join(proofs, 'manifests', `${entry.rowId.toLowerCase()}.json`), `${JSON.stringify(entry, null, 2)}\n`);
  }
  await writeFile(
    path.join(proofs, 'qualification/producer-catalog.json'),
    `${JSON.stringify({
      schema: 'openclaw.k6.proof-producer-catalog.v2',
      requiredBehavioralRows: [],
      defaults: { 'k6-runnable': 'behavioral-live' },
      rows: { 'R-OK': { classification: 'behavioral-live', scenario: 'r-ok.js' } },
    }, null, 2)}\n`,
  );
  return { root, proofs };
}

function invoke(check, cwd, extraArgs = [], env = {}) {
  const result = spawnSync(process.execPath, [scriptPath(check), ...extraArgs], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, OPENCLAW_PROOFS_REPO_ROOT: '', ...env },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test('catalog readers produce identical results from every supported working directory', async () => {
  const fixture = await fixtureRepo();
  try {
    for (const check of CATALOG_READERS) {
      const fromRepoRoot = invoke(check, fixture.root);
      const fromToolDir = invoke(check, fixture.proofs);
      const fromScriptsDir = invoke(check, path.join(fixture.proofs, 'scripts'));

      assert.equal(fromRepoRoot.status, 0, `${check} must pass from the repository root: ${fromRepoRoot.stderr}`);
      assert.deepEqual(fromToolDir, fromRepoRoot, `${check} diverged when invoked from tools/k6-proofs`);
      assert.deepEqual(fromScriptsDir, fromRepoRoot, `${check} diverged when invoked from tools/k6-proofs/scripts`);
      assert.doesNotMatch(
        fromToolDir.stdout + fromToolDir.stderr,
        /tools\/k6-proofs\/tools\/k6-proofs/,
        `${check} still double-resolves the tool root`,
      );
    }
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('a genuine catalog defect fails identically from every supported working directory', async () => {
  // A runnable manifest whose scenario file does not exist is a real catalog
  // error; the doubled-prefix defect used to produce the same symptom for a
  // perfectly valid catalog.
  const fixture = await fixtureRepo({ manifests: [manifest({ file: 'r-missing.js' })] });
  try {
    for (const check of ['check-manifest-scenarios.mjs', 'check-scenario-alignment.mjs']) {
      const fromRepoRoot = invoke(check, fixture.root);
      const fromToolDir = invoke(check, fixture.proofs);
      assert.notEqual(fromRepoRoot.status, 0, `${check} must fail closed on a missing runnable scenario`);
      assert.deepEqual(fromToolDir, fromRepoRoot, `${check} diverged when invoked from tools/k6-proofs`);
      assert.match(fromRepoRoot.stdout + fromRepoRoot.stderr, /r-missing/);
    }
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('catalog validators count the same rows from every supported working directory', async () => {
  const fixture = await fixtureRepo();
  try {
    const alignment = JSON.parse(invoke('check-scenario-alignment.mjs', fixture.proofs).stdout);
    assert.equal(alignment.ok, true);
    assert.deepEqual(alignment.scenarioFiles, ['r-ok']);
    assert.deepEqual(alignment.workflowChoices, ['r-ok']);
    assert.equal(alignment.manifests.length, 1);

    const coverage = invoke('check-proof-row-manifests.mjs', fixture.proofs);
    assert.match(coverage.stdout, /Proof rows: 1/);
    assert.match(coverage.stdout, /Manifest entries: 1/);
    assert.match(coverage.stdout, /Missing manifests: 0/);

    const registry = invoke('check-manifest-scenarios.mjs', fixture.proofs);
    assert.match(registry.stdout, /1 manifests; 1 scenario files/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('an explicit repository root overrides the working directory for every validator', async () => {
  const fixture = await fixtureRepo();
  const elsewhere = await mkdtemp(path.join(tmpdir(), 'p81-catalog-root-elsewhere-'));
  try {
    for (const check of CATALOG_READERS) {
      const expected = invoke(check, fixture.root);
      assert.deepEqual(invoke(check, elsewhere, ['--repo-root', fixture.root]), expected, `${check} ignored --repo-root`);
      assert.deepEqual(
        invoke(check, elsewhere, [], { OPENCLAW_PROOFS_REPO_ROOT: fixture.root }),
        expected,
        `${check} ignored OPENCLAW_PROOFS_REPO_ROOT`,
      );
    }
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
    await rm(elsewhere, { recursive: true, force: true });
  }
});

test('validators fail closed with an explicit contract error outside any harness', async () => {
  const elsewhere = await mkdtemp(path.join(tmpdir(), 'p81-catalog-root-none-'));
  try {
    for (const check of CATALOG_READERS) {
      const result = invoke(check, elsewhere);
      assert.notEqual(result.status, 0, `${check} must not silently validate an unrelated catalog`);
      assert.match(result.stderr, /unable to resolve a repository root/);
      assert.match(result.stderr, /OPENCLAW_PROOFS_REPO_ROOT/);
    }
    const bogus = invoke('check-manifest-scenarios.mjs', elsewhere, ['--repo-root', elsewhere]);
    assert.notEqual(bogus.status, 0);
    assert.match(bogus.stderr, /--repo-root is not a repository root/);
  } finally {
    await rm(elsewhere, { recursive: true, force: true });
  }
});

test('an incidental tools/k6-proofs directory is not mistaken for a harness root', async (t) => {
  // A directory of the right name is not a proof catalog. Without a sentinel the
  // walk-up would bind to it and validate nothing.
  for (const [label, contents] of [
    ['no catalog directory at all', 'notes'],
    ['scenarios but no manifest catalog', 'scenarios'],
    ['manifests but no scenario catalog', 'manifests'],
  ]) {
    await t.test(label, async () => {
      const decoy = await mkdtemp(path.join(tmpdir(), 'p81-catalog-root-decoy-'));
      try {
        await mkdir(path.join(decoy, 'tools/k6-proofs', contents), { recursive: true });
        await mkdir(path.join(decoy, 'work'), { recursive: true });
        for (const check of CATALOG_READERS) {
          const result = invoke(check, path.join(decoy, 'work'));
          assert.notEqual(result.status, 0, `${check} bound to a directory with no proof catalog`);
          assert.match(result.stderr, /unable to resolve a repository root/);
        }
      } finally {
        await rm(decoy, { recursive: true, force: true });
      }
    });
  }
});
