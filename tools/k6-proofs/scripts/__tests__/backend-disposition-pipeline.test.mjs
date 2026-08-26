import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import {
  buildTelemetryBackendStatusReceipt,
  classifyTelemetryBackendInteraction,
} from '../../lib/telemetry-backend-status.js';

const runNode = promisify(execFile);
const script = path.resolve('tools/k6-proofs/scripts/apply-telemetry-disposition.mjs');
const candidateSha = 'a'.repeat(40);
const requiredCompletenessKeys = [
  'totalBlocks',
  'completedJobs',
  'inspectedBytes',
  'tempoApiStatus',
];

function manifest(requiredFiles = [
  'EVIDENCE.md',
  'row-result.json',
  'k6-summary.json',
  'backend-status.json',
]) {
  return {
    schema: 'openclaw.k6.proof-row-manifest.v1',
    rowId: 'R-BACKEND-TEST',
    candidateSha,
    seat: 'cael',
    expectedReceipts: [
      { name: 'backend-completeness-receipt', required: true },
    ],
    telemetryContract: {
      schema: 'openclaw.k6.row-telemetry-contract.v1',
      enforcement: 'blocking',
      rebindable: false,
      productInstrumentationPrerequisite: false,
      rebindReceipts: ['backend-completeness-receipt'],
      backendUnavailable: {
        disposition: 'PARTIAL-candidate',
        treatZeroAsAbsence: false,
        requiredCompletenessKeys,
        rebindKeys: ['candidate_sha', 'row_id', 'seat', 'run_id'],
      },
      artifact: {
        schema: 'openclaw.k6.telemetry-backend-status.v1',
        requiredFiles,
      },
      verdictAuthority: { passScope: 'behavioral-only' },
    },
  };
}

function completeBackend(proofRunId) {
  return buildTelemetryBackendStatusReceipt({
    rowId: 'R-BACKEND-TEST',
    candidateSha,
    seat: 'cael',
    proofRunId,
    requiredCompletenessKeys,
    rebindKeys: ['candidate_sha', 'row_id', 'seat', 'run_id'],
    rebindValues: {
      candidate_sha: candidateSha,
      row_id: 'R-BACKEND-TEST',
      seat: 'cael',
      run_id: proofRunId,
    },
    interactions: [classifyTelemetryBackendInteraction({
      backend: 'tempo',
      operation: 'search',
      httpStatus: 200,
      responseJson: {
        metrics: {
          totalBlocks: 2,
          completedJobs: 1,
          totalJobs: 1,
          inspectedBytes: 2048,
        },
      },
      resultCount: 1,
      queryFingerprint: '1'.repeat(16),
      backendBaseUrlEnv: 'OPENCLAW_PROOFS_TEMPO_BASE_URL',
      requiredCompletenessKeys,
    })],
  });
}

async function fixture({ verdict = 'PASS-candidate', requiredFiles, backend = 'complete' } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'backend-pipeline-'));
  const runDir = path.join(root, 'unit-run');
  await mkdir(runDir);
  const manifestPath = path.join(root, 'manifest.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest(requiredFiles), null, 2)}\n`);
  await writeFile(path.join(runDir, 'runner-metadata.json'), `${JSON.stringify({
    row: 'R-BACKEND-TEST',
    candidateSha,
    seat: 'cael',
    docsRef: 'b'.repeat(40),
  })}\n`);
  await writeFile(path.join(runDir, 'run-result.json'), `${JSON.stringify({
    effectiveExitCode: 0,
    verdict,
    verdictSource: 'summary-file',
    candidateOnly: true,
    foldRequiresReview: true,
    observability: {
      traceStatus: 'not-required',
      traceId: null,
      tempoTraceJson: null,
      correlationReceipt: null,
    },
    review: { status: 'ready-for-human-review', pendingReceipts: [] },
  }, null, 2)}\n`);
  await writeFile(path.join(runDir, 'r-backend-test-summary.json'), '{"verdict":"PASS-candidate"}\n');
  if (backend === 'complete') {
    await writeFile(
      path.join(runDir, 'backend-status.json'),
      `${JSON.stringify(completeBackend(path.basename(runDir)), null, 2)}\n`,
    );
  }
  return { root, runDir, manifestPath };
}

