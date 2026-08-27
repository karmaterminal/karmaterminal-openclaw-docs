import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  rCd2AuthorityChecks,
  rCd2PublicResolutionOutput,
  resolveRcd2AuthoritativeReceipt,
  validateRcd2AuthoritativeReceipt,
} from '../../lib/r-cd-2-authoritative-receipt.mjs';
import { sanitizeEvidenceRecords } from '../sanitize-k6-artifacts.mjs';
import {
  buildTelemetryBackendStatusReceipt,
  classifyTelemetryBackendInteraction,
} from '../../lib/telemetry-backend-status.js';

const signingKey = 'r-cd-2-authoritative-receipt-test-key';
const run = 'a'.repeat(16);
const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '../..');
const manifestPath = path.join(repoRoot, 'manifests/r-cd-2.json');
const writerPath = path.join(repoRoot, 'scripts/evidence-writer.mjs');
const postprocessorPath = path.join(repoRoot, 'scripts/postprocess-k6-summary.mjs');
const resolverPath = path.join(repoRoot, 'scripts/resolve-r-cd-2-authoritative-receipt.mjs');

function evidence(overrides = {}) {
  return {
    session_created: true, session_unbound_confirmed: true,
    send_accepted: true, send_run_captured: true,
    dispatch_terminal_sentinel_observed: true,
    dispatch_terminal_sentinel_same_run_window: true,
    terminal_success_same_run: true, typed_delegate_success_same_run: true,
    wake_lifecycle_observed: true, post_wake_quiet: true,
    channel_message_observed: false, dispatch_failure_observed: false,
    send_run_fingerprint: run, terminal_run_fingerprint: run, wake_run_fingerprint: run,
    row_nonce_fingerprint: 'e'.repeat(16),
    accepted_send_trace_id: 'b'.repeat(32),
    ...overrides,
  };
}

function correlation(overrides = {}) {
  return {
    continuation: { tool: 'continue_delegate' }, delegate: { mode: 'silent-wake' },
    sameTrace: true, sameChain: true, toolSpanIds: ['a'.repeat(16)],
    traceId: 'b'.repeat(32), chainId: 'private-chain-id',
    dispatchSpanId: 'c'.repeat(16), fireSpanId: 'd'.repeat(16),
    rowBinding: {
      acceptedSendRunFingerprint: run,
      nonceFingerprint: 'e'.repeat(16),
      acceptedSendTraceId: 'b'.repeat(32),
      acceptedSendTraceSource: 'sessions-send-response',
    },
    ...overrides,
  };
}

function completeBackendStatus(rebindKeys) {
  const requiredCompletenessKeys = [
    'totalBlocks',
    'completedJobs',
    'inspectedBytes',
    'tempoApiStatus',
  ];
  return buildTelemetryBackendStatusReceipt({
    rowId: 'R-CD-2',
    candidateSha: 'a'.repeat(40),
    seat: 'unit',
    proofRunId: 'unit',
    requiredCompletenessKeys,
    rebindKeys,
    rebindValues: Object.fromEntries(
      rebindKeys.map((name) => [name, '1'.repeat(16)]),
    ),
    interactions: [classifyTelemetryBackendInteraction({
      backend: 'tempo',
      operation: 'search',
      httpStatus: 200,
      responseJson: {
        metrics: {
          totalBlocks: 1,
          completedJobs: 1,
          totalJobs: 1,
          inspectedBytes: 1024,
        },
      },
      resultCount: 1,
      queryFingerprint: '1'.repeat(16),
      backendBaseUrlEnv: 'OPENCLAW_PROOFS_TEMPO_BASE_URL',
      requiredCompletenessKeys,
    })],
  });
}

function flattenGates(checks) {
  return ['lifecycle', 'topology', 'joins'].flatMap((group) => (
    Object.entries(checks[group]).map(([name, value]) => ({ group, name, value }))
  ));
}

function expectedTrueChecks() {
  return rCd2AuthorityChecks(evidence(), correlation());
}

