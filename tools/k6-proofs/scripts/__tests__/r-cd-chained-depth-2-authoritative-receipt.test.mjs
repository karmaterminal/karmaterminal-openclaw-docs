import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  resolveRcdChainAuthoritativeReceipt,
  validateRcdChainAuthoritativeReceipt,
} from '../../lib/r-cd-chained-depth-2-authoritative-receipt.mjs';
import {
  rCdChainRootLifecycleStart,
  rCdChainRootReturnAcceptance,
  rCdChainRootReturnCandidate,
  rCdChainRootReturnReceipt,
} from '../../lib/r-cd-chained-depth-2-authority.mjs';

const execFileAsync = promisify(execFile);
const signingKey = 'r-cd-chain-authoritative-receipt-test-key';
const fixture = JSON.parse(await readFile(
  new URL('../../tests/fixtures/r-cd-chained-depth-2-run-32981265676.json', import.meta.url),
  'utf8',
));
const lostAncestryFixture = JSON.parse(await readFile(
  new URL(
    '../../tests/fixtures/r-cd-chained-depth-2-run-32958479691-lost-ancestry.json',
    import.meta.url,
  ),
  'utf8',
));

function privateEvidence(overrides = {}) {
  const control = fixture.structuredControl;
  const lifecycleStart = rCdChainRootLifecycleStart({
    eventName: control.lifecycleStartEvent.eventName,
    eventData: control.lifecycleStartEvent.eventData,
    rootSessionKey: control.rootSessionKey,
    taskLedgerReceipt: control.taskLedgerReceipt,
    dispatchRunId: control.dispatchRunId,
    observedAtMs: control.lifecycleStartEvent.observedAtMs,
  });
  const candidate = rCdChainRootReturnCandidate({
    eventName: control.consumptionInputEvent.eventName,
    eventData: control.consumptionInputEvent.eventData,
    rootSessionKey: control.rootSessionKey,
    nonce: control.nonce,
    taskLedgerReceipt: control.taskLedgerReceipt,
    dispatchRunId: control.dispatchRunId,
    lifecycleRunId: lifecycleStart.runId,
    lifecycleStartedAtMs: lifecycleStart.startedAtMs,
    observedAtMs: control.consumptionInputEvent.observedAtMs,
  });
  const acceptance = rCdChainRootReturnAcceptance(candidate, {
    eventName: control.acceptedEvent.eventName,
    eventData: control.acceptedEvent.eventData,
    observedAtMs: control.acceptedEvent.observedAtMs,
  });
  const receipt = rCdChainRootReturnReceipt(acceptance, {
    childSessionKey: control.childSessionKey,
    grandchildSessionKey: control.grandchildSessionKey,
    eventName: control.lifecycleEndEvent.eventName,
    eventData: control.lifecycleEndEvent.eventData,
    observedAtMs: control.lifecycleEndEvent.observedAtMs,
  });
  return {
    row: 'R-CD-CHAINED-DEPTH-2',
    candidateSha: fixture.source.candidateSha,
    runtimeBuildSha: fixture.source.candidateSha,
    parent_dispatch_accepted: true,
    dispatch_run_captured: true,
    task_pagination_exhausted: true,
    tasks_list_rejected: 0,
    task_snapshot_stable_count: 2,
    accepted_dispatch_run_id: control.dispatchRunId,
    child_spawned: true,
    grandchild_spawned: true,
    child_waiting_sentinel: true,
    depth1_recovery_wake_scheduled: true,
    child_done_sentinel: true,
    grandchild_done_sentinel: true,
    chain_return_received: true,
    max_depth_observed: 2,
    child_session: control.childSessionKey,
    grandchild_session: control.grandchildSessionKey,
    reason_hash: 'c1cba549998dc735',
    reason_length: 915,
    task_ledger_receipt: control.taskLedgerReceipt,
    root_return_candidate: candidate,
    root_return_acceptance: acceptance,
    root_return_receipt: receipt,
    ...overrides,
  };
}

