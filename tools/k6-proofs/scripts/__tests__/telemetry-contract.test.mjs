/**
 * telemetry-contract.test.mjs — continuation telemetry remedy contracts
 * (karmaterminal/openclaw#1254).
 *
 * The census established that a proof row can execute real behavior and remain
 * impossible to rebind afterwards: accepted continuation entry spans omit
 * origin/session/turn identity, proof traffic has no durable marker, terminal
 * outcomes exist only as log heuristics, and a degraded backend answers 200
 * with zero results. These tests pin the catalog rules that stop any of that
 * from quietly becoming a PASS.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, readFile, symlink, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  IDENTITY_PURPOSES,
  REMEDY_CONCERNS,
  TELEMETRY_CONTRACT_SCHEMA,
  TELEMETRY_RECEIPTS,
  validateTelemetryCatalog,
  validateTelemetryContract,
} from '../check-telemetry-contracts.mjs';
import {
  buildTelemetryBackendStatusReceipt,
  classifyTelemetryBackendInteraction,
} from '../../lib/telemetry-backend-status.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const manifestsDir = path.join(repoRoot, 'tools/k6-proofs/manifests');
const validator = path.join(repoRoot, 'tools/k6-proofs/scripts/check-telemetry-contracts.mjs');
const postprocess = path.join(repoRoot, 'tools/k6-proofs/scripts/postprocess-k6-summary.mjs');
const preflightManifest = path.join(repoRoot, 'tools/k6-proofs/manifests/preflight.example.json');
const preflightSummary = path.join(repoRoot, 'tools/k6-proofs/examples/k6-summary.preflight.example.json');

const CENSUS = {
  issue: 'karmaterminal/openclaw#1254',
  reportCommit: '39803b297bd4786db3971eb82a3a7fd0b29bc643',
  productBasis: '6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955',
};

/** The rows the census workorder requires to carry a telemetry contract. */
const AUDITED_ROWS = [
  'R-CD-1',
  'R-CD-2',
  'R-CD-4',
  'R-CD-CHAINED-DEPTH-2',
  'R-CD-MODEL-TOOL',
  'R-CD-TOKEN',
  'R-CW-1',
  'R-CW-3',
  'R-RC-2',
];

/** The cross-cutting remedy rows added by this change. */
const REMEDY_ROWS = {
  'R-OBS-CONT-PROVENANCE': 'origin-provenance',
  'R-OBS-PROOF-MARKER': 'proof-run-classification',
  'R-OBS-TERMINAL-OUTCOME': 'terminal-outcome',
  'R-OBS-BACKEND-DISPOSITION': 'backend-disposition',
};

async function loadCatalog() {
  const { readdir } = await import('node:fs/promises');
  const files = (await readdir(manifestsDir)).filter((name) => name.endsWith('.json')).sort();
  const entries = [];
  for (const file of files) {
    entries.push({ file, manifest: JSON.parse(await readFile(path.join(manifestsDir, file), 'utf8')) });
  }
  return entries;
}

function contractFixture(overrides = {}) {
  const base = {
    schema: TELEMETRY_CONTRACT_SCHEMA,
    census: { ...CENSUS },
    enforcement: 'advisory',
    rebindable: false,
    productInstrumentationPrerequisite: true,
    prerequisiteRows: ['R-OBS-CONT-PROVENANCE'],
    rebindReceipts: ['trace-id'],
    expectedTelemetry: {
      spans: [{ name: 'continuation.work', role: 'accepted-entry', emittedByProduct: true }],
      attributes: [
        { key: 'continuation.chain.id', purpose: 'chain', emittedByProduct: true, publicSafeForm: 'sha256-16' },
      ],
    },
    redaction: { rule: 'digest only', forbiddenInArtifacts: ['raw reason'] },
    controls: { positive: 'fire both surfaces', negative: 'empty drain stays empty' },
    backendUnavailable: {
      disposition: 'PARTIAL-candidate',
      treatZeroAsAbsence: false,
      requiredCompletenessKeys: ['totalBlocks'],
      rebindKeys: ['candidate_sha'],
    },
    artifact: {
      schema: 'openclaw.k6.proof-row-result.v1',
      requiredFiles: ['row-result.json', 'backend-status.json'],
    },
    verdictAuthority: { passScope: 'behavioral-only', pass: 'p', partial: 'q', fail: 'r' },
    execution: { deterministicK6: 'k6', manual: 'manual', relationship: 'k6 wins' },
  };
  return { ...base, ...overrides };
}

