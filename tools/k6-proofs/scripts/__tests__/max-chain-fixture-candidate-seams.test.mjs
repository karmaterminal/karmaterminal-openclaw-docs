// R-CW-6 fixture against a stub of the current candidate's seams (docs#516).
//
// The stub models karmaterminal/openclaw 293c977f62: delegate and work custody
// live in the real continuation custody store, custody suites run only in the
// database-worker (infra) lane, the dispatcher imports its spawn owner from
// src/agents/subagents/spawn/ and its raw system-event enqueue as
// enqueueSystemEventRaw, and the Tasks/TaskFlow runtime is gone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { renderToolSurfaceTemplate, runFixture } from '../run-max-chain-fixture.mjs';
import {
  CANDIDATE_DELEGATE_SUITE,
  dispatcherSpawnOwnerMocked,
  loadGeneratedTest,
  parseGeneratedTest,
  writeStubCandidate,
  writeStubToolchain,
} from './helpers/r-cw-6-stub-candidate.mjs';

const DELEGATE_FIXTURE_FILE = 'test/r-cw-6-delegate-fixture/max-chain-delegate-boundary.test.ts';
const RUNTIME_FIXTURE_FILE = 'test/r-cw-6-runtime-fixture/max-chain-tool-surface.test.ts';
const DATABASE_WORKER_LANE_CONFIG = 'test/vitest/vitest.infra.config.ts';
const PUBLIC_RECEIPTS = [
  'boundary-matrix.json',
  'cleanup.json',
  'dispatch-boundary-suite.json',
  'durable-state-recovery.json',
  'fixture-readiness.json',
  'fixture-result.json',
  'public-artifact-safety.json',
  'runtime-boundary.json',
  'typed-tool-surface.json',
];

async function renderedTemplate(name) {
  const template = await readFile(
    fileURLToPath(new URL(`../../fixtures/r-cw-6/${name}`, import.meta.url)),
    'utf8',
  );
  return renderToolSurfaceTemplate(template, 3);
}

async function stubCandidate() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'r-cw-6-stub-candidate-'));
  const source = path.join(root, 'candidate');
  return { root, source, candidateSha: writeStubCandidate(source) };
}

function missingMockTargets(root, relativeFile, rendered) {
  return parseGeneratedTest(rendered).mocks
    .map((mock) => mock.spec)
    .filter((spec) => {
      const id = path.posix.normalize(path.posix.join(path.posix.dirname(relativeFile), spec));
      return !existsSync(path.join(root, id.replace(/\.js$/u, '.ts')));
    });
}