function correlation(overrides = {}) {
  return {
    row: 'R-CD-CHAINED-DEPTH-2',
    continuation: { tool: 'continue_delegate' },
    delegate: { mode: 'silent-wake' },
    traceId: 'a'.repeat(32),
    chainId: 'chain-run-32981265676',
    toolSpanIds: ['b'.repeat(16)],
    dispatchSpanId: 'c'.repeat(16),
    fireSpanId: 'd'.repeat(16),
    reason: { hash: 'c1cba549998dc735', length: 915 },
    ...overrides,
  };
}

test('run 32981265676 structured successor passes without arbitrary prose echo', () => {
  const evidence = privateEvidence();
  const receipt = resolveRcdChainAuthoritativeReceipt({
    evidence,
    correlation: correlation(),
    signingKey,
  });

  assert.equal(receipt.verdict, 'PASS-candidate');
  assert.equal(receipt.lifecycle.assistantSentinelObserved, false);
  assert.equal(validateRcdChainAuthoritativeReceipt(receipt, signingKey).valid, true);
  const serialized = JSON.stringify(receipt);
  for (const privateValue of [
    evidence.task_ledger_receipt.nonce,
    evidence.task_ledger_receipt.rootSessionKey,
    evidence.task_ledger_receipt.childSessionKey,
    evidence.task_ledger_receipt.grandchildSessionKey,
    ...evidence.task_ledger_receipt.taskIds,
    ...evidence.task_ledger_receipt.runIds,
    evidence.accepted_dispatch_run_id,
    evidence.root_return_receipt.consumptionRunId,
  ]) {
    assert.doesNotMatch(serialized, new RegExp(privateValue));
  }
});

test('structured tasks without post-return root consumption remain red', () => {
  const receipt = resolveRcdChainAuthoritativeReceipt({
    evidence: privateEvidence({
      root_return_receipt: null,
      chain_return_received: false,
      child_done_sentinel: false,
    }),
    correlation: correlation(),
    signingKey,
  });

  test('predecessor run 32958479691 lost-ancestry artifact remains red', () => {
    const source = lostAncestryFixture.source;
    const rejected = lostAncestryFixture.rejectedPublicEvidence;
    const receipt = resolveRcdChainAuthoritativeReceipt({
      evidence: {
        row: 'R-CD-CHAINED-DEPTH-2',
        candidateSha: source.candidateSha,
        runtimeBuildSha: source.candidateSha,
        parent_dispatch_accepted: rejected.parent_dispatch_accepted,
        dispatch_run_captured: true,
        task_pagination_exhausted: true,
        tasks_list_rejected: 0,
        task_snapshot_stable_count: 2,
        accepted_dispatch_run_id: 'predecessor-dispatch-run',
        child_spawned: rejected.child_spawned,
        grandchild_spawned: rejected.grandchild_spawned,
        child_waiting_sentinel: rejected.child_waiting_sentinel,
        depth1_recovery_wake_scheduled: rejected.depth1_recovery_wake_scheduled,
        child_done_sentinel: rejected.child_done_sentinel,
        grandchild_done_sentinel: rejected.grandchild_done_sentinel,
        chain_return_received: rejected.chain_return_received,
        max_depth_observed: rejected.max_depth_observed,
        reason_hash: rejected.reason_hash,
        reason_length: rejected.reason_length,
        task_ledger_receipt: lostAncestryFixture.structuredControl.taskLedgerReceipt,
        root_return_receipt: lostAncestryFixture.structuredControl.rootConsumptionReceipt,
      },
      correlation: correlation({
        reason: { hash: rejected.reason_hash, length: rejected.reason_length },
      }),
      signingKey,
    });
    assert.deepEqual(
      [receipt.verdict, receipt.failureCategory],
      ['PARTIAL-candidate', 'missing-or-invalid-task-ledger'],
    );
    assert.equal(validateRcdChainAuthoritativeReceipt(receipt, signingKey).valid, true);
  });
  assert.deepEqual(
    [receipt.verdict, receipt.failureCategory],
    ['PARTIAL-candidate', 'missing-or-invalid-root-consumption'],
  );
  assert.equal(validateRcdChainAuthoritativeReceipt(receipt, signingKey).valid, true);
});

