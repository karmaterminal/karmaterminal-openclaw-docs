import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

const script = path.resolve('tools/k6-proofs/scripts/render-run-report.mjs');
const docsRef = 'a'.repeat(40);
const repository = 'karmaterminal/karmaterminal-openclaw-docs';
const scenarioSource = 'export default function scenario() { return true; }\n';
const digest = (value) => createHash('sha256').update(value).digest('hex');

/**
 * Write the copied manifest/scenario sources the runner captures alongside a
 * live row and return the matching immutable harness identity (#496). Without
 * it a sidecar envelope can never suppress its raw sibling.
 */
async function writeHarnessIdentity(runDir, { manifestBody, rowFile }) {
  await writeFile(path.join(runDir, 'row-manifest.json'), manifestBody);
  await writeFile(path.join(runDir, 'row-scenario.js'), scenarioSource);
  return {
    docsRef,
    repository,
    manifestPath: `tools/k6-proofs/manifests/${rowFile}.json`,
    manifestSha256: digest(manifestBody),
    scenarioPath: `tools/k6-proofs/scenarios/${rowFile}.js`,
    scenarioSha256: digest(scenarioSource),
  };
}

function envelopeHarness(identity) {
  return { ...identity, manifestArtifact: 'row-manifest.json', scenarioArtifact: 'row-scenario.js' };
}

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

