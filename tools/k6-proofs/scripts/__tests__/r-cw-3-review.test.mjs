/**
 * r-cw-3-review.test.mjs — #1727.
 *
 * R-CW-3 is manual-gated: k6 proves schedule/wake and keeps the raw reason out
 * of public artifacts, and only a reviewed Tempo trace can support the
 * redaction half of the claim. The offline helper used to assert little more
 * than attribute presence, so a trace from any run with the same attribute
 * keys satisfied it.
 *
 * These tests pin the joined contract: the receipt binds one candidate, one
 * matrix, one run, one trace and one chain against externally supplied anchors;
 * it rebinds the reason fingerprint to the digest-checked manifest; it observes
 * raw-reason absence in the public bytes instead of trusting the producer's
 * boolean; it re-walks the tool/work/fire topology under the collector's own
 * rules; it refuses contradictory or unsanitized evidence; it cannot be aimed
 * at an immutable artifact; and it never claims acceptance.
 *
 * Every negative control below returns mechanical success on the rejected
 * helper head 8f6fd76095dd6101bb279dd262cf5b405f73fd39 and must fail closed here.
 */
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, link, stat } from 'node:fs/promises';
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
const SECOND_TOOL_SPAN = 'aaaaaaaaaaaaaaaa';
const TOOL_PARENT_SPAN = '5f10d460dce07c6e';
const WORK_SPAN = '7039affbf4abf978';
const FIRE_SPAN = '7852a55eb40c8bd0';
const RECEIPT_BASENAME = 'r-cw-3-reason-telemetry-review.json';
const SUMMARY_BASENAME = 'r-cw-3-reason-telemetry-summary.json';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

// The exact production template. The nonce shape is the one lib/gateway-ws.js
// generates: `<rowId>-<epoch ms>-<base36 tail>`.
const REASON_TEMPLATE = 'k6-proof-R-CW-3-redaction RAW-RCW3-{{nonce}}';
const ROW_NONCE = 'R-CW-3-1793061873594-ab12cd34';
const RAW_REASON = REASON_TEMPLATE.replaceAll('{{nonce}}', ROW_NONCE);
const REASON_HASH = sha256(RAW_REASON).slice(0, 16);
const REASON_LENGTH = RAW_REASON.length;

const MANIFEST_BODY = `${JSON.stringify({
  schema: 'openclaw.k6.proof-row-manifest.v1',
  rowId: 'R-CW-3',
  invocation: {
    tool: 'continue_work',
    delaySeconds: 5,
    reason: REASON_TEMPLATE,
    idempotencyKeyPrefix: 'R-CW-3',
  },
}, null, 2)}\n`;

function reasonAttrs({ hash = REASON_HASH, length = REASON_LENGTH, chainId = CHAIN_ID } = {}) {
  return [
    { key: 'chain.id', value: { stringValue: chainId } },
    { key: 'reason.present', value: { boolValue: true } },
    { key: 'reason.length', value: { intValue: String(length) } },
    { key: 'reason.hash', value: { stringValue: hash } },
  ];
}

function toolSpan({ spanId = TOOL_SPAN, traceId = TRACE_ID, statusCode = 'UNSET' } = {}) {
  return {
    name: 'openclaw.tool.execution',
    traceId,
    spanId,
    parentSpanId: TOOL_PARENT_SPAN,
    status: { code: statusCode },
    attributes: [
      { key: 'openclaw.toolName', value: { stringValue: 'continue_work' } },
      { key: 'gen_ai.tool.name', value: { stringValue: 'continue_work' } },
    ],
  };
}