test('wrong candidate identity is a signed FAIL and cannot become a PASS', () => {
  const receipt = resolveRcdChainAuthoritativeReceipt({
    evidence: privateEvidence({ runtimeBuildSha: 'e'.repeat(40) }),
    correlation: correlation(),
    signingKey,
  });
  assert.deepEqual(
    [receipt.verdict, receipt.failureCategory],
    ['FAIL-candidate', 'candidate-identity-mismatch'],
  );
  assert.equal(validateRcdChainAuthoritativeReceipt(receipt, signingKey).valid, true);
});

test('missing or wrong typed-tool topology remains non-PASS', () => {
  for (const topology of [
    null,
    correlation({ delegate: { mode: 'normal' } }),
    correlation({ reason: { hash: 'f'.repeat(16), length: 915 } }),
  ]) {
    const receipt = resolveRcdChainAuthoritativeReceipt({
      evidence: privateEvidence(),
      correlation: topology,
      signingKey,
    });
    assert.deepEqual(
      [receipt.verdict, receipt.failureCategory],
      ['PARTIAL-candidate', 'missing-or-invalid-continuation-topology'],
    );
  }
});

test('receipt integrity rejects public sidecar tampering', () => {
  const receipt = resolveRcdChainAuthoritativeReceipt({
    evidence: privateEvidence(),
    correlation: correlation(),
    signingKey,
  });
  receipt.lifecycle.maxDepth = 1;
  assert.equal(
    validateRcdChainAuthoritativeReceipt(receipt, signingKey).reason,
    'invalid-integrity',
  );
});

test('receipt shape rejects unsigned fields before public copy', () => {
  const receipt = resolveRcdChainAuthoritativeReceipt({
    evidence: privateEvidence(),
    correlation: correlation(),
    signingKey,
  });
  receipt.rawSessionKey = privateEvidence().task_ledger_receipt.rootSessionKey;
  assert.equal(
    validateRcdChainAuthoritativeReceipt(receipt, signingKey).reason,
    'invalid-shape',
  );
});

