// R-CD-RECIPIENT-AUTHORITY-MATRIX catalog contract (docs#549, bound to docs#536).
//
// The recipient-authority matrix (12 lifecycle cases x typed-tool and bracket-token forms) is its
// own proof row. It sits beside R-CD-RETURN-COVENANT-AUTHORITY, which docs#615 made the
// supervised disposable real-restart control, and never feeds that row's verdict (🌊's 10-31
// ruling). These tests pin the split, the matrix row's process-local cap, the trace receipts
// it owes, the live-run guard's refusal, its registration in the pipeline, README and row doc,
// and the per-case j12 anchors in its scenario header. Every module is loaded per test, so a
// tree without the row fails each test for its own reason.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const proofs = path.join(repoRoot, 'tools/k6-proofs');
const MATRIX_ROW = 'R-CD-RECIPIENT-AUTHORITY-MATRIX';
const RESTART_ROW = 'R-CD-RETURN-COVENANT-AUTHORITY';
const MATRIX_MANIFEST = path.join(proofs, 'manifests/r-cd-recipient-authority-matrix.json');
const RESTART_MANIFEST = path.join(proofs, 'manifests/r-cd-return-covenant-authority.json');
const MATRIX_DOC = path.join(proofs, 'docs/R-CD-RECIPIENT-AUTHORITY-MATRIX.md');
const MATRIX_SCENARIO = path.join(proofs, 'contracts/return-covenant-authority/scenario.js');
const LAUNCHER = 'tools/k6-proofs/scripts/launch-return-covenant-driver.mjs';
const RESTART_CONTROL = 'tools/k6-proofs/scripts/run-return-covenant-restart-control.mjs';
// The product that will be presented (karmaterminal/openclaw codeagent/absorb-8083-j12), and
// the commit that moved the product-owned return-covenant fixture harness to fork-only.
const J12 = '352f56029dc95c60149ab4aaa127226a861d0b3d';
const FIXTURE_CUT = '2a8566340ddf8572dd974fc6a510fed0907dfe8a';
const P89 = '3821eaef72677c78f450ae9956cb582a22ba4cba';

