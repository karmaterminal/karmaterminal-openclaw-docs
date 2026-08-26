import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildTelemetryBackendStatusReceipt,
  classifyTelemetryBackendInteraction,
  evaluateTelemetryBackendDispositionContract,
  telemetryBackendStatusBlocksPass,
  unknownTelemetryBackendInteraction,
  validateTelemetryBackendStatusReceipt,
} from '../../lib/telemetry-backend-status.js';
import {
  ensureTelemetryBackendStatus,
  finalizeTelemetryBackendStatus,
  fingerprintTelemetryQuery,
  recordTelemetryBackendInteraction,
} from '../lib/telemetry-backend-status-store.mjs';

const requiredCompletenessKeys = [
  'totalBlocks',
  'completedJobs',
  'inspectedBytes',
  'tempoApiStatus',
];
const context = {
  rowId: 'R-CD-2',
  candidateSha: 'a'.repeat(40),
  seat: 'ronan',
  proofRunId: 'unit-run',
  requiredCompletenessKeys,
  rebindKeys: ['candidate_sha', 'row_id', 'run_id'],
  rebindValues: {
    candidate_sha: 'a'.repeat(40),
    row_id: 'R-CD-2',
    run_id: 'unit-run',
  },
};
const dispositionContract = {
  requiredBackends: ['tempo', 'loki'],
  rowPassStatuses: ['complete', 'partial', 'capped'],
  requireNonAuthoritativeZero: true,
  requireCompleteRebind: true,
};
const exactPartialReceiptPath = path.resolve(
  'tools/k6-proofs/scripts/__tests__/fixtures/run-32956764849-backend-status.json',
);

function interaction(overrides = {}) {
  return classifyTelemetryBackendInteraction({
    backend: 'tempo',
    operation: 'search',
    transportOk: true,
    responseParsed: true,
    httpStatus: 200,
    responseJson: {
      metrics: {
        totalBlocks: 4,
        completedJobs: 2,
        totalJobs: 2,
        inspectedBytes: 1024,
      },
    },
    resultCount: 1,
    resultLimit: 20,
    queryFingerprint: fingerprintTelemetryQuery('safe-query'),
    backendBaseUrlEnv: 'OPENCLAW_PROOFS_TEMPO_BASE_URL',
    windowStartUtc: '2026-08-25T00:00:00.000Z',
    windowEndUtc: '2026-08-25T00:05:00.000Z',
    requiredCompletenessKeys,
    ...overrides,
  });
}

test('classifies complete, partial, unavailable, capped, and unknown responses', () => {
  assert.equal(interaction().status, 'complete');
  assert.equal(interaction({
    responseJson: {
      metrics: { totalBlocks: 4, completedJobs: 1, totalJobs: 2, inspectedBytes: 1024 },
    },
  }).status, 'partial');
  assert.equal(interaction({
    transportOk: false,
    responseParsed: false,
    httpStatus: null,
    responseJson: null,
  }).status, 'unavailable');
  assert.equal(interaction({ resultCount: 20, resultLimit: 20 }).status, 'capped');
  const unknown = interaction({ responseJson: {}, resultCount: 0 });
  assert.equal(unknown.status, 'unknown');
  assert.equal(unknown.zeroResultAuthoritative, false);
});

test('a 200 zero without completeness metadata never authorizes absence', () => {
  const unknown = unknownTelemetryBackendInteraction({
    backend: 'tempo',
    queryFingerprint: fingerprintTelemetryQuery('zero-query'),
    backendBaseUrlEnv: 'OPENCLAW_PROOFS_TEMPO_BASE_URL',
    requiredCompletenessKeys,
  });
  const receipt = buildTelemetryBackendStatusReceipt({
    ...context,
    interactions: [unknown],
  });
  assert.equal(receipt.status, 'unknown');
  assert.equal(receipt.complete, false);
  assert.equal(receipt.countAuthority, false);
  assert.equal(telemetryBackendStatusBlocksPass(receipt), true);
});