async function apply(setup) {
  return runNode(process.execPath, [
    script,
    '--manifest', setup.manifestPath,
    '--run-dir', setup.runDir,
  ], { encoding: 'utf8' });
}

test('row-list result preserves PASS only with a complete backend and required files', async () => {
  const setup = await fixture();
  try {
    const applied = JSON.parse((await apply(setup)).stdout);
    assert.equal(applied.verdict, 'PASS-candidate');
    assert.equal(applied.backendDisposition, 'complete');
    const result = JSON.parse(await readFile(path.join(setup.runDir, 'run-result.json'), 'utf8'));
    assert.equal(result.verdict, 'PASS-candidate');
    assert.equal(result.telemetryRebind.status, 'proven');
    assert.equal(result.observability.backendStatus, 'backend-status.json');
    assert.deepEqual(
      JSON.parse(await readFile(path.join(setup.runDir, 'row-result.json'), 'utf8')),
      result,
    );
    assert.match(await readFile(path.join(setup.runDir, 'EVIDENCE.md'), 'utf8'), /Backend complete: yes/);
  } finally {
    await rm(setup.root, { recursive: true, force: true });
  }
});

test('absent backend status becomes unknown and withholds PASS', async () => {
  const setup = await fixture({ backend: 'absent' });
  try {
    await apply(setup);
    const result = JSON.parse(await readFile(path.join(setup.runDir, 'run-result.json'), 'utf8'));
    assert.equal(result.verdict, 'PARTIAL-candidate');
    assert.equal(result.failureClass, 'backend-disposition');
    assert.equal(result.observability.backendDisposition, 'unknown');
    assert.equal(result.observability.backendComplete, false);
    assert.ok(result.review.pendingReceipts.includes('backend-status'));
  } finally {
    await rm(setup.root, { recursive: true, force: true });
  }
});

test('missing declared telemetry artifacts withhold PASS', async () => {
  const setup = await fixture({
    requiredFiles: [
      'EVIDENCE.md',
      'row-result.json',
      'k6-summary.json',
      'backend-status.json',
      'missing-receipt.json',
    ],
  });
  try {
    await apply(setup);
    const result = JSON.parse(await readFile(path.join(setup.runDir, 'run-result.json'), 'utf8'));
    assert.equal(result.verdict, 'PARTIAL-candidate');
    assert.equal(result.failureClass, 'missing-telemetry-artifact');
    assert.deepEqual(result.telemetryRebind.missingRequiredArtifacts, ['missing-receipt.json']);
  } finally {
    await rm(setup.root, { recursive: true, force: true });
  }
});

test('backend policy never promotes an explicit non-PASS verdict', async () => {
  const setup = await fixture({ verdict: 'FAIL-candidate', backend: 'absent' });
  try {
    await apply(setup);
    const result = JSON.parse(await readFile(path.join(setup.runDir, 'run-result.json'), 'utf8'));
    assert.equal(result.verdict, 'FAIL-candidate');
    assert.equal(result.verdictSource, 'summary-file');
    assert.equal(result.telemetryRebind.passBlockers.backend, true);
  } finally {
    await rm(setup.root, { recursive: true, force: true });
  }
});

test('row-list runner applies backend disposition before candidate envelope validation', async () => {
  const source = await readFile(
    path.resolve('tools/k6-proofs/scripts/run-proofs.sh'),
    'utf8',
  );
  const resultWrite = source.lastIndexOf('> "$RUN_DIR/run-result.json"');
  const applyPolicy = source.lastIndexOf('TELEMETRY_DISPOSITION_APPLIER');
  const candidateEnvelope = source.lastIndexOf('CANDIDATE_RESULT_VALIDATOR');
  assert.ok(resultWrite > 0 && applyPolicy > resultWrite &&
    candidateEnvelope > applyPolicy);
  assert.match(source, /-name 'backend-status\.json'/);
  assert.match(source, /--backend-status "\$RUN_DIR\/backend-status\.json"/);
  assert.match(source, /BACKEND DISPOSITION/);
  assert.match(source, /telemetry-disposition-error/);
});
