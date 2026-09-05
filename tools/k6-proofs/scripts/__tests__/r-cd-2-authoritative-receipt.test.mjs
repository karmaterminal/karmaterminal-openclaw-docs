import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  R_CD_2_COLLECTOR_SCHEMA,
  resolveRcd2AuthoritativeReceipt as resolveRcd2AuthoritativeReceiptRaw,
  sealRcd2AcquisitionReceipt,
  validateRcd2AcquisitionReceipt,
  validateRcd2AuthoritativeReceipt as validateRcd2AuthoritativeReceiptRaw,
} from '../../lib/r-cd-2-authoritative-receipt.mjs';

const signingKey = 'r-cd-2-authoritative-receipt-test-key';
const run = 'a'.repeat(16);
const wakeRun = 'f'.repeat(16);
const rowNonce = 'R-CD-2-authority-test-nonce';
const rowNonceFingerprint = createHash('sha256').update(rowNonce).digest('hex').slice(0, 16);
const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '../..');
const manifestPath = path.join(repoRoot, 'manifests/r-cd-2.json');
const writerPath = path.join(repoRoot, 'scripts/evidence-writer.mjs');
const postprocessorPath = path.join(repoRoot, 'scripts/postprocess-k6-summary.mjs');
const authorityIdentity = {
  schema: 'openclaw.k6.r-cd-2-authority-identity.v1',
  candidateSha: '1'.repeat(40),
  runtimeBuildSha: '2'.repeat(40),
  docsRef: '3'.repeat(40),
  repository: 'karmaterminal/karmaterminal-openclaw-docs',
  seat: 'ronan-dgx',
  matrixId: '20260905T032057Z-333333333333-deadbeef',
  runId: '20260905T032057Z-r-cd-2-deadbeef',
  row: 'R-CD-2',
  scenario: 'r-cd-2-silent-wake.js',
  harness: {
    manifestPath: 'tools/k6-proofs/manifests/r-cd-2.json',
    manifestSha256: '4'.repeat(64),
    scenarioPath: 'tools/k6-proofs/scenarios/r-cd-2-silent-wake.js',
    scenarioSha256: '5'.repeat(64),
  },
};
const validateRcd2AuthoritativeReceipt = (
  receipt,
  key,
  expectedIdentity = authorityIdentity,
) => validateRcd2AuthoritativeReceiptRaw(receipt, key, expectedIdentity);
const resolveRcd2AuthoritativeReceipt = (input) => resolveRcd2AuthoritativeReceiptRaw({
  identity: authorityIdentity,
  ...input,
});

function evidence(overrides = {}) {
  const reason = `R-CD-2 fixture ${rowNonce}`;
  return {
    nonce: rowNonce,
    session_created: true, session_unbound_confirmed: true,
    send_accepted: true, send_run_captured: true,
    dispatch_terminal_sentinel_observed: true,
    dispatch_terminal_sentinel_same_run_window: true,
    terminal_success_same_run: true, typed_delegate_success_same_run: true,
    wake_lifecycle_observed: true, wake_session_bound: true, post_wake_quiet: true,
    channel_message_observed: false, dispatch_failure_observed: false,
    send_run_fingerprint: run, terminal_run_fingerprint: run, wake_run_fingerprint: wakeRun,
    row_nonce_fingerprint: rowNonceFingerprint,
    reason_hash: createHash('sha256').update(reason).digest('hex').slice(0, 16),
    reason_length: reason.length,
    accepted_send_trace_id: 'b'.repeat(32),
    dispatch_accepted_at_ms: 100,
    dispatch_terminal_sentinel_at_ms: 200,
    dispatch_lifecycle_end_at_ms: 300,
    wake_lifecycle_at_ms: 400,
    post_wake_quiet_at_ms: 500,
    ...overrides,
  };
}