function manifestFixture(contractOverrides = {}, manifestOverrides = {}) {
  return {
    schema: 'openclaw.k6.proof-row-manifest.v1',
    rowId: 'R-FIXTURE',
    expectedReceipts: [{ name: 'trace-id', required: true }],
    liveRunSafety: { requiredReceipts: ['trace-id'] },
    telemetryContract: contractFixture(contractOverrides),
    ...manifestOverrides,
  };
}

async function writeCompleteBackend(dir, rowId = 'PREFLIGHT') {
  const requiredCompletenessKeys = [
    'totalBlocks',
    'completedJobs',
    'inspectedBytes',
    'tempoApiStatus',
  ];
  const receipt = buildTelemetryBackendStatusReceipt({
    rowId,
    candidateSha: null,
    seat: 'unit',
    proofRunId: 'postprocess-unit',
    requiredCompletenessKeys,
    rebindKeys: [],
    interactions: [classifyTelemetryBackendInteraction({
      backend: 'tempo',
      operation: 'search',
      httpStatus: 200,
      responseJson: {
        metrics: {
          totalBlocks: 1,
          completedJobs: 1,
          totalJobs: 1,
          inspectedBytes: 1024,
        },
      },
      resultCount: 1,
      queryFingerprint: '1'.repeat(16),
      backendBaseUrlEnv: 'OPENCLAW_PROOFS_TEMPO_BASE_URL',
      requiredCompletenessKeys,
    })],
  });
  const file = path.join(dir, 'backend-status.json');
  await writeFile(file, `${JSON.stringify(receipt, null, 2)}\n`);
  return file;
}

const identityAttributes = () =>
  IDENTITY_PURPOSES.map((purpose) => ({
    key: `continuation.${purpose}.fingerprint`,
    purpose,
    emittedByProduct: true,
    publicSafeForm: 'salted-fingerprint',
  }));

test('the committed catalog satisfies the telemetry contract rules', async () => {
  const { failures } = validateTelemetryCatalog(await loadCatalog());
  assert.deepEqual(failures, []);
});

test('every row the census audit names declares a telemetry contract bound to the census', async () => {
  const byRowId = new Map((await loadCatalog()).map(({ manifest }) => [manifest.rowId, manifest]));

  for (const rowId of AUDITED_ROWS) {
    const manifest = byRowId.get(rowId);
    assert.ok(manifest, `${rowId} is missing from the manifest catalog`);
    const contract = manifest.telemetryContract;
    assert.ok(contract, `${rowId} must declare a telemetryContract`);
    assert.equal(contract.schema, TELEMETRY_CONTRACT_SCHEMA);
    assert.deepEqual(
      { issue: contract.census.issue, reportCommit: contract.census.reportCommit, productBasis: contract.census.productBasis },
      CENSUS,
      `${rowId} must bind to the exact census report and product basis`,
    );

    // The eight definitions every changed/new row owes.
    assert.ok(contract.expectedTelemetry.spans.length > 0, `${rowId} expected spans`);
    assert.ok(contract.expectedTelemetry.attributes.length > 0, `${rowId} expected attributes`);
    assert.ok(contract.redaction.rule.length > 0, `${rowId} redaction rule`);
    assert.ok(contract.controls.positive && contract.controls.negative, `${rowId} controls`);
    assert.equal(contract.backendUnavailable.treatZeroAsAbsence, false, `${rowId} zero is not absence`);
    assert.ok(contract.artifact.schema, `${rowId} artifact schema`);
    assert.ok(contract.verdictAuthority.passScope, `${rowId} verdict authority`);
    assert.ok(contract.execution.relationship, `${rowId} manual vs deterministic relationship`);
    assert.equal(typeof contract.productInstrumentationPrerequisite, 'boolean', `${rowId} prerequisite flag`);
  }
});

test('no committed row claims a telemetry-rebindable PASS, because no product attribute exists yet', async () => {
  for (const { file, manifest } of await loadCatalog()) {
    const contract = manifest.telemetryContract;
    if (!contract) continue;
    assert.equal(contract.rebindable, false, `${file} claims rebindable=true`);
    assert.equal(
      contract.verdictAuthority.passScope,
      'behavioral-only',
      `${file} claims a telemetry-rebindable pass scope`,
    );
  }
});