test('R-CD-2 promotes only a same-run typed silent-wake topology', () => {
  const rowEvidence = evidence();
  const rowCorrelation = correlation();
  const receipt = resolveRcd2AuthoritativeReceipt({
    evidence: rowEvidence, correlation: rowCorrelation, signingKey,
  });
  const checks = rCd2AuthorityChecks(rowEvidence, rowCorrelation);
  assert.equal(receipt.verdict, 'PASS-candidate');
  assert.equal(validateRcd2AuthoritativeReceipt(receipt, signingKey).valid, true);
  assert.equal(flattenGates(checks).every((gate) => gate.value === true), true);
  assert.deepEqual(
    { evidencePasses: checks.evidencePasses, topologyPasses: checks.topologyPasses, joinsPass: checks.joinsPass },
    { evidencePasses: true, topologyPasses: true, joinsPass: true },
  );
  assert.doesNotMatch(JSON.stringify(receipt), /private-chain-id|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/);
});

test('R-CD-2 binds the accepted run to its unique nonce-reason trace when sessions.send omits traceId', () => {
  const rowEvidence = evidence({ accepted_send_trace_id: null });
  const rowCorrelation = correlation({
    rowBinding: {
      acceptedSendRunFingerprint: run,
      nonceFingerprint: 'e'.repeat(16),
      acceptedSendTraceId: 'b'.repeat(32),
      acceptedSendTraceSource: 'unique-reason-bound-trace',
    },
  });
  const receipt = resolveRcd2AuthoritativeReceipt({
    evidence: rowEvidence,
    correlation: rowCorrelation,
    signingKey,
  });
  assert.equal(receipt.verdict, 'PASS-candidate');
  assert.equal(validateRcd2AuthoritativeReceipt(receipt, signingKey).valid, true);
  assert.deepEqual(
    {
      evidencePasses: rCd2AuthorityChecks(rowEvidence, rowCorrelation)
        .evidencePasses,
      topologyPasses: rCd2AuthorityChecks(rowEvidence, rowCorrelation)
        .topologyPasses,
      joinsPass: rCd2AuthorityChecks(rowEvidence, rowCorrelation).joinsPass,
    },
    { evidencePasses: true, topologyPasses: true, joinsPass: true },
  );
});

