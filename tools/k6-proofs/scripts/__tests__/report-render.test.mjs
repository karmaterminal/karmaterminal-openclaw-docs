import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

const script = path.resolve('tools/k6-proofs/scripts/render-run-report.mjs');

test('renders public-safe HTML report from row-list runner artifacts', async () => {
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
    assert.equal(run.status, 0, run.stderr);
    const html = await readFile(out, 'utf8');
    assert.match(html, /Project 81 k6 PROOFS report/);
    assert.match(html, /R-CD-2/);
    // A k6 summary cannot promote R-CD-2 without the signed row authority.
    assert.match(html, /PARTIAL-candidate/);
    assert.doesNotMatch(html, /<td>PASS-candidate<\/td>/);
    assert.match(html, /trace-id: missing|tempo-trace-json: missing/);
    assert.doesNotMatch(html, /agent:main|secret/);
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
    await writeFile(path.join(runDir, 'row-manifest.json'), `${JSON.stringify({
      schema: 'openclaw.k6.proof-row-manifest.v1', rowId: 'R-CW-1', candidateSha: sha,
      scenario: { name: 'r-cw-1' }, review: { candidateOnly: true, foldRequiresReview: true },
    })}\n`);
    await writeFile(path.join(runDir, 'runner-metadata.json'), `${JSON.stringify({ row: 'R-CW-1', candidateSha: sha, seat: 'cael', scenario: 'r-cw-1' })}\n`);
    await writeFile(path.join(runDir, 'run-result.json'), `${JSON.stringify({
      candidateOnly: true, foldRequiresReview: true, effectiveExitCode: 0, verdict: 'PASS-candidate', verdictSource: 'k6-summary',
      observability: { traceStatus: 'present', traceId: 'safe-trace-id', correlationReceipt: 'continuation-correlation.json' },
      review: { status: 'ready-for-human-review', pendingReceipts: [] },
    })}\n`);
    await writeFile(path.join(runDir, 'candidate-run-result.json'), `${JSON.stringify({
      schema: 'openclaw.k6.candidate-run-result.v1',
      candidateOnly: true, foldRequiresReview: true, canonicalFoldForbidden: true,
      candidate: { sha, docsRef: 'a'.repeat(40) },
      run: { id: 'k6-run-1', rowId: 'R-CW-1', seat: 'cael', scenario: 'r-cw-1' },
      result: { outcome: 'PASS-candidate', outcomeSource: 'k6-summary', effectiveExitCode: 0, behaviorProof: false },
      observability: { traceStatus: 'present', traceCaptured: true, correlationReceiptPresent: true },
      review: { status: 'ready-for-human-review', pendingReceipts: [], complete: true },
    }, null, 2)}\n`);
    const out = path.join(root, 'report.html');
    const run = spawnSync(process.execPath, [script, '--root', root, '--out', out], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    const html = await readFile(out, 'utf8');
    assert.match(html, /R-CW-1/);
    assert.match(html, /ready-for-human-review/);
    assert.doesNotMatch(html, /<td>review-pending<\/td>/);
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

test('falls back to raw trace debt when an identity-valid sidecar forges observability', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'k6-proof-envelope-observability-forgery-'));
  try {
    const runDir = path.join(root, 'candidate', 'R-CD-2', 'cael', 'k6-run-2');
    const sha = 'b40e59f08c7a8997e50a5c8a24b00bc68f653882';
    await mkdir(runDir, { recursive: true });
    await writeFile(path.join(runDir, 'row-manifest.json'), `${JSON.stringify({
      schema: 'openclaw.k6.proof-row-manifest.v1', rowId: 'R-CD-2', candidateSha: sha,
      scenario: { name: 'r-cd-2' }, review: { candidateOnly: true, foldRequiresReview: true },
    })}\n`);
    await writeFile(path.join(runDir, 'runner-metadata.json'), `${JSON.stringify({ row: 'R-CD-2', candidateSha: sha, seat: 'cael', scenario: 'r-cd-2' })}\n`);
    await writeFile(path.join(runDir, 'run-result.json'), `${JSON.stringify({
      candidateOnly: true, foldRequiresReview: true, effectiveExitCode: 0, verdict: 'PASS-candidate', verdictSource: 'k6-summary',
      observability: { traceStatus: 'missing', traceId: null, correlationReceipt: null },
      review: { status: 'review-pending', pendingReceipts: ['tempo-trace-json'] },
    })}\n`);
    await writeFile(path.join(runDir, 'candidate-run-result.json'), `${JSON.stringify({
      schema: 'openclaw.k6.candidate-run-result.v1', candidateOnly: true, foldRequiresReview: true, canonicalFoldForbidden: true,
      candidate: { sha, docsRef: 'a'.repeat(40) }, run: { id: 'k6-run-2', rowId: 'R-CD-2', seat: 'cael', scenario: 'r-cd-2' },
      result: { outcome: 'PASS-candidate', outcomeSource: 'k6-summary', effectiveExitCode: 0, behaviorProof: false },
      observability: { traceStatus: 'present', traceCaptured: true, correlationReceiptPresent: true },
      review: { status: 'ready-for-human-review', pendingReceipts: [], complete: true },
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
