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
const exactPartialReceipt = path.resolve(
  'tools/k6-proofs/scripts/__tests__/fixtures/run-32956764849-backend-status.json',
);
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

test('structural gateway event receipts satisfy the declared artifact without payload leakage', async () => {
  const setup = await fixture({
    requiredFiles: [
      'EVIDENCE.md',
      'row-result.json',
      'k6-summary.json',
      'gateway-events.ndjson',
      'backend-status.json',
    ],
  });
  try {
    await writeFile(path.join(setup.runDir, 'evidence.jsonl'), `${JSON.stringify({
      row: 'R-BACKEND-TEST',
      gatewayEventReceipts: [{
        ts: 1783882863334,
        kind: 'event',
        method: null,
        event: 'agent',
        ok: true,
        data: {
          sessionKey: 'agent:main:private',
          message: 'private prompt',
        },
      }],
    })}\n`);
    await apply(setup);
    const gatewayEvents = await readFile(
      path.join(setup.runDir, 'gateway-events.ndjson'),
      'utf8',
    );
    assert.deepEqual(JSON.parse(gatewayEvents.trim()), {
      ts: 1783882863334,
      kind: 'event',
      method: null,
      event: 'agent',
      ok: true,
    });
    assert.doesNotMatch(gatewayEvents, /sessionKey|private prompt/);
    const result = JSON.parse(await readFile(path.join(setup.runDir, 'run-result.json'), 'utf8'));
    assert.equal(result.verdict, 'PASS-candidate');
    assert.deepEqual(result.telemetryRebind.missingRequiredArtifacts, []);
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

test('backend disposition scenario emits one extractable public record with Loki counting in scope', async () => {
  const source = await readFile(
    path.resolve('tools/k6-proofs/scenarios/r-obs-backend-disposition.js'),
    'utf8',
  );
  const responseJsonStart = source.indexOf('function responseJson(response)');
  const responseJsonEnd = source.indexOf('\n}\n\nfunction lokiResultCount', responseJsonStart);
  const defaultFunction = source.indexOf('export default function ()');
  assert.ok(responseJsonStart >= 0 && responseJsonEnd > responseJsonStart);
  assert.ok(source.indexOf('function lokiResultCount', responseJsonEnd) < defaultFunction);
  assert.match(source, /console\.log\(`PUBLIC_EVIDENCE \$\{JSON\.stringify\(\{/);
  assert.match(source, /zeroResultAuthoritative: entry\.zeroResultAuthoritative/);
});

test('run 32956764849 complete partial receipt passes the disposition row without count authority', async () => {
  const backendStatus = JSON.parse(await readFile(exactPartialReceipt, 'utf8'));
  const root = await mkdtemp(path.join(os.tmpdir(), 'backend-disposition-verdict-'));
  const runDir = path.join(root, backendStatus.proofRunId);
  const manifestPath = path.join(root, 'manifest.json');
  const manifestValue = {
    schema: 'openclaw.k6.proof-row-manifest.v1',
    rowId: backendStatus.rowId,
    candidateSha: backendStatus.candidateSha,
    seat: backendStatus.seat,
    expectedReceipts: [
      { name: 'backend-completeness-receipt', required: true },
      { name: 'degraded-response-classified', required: true },
      { name: 'rebind-key-set-published', required: true },
      { name: 'slice-strategy-recorded', required: true },
    ],
    telemetryContract: {
      schema: 'openclaw.k6.row-telemetry-contract.v1',
      enforcement: 'blocking',
      rebindable: false,
      productInstrumentationPrerequisite: false,
      rebindReceipts: [
        'backend-completeness-receipt',
        'degraded-response-classified',
        'rebind-key-set-published',
        'slice-strategy-recorded',
      ],
      backendUnavailable: {
        disposition: 'PARTIAL-candidate',
        treatZeroAsAbsence: false,
        requiredCompletenessKeys: backendStatus.requiredCompletenessKeys,
        rebindKeys: backendStatus.rebind.declaredKeys,
      },
      artifact: {
        schema: backendStatus.schema,
        requiredFiles: ['EVIDENCE.md', 'row-result.json', 'backend-status.json'],
      },
      verdictAuthority: {
        passScope: 'backend-disposition-contract',
        backendDispositionContract: {
          requiredBackends: ['tempo', 'loki'],
          rowPassStatuses: ['complete', 'partial', 'capped'],
          requireNonAuthoritativeZero: true,
          requireCompleteRebind: true,
        },
      },
    },
  };
  const summary = {
    row: backendStatus.rowId,
    verdict: 'PASS-candidate',
    backendDisposition: backendStatus.status,
    backendComplete: backendStatus.complete,
    classificationControls: {
      complete: 'complete',
      partial: 'partial',
      unavailable: 'unavailable',
      capped: 'capped',
      unknown: 'unknown',
    },
    proof_receipts: Object.fromEntries(
      manifestValue.expectedReceipts.map(({ name }) => [name, true]),
    ),
  };

  try {
    await mkdir(runDir);
    await writeFile(manifestPath, `${JSON.stringify(manifestValue, null, 2)}\n`);
    await writeFile(
      path.join(runDir, 'runner-metadata.json'),
      `${JSON.stringify({
        row: backendStatus.rowId,
        candidateSha: backendStatus.candidateSha,
        seat: backendStatus.seat,
        docsRef: 'b'.repeat(40),
      })}\n`,
    );
    await writeFile(
      path.join(runDir, 'run-result.json'),
      `${JSON.stringify({
        effectiveExitCode: 0,
        verdict: 'PASS-candidate',
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
      }, null, 2)}\n`,
    );
    await writeFile(
      path.join(runDir, 'r-obs-backend-disposition-summary.json'),
      `${JSON.stringify(summary, null, 2)}\n`,
    );
    await writeFile(
      path.join(runDir, 'backend-status.json'),
      `${JSON.stringify(backendStatus, null, 2)}\n`,
    );

    const applied = JSON.parse((await apply({ manifestPath, runDir })).stdout);
    const result = JSON.parse(await readFile(path.join(runDir, 'run-result.json'), 'utf8'));
    assert.equal(applied.verdict, 'PASS-candidate');
    assert.equal(applied.backendDisposition, 'partial');
    assert.equal(result.verdict, 'PASS-candidate');
    assert.equal(result.observability.backendDisposition, 'partial');
    assert.equal(result.observability.backendComplete, false);
    assert.equal(result.telemetryRebind.backend.countAuthority, false);
    assert.equal(result.telemetryRebind.status, 'proven');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