test('rejects unsigned R-CD-2 instead of rendering a downgraded report', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'k6-proof-report-'));
  try {
    const runDir = path.join(root, 'b40e59', 'R-CD-2', 'ronan', 'k6-run-1');
    await mkdir(runDir, { recursive: true });
    await writeFile(path.join(runDir, 'row-manifest.json'), `${JSON.stringify({
      rowId: 'R-CD-2',
      scenario: { file: 'r-cd-2-silent-wake.js' },
      transport: 'websocket',
      toolSurface: 'typed-tool',
      liveRunSafety: { requiredReceipts: ['dispatch-accepted', 'trace-id'] },
    }, null, 2)}\n`);
    await writeFile(path.join(runDir, 'runner-metadata.json'), `${JSON.stringify({
      row: 'R-CD-2',
      scenario: 'r-cd-2-silent-wake.js',
      candidateSha: 'b40e59f08c7a8997e50a5c8a24b00bc68f653882',
      seat: 'ronan',
      // Deliberately present in source artifact; report must not expose it.
      sessionKey: 'agent:main:discord:channel:secret',
    }, null, 2)}\n`);
    await writeFile(path.join(runDir, 'run-result.json'), `${JSON.stringify({
      k6ExitCode: 0,
      candidateOnly: true,
      foldRequiresReview: true,
      observability: { traceStatus: 'missing' },
      review: { status: 'review-pending', pendingReceipts: ['tempo-trace-json'] },
    }, null, 2)}\n`);
    await writeFile(path.join(runDir, 'r-cd-2-summary.json'), `${JSON.stringify({
      verdict: 'PASS-candidate',
      metrics: { failures: 0, duration_ms: { avg: 1234 }, checks: { rate: 1 } },
    }, null, 2)}\n`);
    await writeFile(path.join(runDir, 'evidence.jsonl'), `${JSON.stringify({ tool_accepted: true, channel_message_observed: false })}\n`);

    const out = path.join(root, 'report.html');
    const run = spawnSync(process.execPath, [script, '--root', root, '--out', out], { encoding: 'utf8' });
    assert.notEqual(run.status, 0);
    await assert.rejects(readFile(out, 'utf8'), { code: 'ENOENT' });
    assert.doesNotMatch(run.stdout, /UNVERIFIED-infrastructure|review-pending/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('uses candidate-run-result.v1 as the unambiguous review input when present', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'k6-proof-envelope-report-'));
  try {
    const runDir = path.join(root, 'candidate', 'R-CW-1', 'cael', 'k6-run-1');
    await mkdir(runDir, { recursive: true });
    const sha = 'b40e59f08c7a8997e50a5c8a24b00bc68f653882';
    const manifestBody = `${JSON.stringify({
      schema: 'openclaw.k6.proof-row-manifest.v1', rowId: 'R-CW-1', candidateSha: sha,
      scenario: { name: 'r-cw-1' }, review: { candidateOnly: true, foldRequiresReview: true },
    })}\n`;
    const identity = await writeHarnessIdentity(runDir, { manifestBody, rowFile: 'r-cw-1' });
    await writeFile(path.join(runDir, 'runner-metadata.json'), `${JSON.stringify({ row: 'R-CW-1', candidateSha: sha, seat: 'cael', scenario: 'r-cw-1', ...identity })}\n`);
    await writeFile(path.join(runDir, 'run-result.json'), `${JSON.stringify({
      candidateOnly: true, foldRequiresReview: true, effectiveExitCode: 0, verdict: 'PASS-candidate', verdictSource: 'k6-summary',
      observability: { traceStatus: 'present', traceId: 'safe-trace-id', correlationReceipt: 'continuation-correlation.json' },
      review: { status: 'ready-for-human-review', pendingReceipts: [] },
    })}\n`);
    await writeFile(path.join(runDir, 'r-cw-1-summary.json'), `${JSON.stringify({
      metrics: { duration_ms: { avg: 4321 } },
    })}\n`);
    await writeFile(path.join(runDir, 'candidate-run-result.json'), `${JSON.stringify({
      schema: 'openclaw.k6.candidate-run-result.v1',
      candidateOnly: true, foldRequiresReview: true, canonicalFoldForbidden: true,
      candidate: { sha, docsRef },
      harness: envelopeHarness(identity),
      run: { id: 'k6-run-1', rowId: 'R-CW-1', seat: 'cael', scenario: 'r-cw-1', executionKind: 'row-list-runner' },
      result: { outcome: 'PASS-candidate', outcomeSource: 'k6-summary', effectiveExitCode: 0, behaviorProof: false },
      observability: { traceStatus: 'present', traceCaptured: true, correlationReceiptPresent: true },
      review: { status: 'ready-for-human-review', pendingReceipts: [], complete: true },
      artifacts: envelopeArtifacts({
        files: ['row-manifest.json', 'row-scenario.js', 'runner-metadata.json', 'run-result.json', 'candidate-run-result.json', 'r-cw-1-summary.json'],
        correlationReceipt: 'continuation-correlation.json',
      }),
    }, null, 2)}\n`);
    const out = path.join(root, 'report.html');
    const run = spawnSync(process.execPath, [script, '--root', root, '--out', out], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    const html = await readFile(out, 'utf8');
    assert.match(html, /R-CW-1/);
    assert.match(html, /ready-for-human-review/);
    assert.doesNotMatch(html, /<td>review-pending<\/td>/);
    assert.match(html, /<td>n\/a ms<\/td>/);
    assert.doesNotMatch(html, /4321 ms/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('falls back to the sibling raw result when a sidecar is malformed or unsafe', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'k6-proof-envelope-fallback-'));
  try {
    const runDir = path.join(root, 'candidate', 'R-CW-2', 'cael', 'k6-run-2');
    await mkdir(runDir, { recursive: true });
    await writeFile(path.join(runDir, 'run-result.json'), `${JSON.stringify({
      k6ExitCode: 0, candidateOnly: true, foldRequiresReview: true,
      review: { status: 'review-pending', pendingReceipts: ['tempo-trace-json'] },
      observability: { traceStatus: 'missing' },
    })}\n`);
    await writeFile(path.join(runDir, 'candidate-run-result.json'), `${JSON.stringify({
      schema: 'openclaw.k6.candidate-run-result.v1', candidateOnly: true, foldRequiresReview: true,
      canonicalFoldForbidden: true, result: { behaviorProof: true }, review: { status: 'ready-for-human-review', pendingReceipts: [], complete: true },
    })}\n`);
    const out = path.join(root, 'report.html');
    const run = spawnSync(process.execPath, [script, '--root', root, '--out', out], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    const html = await readFile(out, 'utf8');
    assert.match(html, /review-pending/);
    assert.match(html, /tempo-trace-json: missing/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('falls back to raw trace debt while the raw sibling remains review-pending', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'k6-proof-envelope-observability-forgery-'));
  try {
    const runDir = path.join(root, 'candidate', 'R-CW-2', 'cael', 'k6-run-2');
    const sha = 'b40e59f08c7a8997e50a5c8a24b00bc68f653882';
    await mkdir(runDir, { recursive: true });
    const manifestBody = `${JSON.stringify({
      schema: 'openclaw.k6.proof-row-manifest.v1', rowId: 'R-CW-2', candidateSha: sha,
      scenario: { name: 'r-cw-2' }, review: { candidateOnly: true, foldRequiresReview: true },
    })}\n`;
    const identity = await writeHarnessIdentity(runDir, { manifestBody, rowFile: 'r-cw-2' });
    await writeFile(path.join(runDir, 'runner-metadata.json'), `${JSON.stringify({ row: 'R-CW-2', candidateSha: sha, seat: 'cael', scenario: 'r-cw-2', ...identity })}\n`);
    await writeFile(path.join(runDir, 'run-result.json'), `${JSON.stringify({
      candidateOnly: true, foldRequiresReview: true, effectiveExitCode: 0, verdict: 'PASS-candidate', verdictSource: 'k6-summary',
      observability: { traceStatus: 'missing', traceId: null, correlationReceipt: null },
      review: { status: 'review-pending', pendingReceipts: ['tempo-trace-json'] },
    })}\n`);
    await writeFile(path.join(runDir, 'candidate-run-result.json'), `${JSON.stringify({
      schema: 'openclaw.k6.candidate-run-result.v1', candidateOnly: true, foldRequiresReview: true, canonicalFoldForbidden: true,
      candidate: { sha, docsRef },
      harness: envelopeHarness(identity),
      run: { id: 'k6-run-2', rowId: 'R-CW-2', seat: 'cael', scenario: 'r-cw-2', executionKind: 'row-list-runner' },
      result: { outcome: 'PASS-candidate', outcomeSource: 'k6-summary', effectiveExitCode: 0, behaviorProof: false },
      observability: { traceStatus: 'missing', traceCaptured: false, correlationReceiptPresent: false },
      review: { status: 'ready-for-human-review', pendingReceipts: [], complete: true },
      artifacts: envelopeArtifacts(),
    })}\n`);
    const out = path.join(root, 'report.html');
    const run = spawnSync(process.execPath, [script, '--root', root, '--out', out], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    const html = await readFile(out, 'utf8');
    assert.match(html, /trace-missing: 1/);
    assert.match(html, /review-pending/);
    assert.match(html, /tempo-trace-json: missing/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
