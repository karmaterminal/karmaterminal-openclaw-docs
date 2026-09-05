import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateEnvelopeMatchesSiblings } from '../candidate-run-result-contract.mjs';
import { buildArtifactAuthority } from '../../lib/artifact-authority.mjs';

const script = path.resolve('tools/k6-proofs/scripts/summarize-review-debt.mjs');
const runNode = promisify(execFile);
const docsRef = 'b'.repeat(40);
const repository = 'karmaterminal/karmaterminal-openclaw-docs';
const scenarioSource = 'export default function scenario() { return true; }\n';
const digest = (value) => createHash('sha256').update(value).digest('hex');
const artifactKey = 'review-debt-artifact-key';

function envelopeArtifacts({ files = [], tempoTraceJson = null, correlationReceipt = null } = {}) {
  return {
    manifest: 'row-manifest.json',
    scenario: 'row-scenario.js',
    runnerMetadata: 'runner-metadata.json',
    runResult: 'run-result.json',
    files,
    tempoTraceJson,
    correlationReceipt,
  };
}

async function writeResult(root, row, body) {
  const dir = path.join(root, 'candidate-sha', row, 'seat', `run-${row}`);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'run-result.json'), `${JSON.stringify(body, null, 2)}\n`);
}

async function writeCandidateResult(root, row, body) {
  const dir = path.join(root, 'candidate-sha', row, 'seat', `run-${row}`);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'candidate-run-result.json'), `${JSON.stringify(body, null, 2)}\n`);
}

async function writeValidatedEnvelopeFixture(root, row) {
  const dir = path.join(root, 'candidate-sha', row, 'seat', `run-${row}`);
  const sha = 'a'.repeat(40);
  await mkdir(dir, { recursive: true });
  const manifestBody = `${JSON.stringify({
    schema: 'openclaw.k6.proof-row-manifest.v1', rowId: row, candidateSha: sha,
    scenario: { name: 'r-cw-1' }, review: { candidateOnly: true, foldRequiresReview: true },
  })}\n`;
  // The runner copies the fired manifest/scenario bytes next to the receipt and
  // records their digests; a sidecar without that identity cannot suppress its
  // raw sibling (#496).
  await writeFile(path.join(dir, 'row-manifest.json'), manifestBody);
  await writeFile(path.join(dir, 'row-scenario.js'), scenarioSource);
  const identity = {
    docsRef,
    repository,
    manifestPath: 'tools/k6-proofs/manifests/r-cw-1.json',
    manifestSha256: digest(manifestBody),
    scenarioPath: 'tools/k6-proofs/scenarios/r-cw-1.js',
    scenarioSha256: digest(scenarioSource),
  };
  const metadata = { row, candidateSha: sha, seat: 'seat', scenario: 'r-cw-1', ...identity };
  const runResult = {
    candidateOnly: true, foldRequiresReview: true, effectiveExitCode: 0, verdict: 'PASS-candidate', verdictSource: 'k6-summary',
    observability: { traceStatus: 'present', traceId: 'safe-trace-id', correlationReceipt: 'continuation-correlation.json' },
    review: { status: 'ready-for-human-review', pendingReceipts: [] },
  };
  const envelope = {
    schema: 'openclaw.k6.candidate-run-result.v1', candidateOnly: true, foldRequiresReview: true, canonicalFoldForbidden: true,
    candidate: { sha, docsRef },
    harness: { ...identity, manifestArtifact: 'row-manifest.json', scenarioArtifact: 'row-scenario.js' },
    run: { id: `run-${row}`, rowId: row, seat: 'seat', scenario: 'r-cw-1', executionKind: 'row-list-runner' },
    result: { outcome: 'PASS-candidate', outcomeSource: 'k6-summary', effectiveExitCode: 0, behaviorProof: false },
    observability: { traceStatus: 'present', traceCaptured: true, correlationReceiptPresent: true },
    review: { status: 'ready-for-human-review', pendingReceipts: [], complete: true },
    artifacts: envelopeArtifacts({
      files: ['row-manifest.json', 'row-scenario.js', 'runner-metadata.json',
        'run-result.json', 'continuation-correlation.json'],
      correlationReceipt: 'continuation-correlation.json',
    }),
  };
  await writeFile(path.join(dir, 'runner-metadata.json'), `${JSON.stringify(metadata)}\n`);
  await writeResult(root, row, runResult);
  await writeFile(path.join(dir, 'continuation-correlation.json'), `${JSON.stringify({
    schema: 'openclaw.k6.continuation-trace-correlation.v1',
  })}\n`);
  envelope.artifactAuthority = buildArtifactAuthority({
    directory: dir,
    names: envelope.artifacts.files,
    signingKey: artifactKey,
  });
  await writeCandidateResult(root, row, envelope);
  return { dir, identity, manifest: JSON.parse(manifestBody), metadata, runResult, envelope };
}

