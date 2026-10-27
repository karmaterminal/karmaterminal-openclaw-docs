/**
 * r-cw-3-review.test.mjs — #1727.
 *
 * R-CW-3 is manual-gated: k6 proves schedule/wake and keeps the raw reason out
 * of public artifacts, and only a reviewed Tempo trace can support the
 * redaction half of the claim.  The offline helper used to assert little more
 * than attribute presence, so a trace from any run with the same attribute
 * keys satisfied it.  These tests pin the joined contract: the receipt binds
 * one candidate, one matrix, one run, one trace and one chain, compares the
 * exported reason digest/length against the run's own evidence, re-walks the
 * tool/work/fire topology recorded by the correlation receipt, pins the
 * SHA-256 of every source artifact, and never claims acceptance.
 */
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import assert from 'node:assert/strict';

const script = path.resolve('tools/k6-proofs/scripts/review-r-cw-3-reason-telemetry.mjs');
const runNode = promisify(execFile);

const CANDIDATE_SHA = 'b'.repeat(40);
const RUN_ID = '20261027T004430Z-r-cw-3-fixture';
const MATRIX_ID = '20261027T002649Z-cafebabecafe-fixture';
const SEAT = 'fixture-seat';
const TRACE_ID = 'ed97f1870118915e8e310f0eb17e4848';
const CHAIN_ID = 'caecf55b-1945-4423-a6c4-67694094d597';
const TOOL_SPAN = '94552906400958a2';
const TOOL_PARENT_SPAN = '5f10d460dce07c6e';
const WORK_SPAN = '7039affbf4abf978';
const FIRE_SPAN = '7852a55eb40c8bd0';
const REASON_HASH = 'c50337694f521f6b';
const REASON_LENGTH = 139;

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function reasonAttrs({ hash = REASON_HASH, length = REASON_LENGTH, chainId = CHAIN_ID } = {}) {
  return [
    { key: 'chain.id', value: { stringValue: chainId } },
    { key: 'reason.present', value: { boolValue: true } },
    { key: 'reason.length', value: { intValue: String(length) } },
    { key: 'reason.hash', value: { stringValue: hash } },
  ];
}

function trace(overrides = {}) {
  const { traceId = TRACE_ID, reason = {}, workParentSpanId = TOOL_SPAN, fireParentSpanId = TOOL_SPAN } = overrides;
  return {
    schema: 'openclaw.k6.public-tempo-trace.v1',
    traceId,
    spans: [
      {
        name: 'openclaw.tool.execution',
        traceId,
        spanId: TOOL_SPAN,
        parentSpanId: TOOL_PARENT_SPAN,
        status: { code: 'UNSET' },
        attributes: [
          { key: 'openclaw.toolName', value: { stringValue: 'continue_work' } },
          { key: 'gen_ai.tool.name', value: { stringValue: 'continue_work' } },
        ],
      },
      {
        name: 'continuation.work',
        traceId,
        spanId: WORK_SPAN,
        parentSpanId: workParentSpanId,
        status: { code: 'OK' },
        attributes: reasonAttrs(reason),
      },
      {
        name: 'continuation.work.fire',
        traceId,
        spanId: FIRE_SPAN,
        parentSpanId: fireParentSpanId,
        status: { code: 'OK' },
        attributes: reasonAttrs(reason),
      },
    ],
  };
}

function evidenceRow(overrides = {}) {
  return {
    row: 'R-CW-3',
    manifest_loaded: true,
    seat: SEAT,
    session_created: true,
    candidateSha: CANDIDATE_SHA,
    dispatch_accepted: true,
    scheduled_sentinel: true,
    wake_observed: true,
    public_artifact_raw_reason_absent: true,
    tempo_assertion: 'pending-review',
    reason_hash: REASON_HASH,
    reason_length: REASON_LENGTH,
    trace_id: null,
    trace_id_source: null,
    ...overrides,
  };
}

function correlationReceipt(overrides = {}) {
  return {
    schema: 'openclaw.k6.continuation-trace-correlation.v1',
    row: 'R-CW-3',
    seat: SEAT,
    attribution: 'reason-hash-length',
    traceJson: `tempo-trace-${TRACE_ID.slice(0, 12)}.json`,
    traceId: TRACE_ID,
    chainId: CHAIN_ID,
    toolSpanIds: [TOOL_SPAN],
    toolParentSpanIds: [TOOL_PARENT_SPAN],
    fireSpanId: FIRE_SPAN,
    fireParentSpanId: TOOL_SPAN,
    fireSpanIds: [FIRE_SPAN],
    fireParentSpanIds: [TOOL_SPAN],
    fireAttemptCount: 1,
    childSpans: [],
    workSpanId: WORK_SPAN,
    workParentSpanId: TOOL_SPAN,
    reason: { hash: REASON_HASH, length: REASON_LENGTH, source: 'manifest-nonce', rawPersisted: false },
    continuation: {
      tool: 'continue_work',
      originSurface: 'typed-tool',
      acceptSpan: 'continuation.work',
      fireSpan: 'continuation.work.fire',
    },
    sameTrace: true,
    sameChain: true,
    distinctSpans: true,
    resultClass: 'unique',
    ...overrides,
  };
}

