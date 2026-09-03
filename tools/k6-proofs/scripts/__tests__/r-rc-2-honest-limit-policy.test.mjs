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
  assert.match(scenario, /childSessionKeyForRow\([\s\S]*classified\.payload,[\s\S]*rowNonce,[\s\S]*\[taskIdentityToken\]/);
  assert.match(scenario, /compactTaskIdentityToken\('RRC2', rowNonce\)/);
  assert.match(scenario, /renderRowTaskTemplate\(inv\.promptTemplate, rowNonce\)/);
  assert.match(
    scenario,
    /findRequestCompactionReceipt\(messages, \{[\s\S]*rowNonce,[\s\S]*requireCanonicalNumericThreshold: true/,
  );
  assert.match(scenario, /request_compaction_receipt_role = 'toolResult'/);
  assert.match(scenario, /request_compaction_receipt_tool_name = 'request_compaction'/);
  assert.match(scenario, /request_compaction_invocation_bound = receipt\.nonceBound === true/);
  assert.match(scenario, /receipt\.kind === 'threshold_rejected' && receipt\.nonceBound === true/);
  assert.match(scenario, /function maybeCloseCompletedProof\(\)/);
  assert.match(scenario, /hasAuthoritativeThresholdReceipt\(\)[\s\S]+child_reported_context_threshold/);
  assert.match(scenario, /isCanonicalThresholdRejectionReceipt/);
  assert.match(scenario, /reported_context_usage === evidence\.context_usage/);
  assert.match(scenario, /reported_threshold === evidence\.threshold/);
  assert.match(scenario, /eventSessionKey === evidence\.child_session_key/);
  assert.match(scenario, /parent_delegate_tool_call_count/);
  assert.match(scenario, /parent_delegate_arguments_exact/);
  assert.match(scenario, /findContinueDelegateCall/);
  assert.match(scenario, /observeRrc2ParentDelegateCall/);
  assert.match(scenario, /\\d\+\(\?:\\\.\\d\+\)\?/);
  assert.match(scenario, /Call continue_delegate exactly once with only mode="normal", delaySeconds=0/);
  assert.match(scenario, /Do not add recipientContext, returnOptions/);
  assert.match(scenario, /const verifiedThresholdOutcome =[\s\S]+child_reported_context_threshold/);
  assert.match(scenario, /verifiedThresholdOutcome[\s\S]+HONEST-LIMIT-candidate/);
  assert.match(scenario, /const verifiedPostCompactionOutcome =[\s\S]+post_compaction_path_observed/);
  assert.match(scenario, /verifiedPostCompactionOutcome[\s\S]+PASS-candidate/);
  assert.doesNotMatch(scenario, /childHistoryPolls >=/);
  assert.match(scenario, /childHistoryPollInFlight/);
  assert.match(scenario, /childHistoryPollScheduled \|\| childHistoryPollInFlight/);
  assert.match(scenario, /const partialOutcomeEvidence =[\s\S]+authoritativeThresholdReceipt[\s\S]+post_compaction_path_observed/);

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
    parent_delegate_argument_policy_valid: true,
    parent_delegate_tool_call_count: 1,
    parent_delegate_argument_keys: ['delaySeconds', 'mode', 'task'],
    parent_delegate_arguments_exact: true,
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
      context_usage: 10,
      threshold: 70,
      reported_context_usage: 10,
      reported_threshold: 70,
    },
    runId: 'threshold-receipt',
  }), 'HONEST-LIMIT-candidate');
  assert.equal(await postprocessOutcome({
    evidence: {
      ...base,
      child_reported_context_threshold: true,
      request_compaction_receipt_status: 'rejected',
      request_compaction_rejected_context_threshold: true,
      guard: 'context_threshold',
      context_usage: 12.5,
      threshold: 70,
      reported_context_usage: 12.5,
      reported_threshold: 70,
    },
    runId: 'decimal-threshold-receipt',
  }), 'HONEST-LIMIT-candidate');
  for (const invalidNumeric of [
    { context_usage: null },
    { threshold: null },
    { context_usage: Number.NaN },
    { threshold: 71 },
    { context_usage: 70 },
    { reported_context_usage: null },
    { reported_threshold: null },
    { reported_context_usage: 11 },
  ]) {
    assert.equal(await postprocessOutcome({
      evidence: {
        ...base,
        child_reported_context_threshold: true,
        request_compaction_receipt_status: 'rejected',
        request_compaction_rejected_context_threshold: true,
        guard: 'context_threshold',
        context_usage: 10,
        threshold: 70,
        reported_context_usage: 10,
        reported_threshold: 70,
        ...invalidNumeric,
      },
      runId: `invalid-numeric-${Object.keys(invalidNumeric)[0]}`,
    }), 'PARTIAL-candidate');
  }
  assert.equal(await postprocessOutcome({
    evidence: {
      ...base,
      post_compaction_path_observed: true,
      request_compaction_receipt_status: 'accepted',
      request_compaction_accepted: true,
    },
    runId: 'accepted-receipt',
  }), 'PASS-candidate');
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