function correlation(overrides = {}, identity = authorityIdentity) {
  const rowEvidence = evidence();
  const traceId = 'b'.repeat(32);
  const query = `{ resource.service.name="ronan-prince" && name="continuation.delegate.dispatch" && .reason.hash="${rowEvidence.reason_hash}" && .reason.length=${rowEvidence.reason_length} && .delegate.mode="silent-wake" }`;
  const base = {
    seat: identity.seat,
    attribution: 'reason-hash-length-mode',
    collector: { schema: R_CD_2_COLLECTOR_SCHEMA, version: 1 },
    authorityIdentity: identity,
    nonce: {
      sha256: createHash('sha256').update(rowNonce).digest('hex'),
      length: rowNonce.length,
    },
    reason: {
      hash: rowEvidence.reason_hash,
      length: rowEvidence.reason_length,
      source: 'manifest-nonce',
      rawPersisted: false,
    },
    continuation: {
      tool: 'continue_delegate',
      originSurface: 'typed-tool',
      acceptSpan: 'continuation.delegate.dispatch',
      fireSpan: 'continuation.delegate.fire',
    },
    delegate: { mode: 'silent-wake' },
    query,
    querySha256: createHash('sha256').update(query).digest('hex'),
    searchWindow: {
      startUnixSeconds: Math.floor(rowEvidence.dispatch_accepted_at_ms / 1000) - 60,
      endUnixSeconds: Math.floor(rowEvidence.dispatch_accepted_at_ms / 1000) + 60,
      paddingSeconds: 60,
      source: 'dispatch-only',
    },
    stabilization: {
      ingestionSettleMs: 1,
      pollIntervalMs: 1,
      searchQueryCount: 2,
      stabilizationQueryCount: 0,
      finalQueryCount: 1,
    },
    finality: {
      candidateCount: 1,
      snapshotFetched: true,
      stable: true,
      traceId,
    },
    tempoSnapshot: {
      file: `tempo-trace-${traceId.slice(0, 12)}.json`,
      sha256: createHash('sha256').update('immutable-tempo-snapshot\n').digest('hex'),
      traceId,
    },
    traceJson: `tempo-trace-${traceId.slice(0, 12)}.json`,
    uniqueness: { acceptedTraceCount: 1, resultClass: 'unique' },
    sameTrace: true, sameChain: true, distinctSpans: true, toolSpanIds: ['a'.repeat(16)],
    toolParentSpanIds: ['e'.repeat(16)],
    dispatchParentSpanId: 'e'.repeat(16),
    fireParentSpanId: 'e'.repeat(16),
    fireSpanIds: ['d'.repeat(16)],
    fireParentSpanIds: ['e'.repeat(16)],
    fireAttemptCount: 1,
    childSpans: [],
    resultClass: 'unique',
    traceId, chainId: 'private-chain-id',
    dispatchSpanId: 'c'.repeat(16), fireSpanId: 'd'.repeat(16),
    rowBinding: {
      acceptedSendRunFingerprint: run,
      nonceFingerprint: rowNonceFingerprint,
      acceptedSendTraceId: 'b'.repeat(32),
      acceptedSendTraceSource: 'sessions-send-response',
    },
  };
  const receipt = {
    ...base,
    ...overrides,
    continuation: { ...base.continuation, ...overrides.continuation },
    delegate: { ...base.delegate, ...overrides.delegate },
    rowBinding: { ...base.rowBinding, ...overrides.rowBinding },
  };
  return sealRcd2AcquisitionReceipt({ receipt, signingKey });
}

function canonical(receipt) {
  return JSON.stringify({
    schema: receipt.schema,
    row: receipt.row,
    authoritativeSource: receipt.authoritativeSource,
    candidateOnly: receipt.candidateOnly,
    foldRequiresReview: receipt.foldRequiresReview,
    identity: receipt.identity,
    verdict: receipt.verdict,
    failureCategory: receipt.failureCategory || null,
    lifecycle: receipt.lifecycle || null,
    diagnostics: receipt.diagnostics,
    binding: receipt.binding,
  });
}

function resign(receipt) {
  receipt.integrity.signature = createHmac('sha256', signingKey)
    .update(canonical(receipt))
    .digest('hex');
  return receipt;
}

test('R-CD-2 promotes only a same-run typed silent-wake topology', () => {
  const receipt = resolveRcd2AuthoritativeReceipt({ evidence: evidence(), correlation: correlation(), signingKey });
  assert.equal(receipt.verdict, 'PASS-candidate');
  assert.equal(validateRcd2AuthoritativeReceipt(receipt, signingKey).valid, true);
  assert.doesNotMatch(JSON.stringify(receipt), /private-chain-id|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/);
  assert.equal(receipt.diagnostics.lifecycleComplete, true);
  assert.equal(receipt.diagnostics.topologyComplete, true);
  assert.equal(receipt.diagnostics.joinComplete, true);
  assert.equal(receipt.lifecycle.rowNonceFingerprint, rowNonceFingerprint);
});

