import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const manifestsDir = path.join(repoRoot, 'tools/k6-proofs/manifests');
const scenariosDir = path.join(repoRoot, 'tools/k6-proofs/scenarios');
const libPath = path.join(repoRoot, 'tools/k6-proofs/lib/delegate-attachment-io.js');
const docPath = path.join(repoRoot, 'tools/k6-proofs/docs/DELEGATE-ATTACHMENT-IO-ROWS.md');
const workflowPath = path.join(repoRoot, '.github/workflows/k6-proof.yml');

/**
 * The P86 delegate attachment I/O row family (docs#491).
 *
 * `orchestrationGated` rows depend on an operator step a k6 harness cannot
 * perform (config revoke, gateway restart). They must never declare a
 * PASS-candidate expectation, and their scenario must route the verdict through
 * `orchestrationGate` so an unperformed precondition cannot be silently upgraded.
 */
const ROWS = [
  {
    rowId: 'R-CD-IN-1',
    manifest: 'r-cd-in-1.json',
    scenario: 'r-cd-in-1-typed-input-snapshot.js',
    orchestrationGated: false,
  },
  {
    rowId: 'R-CD-IN-RECOVERY',
    manifest: 'r-cd-in-recovery.json',
    scenario: 'r-cd-in-recovery-queued-restart.js',
    orchestrationGated: true,
  },
  {
    rowId: 'R-CD-IN-REVOKE',
    manifest: 'r-cd-in-revoke.json',
    scenario: 'r-cd-in-revoke-no-spawn-scrub.js',
    orchestrationGated: true,
  },
  {
    rowId: 'R-CD-OUT-PUBLISH',
    manifest: 'r-cd-out-publish.json',
    scenario: 'r-cd-out-publish-claim.js',
    orchestrationGated: false,
  },
  {
    rowId: 'R-CD-OUT-CLAIM',
    manifest: 'r-cd-out-claim.json',
    scenario: 'r-cd-out-claim-lifecycle.js',
    orchestrationGated: false,
  },
  {
    rowId: 'R-CD-OUT-UNAUTHORIZED',
    manifest: 'r-cd-out-unauthorized.json',
    scenario: 'r-cd-out-unauthorized-reject.js',
    orchestrationGated: false,
  },
  {
    rowId: 'R-CD-OUT-REPLAY',
    manifest: 'r-cd-out-replay.json',
    scenario: 'r-cd-out-restart-replay.js',
    orchestrationGated: true,
  },
  {
    rowId: 'R-CD-IO-NEG',
    manifest: 'r-cd-io-neg.json',
    scenario: 'r-cd-io-negative-boundary.js',
    orchestrationGated: false,
  },
];

async function readManifest(file) {
  return JSON.parse(await readFile(path.join(manifestsDir, file), 'utf8'));
}

async function readScenario(file) {
  return readFile(path.join(scenariosDir, file), 'utf8');
}

