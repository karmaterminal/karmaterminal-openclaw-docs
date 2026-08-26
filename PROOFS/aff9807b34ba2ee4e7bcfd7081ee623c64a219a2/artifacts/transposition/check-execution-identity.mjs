#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const HISTORICAL_SOURCE = '80311e8aa07fd560cb957475517c5ea18164541c';
const HISTORICAL_EXECUTION = '37300f29a7ec1f731575343c2aa73ae25f1d0efb';
const EXACT_RUNTIME = 'a0aa4ec8aefe95ced34342978b64c270c16ec3e9';

function parseCorpus(argv) {
  const index = argv.indexOf('--corpus');
  if (index < 0 || !argv[index + 1]) {
    throw new Error('usage: check-execution-identity.mjs --corpus <PROOFS/sha>');
  }
  return path.resolve(argv[index + 1]);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const corpus = parseCorpus(process.argv.slice(2));
const target = path.basename(corpus);
const violations = [];
const counts = {
  fixtureFiles: 0,
  fixtureTranspositions: 0,
  operationalIdentityFields: 0,
};

function expect(file, field, actual, expected) {
  if (actual !== expected) {
    violations.push({
      file: path.relative(corpus, file).split(path.sep).join('/'),
      field,
      expected,
      actual,
    });
  }
}

function inspectFixtureValue(file, value, field = '') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => inspectFixtureValue(file, entry, `${field}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const [key, child] of Object.entries(value)) {
    const childField = field ? `${field}.${key}` : key;
    const isOperationalIdentity =
      key === 'candidateSha' ||
      key === 'candidateWorktreeHead' ||
      (key === 'head' && childField.includes('executionWorktreeIntegrity'));
    if (isOperationalIdentity) {
      counts.operationalIdentityFields += 1;
      expect(file, childField, child, HISTORICAL_SOURCE);
    }
    if (key === 'transposition') {
      counts.fixtureTranspositions += 1;
      expect(file, `${childField}.source_corpus_sha`, child?.source_corpus_sha, HISTORICAL_SOURCE);
      expect(file, `${childField}.target_corpus_sha`, child?.target_corpus_sha, target);
      expect(file, `${childField}.exact_target_execution`, child?.exact_target_execution, false);
    }
    inspectFixtureValue(file, child, childField);
  }
}

for (const row of ['R-CW-5', 'R-CW-6']) {
  const fixtureDir = path.join(corpus, row, 'fixture');
  for (const name of fs.readdirSync(fixtureDir).filter((entry) => entry.endsWith('.json')).sort()) {
    const file = path.join(fixtureDir, name);
    counts.fixtureFiles += 1;
    inspectFixtureValue(file, readJson(file));
  }
}

const liveFile = path.join(corpus, 'artifacts/live/LIVE-PROOF.public.json');
const live = readJson(liveFile);
expect(liveFile, 'execution_sha', live.execution_sha, HISTORICAL_EXECUTION);
expect(liveFile, 'pure_sha', live.pure_sha, HISTORICAL_SOURCE);
expect(liveFile, 'transposition.source_corpus_sha', live.transposition?.source_corpus_sha, HISTORICAL_SOURCE);
expect(liveFile, 'transposition.target_corpus_sha', live.transposition?.target_corpus_sha, target);
expect(liveFile, 'transposition.exact_target_execution', live.transposition?.exact_target_execution, false);

const manifestFile = path.join(corpus, 'proofs-manifest.json');
const manifest = readJson(manifestFile);
expect(
  manifestFile,
  'execution_runtime_provenance.source_pure_ancestor',
  manifest.execution_runtime_provenance?.source_pure_ancestor,
  HISTORICAL_SOURCE,
);
expect(
  manifestFile,
  'execution_runtime_provenance.execution_runtime_sha',
  manifest.execution_runtime_provenance?.execution_runtime_sha,
  HISTORICAL_EXECUTION,
);
expect(
  manifestFile,
  'execution_runtime_provenance.transposed_target',
  manifest.execution_runtime_provenance?.transposed_target,
  target,
);
expect(
  manifestFile,
  'execution_runtime_provenance.target_is_ancestor_of_execution',
  manifest.execution_runtime_provenance?.target_is_ancestor_of_execution,
  false,
);
expect(manifestFile, 'runtime_composite.sha', manifest.runtime_composite?.sha, EXACT_RUNTIME);
expect(
  manifestFile,
  'runtime_composite.final_target_is_ancestor',
  manifest.runtime_composite?.final_target_is_ancestor,
  false,
);
expect(
  manifestFile,
  'runtime_composite.exact_target_execution',
  manifest.runtime_composite?.exact_target_execution,
  false,
);
expect(manifestFile, 'exact_target_execution', manifest.exact_target_execution, false);

if (counts.fixtureFiles !== 15) {
  violations.push({ file: '.', field: 'fixtureFiles', expected: 15, actual: counts.fixtureFiles });
}
if (counts.fixtureTranspositions !== 15) {
  violations.push({
    file: '.',
    field: 'fixtureTranspositions',
    expected: 15,
    actual: counts.fixtureTranspositions,
  });
}
if (counts.operationalIdentityFields !== 23) {
  violations.push({
    file: '.',
    field: 'operationalIdentityFields',
    expected: 23,
    actual: counts.operationalIdentityFields,
  });
}

const result = {
  schema: 'openclaw.proofs.execution-identity-check.v1',
  corpus: target,
  expected: {
    historicalSource: HISTORICAL_SOURCE,
    historicalExecution: HISTORICAL_EXECUTION,
    exactRuntime: EXACT_RUNTIME,
    transpositionTarget: target,
  },
  counts,
  violations,
  ok: violations.length === 0,
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exitCode = result.ok ? 0 : 1;