function trace(overrides = {}) {
  const {
    traceId = TRACE_ID,
    reason = {},
    workParentSpanId = TOOL_SPAN,
    fireParentSpanId = TOOL_SPAN,
    extraToolSpan = false,
    statusCode = 'OK',
    toolStatusCode = 'UNSET',
  } = overrides;
  return {
    schema: 'openclaw.k6.public-tempo-trace.v1',
    traceId,
    spans: [
      toolSpan({ traceId, statusCode: toolStatusCode }),
      ...(extraToolSpan ? [toolSpan({ spanId: SECOND_TOOL_SPAN, traceId, statusCode: toolStatusCode })] : []),
      {
        name: 'continuation.work',
        traceId,
        spanId: WORK_SPAN,
        parentSpanId: workParentSpanId,
        status: { code: statusCode },
        attributes: reasonAttrs(reason),
      },
      {
        name: 'continuation.work.fire',
        traceId,
        spanId: FIRE_SPAN,
        parentSpanId: fireParentSpanId,
        status: { code: statusCode },
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
  evidenceRows = null,
  correlation = {},
  metadata = {},
  traceOverrides = {},
  traceBody = null,
  manifestBody = MANIFEST_BODY,
  scenarioBody = '// r-cw-3 fixture scenario\n',
  summary = {},
  omit = [],
} = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'r-cw-3-review-'));
  const runDir = path.join(root, RUN_ID);
  await mkdir(runDir, { recursive: true });
  const write = async (name, body) => {
    if (omit.includes(name)) return;
    await writeFile(path.join(runDir, name), body);
  };

  const rows = evidenceRows ?? [evidenceRow(evidence)];
  await write('evidence.jsonl', `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);
  await write('row-manifest.json', manifestBody);
  await write('row-scenario.js', scenarioBody);
  await write('continuation-trace-correlation.json', `${JSON.stringify(correlationReceipt(correlation), null, 2)}\n`);
  await write(
    `tempo-trace-${TRACE_ID.slice(0, 12)}.json`,
    `${JSON.stringify(traceBody ?? trace(traceOverrides), null, 2)}\n`,
  );
  await write(SUMMARY_BASENAME, `${JSON.stringify({
    row: 'R-CW-3',
    verdict: 'PARTIAL-candidate',
    review: { status: 'review-pending', pendingReceipts: ['reason-telemetry-redaction-review'] },
    ...summary,
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

const ANCHORS = [
  '--expect-candidate-sha', CANDIDATE_SHA,
  '--expect-run-id', RUN_ID,
  '--expect-matrix-id', MATRIX_ID,
  '--expect-trace-id', TRACE_ID,
];

async function invoke(runDir, { args = [], out = null, anchors = ANCHORS } = {}) {
  const outPath = out ?? path.join(runDir, 'review.json');
  const argv = [script, '--run-dir', runDir, '--out', outPath, ...anchors, ...args];
  try {
    const { stdout } = await runNode(process.execPath, argv, { encoding: 'utf8' });
    return { code: 0, stdout, stderr: '', outPath };
  } catch (error) {
    return { code: error.code, stdout: error.stdout || '', stderr: error.stderr || '', outPath };
  }
}

async function review(runDir, options = {}) {
  const result = await invoke(runDir, options);
  return {
    ...result,
    receipt: JSON.parse(await readFile(result.outPath, 'utf8').catch(() => 'null')),
  };
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

    // Digest custody is recorded, and the receipt says which digests are
    // authoritative comparisons rather than implying all of them are.
    const sources = receipt.binding.sources;
    for (const name of [
      'evidence.jsonl',
      `tempo-trace-${TRACE_ID.slice(0, 12)}.json`,
      'continuation-trace-correlation.json',
      'runner-metadata.json',
      'row-manifest.json',
      'row-scenario.js',
    ]) {
      assert.match(sources[name] || '', /^[a-f0-9]{64}$/, `${name} must be digest-recorded`);
      assert.equal(sources[name], sha256(await readFile(path.join(runDir, name))));
    }
    assert.match(receipt.binding.digestAuthority['row-manifest.json'], /runner-metadata\.manifestSha256/);
    assert.match(receipt.binding.digestAuthority['row-scenario.js'], /runner-metadata\.scenarioSha256/);
    assert.match(receipt.binding.digestAuthority.other, /custody/);

    // A passing helper is mechanical verification, never acceptance.
    assert.equal(receipt.acceptance.coordinatorAccepted, false);
    assert.equal(receipt.acceptance.manualAcceptanceRequired, true);
    assert.equal(receipt.acceptance.canonicalFoldForbidden, true);
    assert.equal(receipt.acceptance.liveReRun, false);
    assert.equal(receipt.acceptance.pendingReceipt, 'reason-telemetry-redaction-review');

    // Reconciliation names its source and retains the historical verdict.
    assert.equal(receipt.reconciliation.source, 'review-r-cw-3-reason-telemetry.mjs');
    assert.equal(receipt.reconciliation.historicalVerdict, 'PARTIAL-candidate');
    assert.equal(receipt.reconciliation.historicalVerdictSource, SUMMARY_BASENAME);
    assert.equal(receipt.reconciliation.overwritesOriginalEvidence, false);

    // The original VU summary is untouched.
    const summary = JSON.parse(await readFile(path.join(runDir, SUMMARY_BASENAME), 'utf8'));
    assert.equal(summary.verdict, 'PARTIAL-candidate');
    assert.deepEqual(summary.review.pendingReceipts, ['reason-telemetry-redaction-review']);
  });
});

// ---------------------------------------------------------------------------
// Finding 1 — the reason fingerprint must be rebound to the manifest.
// ---------------------------------------------------------------------------

test('public evidence carrying a nonce is refused: the sanitizer always drops it', async () => {
  await withFixture({ evidence: { nonce: ROW_NONCE } }, async ({ runDir }) => {
    assertReviewRefused(await review(runDir), 'publicEvidenceSanitized');
  });
});

test('a relabelled nonce cannot be reviewed onto preserved evidence', async () => {
  await withFixture({ evidence: { nonce: 'R-CW-3-independent-different-run' } }, async ({ runDir }) => {
    const result = await review(runDir);
    assertReviewRefused(result, 'publicEvidenceSanitized');
    assert.deepEqual(result.receipt.checks.publicEvidenceSanitized.evidence.droppedByResanitize, ['nonce']);
  });
});

test('the default offline mode states that it cannot recompute the fingerprint', async () => {
  // Public evidence is nonce-redacted by policy, so no check may present
  // fingerprint recomputation as satisfied. The gap is declared, not hidden.
  await withFixture({}, async ({ runDir }) => {
    const result = await review(runDir);
    assert.equal(result.code, 0);
    assert.equal(result.receipt.checks.reasonFingerprintRecomputedFromNonce, undefined);
    assert.equal(result.receipt.nonceSuppliedOutOfBand, false);
    const limit = result.receipt.limits.find((entry) => entry.claim === 'reason-fingerprint-recomputation');
    assert.equal(limit.available, false);
    assert.match(limit.reason, /nonce-redacted by policy/);
    assert.match(limit.reason, /cannot independently recompute/);
    // The contract check must not over-claim either.
    assert.match(result.receipt.checks.manifestContractBound.evidence.scope, /does not recompute the fingerprint/);
  });
});

test('a correlation receipt that does not claim a manifest-nonce fingerprint is refused', async () => {
  await withFixture({
    correlation: { reason: { hash: REASON_HASH, length: REASON_LENGTH, source: 'public-evidence', rawPersisted: false } },
  }, async ({ runDir }) => {
    assertReviewRefused(await review(runDir), 'manifestContractBound');
  });
});

test('--nonce repeats the collector derivation, binds the exact fire, and never echoes the nonce', async () => {
  await withFixture({}, async ({ runDir }) => {
    const good = await review(runDir, { args: ['--nonce', ROW_NONCE] });
    assert.equal(good.code, 0);
    const check = good.receipt.checks.reasonFingerprintRecomputedFromNonce;
    assert.equal(check.ok, true);
    assert.equal(check.evidence.recomputed, true);
    assert.equal(check.evidence.derivedReasonHash, REASON_HASH);
    assert.equal(good.receipt.nonceSuppliedOutOfBand, true);
    const limit = good.receipt.limits.find((entry) => entry.claim === 'reason-fingerprint-recomputation');
    assert.equal(limit.available, true);
    assert.ok(!JSON.stringify(good.receipt).includes(ROW_NONCE), 'the supplied nonce must never reach the receipt');

    const wrong = await review(runDir, { args: ['--nonce', 'R-CW-3-1793061873594-zz99zz99'] });
    assertReviewRefused(wrong, 'reasonFingerprintRecomputedFromNonce');
  });
});

test('a run-directory manifest copy that is not the R-CW-3 contract is refused', async () => {
  const manifestBody = `${JSON.stringify({ rowId: 'R-CW-9', invocation: { tool: 'continue_work', reason: REASON_TEMPLATE } }, null, 2)}\n`;
  await withFixture({ manifestBody }, async ({ runDir }) => {
    assertReviewRefused(await review(runDir), 'manifestContractBound');
  });
});

test('a manifest reason template with no nonce placeholder is refused', async () => {
  const manifestBody = `${JSON.stringify({ rowId: 'R-CW-3', invocation: { tool: 'continue_work', reason: 'no placeholder here' } }, null, 2)}\n`;
  await withFixture({ manifestBody }, async ({ runDir }) => {
    assertReviewRefused(await review(runDir), 'manifestContractBound');
  });
});

// ---------------------------------------------------------------------------
// Finding 2 — raw-reason absence must be observed in the public bytes.
// ---------------------------------------------------------------------------

test('raw reason material in the public evidence document is refused', async () => {
  await withFixture({
    evidence: { reason_note: `${'k6-proof-R-CW-3-redaction'} INDEPENDENT-SECRET` },
  }, async ({ runDir }) => {
    const result = await review(runDir);
    assertReviewRefused(result, 'rawReasonAbsentFromPublicArtifacts');
    // The producer's own boolean still claims absence: that claim is recorded,
    // and is explicitly not the proof.
    assert.equal(result.receipt.checks.publicArtifactRawReasonAbsentClaimed.ok, true);
  });
});

test('raw reason material in the correlation receipt is refused', async () => {
  await withFixture({
    correlation: { reason: { hash: REASON_HASH, length: REASON_LENGTH, source: 'manifest-nonce', rawPersisted: false, note: 'RAW-RCW3-LEAK' } },
  }, async ({ runDir }) => {
    assertReviewRefused(await review(runDir), 'rawReasonAbsentFromPublicArtifacts');
  });
});

test('raw reason material in runner metadata is refused', async () => {
  await withFixture({ metadata: { note: 'RAW-RCW3-LEAK' } }, async ({ runDir }) => {
    assertReviewRefused(await review(runDir), 'rawReasonAbsentFromPublicArtifacts');
  });
});

test('raw reason material in a public text surface is refused', async () => {
  await withFixture({}, async ({ runDir }) => {
    await writeFile(path.join(runDir, 'k6.log'), 'line one\nRAW-RCW3-LEAKED-FROM-THE-LOG\n');
    assertReviewRefused(await review(runDir), 'rawReasonAbsentFromPublicArtifacts');
  });
});

test('the contract bytes are excluded from the raw scan and named as excluded', async () => {
  await withFixture({}, async ({ runDir }) => {
    // row-manifest.json and row-scenario.js carry the literal template by
    // design; the receipt says so rather than silently ignoring them.
    const result = await review(runDir);
    assert.equal(result.code, 0);
    const scan = result.receipt.checks.rawReasonAbsentFromPublicArtifacts.evidence;
    assert.deepEqual(scan.excluded, ['row-manifest.json', 'row-scenario.js']);
    assert.ok(Object.keys(scan.scanned).includes('evidence.jsonl'));
    assert.ok(Object.keys(scan.scanned).includes('continuation-trace-correlation.json'));
    assert.ok(Object.keys(scan.scanned).includes('runner-metadata.json'));
  });
});

test('a refused receipt never echoes raw reason material from untrusted metadata', async () => {
  // The poisoned matrix id is also supplied as the expected anchor, so the
  // anchor check passes and only the public-bytes scan refuses. The receipt is
  // itself a public artifact: it must carry none of that material while still
  // declaring publicSafe.
  const poisoned = 'RAW-RCW3-PARENT-MATRIX-SECRET';
  await withFixture({ metadata: { matrixId: poisoned } }, async ({ runDir }) => {
    const result = await review(runDir, {
      anchors: [
        '--expect-candidate-sha', CANDIDATE_SHA,
        '--expect-run-id', RUN_ID,
        '--expect-matrix-id', poisoned,
        '--expect-trace-id', TRACE_ID,
      ],
    });
    assertReviewRefused(result, 'rawReasonAbsentFromPublicArtifacts');
    const serialized = await readFile(result.outPath, 'utf8');
    assert.ok(!serialized.includes('RAW-RCW3-'), 'the receipt must not echo the raw sentinel prefix');
    assert.ok(!serialized.includes('PARENT-MATRIX-SECRET'), 'the receipt must not echo the poisoned tail either');
    assert.ok(!result.stdout.includes('RAW-RCW3-'), 'stdout must not echo the raw sentinel prefix');
    assert.equal(result.receipt.publicSafe, true);
    assert.ok(result.receipt.redactedOutgoingValues > 0, 'the receipt must report that it dropped unsafe values');
    assert.equal(result.receipt.binding.matrixId, '<redacted-raw-reason>');
    assert.equal(result.receipt.binding.expectations.matrixId, '<redacted-raw-reason>');
  });
});

test('a malformed input whose bytes carry raw reason material is refused without echoing it', async () => {
  await withFixture({}, async ({ runDir }) => {
    await writeFile(path.join(runDir, 'evidence.jsonl'), '{ RAW-RCW3-PARENT-MALFORMED-SECRET }');
    const result = await review(runDir);
    assertReviewRefused(result);
    const serialized = await readFile(result.outPath, 'utf8');
    assert.ok(!serialized.includes('RAW-RCW3-'), 'a thrown parser message must not carry raw material into the receipt');
    assert.ok(!result.stdout.includes('RAW-RCW3-'));
    assert.equal(result.receipt.publicSafe, true);
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

// ---------------------------------------------------------------------------
// Finding 3 — exactly one originating tool span, one common parent, OK status.
// ---------------------------------------------------------------------------

test('two originating continue_work tool spans are refused', async () => {
  await withFixture({
    traceOverrides: { extraToolSpan: true, fireParentSpanId: SECOND_TOOL_SPAN },
    correlation: { toolSpanIds: [TOOL_SPAN, SECOND_TOOL_SPAN], fireParentSpanId: SECOND_TOOL_SPAN, fireParentSpanIds: [SECOND_TOOL_SPAN] },
  }, async ({ runDir }) => {
    const result = await review(runDir);
    assertReviewRefused(result, 'traceTopologyBound');
    const problems = result.receipt.checks.traceTopologyBound.evidence.problems.join(' | ');
    assert.match(problems, /exactly one is required/);
    assert.match(problems, /do not share one originating tool span/);
  });
});

test('work and fire spans that do not share one originating tool span are refused', async () => {
  await withFixture({
    traceOverrides: { extraToolSpan: true, workParentSpanId: SECOND_TOOL_SPAN },
    correlation: { toolSpanIds: [TOOL_SPAN, SECOND_TOOL_SPAN], workParentSpanId: SECOND_TOOL_SPAN },
  }, async ({ runDir }) => {
    assertReviewRefused(await review(runDir), 'traceTopologyBound');
  });
});

test('failed continuation spans are refused', async () => {
  await withFixture({ traceOverrides: { statusCode: 'ERROR' } }, async ({ runDir }) => {
    const result = await review(runDir);
    assertReviewRefused(result, 'traceTopologyBound');
    assert.match(result.receipt.checks.traceTopologyBound.evidence.problems.join(' | '), /is not status OK/);
  });
});

test('an errored originating tool span is refused', async () => {
  await withFixture({ traceOverrides: { toolStatusCode: 'ERROR' } }, async ({ runDir }) => {
    const result = await review(runDir);
    assertReviewRefused(result, 'traceTopologyBound');
    assert.match(result.receipt.checks.traceTopologyBound.evidence.problems.join(' | '), /error, blocked, or has unknown status/);
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

test('a correlation receipt that does not assert one trace, one chain and distinct spans cannot pass', async () => {
  await withFixture({ correlation: { distinctSpans: false } }, async ({ runDir }) => {
    assertReviewRefused(await review(runDir), 'traceTopologyBound');
  });
});

// ---------------------------------------------------------------------------
// Finding 4 — external anchors are mandatory, and identity must be well typed.
// ---------------------------------------------------------------------------

test('a run reviewed without external anchors cannot reach a joined-success verdict', async () => {
  await withFixture({}, async ({ runDir }) => {
    const result = await review(runDir, { anchors: [] });
    assertReviewRefused(result, 'externalAnchorsBound');
    const problems = result.receipt.checks.externalAnchorsBound.evidence.problems.join(' | ');
    for (const flag of ['--expect-candidate-sha', '--expect-run-id', '--expect-matrix-id', '--expect-trace-id']) {
      assert.match(problems, new RegExp(`${flag} is required`));
    }
  });
});

test('a self-consistent run relabelled onto a different candidate is refused', async () => {
  // Both metadata and evidence agree on the wrong candidate: only the external
  // anchor can tell them apart.
  await withFixture({
    metadata: { candidateSha: 'e'.repeat(40), runtimeBuildSha: 'e'.repeat(40) },
    evidence: { candidateSha: 'e'.repeat(40) },
  }, async ({ runDir }) => {
    assertReviewRefused(await review(runDir), 'externalAnchorsBound');
  });
});

test('a self-consistent run relabelled onto a different matrix is refused', async () => {
  await withFixture({ metadata: { matrixId: '20261027T002649Z-deadbeefdead-other' } }, async ({ runDir }) => {
    assertReviewRefused(await review(runDir), 'externalAnchorsBound');
  });
});

test('a non-string matrix id is refused even when the other anchors are supplied', async () => {
  await withFixture({ metadata: { matrixId: { unbound: 'matrix' } } }, async ({ runDir }) => {
    const result = await review(runDir);
    assertReviewRefused(result, 'identityBound');
    assert.equal(result.receipt.checks.externalAnchorsBound.ok, false);
  });
});

test('a runtime build SHA that is not the candidate SHA is refused', async () => {
  await withFixture({ metadata: { runtimeBuildSha: 'd'.repeat(40) } }, async ({ runDir }) => {
    const result = await review(runDir);
    assertReviewRefused(result, 'identityBound');
    assert.match(
      result.receipt.checks.identityBound.evidence.problems.join(' | '),
      /runtime build SHA does not equal the candidate SHA/,
    );
  });
});

test('a wrong run id cannot be reviewed into this run', async () => {
  await withFixture({ metadata: { runId: '20261027T004430Z-r-cw-3-other' } }, async ({ runDir }) => {
    assertReviewRefused(await review(runDir), 'externalAnchorsBound');
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

// ---------------------------------------------------------------------------
// Finding 5 — --out can never replace an input or an immutable original.
// ---------------------------------------------------------------------------

async function assertOutputRefused(runDir, out, protectedPath, expected) {
  const before = await readFile(protectedPath);
  const result = await invoke(runDir, { out });
  assert.equal(result.code, 1, 'an unsafe --out must exit non-zero');
  assert.match(result.stderr, /r-cw-3 review refused:/);
  assert.match(result.stderr, expected);
  assert.deepEqual(await readFile(protectedPath), before, 'the protected artifact must be byte-identical');
  return result;
}

test('--out cannot overwrite the immutable VU summary', async () => {
  await withFixture({}, async ({ runDir }) => {
    const target = path.join(runDir, SUMMARY_BASENAME);
    await assertOutputRefused(runDir, target, target, /refusing to overwrite immutable run artifact/);
    // The summary is still the original VU artifact, not a review receipt.
    const summary = JSON.parse(await readFile(target, 'utf8'));
    assert.equal(summary.verdict, 'PARTIAL-candidate');
  });
});

test('--out cannot overwrite the public evidence it is reviewing', async () => {
  await withFixture({}, async ({ runDir }) => {
    const target = path.join(runDir, 'evidence.jsonl');
    await assertOutputRefused(runDir, target, target, /refusing to overwrite immutable run artifact/);
  });
});

test('--out cannot write through a symlink aimed at an immutable artifact', async () => {
  await withFixture({}, async ({ runDir }) => {
    const target = path.join(runDir, 'evidence.jsonl');
    const alias = path.join(runDir, 'alias-review.json');
    await symlink(target, alias);
    await assertOutputRefused(runDir, alias, target, /through a symlink/);
  });
});

test('--out cannot write through a hard link aimed at an immutable artifact', async () => {
  await withFixture({}, async ({ runDir }) => {
    const target = path.join(runDir, 'evidence.jsonl');
    const alias = path.join(runDir, 'hardlink-review.json');
    await link(target, alias);
    await assertOutputRefused(runDir, alias, target, /hard-linked file/);
    assert.equal((await stat(target)).nlink, 2, 'the hard link itself is left alone');
  });
});

test('a fresh output name beside the run directory artifacts is still allowed', async () => {
  await withFixture({}, async ({ runDir }) => {
    const result = await review(runDir, { out: path.join(runDir, 'parent-review.json') });
    assert.equal(result.code, 0);
    assert.equal(result.receipt.verdict, 'reason-telemetry-redaction-review-passed');
  });
});

test('the helper may replace its own previous receipt', async () => {
  await withFixture({}, async ({ runDir }) => {
    const out = path.join(runDir, RECEIPT_BASENAME);
    assert.equal((await review(runDir, { out })).code, 0);
    assert.equal((await review(runDir, { out })).code, 0);
  });
});

// ---------------------------------------------------------------------------
// Finding 6 — exactly one evidence record, per the collector's own rule.
// ---------------------------------------------------------------------------

test('contradictory evidence records are refused rather than resolved by taking the last', async () => {
  await withFixture({
    evidenceRows: [evidenceRow({ wake_observed: false }), evidenceRow()],
  }, async ({ runDir }) => {
    const result = await review(runDir);
    assertReviewRefused(result);
    assert.match(result.receipt.error, /expected exactly one evidence record, found 2/);
  });
});

// ---------------------------------------------------------------------------
// Behaviour predicate and malformed-input controls.
// ---------------------------------------------------------------------------

test('a reason digest that does not match this run\'s evidence cannot pass', async () => {
  await withFixture({ traceOverrides: { reason: { hash: 'a'.repeat(16) } } }, async ({ runDir }) => {
    const result = await review(runDir);
    assertReviewRefused(result, 'reasonTelemetryMatchesEvidence');
    // Presence alone still holds: the old check could not tell these apart.
    assert.equal(result.receipt.checks.safeReasonAttrsPresent.ok, true);
  });
});

test('a reason length that does not match this run\'s evidence cannot pass', async () => {
  await withFixture({ traceOverrides: { reason: { length: REASON_LENGTH + 2 } } }, async ({ runDir }) => {
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

test('a missing manifest copy leaves the review explicitly pending', async () => {
  await withFixture({ omit: ['row-manifest.json'] }, async ({ runDir }) => {
    const result = await review(runDir);
    assertReviewRefused(result);
    assert.match(result.receipt.error, /ENOENT|row-manifest/);
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
