import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  rCd2AuthorityIdentity,
  resolveRcd2AuthoritativeReceipt,
} from '../../../lib/r-cd-2-authoritative-receipt.mjs';
import {
  R_CD_2_SELECTION_RECEIPT_FILE,
  signRcd2SelectedContextReceipt,
} from '../../../lib/r-cd-2-authority-context.mjs';

export const SIGNING_KEY = 'r-cd-2-authority-consumer-test-key';
export const BASE = Object.freeze({
  candidateSha: '1'.repeat(40),
  runtimeBuildSha: '1'.repeat(40),
  docsRef: '2'.repeat(40),
  repository: 'karmaterminal/karmaterminal-openclaw-docs',
  seat: 'ronan-dgx',
  matrixId: '20260905T075237Z-222222222222-deadbeef',
  runId: '20260905T075300Z-r-cd-2-deadbeef',
  row: 'R-CD-2',
  scenario: 'r-cd-2-silent-wake.js',
  manifestPath: 'tools/k6-proofs/manifests/r-cd-2.json',
  scenarioPath: 'tools/k6-proofs/scenarios/r-cd-2-silent-wake.js',
});

export const FOREIGN = Object.freeze({
  candidateSha: '3'.repeat(40),
  runtimeBuildSha: '4'.repeat(40),
  docsRef: '5'.repeat(40),
  repository: 'karmaterminal/foreign-docs',
  seat: 'other-seat',
  matrixId: '20260905T075400Z-555555555555-feedface',
  runId: '20260905T075401Z-r-cd-2-feedface',
  row: 'R-CW-1',
  scenario: 'r-cd-2-foreign.js',
  manifestPath: 'tools/k6-proofs/manifests/r-cd-2-foreign.json',
  scenarioPath: 'tools/k6-proofs/scenarios/r-cd-2-foreign.js',
});

export const digest = (value) => createHash('sha256').update(value).digest('hex');