/**
 * Build a self-consistent R-CW-3 run directory: the directory name is the run
 * id, and runner metadata carries the digests of the copied manifest and
 * scenario exactly as `run-proofs.sh` writes them.
 */
async function fixtureRunDir({
  evidence = {},
  correlation = {},
  metadata = {},
  traceOverrides = {},
  traceBody = null,
  manifestBody = '{"rowId":"R-CW-3"}\n',
  scenarioBody = '// r-cw-3 fixture scenario\n',
  omit = [],
} = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'r-cw-3-review-'));
  const runDir = path.join(root, RUN_ID);
  await mkdir(runDir, { recursive: true });
  const write = async (name, body) => {
    if (omit.includes(name)) return;
    await writeFile(path.join(runDir, name), body);
  };

  await write('evidence.jsonl', `${JSON.stringify(evidenceRow(evidence))}\n`);
  await write('row-manifest.json', manifestBody);
  await write('row-scenario.js', scenarioBody);
  await write('continuation-trace-correlation.json', `${JSON.stringify(correlationReceipt(correlation), null, 2)}\n`);
  await write(
    `tempo-trace-${TRACE_ID.slice(0, 12)}.json`,
    `${JSON.stringify(traceBody ?? trace(traceOverrides), null, 2)}\n`,
  );
  await write('r-cw-3-reason-telemetry-summary.json', `${JSON.stringify({
    row: 'R-CW-3',
    verdict: 'PARTIAL-candidate',
    review: { status: 'review-pending', pendingReceipts: ['reason-telemetry-redaction-review'] },
  }, null, 2)}\n`);
  await write('runner-metadata.json', `${JSON.stringify({
    row: 'R-CW-3',
    scenario: 'r-cw-3-reason-telemetry.js',
    candidateSha: CANDIDATE_SHA,
    runtimeBuildSha: CANDIDATE_SHA,
    seat: SEAT,
    docsRef: 'c'.repeat(40),
    matrixId: MATRIX_ID,
    runId: RUN_ID,
    manifestPath: 'tools/k6-proofs/manifests/r-cw-3.json',
    manifestSha256: sha256(manifestBody),
    scenarioPath: 'tools/k6-proofs/scenarios/r-cw-3-reason-telemetry.js',
    scenarioSha256: sha256(scenarioBody),
    ...metadata,
  }, null, 2)}\n`);

  return { root, runDir };
}

async function review(runDir, extraArgs = []) {
  const out = path.join(runDir, 'review.json');
  const args = [
    script,
    '--run-dir', runDir,
    '--out', out,
    '--expect-candidate-sha', CANDIDATE_SHA,
    '--expect-run-id', RUN_ID,
    '--expect-matrix-id', MATRIX_ID,
    '--expect-trace-id', TRACE_ID,
    ...extraArgs,
  ];
  try {
    const { stdout } = await runNode(process.execPath, args, { encoding: 'utf8' });
    return { code: 0, stdout, receipt: JSON.parse(await readFile(out, 'utf8')) };
  } catch (error) {
    return {
      code: error.code,
      stdout: error.stdout || '',
      receipt: JSON.parse(await readFile(out, 'utf8').catch(() => 'null')),
    };
  }
}

/** Every negative control must leave the review unlifted and the debt named. */
function assertReviewRefused(result, failedCheck) {
  assert.equal(result.code, 1, 'a refused review must exit non-zero');
  assert.match(result.stdout, /review-pending/);
  assert.ok(result.receipt, 'a refused review must still write a named receipt');
  assert.equal(result.receipt.verdict, 'review-pending');
  assert.equal(result.receipt.acceptance.coordinatorAccepted, false);
  assert.equal(result.receipt.acceptance.manualAcceptanceRequired, true);
  assert.equal(result.receipt.acceptance.pendingReceipt, 'reason-telemetry-redaction-review');
  if (failedCheck) {
    assert.equal(result.receipt.checks[failedCheck]?.ok, false, `${failedCheck} must be the failing check`);
  }
}

