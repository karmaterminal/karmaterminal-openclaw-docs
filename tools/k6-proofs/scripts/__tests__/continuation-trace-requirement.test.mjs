// Continuation trace requirement contract (karmaterminal-openclaw-docs#600).
//
// PROOF-CORPUS-METHOD.md § "Tempo trace requirement": a continuation-tool PASS
// without its Tempo trace JSON is INCOMPLETE. These tests pin the shared
// predicate (lib/continuation-trace-requirement.mjs), the manifest checker that
// calls it, and the review-completion invariant every envelope writer and
// consumer must hold: a trace-required row whose trace or correlation receipt
// is missing is never review-complete.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { signedSeatReadinessFixture } from './helpers/seat-readiness-fixture.mjs';
import { writeRcd2Bundle } from './helpers/r-cd-2-authority-fixture.mjs';
import { projectPublicTempoTrace } from '../../lib/public-tempo-trace.mjs';

const runNode = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..');
const manifestsDir = path.join(repoRoot, 'tools/k6-proofs/manifests');
const checker = path.join(repoRoot, 'tools/k6-proofs/scripts/check-proof-row-manifests.mjs');
const writer = path.join(repoRoot, 'tools/k6-proofs/scripts/validate-candidate-run-result.mjs');
const reviewDebt = path.join(repoRoot, 'tools/k6-proofs/scripts/summarize-review-debt.mjs');
const runReport = path.join(repoRoot, 'tools/k6-proofs/scripts/render-run-report.mjs');
const rowMetrics = path.join(repoRoot, 'tools/k6-proofs/scripts/export-row-metrics.mjs');
const corpusMetrics = path.join(repoRoot, 'tools/k6-proofs/scripts/export-prometheus-metrics.mjs');
const libUrl = new URL('../../lib/continuation-trace-requirement.mjs', import.meta.url);
const contractUrl = new URL('../candidate-run-result-contract.mjs', import.meta.url);

// The 14 manifests issue #600 names, projected onto the fields the trace rule
// reads, exactly as committed at 7ca3969a5d (see the fixture's `extraction`).
const fossil = JSON.parse(await readFile(path.join(here, 'fixtures/docs-600-base-trace-manifests.json'), 'utf8'));
const FOSSIL_SHA = '7ca3969a5d2abab8ab7a3b8b98ad4f6b9a15cdc1';

/** Every committed row that fires a continuation tool or drives a continuation token. */
const CONTINUATION_ROWS = [
  'R-CD-1', 'R-CD-2', 'R-CD-3', 'R-CD-4', 'R-CD-CHAINED-DEPTH-2', 'R-CD-COLLECTION-ON-COLLAPSE',
  'R-CD-MODEL-CHAINED-ALT', 'R-CD-MODEL-DEFAULT', 'R-CD-MODEL-TOKEN', 'R-CD-MODEL-TOOL', 'R-CD-SILENT',
  'R-CD-TOKEN', 'R-CW-1', 'R-CW-2', 'R-CW-3', 'R-CW-4', 'R-CW-5', 'R-CW-6',
  'R-CW-DELEGATE-SELF-CONTINUATION', 'R-CW-TOKEN', 'R-RC-1', 'R-RC-2',
];

async function lib() {
  return import(libUrl);
}

function fossilManifest(file) {
  const entry = fossil.manifests.find((candidate) => candidate.file === file);
  assert.ok(entry, `fossil has no ${file}`);
  return structuredClone(entry.manifest);
}

async function committedManifest(file) {
  return JSON.parse(await readFile(path.join(manifestsDir, file), 'utf8'));
}

async function committedCatalog() {
  const files = (await readdir(manifestsDir)).filter((name) => name.endsWith('.json')).sort();
  return Promise.all(files.map(async (file) => ({ file, manifest: await committedManifest(file) })));
}

// ---------------------------------------------------------------------------
// Shared predicate
// ---------------------------------------------------------------------------

test('fossil records the 14 manifests issue #600 names at the rejected SHA', () => {
  assert.equal(fossil.source.ref, FOSSIL_SHA);
  assert.deepEqual(fossil.manifests.map((entry) => entry.manifest.rowId).sort(), [
    'R-CD-3', 'R-CD-COLLECTION-ON-COLLAPSE', 'R-CD-MODEL-CHAINED-ALT', 'R-CD-MODEL-DEFAULT',
    'R-CD-MODEL-TOKEN', 'R-CD-MODEL-TOOL', 'R-CD-SILENT', 'R-CW-2', 'R-CW-4', 'R-CW-5', 'R-CW-6',
    'R-CW-DELEGATE-SELF-CONTINUATION', 'R-CW-TOKEN', 'R-RC-1',
  ]);
});

test('the bare tempo-trace alias and tempo-trace-json are one requirement', async () => {
  const { normalizeReceiptName, traceRequirement } = await lib();
  assert.equal(normalizeReceiptName('tempo-trace'), 'tempo-trace-json');
  assert.equal(normalizeReceiptName(' Tempo-Trace '), 'tempo-trace-json');
  assert.equal(normalizeReceiptName('tempo-trace-json'), 'tempo-trace-json');
  assert.equal(normalizeReceiptName('trace-id'), 'trace-id');

  // R-CW-TOKEN exactly as fired on cael: sessions_spawn + bare CONTINUE_WORK
  // token, receipt spelled `tempo-trace`. The old gate read it as not required.
  const requirement = traceRequirement(fossilManifest('r-cw-token.json'));
  assert.equal(requirement.required, true);
  assert.equal(requirement.continuation, true);
  assert.deepEqual(requirement.receipts, ['tempo-trace-json', 'tool-trace-correlation']);
  assert.ok(requirement.reasons.includes('continuation-token-surface:bracket-token'));
  assert.ok(requirement.reasons.includes('declared-trace-receipt'), 'the alias still declares the trace receipt');

  // The alias alone declares the trace on a row that fires no continuation surface.
  assert.deepEqual(traceRequirement({ toolSurface: 'read-only', liveRunSafety: { requiredReceipts: ['tempo-trace'] } }), {
    required: true,
    continuation: false,
    reasons: ['declared-trace-receipt'],
    tool: null,
    correlationReceipt: null,
    receipts: ['tempo-trace-json'],
  });
});