async function json(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

test('the recipient-authority matrix is its own row beside the restart control', async () => {
  const matrix = await json(MATRIX_MANIFEST);
  const restart = await json(RESTART_MANIFEST);
  assert.equal(matrix.rowId, MATRIX_ROW);
  assert.equal(matrix.artifactDestination.row, MATRIX_ROW);
  assert.equal(matrix.transport, 'process-local');
  assert.equal(matrix.invocation.tool, 'continue_delegate');
  assert.deepEqual(matrix.invocation.forms, ['typed-tool', 'bracket-token']);
  assert.equal(matrix.invocation.fixture, LAUNCHER);
  assert.equal(matrix.invocation.artifactClass, 'process-local-fixture');
  assert.equal(matrix.invocation.caseCount, 12);
  assert.equal(matrix.invocation.observationCount, 24);
  // Still not a k6-runnable scenario: the planned scenario file must not exist yet.
  assert.equal(matrix.scenario.status, 'scaffold');
  assert.equal(matrix.scenario.expectedFile, 'r-cd-recipient-authority-matrix.js');
  assert.equal(existsSync(path.join(proofs, 'scenarios', matrix.scenario.expectedFile)), false);

  // The restart control is docs#615's, unchanged: its runner, class and two supervised cases.
  assert.equal(restart.rowId, RESTART_ROW);
  assert.equal(restart.invocation.control, RESTART_CONTROL);
  assert.equal(restart.invocation.artifactClass, 'disposable-real-process');
  assert.deepEqual(restart.invocation.cases, ['positive', 'negative-replacement-never-usable']);
  assert.equal(Object.hasOwn(restart, 'verdictCap'), false);
  // Neither row names the other's producer.
  const restartText = await readFile(RESTART_MANIFEST, 'utf8');
  const matrixText = await readFile(MATRIX_MANIFEST, 'utf8');
  assert.doesNotMatch(restartText, /launch-return-covenant-driver|contracts\/return-covenant-authority|RECIPIENT-AUTHORITY-MATRIX/);
  assert.doesNotMatch(matrixText, /run-return-covenant-restart-control/);

  // Exactly one manifest per row id, and only the matrix manifest names the matrix launcher.
  const files = (await readdir(path.join(proofs, 'manifests'))).filter((name) => name.endsWith('.json'));
  const owners = { [MATRIX_ROW]: [], [RESTART_ROW]: [], launcher: [] };
  for (const file of files) {
    const text = await readFile(path.join(proofs, 'manifests', file), 'utf8');
    const { rowId } = JSON.parse(text);
    if (rowId in owners) owners[rowId].push(file);
    if (text.includes('launch-return-covenant-driver')) owners.launcher.push(file);
  }
  assert.deepEqual(owners, {
    [MATRIX_ROW]: ['r-cd-recipient-authority-matrix.json'],
    [RESTART_ROW]: ['r-cd-return-covenant-authority.json'],
    launcher: ['r-cd-recipient-authority-matrix.json'],
  });
});

test('the matrix harness binds every plan, schema and artifact to the matrix row id', async () => {
  const { RETURN_COVENANT_ROW_ID, validateReturnCovenantPlan } = await import(
    '../../lib/return-covenant-scenario-contract.mjs'
  );
  assert.equal(RETURN_COVENANT_ROW_ID, MATRIX_ROW);
  const plan = await json(path.join(proofs, 'tests/fixtures/return-covenant-authority/plan.valid.json'));
  assert.deepEqual(validateReturnCovenantPlan(plan), []);
  // A plan for the restart control's row id is not a matrix plan.
  assert.ok(validateReturnCovenantPlan({ ...plan, rowId: RESTART_ROW }).includes(`rowId must be ${MATRIX_ROW}`));
  const contracts = path.join(proofs, 'contracts/return-covenant-authority');
  for (const name of (await readdir(contracts)).filter((file) => file.endsWith('.schema.json'))) {
    const text = await readFile(path.join(contracts, name), 'utf8');
    assert.doesNotMatch(text, /R-CD-RETURN-COVENANT-AUTHORITY/, name);
    for (const [, rowId] of text.matchAll(/"rowId":\s*\{\s*"const":\s*"([^"]+)"/g)) {
      assert.equal(rowId, MATRIX_ROW, name);
    }
  }
});

test('the process-local matrix row is capped at PARTIAL-candidate and owes its trace receipts', async () => {
  const matrix = await json(MATRIX_MANIFEST);
  const { manifestVerdictCapFailures, declaredRowCap } = await import('../../lib/row-verdict-cap.mjs');
  const { manifestTraceReceiptFailures, traceRequirement } = await import(
    '../../lib/continuation-trace-requirement.mjs'
  );
  const { validateTelemetryContract } = await import('../check-telemetry-contracts.mjs');
  assert.deepEqual(manifestVerdictCapFailures(matrix), []);
  assert.deepEqual(declaredRowCap(matrix), { verdict: 'PARTIAL-candidate', artifactClass: 'process-local-fixture' });
  assert.deepEqual(matrix.verdictCap.supersedingAuthorities, []);
  assert.match(matrix.verdictCap.ruling, /1565925290008387728/);
  assert.equal(matrix.liveRunSafety.expectedArtifactClass, 'PARTIAL-candidate');
  // A continuation row: the Tempo trace and its correlation receipt are required and stay
  // pending, because the sandbox (unshared network namespace) exports no spans.
  assert.deepEqual(manifestTraceReceiptFailures(matrix), []);
  assert.deepEqual(traceRequirement(matrix).receipts, ['tempo-trace-json', 'continuation-trace-correlation']);
  for (const receipt of ['tempo-trace-json', 'continuation-trace-correlation']) {
    assert.ok(matrix.liveRunSafety.requiredReceipts.includes(receipt), receipt);
  }
  assert.deepEqual(validateTelemetryContract(matrix), []);
  assert.equal(matrix.telemetryContract.rebindable, false);
  assert.equal(matrix.telemetryContract.verdictAuthority.passScope, 'behavioral-only');
});

test('the live-run guard refuses the matrix row until a live fire is authorized', () => {
  const run = spawnSync(process.execPath, [
    path.join(proofs, 'scripts/live-run-guard.mjs'),
    '--manifest', MATRIX_MANIFEST,
    '--json',
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      OPENCLAW_GATEWAY_TOKEN: 'unit-token-not-printed',
      OPENCLAW_CANDIDATE_SHA: J12,
      OPENCLAW_SESSION_KEY: 'agent:proof:matrix-guard',
    },
  });
  assert.equal(run.status, 1, run.stdout);
  const result = JSON.parse(run.stdout);
  assert.equal(result.ok, false);
  // The refusal is the classification itself, not a missing environment value.
  assert.deepEqual(result.errors, [
    'liveRunSafety.classification=orchestration-required is not directly runnable by run-proof.sh; use an explicit orchestration fixture/maintenance window',
  ]);
});

