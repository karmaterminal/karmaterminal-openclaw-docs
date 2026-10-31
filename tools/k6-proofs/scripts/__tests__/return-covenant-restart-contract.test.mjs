// R-CD-RETURN-COVENANT-AUTHORITY catalog contract: the row manifest, its k6 scenario and the
// restart control's grader agree. Nothing new is imported at module scope, so on a tree
// without the control each test fails for its own reason.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const MANIFEST = path.join(repoRoot, 'tools/k6-proofs/manifests/r-cd-return-covenant-authority.json');
const SCENARIO = path.join(repoRoot, 'tools/k6-proofs/scenarios/r-cd-return-covenant-authority.js');
const FIXTURE = 'tools/k6-proofs/scripts/run-return-covenant-restart-control.mjs';
const RECEIPTS = [
  'transition-http-body',
  'replacement-process-output',
  'generation-fingerprints',
  'observation-record',
  'signed-cleanup-receipt',
];

async function manifest() {
  return JSON.parse(await readFile(MANIFEST, 'utf8'));
}

test('the row manifest names the restart control and its receipts, and stays non-runnable', async () => {
  const row = await manifest();
  assert.equal(row.rowId, 'R-CD-RETURN-COVENANT-AUTHORITY');
  assert.equal(row.scenario.status, 'scaffold');
  assert.equal(row.scenario.expectedFile, 'r-cd-return-covenant-authority.js');
  assert.equal(row.invocation?.fixture, FIXTURE);
  assert.ok(existsSync(path.join(repoRoot, FIXTURE)));
  assert.deepEqual(row.invocation.cases, ['positive', 'negative-replacement-never-usable']);
  assert.equal(row.liveRunSafety.classification, 'orchestration-required');
  assert.deepEqual(row.liveRunSafety.requiredReceipts, RECEIPTS);
  assert.deepEqual(row.expectedReceipts.map((receipt) => receipt.name), RECEIPTS);
  assert.ok(row.expectedReceipts.every((receipt) => receipt.required === true));
  assert.equal(row.review.foldRequiresReview, true);
  assert.equal(row.liveRunSafety.foldRequiresReview, true);
  assert.equal(row.liveRunSafety.requiresLiveGatewayToken, false);
  assert.equal(row.mutates, true);
});

test('the grader and the manifest name the same receipts and verdicts', async () => {
  const row = await manifest();
  const control = await import(pathToFileURL(path.join(repoRoot, 'tools/k6-proofs/lib/return-covenant-restart-control.mjs')).href);
  assert.deepEqual([...control.RCC_RECEIPTS], row.liveRunSafety.requiredReceipts);
  assert.deepEqual([...control.RCC_CASES], row.invocation.cases);
  for (const verdict of control.RCC_VERDICTS) {
    assert.ok(row.scenario.notes.includes(verdict), `manifest contract text does not explain ${verdict}`);
  }
});

test('the scenario carries the F′ product-path map and fails closed under k6', async () => {
  const source = await readFile(SCENARIO, 'utf8');
  for (const anchor of [
    'f15237ec921879d918482cdf372b0718d4c1aab9',
    'src/state/openclaw-agent-schema.sql:140-147',
    'src/config/sessions/session-recipient-authority-types.ts:87-92',
    'src/gateway/server-methods/restart.ts:124-194',
    'src/cli/gateway-cli/run-loop.ts:497-560',
    'src/cli/gateway-cli/register-restart-handoff.ts:41-74',
    'src/gateway/server-http-probes.ts:84-94',
    'src/infra/gateway-supervision.ts:10-12',
  ]) {
    assert.ok(source.includes(anchor), `scenario header lacks ${anchor}`);
  }
  const scenario = await import(pathToFileURL(SCENARIO).href);
  assert.throws(() => scenario.default(), /run-return-covenant-restart-control\.mjs/u);
});

test('the F′ corpus still records the row as required and missing', async () => {
  const corpus = JSON.parse(await readFile(path.join(repoRoot, 'PROOFS/f15237ec921879d918482cdf372b0718d4c1aab9/proofs-manifest.json'), 'utf8'));
  assert.ok(corpus.required_rows.includes('R-CD-RETURN-COVENANT-AUTHORITY'));
  assert.equal(corpus.rows.find((entry) => entry.row === 'R-CD-RETURN-COVENANT-AUTHORITY').state, 'missing');
});