test('R-CD-2 immutable acquisition rejects omission and tampering of every required field', () => {
  const requiredPaths = [
    ['schema'], ['row'], ['seat'], ['attribution'],
    ['collector', 'schema'], ['collector', 'version'],
    ...[
      'schema', 'candidateSha', 'runtimeBuildSha', 'docsRef', 'repository',
      'seat', 'matrixId', 'runId', 'row', 'scenario',
    ].map((key) => ['authorityIdentity', key]),
    ...['manifestPath', 'manifestSha256', 'scenarioPath', 'scenarioSha256']
      .map((key) => ['authorityIdentity', 'harness', key]),
    ['nonce', 'sha256'], ['nonce', 'length'],
    ['reason', 'hash'], ['reason', 'length'], ['reason', 'source'], ['reason', 'rawPersisted'],
    ['continuation', 'tool'], ['continuation', 'originSurface'],
    ['continuation', 'acceptSpan'], ['continuation', 'fireSpan'],
    ['delegate', 'mode'], ['query'], ['querySha256'],
    ['searchWindow', 'startUnixSeconds'], ['searchWindow', 'endUnixSeconds'],
    ['searchWindow', 'paddingSeconds'], ['searchWindow', 'source'],
    ['stabilization', 'ingestionSettleMs'], ['stabilization', 'pollIntervalMs'],
    ['stabilization', 'searchQueryCount'], ['stabilization', 'stabilizationQueryCount'],
    ['stabilization', 'finalQueryCount'],
    ['finality', 'candidateCount'], ['finality', 'snapshotFetched'],
    ['finality', 'stable'], ['finality', 'traceId'],
    ['tempoSnapshot', 'file'], ['tempoSnapshot', 'sha256'], ['tempoSnapshot', 'traceId'],
    ['uniqueness', 'acceptedTraceCount'], ['uniqueness', 'resultClass'],
    ['traceId'], ['traceJson'], ['chainId'], ['dispatchSpanId'], ['dispatchParentSpanId'],
    ['fireSpanId'], ['fireParentSpanId'], ['fireSpanIds'], ['fireParentSpanIds'],
    ['fireAttemptCount'], ['toolSpanIds'], ['toolParentSpanIds'], ['childSpans'],
    ['sameTrace'], ['sameChain'], ['distinctSpans'], ['resultClass'],
    ['rowBinding', 'acceptedSendRunFingerprint'], ['rowBinding', 'nonceFingerprint'],
    ['rowBinding', 'acceptedSendTraceId'], ['rowBinding', 'acceptedSendTraceSource'],
    ['integrity', 'algorithm'], ['integrity', 'signature'],
  ];
  const setAt = (value, keys, replacement) => {
    let target = value;
    for (const key of keys.slice(0, -1)) target = target[key];
    target[keys.at(-1)] = replacement;
  };
  const deleteAt = (value, keys) => {
    let target = value;
    for (const key of keys.slice(0, -1)) target = target[key];
    delete target[keys.at(-1)];
  };
  for (const keys of requiredPaths) {
    const label = keys.join('.');
    const omitted = structuredClone(correlation());
    deleteAt(omitted, keys);
    assert.equal(
      validateRcd2AcquisitionReceipt(
        omitted,
        signingKey,
        authorityIdentity,
        evidence(),
      ).valid,
      false,
      `${label} omission`,
    );

    const tampered = structuredClone(correlation());
    let current = tampered;
    for (const key of keys) current = current[key];
    const replacement = typeof current === 'string'
      ? `${current}x`
      : typeof current === 'number'
        ? current + 1
        : typeof current === 'boolean'
          ? !current
        : [...current, 'tampered'];
    setAt(tampered, keys, replacement);
    assert.equal(
      validateRcd2AcquisitionReceipt(
        tampered,
        signingKey,
        authorityIdentity,
        evidence(),
      ).valid,
      false,
      `${label} tampering`,
    );
  }
});

test('R-CD-2 validation rejects identity-less use and every foreign authority identity', () => {
  const receipt = resolveRcd2AuthoritativeReceipt({
    evidence: evidence(),
    correlation: correlation(),
    signingKey,
  });
  assert.deepEqual(
    validateRcd2AuthoritativeReceiptRaw(receipt, signingKey),
    { valid: false, reason: 'expected-identity-required' },
  );
  const mutations = [
    ['candidateSha', '6'.repeat(40)],
    ['runtimeBuildSha', '7'.repeat(40)],
    ['docsRef', '8'.repeat(40)],
    ['seat', 'other-seat'],
    ['matrixId', 'other-matrix'],
    ['runId', 'other-run'],
    ['harness', {
      ...authorityIdentity.harness,
      scenarioSha256: '9'.repeat(64),
    }],
  ];
  for (const [key, value] of mutations) {
    assert.deepEqual(
      validateRcd2AuthoritativeReceiptRaw(
        receipt,
        signingKey,
        { ...authorityIdentity, [key]: value },
      ),
      { valid: false, reason: 'identity-mismatch' },
      key,
    );
  }
});

test('R-CD-2 signed authority cannot be replayed across enclosing run identities', () => {
  const first = resolveRcd2AuthoritativeReceipt({
    evidence: evidence(),
    correlation: correlation(),
    identity: authorityIdentity,
    signingKey,
  });
  const mutations = [
    ['candidateSha', '6'.repeat(40)],
    ['runtimeBuildSha', '7'.repeat(40)],
    ['docsRef', '8'.repeat(40)],
    ['repository', 'karmaterminal/other-docs'],
    ['seat', 'ronan-secondary'],
    ['matrixId', '20260905T032058Z-888888888888-feedface'],
    ['runId', '20260905T032058Z-r-cd-2-feedface'],
    ['scenario', 'r-cd-2-other.js'],
  ];
  for (const [key, value] of mutations) {
    const changedIdentity = { ...authorityIdentity, [key]: value };
    assert.throws(
      () => resolveRcd2AuthoritativeReceipt({
        evidence: evidence(),
        correlation: correlation(),
        identity: changedIdentity,
        signingKey,
      }),
      /immutable acquisition receipt invalid/u,
      key,
    );
    assert.deepEqual(
      validateRcd2AuthoritativeReceipt(first, signingKey, changedIdentity),
      { valid: false, reason: 'identity-mismatch' },
      key,
    );
    const tampered = structuredClone(first);
    tampered.identity = changedIdentity;
    assert.deepEqual(
      validateRcd2AuthoritativeReceipt(tampered, signingKey, changedIdentity),
      { valid: false, reason: 'invalid-integrity' },
      `${key} post-sign mutation`,
    );
  }

  for (const [key, value] of [
    ['manifestPath', 'tools/k6-proofs/manifests/r-cd-2-copy.json'],
    ['manifestSha256', '9'.repeat(64)],
    ['scenarioPath', 'tools/k6-proofs/scenarios/r-cd-2-copy.js'],
    ['scenarioSha256', 'a'.repeat(64)],
  ]) {
    const changedIdentity = {
      ...authorityIdentity,
      harness: { ...authorityIdentity.harness, [key]: value },
    };
    assert.throws(
      () => resolveRcd2AuthoritativeReceipt({
        evidence: evidence(),
        correlation: correlation(),
        identity: changedIdentity,
        signingKey,
      }),
      /immutable acquisition receipt invalid/u,
      `harness.${key}`,
    );
    assert.deepEqual(
      validateRcd2AuthoritativeReceipt(first, signingKey, changedIdentity),
      { valid: false, reason: 'identity-mismatch' },
      `harness.${key}`,
    );
    const tampered = structuredClone(first);
    tampered.identity = changedIdentity;
    assert.deepEqual(
      validateRcd2AuthoritativeReceipt(tampered, signingKey, changedIdentity),
      { valid: false, reason: 'invalid-integrity' },
      `harness.${key} post-sign mutation`,
    );
  }

  assert.deepEqual(first.identity, authorityIdentity);
  assert.deepEqual(Object.keys(first.identity).sort(), Object.keys(authorityIdentity).sort());

  const oldReceipt = structuredClone(first);
  delete oldReceipt.identity;
  resign(oldReceipt);
  assert.deepEqual(
    validateRcd2AuthoritativeReceipt(oldReceipt, signingKey, authorityIdentity),
    { valid: false, reason: 'invalid-shape' },
  );
});