test('summarizes trace-missing debt as unfetchable when no trace id exists', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'review-debt-'));
  try {
    await writeResult(root, 'R-CD-2', {
      observability: { traceStatus: 'missing', traceId: null, tempoTraceJson: null },
      review: { status: 'review-pending', pendingReceipts: ['tempo-trace-json'] },
    });
    await writeResult(root, 'R-CD-4', {
      observability: { traceStatus: 'present', traceId: 'abcdef0123456789', tempoTraceJson: null },
      review: { status: 'review-pending', pendingReceipts: ['tempo-trace-json'] },
    });
    await writeResult(root, 'R-CW-1', {
      observability: { traceStatus: 'unknown', traceId: null, tempoTraceJson: null },
      review: { status: 'ready-for-human-review', pendingReceipts: [] },
    });

    const run = await runNode(process.execPath, [script, '--run-root', root, '--json'], { encoding: 'utf8' });
    const summary = JSON.parse(run.stdout);
    assert.equal(summary.totalRows, 3);
    assert.equal(summary.pendingRows, 2);
    assert.equal(summary.byClass['tempo-trace-unfetchable'], 1);
    assert.equal(summary.byClass['tempo-trace-fetchable'], 1);
    const unfetchable = summary.pending.find((row) => row.rowId === 'R-CD-2').pending[0];
    assert.equal(unfetchable.fetchable, false);
    assert.match(unfetchable.action, /rerun with trace emission/);
    const fetchable = summary.pending.find((row) => row.rowId === 'R-CD-4').pending[0];
    assert.equal(fetchable.fetchable, true);
    assert.equal(fetchable.traceId, 'abcdef0123456789');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('renders human-readable review debt table', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'review-debt-text-'));
  try {
    await writeResult(root, 'R-OBS-STATUS', {
      observability: { traceStatus: 'missing', traceId: null, tempoTraceJson: null },
      review: { status: 'review-pending', pendingReceipts: ['tempo-trace-json'] },
    });
    const run = await runNode(process.execPath, [script, '--run-root', root], { encoding: 'utf8' });
    assert.match(run.stdout, /review-pending rows: 1/);
    assert.match(run.stdout, /tempo-trace-unfetchable: 1/);
    assert.match(run.stdout, /R-OBS-STATUS/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('consumes the versioned candidate envelope without double-counting its legacy run result', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'review-debt-envelope-'));
  try {
    const fixture = await writeValidatedEnvelopeFixture(root, 'R-CW-1');
    assert.equal(candidateEnvelopeMatchesSiblings({
      envelope: fixture.envelope,
      manifest: fixture.manifest,
      metadata: fixture.metadata,
      runResult: fixture.runResult,
      runDir: fixture.dir,
      signingKey: artifactKey,
    }), true);
    const run = await runNode(process.execPath, [script, '--run-root', root, '--json'], {
      encoding: 'utf8',
      env: { ...process.env, OPENCLAW_ARTIFACT_MANIFEST_KEY: artifactKey },
    });
    const summary = JSON.parse(run.stdout);
    assert.equal(summary.totalRows, 1);
    assert.equal(summary.pendingRows, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('never lets malformed, mismatched, incomplete, or hand-written envelopes suppress raw review debt', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'review-debt-envelope-reject-'));
  try {
    const cases = [
      ['R-CW-1', '{not json'],
      ['R-CW-2', JSON.stringify({ schema: 'openclaw.k6.candidate-run-result.v1', candidateOnly: true, foldRequiresReview: true, canonicalFoldForbidden: true, candidate: { sha: 'f'.repeat(40), docsRef: 'b'.repeat(40) } })],
      ['R-CW-3', JSON.stringify({ schema: 'openclaw.k6.candidate-run-result.v1', candidateOnly: true, foldRequiresReview: true, canonicalFoldForbidden: true, review: { status: 'review-pending', pendingReceipts: ['tempo-trace-json'], complete: false } })],
      ['R-CW-4', JSON.stringify({ schema: 'openclaw.k6.candidate-run-result.v1', candidateOnly: true, foldRequiresReview: true, canonicalFoldForbidden: true, result: { behaviorProof: true } })],
    ];
    for (const [row, sidecar] of cases) {
      await writeResult(root, row, { candidateOnly: true, foldRequiresReview: true, review: { status: 'review-pending', pendingReceipts: ['tempo-trace-json'] } });
      const dir = path.join(root, 'candidate-sha', row, 'seat', `run-${row}`);
      await writeFile(path.join(dir, 'candidate-run-result.json'), `${sidecar}\n`);
    }
    const run = await runNode(process.execPath, [script, '--run-root', root, '--json'], { encoding: 'utf8' });
    const summary = JSON.parse(run.stdout);
    assert.equal(summary.totalRows, 4);
    assert.equal(summary.pendingRows, 4);
    assert.equal(summary.byClass['tempo-trace-unfetchable'], 4);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('falls back to raw review debt while the raw sibling remains review-pending', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'review-debt-envelope-observability-forgery-'));
  try {
    const row = 'R-CW-2';
    const fixture = await writeValidatedEnvelopeFixture(root, row);
    const { identity } = fixture;
    const dir = path.join(root, 'candidate-sha', row, 'seat', `run-${row}`);
    await writeResult(root, row, {
      candidateOnly: true, foldRequiresReview: true, effectiveExitCode: 0, verdict: 'PASS-candidate', verdictSource: 'k6-summary',
      observability: { traceStatus: 'missing', traceId: null, correlationReceipt: null },
      review: { status: 'review-pending', pendingReceipts: ['tempo-trace-json'] },
    });
    await writeFile(path.join(dir, 'candidate-run-result.json'), `${JSON.stringify({
      schema: 'openclaw.k6.candidate-run-result.v1', candidateOnly: true, foldRequiresReview: true, canonicalFoldForbidden: true,
      candidate: { sha: 'a'.repeat(40), docsRef },
      harness: { ...identity, manifestArtifact: 'row-manifest.json', scenarioArtifact: 'row-scenario.js' },
      run: { id: `run-${row}`, rowId: row, seat: 'seat', scenario: 'r-cw-1', executionKind: 'row-list-runner' },
      result: { outcome: 'PASS-candidate', outcomeSource: 'k6-summary', effectiveExitCode: 0, behaviorProof: false },
      observability: { traceStatus: 'missing', traceCaptured: false, correlationReceiptPresent: false },
      review: { status: 'ready-for-human-review', pendingReceipts: [], complete: true },
      artifacts: envelopeArtifacts(),
    }, null, 2)}\n`);
    const run = await runNode(process.execPath, [script, '--run-root', root, '--json'], { encoding: 'utf8' });
    const summary = JSON.parse(run.stdout);
    assert.equal(summary.totalRows, 1);
    assert.equal(summary.pendingRows, 1);
    assert.equal(summary.byClass['tempo-trace-unfetchable'], 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