test('R-CD-2 public diagnostics invert each lifecycle, topology, and join gate', () => {
  const baseline = flattenGates(expectedTrueChecks());
  const inversions = [
    { group: 'lifecycle', name: 'sessionCreated', evidence: { session_created: false } },
    { group: 'lifecycle', name: 'sessionUnbound', evidence: { session_unbound_confirmed: false } },
    { group: 'lifecycle', name: 'sendAccepted', evidence: { send_accepted: false } },
    { group: 'lifecycle', name: 'sendRunCaptured', evidence: { send_run_captured: false } },
    { group: 'lifecycle', name: 'dispatchTerminalSentinel', evidence: { dispatch_terminal_sentinel_observed: false } },
    { group: 'lifecycle', name: 'dispatchTerminalSentinelSameRun', evidence: { dispatch_terminal_sentinel_same_run_window: false } },
    { group: 'lifecycle', name: 'terminalSuccessSameRun', evidence: { terminal_success_same_run: false } },
    { group: 'lifecycle', name: 'typedDelegateSuccessSameRun', evidence: { typed_delegate_success_same_run: false } },
    { group: 'lifecycle', name: 'wakeLifecycle', evidence: { wake_lifecycle_observed: false } },
    { group: 'lifecycle', name: 'postWakeQuiet', evidence: { post_wake_quiet: false } },
    { group: 'lifecycle', name: 'noChannelDelivery', evidence: { channel_message_observed: true } },
    {
      group: 'lifecycle', name: 'sendRunFingerprint', evidence: { send_run_fingerprint: 'not-hex' },
      coupled: [{ group: 'lifecycle', name: 'terminalRunMatchesSend' }, { group: 'joins', name: 'rowBinding' }],
    },
    {
      group: 'lifecycle', name: 'rowNonceFingerprint', evidence: { row_nonce_fingerprint: 'not-hex' },
      coupled: [{ group: 'joins', name: 'rowBinding' }],
    },
    { group: 'lifecycle', name: 'terminalRunMatchesSend', evidence: { terminal_run_fingerprint: 'f'.repeat(16) } },
    {
      group: 'lifecycle', name: 'acceptedSendTraceShape', evidence: { accepted_send_trace_id: 'not-a-trace' },
      coupled: [{ group: 'joins', name: 'acceptedTrace' }, { group: 'joins', name: 'rowBinding' }],
    },
    { group: 'topology', name: 'typedTool', correlation: { continuation: { tool: 'continue_work' } } },
    { group: 'topology', name: 'silentWake', correlation: { delegate: { mode: 'normal' } } },
    { group: 'topology', name: 'exactlyOneToolSpan', correlation: { toolSpanIds: ['a'.repeat(16), 'b'.repeat(16)] } },
    {
      group: 'topology', name: 'traceId', correlation: { traceId: 'not-a-trace' },
      coupled: [{ group: 'joins', name: 'acceptedTrace' }, { group: 'joins', name: 'rowBinding' }],
    },
    { group: 'topology', name: 'chainId', correlation: { chainId: '' } },
    {
      group: 'topology', name: 'dispatchSpan', correlation: { dispatchSpanId: 'not-hex' },
      coupled: [{ group: 'topology', name: 'distinctDispatchAndFire' }],
    },
    {
      group: 'topology', name: 'fireSpan', correlation: { fireSpanId: 'not-hex' },
      coupled: [{ group: 'topology', name: 'distinctDispatchAndFire' }],
    },
    { group: 'topology', name: 'distinctDispatchAndFire', correlation: { fireSpanId: 'c'.repeat(16) } },
    {
      group: 'topology', name: 'sendRunBinding',
      correlation: { rowBinding: { ...correlation().rowBinding, acceptedSendRunFingerprint: 'not-hex' } },
      coupled: [{ group: 'joins', name: 'rowBinding' }],
    },
    {
      group: 'topology', name: 'nonceBinding',
      correlation: { rowBinding: { ...correlation().rowBinding, nonceFingerprint: 'not-hex' } },
      coupled: [{ group: 'joins', name: 'rowBinding' }],
    },
    { group: 'topology', name: 'acceptedTraceBinding', correlation: { rowBinding: { ...correlation().rowBinding, acceptedSendTraceId: 'not-a-trace' } } },
    {
      group: 'topology', name: 'acceptedTraceSource',
      correlation: { rowBinding: { ...correlation().rowBinding, acceptedSendTraceSource: 'unknown' } },
      coupled: [{ group: 'joins', name: 'acceptedTrace' }, { group: 'joins', name: 'rowBinding' }],
    },
    {
      group: 'joins', name: 'acceptedTrace', evidence: { accepted_send_trace_id: 'c'.repeat(32) },
      coupled: [{ group: 'joins', name: 'rowBinding' }],
    },
    {
      group: 'joins', name: 'rowBinding',
      correlation: { rowBinding: { ...correlation().rowBinding, acceptedSendRunFingerprint: 'f'.repeat(16) } },
    },
  ];

  assert.deepEqual(
    inversions.map((entry) => `${entry.group}.${entry.name}`).sort(),
    baseline.map((entry) => `${entry.group}.${entry.name}`).sort(),
  );

  for (const inversion of inversions) {
    const rowEvidence = evidence(inversion.evidence || {});
    const rowCorrelation = correlation(inversion.correlation || {});
    const checks = rCd2AuthorityChecks(rowEvidence, rowCorrelation);
    const receipt = resolveRcd2AuthoritativeReceipt({
      evidence: rowEvidence, correlation: rowCorrelation, signingKey,
    });
    const allowedFalse = new Set([
      `${inversion.group}.${inversion.name}`,
      ...(inversion.coupled || []).map((entry) => `${entry.group}.${entry.name}`),
    ]);
    assert.equal(checks[inversion.group][inversion.name], false, inversion.name);
    assert.notEqual(receipt.verdict, 'PASS-candidate', inversion.name);
    assert.equal(validateRcd2AuthoritativeReceipt(receipt, signingKey).valid, true, inversion.name);
    for (const gate of flattenGates(checks)) {
      const key = `${gate.group}.${gate.name}`;
      if (allowedFalse.has(key)) continue;
      assert.equal(gate.value, true, `${inversion.name} kept ${key}`);
    }
  }
});