test('a continuation-tool manifest that names no trace receipt is trace-required', async () => {
  const { traceRequirement } = await lib();
  for (const [file, correlation] of [
    ['r-cw-delegate-self.json', 'continuation-trace-correlation'],
    ['r-cw-2.json', 'continuation-trace-correlation'],
    ['r-cd-silent.json', 'continuation-trace-correlation'],
    ['r-rc-1.json', 'tool-trace-correlation'],
  ]) {
    const manifest = fossilManifest(file);
    const declared = manifest.liveRunSafety.requiredReceipts.filter((name) => /trace|tempo|correlation/i.test(name));
    assert.deepEqual(declared, [], `${file} declared no trace receipt at ${FOSSIL_SHA}`);
    const requirement = traceRequirement(manifest);
    assert.equal(requirement.required, true, file);
    assert.equal(requirement.continuation, true, file);
    assert.deepEqual(requirement.reasons, [`continuation-tool:${manifest.invocation.tool}`], file);
    assert.deepEqual(requirement.receipts, ['tempo-trace-json', correlation], file);
  }
  // The correlation receipt name is the file the collector writes for the tool.
  for (const [tool, correlation] of [
    ['continue_work', 'continuation-trace-correlation'],
    ['continue_delegate', 'continuation-trace-correlation'],
    ['request_compaction', 'tool-trace-correlation'],
  ]) {
    assert.equal(traceRequirement({ invocation: { tool } }).correlationReceipt, correlation, tool);
  }
});

test('sibling control: rows that fire no continuation surface stay not trace-required', async () => {
  const { traceRequirement } = await lib();
  for (const file of ['r-config-defaults.json', 'r-config-intersession.json', 'r-obs-1.json', 'r-cw-multi.json', 'preflight.example.json']) {
    const requirement = traceRequirement(await committedManifest(file));
    assert.equal(requirement.required, false, file);
    assert.deepEqual(requirement.receipts, [], file);
  }
  // A typed tool that is not a continuation tool is not enough on its own.
  assert.equal(traceRequirement({ toolSurface: 'typed-tool', invocation: { tool: 'session_status' } }).required, false);
});

test('the committed catalog marks exactly the continuation rows trace-required', async () => {
  const { traceRequirement } = await lib();
  const rows = [];
  for (const { manifest } of await committedCatalog()) {
    if (traceRequirement(manifest).continuation) rows.push(manifest.rowId);
  }
  assert.deepEqual(rows.sort(), [...CONTINUATION_ROWS].sort());
});

// ---------------------------------------------------------------------------
// Manifest checker
// ---------------------------------------------------------------------------

