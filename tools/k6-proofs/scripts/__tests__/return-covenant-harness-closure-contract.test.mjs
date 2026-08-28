import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const repoRoot = path.resolve(root, '../..');
const read = (relative) => readFile(path.join(root, relative), 'utf8');

test('return covenant harness is complete but remains outside proof authority registries', async () => {
  const [
    documentation,
    scenario,
    observer,
    scenarioContract,
    inputSchemaRaw,
    observerSchemaRaw,
    cleanupSchemaRaw,
    retentionSchemaRaw,
    launcher,
    supervisor,
    mockDriver,
    workflow,
    pipeline,
    indexRaw,
  ] = await Promise.all([
    read('docs/RETURN-COVENANT-AUTHORITY-HARNESS.md'),
    read('contracts/return-covenant-authority/scenario.js'),
    read('lib/return-covenant-authoritative-receipt.mjs'),
    read('lib/return-covenant-scenario-contract.mjs'),
    read('contracts/return-covenant-authority/fixture-input.schema.json'),
    read('contracts/return-covenant-authority/observer.schema.json'),
    read('contracts/return-covenant-authority/cleanup.schema.json'),
    read('contracts/return-covenant-authority/retention-observation.schema.json'),
    read('scripts/launch-return-covenant-driver.mjs'),
    read('scripts/run-return-covenant-sandbox.mjs'),
    read('tests/fixtures/return-covenant-authority/mock-product-driver.mjs'),
    readFile(path.join(repoRoot, '.github/workflows/k6-proof.yml'), 'utf8'),
    read('k6-proofs-pipeline.xml'),
    readFile(path.join(repoRoot, 'PROOFS/INDEX.json'), 'utf8'),
  ]);
  const inputSchema = JSON.parse(inputSchemaRaw);
  const observerSchema = JSON.parse(observerSchemaRaw);
  const cleanupSchema = JSON.parse(cleanupSchemaRaw);
  const retentionSchema = JSON.parse(retentionSchemaRaw);
  const index = JSON.parse(indexRaw);
  const currentManifest = JSON.parse(
    await readFile(path.join(repoRoot, index.manifest_path), 'utf8'),
  );

  assert.match(documentation, /construction complete; product fixture seam missing; no proof run/i);
  assert.match(documentation, /R-CD-2[\s\S]*current corpus state `partial`/);
  assert.match(documentation, /No exact-head proof ran/);
  assert.match(documentation, /driver\.fixtureCommand\.status=missing-product-seam/);
  assert.match(documentation, /launch-return-covenant-driver\.mjs/);
  assert.match(documentation, /--artifact-dir/);
  assert.match(documentation, /--log-format raw --log-output stdout/);
  assert.match(documentation, /k6-exit-code\.txt/);
  assert.match(documentation, /docs-owned scenario[\s\S]*resource-inspection/i);
  assert.match(documentation, /unverified-resource-retention/);
  assert.match(documentation, /candidate-cleanup-diagnostic\.json/);
  assert.match(documentation, /92affa163c0e14f7cd9d1ef76ac19f089d85b503/);
  assert.doesNotMatch(workflow, /r-cd-return-covenant-authority/);
  assert.doesNotMatch(pipeline, /R-CD-RETURN-COVENANT-AUTHORITY/);
  await assert.rejects(
    access(path.join(root, 'scenarios/r-cd-return-covenant-authority.js')),
    (error) => error?.code === 'ENOENT',
  );
  await assert.rejects(
    access(path.join(root, 'scripts/resolve-return-covenant-authority-receipt.mjs')),
    (error) => error?.code === 'ENOENT',
  );
  assert.equal(
    currentManifest.rows.some((row) => row.row === 'R-CD-RETURN-COVENANT-AUTHORITY'),
    false,
  );
  assert.equal(currentManifest.exact_target_execution, false);
  assert.equal(currentManifest.exact_target_mode_b, false);
  assert.equal(
    currentManifest.rows.find((row) => row.row === 'R-CD-2')?.state,
    'partial',
  );
  assert.equal(
    currentManifest.rows.find((row) => row.row === 'R-CD-4')?.state,
    'pass',
  );

  const dispatch = scenario.indexOf("const dispatched = postPhase('dispatch'");
  const transition = scenario.indexOf("const transitioned = postPhase('transition'");
  const release = scenario.indexOf("postPhase('release'");
  const observe = scenario.indexOf('const observed = observeUntilSettled');
  assert.ok(dispatch >= 0 && dispatch < transition);
  assert.ok(transition < release && release < observe);
  assert.match(scenarioContract, /holdCompletion: true/);
  assert.match(scenario, /finally \{/);
  assert.match(scenario, /HTTP IPv4 loopback/);
  assert.doesNotMatch(scenario, /from 'node:/);
  assert.match(launcher, /observerSigningKey/);
  assert.match(launcher, /gatewayToken = randomBytes\(32\)/);
  assert.match(launcher, /validateReturnCovenantAuthoritativeReceipt/);
  assert.doesNotMatch(launcher, /docs-dir/);
  assert.match(launcher, /k6-proof-binaries\.json/);
  assert.match(launcher, /O_NOFOLLOW/);
  assert.match(supervisor, /spawn\(input\.k6/);
  assert.match(launcher, /\/usr\/bin\/bwrap/);
  assert.match(launcher, /--unshare-pid/);
  assert.match(launcher, /--unshare-net/);
  assert.match(launcher, /--unshare-ipc/);
  assert.match(launcher, /--proc', '\/proc'/);
  assert.match(launcher, /await unlink\(copyPath\)/);
  assert.match(launcher, /capturedK6Log/);
  assert.match(launcher, /run-return-covenant-sandbox\.mjs/);
  assert.match(launcher, /readBoundedCandidateJson/);
  assert.match(launcher, /DOCS_AUTHORITY_FILES/);
  assert.match(supervisor, /--config/);
  assert.match(supervisor, /cwd: input\['k6-home'\]/);
  assert.match(launcher, /terminateProcessGroup/);
  assert.match(launcher, /deriveReturnCovenantCaseHandleClosure/);
  assert.match(launcher, /deriveReturnCovenantTrustedRetention/);
  assert.match(launcher, /candidate-cleanup-diagnostic\.json/);
  assert.doesNotMatch(launcher, /retained:\s*cleanupDraft\.retained/);
  assert.doesNotMatch(
    launcher,
    /allCaseHandlesClosed:\s*cleanupDraft\.allCaseHandlesClosed/,
  );
  assert.match(
    launcher,
    /existing\.listenerFingerprints\.length > 0 &&\s+observation\.listenerFingerprints\.length === 0[\s\S]*?continue;/,
  );
  assert.match(launcher, /gateway listener resumed after exit/);
  assert.match(
    mockDriver,
    /gatewayServer\.close\(\(\) => \{\s+setTimeout\(\(\) => process\.exit\(0\), 50\);/,
  );
  assert.match(launcher, /git'?,?\s*\[\s*'clone'|git[\s\S]*clone/);
  assert.match(launcher, /randomBytes\(32\)/);
  assert.match(launcher, /OPENCLAW_RETURN_COVENANT_PHASE_KEY/);
  assert.match(launcher, /OPENCLAW_STATE_DIR/);
  assert.match(launcher, /rm\(runRoot, \{ recursive: true, force: true \}\)/);
  const inheritedGatewayObservation = launcher.slice(
    launcher.lastIndexOf(
      'return {',
      launcher.indexOf("verificationSource: 'namespace-inherited'"),
    ),
    launcher.indexOf("verificationSource: 'namespace-inherited'"),
  );
  assert.match(inheritedGatewayObservation, /listenerFingerprints:/);
  assert.match(observer, /observation-missing/);
  assert.match(observer, /observation-duplicate/);
  assert.match(observer, /stale-side-effect/);
  assert.match(observer, /cleanup-failure/);
  assert.match(observer, /unverified-resource-retention/);
  assert.match(observer, /docs-owned-gateway-observation/);
  assert.match(observer, /forbidden-value scan/);
  assert.match(scenarioContract, /typed-tool[\s\S]*bracket-token/);
  assert.match(scenarioContract, /covenant-v18-upgrade/);
  assert.match(scenarioContract, /participant-v18-upgrade/);
  assert.match(scenario, /RETURN_COVENANT_TEARDOWN_PREFIX/);
  assert.match(scenario, /buildReturnCovenantRetentionRequest/);
  assert.match(
    scenario,
    /\/v1\/return-covenant\/resource-inspection/,
  );
  assert.match(scenario, /notBefore/);
  assert.match(scenario, /driverBinding/);
  assert.equal(
    inputSchema.properties.schema.const,
    'openclaw.k6.return-covenant-fixture-input.v1',
  );
  assert.equal(
    observerSchema.properties.schema.const,
    'openclaw.k6.return-covenant-observation.v1',
  );
  assert.equal(
    retentionSchema.properties.schema.const,
    'openclaw.k6.return-covenant-retention-observation.v1',
  );
  assert.equal(
    cleanupSchema.properties.retentionAuthority.properties.candidateCleanup.const,
    'untrusted-diagnostic-only',
  );
  assert.equal(
    cleanupSchema.properties.retained.properties.delegates.$ref,
    '#/$defs/retainedCount',
  );
  assert.match(mockDriver, /resourceState/);
  assert.match(mockDriver, /candidateClaimsClean/);
  assert.match(supervisor, /childTerminationReason/);
  await Promise.all([
    access(path.join(root, 'tests/fixtures/return-covenant-authority/allowed-pass.json')),
    access(path.join(root, 'tests/fixtures/return-covenant-authority/forbidden-pass.json')),
    access(path.join(root, 'tests/fixtures/return-covenant-authority/cleanup-failure.json')),
  ]);
});

test('existing signed authorities use the shared sealing primitive', async () => {
  const [rCd2, token, shared, runtime] = await Promise.all([
    read('lib/r-cd-2-authoritative-receipt.mjs'),
    read('lib/r-cd-token-authoritative-receipt.mjs'),
    read('lib/signed-observer-receipt.mjs'),
    read('lib/isolated-runtime-plugin-contract.mjs'),
  ]);
  for (const authority of [rCd2, token]) {
    assert.match(authority, /sealSignedObserverReceipt/);
    assert.match(authority, /validateSignedObserverReceiptIntegrity/);
    assert.doesNotMatch(authority, /createHmac/);
  }
  assert.match(shared, /hmac-sha256-gateway-token-v1/);
  assert.match(runtime, /39ef6b268650c5ff718226cb17fdfcf2d5f4a3da/);
  assert.match(runtime, /isolated-target-config/);
});