async function fireStubFixture({ forceFailure } = {}) {
  const { root, source, candidateSha } = await stubCandidate();
  const bin = path.join(root, 'bin');
  writeStubToolchain(bin);
  const artifactDir = path.join(root, 'artifacts');
  const logPath = path.join(root, 'stub-vitest.jsonl');
  const saved = {
    PATH: process.env.PATH,
    RCW6_STUB_VITEST_LOG: process.env.RCW6_STUB_VITEST_LOG,
    RCW6_STUB_FORCE_FAILURE: process.env.RCW6_STUB_FORCE_FAILURE,
  };
  process.env.PATH = `${bin}${path.delimiter}${process.env.PATH}`;
  process.env.RCW6_STUB_VITEST_LOG = logPath;
  if (forceFailure) process.env.RCW6_STUB_FORCE_FAILURE = forceFailure;
  else delete process.env.RCW6_STUB_FORCE_FAILURE;
  let result;
  try {
    result = runFixture({ sourceDir: source, candidateSha, artifactDir, maxChainLength: 3, json: true });
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  const runs = existsSync(logPath)
    ? (await readFile(logPath, 'utf8')).trim().split('\n').map((line) => JSON.parse(line))
    : [];
  const receipt = async (name) => JSON.parse(await readFile(path.join(artifactDir, name), 'utf8'));
  return { root, source, artifactDir, result, runs, receipt };
}

function describeRuns(runs) {
  return runs
    .map((run) => {
      const outcomes = run.outcomes.map((outcome) => `${outcome.file}: ${outcome.status}${outcome.message ? ` (${outcome.message})` : ''}`);
      return `${run.config}${run.includeFile ? ' +include-file' : ''} -> ${outcomes.length > 0 ? outcomes.join('; ') : 'no test files selected (exit 0)'}`;
    })
    .join('\n');
}

test('R-CW-6 selected delegate template loads against the current candidate seams with its spawn owner mocked', async () => {
  const { source } = await stubCandidate();
  const rendered = await renderedTemplate('max-chain-delegate-boundary.test.ts');
  const loaded = loadGeneratedTest(source, DELEGATE_FIXTURE_FILE, rendered);
  assert.equal(loaded.ok, true, loaded.message);
  assert.deepEqual(
    missingMockTargets(source, DELEGATE_FIXTURE_FILE, rendered),
    [],
    'delegate template mocks modules the candidate no longer has',
  );
  assert.equal(
    dispatcherSpawnOwnerMocked(loaded.mocked),
    true,
    'delegate template leaves the candidate dispatcher spawn owner unmocked',
  );
});

test('R-CW-6 runtime and typed template resolves every candidate module it loads', async () => {
  const { source } = await stubCandidate();
  const rendered = await renderedTemplate('max-chain-tool-surface.test.ts');
  const loaded = loadGeneratedTest(source, RUNTIME_FIXTURE_FILE, rendered);
  assert.equal(loaded.ok, true, loaded.message);
  assert.deepEqual(
    missingMockTargets(source, RUNTIME_FIXTURE_FILE, rendered),
    [],
    'runtime template mocks modules the candidate no longer has',
  );
});

test('R-CW-6 fixture runs every proof surface in the candidate lane that owns it and certifies the stub candidate', async () => {
  const fired = await fireStubFixture();
  const dispatch = await fired.receipt('dispatch-boundary-suite.json');
  assert.equal(fired.result.verdict, 'PASS-candidate', `stub candidate runs:\n${describeRuns(fired.runs)}`);
  assert.deepEqual(
    Object.values(dispatch.selectedBoundary.asserted).every(Boolean),
    true,
    JSON.stringify(dispatch.selectedBoundary.asserted),
  );
  assert.deepEqual(
    Object.values(dispatch.candidateRegressionSuite.asserted).every(Boolean),
    true,
    JSON.stringify(dispatch.candidateRegressionSuite.asserted),
  );
  const ranIn = (file) => fired.runs.find((run) => run.selected.includes(file))?.config;
  assert.equal(ranIn(CANDIDATE_DELEGATE_SUITE), DATABASE_WORKER_LANE_CONFIG);
  assert.equal(ranIn(DELEGATE_FIXTURE_FILE), DATABASE_WORKER_LANE_CONFIG);
  assert.equal(ranIn(RUNTIME_FIXTURE_FILE), DATABASE_WORKER_LANE_CONFIG);
  assert.deepEqual(fired.result.checks, {
    ...fired.result.checks,
    matrixPassed: true,
    dispatchPassed: true,
    runtimeSurfacePassed: true,
    structuredChainCapped: true,
    noRejectedHopSpawn: true,
    durableRecoveryPassed: true,
    typedSurfacePassed: true,
  });
});

test('R-CW-6 retains private diagnostics and a sanitized public excerpt when a proof surface fails', async () => {
  const fired = await fireStubFixture({ forceFailure: 'r-cw-6-delegate-fixture' });
  assert.equal(fired.result.verdict, 'FAIL-fixture');
  const dispatch = await fired.receipt('dispatch-boundary-suite.json');
  const excerpt = dispatch.selectedBoundary.failureDiagnostics?.excerpt;
  assert.ok(Array.isArray(excerpt), 'selected delegate failure left no public failure excerpt');
  assert.ok(
    excerpt.some((line) => line.includes('Error: stub forced failure for <session-key>')),
    `public excerpt does not carry the failing line: ${JSON.stringify(excerpt)}`,
  );
  assert.equal(dispatch.selectedBoundary.failureDiagnostics.privateCopyRetained, true);
  for (const name of PUBLIC_RECEIPTS) {
    const raw = await readFile(path.join(fired.artifactDir, name), 'utf8');
    assert.ok(!raw.includes(fired.root), `${name} publishes a private path`);
    assert.ok(!raw.includes('agent:main:subagent'), `${name} publishes a session identifier`);
    assert.ok(!raw.includes('\u001b['), `${name} publishes terminal escapes`);
  }
  assert.deepEqual((await readdir(fired.artifactDir)).toSorted(), PUBLIC_RECEIPTS);
  assert.deepEqual(fired.result.privateDiagnosticsRetainedFor, ['selected-delegate-boundary']);

  const privateCopy = JSON.parse(
    await readFile(path.join(`${fired.artifactDir}.private`, 'selected-delegate-boundary.json'), 'utf8'),
  );
  assert.equal(privateCopy.exitCode, 1);
  assert.match(privateCopy.stderr, /stub forced failure for agent:main:subagent:r-cw-6-private-session/u);
  assert.ok(privateCopy.stderr.includes(fired.root), 'private copy is not the raw candidate text');
  const safety = await fired.receipt('public-artifact-safety.json');
  assert.equal(safety.passed, true);
});

test('R-CW-6 passing run retains nothing private', async () => {
  const fired = await fireStubFixture();
  assert.equal(fired.result.verdict, 'PASS-candidate', `stub candidate runs:\n${describeRuns(fired.runs)}`);
  assert.deepEqual(fired.result.privateDiagnosticsRetainedFor, []);
  assert.equal(existsSync(`${fired.artifactDir}.private`), false);
});