test('each census remedy concern is owned by exactly one guarded row', async () => {
  const byRowId = new Map((await loadCatalog()).map(({ manifest }) => [manifest.rowId, manifest]));
  const seen = new Set();

  for (const [rowId, concern] of Object.entries(REMEDY_ROWS)) {
    const manifest = byRowId.get(rowId);
    assert.ok(manifest, `${rowId} is missing from the manifest catalog`);
    assert.equal(manifest.telemetryContract.remedyConcern, concern);
    assert.equal(manifest.telemetryContract.enforcement, 'blocking');
    const harnessSide = rowId === 'R-OBS-BACKEND-DISPOSITION';
    assert.equal(manifest.scenario.status, harnessSide ? 'runnable' : 'construct-only');
    assert.equal(
      manifest.liveRunSafety.classification,
      harnessSide ? 'k6-runnable' : 'construct-only',
    );
    assert.equal(
      manifest.liveRunSafety.expectedArtifactClass,
      harnessSide ? 'PASS-candidate' : 'construct-only',
    );
    seen.add(concern);
  }

  assert.deepEqual([...seen].sort(), [...REMEDY_CONCERNS].sort());
});

test('the one harness-side remedy row is the only one that does not wait on product instrumentation', async () => {
  const byRowId = new Map((await loadCatalog()).map(({ manifest }) => [manifest.rowId, manifest]));
  assert.equal(
    byRowId.get('R-OBS-BACKEND-DISPOSITION').telemetryContract.productInstrumentationPrerequisite,
    false,
  );
  for (const rowId of ['R-OBS-CONT-PROVENANCE', 'R-OBS-PROOF-MARKER', 'R-OBS-TERMINAL-OUTCOME']) {
    assert.equal(byRowId.get(rowId).telemetryContract.productInstrumentationPrerequisite, true, rowId);
  }
});

test('a telemetry-dependent row cannot omit the contract', () => {
  const manifest = manifestFixture();
  delete manifest.telemetryContract;
  const failures = validateTelemetryContract(manifest);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /declares no telemetryContract/);

  // A row with no telemetry receipt is unaffected.
  const offline = { rowId: 'R-OFFLINE', liveRunSafety: { requiredReceipts: ['seat-readiness'] } };
  assert.deepEqual(validateTelemetryContract(offline), []);
});

test('every telemetry receipt name in the catalog is covered by the contract trigger', async () => {
  const triggered = new Set();
  for (const { manifest } of await loadCatalog()) {
    for (const name of manifest?.liveRunSafety?.requiredReceipts || []) {
      if (TELEMETRY_RECEIPTS.has(name)) triggered.add(name);
    }
  }
  // Every trigger the committed catalog actually uses resolves to a row that
  // declares a contract; the catalog-wide assertion above proves that.
  assert.ok(triggered.size >= 4, `expected several telemetry triggers, saw ${[...triggered].join(', ')}`);
});

test('rebindable=true is refused without product-emitted identity and proof marker', () => {
  const missingEverything = validateTelemetryContract(
    manifestFixture({ rebindable: true, productInstrumentationPrerequisite: false, prerequisiteRows: undefined }),
  );
  assert.ok(missingEverything.some((f) => /requires product-emitted identity attributes for origin, session, turn, run/.test(f)));
  assert.ok(missingEverything.some((f) => /requires a product-emitted proof-run marker attribute/.test(f)));

  const identityOnly = validateTelemetryContract(
    manifestFixture({
      rebindable: true,
      productInstrumentationPrerequisite: false,
      prerequisiteRows: undefined,
      expectedTelemetry: {
        spans: [{ name: 'continuation.work', role: 'accepted-entry', emittedByProduct: true }],
        attributes: identityAttributes(),
      },
    }),
  );
  assert.deepEqual(
    identityOnly.filter((f) => /identity attributes/.test(f)),
    [],
    'identity is satisfied',
  );
  assert.ok(identityOnly.some((f) => /proof-run marker/.test(f)), 'proof marker is still required');

  const complete = validateTelemetryContract(
    manifestFixture({
      rebindable: true,
      productInstrumentationPrerequisite: false,
      prerequisiteRows: undefined,
      enforcement: 'blocking',
      rebindReceipts: ['trace-id'],
      expectedTelemetry: {
        spans: [{ name: 'continuation.work', role: 'accepted-entry', emittedByProduct: true }],
        attributes: [
          ...identityAttributes(),
          { key: 'openclaw.proof.run_id', purpose: 'proof-run', emittedByProduct: true, publicSafeForm: 'sha256-16' },
        ],
      },
      verdictAuthority: {
        passScope: 'behavioral-and-telemetry-rebindable',
        pass: 'p',
        partial: 'q',
        fail: 'r',
      },
    }),
  );
  assert.deepEqual(complete, []);
});