async function withFixture(options, fn) {
  const fixture = await fixtureRunDir(options);
  try {
    return await fn(fixture);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
}

test('a correctly joined run produces a bound receipt that claims no acceptance', async () => {
  await withFixture({}, async ({ runDir }) => {
    const result = await review(runDir);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /reason-telemetry-redaction-review-passed/);
    const receipt = result.receipt;
    assert.equal(receipt.verdict, 'reason-telemetry-redaction-review-passed');
    assert.deepEqual(
      Object.entries(receipt.checks).filter(([, check]) => !check.ok).map(([name]) => name),
      [],
    );

    // Identity is joined, not adjacent.
    assert.equal(receipt.binding.candidateSha, CANDIDATE_SHA);
    assert.equal(receipt.binding.runId, RUN_ID);
    assert.equal(receipt.binding.matrixId, MATRIX_ID);
    assert.equal(receipt.binding.traceId, TRACE_ID);
    assert.equal(receipt.binding.chainId, CHAIN_ID);

    // The trace id comes from the correlation receipt: public evidence leaves
    // trace_id null, which is exactly why presence checks were not enough.
    assert.equal(receipt.traceIdSource, 'continuation-trace-correlation.json');

    // Every reviewed source artifact is digest-pinned.
    const sources = receipt.binding.sources;
    for (const name of [
      'evidence.jsonl',
      `tempo-trace-${TRACE_ID.slice(0, 12)}.json`,
      'continuation-trace-correlation.json',
      'runner-metadata.json',
      'row-manifest.json',
      'row-scenario.js',
    ]) {
      assert.match(sources[name] || '', /^[a-f0-9]{64}$/, `${name} must be digest-bound`);
      assert.equal(sources[name], sha256(await readFile(path.join(runDir, name))));
    }

    // A passing helper is mechanical verification, never acceptance.
    assert.equal(receipt.acceptance.coordinatorAccepted, false);
    assert.equal(receipt.acceptance.manualAcceptanceRequired, true);
    assert.equal(receipt.acceptance.canonicalFoldForbidden, true);
    assert.equal(receipt.acceptance.liveReRun, false);
    assert.equal(receipt.acceptance.pendingReceipt, 'reason-telemetry-redaction-review');

    // Reconciliation names its source and retains the historical verdict.
    assert.equal(receipt.reconciliation.source, 'review-r-cw-3-reason-telemetry.mjs');
    assert.equal(receipt.reconciliation.historicalVerdict, 'PARTIAL-candidate');
    assert.equal(receipt.reconciliation.historicalVerdictSource, 'r-cw-3-reason-telemetry-summary.json');
    assert.equal(receipt.reconciliation.overwritesOriginalEvidence, false);

    // The original VU summary is untouched.
    const summary = JSON.parse(await readFile(path.join(runDir, 'r-cw-3-reason-telemetry-summary.json'), 'utf8'));
    assert.equal(summary.verdict, 'PARTIAL-candidate');
    assert.deepEqual(summary.review.pendingReceipts, ['reason-telemetry-redaction-review']);
  });
});

test('fails closed when Tempo contains the raw R-CW-3 reason sentinel', async () => {
  await withFixture({}, async ({ runDir }) => {
    const poisoned = trace();
    poisoned.raw = 'k6-proof-R-CW-3-redaction RAW-RCW3-R-CW-3-abc-secret';
    await writeFile(path.join(runDir, `tempo-trace-${TRACE_ID.slice(0, 12)}.json`), `${JSON.stringify(poisoned)}\n`);
    assertReviewRefused(await review(runDir), 'rawReasonAbsentFromTempo');
  });
});

test('a reason digest that does not match this run\'s evidence cannot pass', async () => {
  await withFixture({ traceOverrides: { reason: { hash: 'a'.repeat(16) } } }, async ({ runDir }) => {
    const result = await review(runDir);
    assertReviewRefused(result, 'reasonTelemetryMatchesEvidence');
    // Presence alone still holds: the old check could not tell these apart.
    assert.equal(result.receipt.checks.safeReasonAttrsPresent.ok, true);
  });
});

test('a reason length that does not match this run\'s evidence cannot pass', async () => {
  await withFixture({ traceOverrides: { reason: { length: 140 } } }, async ({ runDir }) => {
    const result = await review(runDir);
    assertReviewRefused(result, 'reasonTelemetryMatchesEvidence');
    assert.equal(result.receipt.checks.safeReasonAttrsPresent.ok, true);
  });
});

test('a correlation receipt that claims a different reason cannot pass', async () => {
  await withFixture({
    correlation: { reason: { hash: 'd'.repeat(16), length: REASON_LENGTH, source: 'manifest-nonce', rawPersisted: false } },
  }, async ({ runDir }) => {
    assertReviewRefused(await review(runDir), 'reasonTelemetryMatchesEvidence');
  });
});