test('run 32956764849 partial receipt proves the row contract but not backend counts', async () => {
    const receipt = JSON.parse(await readFile(exactPartialReceiptPath, 'utf8'));
    const rowContract = evaluateTelemetryBackendDispositionContract(
      receipt,
      dispositionContract,
    );
    assert.equal(validateTelemetryBackendStatusReceipt(receipt).valid, true);
    assert.equal(receipt.status, 'partial');
    assert.equal(receipt.complete, false);
    assert.equal(receipt.countAuthority, false);
    assert.equal(rowContract.status, 'proven');
    assert.deepEqual(rowContract.failures, []);
    assert.equal(
      telemetryBackendStatusBlocksPass(receipt),
      true,
      'the same partial receipt must still block PASS for ordinary telemetry rows',
    );
  });

  test('disposition row rejects unknown, failed, incomplete, contradictory, and unsafe receipts', async (t) => {
    const exact = JSON.parse(await readFile(exactPartialReceiptPath, 'utf8'));
    const buildWith = (interactions, rebindValues = exact.rebind.values) =>
      buildTelemetryBackendStatusReceipt({
        rowId: exact.rowId,
        candidateSha: exact.candidateSha,
        seat: exact.seat,
        proofRunId: exact.proofRunId,
        generatedAt: exact.generatedAt,
        requiredCompletenessKeys: exact.requiredCompletenessKeys,
        rebindKeys: exact.rebind.declaredKeys,
        rebindValues,
        interactions,
      });
    const classified = (backend, status) => {
      const source = exact.interactions.find((entry) => entry.backend === backend);
      const completeResponse = backend === 'tempo'
        ? {
            metrics: {
              totalBlocks: 1,
              completedJobs: 1,
              totalJobs: 1,
              inspectedBytes: 1,
            },
          }
        : {
            status: 'success',
            data: {
              stats: {
                summary: {
                  totalBlocks: 1,
                  completedJobs: 1,
                  totalJobs: 1,
                  inspectedBytes: 1,
                },
              },
            },
          };
      return classifyTelemetryBackendInteraction({
        backend,
        operation: source.operation,
        transportOk: status !== 'unavailable',
        responseParsed: status !== 'unavailable',
        httpStatus: status === 'unavailable' ? null : 200,
        responseJson: status === 'unknown' ? {} : completeResponse,
        resultCount: status === 'capped' ? source.resultLimit : 0,
        resultLimit: source.resultLimit,
        resultCapped: status === 'capped',
        windowStartUtc: source.windowStartUtc,
        windowEndUtc: source.windowEndUtc,
        queryFingerprint: source.queryFingerprint,
        backendBaseUrlEnv: source.backendBaseUrlEnv,
        sliceStrategy: source.sliceStrategy,
        requiredCompletenessKeys: exact.requiredCompletenessKeys,
      });
    };

    await t.test('unknown disposition', () => {
      const receipt = buildWith([
        classified('tempo', 'unknown'),
        classified('loki', 'unknown'),
      ]);
      const result = evaluateTelemetryBackendDispositionContract(
        receipt,
        dispositionContract,
      );
      assert.equal(result.status, 'unproven');
      assert.ok(result.failures.some((failure) => /unknown is not row-passable/.test(failure)));
    });

    await t.test('failed query', () => {
      const receipt = buildWith([
        classified('tempo', 'unavailable'),
        classified('loki', 'unavailable'),
      ]);
      const result = evaluateTelemetryBackendDispositionContract(
        receipt,
        dispositionContract,
      );
      assert.equal(result.status, 'unproven');
      assert.ok(
        result.failures.some((failure) => /unavailable is not row-passable/.test(failure)),
      );
    });

    await t.test('missing backend interaction', () => {
      const receipt = buildWith([exact.interactions[0]]);
      const result = evaluateTelemetryBackendDispositionContract(
        receipt,
        dispositionContract,
      );
      assert.equal(result.status, 'unproven');
      assert.ok(result.failures.some((failure) => /required backend loki has 0/.test(failure)));
    });

    await t.test('incomplete rebind', () => {
      const rebindValues = { ...exact.rebind.values };
      delete rebindValues.proof_run_id;
      const receipt = buildWith(exact.interactions, rebindValues);
      assert.equal(validateTelemetryBackendStatusReceipt(receipt).valid, true);
      const result = evaluateTelemetryBackendDispositionContract(
        receipt,
        dispositionContract,
      );
      assert.equal(result.status, 'unproven');
      assert.ok(result.failures.some((failure) => /rebind key set is incomplete/.test(failure)));
    });

    await t.test('contradictory count authority', () => {
      const receipt = structuredClone(exact);
      receipt.countAuthority = true;
      const validation = validateTelemetryBackendStatusReceipt(receipt);
      assert.equal(validation.valid, false);
      assert.ok(
        validation.failures.some((failure) =>
          /complete\/countAuthority disagree/.test(failure)),
      );
      assert.equal(
        evaluateTelemetryBackendDispositionContract(receipt, dispositionContract).status,
        'unproven',
      );
    });

    await t.test('unsafe public interaction', () => {
      const receipt = structuredClone(exact);
      receipt.interactions[0].operation = '/home/operator/private-query';
      const validation = validateTelemetryBackendStatusReceipt(receipt);
      assert.equal(validation.valid, false);
      assert.ok(
        validation.failures.some((failure) => /operation is not public-safe/.test(failure)),
      );
      assert.equal(
        evaluateTelemetryBackendDispositionContract(receipt, dispositionContract).status,
        'unproven',
      );
    });

    await t.test('complete and capped alternate paths remain row-passable', () => {
      for (const status of ['complete', 'capped']) {
        const receipt = buildWith([
          classified('tempo', status),
          classified('loki', status),
        ]);
        assert.equal(
          evaluateTelemetryBackendDispositionContract(receipt, dispositionContract).status,
          'proven',
          status,
        );
        assert.equal(receipt.countAuthority, status === 'complete');
      }
    });

    await t.test('runtime contract drift cannot make unknown row-passable', () => {
      const receipt = buildWith([
        classified('tempo', 'unknown'),
        classified('loki', 'unknown'),
      ]);
      const driftedContract = {
        ...dispositionContract,
        rowPassStatuses: [...dispositionContract.rowPassStatuses, 'unknown'],
      };
      const result = evaluateTelemetryBackendDispositionContract(
        receipt,
        driftedContract,
      );
      assert.equal(result.status, 'unproven');
      assert.ok(
        result.failures.some((failure) =>
          /rowPassStatuses must be exactly complete,partial,capped/.test(failure)),
      );
    });
});