test('a rebindable pass scope cannot be declared while the row is not rebindable', () => {
  const failures = validateTelemetryContract(
    manifestFixture({
      verdictAuthority: { passScope: 'behavioral-and-telemetry-rebindable', pass: 'p', partial: 'q', fail: 'r' },
    }),
  );
  assert.ok(failures.some((f) => /passScope=behavioral-and-telemetry-rebindable requires rebindable=true/.test(f)));
});

test('a telemetry-rebindable claim must be enforceable, not merely declared', () => {
  // The hole this closes: rebindable=true with advisory enforcement and no
  // rebind receipts left the post-processor nothing to withhold a PASS on.
  const advisoryRebindable = validateTelemetryContract(
    manifestFixture({
      rebindable: true,
      productInstrumentationPrerequisite: false,
      prerequisiteRows: undefined,
      enforcement: 'advisory',
      rebindReceipts: undefined,
      expectedTelemetry: {
        spans: [{ name: 'continuation.work', role: 'accepted-entry', emittedByProduct: true }],
        attributes: [
          ...identityAttributes(),
          { key: 'openclaw.proof.run_id', purpose: 'proof-run', emittedByProduct: true, publicSafeForm: 'sha256-16' },
        ],
      },
      verdictAuthority: { passScope: 'behavioral-and-telemetry-rebindable', pass: 'p', partial: 'q', fail: 'r' },
    }),
  );
  assert.ok(advisoryRebindable.some((f) => /requires telemetryContract\.enforcement=blocking/.test(f)));
  assert.ok(advisoryRebindable.some((f) => /requires a non-empty telemetryContract\.rebindReceipts list/.test(f)));
});

test('the two required-receipt lists must agree about a telemetry receipt', () => {
  const drifted = manifestFixture({}, {
    expectedReceipts: [{ name: 'trace-id', required: false }],
    liveRunSafety: { requiredReceipts: ['trace-id'] },
  });
  const failures = validateTelemetryContract(drifted);
  assert.ok(
    failures.some((f) => /receipt 'trace-id' is in liveRunSafety\.requiredReceipts but expectedReceipts marks it required=false/.test(f)),
  );

  // A telemetry receipt that is optional in both lists is fine.
  const consistentlyOptional = manifestFixture({ rebindReceipts: ['tempo-trace-json'] }, {
    expectedReceipts: [{ name: 'trace-id', required: true }, { name: 'tempo-trace-json', required: false }],
    liveRunSafety: { requiredReceipts: ['trace-id'] },
  });
  assert.deepEqual(validateTelemetryContract(consistentlyOptional), []);
});

test('a product prerequisite must name real remedy rows and cannot name itself', () => {
  const knownRowIds = new Set(['R-FIXTURE', 'R-OBS-CONT-PROVENANCE']);

  assert.ok(
    validateTelemetryContract(manifestFixture({ prerequisiteRows: [] }), { knownRowIds })
      .some((f) => /requires a non-empty prerequisiteRows list/.test(f)),
  );
  assert.ok(
    validateTelemetryContract(manifestFixture({ prerequisiteRows: ['R-NOPE'] }), { knownRowIds })
      .some((f) => /references unknown row 'R-NOPE'/.test(f)),
  );
  assert.ok(
    validateTelemetryContract(manifestFixture({ prerequisiteRows: ['R-FIXTURE'] }), { knownRowIds })
      .some((f) => /must not reference the row itself/.test(f)),
  );
  assert.ok(
    validateTelemetryContract(manifestFixture({ rebindable: true, productInstrumentationPrerequisite: true }), { knownRowIds })
      .some((f) => /cannot be paired with productInstrumentationPrerequisite=true/.test(f)),
  );
});