export async function testWorkspace(repoRoot, prefix) {
  const root = await mkdtemp(path.join(repoRoot, `.${prefix}-`));
  return {
    root,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

function manifestFor(identity, marker = 'selected') {
  return {
    schema: 'openclaw.k6.proof-row-manifest.v1',
    rowId: identity.row,
    candidateSha: identity.candidateSha,
    seat: identity.seat,
    transport: 'websocket',
    toolSurface: 'typed-tool',
    scenario: {
      name: identity.scenario.replace(/\.js$/, ''),
      file: identity.scenario,
    },
    invocation: {
      tool: 'continue_delegate',
      mode: 'silent-wake',
      promptTemplate: 'R-CD-2 fixture {{nonce}}',
    },
    review: { candidateOnly: true, foldRequiresReview: true },
    liveRunSafety: {
      expectedArtifactClass: 'PASS-candidate',
      requiredReceipts: ['dispatch-accepted', 'parent-wake-event', 'no-channel-delivery'],
      foldRequiresReview: true,
    },
    authorityFixtureMarker: marker,
  };
}

function scenarioFor(marker = 'selected') {
  return `export const authorityFixtureMarker = ${JSON.stringify(marker)};\nexport default function () {}\n`;
}

function privateEvidence(overrides = {}) {
  const nonce = 'R-CD-2-authority-consumer-fixture';
  const runFingerprint = 'a'.repeat(16);
  return {
    row: 'R-CD-2',
    nonce,
    session_created: true,
    session_unbound_confirmed: true,
    send_accepted: true,
    send_run_captured: true,
    dispatch_terminal_sentinel_observed: true,
    dispatch_terminal_sentinel_same_run_window: true,
    terminal_success_same_run: true,
    typed_delegate_attempted_same_run: true,
    typed_delegate_success_same_run: true,
    typed_delegate_failed_same_run: false,
    replay_invalid_observed: false,
    wake_lifecycle_observed: true,
    wake_session_bound: true,
    post_wake_quiet: true,
    channel_message_observed: false,
    dispatch_failure_observed: false,
    send_run_fingerprint: runFingerprint,
    terminal_run_fingerprint: runFingerprint,
    wake_run_fingerprint: 'b'.repeat(16),
    row_nonce_fingerprint: digest(nonce).slice(0, 16),
    accepted_send_trace_id: null,
    dispatch_accepted_at_ms: 100,
    dispatch_terminal_sentinel_at_ms: 200,
    dispatch_lifecycle_end_at_ms: 300,
    wake_lifecycle_at_ms: 400,
    post_wake_quiet_at_ms: 500,
    ...overrides,
  };
}

function correlation(evidence, overrides = {}) {
  const traceId = 'c'.repeat(32);
  return {
    row: 'R-CD-2',
    continuation: { tool: 'continue_delegate' },
    delegate: { mode: 'silent-wake' },
    sameTrace: true,
    sameChain: true,
    toolSpanIds: ['d'.repeat(16)],
    resultClass: 'unique',
    traceId,
    chainId: 'public-safe-chain',
    dispatchSpanId: 'e'.repeat(16),
    fireSpanId: 'f'.repeat(16),
    rowBinding: {
      acceptedSendRunFingerprint: evidence.send_run_fingerprint,
      nonceFingerprint: evidence.row_nonce_fingerprint,
      acceptedSendTraceId: traceId,
      acceptedSendTraceSource: 'unique-reason-bound-trace',
    },
    ...overrides,
  };
}

function envelopeFor(identity, harness, receiptSha256, verdict) {
  return {
    schema: 'openclaw.k6.candidate-run-result.v1',
    candidateOnly: true,
    foldRequiresReview: true,
    canonicalFoldForbidden: true,
    candidate: { sha: identity.candidateSha, docsRef: identity.docsRef },
    harness: {
      docsRef: identity.docsRef,
      repository: identity.repository,
      ...harness,
      manifestArtifact: 'row-manifest.json',
      scenarioArtifact: 'row-scenario.js',
    },
    run: {
      id: identity.runId,
      rowId: identity.row,
      seat: identity.seat,
      scenario: identity.scenario.replace(/\.js$/, ''),
      executionKind: 'row-list-runner',
    },
    result: {
      outcome: verdict,
      outcomeSource: 'r-cd-2-authoritative-receipt',
      effectiveExitCode: 0,
      behaviorProof: false,
    },
    observability: {
      traceStatus: 'r-cd-2-authoritative-receipt',
      traceCaptured: false,
      correlationReceiptPresent: false,
    },
    authoritativeReceipt: {
      file: 'r-cd-2-authoritative-receipt.json',
      sha256: receiptSha256,
    },
    review: { status: 'ready-for-human-review', pendingReceipts: [], complete: true },
    artifacts: {
      manifest: 'row-manifest.json',
      scenario: 'row-scenario.js',
      runnerMetadata: 'runner-metadata.json',
      runResult: 'run-result.json',
      files: [
        'row-manifest.json',
        'row-scenario.js',
        'runner-metadata.json',
        'run-result.json',
        R_CD_2_SELECTION_RECEIPT_FILE,
        'r-cd-2-authoritative-receipt.json',
        'r-cd-2-summary.json',
        'evidence.jsonl',
      ],
      tempoTraceJson: null,
      correlationReceipt: null,
    },
  };
}

export async function writeRcd2Bundle(repoRoot, {
  pathIdentity = {},
  claimIdentity = {},
  selectedIdentity = {},
  verdict = 'PASS-candidate',
  includeReceipt = true,
  includeEnvelope = true,
  summaryVerdict = 'PARTIAL-candidate',
  manifestMarker = 'selected',
  scenarioMarker = 'selected',
} = {}) {
  const workspace = await testWorkspace(repoRoot, 'rcd2-authority-consumer');
  const selected = { ...BASE, ...selectedIdentity };
  const claimed = { ...BASE, ...claimIdentity };
  const located = { ...BASE, ...pathIdentity };
  const runDir = path.join(
    workspace.root,
    located.candidateSha,
    located.row,
    located.seat,
    located.runId,
  );
  await mkdir(runDir, { recursive: true });

  const manifest = manifestFor(claimed, manifestMarker);
  const manifestBody = `${JSON.stringify(manifest, null, 2)}\n`;
  const scenarioBody = scenarioFor(scenarioMarker);
  const harness = {
    manifestPath: claimed.manifestPath,
    manifestSha256: digest(manifestBody),
    scenarioPath: claimed.scenarioPath,
    scenarioSha256: digest(scenarioBody),
  };
  const metadata = {
    row: claimed.row,
    scenario: claimed.scenario,
    candidateSha: claimed.candidateSha,
    runtimeBuildSha: claimed.runtimeBuildSha,
    seat: claimed.seat,
    docsRef: claimed.docsRef,
    repository: claimed.repository,
    matrixId: claimed.matrixId,
    runId: claimed.runId,
    ...harness,
  };
  const evidence = privateEvidence(
    verdict === 'FAIL-candidate'
      ? { dispatch_failure_observed: true, failureCategory: 'provider-or-turn-failure' }
      : {},
  );
  const authorityIdentity = rCd2AuthorityIdentity(metadata, claimed.runId);
  const traceCorrelation = verdict === 'PARTIAL-candidate'
    ? null
    : { ...correlation(evidence), authorityIdentity };
  const receipt = resolveRcd2AuthoritativeReceipt({
    evidence,
    correlation: traceCorrelation,
    identity: authorityIdentity,
    signingKey: SIGNING_KEY,
  });
  if (receipt.verdict !== verdict) {
    throw new Error(`fixture requested ${verdict}, resolver produced ${receipt.verdict}`);
  }
  const receiptBody = `${JSON.stringify(receipt, null, 2)}\n`;
  const receiptSha256 = digest(receiptBody);
  const runResult = {
    k6ExitCode: 0,
    postprocessExitCode: 0,
    effectiveExitCode: 0,
    verdict,
    verdictSource: 'r-cd-2-authoritative-receipt',
    summaryFileVerdict: summaryVerdict,
    candidateOnly: true,
    foldRequiresReview: true,
    authoritativeReceipt: includeReceipt ? {
      file: 'r-cd-2-authoritative-receipt.json',
      sha256: receiptSha256,
      validated: true,
      source: 'r-cd-2-row-scoped-resolver',
    } : null,
    observability: {
      traceStatus: 'r-cd-2-authoritative-receipt',
      traceId: null,
      tempoTraceJson: null,
      correlationReceipt: null,
    },
    review: { status: 'ready-for-human-review', pendingReceipts: [] },
  };
  const summary = {
    row: claimed.row,
    sha: claimed.candidateSha,
    seat: claimed.seat,
    scenario: claimed.scenario,
    matrixId: claimed.matrixId,
    runId: claimed.runId,
    verdict: summaryVerdict,
    metrics: {
      failures: verdict === 'FAIL-candidate' ? 1 : 0,
      duration_ms: { avg: 1234 },
      checks: { rate: verdict === 'FAIL-candidate' ? 0 : 1 },
    },
  };
  const envelope = envelopeFor(claimed, harness, receiptSha256, verdict);
  const seatReadinessBody = `${JSON.stringify({
    schema: 'openclaw.k6.seat-readiness.v1',
    outcome: 'PASS-candidate',
    candidate: { sha: selected.candidateSha, valid40Hex: true },
    seat: { name: selected.seat, class: 'message-body' },
  }, null, 2)}\n`;
  const selectedHarness = {
    manifestPath: selected.manifestPath,
    manifestSha256: digest(`${JSON.stringify(manifestFor(selected), null, 2)}\n`),
    scenarioPath: selected.scenarioPath,
    scenarioSha256: digest(scenarioFor()),
  };
  const selectedAuthorityIdentity = rCd2AuthorityIdentity({
    ...selected,
    ...selectedHarness,
  }, selected.runId);
  const selectionReceipt = signRcd2SelectedContextReceipt({
    identity: selectedAuthorityIdentity,
    signingKey: SIGNING_KEY,
  });
  const provenance = {
    schema: 'openclaw.k6.harness-provenance.v1',
    classification: 'harness-provenance',
    matrixId: selected.matrixId,
    mode: 'live',
    docsRef: selected.docsRef,
    docsRefSource: 'approved-input',
    repository: selected.repository,
    harnessIdentityVerified: true,
    candidateSha: selected.candidateSha,
    runtimeIdentity: {
      seat: selected.seat,
      runtimeBuildSha: selected.runtimeBuildSha,
      candidateMatchesRuntime: selected.candidateSha === selected.runtimeBuildSha,
      seatReadinessReceipt: 'seat-readiness.json',
      seatReadinessSha256: digest(seatReadinessBody),
    },
    rowSelection: [selected.row],
    rows: [{
      rowId: selected.row,
      manifestPath: selected.manifestPath,
      manifestSha256: selectedHarness.manifestSha256,
      scenarioPath: selected.scenarioPath,
      scenarioSha256: selectedHarness.scenarioSha256,
    }],
    candidateOnly: true,
    foldRequiresReview: true,
    startedAt: '2026-09-05T07:52:37Z',
  };

  await mkdir(path.join(workspace.root, 'harness-provenance'), { recursive: true });
  await Promise.all([
    writeFile(path.join(runDir, 'row-manifest.json'), manifestBody),
    writeFile(path.join(runDir, 'row-scenario.js'), scenarioBody),
    writeFile(path.join(runDir, 'runner-metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`),
    writeFile(path.join(runDir, 'run-result.json'), `${JSON.stringify(runResult, null, 2)}\n`),
    writeFile(path.join(runDir, 'r-cd-2-summary.json'), `${JSON.stringify(summary, null, 2)}\n`),
    writeFile(path.join(runDir, 'evidence.jsonl'), `${JSON.stringify({
      row: claimed.row,
      verdict,
      authoritativeReceipt: 'r-cd-2-authoritative-receipt.json',
    })}\n`),
    writeFile(path.join(runDir, 'private-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`),
    writeFile(path.join(runDir, 'continuation-trace-correlation.json'), `${JSON.stringify(
      traceCorrelation,
      null,
      2,
    )}\n`),
    writeFile(path.join(workspace.root, 'harness-provenance.json'), `${JSON.stringify(provenance, null, 2)}\n`),
    writeFile(path.join(workspace.root, 'seat-readiness.json'), seatReadinessBody),
    writeFile(path.join(runDir, 'seat-readiness.json'), seatReadinessBody),
    writeFile(
      path.join(runDir, R_CD_2_SELECTION_RECEIPT_FILE),
      `${JSON.stringify(selectionReceipt, null, 2)}\n`,
    ),
    writeFile(
      path.join(workspace.root, 'harness-provenance', `${selected.matrixId}.json`),
      `${JSON.stringify(provenance, null, 2)}\n`,
    ),
  ]);
  if (includeReceipt) {
    await writeFile(path.join(runDir, 'r-cd-2-authoritative-receipt.json'), receiptBody);
  }
  if (includeEnvelope) {
    await writeFile(path.join(runDir, 'candidate-run-result.json'), `${JSON.stringify(envelope, null, 2)}\n`);
  }
  return {
    ...workspace,
    runDir,
    selected,
    claimed,
    located,
    manifest,
    manifestBody,
    scenarioBody,
    metadata,
    evidence,
    correlation: traceCorrelation,
    receipt,
    receiptBody,
    runResult,
    summary,
    envelope,
    provenance,
    selectionReceipt,
    manifestPath: path.join(runDir, 'row-manifest.json'),
  };
}

export async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}
