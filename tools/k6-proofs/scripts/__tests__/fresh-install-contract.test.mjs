// R-CD-FRESH-INSTALL catalog contract: the row manifest, its k6 scenario, the catalog checks, the
// live-run guard and the row's docs agree with the control. Nothing new is imported at module
// scope, so on a tree without the row each test fails for its own reason.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const MANIFEST = path.join(repoRoot, 'tools/k6-proofs/manifests/r-cd-fresh-install.json');
const SCENARIO = path.join(repoRoot, 'tools/k6-proofs/scenarios/r-cd-fresh-install.js');
const DOC = path.join(repoRoot, 'tools/k6-proofs/docs/R-CD-FRESH-INSTALL-CONTROL.md');
const PIPELINE = path.join(repoRoot, 'tools/k6-proofs/k6-proofs-pipeline.xml');
const README = path.join(repoRoot, 'tools/k6-proofs/README.md');
const CONTROL = 'tools/k6-proofs/scripts/run-fresh-install-control.mjs';
const LIB = path.join(repoRoot, 'tools/k6-proofs/lib/fresh-install-control.mjs');
const J12 = '352f56029dc95c60149ab4aaa127226a861d0b3d';
const RULING = "make fresh install its own j12 corpus row: empty state dir, disposable process, no model turn. Keep it separate from the stopped-seat restore receipt; they prove different paths. Don't call either row satisfied until its actual artifact exists.";

async function manifest() {
  return JSON.parse(await readFile(MANIFEST, 'utf8'));
}

// Every place the row's contract is written down, cut to this row where the file is shared.
async function contractTexts() {
  const pipeline = await readFile(PIPELINE, 'utf8');
  const readme = await readFile(README, 'utf8');
  const rowStart = pipeline.indexOf('<Row id="R-CD-FRESH-INSTALL"');
  const sectionStart = readme.indexOf('### R-CD-FRESH-INSTALL');
  assert.ok(rowStart >= 0, 'k6-proofs-pipeline.xml has no R-CD-FRESH-INSTALL row');
  assert.ok(sectionStart >= 0, 'README has no R-CD-FRESH-INSTALL section');
  return {
    doc: await readFile(DOC, 'utf8'),
    manifest: await readFile(MANIFEST, 'utf8'),
    scenario: await readFile(SCENARIO, 'utf8'),
    pipeline: pipeline.slice(rowStart, pipeline.indexOf('</Row>', rowStart)),
    readme: readme.slice(sectionStart, readme.indexOf('\n### ', sectionStart + 1)),
  };
}

