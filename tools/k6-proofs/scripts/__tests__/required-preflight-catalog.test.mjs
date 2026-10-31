import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// The row-manifest side of 🌊's F″ method ruling: R-CW-5/6 each name one required
// preflight, the R-CW-5A/6A static check, which must run at the exact candidate;
// R-CW-5A/6A say whose preflight they are and that they are retired as proof
// rows. check-proof-row-manifests.mjs keeps both directions in agreement.
const repoRoot = new URL('../../../..', import.meta.url).pathname;
const manifestsDir = join(repoRoot, 'tools/k6-proofs/manifests');
const checker = join(repoRoot, 'tools/k6-proofs/scripts/check-proof-row-manifests.mjs');
const SHA = '0123456789abcdef0123456789abcdef01234567';

async function manifest(file) {
  return JSON.parse(await readFile(join(manifestsDir, file), 'utf8'));
}

test('R-CW-5 and R-CW-6 each require their static check as an exact-candidate preflight', async () => {
  for (const [liveFile, live, preflightFile, preflight] of [
    ['r-cw-5.json', 'R-CW-5', 'r-cw-5a-static.json', 'R-CW-5A'],
    ['r-cw-6.json', 'R-CW-6', 'r-cw-6a-static.json', 'R-CW-6A'],
  ]) {
    const liveManifest = await manifest(liveFile);
    assert.equal(liveManifest.rowId, live);
    assert.equal(liveManifest.requiredPreflights.length, 1);
    const [requirement] = liveManifest.requiredPreflights;
    assert.equal(requirement.rowId, preflight);
    assert.equal(requirement.manifest, preflightFile);
    assert.equal(requirement.binding, 'exact-candidate-sha');
    assert.equal(requirement.passVerdict, 'construct-only');
    assert.equal(requirement.capOnMissingOrFailed, 'PARTIAL-candidate');
    assert.equal(requirement.receipt, 'required-preflight-receipt.json');
    assert.match(requirement.description, /exact candidate/);

    const preflightManifest = await manifest(preflightFile);
    assert.equal(preflightManifest.rowId, preflight);
    assert.deepEqual(
      { attachedTo: preflightManifest.preflightAttachment.attachedTo, proofRow: preflightManifest.preflightAttachment.proofRow, binding: preflightManifest.preflightAttachment.binding },
      { attachedTo: live, proofRow: 'retired', binding: 'exact-candidate-sha' },
    );
    assert.match(preflightManifest.preflightAttachment.ruling, /1565895695586558120/);
    // The static check itself is unchanged: offline, construct-only, never a cap receipt.
    assert.equal(preflightManifest.liveRunSafety.classification, 'static-preflight-only');
    assert.equal(preflightManifest.liveRunSafety.expectedArtifactClass, 'construct-only');
    assert.equal(preflightManifest.scenario.file, 'static-corpus-row-validator.js');
    assert.equal(preflightManifest.requiredPreflights, undefined);
  }
});

test('the row-manifest schema declares both fields with their fixed bindings', async () => {
  const schema = JSON.parse(await readFile(join(repoRoot, 'tools/k6-proofs/row-manifest.schema.json'), 'utf8'));
  const requirement = schema.properties.requiredPreflights.items;
  assert.equal(schema.properties.requiredPreflights.type, 'array');
  assert.deepEqual(requirement.required, ['rowId', 'manifest', 'binding', 'passVerdict', 'capOnMissingOrFailed', 'receipt']);
  assert.equal(requirement.additionalProperties, false);
  assert.equal(requirement.properties.binding.const, 'exact-candidate-sha');
  assert.equal(requirement.properties.capOnMissingOrFailed.const, 'PARTIAL-candidate');
  assert.equal(requirement.properties.receipt.const, 'required-preflight-receipt.json');
  const attachment = schema.properties.preflightAttachment;
  assert.deepEqual(attachment.required, ['attachedTo', 'proofRow', 'binding', 'ruling']);
  assert.equal(attachment.additionalProperties, false);
  assert.equal(attachment.properties.proofRow.const, 'retired');
  assert.equal(attachment.properties.binding.const, 'exact-candidate-sha');
});

test('the repository catalog passes the required-preflight rule', () => {
  const result = spawnSync(process.execPath, [checker], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Required preflight rule failures: 0/);
});

function liveManifest(overrides = {}) {
  return {
    rowId: 'R-LIVE',
    liveRunSafety: { classification: 'orchestration-required', expectedArtifactClass: 'PASS-candidate' },
    requiredPreflights: [{
      rowId: 'R-PRE',
      manifest: 'r-pre.json',
      binding: 'exact-candidate-sha',
      passVerdict: 'construct-only',
      capOnMissingOrFailed: 'PARTIAL-candidate',
      receipt: 'required-preflight-receipt.json',
      description: 'runs at the exact candidate',
    }],
    ...overrides,
  };
}

function preflightManifest(overrides = {}) {
  return {
    rowId: 'R-PRE',
    scenario: { status: 'runnable', file: 'static-corpus-row-validator.js' },
    liveRunSafety: { classification: 'static-preflight-only', expectedArtifactClass: 'construct-only' },
    preflightAttachment: { attachedTo: 'R-LIVE', proofRow: 'retired', binding: 'exact-candidate-sha', ruling: 'test' },
    ...overrides,
  };
}

