import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file) => readFile(path.join(root, file), 'utf8');

test('runner gates exact build and surface identity before token dispatch', async () => {
  const source = await read('scripts/run-proofs.sh');
  const buildGate = source.indexOf('openclaw.k6.r-cd-token.build-identity-gate.v1');
  const prepared = source.indexOf('openclaw.k6.r-cd-token.attempt-state.v1');
  const surfaceGate = source.indexOf('pre-dispatch-surface-gate');
  const disposableGate = source.indexOf('export OPENCLAW_CREATE_DISPOSABLE_SESSION=true');
  const k6 = source.indexOf('k6 run "scenarios/$SCENARIO_FILE"');
  assert.ok(buildGate > 0 && prepared > buildGate && surfaceGate > prepared &&
    disposableGate > surfaceGate && k6 > disposableGate);
  assert.match(source, /OPENCLAW_CANDIDATE_SHA" != "\$OPENCLAW_RUNTIME_BUILD_SHA/);
  assert.match(source, /trap finalize_interrupted_token_run EXIT/);
  assert.match(source, /signal-int/);
  assert.match(source, /signal-term/);
  assert.match(source, /automaticRetryAllowed:false/);
  assert.match(source, /export OPENCLAW_CREATE_DISPOSABLE_SESSION=true/);
  assert.match(source, /equalExactSha:true/);
  assert.match(source, /build-identity-gate\.json/);
  assert.match(source, /TELEMETRY_DISPOSITION_APPLIER/);
  assert.match(source, /only R-RC-2 may use HONEST-LIMIT-candidate/);
  assert.match(source, /\.request_compaction_receipt_role == "toolResult"/);
  assert.match(source, /\.request_compaction_receipt_tool_name == "request_compaction"/);
  assert.match(source, /\.request_compaction_invocation_bound == true/);
  assert.match(source, /\.request_compaction_rejected_context_threshold == true/);
  assert.match(source, /\.request_compaction_receipt_status == "accepted"/);
  assert.match(source, /\.post_compaction_path_observed == true/);
  assert.match(source, /R-RC-2 PASS-candidate requires a nonce-bound accepted request_compaction toolResult/);
  assert.doesNotMatch(source, /INTERRUPTED_RESULT_WRITER[\s\S]{0,700}>\/dev\/null 2>&1 \|\| true/);
});

test('workflow forwards exact isolated runtime, seat, telemetry, and service identities', async () => {
  const workflow = await read('../../.github/workflows/project81-k6-proof.yml');
  const runner = await read('scripts/run-proofs.sh');
  for (const input of [
    'runtime_build_sha:',
    'expected_max_spawn_depth:',
    'seat_class:',
    'otel_service_name:',
    'gateway_unit:',
    'tempo_traceql:',
    'loki_logql:',
  ]) {
    assert.match(workflow, new RegExp(`^      ${input}`, 'm'));
  }
  assert.match(workflow, /OPENCLAW_RUNTIME_BUILD_SHA: \$\{\{ inputs\.runtime_build_sha \}\}/);
  assert.match(workflow, /OPENCLAW_EXPECTED_MAX_SPAWN_DEPTH: \$\{\{ inputs\.expected_max_spawn_depth \}\}/);
  assert.match(workflow, /expected_max_spawn_depth must be an integer from 1 through 5/);
  assert.match(workflow, /OPENCLAW_SEAT_CLASS: \$\{\{ inputs\.seat_class \}\}/);
  assert.match(workflow, /OPENCLAW_PROOFS_OTEL_SERVICE_NAME: \$\{\{ inputs\.otel_service_name \}\}/);
  assert.match(workflow, /OPENCLAW_PROOFS_GATEWAY_UNIT: \$\{\{ inputs\.gateway_unit \}\}/);
  assert.match(runner, /OPENCLAW_SEAT_NAME="\$\{OPENCLAW_SEAT_NAME:-\$\(hostname\)\}"/);
});