for (const row of ROWS) {
  test(`${row.rowId} manifest binds to docs#491 and the candidate SHA`, async () => {
    const manifest = await readManifest(row.manifest);
    assert.equal(manifest.schema, 'openclaw.k6.proof-row-manifest.v1');
    assert.equal(manifest.rowId, row.rowId);
    assert.equal(manifest.issue, 491, 'every row in this family binds to docs#491');
    assert.equal(manifest.candidateSha, '${OPENCLAW_CANDIDATE_SHA}');
    assert.equal(manifest.artifactDestination.row, row.rowId);
    assert.equal(manifest.review.candidateOnly, true);
    assert.equal(manifest.review.foldRequiresReview, true);
    assert.equal(manifest.liveRunSafety.foldRequiresReview, true);
    assert.equal(
      manifest.liveRunSafety.requiresCandidateSha,
      true,
      'a receipt is only meaningful when pinned to the SHA it was fired against',
    );
    assert.equal(
      manifest.liveRunSafety.sameSessionConcurrencySafe,
      false,
      'these rows mutate delegate/claim state and must be serialized per session',
    );
  });

  test(`${row.rowId} manifest points at its runnable scenario`, async () => {
    const manifest = await readManifest(row.manifest);
    assert.equal(manifest.scenario.status, 'runnable');
    assert.equal(manifest.scenario.file, row.scenario);
    await readScenario(row.scenario); // throws when the file is missing
  });

  test(`${row.rowId} requiredReceipts all resolve to declared expectedReceipts`, async () => {
    const manifest = await readManifest(row.manifest);
    const declared = new Set(manifest.expectedReceipts.map((receipt) => receipt.name));
    for (const name of manifest.liveRunSafety.requiredReceipts) {
      if (name === 'seat-readiness') continue;
      assert.ok(
        declared.has(name),
        `${row.rowId}: requiredReceipts names '${name}' with no matching expectedReceipts entry`,
      );
    }
  });

  test(`${row.rowId} scenario never writes attachment content into evidence`, async () => {
    const source = await readScenario(row.scenario);
    assert.match(
      source,
      /contentReceipt\(canary\)/,
      'the canary must be reduced to a byte count and digest, never stored',
    );
    assert.doesNotMatch(
      source,
      /content_receipt\s*=\s*canary/,
      'the canary content must never be assigned into evidence directly',
    );
    assert.match(source, /capture\(evidence, classified\)/, 'every frame goes through the redacting capture');
    assert.doesNotMatch(
      source,
      /redacted_events\.push/,
      'scenarios must not bypass capture() to push unredacted frames',
    );
  });

  test(`${row.rowId} scenario carries at least one negative boundary check`, async () => {
    const source = await readScenario(row.scenario);
    assert.match(source, /declareNegative\(/, `${row.rowId} must declare a negative check`);
    assert.match(
      source,
      /computeVerdict\(evidence, REQUIRED\)/,
      'the verdict must come from the shared honesty gate, not an ad-hoc boolean',
    );
  });

  test(`${row.rowId} orchestration gating matches its declared artifact class`, async () => {
    const manifest = await readManifest(row.manifest);
    const source = await readScenario(row.scenario);
    if (row.orchestrationGated) {
      assert.equal(
        manifest.liveRunSafety.classification,
        'orchestration-required',
        `${row.rowId} depends on an operator step and must be orchestration-required`,
      );
      assert.equal(
        manifest.liveRunSafety.expectedArtifactClass,
        'PARTIAL-candidate',
        `${row.rowId} must not advertise PASS for an operator step the harness cannot perform`,
      );
      assert.match(
        source,
        /orchestrationGate\(/,
        `${row.rowId} must route its verdict through orchestrationGate`,
      );
    } else {
      assert.equal(manifest.liveRunSafety.classification, 'k6-runnable');
      assert.equal(manifest.liveRunSafety.expectedArtifactClass, 'PASS-candidate');
    }
  });
}

test('no row in the family can be forced to PASS by an environment variable', async () => {
  for (const row of ROWS) {
    const source = await readScenario(row.scenario);
    assert.doesNotMatch(
      source,
      /verdict\s*=\s*['"]PASS-candidate['"]/,
      `${row.rowId} must not assign PASS-candidate directly`,
    );
    assert.doesNotMatch(
      source,
      /FORCE_PASS|OPENCLAW_ASSUME_|SKIP_NEGATIVE/,
      `${row.rowId} must expose no verdict override switch`,
    );
  }
});

test('computeVerdict only returns PASS when receipts, negatives and orchestration all hold', async () => {
  const source = await readFile(libPath, 'utf8');
  assert.match(source, /missing\.length === 0 && violated\.length === 0 && orchestrationOk/);
  assert.match(source, /\? 'PASS-candidate'\s*\n?\s*:\s*'PARTIAL-candidate'/);
  assert.doesNotMatch(
    source,
    /HONEST-LIMIT-candidate/,
    'HONEST-LIMIT is reserved for R-RC-2 and must not leak into this family',
  );
});

test('the shared lib never records raw payload content', async () => {
  const source = await readFile(libPath, 'utf8');
  assert.match(source, /sha256_prefix/);
  assert.match(source, /bytes: text\.length/);
  assert.doesNotMatch(
    source,
    /content:\s*text/,
    'contentReceipt must not carry the payload itself',
  );
  assert.match(source, /import \{ redactEvent \} from '\.\/gateway-ws\.js'/);
});

test('the harness-echo exclusion is explicit and counted, not silent', async () => {
  const source = await readFile(libPath, 'utf8');
  assert.match(source, /prompt_echoes_ignored \+= 1/);
  assert.match(source, /HARNESS_MARKER/);
});

test('the OUT rows exercise the real delegate_artifacts controller actions', async () => {
  const lifecycle = await readScenario('r-cd-out-claim-lifecycle.js');
  for (const action of ['list', 'inspect', 'materialize', 'discard']) {
    assert.match(
      lifecycle,
      new RegExp(`action="${action}"`),
      `R-CD-OUT-CLAIM must drive the real delegate_artifacts action=${action}`,
    );
  }
  const publish = await readScenario('r-cd-out-publish-claim.js');
  assert.match(publish, /delegate_artifacts_publish/);
});

test('the IN rows exercise the typed attachment-bearing continue_delegate surface', async () => {
  for (const file of [
    'r-cd-in-1-typed-input-snapshot.js',
    'r-cd-in-recovery-queued-restart.js',
    'r-cd-in-revoke-no-spawn-scrub.js',
  ]) {
    const source = await readScenario(file);
    assert.match(source, /continue_delegate/, `${file} must call continue_delegate`);
    assert.match(source, /attachments=\[\{/, `${file} must carry a typed inline attachment`);
  }
});

test('R-CD-IN-REVOKE reads the live policy and refuses to assume a default', async () => {
  const source = await readScenario('r-cd-in-revoke-no-spawn-scrub.js');
  assert.match(source, /tracker\.send\(socket, 'config\.get', \{\}\)/);
  assert.match(source, /operator_surface: true/);
  assert.match(
    source,
    /typeof enabled === 'boolean' \? enabled : null/,
    'an absent policy field must read as null (PARTIAL), never as a presumed default',
  );
  assert.match(source, /attachment_policy_enabled === false/);
});

test('R-CD-IO-NEG keeps a positive control so its negatives are not vacuous', async () => {
  const source = await readScenario('r-cd-io-negative-boundary.js');
  assert.match(source, /claim-announced-positive-control/);
  assert.match(source, /negative-window-elapsed/);
  const manifest = await readManifest('r-cd-io-neg.json');
  assert.ok(
    manifest.liveRunSafety.requiredReceipts.includes('claim-announced-positive-control'),
    'the positive control must be a required receipt',
  );
  for (const negative of [
    'no-automatic-raw-byte-mount',
    'no-automatic-materialization',
    'no-native-media-upload',
    'no-generic-render-or-forward',
    'no-prompt-injection',
  ]) {
    assert.ok(
      manifest.liveRunSafety.requiredReceipts.includes(negative),
      `${negative} must be a required receipt on R-CD-IO-NEG`,
    );
  }
});

test('R-CD-OUT-UNAUTHORIZED keeps a recipient positive control', async () => {
  const manifest = await readManifest('r-cd-out-unauthorized.json');
  assert.ok(manifest.liveRunSafety.requiredReceipts.includes('recipient-positive-control'));
  const source = await readScenario('r-cd-out-unauthorized-reject.js');
  assert.match(source, /askRecipientPositiveControl/);
});

test('every row is a dispatch choice in the k6 PROOF row workflow', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  for (const row of ROWS) {
    const choice = row.scenario.replace(/\.js$/u, '');
    assert.ok(
      workflow.includes(`- ${choice}\n`),
      `${row.rowId}: '${choice}' is missing from the workflow scenario choices`,
    );
  }
});

test('the family doc names every row and its runtime controller', async () => {
  const doc = await readFile(docPath, 'utf8');
  assert.match(doc, /issues\/491/);
  for (const row of ROWS) {
    assert.ok(doc.includes(row.rowId), `family doc is missing ${row.rowId}`);
    assert.ok(doc.includes(row.manifest), `family doc is missing ${row.manifest}`);
    assert.ok(doc.includes(row.scenario), `family doc is missing ${row.scenario}`);
  }
  assert.match(doc, /delegate_artifacts_publish/);
  assert.match(doc, /scrubStoredDelegateAttachmentState/);
  assert.match(doc, /delegate-artifact-delivery\.ts/);
});
