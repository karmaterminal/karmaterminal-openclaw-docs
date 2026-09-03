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
  const ownerGate = source.indexOf('pre-dispatch-owner-binding-gate');
  const disposableGate = source.indexOf('export OPENCLAW_CREATE_DISPOSABLE_SESSION=true');
  const k6 = source.indexOf('k6 run "scenarios/$SCENARIO_FILE"');
  assert.ok(buildGate > 0 && prepared > buildGate && surfaceGate > prepared &&
    ownerGate > surfaceGate && disposableGate > ownerGate && k6 > disposableGate);
  assert.match(source, /validate-ancillary-runtime-provenance\.mjs/);
  assert.match(source, /reviewed-ancillary-runtime/);
  assert.match(source, /canonicalIdentityRemainsPure:true/);
  assert.match(source, /OPENCLAW_RUNTIME_SOURCE_DIR/);
  assert.match(source, /trap finalize_interrupted_token_run EXIT/);
  assert.match(source, /signal-int/);
  assert.match(source, /signal-term/);
  assert.match(source, /automaticRetryAllowed:false/);
  assert.match(source, /export OPENCLAW_CREATE_DISPOSABLE_SESSION=true/);
  assert.match(source, /OPENCLAW_R_CD_TOKEN_OWNER_SESSION_KEY/);
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

test('scenario paginates the public task ledger and binds a structured return', async () => {
  const source = await read('scenarios/r-cd-token-bracket-delegate.js');
  const proofFlow = source.indexOf('function startProofFlow()');
  const disposableCheck = source.indexOf('if (!tokenDisposableOriginReady({', proofFlow);
  const proofSend = source.indexOf("tracker.send(socket, 'sessions.send'", proofFlow);
  assert.ok(proofFlow > 0 && disposableCheck > proofFlow && proofSend > disposableCheck);
  assert.match(source, /tasks\.list/);
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
  assert.match(source, /SETTLE_MS/);
  assert.match(source, /OPENCLAW_ROW_NONCE/);
  assert.match(source, /OPENCLAW_PROOF_ATTEMPT_ID/);
  assert.match(source, /tokenDisposableOriginReady/);
  assert.match(source, /createTokenSessionProvisioner/);
  assert.match(source, /session_owner_verified/);
  assert.match(source, /pre-dispatch-disposable-creation-not-enabled/);
  assert.match(source, /targetSessionKey/);
  assert.match(source, /OPENCLAW_R_CD_TOKEN_OWNER_SESSION_KEY/);
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
  assert.equal(manifest.liveRunSafety.requiresDisposableSession, true);
  assert.ok(manifest.scenario.methods.includes('sessions.create'));
  assert.ok(manifest.scenario.methods.includes('sessions.resolve'));
  assert.ok(expected.includes('session-owner-binding'));
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
