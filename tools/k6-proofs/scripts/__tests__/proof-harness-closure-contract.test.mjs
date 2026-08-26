import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const read = (relative) => readFile(path.join(root, relative), 'utf8');

test('R-CW-6 generated boundary follows current product ownership and retains diagnostics', async () => {
  const [template, runner] = await Promise.all([
    read('fixtures/r-cw-6/max-chain-delegate-boundary.test.ts'),
    read('scripts/run-max-chain-fixture.mjs'),
  ]);
  assert.match(template, /agents\/subagents\/spawn\/subagent-spawn\.js/);
  assert.match(template, /enqueueSystemEventRaw/);
  assert.match(template, /delegate-taskflow-registry\.test-harness\.js/);
  assert.doesNotMatch(template, /agents\/subagent-spawn\.js/);
  assert.match(runner, /generatedTestDiagnostics/);
  assert.match(runner, /selectedDelegateDiagnostics/);
});

test('R-CD-CHAINED-DEPTH-2 restores post-leaf recovery and structured root authority', async () => {
  const [manifestRaw, scenario, runner, candidate] = await Promise.all([
    read('manifests/r-cd-chained-depth-2.json'),
    read('scenarios/r-cd-chained-depth-2.js'),
    read('scripts/run-proofs.sh'),
    read('scripts/candidate-run-result-contract.mjs'),
  ]);
  await Promise.all([
    access(path.join(root, 'lib/r-cd-chained-depth-2-authority.mjs')),
    access(path.join(root, 'lib/r-cd-chained-depth-2-authoritative-receipt.mjs')),
    access(path.join(root, 'scripts/resolve-r-cd-chained-depth-2-authoritative-receipt.mjs')),
    access(path.join(root, 'tests/fixtures/r-cd-chained-depth-2-run-32981265676.json')),
  ]);
  const manifest = JSON.parse(manifestRaw);
  assert.equal(manifest.invocation.fanoutMode, 'tree');
  assert.equal(manifest.continuationRequirements.requiredSpawnDepth, 2);
  assert.match(manifest.invocation.promptTemplate, /continue_work/);
  assert.match(manifest.invocation.promptTemplate, /CHILD-SAW-GRANDCHILD/);
  assert.ok(manifest.liveRunSafety.requiredReceipts.includes('depth1-recovery-wake'));
  assert.ok(manifest.liveRunSafety.requiredReceipts.includes('exactly-once-chain-completion'));
  assert.match(scenario, /ROOT_RETURN_OBSERVATION_MS/);
  assert.match(scenario, /startRootReturnObservationWindow/);
  assert.match(scenario, /startDescendantObservationWindow\(socket\)/);
  assert.match(scenario, /state\.deadlineAtMs - Date\.now\(\)/);
  assert.match(scenario, /rCdChainTaskLedgerReceipt/);
  assert.match(scenario, /task_pagination_exhausted/);
  assert.match(scenario, /tasks\.get/);
  assert.match(scenario, /scheduleTaskSnapshot\(socket\)/);
  assert.match(scenario, /structured post-return root consumption observed/);
  assert.match(runner, /R_CD_CHAIN_RECEIPT_RESOLVER/);
  assert.match(runner, /selected-row-continuation-depth/);
  assert.match(candidate, /r-cd-chained-depth-2-row-scoped-resolver/);
  assert.doesNotMatch(scenario, /socket\.setTimeout\(\(\) => socket\.close\(\), 150000\)/);
});

test('backend disposition is runnable and wired through every result boundary', async () => {
  await Promise.all([
    access(path.join(root, 'lib/telemetry-backend-status.js')),
    access(path.join(root, 'scripts/fetch-loki-query.mjs')),
    access(path.join(root, 'scripts/apply-telemetry-disposition.mjs')),
    access(path.join(root, 'scenarios/r-obs-backend-disposition.js')),
  ]);
  const [manifestRaw, runner, candidate] = await Promise.all([
    read('manifests/r-obs-backend-disposition.json'),
    read('scripts/run-proofs.sh'),
    read('scripts/validate-candidate-run-result.mjs'),
  ]);
  const manifest = JSON.parse(manifestRaw);
  assert.equal(manifest.scenario.status, 'runnable');
  assert.equal(manifest.liveRunSafety.classification, 'k6-runnable');
  assert.equal(manifest.liveRunSafety.expectedArtifactClass, 'PASS-candidate');
  assert.match(runner, /TELEMETRY_DISPOSITION_APPLIER/);
  assert.match(runner, /backend-status\.json/);
  assert.match(candidate, /requireTelemetryArtifacts/);
  assert.match(candidate, /validateTelemetryBackendStatusReceipt/);
});

test('the three product-instrumentation rows remain construct-only and fail closed', async () => {
  for (const file of [
    'manifests/r-obs-cont-provenance.json',
    'manifests/r-obs-proof-marker.json',
    'manifests/r-obs-terminal-outcome.json',
  ]) {
    const manifest = JSON.parse(await read(file));
    assert.equal(manifest.scenario.status, 'construct-only', file);
    assert.equal(manifest.liveRunSafety.classification, 'construct-only', file);
    assert.equal(manifest.liveRunSafety.expectedArtifactClass, 'construct-only', file);
    assert.equal(manifest.telemetryContract.productInstrumentationPrerequisite, true, file);
  }
});
