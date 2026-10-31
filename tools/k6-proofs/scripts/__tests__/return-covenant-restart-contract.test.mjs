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
// 🌊's final scope ruling (Discord msg 1565927316687691777): the row's verdict is graded from the
// two supervised cases; the update.run cases are update-respawn controls beside it.
const ROW_CASES = ['positive', 'negative-replacement-never-usable'];
const UPDATE_RESPAWN_CONTROLS = ['control-update-respawn-fallback', 'control-update-respawn-runtime-unavailable'];
const CASES = [...ROW_CASES, ...UPDATE_RESPAWN_CONTROLS];
const FINAL_RULING = 'Scope the RETURN-COVENANT restart claim to the supervised branch the fleet actually runs. An `update.run` reason on an unmanaged disposable gateway can test the update-respawn fallback, but it is a distinct control—not the negative proving fleet restart. For supervised restart, a replacement that never serves should produce the observed failure/outage, retained authority as applicable, and a non-PASS verdict; do not claim old-process fallback. Name the plain in-process case separately.';
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
  // The control restarts a real disposable gateway process, so it is declared as that class under
  // invocation.control, never as a process-local fixture (invocation.fixture), which the ruling on
  // docs#616 caps at PARTIAL-candidate.
  assert.equal(row.invocation?.control, FIXTURE);
  assert.equal(row.invocation.artifactClass, 'disposable-real-process');
  assert.equal(Object.prototype.hasOwnProperty.call(row.invocation, 'fixture'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(row, 'verdictCap'), false);
  assert.ok(existsSync(path.join(repoRoot, FIXTURE)));
  assert.deepEqual(row.invocation.cases, ROW_CASES);
  assert.deepEqual(row.invocation.updateRespawnControls, UPDATE_RESPAWN_CONTROLS);
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
  assert.deepEqual([...control.RCC_CASES], CASES);
  assert.deepEqual([...control.RCC_ROW_CASES], row.invocation.cases);
  assert.deepEqual([...control.RCC_UPDATE_RESPAWN_CONTROLS], row.invocation.updateRespawnControls);
  assert.deepEqual(Object.fromEntries(CASES.map((caseKind) => [caseKind, control.RCC_CASE_BRANCH[caseKind].kind])), {
    positive: 'row-positive',
    'negative-replacement-never-usable': 'row-negative',
    'control-update-respawn-fallback': 'update-respawn-control',
    'control-update-respawn-runtime-unavailable': 'update-respawn-control',
  });
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

test('the doc, manifest and grader agree on the cases, the fleet branch and every named non-PASS fallback branch', async () => {
  const texts = await contractTexts();
  const control = await import(pathToFileURL(path.join(repoRoot, 'tools/k6-proofs/lib/return-covenant-restart-control.mjs')).href);
  assert.deepEqual(control.RCC_FALLBACK_BRANCHES.map((entry) => entry.branch), NAMED_BRANCHES);
  for (const name of ['doc', 'manifest', 'readme', 'pipeline']) {
    for (const caseKind of CASES) assert.ok(texts[name].includes(caseKind), `${name} does not name case ${caseKind}`);
  }
  for (const name of ['doc', 'manifest', 'scenario']) {
    for (const branch of NAMED_BRANCHES) assert.ok(texts[name].includes(branch), `${name} does not name branch ${branch}`);
  }
  // Systemd-supervised fleet seats take the supervised branch, so the positive is the
  // fleet-relevant case; the update-respawn fallback control proves old-process restoration only.
  assert.match(texts.doc, /systemd-supervised\s+fleet\s+seats/iu);
  assert.match(texts.doc, /src\/cli\/gateway-cli\/run-loop\.ts:497-561/u);
  assert.match(texts.doc, /old-process\s+restoration/u);
  assert.match(texts.manifest, /old-process\s+restoration/u);
  // On the update-respawn controls the child never served, so every named branch grades FAIL-candidate
  // (replacement-never-usable); the text must not promise MISSING for a fallback limit there.
  for (const name of ['doc', 'manifest']) {
    assert.doesNotMatch(texts[name], /limit alone grades MISSING/iu, `${name} contradicts the grader on fallback limits`);
    assert.match(texts[name], /FAIL-candidate[^.]*whichever\s+branch\s+blocked/iu, `${name} does not say a blocked fallback grades FAIL`);
  }
});

test("🌊's final scope ruling: the row claims the supervised branch, and the update-respawn controls are labelled and kept beside it", async () => {
  const texts = await contractTexts();
  // The ruling is quoted verbatim, with 🌻's agreement.
  assert.ok(texts.doc.includes(FINAL_RULING), 'the doc does not quote 🌊\'s 03:16Z ruling verbatim');
  assert.match(texts.doc, /1565927316687691777/u);
  assert.match(texts.doc, /1565922704752779386/u);
  for (const name of ['manifest', 'scenario', 'pipeline']) assert.match(texts[name], /1565927316687691777/u, `${name} does not cite the final ruling`);
  // The old case names are gone everywhere the row's contract is written down.
  for (const [name, text] of Object.entries(texts)) {
    assert.doesNotMatch(text, /negative-spawned/u, `${name} still names a spawned case as a negative`);
    assert.doesNotMatch(text, /spawned-branch negative/iu, `${name} still calls the spawned branch a negative of this row`);
  }
  // "🌻's negative" is the supervised never-serves case, wherever it is named.
  for (const name of ['doc', 'manifest', 'scenario']) {
    const paragraphs = texts[name].split(/\n\s*\n/u).filter((paragraph) => paragraph.includes("🌻's negative"));
    assert.ok(paragraphs.length > 0, `${name} does not say what 🌻's negative is`);
    for (const paragraph of paragraphs) {
      assert.match(paragraph, /negative-replacement-never-usable/u, `${name}: 🌻's negative is not tied to the supervised case`);
      assert.doesNotMatch(paragraph, /🌻's negative[^.]*(?:update\.run|update-respawn|spawned)/u, `${name}: 🌻's negative is tied to the update-respawn path`);
    }
  }
  // The row verdict, the controls beside it, and the named in-process limit.
  for (const name of ['doc', 'manifest', 'readme', 'pipeline']) {
    assert.match(texts[name], /row\s+verdict\s+is\s+graded\s+from\s+`?positive`?\s+and\s+`?negative-replacement-never-usable`?\s+only/iu, `${name} does not scope the row verdict to the supervised cases`);
    assert.match(texts[name], /not\s+evidence\s+for\s+the\s+fleet\s+restart\s+claim/iu, `${name} does not say the controls are not fleet-restart evidence`);
    assert.match(texts[name], /update-respawn-control/u, `${name} does not label the controls`);
    assert.match(texts[name], /in-process-restart/u, `${name} does not name the plain in-process restart`);
  }
  assert.match(texts.doc, /^## The update-respawn controls$/mu);
  assert.match(texts.doc, /^## The plain in-process restart$/mu);
  assert.match(texts.doc, /^## The row verdict$/mu);
  assert.doesNotMatch(texts.doc, /^## The spawned-branch negative$/mu);
  // The controls are optional in the operator loop: no loop runs them with the row's cases.
  for (const name of ['doc', 'readme']) {
    assert.doesNotMatch(texts[name], /for CASE in [^\n]*positive[^\n]*control-update-respawn/u, `${name} runs the controls inside the row loop`);
  }
  assert.match(texts.doc, /for CASE in positive negative-replacement-never-usable; do/u);
  assert.match(texts.doc, /--grade-row/u);
});