async function runCatalog(manifests) {
  const root = await mkdtemp(join(tmpdir(), 'k6-required-preflight-catalog-'));
  try {
    await mkdir(join(root, 'PROOFS', SHA, 'R-LIVE'), { recursive: true });
    await mkdir(join(root, 'tools/k6-proofs/manifests'), { recursive: true });
    await mkdir(join(root, 'tools/k6-proofs/scenarios'), { recursive: true });
    await writeFile(join(root, 'PROOFS/INDEX.json'), `${JSON.stringify({ current_sha: SHA })}\n`);
    for (const [file, value] of Object.entries(manifests)) {
      await writeFile(join(root, 'tools/k6-proofs/manifests', file), `${JSON.stringify(value)}\n`);
    }
    return spawnSync(process.execPath, [checker], { cwd: root, encoding: 'utf8' });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('a consistent live row and preflight pair passes', async () => {
  const result = await runCatalog({ 'r-live.json': liveManifest(), 'r-pre.json': preflightManifest() });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Required preflight rule failures: 0/);
});

test('every disagreement between a live row and its preflight fails the catalog', async () => {
  const requirement = (patch) => liveManifest({ requiredPreflights: [{ ...liveManifest().requiredPreflights[0], ...patch }] });
  for (const [label, manifests, detail] of [
    ['preflight manifest absent', { 'r-live.json': liveManifest() },
      /r-live\.json: R-LIVE requires preflight R-PRE from r-pre\.json, which is not in the catalog/],
    ['preflight row id differs', { 'r-live.json': liveManifest(), 'r-pre.json': preflightManifest({ rowId: 'R-OTHER', preflightAttachment: { ...preflightManifest().preflightAttachment } }) },
      /r-live\.json: R-LIVE requires preflight R-PRE, but r-pre\.json declares R-OTHER/],
    ['no preflightAttachment', { 'r-live.json': liveManifest(), 'r-pre.json': preflightManifest({ preflightAttachment: undefined }) },
      /r-live\.json: R-LIVE requires R-PRE, but r-pre\.json declares no preflightAttachment/],
    ['attached elsewhere', { 'r-live.json': liveManifest(), 'r-pre.json': preflightManifest({ preflightAttachment: { ...preflightManifest().preflightAttachment, attachedTo: 'R-ELSE' } }) },
      /r-pre\.json: R-PRE is attached to R-ELSE, but R-LIVE \(r-live\.json\) requires it/],
    ['not retired', { 'r-live.json': liveManifest(), 'r-pre.json': preflightManifest({ preflightAttachment: { ...preflightManifest().preflightAttachment, proofRow: 'active' } }) },
      /r-pre\.json: preflightAttachment\.proofRow must be "retired"/],
    ['live classification', { 'r-live.json': liveManifest(), 'r-pre.json': preflightManifest({ liveRunSafety: { classification: 'k6-runnable', expectedArtifactClass: 'construct-only' } }) },
      /r-pre\.json: a preflight attachment must be static-preflight-only, not k6-runnable/],
    ['not runnable', { 'r-live.json': liveManifest(), 'r-pre.json': preflightManifest({ scenario: { status: 'scaffold' } }) },
      /r-pre\.json: a preflight attachment must have a runnable scenario/],
    ['pass verdict mismatch', { 'r-live.json': requirement({ passVerdict: 'PASS-candidate' }), 'r-pre.json': preflightManifest() },
      /r-live\.json: R-PRE passVerdict PASS-candidate is not r-pre\.json's expectedArtifactClass construct-only/],
    ['binding', { 'r-live.json': requirement({ binding: 'index-static-evidence-sha' }), 'r-pre.json': preflightManifest() },
      /r-live\.json: R-PRE binding must be "exact-candidate-sha"/],
    ['cap', { 'r-live.json': requirement({ capOnMissingOrFailed: 'FAIL-candidate' }), 'r-pre.json': preflightManifest() },
      /r-live\.json: R-PRE capOnMissingOrFailed must be "PARTIAL-candidate"/],
    ['receipt', { 'r-live.json': requirement({ receipt: 'summary.json' }), 'r-pre.json': preflightManifest() },
      /r-live\.json: R-PRE receipt must be "required-preflight-receipt\.json"/],
    ['listed twice', { 'r-live.json': liveManifest({ requiredPreflights: [liveManifest().requiredPreflights[0], liveManifest().requiredPreflights[0]] }), 'r-pre.json': preflightManifest() },
      /r-live\.json: R-LIVE lists preflight R-PRE twice/],
    ['orphan attachment', { 'r-live.json': liveManifest({ requiredPreflights: undefined }), 'r-pre.json': preflightManifest() },
      /r-pre\.json: R-PRE is attached to R-LIVE, but r-live\.json does not require it/],
    ['chained preflight', { 'r-live.json': liveManifest(), 'r-pre.json': preflightManifest({ requiredPreflights: liveManifest().requiredPreflights }) },
      /r-pre\.json: a preflight attachment cannot itself require preflights/],
    ['not an array', { 'r-live.json': liveManifest({ requiredPreflights: {} }), 'r-pre.json': preflightManifest() },
      /r-live\.json: requiredPreflights must be a non-empty array/],
  ]) {
    const result = await runCatalog(manifests);
    assert.notEqual(result.status, 0, `${label}: ${result.stdout}`);
    assert.match(result.stderr, detail, label);
  }
});
