import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const scenarioPath = 'tools/k6-proofs/scenarios/r-rc-2-delegate-request-compaction.js';
const postprocessorPath = path.resolve('tools/k6-proofs/scripts/postprocess-k6-summary.mjs');
const runNode = promisify(execFile);

test('R-RC-2 honest limit is bound to the child structured threshold receipt', async () => {
  const scenario = await readFile(scenarioPath, 'utf8');

  assert.match(scenario, /childSessionKeyForRow\([\s\S]*eventData,[\s\S]*rowNonce,[\s\S]*taskIdentityToken/);
  // #562: the child comes from the child observer (spawnedBy + own spawn task),
  // never from the removed task-ledger RPC; its history is read via chat.history.
  assert.match(scenario, /observer\.boundChild\(rowNonce, taskIdentityToken \? \[taskIdentityToken\] : \[\]\)/);
  assert.match(scenario, /tracker\.send\(socket, 'chat\.history', \{ sessionKey: evidence\.child_session_key/);
  assert.doesNotMatch(scenario, /tracker\.send\(socket, 'tasks\.list'/);
  assert.doesNotMatch(scenario, /tracker\.send\(socket, 'sessions\.get'/);
  assert.match(scenario, /failClosedVerdict\(outcome\.verdict, \{ gate, observer \}\)/);
  // Measured-wake shape: HONEST-LIMIT needs a measured receipt after the yield.
  assert.match(scenario, /measuredRequestCompactionOutcome\(messages, \{ rowNonce \}\)/);
  assert.match(scenario, /measured\.kind === 'threshold_rejected_measured' && measured\.yieldBound/);
  const postprocessor = await readFile(postprocessorPath, 'utf8');
  assert.match(postprocessor, /classifyRrc2Evidence\(summary\?\.evidence\)/);
  assert.doesNotMatch(postprocessor, /request_compaction_receipt_status === 'accepted'/);
  assert.doesNotMatch(scenario, /delaySeconds=0/);
  assert.match(scenario, /compactTaskIdentityToken\('RRC2', rowNonce\)/);
  assert.match(scenario, /renderRowTaskTemplate\(inv\.promptTemplate, rowNonce\)/);
  assert.match(scenario, /findRequestCompactionReceipt\(messages, \{ rowNonce \}\)/);
  assert.match(scenario, /request_compaction_receipt_role = 'toolResult'/);
  assert.match(scenario, /request_compaction_receipt_tool_name = 'request_compaction'/);
  assert.match(scenario, /request_compaction_invocation_bound = receipt\.nonceBound === true/);
  assert.match(scenario, /receipt\.kind === 'threshold_rejected' && receipt\.nonceBound === true/);
  assert.match(scenario, /function maybeCloseCompletedProof\(\)/);
  assert.match(scenario, /hasAuthoritativeThresholdReceipt\(\)[\s\S]+child_reported_context_threshold/);
  // #563 item 1: the final verdict comes from the classifier the manual
  // postprocessor also uses; its predicates are exercised below.
  assert.match(scenario, /const outcome = classifyRrc2Evidence\(evidence\)/);
  assert.match(scenario, /const verifiedThresholdOutcome = outcome\.verdict === 'HONEST-LIMIT-candidate'/);
  assert.match(scenario, /const verifiedPostCompactionOutcome = outcome\.verdict === 'PASS-candidate'/);
  assert.doesNotMatch(scenario, /childHistoryPolls >=/);
  assert.match(scenario, /childHistoryPollInFlight/);
  assert.match(scenario, /childHistoryPollScheduled \|\| childHistoryPollInFlight/);

  const reportBranch = scenario.lastIndexOf('REQUEST_COMPACTION_REJECTED_CONTEXT_THRESHOLD');
  const acceptedReportBranch = scenario.indexOf('REQUEST_COMPACTION_ACCEPTED', reportBranch);
  const receiptBranch = scenario.indexOf("receipt.kind === 'threshold_rejected'");
  const authoritativeAssignment = scenario.indexOf('evidence.request_compaction_rejected_context_threshold = true');
  assert.ok(
    receiptBranch > 0 &&
    authoritativeAssignment > receiptBranch &&
    reportBranch > authoritativeAssignment &&
    acceptedReportBranch > reportBranch,
  );
  assert.doesNotMatch(
    scenario.slice(reportBranch, acceptedReportBranch),
    /request_compaction_rejected_context_threshold = true/,
  );

  const acceptedReceiptBranch = scenario.indexOf("receipt.kind === 'non_threshold_result'");
  assert.doesNotMatch(
    scenario.slice(receiptBranch, acceptedReceiptBranch),
    /socket\.close\(\)/,
  );
});

async function postprocessOutcome({
  evidence,
  runId,
  rowId = 'R-RC-2',
  expectedArtifactClass = 'HONEST-LIMIT-candidate',
  summaryVerdict = null,
}) {
  const root = await mkdtemp(path.join(tmpdir(), 'r-rc-2-postprocess-'));
  const manifestPath = path.join(root, 'manifest.json');
  const summaryPath = path.join(root, 'summary.json');
  const outRoot = path.join(root, 'out');
  await writeFile(manifestPath, `${JSON.stringify({
    schema: 'openclaw.k6.proof-row-manifest.v1',
    rowId,
    candidateSha: 'a'.repeat(40),
    seat: 'cael',
    scenario: { name: rowId.toLowerCase().replaceAll('-', '_') },
    review: { candidateOnly: true, foldRequiresReview: true },
    liveRunSafety: {
      expectedArtifactClass,
      foldRequiresReview: true,
    },
  })}\n`);
  await writeFile(summaryPath, `${JSON.stringify({
    row: rowId,
    ...(summaryVerdict ? { verdict: summaryVerdict } : {}),
    evidence,
    metrics: {
      proof_failures: { values: { count: 0 } },
      checks: { values: { rate: 1 } },
    },
  })}\n`);
  try {
    const run = await runNode(process.execPath, [
      postprocessorPath,
      '--manifest', manifestPath,
      '--summary', summaryPath,
      '--out-root', outRoot,
      '--run-id', runId,
    ], { encoding: 'utf8' });
    return JSON.parse(run.stdout).outcome;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('R-RC-2 summary processing cannot promote report-only evidence', async () => {
  const base = {
    row: 'R-RC-2',
    preflight: { ok: true, missing: [], reason: null, advertised_count: 120 },
    observation_refused: null,
    observation_incomplete: null,
    child_identity_conflict: false,
    child_yield_bound: true,
    child_wake_turn_bound: true,
    request_compaction_context_measured: true,
    parent_dispatch_accepted: true,
    delegate_requested: true,
    child_session_observed: true,
    delegate_child_report_observed: true,
    request_compaction_tool_result_observed: true,
    request_compaction_receipt_role: 'toolResult',
    request_compaction_receipt_tool_name: 'request_compaction',
    request_compaction_invocation_bound: true,
  };
  assert.equal(await postprocessOutcome({
    evidence: {
      ...base,
      child_reported_context_threshold: true,
      request_compaction_tool_result_observed: false,
      request_compaction_receipt_status: null,
      request_compaction_rejected_context_threshold: false,
      guard: null,
    },
    runId: 'report-only',
  }), 'PARTIAL-candidate');
  assert.equal(await postprocessOutcome({
    evidence: {
      ...base,
      child_reported_context_threshold: true,
      request_compaction_receipt_status: 'rejected',
      request_compaction_rejected_context_threshold: true,
      guard: 'context_threshold',
    },
    runId: 'threshold-receipt',
  }), 'HONEST-LIMIT-candidate');
  // The product's acceptance status is "compaction_requested"
  // (request-compaction-tool.ts:338-348); "accepted" never occurs and cannot PASS.
  assert.equal(await postprocessOutcome({
    evidence: {
      ...base,
      post_compaction_path_observed: true,
      request_compaction_receipt_status: 'compaction_requested',
      request_compaction_accepted: true,
    },
    runId: 'accepted-receipt',
  }), 'PASS-candidate');
  assert.equal(await postprocessOutcome({
    evidence: {
      ...base,
      post_compaction_path_observed: true,
      request_compaction_receipt_status: 'accepted',
      request_compaction_accepted: true,
    },
    runId: 'legacy-accepted-string',
  }), 'PARTIAL-candidate');
});

test('#563 item 1: the manual postprocessor fails closed exactly like the scenario', async () => {
  const honestLimit = {
    row: 'R-RC-2',
    preflight: { ok: true, missing: [], reason: null, advertised_count: 120 },
    observation_refused: null,
    observation_incomplete: null,
    child_identity_conflict: false,
    parent_dispatch_accepted: true,
    delegate_requested: true,
    child_session_observed: true,
    delegate_child_report_observed: true,
    child_reported_context_threshold: true,
    request_compaction_tool_result_observed: true,
    request_compaction_receipt_role: 'toolResult',
    request_compaction_receipt_tool_name: 'request_compaction',
    request_compaction_receipt_status: 'rejected',
    request_compaction_invocation_bound: true,
    request_compaction_rejected_context_threshold: true,
    request_compaction_context_measured: true,
    child_yield_bound: true,
    child_wake_turn_bound: true,
    guard: 'context_threshold',
  };
  assert.equal(await postprocessOutcome({ evidence: honestLimit, runId: 'clean' }), 'HONEST-LIMIT-candidate');
  for (const [runId, patch] of [
    ['refused', { observation_refused: { method: 'sessions.list', code: 'FORBIDDEN', message: 'missing scope: operator.admin' } }],
    ['incomplete', { observation_incomplete: { method: 'sessions.list', code: 'UNAVAILABLE', message: 'busy' } }],
    ['preflight', { preflight: { ok: false, missing: ['chat.history'], reason: 'gateway does not advertise: chat.history' } }],
    ['no-preflight', { preflight: null }],
    ['conflict', { child_identity_conflict: true }],
    ['unmeasured', { request_compaction_context_measured: false }],
    ['no-wake-turn', { child_wake_turn_bound: false }],
  ]) {
    assert.equal(await postprocessOutcome({ evidence: { ...honestLimit, ...patch }, runId }), 'PARTIAL-candidate', runId);
  }
});

test('summary processing honors partial manifest and scenario ceilings', async () => {
  assert.equal(await postprocessOutcome({
    evidence: { row: 'R-CW-3' },
    runId: 'manifest-partial',
    rowId: 'R-CW-3',
    expectedArtifactClass: 'PARTIAL-candidate',
  }), 'PARTIAL-candidate');
  assert.equal(await postprocessOutcome({
    evidence: { row: 'R-CD-3' },
    runId: 'scenario-partial',
    rowId: 'R-CD-3',
    expectedArtifactClass: 'PASS-candidate',
    summaryVerdict: 'PARTIAL-candidate',
  }), 'PARTIAL-candidate');
});