test('a raw-persisted reason in the correlation receipt cannot pass', async () => {
  await withFixture({
    correlation: { reason: { hash: REASON_HASH, length: REASON_LENGTH, source: 'manifest-nonce', rawPersisted: true } },
  }, async ({ runDir }) => {
    assertReviewRefused(await review(runDir), 'reasonTelemetryMatchesEvidence');
  });
});

test('a wrong candidate SHA cannot be reviewed into this run', async () => {
  await withFixture({ metadata: { candidateSha: 'e'.repeat(40) } }, async ({ runDir }) => {
    assertReviewRefused(await review(runDir), 'identityBound');
  });
});

test('a wrong run id cannot be reviewed into this run', async () => {
  await withFixture({ metadata: { runId: '20261027T004430Z-r-cw-3-other' } }, async ({ runDir }) => {
    assertReviewRefused(await review(runDir), 'identityBound');
  });
});

test('a wrong matrix id cannot be reviewed into this run', async () => {
  await withFixture({ metadata: { matrixId: '20261027T002649Z-deadbeefdead-other' } }, async ({ runDir }) => {
    assertReviewRefused(await review(runDir), 'identityBound');
  });
});

test('a trace from a different trace id cannot be reviewed into this run', async () => {
  await withFixture({ traceOverrides: { traceId: 'f'.repeat(32) } }, async ({ runDir }) => {
    assertReviewRefused(await review(runDir), 'traceTopologyBound');
  });
});

test('a chain id the correlation receipt did not record cannot pass', async () => {
  await withFixture({
    traceOverrides: { reason: { chainId: '11111111-2222-4333-8444-555555555555' } },
  }, async ({ runDir }) => {
    assertReviewRefused(await review(runDir), 'traceTopologyBound');
  });
});

test('work and fire spans that are not parented to the originating tool span cannot pass', async () => {
  await withFixture({
    traceOverrides: { workParentSpanId: TOOL_PARENT_SPAN, fireParentSpanId: TOOL_PARENT_SPAN },
  }, async ({ runDir }) => {
    assertReviewRefused(await review(runDir), 'traceTopologyBound');
  });
});

test('a correlation receipt that does not assert one trace, one chain and distinct spans cannot pass', async () => {
  await withFixture({ correlation: { distinctSpans: false } }, async ({ runDir }) => {
    assertReviewRefused(await review(runDir), 'traceTopologyBound');
  });
});

test('a changed source artifact digest cannot pass', async () => {
  await withFixture({}, async ({ runDir }) => {
    // The scenario bytes that fired are digest-bound in runner metadata; a
    // reviewed run directory whose scenario copy drifted is not reviewable.
    await writeFile(path.join(runDir, 'row-scenario.js'), '// tampered after the run\n');
    assertReviewRefused(await review(runDir), 'sourceDigestsBound');
  });
});

test('a failed behavior predicate cannot be reviewed into a pass', async () => {
  for (const field of ['dispatch_accepted', 'scheduled_sentinel', 'wake_observed', 'public_artifact_raw_reason_absent']) {
    await withFixture({ evidence: { [field]: false } }, async ({ runDir }) => {
      const result = await review(runDir);
      assertReviewRefused(result);
      const failed = Object.entries(result.receipt.checks).filter(([, check]) => !check.ok).map(([name]) => name);
      assert.ok(failed.length > 0, `${field} must fail at least one check`);
    });
  }
});

test('a missing trace leaves the review explicitly pending', async () => {
  await withFixture({ omit: [`tempo-trace-${TRACE_ID.slice(0, 12)}.json`] }, async ({ runDir }) => {
    const result = await review(runDir);
    assertReviewRefused(result);
    assert.match(result.receipt.error, /no tempo-trace/);
  });
});

test('a missing correlation receipt leaves the review explicitly pending', async () => {
  await withFixture({ omit: ['continuation-trace-correlation.json'] }, async ({ runDir }) => {
    const result = await review(runDir);
    assertReviewRefused(result);
    assert.match(result.receipt.error, /ENOENT|continuation-trace-correlation/);
  });
});

test('a malformed correlation receipt leaves the review explicitly pending', async () => {
  await withFixture({}, async ({ runDir }) => {
    await writeFile(path.join(runDir, 'continuation-trace-correlation.json'), '{ not json');
    const result = await review(runDir);
    assertReviewRefused(result);
    assert.ok(result.receipt.error, 'a malformed input must be named in the receipt');
  });
});

test('a malformed evidence line leaves the review explicitly pending', async () => {
  await withFixture({}, async ({ runDir }) => {
    await writeFile(path.join(runDir, 'evidence.jsonl'), '{ not json\n');
    const result = await review(runDir);
    assertReviewRefused(result);
    assert.ok(result.receipt.error);
  });
});
