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
  const k6 = source.indexOf('k6 run "scenarios/$SCENARIO_FILE"');
  assert.ok(buildGate > 0 && prepared > buildGate && surfaceGate > prepared && k6 > surfaceGate);
  assert.match(source, /OPENCLAW_CANDIDATE_SHA" != "\$OPENCLAW_RUNTIME_BUILD_SHA/);
  assert.match(source, /trap finalize_interrupted_token_run EXIT/);
  assert.match(source, /signal-int/);
  assert.match(source, /signal-term/);
  assert.match(source, /automaticRetryAllowed:false/);
  assert.doesNotMatch(source, /INTERRUPTED_RESULT_WRITER[\s\S]{0,700}>\/dev\/null 2>&1 \|\| true/);
});

test('scenario paginates the public task ledger and binds a structured return', async () => {
  const source = await read('scenarios/r-cd-token-bracket-delegate.js');
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
