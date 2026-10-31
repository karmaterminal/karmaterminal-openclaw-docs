// R-CD-RETURN-COVENANT-AUTHORITY catalog contract: the row manifest, its k6 scenario and the
// restart control's grader agree. Nothing new is imported at module scope, so on a tree
// without the control each test fails for its own reason.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const MANIFEST = path.join(repoRoot, 'tools/k6-proofs/manifests/r-cd-return-covenant-authority.json');
const SCENARIO = path.join(repoRoot, 'tools/k6-proofs/scenarios/r-cd-return-covenant-authority.js');
const DOC = path.join(repoRoot, 'tools/k6-proofs/docs/R-CD-RETURN-COVENANT-RESTART-CONTROL.md');
const PIPELINE = path.join(repoRoot, 'tools/k6-proofs/k6-proofs-pipeline.xml');
const README = path.join(repoRoot, 'tools/k6-proofs/README.md');
const FIXTURE = 'tools/k6-proofs/scripts/run-return-covenant-restart-control.mjs';
const RECEIPTS = [
  'transition-http-body',
  'replacement-process-output',
  'generation-fingerprints',
  'observation-record',
  'signed-cleanup-receipt',
];
const CASES = ['positive', 'negative-replacement-never-usable', 'negative-spawned-fallback', 'negative-spawned-runtime-unavailable'];
const NAMED_BRANCHES = ['require-fresh-process', 'child-runtime-unavailable', 'foreground-closed', 'installation-replaced', 'lock-reacquire-failed', 'resources-retained'];

async function manifest() {
  return JSON.parse(await readFile(MANIFEST, 'utf8'));
}

// Every place the row's contract is written down, cut to this row where the file is shared.
async function contractTexts() {
  const pipeline = await readFile(PIPELINE, 'utf8');
  const readme = await readFile(README, 'utf8');
  const rowStart = pipeline.indexOf('<Row id="R-CD-RETURN-COVENANT-AUTHORITY"');
  const sectionStart = readme.indexOf('### R-CD-RETURN-COVENANT-AUTHORITY');
  assert.ok(rowStart >= 0 && sectionStart >= 0);
  return {
    doc: await readFile(DOC, 'utf8'),
    manifest: await readFile(MANIFEST, 'utf8'),
    scenario: await readFile(SCENARIO, 'utf8'),
    pipeline: pipeline.slice(rowStart, pipeline.indexOf('</Row>', rowStart)),
    readme: readme.slice(sectionStart, readme.indexOf('\n### ', sectionStart + 1)),
  };
}

test('no contract text credits a non-serving generation as usable or claims continuous service', async () => {
  // 🌊's ruling: the old server closes before the replacement is ready, so continuous service
  // is not an invariant, and an unchanged epoch alone is not usability.
  const texts = await contractTexts();
  for (const [name, text] of Object.entries(texts)) {
    assert.doesNotMatch(text, /last[ -]usable/iu, `${name} still credits a "last usable" generation`);
    assert.doesNotMatch(text, /\b(?:stays|remains|keeps?|kept)\s+(?:\w+\s+)?usable\b/iu, `${name} still claims a generation stays usable`);
    assert.doesNotMatch(text, /continuous(?:ly)?\s+(?:service|serving)\s+(?:until|through)/iu, `${name} still claims continuous service`);
  }
  for (const name of ['doc', 'manifest', 'scenario']) {
    assert.match(texts[name], /outageInterval/u, `${name} does not report the outage interval`);
    assert.match(texts[name], /hello-ok/u, `${name} does not define usable as serving`);
  }
  assert.match(texts.doc, /not an invariant/u);
});

test('the row manifest names the restart control and its receipts, and stays non-runnable', async () => {
  const row = await manifest();
  assert.equal(row.rowId, 'R-CD-RETURN-COVENANT-AUTHORITY');
  assert.equal(row.scenario.status, 'scaffold');
  assert.equal(row.scenario.expectedFile, 'r-cd-return-covenant-authority.js');
  assert.equal(row.invocation?.fixture, FIXTURE);
  assert.ok(existsSync(path.join(repoRoot, FIXTURE)));
  assert.deepEqual(row.invocation.cases, CASES);
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
  assert.throws(() => scenario.setup(), /run-return-covenant-restart-control\.mjs/u);
  assert.throws(() => scenario.default(), /run-return-covenant-restart-control\.mjs/u);
});

const k6 = ['/usr/local/bin/k6', path.join(os.homedir(), 'bin', 'k6')].find((candidate) => existsSync(candidate));
test('k6 itself refuses the scenario with a non-zero exit', { skip: k6 ? false : 'k6 is not installed here' }, () => {
  const result = spawnSync(k6, ['run', '--no-usage-report', '--quiet', path.basename(SCENARIO)], {
    cwd: path.dirname(SCENARIO),
    encoding: 'utf8',
    timeout: 60_000,
    env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: os.tmpdir() },
  });
  assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(`${result.stdout}${result.stderr}`, /fixture-gated/u);
});

test('the F′ corpus still records the row as required and missing', async () => {
  const corpus = JSON.parse(await readFile(path.join(repoRoot, 'PROOFS/f15237ec921879d918482cdf372b0718d4c1aab9/proofs-manifest.json'), 'utf8'));
  assert.ok(corpus.required_rows.includes('R-CD-RETURN-COVENANT-AUTHORITY'));
  assert.equal(corpus.rows.find((entry) => entry.row === 'R-CD-RETURN-COVENANT-AUTHORITY').state, 'missing');
});

test('the scenario header maps, at the byte, which F′ restart branch spawns a child and what gates its fallback', async () => {
  const source = await readFile(SCENARIO, 'utf8');
  for (const anchor of [
    // restartGatewayProcessWithFreshPid returns supervised | disabled | failed, never spawned;
    'src/infra/process-respawn.ts:231-273',
    // an unmanaged gateway's decision is disabled/unmanaged, so a plain restart is in-process;
    'src/infra/process-respawn.ts:56-71',
    'src/infra/supervisor-markers.ts:5-22',
    'src/cli/gateway-cli/run-loop.ts:572-580',
    // only respawnGatewayProcessForUpdate spawns, for an update-process reason without a supervisor;
    'src/infra/process-respawn.ts:282-307',
    'src/cli/gateway-cli/run-loop-request.ts:33-35',
    'src/cli/gateway-cli/run-loop.ts:459-495',
    // the fallback and the refusals that block it;
    'src/cli/gateway-cli/run-loop.ts:266-360',
    'src/infra/child-runtime-viability.ts:48-62',
    // the product's own test of the dead-child fallback, and the child's bind retry.
    'src/cli/gateway-cli/run-loop.test.ts:1076-1110',
    'src/gateway/server/http-listen.ts:6-7',
  ]) {
    assert.ok(source.includes(anchor), `scenario header lacks ${anchor}`);
  }
});