test('a degraded backend may never be declared as an absence or as a pass', () => {
  const zeroIsAbsence = validateTelemetryContract(
    manifestFixture({
      backendUnavailable: {
        disposition: 'PARTIAL-candidate',
        treatZeroAsAbsence: true,
        requiredCompletenessKeys: ['totalBlocks'],
        rebindKeys: ['candidate_sha'],
      },
    }),
  );
  assert.ok(zeroIsAbsence.some((f) => /treatZeroAsAbsence must be false/.test(f)));

  const passOnDegraded = validateTelemetryContract(
    manifestFixture({
      backendUnavailable: {
        disposition: 'PASS-candidate',
        treatZeroAsAbsence: false,
        requiredCompletenessKeys: ['totalBlocks'],
        rebindKeys: ['candidate_sha'],
      },
    }),
  );
  assert.ok(passOnDegraded.some((f) => /backendUnavailable.disposition must be one of/.test(f)));

  const noRebindKeys = validateTelemetryContract(
    manifestFixture({
      backendUnavailable: {
        disposition: 'PARTIAL-candidate',
        treatZeroAsAbsence: false,
        requiredCompletenessKeys: [],
        rebindKeys: [],
      },
    }),
  );
  assert.ok(noRebindKeys.some((f) => /requiredCompletenessKeys must be non-empty/.test(f)));
  assert.ok(noRebindKeys.some((f) => /rebindKeys must be non-empty/.test(f)));
});

test('every telemetry contract requires the shared backend-status artifact', () => {
  const contract = contractFixture();
  contract.artifact.requiredFiles = ['row-result.json'];
  const failures = validateTelemetryContract(manifestFixture(contract));
  assert.ok(
    failures.some((failure) =>
      /artifact\.requiredFiles must include backend-status\.json/.test(failure)),
  );
});

test('an attribute the product does not emit must name the product issue that will emit it', () => {
  const failures = validateTelemetryContract(
    manifestFixture({
      expectedTelemetry: {
        spans: [{ name: 'continuation.finalization', role: 'terminal-outcome', emittedByProduct: false }],
        attributes: [
          { key: 'continuation.outcome', purpose: 'terminal-outcome', emittedByProduct: false, publicSafeForm: 'enum' },
        ],
      },
    }),
  );
  assert.ok(failures.some((f) => /attribute 'continuation.outcome' is not emitted by the product and must name productIssue/.test(f)));
  assert.ok(failures.some((f) => /span 'continuation.finalization' is not emitted by the product and must name productIssue/.test(f)));
});

test('blocking enforcement requires rebind receipts that exist on the row', () => {
  assert.ok(
    validateTelemetryContract(manifestFixture({ enforcement: 'blocking', rebindReceipts: [] }))
      .some((f) => /requires a non-empty rebindReceipts list/.test(f)),
  );
  assert.ok(
    validateTelemetryContract(manifestFixture({ enforcement: 'blocking', rebindReceipts: ['not-a-receipt'] }))
      .some((f) => /rebindReceipts references 'not-a-receipt' but expectedReceipts has no matching receipt/.test(f)),
  );
  assert.deepEqual(validateTelemetryContract(manifestFixture({ enforcement: 'blocking' })), []);
});

test('a census concern may not be orphaned or double-claimed', () => {
  const remedy = (rowId, concern) => ({
    file: `${rowId.toLowerCase()}.json`,
    manifest: {
      rowId,
      expectedReceipts: [{ name: 'trace-id', required: true }],
      liveRunSafety: { requiredReceipts: ['trace-id'] },
      telemetryContract: contractFixture({
        remedyConcern: concern,
        enforcement: 'blocking',
        prerequisiteRows: ['R-OTHER'],
      }),
    },
  });

  const entries = REMEDY_CONCERNS.map((concern, index) => remedy(`R-OWNER-${index}`, concern));
  entries.push({ file: 'r-other.json', manifest: { rowId: 'R-OTHER' } });
  assert.deepEqual(validateTelemetryCatalog(entries).failures, []);

  const orphaned = entries.filter((entry) => entry.manifest.telemetryContract?.remedyConcern !== 'terminal-outcome');
  assert.ok(
    validateTelemetryCatalog(orphaned).failures.some((f) => /concern 'terminal-outcome' has no owning row/.test(f)),
  );

  const doubled = [...entries, remedy('R-OWNER-DUP', 'terminal-outcome')];
  assert.ok(
    validateTelemetryCatalog(doubled).failures.some((f) => /concern 'terminal-outcome' is claimed by more than one row/.test(f)),
  );
});