async function checkerFixture(manifests) {
  const root = await mkdtemp(path.join(tmpdir(), 'docs-600-trace-checker-'));
  const sha = '0123456789abcdef0123456789abcdef01234567';
  await mkdir(path.join(root, 'PROOFS', sha), { recursive: true });
  await mkdir(path.join(root, 'tools/k6-proofs/manifests'), { recursive: true });
  await mkdir(path.join(root, 'tools/k6-proofs/scenarios'), { recursive: true });
  await writeFile(path.join(root, 'PROOFS/INDEX.json'), `${JSON.stringify({ current_sha: sha })}\n`);
  for (const { file, manifest } of manifests) {
    await writeFile(path.join(root, 'tools/k6-proofs/manifests', file), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  return root;
}

async function runChecker(root) {
  try {
    const { stdout, stderr } = await runNode(process.execPath, [checker, '--repo-root', root], { encoding: 'utf8' });
    return { status: 0, stdout, stderr };
  } catch (error) {
    if (typeof error.code !== 'number') throw error;
    return { status: error.code, stdout: error.stdout, stderr: error.stderr };
  }
}

test(`the manifest checker refuses each of the 14 manifests as committed at ${FOSSIL_SHA.slice(0, 10)}`, async (t) => {
  for (const { file, manifest } of fossil.manifests) {
    await t.test(file, async () => {
      const root = await checkerFixture([{ file, manifest }]);
      try {
        const result = await runChecker(root);
        assert.notEqual(result.status, 0, `${file} at ${FOSSIL_SHA} must be refused:\n${result.stdout}`);
        assert.match(result.stderr, new RegExp(`${file.replaceAll('.', '\\.')}: .*tempo-trace-json`));
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  }
});

test('the manifest checker accepts the committed form of the same 14 manifests', async () => {
  const manifests = await Promise.all(fossil.manifests.map(async ({ file }) => ({ file, manifest: await committedManifest(file) })));
  const root = await checkerFixture(manifests);
  try {
    const result = await runChecker(root);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('the manifest checker refuses the bare alias anywhere and a missing correlation receipt', async () => {
  const committed = await committedManifest('r-cw-token.json');
  const aliasInExpected = structuredClone(committed);
  aliasInExpected.expectedReceipts.push({ name: 'tempo-trace', required: false, description: 'alias' });
  const noCorrelation = structuredClone(committed);
  noCorrelation.liveRunSafety.requiredReceipts = noCorrelation.liveRunSafety.requiredReceipts
    .filter((name) => name !== 'tool-trace-correlation');
  const optionalTrace = structuredClone(await committedManifest('r-cw-delegate-self.json'));
  optionalTrace.expectedReceipts.find((receipt) => receipt.name === 'tempo-trace-json').required = false;
  for (const [label, manifest, pattern] of [
    ['alias in expectedReceipts', aliasInExpected, /expectedReceipts names 'tempo-trace'; declare the canonical receipt 'tempo-trace-json'/],
    ['correlation receipt missing', noCorrelation, /must list 'tool-trace-correlation' in liveRunSafety\.requiredReceipts/],
    ['trace receipt optional', optionalTrace, /exactly one expectedReceipts entry 'tempo-trace-json' with required: true/],
  ]) {
    const root = await checkerFixture([{ file: 'r-fixture.json', manifest }]);
    try {
      const result = await runChecker(root);
      assert.notEqual(result.status, 0, label);
      assert.match(result.stderr, pattern, label);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test('every committed manifest satisfies the trace receipt rule', async () => {
  const { manifestTraceReceiptFailures } = await lib();
  const failures = [];
  for (const { file, manifest } of await committedCatalog()) {
    for (const failure of manifestTraceReceiptFailures(manifest)) failures.push(`${file}: ${failure}`);
  }
  assert.deepEqual(failures, []);
});

// ---------------------------------------------------------------------------
// Envelope writer and consumers
// ---------------------------------------------------------------------------

const candidateSha = 'a'.repeat(40);
const docsRef = 'b'.repeat(40);
const gatewayKey = 'docs-600-trace-gate-key';
const gatewayUnit = 'openclaw-docs-600.service';
const scenarioSource = 'export default function scenario() { return true; }\n';
const traceId = '9'.repeat(32);

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function continuationManifest(rowId = 'R-CW-TRACE-TEST') {
  return {
    schema: 'openclaw.k6.proof-row-manifest.v1',
    rowId,
    candidateSha,
    seat: 'cael',
    toolSurface: 'typed-tool',
    scenario: { name: 'r-cw-trace-test' },
    invocation: { tool: 'continue_work', reason: 'k6-proof-trace-test-{{nonce}}' },
    review: { candidateOnly: true, foldRequiresReview: true },
    liveRunSafety: { expectedArtifactClass: 'PASS-candidate', requiredReceipts: ['tempo-trace-json', 'continuation-trace-correlation'] },
  };
}

function readOnlyManifest(rowId = 'R-CW-TRACE-TEST') {
  const manifest = continuationManifest(rowId);
  delete manifest.invocation;
  manifest.toolSurface = 'read-only';
  manifest.liveRunSafety.requiredReceipts = ['config-read'];
  return manifest;
}

const TRACE_JSON = `tempo-trace-${traceId.slice(0, 12)}.json`;
const CORRELATION_JSON = 'continuation-trace-correlation.json';

const OBSERVABILITY = {
  // The exact cael envelope source: no trace, no correlation, nothing pending.
  none: { traceStatus: 'unknown', traceId: null, tempoTraceJson: null, correlationReceipt: null },
  traceOnly: { traceStatus: 'present', traceId, tempoTraceJson: TRACE_JSON, correlationReceipt: null },
  correlationOnly: { traceStatus: 'missing', traceId: null, tempoTraceJson: null, correlationReceipt: CORRELATION_JSON },
  complete: {
    traceStatus: 'present',
    traceId,
    tempoTraceJson: TRACE_JSON,
    correlationReceipt: CORRELATION_JSON,
  },
};

/** The public trace JSON the collector writes for `id`, through the real projection. */
function traceJsonBody(id) {
  const trace = projectPublicTempoTrace({ batches: [{ scopeSpans: [{ spans: [{
    name: 'openclaw.tool.execution',
    traceId: id,
    spanId: '4'.repeat(16),
    parentSpanId: '5'.repeat(16),
    status: { code: 1 },
    attributes: [{ key: 'gen_ai.tool.name', value: { stringValue: 'continue_work' } }],
  }] }] }] }, id);
  return `${JSON.stringify(trace, null, 2)}\n`;
}

/** The correlation receipt the collector writes beside it, naming the trace and its JSON. */
function correlationBody(id, traceJson = `tempo-trace-${id.slice(0, 12)}.json`) {
  return `${JSON.stringify({
    schema: 'openclaw.k6.continuation-trace-correlation.v1',
    row: 'R-CW-TRACE-TEST',
    seat: 'cael',
    traceJson,
    traceId: id,
    sameTrace: true,
    resultClass: 'unique',
  }, null, 2)}\n`;
}

/** Both receipts, on disk and bound to `traceId`: what the collector leaves for a complete run. */
const BOUND_RECEIPTS = Object.freeze({
  [TRACE_JSON]: traceJsonBody(traceId),
  [CORRELATION_JSON]: correlationBody(traceId),
});

async function candidateFixture({ manifest = continuationManifest(), observability, receipts = {} }) {
  const root = await mkdtemp(path.join(tmpdir(), 'docs-600-trace-envelope-'));
  // The runner's layout, so review-debt can name the row from its path.
  const candidateDir = path.join(root, candidateSha, manifest.rowId, 'cael', '20261028T101640Z-r-cw-trace-test-0c4808dc');
  await mkdir(candidateDir, { recursive: true });
  const manifestPath = path.join(root, 'manifest.json');
  const manifestBody = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(manifestPath, manifestBody);
  await writeFile(path.join(candidateDir, 'row-manifest.json'), manifestBody);
  await writeFile(path.join(candidateDir, 'row-scenario.js'), scenarioSource);
  const metadata = {
    row: manifest.rowId,
    candidateSha,
    runtimeBuildSha: candidateSha,
    seat: 'cael',
    scenario: 'r-cw-trace-test.js',
    docsRef,
    repository: 'karmaterminal/karmaterminal-openclaw-docs',
    manifestPath: 'tools/k6-proofs/manifests/r-cw-trace-test.json',
    manifestSha256: digest(manifestBody),
    scenarioPath: 'tools/k6-proofs/scenarios/r-cw-trace-test.js',
    scenarioSha256: digest(scenarioSource),
  };
  const readiness = signedSeatReadinessFixture({
    signingKey: gatewayKey,
    candidateSha,
    runtimeSha: candidateSha,
    docsSha: docsRef,
    seat: metadata.seat,
    unit: gatewayUnit,
    rows: [metadata.row],
  });
  const readinessBody = `${JSON.stringify(readiness, null, 2)}\n`;
  metadata.readiness = {
    receipt: 'seat-readiness.json',
    sha256: digest(readinessBody),
    gatewayUrlFingerprint: readiness.bindings.gatewayUrlFingerprint,
    unit: gatewayUnit,
    selectedRows: [metadata.row],
    requiredMaxSpawnDepth: 2,
    expectedMaxSpawnDepth: 5,
  };
  const runResult = {
    k6ExitCode: 0,
    effectiveExitCode: 0,
    verdict: 'PASS-candidate',
    verdictSource: 'vu-log',
    candidateOnly: true,
    foldRequiresReview: true,
    observability,
    review: { status: 'ready-for-human-review', pendingReceipts: [] },
  };
  await writeFile(path.join(candidateDir, 'runner-metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  await writeFile(path.join(candidateDir, 'seat-readiness.json'), readinessBody);
  await writeFile(path.join(candidateDir, 'run-result.json'), `${JSON.stringify(runResult, null, 2)}\n`);
  for (const [name, body] of Object.entries(receipts)) await writeFile(path.join(candidateDir, name), body);
  return {
    root,
    candidateDir,
    manifestPath,
    manifest,
    metadata,
    runResult,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

async function writeEnvelope(setup) {
  const out = path.join(setup.candidateDir, 'candidate-run-result.json');
  try {
    const { stdout } = await runNode(process.execPath, [
      writer,
      '--manifest', setup.manifestPath,
      '--candidate-dir', setup.candidateDir,
      '--docs-ref', docsRef,
      '--out', out,
    ], { encoding: 'utf8', env: { ...process.env, OPENCLAW_GATEWAY_TOKEN: gatewayKey } });
    return { ok: true, envelope: JSON.parse(stdout) };
  } catch (error) {
    if (typeof error.code !== 'number') throw error;
    return { ok: false, stderr: error.stderr };
  }
}

test('the envelope writer never calls a trace-required run complete without its trace and correlation', async (t) => {
  for (const [label, observability, receipts, owed] of [
    ['no trace, no correlation (the cael envelope)', OBSERVABILITY.none, {}, ['tempo-trace-json', 'continuation-trace-correlation']],
    ['trace without its correlation receipt', OBSERVABILITY.traceOnly, { [TRACE_JSON]: BOUND_RECEIPTS[TRACE_JSON] }, ['continuation-trace-correlation']],
    ['correlation receipt without a trace', OBSERVABILITY.correlationOnly, { [CORRELATION_JSON]: BOUND_RECEIPTS[CORRELATION_JSON] }, ['tempo-trace-json']],
  ]) {
    await t.test(label, async () => {
      const setup = await candidateFixture({ observability, receipts });
      try {
        const written = await writeEnvelope(setup);
        assert.equal(written.ok, false, `writer emitted complete=${written.envelope?.review?.complete} with traceCaptured=${written.envelope?.observability?.traceCaptured}`);
        assert.match(written.stderr, /review-incomplete/);
        for (const receipt of owed) assert.match(written.stderr, new RegExp(receipt));
        await assert.rejects(readFile(path.join(setup.candidateDir, 'candidate-run-result.json')), /ENOENT/);
      } finally {
        await setup.cleanup();
      }
    });
  }
});

test('positive control: a recovered trace and correlation receipt yield a complete envelope', async () => {
  const setup = await candidateFixture({ observability: OBSERVABILITY.complete, receipts: BOUND_RECEIPTS });
  try {
    // The receipts are real files in the run directory and bind to the result's trace ID.
    const trace = JSON.parse(await readFile(path.join(setup.candidateDir, TRACE_JSON), 'utf8'));
    const correlation = JSON.parse(await readFile(path.join(setup.candidateDir, CORRELATION_JSON), 'utf8'));
    assert.equal(trace.schema, 'openclaw.k6.public-tempo-trace.v1');
    assert.equal(trace.traceId, setup.runResult.observability.traceId);
    assert.equal(correlation.traceId, setup.runResult.observability.traceId);
    assert.equal(correlation.traceJson, setup.runResult.observability.tempoTraceJson);
    const written = await writeEnvelope(setup);
    assert.equal(written.ok, true, written.stderr);
    assert.equal(written.envelope.review.complete, true);
    assert.deepEqual(written.envelope.review.pendingReceipts, []);
    assert.equal(written.envelope.observability.traceCaptured, true);
    assert.equal(written.envelope.observability.correlationReceiptPresent, true);
    assert.equal(written.envelope.artifacts.tempoTraceJson, TRACE_JSON);
    assert.equal(written.envelope.artifacts.correlationReceipt, CORRELATION_JSON);
    assert.equal(written.envelope.result.outcome, 'PASS-candidate', 'the writer does not own the verdict');
  } finally {
    await setup.cleanup();
  }
});

test('sibling control: a row that fires no continuation surface completes without a trace', async () => {
  const setup = await candidateFixture({ manifest: readOnlyManifest(), observability: OBSERVABILITY.none });
  try {
    const written = await writeEnvelope(setup);
    assert.equal(written.ok, true, written.stderr);
    assert.equal(written.envelope.review.complete, true);
    assert.equal(written.envelope.observability.traceCaptured, false);
  } finally {
    await setup.cleanup();
  }
});

/**
 * Forge the cael state behind a valid writer run: write a complete envelope
 * for a run that holds its trace, then strip the trace from the raw result and
 * the envelope consistently, so only the trace invariant can tell them apart.
 */
async function forgedTraceLessEnvelope() {
  const setup = await candidateFixture({ observability: OBSERVABILITY.complete, receipts: BOUND_RECEIPTS });
  const written = await writeEnvelope(setup);
  assert.equal(written.ok, true, written.stderr);
  const runResult = { ...setup.runResult, observability: OBSERVABILITY.none };
  const envelope = structuredClone(written.envelope);
  envelope.observability = { traceStatus: 'unknown', traceCaptured: false, correlationReceiptPresent: false };
  envelope.artifacts.tempoTraceJson = null;
  envelope.artifacts.correlationReceipt = null;
  await writeFile(path.join(setup.candidateDir, 'run-result.json'), `${JSON.stringify(runResult, null, 2)}\n`);
  await writeFile(path.join(setup.candidateDir, 'candidate-run-result.json'), `${JSON.stringify(envelope, null, 2)}\n`);
  return { ...setup, runResult, envelope, original: written.envelope };
}

test('the envelope consumer refuses review completion for a trace-required row without its trace', async () => {
  const { candidateEnvelopeMatchesSiblings } = await import(contractUrl);
  const forged = await forgedTraceLessEnvelope();
  try {
    assert.equal(candidateEnvelopeMatchesSiblings({
      envelope: forged.envelope,
      manifest: forged.manifest,
      metadata: forged.metadata,
      runResult: forged.runResult,
      runDir: forged.candidateDir,
    }), false);
    // Positive control on the same directory: the untouched envelope and run result agree.
    assert.equal(candidateEnvelopeMatchesSiblings({
      envelope: forged.original,
      manifest: forged.manifest,
      metadata: forged.metadata,
      runResult: { ...forged.runResult, observability: OBSERVABILITY.complete },
      runDir: forged.candidateDir,
    }), true);
  } finally {
    await forged.cleanup();
  }
});

async function summarize(root) {
  const { stdout } = await runNode(process.execPath, [reviewDebt, '--run-root', root, '--json'], { encoding: 'utf8' });
  return JSON.parse(stdout);
}

test('review-debt routes the trace debt a forged-complete continuation run still owes', async () => {
  const forged = await forgedTraceLessEnvelope();
  try {
    const summary = await summarize(forged.root);
    assert.equal(summary.pendingRows, 1, JSON.stringify(summary, null, 2));
    const [row] = summary.pending;
    assert.equal(row.rowId, 'R-CW-TRACE-TEST');
    assert.deepEqual([...row.pendingReceipts].sort(), ['continuation-trace-correlation', 'tempo-trace-json']);
    assert.equal(row.reviewStatus, 'review-pending');
    assert.ok(row.pending.some((item) => item.receipt === 'tempo-trace-json' && item.class === 'tempo-trace-unfetchable'));
  } finally {
    await forged.cleanup();
  }
});

test('review-debt adds trace debt to a raw continuation run that claims nothing pending', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'docs-600-review-debt-raw-'));
  try {
    const runDir = path.join(root, candidateSha, 'R-CW-TOKEN', 'cael-dgx', '20261028T101640Z-r-cw-token-0c4808dc');
    await mkdir(runDir, { recursive: true });
    // The run directory carries the manifest it fired: R-CW-TOKEN as at 7ca3969a5d.
    await writeFile(path.join(runDir, 'row-manifest.json'), `${JSON.stringify(fossilManifest('r-cw-token.json'))}\n`);
    await writeFile(path.join(runDir, 'run-result.json'), `${JSON.stringify({
      verdict: 'PASS-candidate',
      verdictSource: 'vu-log',
      candidateOnly: true,
      foldRequiresReview: true,
      observability: OBSERVABILITY.none,
      review: { status: 'ready-for-human-review', pendingReceipts: [] },
    })}\n`);
    const sibling = path.join(root, candidateSha, 'R-CONFIG-DEFAULTS', 'cael-dgx', '20261028T101700Z-r-config-defaults-0c4808dc');
    await mkdir(sibling, { recursive: true });
    await writeFile(path.join(sibling, 'row-manifest.json'), `${JSON.stringify(await committedManifest('r-config-defaults.json'))}\n`);
    await writeFile(path.join(sibling, 'run-result.json'), `${JSON.stringify({
      verdict: 'PASS-candidate',
      candidateOnly: true,
      foldRequiresReview: true,
      observability: OBSERVABILITY.none,
      review: { status: 'ready-for-human-review', pendingReceipts: [] },
    })}\n`);

    const summary = await summarize(root);
    assert.equal(summary.totalRows, 2);
    assert.equal(summary.pendingRows, 1, JSON.stringify(summary, null, 2));
    const [row] = summary.pending;
    assert.equal(row.rowId, 'R-CW-TOKEN');
    assert.equal(row.reviewStatus, 'review-pending');
    assert.deepEqual([...row.pendingReceipts].sort(), ['tempo-trace-json', 'tool-trace-correlation']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Receipts on disk: existence and binding (#601 review at b1fffb1e75)
//
// A receipt name in the run result is not a receipt. A trace-required row is
// complete only when the trace JSON and correlation receipt it names are
// regular files in its run directory and bind to its trace ID: the trace JSON
// carries that ID, and the correlation receipt names that ID and that trace
// JSON. Anything else stays pending at the writer, at the consumer contract,
// and in review-debt.
// ---------------------------------------------------------------------------

const OTHER_TRACE_ID = '3'.repeat(32);
const OTHER_TRACE_JSON = `tempo-trace-${OTHER_TRACE_ID.slice(0, 12)}.json`;

/** `reasons` maps an owed receipt to why it is not held, as the writer and review-debt report it. */
async function assertWriterRefuses(setup, owed, label, reasons = {}) {
  const written = await writeEnvelope(setup);
  assert.equal(written.ok, false, `${label}: writer emitted complete=${written.envelope?.review?.complete}`);
  assert.match(written.stderr, new RegExp(`still owes ${owed.join(', ')} \\(Tempo trace requirement\\)`), label);
  for (const [receipt, reason] of Object.entries(reasons)) {
    assert.match(written.stderr, new RegExp(`${receipt}: ${reason}(?:[,\\n]|$)`), `${label}: ${written.stderr}`);
  }
  await assert.rejects(readFile(path.join(setup.candidateDir, 'candidate-run-result.json')), /ENOENT/, label);
}

async function assertReviewDebtOwes(root, owed, label, reasons = {}) {
  const summary = await summarize(root);
  assert.equal(summary.pendingRows, 1, `${label}: ${JSON.stringify(summary, null, 2)}`);
  const [row] = summary.pending;
  assert.equal(row.reviewStatus, 'review-pending', label);
  assert.deepEqual([...row.pendingReceipts].sort(), [...owed].sort(), label);
  for (const [receipt, reason] of Object.entries(reasons)) {
    assert.equal(row.pending.find((item) => item.receipt === receipt)?.reason, reason, `${label}: ${JSON.stringify(row.pending)}`);
  }
}

/** Put `body` outside the run directory and leave a symlink to it under `name`. */
async function symlinkOut(setup, name, body) {
  const outside = path.join(setup.root, `outside-${name}`);
  await writeFile(outside, body);
  await rm(path.join(setup.candidateDir, name), { force: true });
  await symlink(outside, path.join(setup.candidateDir, name));
}

test('the shared predicate needs the run directory: a receipt name is not a receipt', async () => {
  const { traceReceiptFindings, traceReviewDebt } = await lib();
  assert.throws(() => traceReviewDebt(continuationManifest(), OBSERVABILITY.complete), /run directory/);
  assert.throws(() => traceReceiptFindings(continuationManifest(), OBSERVABILITY.complete), /run directory/);
  assert.deepEqual(traceReviewDebt(readOnlyManifest(), OBSERVABILITY.none), [], 'a row that owes no trace needs no run directory');
  const setup = await candidateFixture({ observability: OBSERVABILITY.complete, receipts: BOUND_RECEIPTS });
  try {
    assert.deepEqual(traceReceiptFindings(setup.manifest, OBSERVABILITY.complete, { runDir: setup.candidateDir }), [
      { receipt: 'tempo-trace-json', held: true, reason: null },
      { receipt: 'continuation-trace-correlation', held: true, reason: null },
    ]);
    assert.deepEqual(traceReceiptFindings(setup.manifest, OBSERVABILITY.none, { runDir: setup.candidateDir }), [
      { receipt: 'tempo-trace-json', held: false, reason: 'no-trace-id' },
      { receipt: 'continuation-trace-correlation', held: false, reason: 'no-trace-id' },
    ]);
    assert.deepEqual(traceReviewDebt(setup.manifest, OBSERVABILITY.complete, { runDir: setup.candidateDir }), []);
    await rm(path.join(setup.candidateDir, TRACE_JSON));
    assert.deepEqual(traceReviewDebt(setup.manifest, OBSERVABILITY.complete, { runDir: setup.candidateDir }), ['tempo-trace-json']);
    // A correlation receipt binds to a named trace JSON, never to the absence of one.
    await writeFile(path.join(setup.candidateDir, CORRELATION_JSON), `${JSON.stringify({
      schema: 'openclaw.k6.continuation-trace-correlation.v1',
      traceId,
    })}\n`);
    const { tempoTraceJson: _unnamed, ...noTraceJson } = OBSERVABILITY.complete;
    assert.deepEqual(
      traceReviewDebt(setup.manifest, noTraceJson, { runDir: setup.candidateDir }),
      ['tempo-trace-json', 'continuation-trace-correlation'],
    );
  } finally {
    await setup.cleanup();
  }
});

test('the envelope writer refuses a trace-required run whose named receipts are missing, unbound or not in its run directory', async (t) => {
  const trace = BOUND_RECEIPTS[TRACE_JSON];
  const correlation = BOUND_RECEIPTS[CORRELATION_JSON];
  // Each case: what is on disk, then each owed receipt and why it is not held.
  for (const [label, { observability = OBSERVABILITY.complete, receipts, prepare = null }, owedReasons] of [
    ['trace JSON missing', { receipts: { [CORRELATION_JSON]: correlation } }, { 'tempo-trace-json': 'missing' }],
    ['correlation receipt missing', { receipts: { [TRACE_JSON]: trace } }, { 'continuation-trace-correlation': 'missing' }],
    ['both named, neither on disk', { receipts: {} }, {
      'tempo-trace-json': 'missing',
      'continuation-trace-correlation': 'missing',
    }],
    ['trace JSON whose trace ID is not the result traceId', {
      receipts: { [TRACE_JSON]: traceJsonBody(OTHER_TRACE_ID), [CORRELATION_JSON]: correlation },
    }, { 'tempo-trace-json': 'trace-id-mismatch' }],
    ['trace JSON with a span from another trace', {
      receipts: {
        [TRACE_JSON]: (() => {
          const mixed = JSON.parse(trace);
          mixed.spans.push({ ...mixed.spans[0], traceId: OTHER_TRACE_ID, spanId: '6'.repeat(16) });
          return `${JSON.stringify(mixed, null, 2)}\n`;
        })(),
        [CORRELATION_JSON]: correlation,
      },
    }, { 'tempo-trace-json': 'trace-id-mismatch' }],
    ['correlation receipt naming another trace', {
      receipts: { [TRACE_JSON]: trace, [CORRELATION_JSON]: correlationBody(OTHER_TRACE_ID, TRACE_JSON) },
    }, { 'continuation-trace-correlation': 'trace-id-mismatch' }],
    ['correlation receipt naming another trace JSON', {
      receipts: { [TRACE_JSON]: trace, [CORRELATION_JSON]: correlationBody(traceId, OTHER_TRACE_JSON) },
    }, { 'continuation-trace-correlation': 'trace-json-mismatch' }],
    ['correlation receipt written under another tool kind\'s name', {
      observability: { ...OBSERVABILITY.complete, correlationReceipt: 'tool-trace-correlation.json' },
      receipts: { [TRACE_JSON]: trace, 'tool-trace-correlation.json': correlation },
    }, { 'continuation-trace-correlation': 'wrong-receipt-name' }],
    ['trace JSON cut short mid-write', {
      receipts: { [TRACE_JSON]: trace.slice(0, 40), [CORRELATION_JSON]: correlation },
    }, { 'tempo-trace-json': 'not-json' }],
    ['trace JSON that is a raw Tempo response, not the public projection', {
      receipts: { [TRACE_JSON]: `${JSON.stringify({ traceId, batches: [] })}\n`, [CORRELATION_JSON]: correlation },
    }, { 'tempo-trace-json': 'not-public-trace-projection' }],
    ['trace JSON with spans but no public projection schema', {
      receipts: { [TRACE_JSON]: `${JSON.stringify({ traceId, spans: [] })}\n`, [CORRELATION_JSON]: correlation },
    }, { 'tempo-trace-json': 'not-public-trace-projection' }],
    ['trace JSON is a symlink out of the run directory', {
      receipts: { [CORRELATION_JSON]: correlation },
      prepare: (setup) => symlinkOut(setup, TRACE_JSON, trace),
    }, { 'tempo-trace-json': 'symlink' }],
    ['correlation receipt is a symlink out of the run directory', {
      receipts: { [TRACE_JSON]: trace },
      prepare: (setup) => symlinkOut(setup, CORRELATION_JSON, correlation),
    }, { 'continuation-trace-correlation': 'symlink' }],
    ['trace JSON name is a directory', {
      receipts: { [CORRELATION_JSON]: correlation },
      prepare: (setup) => mkdir(path.join(setup.candidateDir, TRACE_JSON)),
    }, { 'tempo-trace-json': 'not-a-regular-file' }],
  ]) {
    await t.test(label, async () => {
      const setup = await candidateFixture({ observability, receipts });
      const owed = Object.keys(owedReasons);
      try {
        if (prepare) await prepare(setup);
        await assertWriterRefuses(setup, owed, label, owedReasons);
        await assertReviewDebtOwes(setup.root, owed, label, owedReasons);
      } finally {
        await setup.cleanup();
      }
    });
  }
});

// The writer already refused an escaping name through the artifact-name rule
// before #600; the shared predicate and review-debt, which read the raw result,
// did not. Assert them first so each is held to the rule on its own.
test('a receipt path that escapes the run directory is refused by the predicate, review-debt and the writer', async (t) => {
  const { traceReviewDebt } = await lib();
  for (const [label, observability, receipts, [outsideName, outsideBody], owed] of [
    ['trace JSON path escapes the run directory',
      { ...OBSERVABILITY.complete, tempoTraceJson: `../${TRACE_JSON}` },
      { [CORRELATION_JSON]: correlationBody(traceId, `../${TRACE_JSON}`) },
      [TRACE_JSON, BOUND_RECEIPTS[TRACE_JSON]],
      ['tempo-trace-json']],
    ['correlation receipt path escapes the run directory',
      { ...OBSERVABILITY.complete, correlationReceipt: `../${CORRELATION_JSON}` },
      { [TRACE_JSON]: BOUND_RECEIPTS[TRACE_JSON] },
      [CORRELATION_JSON, BOUND_RECEIPTS[CORRELATION_JSON]],
      ['continuation-trace-correlation']],
  ]) {
    await t.test(label, async () => {
      const setup = await candidateFixture({ observability, receipts });
      try {
        // A bound receipt really is there, one directory up.
        await writeFile(path.join(path.dirname(setup.candidateDir), outsideName), outsideBody);
        assert.deepEqual(traceReviewDebt(setup.manifest, observability, { runDir: setup.candidateDir }), owed);
        const reasons = Object.fromEntries(owed.map((receipt) => [receipt, 'unsafe-name']));
        await assertReviewDebtOwes(setup.root, owed, label, reasons);
        await assertWriterRefuses(setup, owed, label, reasons);
      } finally {
        await setup.cleanup();
      }
    });
  }
});

test('a pre-existing run directory holding another run\'s receipts is not complete unless they bind', async (t) => {
  // What an earlier run in the same directory left: its own trace JSON and the
  // fixed-name correlation receipt, both for OTHER_TRACE_ID.
  const stale = {
    [OTHER_TRACE_JSON]: traceJsonBody(OTHER_TRACE_ID),
    [CORRELATION_JSON]: correlationBody(OTHER_TRACE_ID),
  };
  for (const [label, observability] of [
    ['the result names its own trace JSON, never written', OBSERVABILITY.complete],
    ['the result names the stale trace JSON', { ...OBSERVABILITY.complete, tempoTraceJson: OTHER_TRACE_JSON }],
  ]) {
    await t.test(label, async () => {
      const setup = await candidateFixture({ observability, receipts: stale });
      try {
        await assertWriterRefuses(setup, ['tempo-trace-json', 'continuation-trace-correlation'], label);
        await assertReviewDebtOwes(setup.root, ['tempo-trace-json', 'continuation-trace-correlation'], label);
      } finally {
        await setup.cleanup();
      }
    });
  }
  await t.test('positive control: this run\'s bound receipts beside the stale trace JSON', async () => {
    const setup = await candidateFixture({ observability: OBSERVABILITY.complete, receipts: { ...stale, ...BOUND_RECEIPTS } });
    try {
      const written = await writeEnvelope(setup);
      assert.equal(written.ok, true, written.stderr);
      assert.equal(written.envelope.review.complete, true);
      assert.equal(written.envelope.artifacts.tempoTraceJson, TRACE_JSON);
      assert.equal(written.envelope.artifacts.correlationReceipt, CORRELATION_JSON);
    } finally {
      await setup.cleanup();
    }
  });
});

test('the envelope consumer rejects an envelope whose receipts were deleted or replaced after it was written', async (t) => {
  const { candidateEnvelopeMatchesSiblings } = await import(contractUrl);
  for (const [label, mutate, owed] of [
    ['trace JSON deleted', (setup) => rm(path.join(setup.candidateDir, TRACE_JSON)), ['tempo-trace-json']],
    ['correlation receipt deleted', (setup) => rm(path.join(setup.candidateDir, CORRELATION_JSON)), ['continuation-trace-correlation']],
    ['both receipts deleted', async (setup) => {
      await rm(path.join(setup.candidateDir, TRACE_JSON));
      await rm(path.join(setup.candidateDir, CORRELATION_JSON));
    }, ['tempo-trace-json', 'continuation-trace-correlation']],
    ['trace JSON replaced by another trace', (setup) =>
      writeFile(path.join(setup.candidateDir, TRACE_JSON), traceJsonBody(OTHER_TRACE_ID)), ['tempo-trace-json']],
    ['correlation receipt replaced by one naming another trace', (setup) =>
      writeFile(path.join(setup.candidateDir, CORRELATION_JSON), correlationBody(OTHER_TRACE_ID, TRACE_JSON)), ['continuation-trace-correlation']],
    ['trace JSON swapped for a symlink out of the run directory', (setup) =>
      symlinkOut(setup, TRACE_JSON, BOUND_RECEIPTS[TRACE_JSON]), ['tempo-trace-json']],
  ]) {
    await t.test(label, async () => {
      const setup = await candidateFixture({ observability: OBSERVABILITY.complete, receipts: BOUND_RECEIPTS });
      try {
        const written = await writeEnvelope(setup);
        assert.equal(written.ok, true, written.stderr);
        const siblings = () => ({
          envelope: written.envelope,
          manifest: setup.manifest,
          metadata: setup.metadata,
          runResult: setup.runResult,
          runDir: setup.candidateDir,
        });
        assert.equal(candidateEnvelopeMatchesSiblings(siblings()), true, `${label}: positive control before the change`);
        await mutate(setup);
        assert.equal(candidateEnvelopeMatchesSiblings(siblings()), false, label);
        await assertReviewDebtOwes(setup.root, owed, label);
        // Recovery: the bound receipts put back make the same envelope stand again.
        for (const [name, body] of Object.entries(BOUND_RECEIPTS)) {
          await rm(path.join(setup.candidateDir, name), { force: true });
          await writeFile(path.join(setup.candidateDir, name), body);
        }
        assert.equal(candidateEnvelopeMatchesSiblings(siblings()), true, `${label}: receipts restored`);
      } finally {
        await setup.cleanup();
      }
    });
  }
});

/**
 * What the run report and both metrics exporters say about the fixture's row:
 * the report row as run-proofs.sh renders it after a matrix, the per-row
 * metrics it exports for the run directory, and the corpus metrics over the
 * same root.
 */
async function reportAndMetrics(setup) {
  const env = { ...process.env, OPENCLAW_GATEWAY_TOKEN: gatewayKey };
  const reportOut = path.join(setup.root, 'report.html');
  await runNode(process.execPath, [runReport, '--root', setup.root, '--out', reportOut], { encoding: 'utf8', env });
  const html = await readFile(reportOut, 'utf8');
  const rowProm = path.join(setup.root, 'row.prom');
  await runNode(process.execPath, [rowMetrics, '--run-dir', setup.candidateDir, '--prometheus-out', rowProm], { encoding: 'utf8', env });
  const corpusProm = path.join(setup.root, 'corpus.prom');
  await runNode(process.execPath, [corpusMetrics, '--root', setup.root, '--out', corpusProm], { encoding: 'utf8', env });
  return {
    html,
    reportRow: html.split('\n').find((line) => line.startsWith(`<tr><td>${setup.manifest.rowId}</td>`)),
    rowMetrics: await readFile(rowProm, 'utf8'),
    corpusMetrics: await readFile(corpusProm, 'utf8'),
  };
}

function receiptSample(prom, receipt) {
  return prom.split('\n').filter((line) =>
    line.startsWith('openclaw_proofs_k6_receipt_status{') && line.includes(`receipt_name="${receipt}"`));
}

test('the run report and both metrics exporters never show unbound trace receipts as complete or present', async (t) => {
  for (const [label, mutate, owed] of [
    ['trace JSON deleted', (setup) => rm(path.join(setup.candidateDir, TRACE_JSON)), ['tempo-trace-json']],
    ['correlation receipt replaced by one naming another trace', (setup) =>
      writeFile(path.join(setup.candidateDir, CORRELATION_JSON), correlationBody(OTHER_TRACE_ID, TRACE_JSON)),
    ['continuation-trace-correlation']],
  ]) {
    await t.test(label, async () => {
      const setup = await candidateFixture({ observability: OBSERVABILITY.complete, receipts: BOUND_RECEIPTS });
      try {
        const written = await writeEnvelope(setup);
        assert.equal(written.ok, true, written.stderr);
        await mutate(setup);
        const seen = await reportAndMetrics(setup);
        // The report: the run, not its stale envelope, and review-pending.
        assert.ok(seen.reportRow, seen.html);
        assert.match(seen.reportRow, /<td>review-pending<\/td>/);
        assert.match(seen.html, /review-pending: 1/);
        for (const receipt of owed) assert.match(seen.reportRow, new RegExp(`${receipt}: missing`));
        // Both exporters: the owed receipt is missing, never present.
        for (const [where, prom] of [['row metrics', seen.rowMetrics], ['corpus metrics', seen.corpusMetrics]]) {
          for (const receipt of owed) {
            const samples = receiptSample(prom, receipt);
            assert.ok(samples.length > 0, `${where}: no ${receipt} sample\n${prom}`);
            for (const sample of samples) assert.match(sample, /receipt_status="missing"\} 0$/, `${where}: ${sample}`);
          }
        }
        assert.match(seen.rowMetrics, /failure_class="missing-receipt"/);
      } finally {
        await setup.cleanup();
      }
    });
  }
  await t.test('positive control: bound receipts read as complete and present', async () => {
    const setup = await candidateFixture({ observability: OBSERVABILITY.complete, receipts: BOUND_RECEIPTS });
    try {
      const written = await writeEnvelope(setup);
      assert.equal(written.ok, true, written.stderr);
      const seen = await reportAndMetrics(setup);
      assert.match(seen.reportRow, /<td>ready-for-human-review<\/td>/);
      assert.match(seen.html, /review-pending: 0/);
      for (const receipt of ['tempo-trace-json', 'continuation-trace-correlation']) {
        const samples = receiptSample(seen.rowMetrics, receipt);
        assert.ok(samples.length > 0, seen.rowMetrics);
        for (const sample of samples) assert.match(sample, /receipt_status="present"\} 1$/, sample);
      }
      assert.match(seen.rowMetrics, /failure_class="none"/);
    } finally {
      await setup.cleanup();
    }
  });
});

test('sibling path: a declared-trace row with no continuation surface owes its trace JSON on disk, not a correlation receipt', async (t) => {
  const manifest = readOnlyManifest();
  manifest.liveRunSafety.requiredReceipts = ['config-read', 'tempo-trace-json'];
  const observability = { traceStatus: 'present', traceId, tempoTraceJson: TRACE_JSON, correlationReceipt: null };
  for (const [label, receipts] of [
    ['trace JSON missing', {}],
    ['trace JSON for another trace', { [TRACE_JSON]: traceJsonBody(OTHER_TRACE_ID) }],
  ]) {
    await t.test(label, async () => {
      const setup = await candidateFixture({ manifest: structuredClone(manifest), observability, receipts });
      try {
        await assertWriterRefuses(setup, ['tempo-trace-json'], label);
        await assertReviewDebtOwes(setup.root, ['tempo-trace-json'], label);
      } finally {
        await setup.cleanup();
      }
    });
  }
  await t.test('positive control: its bound trace JSON completes review', async () => {
    const setup = await candidateFixture({
      manifest: structuredClone(manifest),
      observability,
      receipts: { [TRACE_JSON]: BOUND_RECEIPTS[TRACE_JSON] },
    });
    try {
      const written = await writeEnvelope(setup);
      assert.equal(written.ok, true, written.stderr);
      assert.equal(written.envelope.review.complete, true);
      assert.equal(written.envelope.observability.correlationReceiptPresent, false);
    } finally {
      await setup.cleanup();
    }
  });
  await t.test('positive control: an upper-case evidence trace ID binds the lower-cased JSON fetch-tempo-trace writes', async () => {
    // run-proofs.sh keeps the evidence trace_id as emitted and names the file
    // from it; fetch-tempo-trace.mjs stores the ID lower-cased.
    const upper = 'ABCDEF0123456789ABCDEF0123456789';
    const name = `tempo-trace-${upper.slice(0, 12)}.json`;
    const setup = await candidateFixture({
      manifest: structuredClone(manifest),
      observability: { traceStatus: 'present', traceId: upper, tempoTraceJson: name, correlationReceipt: null },
      receipts: { [name]: traceJsonBody(upper.toLowerCase()) },
    });
    try {
      const written = await writeEnvelope(setup);
      assert.equal(written.ok, true, written.stderr);
      assert.equal(written.envelope.review.complete, true);
    } finally {
      await setup.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// R-CD-2: the signed authority holds the trace it withholds from the result
// ---------------------------------------------------------------------------

test('R-CD-2 completes review only when its signed authority holds the trace', async (t) => {
  const { candidateEnvelopeMatchesSiblings } = await import(contractUrl);
  const { SIGNING_KEY } = await import('./helpers/r-cd-2-authority-fixture.mjs');
  const { consumeRcd2Authority } = await import('../../lib/r-cd-2-authority-context.mjs');
  for (const [verdict, expected] of [
    // PASS binds the acquisition receipt, trace and topology into the receipt.
    ['PASS-candidate', true],
    // A PARTIAL resolved without any correlation receipt holds no trace.
    ['PARTIAL-candidate', false],
  ]) {
    await t.test(verdict, async () => {
      const fixture = await writeRcd2Bundle(repoRoot, { verdict });
      try {
        assert.equal(fixture.runResult.observability.traceId, null, 'R-CD-2 publishes no raw trace');
        // The authority itself is valid either way; only whether it holds the
        // trace differs, so that is what decides the envelope below.
        const authority = consumeRcd2Authority({ runDir: fixture.runDir, signingKey: SIGNING_KEY });
        assert.equal(authority.outcome, verdict);
        assert.deepEqual(authority.review.pendingReceipts, []);
        assert.equal(authority.traceHeld, expected);
        assert.equal(authority.review.complete, expected);
        assert.equal(candidateEnvelopeMatchesSiblings({
          envelope: fixture.envelope,
          manifest: fixture.manifest,
          metadata: fixture.metadata,
          runResult: fixture.runResult,
          runDir: fixture.runDir,
          signingKey: SIGNING_KEY,
        }), expected);
      } finally {
        await fixture.cleanup();
      }
    });
  }
});