test('R-CD-2 resolution output and receipt stay public-safe', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'r-cd-2-resolution-'));
  try {
    const rowEvidence = evidence();
    const rowCorrelation = correlation();
    const evidencePath = path.join(dir, 'private-evidence.json');
    const correlationPath = path.join(dir, 'private-correlation.json');
    await writeFile(evidencePath, JSON.stringify(rowEvidence));
    await writeFile(correlationPath, JSON.stringify(rowCorrelation));
    const env = { ...process.env, OPENCLAW_GATEWAY_TOKEN: signingKey };
    const resolved = await execFileAsync(process.execPath, [
      resolverPath, '--run-dir', dir, '--evidence', evidencePath, '--correlation', correlationPath,
    ], { cwd: dir, env });
    const resolution = JSON.parse(resolved.stdout);
    const receipt = JSON.parse(await readFile(path.join(dir, 'r-cd-2-authoritative-receipt.json'), 'utf8'));
    assert.deepEqual(resolution, rCd2PublicResolutionOutput(receipt, rowEvidence, rowCorrelation));
    assert.equal(flattenGates(resolution.checks).every((gate) => gate.value === true), true);
    assert.equal(receipt.verdict, 'PASS-candidate');
    const privatePattern = /private-chain-id|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/;
    assert.doesNotMatch(JSON.stringify(resolution), privatePattern);
    assert.doesNotMatch(JSON.stringify(receipt), privatePattern);
    const { sanitized } = sanitizeEvidenceRecords([resolution, receipt]);
    assert.doesNotMatch(JSON.stringify(sanitized), privatePattern);
    assert.equal(sanitized[0].checks.lifecycle.sessionCreated, true);
    assert.equal(sanitized[1].verdict, 'PASS-candidate');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('R-CD-2 rejects outer-send acceptance plus an unrelated delayed message', () => {
  const receipt = resolveRcd2AuthoritativeReceipt({
    evidence: evidence({ terminal_success_same_run: false, wake_lifecycle_observed: false, send_run_mismatch: true }),
    correlation: correlation(), signingKey,
  });
  assert.deepEqual([receipt.verdict, receipt.failureCategory], ['PARTIAL-candidate', 'send-run-mismatch']);
});

test('R-CD-2 rejects individually valid lifecycle and topology receipts from different traces', () => {
  const receipt = resolveRcd2AuthoritativeReceipt({
    evidence: evidence({ accepted_send_trace_id: 'e'.repeat(32) }),
    correlation: correlation({ traceId: 'b'.repeat(32) }),
    signingKey,
  });
  assert.deepEqual([receipt.verdict, receipt.failureCategory], ['PARTIAL-candidate', 'send-topology-mismatch']);
  assert.equal(validateRcd2AuthoritativeReceipt(receipt, signingKey).valid, true);
});

test('R-CD-2 rejects a same-trace/chain topology with another row run or nonce', () => {
  for (const rowBinding of [
    { acceptedSendRunFingerprint: 'f'.repeat(16), nonceFingerprint: 'e'.repeat(16), acceptedSendTraceId: 'b'.repeat(32), acceptedSendTraceSource: 'sessions-send-response' },
    { acceptedSendRunFingerprint: run, nonceFingerprint: 'f'.repeat(16), acceptedSendTraceId: 'b'.repeat(32), acceptedSendTraceSource: 'sessions-send-response' },
  ]) {
    const receipt = resolveRcd2AuthoritativeReceipt({
      evidence: evidence(),
      correlation: correlation({ rowBinding }),
      signingKey,
    });
    assert.deepEqual([receipt.verdict, receipt.failureCategory], ['PARTIAL-candidate', 'send-topology-mismatch']);
  }
});

test('R-CD-2 rejects an unbound fallback trace and a mismatched unique trace', () => {
  for (const rowBinding of [
    {
      acceptedSendRunFingerprint: run,
      nonceFingerprint: 'e'.repeat(16),
      acceptedSendTraceId: 'b'.repeat(32),
      acceptedSendTraceSource: 'unknown',
    },
    {
      acceptedSendRunFingerprint: run,
      nonceFingerprint: 'e'.repeat(16),
      acceptedSendTraceId: 'f'.repeat(32),
      acceptedSendTraceSource: 'unique-reason-bound-trace',
    },
  ]) {
    const receipt = resolveRcd2AuthoritativeReceipt({
      evidence: evidence({ accepted_send_trace_id: null }),
      correlation: correlation({ rowBinding }),
      signingKey,
    });
    assert.equal(receipt.verdict, 'PARTIAL-candidate');
  }
});

test('R-CD-2 reconciles the rejected-base replay diagnostic only with a complete bound lifecycle', () => {
  const receipt = resolveRcd2AuthoritativeReceipt({
    evidence: evidence({
      dispatch_failure_observed: true,
      failureCategory: 'delegate-replay-unsafe',
      replay_invalid_observed: true,
    }),
    correlation: correlation(),
    signingKey,
  });
  assert.equal(receipt.verdict, 'PASS-candidate');
  assert.equal(receipt.lifecycle.replayDiagnosticObserved, true);
  assert.equal(validateRcd2AuthoritativeReceipt(receipt, signingKey).valid, true);
});

test('R-CD-2 rejects an actual replay failure, wrong mode, and mismatched trace topology', () => {
  const replay = resolveRcd2AuthoritativeReceipt({
    evidence: evidence({
      dispatch_failure_observed: true,
      failureCategory: 'delegate-replay-unsafe',
      typed_delegate_success_same_run: false,
      wake_lifecycle_observed: false,
    }),
    correlation: correlation(), signingKey,
  });

  assert.deepEqual(
    [replay.verdict, replay.failureCategory],
    ['FAIL-candidate', 'delegate-replay-unsafe'],
  );
  assert.equal(validateRcd2AuthoritativeReceipt(replay, signingKey).valid, true);
  for (const bad of [correlation({ delegate: { mode: 'normal' } }), correlation({ toolSpanIds: ['a'.repeat(16), 'b'.repeat(16)] })]) {
    const receipt = resolveRcd2AuthoritativeReceipt({ evidence: evidence(), correlation: bad, signingKey });
    assert.deepEqual([receipt.verdict, receipt.failureCategory], ['PARTIAL-candidate', 'invalid-continuation-topology']);
  }
});

test('R-CD-2 treats explicit silent-channel delivery as a conclusive failure', () => {
  const receipt = resolveRcd2AuthoritativeReceipt({
    evidence: evidence({ channel_message_observed: true }),
    correlation: correlation(),
    signingKey,
  });
  assert.deepEqual(
    [receipt.verdict, receipt.failureCategory],
    ['FAIL-candidate', 'silent-channel-delivery'],
  );
});

test('R-CD-2 rejects a successful lifecycle end without the exact post-tool sentinel', () => {
  const receipt = resolveRcd2AuthoritativeReceipt({
    evidence: evidence({
      dispatch_terminal_sentinel_observed: false,
      dispatch_failure_observed: true,
      failureCategory: 'missing-terminal-sentinel',
    }),
    correlation: correlation(),
    signingKey,
  });
  assert.deepEqual(
    [receipt.verdict, receipt.failureCategory],
    ['FAIL-candidate', 'missing-terminal-sentinel'],
  );
});

test('R-CD-2 rejects a terminal sentinel observed outside the accepted dispatch lifecycle', () => {
  const receipt = resolveRcd2AuthoritativeReceipt({
    evidence: evidence({
      dispatch_terminal_sentinel_same_run_window: false,
      dispatch_failure_observed: true,
      failureCategory: 'missing-terminal-sentinel',
    }),
    correlation: correlation(),
    signingKey,
  });
  assert.deepEqual(
    [receipt.verdict, receipt.failureCategory],
    ['FAIL-candidate', 'missing-terminal-sentinel'],
  );
});

test('R-CD-2 writer and postprocessor accept only the authoritative receipt', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'r-cd-2-authoritative-'));
  try {
    const receipt = resolveRcd2AuthoritativeReceipt({ evidence: evidence(), correlation: correlation(), signingKey });
    const receiptPath = path.join(dir, 'receipt.json');
    const logPath = path.join(dir, 'k6.log');
    const summaryPath = path.join(dir, 'summary.json');
    const backendPath = path.join(dir, 'backend-status.json');
    const readinessPath = path.join(dir, 'seat-readiness.json');
    await writeFile(receiptPath, JSON.stringify(receipt));
    await writeFile(logPath, '--- R-CD-2 EVIDENCE SUMMARY ---\n{"row":"R-CD-2","redacted_events":[]}\n--- END EVIDENCE ---\n');
    await writeFile(summaryPath, JSON.stringify({ metrics: { proof_failures: { values: { count: 0 } }, checks: { values: { rate: 1 } } } }));
    const rowManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    await writeFile(
      backendPath,
      JSON.stringify(
        completeBackendStatus(rowManifest.telemetryContract.backendUnavailable.rebindKeys),
      ),
    );
    await writeFile(readinessPath, '{"outcome":"PASS"}\n');
    const env = { ...process.env, OPENCLAW_GATEWAY_TOKEN: signingKey };
    const writer = await execFileAsync(process.execPath, [writerPath, '--input', logPath, '--row', 'R-CD-2', '--seat', 'unit', '--sha', 'a'.repeat(40), '--manifest', manifestPath, '--authoritative-receipt', receiptPath, '--backend-status', backendPath, '--seat-readiness', readinessPath], { cwd: dir, env });
    const writerDir = JSON.parse(writer.stdout).runDir;
    const writerResult = JSON.parse(await readFile(path.join(dir, writerDir, 'row-result.json'), 'utf8'));
    assert.equal(writerResult.outcome, 'PASS-candidate');
    assert.equal(writerResult.verdictSource, 'r-cd-2-authoritative-receipt');
    assert.equal(writerResult.authoritativeReceipt.validated, true);
    await access(path.join(dir, writerDir, 'r-cd-2-authoritative-receipt.json'));
    const post = await execFileAsync(process.execPath, [postprocessorPath, '--manifest', manifestPath, '--summary', summaryPath, '--out-root', path.join(dir, 'post'), '--run-id', 'unit', '--authoritative-receipt', receiptPath, '--backend-status', backendPath, '--seat-readiness', readinessPath], { cwd: dir, env });
    const postDir = JSON.parse(post.stdout).runDir;
    const postResult = JSON.parse(await readFile(path.join(postDir, 'row-result.json'), 'utf8'));
    assert.equal(postResult.outcome, 'PASS-candidate');
    assert.equal(postResult.verdictSource, 'r-cd-2-authoritative-receipt');
    assert.equal(postResult.authoritativeReceipt.validated, true);
    await assert.rejects(execFileAsync(process.execPath, [writerPath, '--input', logPath, '--row', 'R-CD-2', '--seat', 'unit', '--sha', 'a'.repeat(40)], { cwd: dir, env }));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