test('scenario paginates the public task ledger and binds a structured return', async () => {
  const source = await read('scenarios/r-cd-token-bracket-delegate.js');
  const proofFlow = source.indexOf('function startProofFlow()');
  const disposableCheck = source.indexOf('if (!tokenDisposableOriginReady({', proofFlow);
  const proofSend = source.indexOf("tracker.send(socket, 'sessions.send'", proofFlow);
  assert.ok(proofFlow > 0 && disposableCheck > proofFlow && proofSend > disposableCheck);
  assert.match(source, /tasks\.list/);
  assert.match(source, /sessions\.get/);
  assert.match(source, /nextCursor/);
  assert.match(source, /TASK_PAGE_LIMIT = 500/);
  assert.match(source, /REQUIRED_STABLE_TASK_SNAPSHOTS = 3/);
  assert.match(source, /duplicateTaskId/);
  assert.match(source, /task_snapshot_consistent/);
  assert.match(source, /origin_task_unique_count === 1/);
  assert.match(source, /delegate_task_unique_count === 1/);
  assert.match(source, /delegate_requester_matches_origin_child/);
  assert.match(source, /classified\.event === 'session\.message'/);
  assert.match(source, /parseTokenReturnEvent/);
  assert.match(source, /parseTokenReturnTranscriptMessage/);
  assert.match(source, /tokenOriginCursorFromMessages/);
  assert.match(source, /tokenOriginCursorSnapshotDispatch/);
  assert.match(source, /rememberTokenReturnReceipt/);
  assert.match(source, /OPENCLAW_TOKEN_CURSOR_POLL_MS \|\| 500/);
  assert.match(source, /!\(Number\(delay\) > 0\)/);
  assert.doesNotMatch(source, /socket\.setTimeout\([^,]+,\s*0\s*\)/);
  const firstGet = source.indexOf('tracker.send(socket, dispatch.method, dispatch.params)');
  const requestFn = source.indexOf('function requestOriginCursorSnapshot()');
  const scheduleFn = source.indexOf('function scheduleOriginCursorPoll(');
  assert.ok(requestFn > 0 && firstGet > requestFn && firstGet < scheduleFn);
  assert.match(source, /expectedDelegateRunId: identity\.delegateRunId/);
  assert.match(source, /origin_return_message_seq/);
  assert.match(source, /origin_return_event_count === 1/);
  assert.match(source, /root_substituted_return_count === 0/);
  assert.match(source, /SETTLE_MS/);
  assert.match(source, /OPENCLAW_ROW_NONCE/);
  assert.match(source, /OPENCLAW_PROOF_ATTEMPT_ID/);
  assert.match(source, /tokenDisposableOriginReady/);
  assert.match(source, /pre-dispatch-disposable-creation-not-enabled/);
  assert.match(source, /createdSessionKey && createdSessionKey !== requestedSessionKey/);
  assert.doesNotMatch(source, /else socket\.setTimeout\(\(\) => startProofFlow\(\)/);
  assert.match(source, /verdict: 'PARTIAL-candidate'/);
  assert.doesNotMatch(source, /JSON\.stringify\(eventData\).*includes/);
});

test('manifest required and expected receipt surfaces are identical and fail closed', async () => {
  const manifest = JSON.parse(await read('manifests/r-cd-token.json'));
  const expected = manifest.expectedReceipts.map((receipt) => receipt.name).sort();
  const required = [...manifest.liveRunSafety.requiredReceipts].sort();
  assert.deepEqual(required, expected);
  assert.ok(manifest.expectedReceipts.every((receipt) => receipt.required === true));
  assert.equal(manifest.invocation.originSurface, 'raw-final-text');
  assert.equal(manifest.invocation.delaySeconds, 10);
  assert.equal(manifest.continuationRequirements.requiredSpawnDepth, 2);
  assert.equal(manifest.liveRunSafety.requiresDisposableSession, true);
  assert.ok(manifest.scenario.methods.includes('sessions.create'));
  assert.ok(manifest.scenario.methods.includes('sessions.get'));
  assert.doesNotMatch(JSON.stringify(manifest), /HONEST-LIMIT-candidate/);
});

test('candidate/report surfaces depend on the signed row-scoped receipt', async () => {
  for (const file of [
    'scripts/run-proofs.sh',
    'scripts/validate-candidate-run-result.mjs',
    'scripts/candidate-run-result-contract.mjs',
    'scripts/render-run-report.mjs',
  ]) {
    assert.match(await read(file), /r-cd-token-authoritative-receipt/);
  }
});