test('R-CD-2 binds a trace-less sessions.send through one unique nonce-reason trace', () => {
  const receipt = resolveRcd2AuthoritativeReceipt({
    evidence: evidence({ accepted_send_trace_id: null }),
    correlation: correlation({
      rowBinding: {
        acceptedSendRunFingerprint: run,
        nonceFingerprint: rowNonceFingerprint,
        acceptedSendTraceId: 'b'.repeat(32),
        acceptedSendTraceSource: 'unique-reason-bound-trace',
      },
    }),
    signingKey,
  });
  assert.equal(receipt.verdict, 'PASS-candidate');
  assert.deepEqual(receipt.diagnostics.joins, {
    acceptedTrace: true,
    acceptedRun: true,
    rowNonce: true,
  });
});

test('R-CD-2 signed diagnostics isolate lifecycle, topology, and join misses', () => {
  const cases = [
    {
      expectedGroup: 'lifecycle', expectedGate: 'wakeBeforeQuietWindow',
      rowEvidence: evidence({ post_wake_quiet_at_ms: 350 }), rowCorrelation: correlation(),
    },
    {
      expectedGroup: 'topology', expectedGate: 'silentWake',
      rowEvidence: evidence(), rowCorrelation: correlation({ delegate: { mode: 'normal' } }),
    },
    {
      expectedGroup: 'joins', expectedGate: 'rowNonce',
      rowEvidence: evidence(),
      rowCorrelation: correlation({ rowBinding: {
        acceptedSendRunFingerprint: run,
        nonceFingerprint: 'e'.repeat(16),
        acceptedSendTraceId: 'b'.repeat(32),
        acceptedSendTraceSource: 'sessions-send-response',
      } }),
    },
  ];
  for (const { expectedGroup, expectedGate, rowEvidence, rowCorrelation } of cases) {
    if (expectedGroup !== 'lifecycle') {
      assert.throws(
        () => resolveRcd2AuthoritativeReceipt({
          evidence: rowEvidence, correlation: rowCorrelation, signingKey,
        }),
        /immutable acquisition receipt invalid/u,
      );
      continue;
    }
    const receipt = resolveRcd2AuthoritativeReceipt({
      evidence: rowEvidence, correlation: rowCorrelation, signingKey,
    });
    assert.notEqual(receipt.verdict, 'PASS-candidate');
    const falseGates = Object.entries(receipt.diagnostics[expectedGroup])
      .filter(([, value]) => value === false).map(([key]) => key);
    assert.deepEqual(falseGates, [expectedGate]);
    assert.equal(validateRcd2AuthoritativeReceipt(receipt, signingKey).valid, true);
  }
});

test('R-CD-2 provider failure exposes a false lifecycle-owned diagnostic', () => {
  const receipt = resolveRcd2AuthoritativeReceipt({
    evidence: evidence({
      dispatch_failure_observed: true,
      failureCategory: 'provider-or-turn-failure',
    }),
    correlation: correlation(),
    signingKey,
  });
  assert.deepEqual(
    [receipt.verdict, receipt.failureCategory],
    ['FAIL-candidate', 'provider-or-turn-failure'],
  );
  assert.equal(receipt.diagnostics.lifecycle.dispatchFailureFree, false);
  assert.equal(receipt.diagnostics.lifecycleComplete, false);
  assert.equal(receipt.diagnostics.topologyComplete, true);
  assert.equal(receipt.diagnostics.joinComplete, true);
  assert.equal(validateRcd2AuthoritativeReceipt(receipt, signingKey).valid, true);

  const allTrue = structuredClone(receipt);
  for (const group of ['lifecycle', 'topology', 'joins']) {
    for (const key of Object.keys(allTrue.diagnostics[group])) {
      allTrue.diagnostics[group][key] = true;
    }
  }
  allTrue.diagnostics.lifecycleComplete = true;
  allTrue.diagnostics.topologyComplete = true;
  allTrue.diagnostics.joinComplete = true;
  resign(allTrue);
  assert.deepEqual(
    validateRcd2AuthoritativeReceipt(allTrue, signingKey),
    { valid: false, reason: 'invalid-diagnostics' },
  );
});

