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

// --- PR #493 exact-head review corrections (scribe-dandelion-cult) ---

test('handleSummary reads the authoritative verdict, never proof_failures alone', async () => {
  const source = await readFile(libPath, 'utf8');
  assert.match(
    source,
    /proof_row_pass/,
    'the verdict must travel to handleSummary on a metric, because module state does not',
  );
  assert.match(source, /iterations > 0 && passes === iterations && partials === 0 && failures === 0/);
  assert.doesNotMatch(
    source,
    /verdict:\s*failures === 0 \?/,
    'a failures-only derivation prints PASS for orchestration-gated rows that never raise the counter',
  );
  assert.match(
    source,
    /rowPassCounter\.add\(1\)/,
    'computeVerdict must publish the verdict it computed',
  );
});

test('no scenario in the family carries an over-escaped sentinel regex', async () => {
  for (const row of ROWS) {
    const source = await readScenario(row.scenario);
    assert.doesNotMatch(
      source,
      /\\\\\\\\[dsw]/,
      `${row.rowId}: a template-literal RegExp with \\\\\\\\d matches a literal backslash, so the receipt could never fire`,
    );
  }
});

test('R-CD-IN-1 binds the child report to the known canary rather than trusting it', async () => {
  const manifest = await readManifest('r-cd-in-1.json');
  const source = await readScenario('r-cd-in-1-typed-input-snapshot.js');
  for (const name of [
    'typed-tool-record-observed',
    'child-session-bound',
    'child-bytes-bound-to-canary',
  ]) {
    assert.ok(
      manifest.liveRunSafety.requiredReceipts.includes(name),
      `R-CD-IN-1 must require '${name}'`,
    );
  }
  assert.match(
    source,
    /reportedDigest === evidence\.content_receipt\.sha256_prefix/,
    'the child-reported digest must be compared against the canary the harness staged',
  );
  assert.match(source, /toolResultRecords\(classified\.data, 'continue_delegate'\)/);
  assert.match(source, /childSessionKeysForRow\(classified\.data, rowNonce\)/);
});

test('R-CD-OUT-CLAIM requires a claim-bound post-discard rejection', async () => {
  const manifest = await readManifest('r-cd-out-claim.json');
  assert.ok(
    manifest.liveRunSafety.requiredReceipts.includes('post-discard-inspect-rejected'),
    'without this receipt the row can PASS while the discarded claim is still readable',
  );
  const source = await readScenario('r-cd-out-claim-lifecycle.js');
  assert.match(source, /CDCLAIM-POSTDISCARD \$\{rowNonce\} <claimId> <ok\|rejected>/);
  assert.match(
    source,
    /postClaimId === evidence\.provenance\.claim_id/,
    'the post-discard probe must name the same claim that was discarded',
  );
  assert.match(
    source,
    /evidence\.post_discard_tool_rejection === true/,
    'the rejection must be bound to a structured delegate_artifacts error record',
  );
});

