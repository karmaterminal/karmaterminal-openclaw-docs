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
    resolver,
    observer,
    scenarioContract,
    inputSchemaRaw,
    observerSchemaRaw,
    workflow,
    pipeline,
    indexRaw,
  ] = await Promise.all([
    read('docs/RETURN-COVENANT-AUTHORITY-HARNESS.md'),
    read('scenarios/r-cd-return-covenant-authority.js'),
    read('scripts/resolve-return-covenant-authority-receipt.mjs'),
    read('lib/return-covenant-authoritative-receipt.mjs'),
    read('lib/return-covenant-scenario-contract.mjs'),
    read('contracts/return-covenant-authority/fixture-input.schema.json'),
    read('contracts/return-covenant-authority/observer.schema.json'),
    readFile(path.join(repoRoot, '.github/workflows/k6-proof.yml'), 'utf8'),
    read('k6-proofs-pipeline.xml'),
    readFile(path.join(repoRoot, 'PROOFS/INDEX.json'), 'utf8'),
  ]);
  const inputSchema = JSON.parse(inputSchemaRaw);
  const observerSchema = JSON.parse(observerSchemaRaw);
  const index = JSON.parse(indexRaw);
  const currentManifest = JSON.parse(
    await readFile(path.join(repoRoot, index.manifest_path), 'utf8'),
  );

  assert.match(documentation, /construction complete; product fixture seam missing; no proof run/i);
  assert.match(documentation, /R-CD-2[\s\S]*current corpus state `partial`/);
  assert.match(documentation, /No exact-head proof ran/);
  assert.match(documentation, /driver\.fixtureCommand\.status=missing-product-seam/);
  assert.match(documentation, /b23c7a4b5be675a0552ffed80e4c5600c220b484/);
  assert.doesNotMatch(workflow, /r-cd-return-covenant-authority/);
  assert.doesNotMatch(pipeline, /R-CD-RETURN-COVENANT-AUTHORITY/);
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
  const observe = scenario.indexOf('observations.push(observeUntilSettled');
  assert.ok(dispatch >= 0 && dispatch < transition);
  assert.ok(transition < release && release < observe);
  assert.match(scenarioContract, /holdCompletion: true/);
  assert.match(scenario, /finally \{/);
  assert.match(scenario, /HTTP loopback URL/);
  assert.doesNotMatch(scenario, /from 'node:/);
  assert.match(resolver, /OPENCLAW_GATEWAY_TOKEN/);
  assert.match(resolver, /validateReturnCovenantAuthoritativeReceipt/);
  assert.match(observer, /observation-missing/);
  assert.match(observer, /observation-duplicate/);
  assert.match(observer, /stale-side-effect/);
  assert.match(observer, /cleanup-failure/);
  assert.match(observer, /forbidden-value scan/);
  assert.match(scenarioContract, /typed-tool[\s\S]*bracket-token/);
  assert.match(scenarioContract, /covenant-v18-upgrade/);
  assert.match(scenarioContract, /participant-v18-upgrade/);
  assert.equal(
    inputSchema.properties.schema.const,
    'openclaw.k6.return-covenant-fixture-input.v1',
  );
  assert.equal(
    observerSchema.properties.schema.const,
    'openclaw.k6.return-covenant-observation.v1',
  );
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