test('R-CD-2 rejects unsigned and signed receipt extension fields by exact shape', () => {
  const variants = [
    ['traceId', 'b'.repeat(32)],
    ['privateSession', 'agent:main:private'],
    ['forensic', { traceId: 'b'.repeat(32) }],
  ];
  for (const [key, value] of variants) {
    const receipt = resolveRcd2AuthoritativeReceipt({
      evidence: evidence(), correlation: correlation(), signingKey,
    });
    receipt[key] = value;
    assert.deepEqual(
      validateRcd2AuthoritativeReceipt(receipt, signingKey),
      { valid: false, reason: 'invalid-shape' },
    );
  }

  for (const rowEvidence of [
    evidence({ session_created: false }),
    evidence({ dispatch_failure_observed: true, failureCategory: 'provider-or-turn-failure' }),
  ]) {
    const receipt = resolveRcd2AuthoritativeReceipt({
      evidence: rowEvidence, correlation: correlation(), signingKey,
    });
    receipt.traceId = 'b'.repeat(32);
    assert.deepEqual(
      validateRcd2AuthoritativeReceipt(receipt, signingKey),
      { valid: false, reason: 'invalid-shape' },
    );
  }

  const both = resolveRcd2AuthoritativeReceipt({
    evidence: evidence(), correlation: correlation(), signingKey,
  });
  both.traceId = 'b'.repeat(32);
  both.privateSession = 'agent:main:private';
  assert.deepEqual(
    validateRcd2AuthoritativeReceipt(both, signingKey),
    { valid: false, reason: 'invalid-shape' },
  );

  for (const mutate of [
    (receipt) => { receipt.binding.unsigned = true; },
    (receipt) => { receipt.integrity.unsigned = true; },
    (receipt) => { receipt.identity.unsigned = true; },
    (receipt) => { receipt.identity.harness.unsigned = true; },
    (receipt) => { receipt.lifecycle.unsigned = true; },
    (receipt) => { receipt.diagnostics.lifecycle.unsigned = true; },
  ]) {
    const receipt = resolveRcd2AuthoritativeReceipt({
      evidence: evidence(), correlation: correlation(), signingKey,
    });
    mutate(receipt);
    resign(receipt);
    assert.deepEqual(
      validateRcd2AuthoritativeReceipt(receipt, signingKey),
      { valid: false, reason: 'invalid-shape' },
    );
  }
});

test('R-CD-2 requires a valid wake fingerprint distinct from the accepted send run', () => {
  for (const wake_run_fingerprint of [run, null, 'malformed']) {
    const receipt = resolveRcd2AuthoritativeReceipt({
      evidence: evidence({ wake_run_fingerprint }),
      correlation: correlation(),
      signingKey,
    });
    assert.notEqual(receipt.verdict, 'PASS-candidate');
    assert.equal(receipt.diagnostics.lifecycle.wakeRunFingerprint, wake_run_fingerprint === run);
    assert.equal(receipt.diagnostics.lifecycle.distinctWakeRun, false);
    assert.equal(receipt.failureCategory, 'missing-send-run-lifecycle');
  }
  assert.equal(
    resolveRcd2AuthoritativeReceipt({
      evidence: evidence(), correlation: correlation(), signingKey,
    }).verdict,
    'PASS-candidate',
  );
  const derivedWithoutSuppliedCopy = resolveRcd2AuthoritativeReceipt({
    evidence: evidence({ row_nonce_fingerprint: undefined }),
    correlation: correlation(),
    signingKey,
  });
  assert.equal(derivedWithoutSuppliedCopy.verdict, 'PASS-candidate');
  assert.equal(derivedWithoutSuppliedCopy.lifecycle.rowNonceFingerprint, rowNonceFingerprint);
});

test('R-CD-2 rejects a consistently copied nonce fingerprint not derived from private evidence', () => {
  const wrongFingerprint = 'e'.repeat(16);
  assert.throws(
    () => resolveRcd2AuthoritativeReceipt({
      evidence: evidence({ row_nonce_fingerprint: wrongFingerprint }),
      correlation: correlation({
        rowBinding: {
          acceptedSendRunFingerprint: run,
          nonceFingerprint: wrongFingerprint,
          acceptedSendTraceId: 'b'.repeat(32),
          acceptedSendTraceSource: 'sessions-send-response',
        },
      }),
      signingKey,
    }),
    /immutable acquisition receipt invalid/u,
  );
});

