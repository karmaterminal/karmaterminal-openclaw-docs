import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  resolveRcd2AuthoritativeReceipt,
  validateRcd2AuthoritativeReceipt,
} from '../../lib/r-cd-2-authoritative-receipt.mjs';
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

test('R-CD-2 promotes only a same-run typed silent-wake topology', () => {
  const receipt = resolveRcd2AuthoritativeReceipt({ evidence: evidence(), correlation: correlation(), signingKey });
  assert.equal(receipt.verdict, 'PASS-candidate');
  assert.equal(validateRcd2AuthoritativeReceipt(receipt, signingKey).valid, true);
  assert.doesNotMatch(JSON.stringify(receipt), /private-chain-id|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/);
});

test('R-CD-2 binds the accepted run to its unique nonce-reason trace when sessions.send omits traceId', () => {
  const receipt = resolveRcd2AuthoritativeReceipt({
    evidence: evidence({ accepted_send_trace_id: null }),
    correlation: correlation({
      rowBinding: {
        acceptedSendRunFingerprint: run,
        nonceFingerprint: 'e'.repeat(16),
        acceptedSendTraceId: 'b'.repeat(32),
        acceptedSendTraceSource: 'unique-reason-bound-trace',
      },
    }),
    signingKey,
  });
  assert.equal(receipt.verdict, 'PASS-candidate');
  assert.equal(validateRcd2AuthoritativeReceipt(receipt, signingKey).valid, true);
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