test('the row manifest names the fresh-install control, its class and its receipts, and stays non-runnable', async () => {
  const row = await manifest();
  const fic = await import(pathToFileURL(LIB).href);
  assert.equal(row.rowId, 'R-CD-FRESH-INSTALL');
  assert.equal(row.schema, 'openclaw.k6.proof-row-manifest.v1');
  assert.equal(row.scenario.status, 'scaffold');
  assert.equal(row.scenario.expectedFile, 'r-cd-fresh-install.js');
  // It starts and stops a real disposable gateway process, so it is declared as that class under
  // invocation.control, never as a process-local fixture (invocation.fixture), which the ruling on
  // docs#616 caps at PARTIAL-candidate.
  assert.equal(row.invocation?.control, CONTROL);
  assert.equal(row.invocation.artifactClass, 'disposable-real-process');
  assert.equal(Object.prototype.hasOwnProperty.call(row.invocation, 'fixture'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(row, 'verdictCap'), false);
  assert.ok(existsSync(path.join(repoRoot, CONTROL)));
  assert.equal(row.transport, 'websocket');
  assert.equal(row.liveRunSafety.classification, 'orchestration-required');
  assert.deepEqual(row.liveRunSafety.requiredReceipts, [...fic.FIC_RECEIPTS]);
  assert.deepEqual(row.expectedReceipts.map((receipt) => receipt.name), [...fic.FIC_RECEIPTS]);
  assert.ok(row.expectedReceipts.every((receipt) => receipt.required === true));
  assert.equal(row.review.candidateOnly, true);
  assert.equal(row.review.foldRequiresReview, true);
  assert.equal(row.liveRunSafety.foldRequiresReview, true);
  assert.equal(row.liveRunSafety.requiresLiveGatewayToken, false);
  assert.equal(row.liveRunSafety.requiresCandidateSha, true);
  assert.equal(row.liveRunSafety.requiresHumanConfirmation, true);
  assert.equal(row.liveRunSafety.expectedArtifactClass, 'PASS-candidate');
  assert.equal(row.invocation.byteWalkSha, J12);
  assert.deepEqual(row.invocation.namedRefusals, [...fic.FIC_NAMED_REFUSALS]);
  for (const verdict of fic.FIC_VERDICTS) assert.ok(row.scenario.notes.includes(verdict), `manifest notes do not explain ${verdict}`);
});

test('the catalog rules accept the row uncapped, as the restart control is', async () => {
  const row = await manifest();
  const { manifestVerdictCapFailures } = await import(pathToFileURL(path.join(repoRoot, 'tools/k6-proofs/lib/row-verdict-cap.mjs')).href);
  const { manifestTraceReceiptFailures } = await import(pathToFileURL(path.join(repoRoot, 'tools/k6-proofs/lib/continuation-trace-requirement.mjs')).href);
  assert.deepEqual(manifestVerdictCapFailures(row), []);
  assert.deepEqual(manifestTraceReceiptFailures(row), []);
  for (const script of ['check-proof-row-manifests.mjs', 'check-scenario-alignment.mjs', 'check-manifest-scenarios.mjs', 'check-telemetry-contracts.mjs']) {
    const result = spawnSync(process.execPath, [path.join(repoRoot, 'tools/k6-proofs/scripts', script)], { cwd: repoRoot, encoding: 'utf8', timeout: 60_000 });
    assert.equal(result.status, 0, `${script}\n${result.stdout}\n${result.stderr}`);
  }
  const coverage = spawnSync(process.execPath, [path.join(repoRoot, 'tools/k6-proofs/scripts/check-proof-row-manifests.mjs')], { cwd: repoRoot, encoding: 'utf8' });
  assert.match(coverage.stdout, /Manifest-only[^\n]*R-CD-FRESH-INSTALL/u);
  const alignment = JSON.parse(spawnSync(process.execPath, [path.join(repoRoot, 'tools/k6-proofs/scripts/check-scenario-alignment.mjs')], { cwd: repoRoot, encoding: 'utf8' }).stdout);
  assert.deepEqual(alignment.manifests.find((entry) => entry.rowId === 'R-CD-FRESH-INSTALL'), {
    file: 'r-cd-fresh-install.json',
    rowId: 'R-CD-FRESH-INSTALL',
    status: 'scaffold',
    runnableRef: '',
    expectedRef: 'r-cd-fresh-install',
    existing: false,
  });
});

test('the live-run guard refuses the row even with every live gate set', () => {
  const result = spawnSync(process.execPath, [path.join(repoRoot, 'tools/k6-proofs/scripts/live-run-guard.mjs'), '--manifest', MANIFEST, '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH ?? '/usr/bin:/bin',
      OPENCLAW_GATEWAY_TOKEN: 'fixture-token-not-a-secret',
      OPENCLAW_SESSION_KEY: 'main',
      OPENCLAW_CANDIDATE_SHA: J12,
    },
  });
  assert.equal(result.status, 1, result.stdout);
  const body = JSON.parse(result.stdout);
  assert.equal(body.ok, false);
  assert.ok(body.errors.some((error) => /orchestration-required is not directly runnable/u.test(error)), JSON.stringify(body.errors));
  // run-proof.sh lists no scenario for it, so a catalog or live-suite run cannot fire it.
  const runnable = spawnSync(process.execPath, [path.join(repoRoot, 'tools/k6-proofs/scripts/list-runnable-rows.mjs'), '--live-suite'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(runnable.status, 0, runnable.stderr);
  assert.doesNotMatch(runnable.stdout, /R-CD-FRESH-INSTALL|r-cd-fresh-install/u);
});

test('the scenario carries the j12 product-path map and fails closed under k6', async () => {
  const source = await readFile(SCENARIO, 'utf8');
  for (const anchor of [
    J12,
    'src/config/state-dir.ts:23-43',
    'src/state/openclaw-state-db.paths.ts:41',
    'src/state/openclaw-agent-db.paths.ts:22-35',
    'src/cli/gateway-cli/pre-bootstrap.ts:54-81',
    'src/state/openclaw-schema-versions.ts:13',
    'src/state/openclaw-agent-db-schema.ts:317-319',
    'src/state/openclaw-agent-db-schema.ts:352-358',
    'src/state/openclaw-agent-db-metadata-write.ts:9-43',
    'src/state/openclaw-agent-schema.sql:142-147',
    'src/state/openclaw-agent-recipient-authority-schema.ts:11-12',
    'src/gateway/server-methods/sessions-create.ts:616-618',
    'src/gateway/server-methods/chat-send-background.ts:36-38',
    'src/gateway/server-methods/sessions-sharing.ts:527-585',
    'src/config/sessions/session-accessor.sqlite-entry-mutation.ts:119-136',
    'src/config/sessions/session-accessor.sqlite-recipient-authority.ts:17-37',
    'src/auto-reply/continuation/config.ts:15-26',
    'src/auto-reply/continuation/config.ts:90-137',
    'src/state/openclaw-state-schema.sql:1850-1881',
    'src/infra/device-pairing-node-desktop-migration.ts:27',
    'src/gateway/server-startup-bootstrap.ts:496-505',
    'src/cli/config-cli.ts:484-565',
    'src/gateway/server/ws-connection/connect-hello.ts:174-180',
  ]) {
    assert.ok(source.includes(anchor), `scenario header lacks ${anchor}`);
  }
  const scenario = await import(pathToFileURL(SCENARIO).href);
  assert.throws(() => scenario.setup(), /run-fresh-install-control\.mjs/u);
  assert.throws(() => scenario.default(), /run-fresh-install-control\.mjs/u);
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

test("🌊's ruling is quoted, the row is kept apart from the stopped-seat restore receipt, and it stays MISSING", async () => {
  const texts = await contractTexts();
  assert.ok(texts.doc.includes(RULING), "the doc does not quote 🌊's ruling verbatim");
  for (const name of ['doc', 'manifest', 'scenario', 'pipeline']) {
    assert.match(texts[name], /1567073096706297887/u, `${name} does not cite the ruling`);
  }
  for (const name of ['doc', 'manifest', 'readme', 'pipeline']) {
    assert.match(texts[name], /stopped-seat restore/iu, `${name} does not keep the row apart from the stopped-seat restore receipt`);
    assert.match(texts[name], /MISSING/u, `${name} does not say the row stays MISSING`);
  }
  // What it does not prove.
  for (const name of ['doc', 'manifest']) {
    assert.match(texts[name], /no upgrade path/iu, `${name} does not disclaim the upgrade path`);
    assert.match(texts[name], /no model turn/iu, `${name} does not disclaim a model turn`);
    assert.match(texts[name], /no delegate delivery/iu, `${name} does not disclaim delegate delivery`);
  }
  assert.match(texts.doc, /^## What it proves$/mu);
  assert.match(texts.doc, /^## What it does not prove$/mu);
  assert.match(texts.doc, /^## Operator steps/mu);
  assert.match(texts.doc, /5442236054/u, "the doc does not cite ClawSweeper's P1");
  assert.match(texts.doc, /6597622114/u, 'the doc does not cite the docs#536 map');
});

test('the doc, manifest and control agree on the refusals, the receipts and the expected storage', async () => {
  const fic = await import(pathToFileURL(LIB).href);
  const texts = await contractTexts();
  for (const name of ['doc', 'manifest']) {
    for (const code of fic.FIC_NAMED_REFUSALS) assert.ok(texts[name].includes(code), `${name} does not name refusal ${code}`);
    for (const receipt of fic.FIC_RECEIPTS) assert.ok(texts[name].includes(receipt), `${name} does not name receipt ${receipt}`);
    assert.ok(texts[name].includes(fic.FIC_AUTHORITY_COLUMNS_SHA256), `${name} does not state the expected column hash`);
    assert.ok(texts[name].includes(fic.FIC_FRESH_INSTALL_MIGRATION_RECEIPTS[0].id), `${name} does not name the fresh boot's migration receipt`);
  }
  assert.ok(texts.doc.includes(fic.FIC_AUTHORITY_TABLE_SQL), 'the doc does not quote the byte-walked DDL');
  assert.match(texts.doc, /OPENCLAW_AGENT_SCHEMA_VERSION = 40/u);
  // The operator procedure runs the control from a credential-free shell and verifies the receipt.
  assert.match(texts.doc, /env -i /u);
  assert.match(texts.doc, /--verify/u);
  assert.match(texts.doc, /run-fresh-install-control\.mjs/u);
  for (const name of ['readme', 'pipeline']) assert.match(texts[name], /run-fresh-install-control\.mjs/u, `${name} does not name the control`);
});

test('the README row table lists the row once, as a manual-only disposable control', async () => {
  const readme = await readFile(README, 'utf8');
  const lines = readme.split('\n').filter((line) => line.startsWith('| R-CD-FRESH-INSTALL |'));
  assert.equal(lines.length, 1);
  assert.match(lines[0], /`run-fresh-install-control\.mjs`/u);
  assert.match(lines[0], /manual-only/u);
  const pipeline = await readFile(PIPELINE, 'utf8');
  assert.equal(pipeline.match(/<Row id="R-CD-FRESH-INSTALL"/gu)?.length, 1);
  assert.match(pipeline, /<Manifest>tools\/k6-proofs\/manifests\/r-cd-fresh-install\.json<\/Manifest>/u);
});