test('R-CD-2 classifies every diagnostic failure by its owning group', () => {
  const lifecycleCases = [
    ['sessionCreated', { session_created: false }, 'missing-send-run-lifecycle'],
    ['sessionUnbound', { session_unbound_confirmed: false }, 'missing-send-run-lifecycle'],
    ['sendAccepted', { send_accepted: false }, 'missing-send-run-lifecycle'],
    ['sendRunCaptured', { send_run_captured: false }, 'missing-send-run-lifecycle'],
    ['dispatchTerminalSentinel', { dispatch_terminal_sentinel_observed: false }, 'missing-terminal-sentinel'],
    ['dispatchTerminalSentinelSameRun', { dispatch_terminal_sentinel_same_run_window: false }, 'missing-terminal-sentinel'],
    ['terminalSuccessSameRun', { terminal_success_same_run: false }, 'missing-send-run-lifecycle'],
    ['typedDelegateSuccessSameRun', { typed_delegate_success_same_run: false }, 'missing-send-run-lifecycle'],
    ['typedDelegateFailureFree', {
      typed_delegate_failed_same_run: true,
      typed_delegate_failure_category: 'codex_dynamic_tool_error',
    }, 'provider-or-turn-failure'],
    ['replaySafe', {
      replay_invalid_observed: true,
      failureCategory: 'delegate-replay-unsafe',
    }, 'delegate-replay-unsafe'],
    ['wakeLifecycle', { wake_lifecycle_observed: false }, 'missing-send-run-lifecycle'],
    ['wakeSessionBound', { wake_session_bound: false }, 'missing-send-run-lifecycle'],
    ['postWakeQuiet', { post_wake_quiet: false }, 'missing-send-run-lifecycle'],
    ['noChannelDelivery', { channel_message_observed: true }, 'silent-channel-delivery'],
    ['sendRunFingerprint', { send_run_fingerprint: 'bad' }, 'missing-send-run-lifecycle'],
    ['wakeRunFingerprint', { wake_run_fingerprint: 'bad' }, 'missing-send-run-lifecycle'],
    ['distinctWakeRun', { wake_run_fingerprint: run }, 'missing-send-run-lifecycle'],
    ['rowNonceFingerprint', { row_nonce_fingerprint: 'e'.repeat(16) }, 'missing-send-run-lifecycle'],
    ['terminalRunMatchesSend', { send_run_mismatch: true }, 'send-run-mismatch'],
    ['acceptedSendTraceShape', { accepted_send_trace_id: 'bad' }, 'missing-send-run-lifecycle'],
    ['dispatchAcceptedBeforeSentinel', { dispatch_accepted_at_ms: 201 }, 'missing-send-run-lifecycle'],
    ['sentinelBeforeLifecycleEnd', { dispatch_terminal_sentinel_at_ms: 301 }, 'missing-send-run-lifecycle'],
    ['lifecycleEndBeforeWake', { dispatch_lifecycle_end_at_ms: 401 }, 'missing-send-run-lifecycle'],
    ['wakeBeforeQuietWindow', { wake_lifecycle_at_ms: 501 }, 'missing-send-run-lifecycle'],
    ['dispatchFailureFree', {
      dispatch_failure_observed: true,
      failureCategory: 'provider-or-turn-failure',
    }, 'provider-or-turn-failure'],
  ];
  for (const [gate, override, category] of lifecycleCases) {
    if (gate === 'sendRunFingerprint') {
      assert.throws(
        () => resolveRcd2AuthoritativeReceipt({
          evidence: evidence(override), correlation: correlation(), signingKey,
        }),
        /immutable acquisition receipt invalid/u,
        gate,
      );
      continue;
    }
    const receipt = resolveRcd2AuthoritativeReceipt({
      evidence: evidence(override), correlation: correlation(), signingKey,
    });
    assert.notEqual(receipt.verdict, 'PASS-candidate', gate);
    assert.equal(receipt.diagnostics.lifecycle[gate], false, gate);
    assert.equal(receipt.diagnostics.lifecycleComplete, false, gate);
    assert.equal(receipt.failureCategory, category, gate);
    assert.equal(validateRcd2AuthoritativeReceipt(receipt, signingKey).valid, true, gate);
  }

  const topologyCases = [
    ['typedTool', { continuation: { tool: 'continue_work' } }],
    ['silentWake', { delegate: { mode: 'normal' } }],
    ['exactlyOneToolSpan', { toolSpanIds: ['a'.repeat(16), 'e'.repeat(16)] }],
    ['traceId', { traceId: 'bad' }],
    ['chainId', { chainId: '' }],
    ['dispatchSpan', { dispatchSpanId: 'bad' }],
    ['fireSpan', { fireSpanId: 'bad' }],
    ['distinctDispatchAndFire', { fireSpanId: 'c'.repeat(16) }],
    ['sendRunBinding', { rowBinding: {
      acceptedSendRunFingerprint: 'bad',
      nonceFingerprint: rowNonceFingerprint,
      acceptedSendTraceId: 'b'.repeat(32),
      acceptedSendTraceSource: 'sessions-send-response',
    } }],
    ['nonceBinding', { rowBinding: {
      acceptedSendRunFingerprint: run,
      nonceFingerprint: 'bad',
      acceptedSendTraceId: 'b'.repeat(32),
      acceptedSendTraceSource: 'sessions-send-response',
    } }],
    ['acceptedTraceBinding', { rowBinding: {
      acceptedSendRunFingerprint: run,
      nonceFingerprint: rowNonceFingerprint,
      acceptedSendTraceId: 'bad',
      acceptedSendTraceSource: 'sessions-send-response',
    } }],
    ['acceptedTraceSource', { rowBinding: {
      acceptedSendRunFingerprint: run,
      nonceFingerprint: rowNonceFingerprint,
      acceptedSendTraceId: 'b'.repeat(32),
      acceptedSendTraceSource: 'nearby-trace',
    } }],
    ['collectorUnique', {
      uniqueness: { acceptedTraceCount: 2, resultClass: 'ambiguous' },
    }],
  ];
  for (const [gate, override] of topologyCases) {
    assert.throws(
      () => resolveRcd2AuthoritativeReceipt({
        evidence: evidence(), correlation: correlation(override), signingKey,
      }),
      /immutable acquisition receipt invalid/u,
      gate,
    );
  }
});