test('R-CD-IN-REVOKE credits refusal, no-spawn and scrub from authoritative surfaces', async () => {
  const manifest = await readManifest('r-cd-in-revoke.json');
  for (const name of [
    'pre-probe-session-inventory',
    'policy-revoke-tool-refusal',
    'no-child-session-observed',
    'durable-state-scrubbed',
  ]) {
    assert.ok(
      manifest.liveRunSafety.requiredReceipts.includes(name),
      `R-CD-IN-REVOKE must require '${name}'`,
    );
  }
  const source = await readScenario('r-cd-in-revoke-no-spawn-scrub.js');
  assert.match(source, /toolResultRecords\(classified\.data, 'continue_delegate'\)/);
  assert.match(source, /toolRecordRejected\(record\)/);
  assert.match(source, /tracker\.send\(socket, 'sessions\.list'/);
  assert.match(source, /sessionKeysFromList\(classified\.payload\)/);
  assert.match(source, /recordCarriesAttachmentState\(record\)/);
  assert.doesNotMatch(
    source,
    /fire\(evidence, 'policy-revoke-refusal'\)/,
    'the refusal receipt must not be fired from a prose sentinel',
  );
});

for (const restartRow of ['r-cd-in-recovery-queued-restart.js', 'r-cd-out-restart-replay.js']) {
  test(`${restartRow} requires an observed restart plus disconnect/reconnect`, async () => {
    const source = await readScenario(restartRow);
    assert.match(source, /observeGatewayRestart\(\{/, 'the restart must be observed, not declared');
    assert.match(source, /'gateway-restart-observed'/);
    assert.match(source, /'reconnected-after-restart'/);
    const connects = source.match(/ws\.connect\(url, \{\}, \(socket\) => \{/g) || [];
    assert.equal(
      connects.length,
      2,
      'the row must disconnect before the restart window and reconnect after it',
    );
    assert.doesNotMatch(
      source,
      /orchestrationGate\(\s*evidence,\s*restartOrchestrated &&/,
      'OPENCLAW_RESTART_ORCHESTRATED is an operator declaration and must not gate the verdict by itself',
    );
    assert.match(
      source,
      /the declaration is not evidence/,
      'the recorded reason must say why a declaration alone is not credited',
    );
  });
}

for (const restartManifest of ['r-cd-in-recovery.json', 'r-cd-out-replay.json']) {
  test(`${restartManifest} requires the lifecycle and reconnect receipts`, async () => {
    const manifest = await readManifest(restartManifest);
    for (const name of ['gateway-restart-observed', 'reconnected-after-restart']) {
      assert.ok(
        manifest.liveRunSafety.requiredReceipts.includes(name),
        `${restartManifest} must require '${name}'`,
      );
    }
  });
}

test('the k6 PROOF workflow dry run never executes a mutating scenario', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  const dryRunStep = workflow.slice(
    workflow.indexOf('- name: Dry run — validate without executing'),
    workflow.indexOf('- name: Compute live-run lock identity'),
  );
  assert.ok(dryRunStep.length > 0, 'the dry-run step must exist');
  assert.doesNotMatch(dryRunStep, /\bk6 run\b/, 'a dry run must not execute the scenario');
  assert.match(dryRunStep, /k6 archive/, 'a dry run compiles and inspects instead of executing');
  const liveStep = workflow.slice(workflow.indexOf('- name: Run k6 scenario (live)'));
  assert.match(liveStep, /if: \$\{\{ github\.event\.inputs\.dry_run != 'true' \}\}/);
});

test('the k6 PROOF workflow serializes on the target session and takes both locks', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  assert.match(
    workflow,
    /group: k6-proof-session-\$\{\{ github\.event\.inputs\.gateway_ws \}\}-\$\{\{ github\.event\.inputs\.session_key \}\}/,
    'the concurrency group must be keyed on the target session, not on row+seat',
  );
  assert.match(workflow, /live-run-guard\.mjs --manifest "\$MANIFEST_PATH" --shell --require-lock/);
  assert.match(workflow, /flock --nonblock --conflict-exit-code 75 "\$SESSION_LOCK_PATH"/);
  assert.match(workflow, /flock --nonblock --conflict-exit-code 75 "\$ROW_LOCK_PATH"/);
  assert.match(
    workflow,
    /manifest_path is required when dry_run=false/,
    'a live run without a manifest can compute neither its lock identity nor its safety contract',
  );
});

test('the k6 PROOF workflow binds manifest/scenario identity and uploads only sanitized logs', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  assert.match(workflow, /--manifest "\$MANIFEST_PATH"/);
  assert.match(workflow, /--scenario "\$\{SCENARIO\}\.js"/);
  assert.match(workflow, /sanitize-k6-artifacts\.mjs \\\n\s+--log-input \/tmp\/k6-out\/run\.txt/);
  assert.match(workflow, /rm -f \/tmp\/k6-out\/run\.txt/);
  assert.doesNotMatch(
    workflow,
    /path: \|\n(?:.*\n)*?\s+\/tmp\/k6-out\/run\.txt\n/,
    'the raw k6 console log must never be uploaded',
  );
});

test('the k6 PROOF workflow readiness preflight cannot return success into a live run', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  const preflight = workflow.slice(
    workflow.indexOf('- name: Seat readiness preflight'),
    workflow.indexOf('- name: Dry run — validate without executing'),
  );
  assert.match(preflight, /this dry run validates artifacts only and executes nothing/);
  assert.match(preflight, /exit 1/, 'a live run must fail closed on readiness failure');
});

// --- evidence-writer must consume the receipt-map shape, not the legacy flags ---

const { mkdtemp, writeFile, readFile: readFileAsync, rm } = await import('node:fs/promises');
const { spawnSync } = await import('node:child_process');
const os = await import('node:os');

const writerPath = path.join(repoRoot, 'tools/k6-proofs/scripts/evidence-writer.mjs');
const CANDIDATE_SHA = '374ad60c6d34d3c710ddab3a13ce2189e1fd09fb';

function receiptMapEvidence(overrides = {}) {
  return {
    row: 'R-CD-IN-1',
    issue: 491,
    manifest_loaded: true,
    receipts: Object.fromEntries(
      [
        'tool-invoke-accepted',
        'typed-tool-record-observed',
        'input-snapshot-staged',
        'child-session-bound',
        'child-mount-provenance',
        'child-bytes-bound-to-canary',
      ].map((name) => [name, { observed: true, at_ms: 1 }]),
    ),
    negative_checks: {
      'no-raw-attachment-bytes-on-the-wire': { held: true },
      'no-absolute-path-mount': { held: true },
      'child-bytes-match-the-known-canary': { held: true },
    },
    orchestration: { required: null, observed: false, reason: null },
    missing_receipts: [],
    violated_negative_checks: [],
    redacted_events: [{ ts: 1, kind: 'event', event: 'x', data: { ok: true } }],
    verdict: 'PASS-candidate',
    ...overrides,
  };
}

async function runWriter(evidence, extraArgs = []) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'p86-writer-'));
  const input = path.join(dir, 'run.txt');
  await writeFile(
    input,
    `--- ${evidence.row} EVIDENCE SUMMARY ---\n${JSON.stringify(evidence)}\n--- END EVIDENCE ---\n`,
  );
  const run = spawnSync(
    process.execPath,
    [
      writerPath,
      '--input', input,
      '--row', evidence.row,
      '--seat', 'rune-rog-ally',
      '--sha', CANDIDATE_SHA,
      ...extraArgs,
    ],
    { cwd: dir, encoding: 'utf8' },
  );
  return { dir, run };
}