test('the validator fails closed on the real catalog when a contract is stripped', async () => {
  const workdir = await mkdtemp(path.join(tmpdir(), 'p81-telemetry-contract-'));
  try {
    const proofs = path.join(workdir, 'tools/k6-proofs');
    await mkdir(path.join(proofs, 'manifests'), { recursive: true });
    await mkdir(path.join(proofs, 'scenarios'), { recursive: true });
    const manifest = JSON.parse(await readFile(path.join(manifestsDir, 'r-cw-1.json'), 'utf8'));
    delete manifest.telemetryContract;
    await writeFile(path.join(proofs, 'manifests/r-cw-1.json'), `${JSON.stringify(manifest, null, 2)}\n`);

    const run = spawnSync(process.execPath, [validator, '--repo-root', workdir], { encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /r-cw-1\.json: liveRunSafety\.requiredReceipts includes telemetry receipt/);
    assert.match(run.stderr, /karmaterminal\/openclaw#1254/);
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
});

test('the validator still runs when it is reached through a symlinked path', async () => {
  // import.meta.url is realpath-resolved but process.argv[1] is not, so a naive
  // entrypoint guard turns this validator into a silent exit-0 no-op inside the
  // catalog preflight whenever TMPDIR or the origin root contains a symlink.
  const workdir = await mkdtemp(path.join(tmpdir(), 'p81-telemetry-symlink-'));
  try {
    const proofs = path.join(workdir, 'repo/tools/k6-proofs');
    await mkdir(path.join(proofs, 'manifests'), { recursive: true });
    await mkdir(path.join(proofs, 'scenarios'), { recursive: true });
    const manifest = JSON.parse(await readFile(path.join(manifestsDir, 'r-cw-1.json'), 'utf8'));
    delete manifest.telemetryContract;
    await writeFile(path.join(proofs, 'manifests/r-cw-1.json'), `${JSON.stringify(manifest, null, 2)}\n`);

    const linkedScripts = path.join(workdir, 'linked-scripts');
    await symlink(path.join(repoRoot, 'tools/k6-proofs/scripts'), linkedScripts, 'dir');

    const direct = spawnSync(process.execPath, [validator, '--repo-root', path.join(workdir, 'repo')], { encoding: 'utf8' });
    const linked = spawnSync(
      process.execPath,
      [path.join(linkedScripts, 'check-telemetry-contracts.mjs'), '--repo-root', path.join(workdir, 'repo')],
      { encoding: 'utf8' },
    );

    assert.equal(direct.status, 1);
    assert.equal(linked.status, 1, 'validator must not silently no-op through a symlinked path');
    assert.match(linked.stderr, /r-cw-1\.json: liveRunSafety\.requiredReceipts includes telemetry receipt/);
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
});

test('a rebindable pass claim is withheld at run time even under advisory enforcement', async () => {
  // Defence in depth: the catalog validator refuses this declaration, so a
  // manifest can only reach the post-processor by bypassing the preflight.
  const outRoot = await mkdtemp(path.join(tmpdir(), 'p81-telemetry-rebind-claim-'));
  try {
    const manifest = JSON.parse(await readFile(preflightManifest, 'utf8'));
    manifest.telemetryContract = contractFixture({
      enforcement: 'advisory',
      rebindable: true,
      productInstrumentationPrerequisite: false,
      prerequisiteRows: undefined,
      rebindReceipts: undefined,
      verdictAuthority: { passScope: 'behavioral-and-telemetry-rebindable', pass: 'p', partial: 'q', fail: 'r' },
    });
    const manifestPath = path.join(outRoot, 'claimed-manifest.json');
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const backendPath = await writeCompleteBackend(outRoot);

    const run = spawnSync(
      process.execPath,
      [postprocess, '--manifest', manifestPath, '--summary', preflightSummary, '--out-root', outRoot, '--run-id', 'k6-run-claimed', '--backend-status', backendPath],
      { cwd: repoRoot, encoding: 'utf8' },
    );
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const result = JSON.parse(await readFile(path.join(JSON.parse(run.stdout).runDir, 'row-result.json'), 'utf8'));

    assert.equal(result.outcome, 'PARTIAL-candidate');
    assert.equal(result.failureClass, 'telemetry-rebind-unproven');
    assert.match(result.reason, /telemetry rebind not proven \(advisory\): no rebind receipt declared/);
  } finally {
    await rm(outRoot, { recursive: true, force: true });
  }
});

test('a receipt required only by liveRunSafety still withholds a PASS when it is missing', async () => {
  // r-cd-1 / r-cd-4 / r-cd-chained-depth-2 used to declare trace-id required in
  // liveRunSafety.requiredReceipts and optional in expectedReceipts, so the row
  // could report its required telemetry receipt missing and still be a PASS.
  const outRoot = await mkdtemp(path.join(tmpdir(), 'p81-telemetry-live-required-'));
  try {
    const manifest = JSON.parse(await readFile(preflightManifest, 'utf8'));
    manifest.expectedReceipts = [
      ...(manifest.expectedReceipts || []),
      { name: 'trace-id', required: false, description: 'optional in expectedReceipts, required by live-run policy' },
    ];
    manifest.liveRunSafety = { ...(manifest.liveRunSafety || {}), requiredReceipts: ['trace-id'], foldRequiresReview: true };
    const manifestPath = path.join(outRoot, 'drifted-manifest.json');
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const summary = JSON.parse(await readFile(preflightSummary, 'utf8'));
    summary.proof_receipts = { 'trace-id': false };
    const summaryPath = path.join(outRoot, 'summary.json');
    await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

    const run = spawnSync(
      process.execPath,
      [postprocess, '--manifest', manifestPath, '--summary', summaryPath, '--out-root', outRoot, '--run-id', 'k6-run-live-required'],
      { cwd: repoRoot, encoding: 'utf8' },
    );
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const result = JSON.parse(await readFile(path.join(JSON.parse(run.stdout).runDir, 'row-result.json'), 'utf8'));

    assert.equal(result.outcome, 'PARTIAL-candidate');
    assert.match(result.reason, /required receipt\(s\) reported missing: trace-id/);
  } finally {
    await rm(outRoot, { recursive: true, force: true });
  }
});

test('the committed catalog has no telemetry receipt whose required-ness disagrees between the two lists', async () => {
  for (const { file, manifest } of await loadCatalog()) {
    const live = new Set(manifest?.liveRunSafety?.requiredReceipts || []);
    for (const receipt of manifest?.expectedReceipts || []) {
      if (!TELEMETRY_RECEIPTS.has(receipt.name)) continue;
      if (live.has(receipt.name)) {
        assert.equal(receipt.required, true, `${file}: ${receipt.name} disagrees between the two required-receipt lists`);
      }
    }
  }
});
test('an explicitly missing required receipt can no longer ride out as a candidate PASS', async () => {
  const outRoot = await mkdtemp(path.join(tmpdir(), 'p81-telemetry-postprocess-'));
  try {
    const summary = JSON.parse(await readFile(preflightSummary, 'utf8'));
    summary.proof_receipts = { 'manifest-loaded': 'present', 'k6-summary': false };
    const summaryPath = path.join(outRoot, 'summary.json');
    await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

    const run = spawnSync(
      process.execPath,
      [postprocess, '--manifest', preflightManifest, '--summary', summaryPath, '--out-root', outRoot, '--run-id', 'k6-run-missing-receipt'],
      { cwd: repoRoot, encoding: 'utf8' },
    );
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const printed = JSON.parse(run.stdout);
    const result = JSON.parse(await readFile(path.join(printed.runDir, 'row-result.json'), 'utf8'));

    assert.equal(result.outcome, 'PARTIAL-candidate');
    assert.equal(result.failureClass, 'missing-receipt');
    assert.match(result.reason, /withheld from PASS-candidate: required receipt\(s\) reported missing: k6-summary/);
  } finally {
    await rm(outRoot, { recursive: true, force: true });
  }
});

test('a blocking telemetry contract withholds PASS until its rebind receipts are proven', async () => {
  const outRoot = await mkdtemp(path.join(tmpdir(), 'p81-telemetry-blocking-'));
  try {
    const manifest = JSON.parse(await readFile(preflightManifest, 'utf8'));
    manifest.expectedReceipts = [
      ...(manifest.expectedReceipts || []),
      { name: 'entry-span-identity-attributes', required: true, description: 'origin/session/turn/run identity on the accepted entry span' },
    ];
    manifest.telemetryContract = contractFixture({
      enforcement: 'blocking',
      rebindReceipts: ['entry-span-identity-attributes'],
      prerequisiteRows: ['R-OBS-CONT-PROVENANCE'],
    });
    const manifestPath = path.join(outRoot, 'blocking-manifest.json');
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const backendPath = await writeCompleteBackend(outRoot);

    const blocked = spawnSync(
      process.execPath,
      [postprocess, '--manifest', manifestPath, '--summary', preflightSummary, '--out-root', outRoot, '--run-id', 'k6-run-blocked', '--backend-status', backendPath],
      { cwd: repoRoot, encoding: 'utf8' },
    );
    assert.equal(blocked.status, 0, blocked.stderr || blocked.stdout);
    const blockedResult = JSON.parse(
      await readFile(path.join(JSON.parse(blocked.stdout).runDir, 'row-result.json'), 'utf8'),
    );
    assert.equal(blockedResult.outcome, 'PARTIAL-candidate');
    assert.equal(blockedResult.failureClass, 'telemetry-rebind-unproven');
    assert.equal(blockedResult.telemetryRebind.status, 'unproven');
    assert.equal(blockedResult.telemetryRebind.productInstrumentationPrerequisite, true);
    assert.deepEqual(blockedResult.telemetryRebind.prerequisiteRows, ['R-OBS-CONT-PROVENANCE']);
    assert.deepEqual(
      blockedResult.telemetryRebind.unprovenRebindReceipts,
      [{ name: 'entry-span-identity-attributes', status: 'unknown' }],
    );

    const summary = JSON.parse(await readFile(preflightSummary, 'utf8'));
    summary.proof_receipts = { 'entry-span-identity-attributes': 'present' };
    const summaryPath = path.join(outRoot, 'proven-summary.json');
    await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

    const proven = spawnSync(
      process.execPath,
      [postprocess, '--manifest', manifestPath, '--summary', summaryPath, '--out-root', outRoot, '--run-id', 'k6-run-proven', '--backend-status', backendPath],
      { cwd: repoRoot, encoding: 'utf8' },
    );
    assert.equal(proven.status, 0, proven.stderr || proven.stdout);
    const provenResult = JSON.parse(
      await readFile(path.join(JSON.parse(proven.stdout).runDir, 'row-result.json'), 'utf8'),
    );
    assert.equal(provenResult.outcome, 'PASS-candidate');
    assert.equal(provenResult.telemetryRebind.status, 'proven');
    assert.deepEqual(provenResult.telemetryRebind.unprovenRebindReceipts, []);
  } finally {
    await rm(outRoot, { recursive: true, force: true });
  }
});

test('an advisory contract records the rebind debt without changing the behavioral verdict', async () => {
  const outRoot = await mkdtemp(path.join(tmpdir(), 'p81-telemetry-advisory-'));
  try {
    const manifest = JSON.parse(await readFile(preflightManifest, 'utf8'));
    manifest.telemetryContract = contractFixture({ rebindReceipts: ['trace-id'] });
    manifest.expectedReceipts = [
      ...(manifest.expectedReceipts || []),
      { name: 'trace-id', required: false, description: 'trace correlation' },
    ];
    const manifestPath = path.join(outRoot, 'advisory-manifest.json');
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const backendPath = await writeCompleteBackend(outRoot);

    const run = spawnSync(
      process.execPath,
      [postprocess, '--manifest', manifestPath, '--summary', preflightSummary, '--out-root', outRoot, '--run-id', 'k6-run-advisory', '--backend-status', backendPath],
      { cwd: repoRoot, encoding: 'utf8' },
    );
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const result = JSON.parse(await readFile(path.join(JSON.parse(run.stdout).runDir, 'row-result.json'), 'utf8'));

    assert.equal(result.outcome, 'PASS-candidate');
    assert.equal(result.failureClass, 'none');
    assert.equal(result.telemetryRebind.enforcement, 'advisory');
    assert.equal(result.telemetryRebind.status, 'unproven');
    assert.equal(result.telemetryRebind.rebindable, false);
    assert.equal(result.telemetryRebind.passScope, 'behavioral-only');
    assert.equal(result.telemetryRebind.backendUnavailableDisposition, 'PARTIAL-candidate');
  } finally {
    await rm(outRoot, { recursive: true, force: true });
  }
});