test('R-CD-2 classifies missing correlation and each valid-topology join mismatch', () => {
  const missing = resolveRcd2AuthoritativeReceipt({
    evidence: evidence(), correlation: null, signingKey,
  });
  assert.deepEqual(
    [missing.verdict, missing.failureCategory],
    ['PARTIAL-candidate', 'missing-continuation-topology'],
  );
  assert.equal(missing.diagnostics.topologyComplete, false);
  assert.equal(validateRcd2AuthoritativeReceipt(missing, signingKey).valid, true);

  const cases = [
    ['acceptedTrace', evidence({ accepted_send_trace_id: 'e'.repeat(32) }), correlation()],
    ['acceptedRun', evidence(), correlation({ rowBinding: {
      acceptedSendRunFingerprint: 'f'.repeat(16),
      nonceFingerprint: rowNonceFingerprint,
      acceptedSendTraceId: 'b'.repeat(32),
      acceptedSendTraceSource: 'sessions-send-response',
    } })],
    ['rowNonce', evidence(), correlation({ rowBinding: {
      acceptedSendRunFingerprint: run,
      nonceFingerprint: 'e'.repeat(16),
      acceptedSendTraceId: 'b'.repeat(32),
      acceptedSendTraceSource: 'sessions-send-response',
    } })],
  ];
  for (const [gate, rowEvidence, rowCorrelation] of cases) {
    assert.throws(
      () => resolveRcd2AuthoritativeReceipt({
        evidence: rowEvidence, correlation: rowCorrelation, signingKey,
      }),
      /immutable acquisition receipt invalid/u,
      gate,
    );
  }
});

test('R-CD-2 typed-tool failure outranks a missing sentinel', () => {
  const receipt = resolveRcd2AuthoritativeReceipt({
    evidence: evidence({
      typed_delegate_attempted_same_run: true,
      typed_delegate_success_same_run: false,
      typed_delegate_failed_same_run: true,
      typed_delegate_failure_category: 'codex_dynamic_tool_error',
      dispatch_terminal_sentinel_observed: false,
      dispatch_terminal_sentinel_same_run_window: false,
      dispatch_failure_observed: true,
      failureCategory: 'provider-or-turn-failure',
    }),
    correlation: null,
    signingKey,
  });
  assert.deepEqual(
    [receipt.verdict, receipt.failureCategory],
    ['FAIL-candidate', 'provider-or-turn-failure'],
  );
  assert.equal(receipt.diagnostics.lifecycle.typedDelegateFailureFree, false);
  assert.equal(validateRcd2AuthoritativeReceipt(receipt, signingKey).valid, true);
});

test('R-CD-2 distinguishes a proven non-attempt from an earlier lifecycle miss', () => {
  const noAttempt = resolveRcd2AuthoritativeReceipt({
    evidence: evidence({
      typed_delegate_attempted_same_run: false,
      typed_delegate_success_same_run: false,
      dispatch_terminal_sentinel_observed: false,
      dispatch_terminal_sentinel_same_run_window: false,
    }),
    correlation: null,
    signingKey,
  });
  assert.equal(noAttempt.failureCategory, 'missing-terminal-sentinel');

  const preDispatch = resolveRcd2AuthoritativeReceipt({
    evidence: evidence({
      session_created: false,
      send_accepted: false,
      send_run_captured: false,
      terminal_success_same_run: false,
      typed_delegate_attempted_same_run: false,
      typed_delegate_success_same_run: false,
      dispatch_terminal_sentinel_observed: false,
      dispatch_terminal_sentinel_same_run_window: false,
    }),
    correlation: null,
    signingKey,
  });
  assert.equal(preDispatch.failureCategory, 'missing-send-run-lifecycle');
});

test('R-CD-2 diagnostics are boolean-only and publish no private identities', () => {
  const receipt = resolveRcd2AuthoritativeReceipt({
    evidence: evidence(), correlation: correlation(), signingKey,
  });
  for (const group of ['lifecycle', 'topology', 'joins']) {
    assert.ok(Object.values(receipt.diagnostics[group]).every((value) => typeof value === 'boolean'));
  }
  assert.doesNotMatch(JSON.stringify(receipt.diagnostics), /private-chain-id|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/);
});

test('R-CD-2 diagnostic tampering invalidates the signed authority', () => {
  const receipt = resolveRcd2AuthoritativeReceipt({
    evidence: evidence(), correlation: correlation(), signingKey,
  });
  receipt.diagnostics.lifecycle.wakeLifecycle = false;
  assert.equal(validateRcd2AuthoritativeReceipt(receipt, signingKey).valid, false);
});

