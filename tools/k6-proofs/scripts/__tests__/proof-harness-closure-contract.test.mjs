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

test('R-CD-CHAINED-DEPTH-2 restores the proven post-leaf recovery boundary', async () => {
  const [manifestRaw, scenario] = await Promise.all([
    read('manifests/r-cd-chained-depth-2.json'),
    read('scenarios/r-cd-chained-depth-2.js'),
  ]);
  const manifest = JSON.parse(manifestRaw);
  assert.equal(manifest.invocation.fanoutMode, 'tree');
  assert.match(manifest.invocation.promptTemplate, /continue_work/);
  assert.match(manifest.invocation.promptTemplate, /CHILD-SAW-GRANDCHILD/);
  assert.ok(manifest.liveRunSafety.requiredReceipts.includes('depth1-recovery-wake'));
  assert.match(scenario, /ROOT_RETURN_OBSERVATION_MS/);
  assert.match(scenario, /startRootReturnObservationWindow/);
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
