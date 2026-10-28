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
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { signedSeatReadinessFixture } from './helpers/seat-readiness-fixture.mjs';
import { writeRcd2Bundle } from './helpers/r-cd-2-authority-fixture.mjs';

const runNode = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..');
const manifestsDir = path.join(repoRoot, 'tools/k6-proofs/manifests');
const checker = path.join(repoRoot, 'tools/k6-proofs/scripts/check-proof-row-manifests.mjs');
const writer = path.join(repoRoot, 'tools/k6-proofs/scripts/validate-candidate-run-result.mjs');
const reviewDebt = path.join(repoRoot, 'tools/k6-proofs/scripts/summarize-review-debt.mjs');
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

const OBSERVABILITY = {
  // The exact cael envelope source: no trace, no correlation, nothing pending.
  none: { traceStatus: 'unknown', traceId: null, tempoTraceJson: null, correlationReceipt: null },
  traceOnly: { traceStatus: 'present', traceId, tempoTraceJson: `tempo-trace-${traceId.slice(0, 12)}.json`, correlationReceipt: null },
  correlationOnly: { traceStatus: 'missing', traceId: null, tempoTraceJson: null, correlationReceipt: 'continuation-trace-correlation.json' },
  complete: {
    traceStatus: 'present',
    traceId,
    tempoTraceJson: `tempo-trace-${traceId.slice(0, 12)}.json`,
    correlationReceipt: 'continuation-trace-correlation.json',
  },
};

async function candidateFixture({ manifest = continuationManifest(), observability }) {
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
  for (const [label, observability, owed] of [
    ['no trace, no correlation (the cael envelope)', OBSERVABILITY.none, ['tempo-trace-json', 'continuation-trace-correlation']],
    ['trace without its correlation receipt', OBSERVABILITY.traceOnly, ['continuation-trace-correlation']],
    ['correlation receipt without a trace', OBSERVABILITY.correlationOnly, ['tempo-trace-json']],
  ]) {
    await t.test(label, async () => {
      const setup = await candidateFixture({ observability });
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
  const setup = await candidateFixture({ observability: OBSERVABILITY.complete });
  try {
    const written = await writeEnvelope(setup);
    assert.equal(written.ok, true, written.stderr);
    assert.equal(written.envelope.review.complete, true);
    assert.deepEqual(written.envelope.review.pendingReceipts, []);
    assert.equal(written.envelope.observability.traceCaptured, true);
    assert.equal(written.envelope.observability.correlationReceiptPresent, true);
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
  const setup = await candidateFixture({ observability: OBSERVABILITY.complete });
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
// R-CD-2: the signed authority holds the trace it withholds from the result
// ---------------------------------------------------------------------------

test('R-CD-2 completes review only when its signed authority holds the trace', async (t) => {
  const { candidateEnvelopeMatchesSiblings } = await import(contractUrl);
  const { SIGNING_KEY } = await import('./helpers/r-cd-2-authority-fixture.mjs');
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