test('R-CD-2 rejects outer-send acceptance plus an unrelated delayed message', () => {
  const receipt = resolveRcd2AuthoritativeReceipt({
    evidence: evidence({ terminal_success_same_run: false, wake_lifecycle_observed: false, send_run_mismatch: true }),
    correlation: correlation(), signingKey,
  });
  assert.deepEqual([receipt.verdict, receipt.failureCategory], ['PARTIAL-candidate', 'send-run-mismatch']);
});

test('R-CD-2 rejects individually valid lifecycle and topology receipts from different traces', () => {
  assert.throws(
    () => resolveRcd2AuthoritativeReceipt({
      evidence: evidence({ accepted_send_trace_id: 'e'.repeat(32) }),
      correlation: correlation({ traceId: 'b'.repeat(32) }),
      signingKey,
    }),
    /immutable acquisition receipt invalid/u,
  );
});

test('R-CD-2 rejects a same-trace/chain topology with another row run or nonce', () => {
  for (const rowBinding of [
    [{
      acceptedSendRunFingerprint: 'f'.repeat(16),
      nonceFingerprint: rowNonceFingerprint,
      acceptedSendTraceId: 'b'.repeat(32),
      acceptedSendTraceSource: 'sessions-send-response',
    }],
    [{
      acceptedSendRunFingerprint: run,
      nonceFingerprint: 'f'.repeat(16),
      acceptedSendTraceId: 'b'.repeat(32),
      acceptedSendTraceSource: 'sessions-send-response',
    }],
  ]) {
    assert.throws(
      () => resolveRcd2AuthoritativeReceipt({
        evidence: evidence(),
        correlation: correlation({ rowBinding }),
        signingKey,
      }),
      /immutable acquisition receipt invalid/u,
    );
  }
});

test('R-CD-2 rejects replay failure, wrong mode, and mismatched trace topology', () => {
  const replay = resolveRcd2AuthoritativeReceipt({
    evidence: evidence({ dispatch_failure_observed: true, failureCategory: 'delegate-replay-unsafe' }),
    correlation: correlation(), signingKey,
  });
  assert.deepEqual(
    [replay.verdict, replay.failureCategory],
    ['FAIL-candidate', 'delegate-replay-unsafe'],
  );
  assert.equal(validateRcd2AuthoritativeReceipt(replay, signingKey).valid, true);
  for (const bad of [correlation({ delegate: { mode: 'normal' } }), correlation({ toolSpanIds: ['a'.repeat(16), 'b'.repeat(16)] })]) {
    assert.throws(
      () => resolveRcd2AuthoritativeReceipt({ evidence: evidence(), correlation: bad, signingKey }),
      /immutable acquisition receipt invalid/u,
    );
  }
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

test('legacy R-CD-2 writer and postprocessor reject receipts without complete run identity', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'r-cd-2-authoritative-'));
  try {
    const receipt = resolveRcd2AuthoritativeReceipt({ evidence: evidence(), correlation: correlation(), signingKey });
    const receiptPath = path.join(dir, 'receipt.json');
    const logPath = path.join(dir, 'k6.log');
    const summaryPath = path.join(dir, 'summary.json');
    await writeFile(receiptPath, JSON.stringify(receipt));
    await writeFile(logPath, '--- R-CD-2 EVIDENCE SUMMARY ---\n{"row":"R-CD-2","redacted_events":[]}\n--- END EVIDENCE ---\n');
    await writeFile(summaryPath, JSON.stringify({ metrics: { proof_failures: { values: { count: 0 } }, checks: { values: { rate: 1 } } } }));
    const env = { ...process.env, OPENCLAW_GATEWAY_TOKEN: signingKey };
    await assert.rejects(
      execFileAsync(process.execPath, [writerPath, '--input', logPath, '--row', 'R-CD-2', '--seat', 'unit', '--sha', 'a'.repeat(40), '--manifest', manifestPath, '--authoritative-receipt', receiptPath], { cwd: dir, env }),
      /complete runner identity/,
    );
    await assert.rejects(
      execFileAsync(process.execPath, [postprocessorPath, '--manifest', manifestPath, '--summary', summaryPath, '--out-root', path.join(dir, 'post'), '--run-id', 'unit', '--authoritative-receipt', receiptPath], { cwd: dir, env }),
      /complete runner identity/,
    );
    await assert.rejects(execFileAsync(process.execPath, [writerPath, '--input', logPath, '--row', 'R-CD-2', '--seat', 'unit', '--sha', 'a'.repeat(40)], { cwd: dir, env }));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('every production R-CD-2 receipt consumer binds or rejects complete run identity', async () => {
  const sources = new Map(await Promise.all([
    'candidate-run-result-contract.mjs',
    'render-run-report.mjs',
    'evidence-writer.mjs',
    'postprocess-k6-summary.mjs',
  ].map(async (name) => [
    name,
    await readFile(path.join(repoRoot, 'scripts', name), 'utf8'),
  ])));
  for (const name of ['candidate-run-result-contract.mjs', 'render-run-report.mjs']) {
    const source = sources.get(name);
    assert.match(source, /r-cd-2-authority-context/);
    assert.match(source, /consumeRcd2Authority/);
  }
  for (const name of ['evidence-writer.mjs', 'postprocess-k6-summary.mjs']) {
    assert.match(
      sources.get(name),
      /R-CD-2 requires complete runner identity/,
    );
  }
});