test('row-scoped resolver writes the signed public receipt', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'r-cd-chain-receipt-'));
  try {
    const evidencePath = path.join(root, 'private-evidence.json');
    const correlationPath = path.join(root, 'correlation.json');
    await writeFile(evidencePath, JSON.stringify(privateEvidence()));
    await writeFile(correlationPath, JSON.stringify(correlation()));
    const resolver = path.resolve(
      'tools/k6-proofs/scripts/resolve-r-cd-chained-depth-2-authoritative-receipt.mjs',
    );
    const result = await execFileAsync(process.execPath, [
      resolver,
      '--run-dir',
      root,
      '--evidence',
      evidencePath,
      '--correlation',
      correlationPath,
    ], {
      env: { ...process.env, OPENCLAW_GATEWAY_TOKEN: signingKey },
    });
    assert.equal(JSON.parse(result.stdout).verdict, 'PASS-candidate');
    const receipt = JSON.parse(await readFile(
      path.join(root, 'r-cd-chained-depth-2-authoritative-receipt.json'),
      'utf8',
    ));
    assert.equal(validateRcdChainAuthoritativeReceipt(receipt, signingKey).valid, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('writer and summary postprocessor preserve chain receipt as sole authority', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'r-cd-chain-writer-'));
  try {
    const evidence = privateEvidence();
    const receipt = resolveRcdChainAuthoritativeReceipt({
      evidence,
      correlation: correlation(),
      signingKey,
    });
    const receiptPath = path.join(root, 'receipt.json');
    const logPath = path.join(root, 'k6.log');
    const summaryPath = path.join(root, 'summary.json');
    const manifestPath = path.join(root, 'manifest.json');
    const manifest = {
      schema: 'openclaw.k6.proof-row-manifest.v1',
      rowId: 'R-CD-CHAINED-DEPTH-2',
      candidateSha: fixture.source.candidateSha,
      seat: 'unit',
      transport: 'websocket',
      toolSurface: 'typed-tool',
      mutates: false,
      scenario: { name: 'r-cd-chained-depth-2' },
      artifactDestination: {
        root: path.join(root, 'post'),
        sha: fixture.source.candidateSha,
        row: 'R-CD-CHAINED-DEPTH-2',
        seat: 'unit',
        runDirPrefix: 'unit',
      },
      review: { candidateOnly: true, foldRequiresReview: true },
      liveRunSafety: {
        expectedArtifactClass: 'PASS-candidate',
        foldRequiresReview: true,
        requiredReceipts: ['r-cd-chained-depth-2-authoritative-receipt'],
      },
    };
    await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
    await writeFile(
      logPath,
      `--- R-CD-CHAINED-DEPTH-2 EVIDENCE SUMMARY ---\n${JSON.stringify(evidence)}\n--- END EVIDENCE ---\n`,
    );
    await writeFile(summaryPath, JSON.stringify({
      verdict: 'PARTIAL-candidate',
      metrics: {
        proof_failures: { values: { count: 0 } },
        checks: { values: { rate: 1 } },
      },
    }));
    await writeFile(manifestPath, JSON.stringify(manifest));
    const env = { ...process.env, OPENCLAW_GATEWAY_TOKEN: signingKey };

    const writer = path.resolve('tools/k6-proofs/scripts/evidence-writer.mjs');
    const written = await execFileAsync(process.execPath, [
      writer,
      '--input', logPath,
      '--row', 'R-CD-CHAINED-DEPTH-2',
      '--seat', 'unit',
      '--sha', fixture.source.candidateSha,
      '--manifest', manifestPath,
      '--authoritative-receipt', receiptPath,
    ], { cwd: root, env });
    const writerDir = path.join(root, JSON.parse(written.stdout).runDir);
    const writerResult = JSON.parse(await readFile(
      path.join(writerDir, 'row-result.json'),
      'utf8',
    ));
    assert.equal(writerResult.outcome, 'PASS-candidate');
    assert.equal(
      writerResult.verdictSource,
      'r-cd-chained-depth-2-authoritative-receipt',
    );
    await readFile(
      path.join(writerDir, 'r-cd-chained-depth-2-authoritative-receipt.json'),
    );

    const postprocessor = path.resolve(
      'tools/k6-proofs/scripts/postprocess-k6-summary.mjs',
    );
    const post = await execFileAsync(process.execPath, [
      postprocessor,
      '--manifest', manifestPath,
      '--summary', summaryPath,
      '--out-root', path.join(root, 'post'),
      '--run-id', 'unit-run',
      '--authoritative-receipt', receiptPath,
    ], { cwd: root, env });
    const postDir = JSON.parse(post.stdout).runDir;
    const postResult = JSON.parse(await readFile(
      path.join(postDir, 'row-result.json'),
      'utf8',
    ));
    assert.equal(postResult.outcome, 'PASS-candidate');
    assert.equal(
      postResult.verdictSource,
      'r-cd-chained-depth-2-authoritative-receipt',
    );

    await assert.rejects(execFileAsync(process.execPath, [
      writer,
      '--input', logPath,
      '--row', 'R-CD-CHAINED-DEPTH-2',
      '--seat', 'unit',
      '--sha', 'f'.repeat(40),
      '--manifest', manifestPath,
      '--authoritative-receipt', receiptPath,
    ], { cwd: root, env }), /candidate identity mismatch/);

    const wrongManifestPath = path.join(root, 'wrong-manifest.json');
    await writeFile(
      wrongManifestPath,
      JSON.stringify({ ...manifest, candidateSha: 'f'.repeat(40) }),
    );
    await assert.rejects(execFileAsync(process.execPath, [
      postprocessor,
      '--manifest', wrongManifestPath,
      '--summary', summaryPath,
      '--out-root', path.join(root, 'wrong-post'),
      '--run-id', 'wrong-run',
      '--authoritative-receipt', receiptPath,
    ], { cwd: root, env }), /candidate identity mismatch/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