test('the pipeline, README and row doc register the matrix as its own row', async () => {
  const [pipeline, readme, doc] = await Promise.all([
    readFile(path.join(proofs, 'k6-proofs-pipeline.xml'), 'utf8'),
    readFile(path.join(proofs, 'README.md'), 'utf8'),
    readFile(MATRIX_DOC, 'utf8'),
  ]);
  const rowStart = pipeline.indexOf(`<Row id="${MATRIX_ROW}"`);
  assert.ok(rowStart >= 0, 'no pipeline row');
  const row = pipeline.slice(rowStart, pipeline.indexOf('</Row>', rowStart));
  assert.match(row, /<Manifest>tools\/k6-proofs\/manifests\/r-cd-recipient-authority-matrix\.json<\/Manifest>/);
  assert.match(row, /PARTIAL-candidate/);
  assert.match(row, /not evidence for the supervised[- ]restart claim/);
  const restartStart = pipeline.indexOf(`<Row id="${RESTART_ROW}"`);
  const restartRow = pipeline.slice(restartStart, pipeline.indexOf('</Row>', restartStart));
  assert.doesNotMatch(restartRow, /RECIPIENT-AUTHORITY-MATRIX|launch-return-covenant-driver/);

  assert.match(readme, new RegExp(`^\\| ${MATRIX_ROW} \\| \`launch-return-covenant-driver\\.mjs\` \\| process-local/`, 'm'));
  assert.match(readme, new RegExp(`^### ${MATRIX_ROW}`, 'm'));

  assert.match(doc, new RegExp(`^# ${MATRIX_ROW}`, 'm'));
  assert.match(doc, /not evidence for the supervised[- ]restart claim/);
  // ClawSweeper's standing review on openclaw/openclaw#129388, mapped case by case.
  assert.match(doc, /5442236054/);
  for (const heading of ['Allowed delivery', 'Unauthorized', 'Revoked', 'Reassigned', 'Replay', 'Not covered']) {
    assert.match(doc, new RegExp(`\\*\\*${heading}`), heading);
  }
  assert.match(doc, new RegExp(J12));
  assert.match(doc, new RegExp(FIXTURE_CUT.slice(0, 10)));
});

test('the scenario header anchors every case at j12 and marks why none executes there', async () => {
  const { RETURN_COVENANT_CASES } = await import('../../lib/return-covenant-scenario-contract.mjs');
  const scenario = await readFile(MATRIX_SCENARIO, 'utf8');
  const header = scenario.slice(0, scenario.indexOf('*/'));
  assert.match(header, new RegExp(`Row: ${MATRIX_ROW}\\.`));
  assert.match(header, new RegExp(`Product path at j12 karmaterminal/openclaw ${J12}`));
  // The seam was the product's; at j12 it is gone, so the header says so and names the cut.
  assert.match(header, new RegExp(FIXTURE_CUT));
  assert.match(header, new RegExp(P89));
  assert.match(header, /no case executes at j12/i);
  for (const { id } of RETURN_COVENANT_CASES) {
    const entry = new RegExp(`^ \\* +- ${id}:`, 'm');
    assert.match(header, entry, `no j12 anchor for ${id}`);
  }
  // The anchors cover where a return is bound, checked, refused or adopted, and its effect.
  for (const stage of ['Bound', 'Checked', 'Refused', 'Adopted', 'Final effects']) {
    assert.match(header, new RegExp(`^ \\* +${stage}\\b`, 'm'), stage);
  }
});