test('evidence-writer publishes the receipt-map verdict instead of FAIL-candidate', async () => {
  const { dir, run } = await runWriter(receiptMapEvidence(), [
    '--manifest', path.join(manifestsDir, 'r-cd-in-1.json'),
    '--scenario', 'r-cd-in-1-typed-input-snapshot.js',
  ]);
  try {
    assert.equal(run.status, 0, run.stderr);
    const { runDir } = JSON.parse(run.stdout);
    const result = JSON.parse(await readFileAsync(path.join(dir, runDir, 'row-result.json'), 'utf8'));
    assert.equal(result.outcome, 'PASS-candidate');
    assert.equal(result.verdictSource, 'receipt-map-recomputed');
    assert.equal(result.scenario, 'r-cd-in-1-typed-input-snapshot.js');
    assert.deepEqual(result.receiptAudit.missingReceipts, []);
    const log = await readFileAsync(path.join(dir, runDir, 'k6-run.log'), 'utf8');
    assert.match(log, /PUBLIC_EVIDENCE/, 'the run log is published only through the sanitizer');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('evidence-writer refuses a PASS the receipt map does not support', async () => {
  const weakened = receiptMapEvidence();
  delete weakened.receipts['child-bytes-bound-to-canary'];
  const { dir, run } = await runWriter(weakened, [
    '--manifest', path.join(manifestsDir, 'r-cd-in-1.json'),
  ]);
  try {
    assert.equal(run.status, 1);
    assert.match(run.stderr, /receipt map does not support it/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('evidence-writer keeps an unobserved orchestration precondition at PARTIAL', async () => {
  const gated = receiptMapEvidence({
    row: 'R-CD-OUT-REPLAY',
    receipts: Object.fromEntries(
      [
        'pre-restart-claim-established',
        'gateway-restart-observed',
        'reconnected-after-restart',
        'post-restart-claim-listed',
        'claim-identity-stable',
        'replay-is-idempotent',
      ].map((name) => [name, { observed: true, at_ms: 1 }]),
    ),
    negative_checks: {
      'no-duplicate-claim-after-replay': { held: true },
      'no-auto-materialize-on-replay': { held: true },
      'no-raw-artifact-bytes-on-the-wire': { held: true },
    },
    orchestration: { required: 'operator gateway restart', observed: false, reason: 'no restart observed' },
    verdict: 'PARTIAL-candidate',
  });
  const { dir, run } = await runWriter(gated, [
    '--manifest', path.join(manifestsDir, 'r-cd-out-replay.json'),
  ]);
  try {
    assert.equal(run.status, 0, run.stderr);
    const { runDir } = JSON.parse(run.stdout);
    const result = JSON.parse(await readFileAsync(path.join(dir, runDir, 'row-result.json'), 'utf8'));
    assert.equal(result.outcome, 'PARTIAL-candidate');
    assert.equal(result.receiptAudit.orchestrationObserved, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('evidence-writer refuses a row/manifest identity mismatch', async () => {
  const { dir, run } = await runWriter(receiptMapEvidence(), [
    '--manifest', path.join(manifestsDir, 'r-cd-out-claim.json'),
  ]);
  try {
    assert.equal(run.status, 1);
    assert.match(run.stderr, /does not match --row/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