test('capped interactions retain slice strategy and block count authority', () => {
  const capped = interaction({
    resultCount: 10_000,
    resultLimit: 10_000,
    sliceStrategy: 'daily-reslice-required',
  });
  const receipt = buildTelemetryBackendStatusReceipt({
    ...context,
    interactions: [capped],
  });
  assert.equal(receipt.status, 'capped');
  assert.equal(receipt.interactions[0].sliceStrategy, 'daily-reslice-required');
  assert.equal(receipt.countAuthority, false);
});

test('atomic store appends interactions and recovers rebind metadata', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'backend-status-store-'));
  const file = path.join(root, 'backend-status.json');
  try {
    const initial = await ensureTelemetryBackendStatus(file, {
      ...context,
      rebindValues: {},
    });
    assert.equal(initial.status, 'unknown');
    assert.deepEqual(initial.interactions, []);
    await recordTelemetryBackendInteraction(file, context, interaction());
    const finalized = await finalizeTelemetryBackendStatus(file, context);
    assert.equal(finalized.complete, true);
    assert.equal(finalized.rebind.complete, true);
    assert.equal(validateTelemetryBackendStatusReceipt(finalized).valid, true);
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), finalized);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('store refuses corrupt persistence and cross-run identity reuse', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'backend-status-corrupt-'));
  const file = path.join(root, 'backend-status.json');
  try {
    await writeFile(file, '{"schema":"wrong"}\n');
    await assert.rejects(
      recordTelemetryBackendInteraction(file, context, interaction()),
      /backend-status\.json is invalid/,
    );
    await rm(file);
    await recordTelemetryBackendInteraction(file, context, interaction());
    await assert.rejects(
      recordTelemetryBackendInteraction(
        file,
        { ...context, proofRunId: 'other-run' },
        interaction(),
      ),
      /identity mismatch/,
    );
    await assert.rejects(
      recordTelemetryBackendInteraction(
        file,
        { ...context, rebindKeys: ['different_key'] },
        interaction(),
      ),
      /rebind keys changed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('backend receipt validation rejects raw response fields and private rebind values', () => {
  const receipt = buildTelemetryBackendStatusReceipt({
    ...context,
    interactions: [interaction()],
  });
  receipt.interactions[0].rawResponse = { token: 'not-public' };
  assert.equal(validateTelemetryBackendStatusReceipt(receipt).valid, false);
  delete receipt.interactions[0].rawResponse;
  receipt.rebind.values.run_id = 'agent:main:private';
  assert.equal(validateTelemetryBackendStatusReceipt(receipt).valid, false);
});

test('the k6 readiness probe emits unknown backend status instead of treating 200 as healthy', async () => {
  const source = await readFile(
    path.resolve('tools/k6-proofs/scenarios/r-cw.js'),
    'utf8',
  );
  assert.match(source, /buildTelemetryBackendStatusReceipt/);
  assert.match(source, /'backend-status\.json'/);
  assert.match(source, /completeness unproven/);
  assert.match(source, /metricPass && backendStatus\.complete/);
});
