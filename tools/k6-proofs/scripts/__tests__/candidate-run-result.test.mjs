import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  resolveRcdChainAuthoritativeReceipt,
} from '../../lib/r-cd-chained-depth-2-authoritative-receipt.mjs';
import { resolveRcdTokenAuthoritativeReceipt } from '../../lib/r-cd-token-authoritative-receipt.mjs';
import {
  buildTelemetryBackendStatusReceipt,
  classifyTelemetryBackendInteraction,
} from '../../lib/telemetry-backend-status.js';
import {
  telemetryReceiptStatuses,
  telemetryRebindFrom,
} from '../../lib/telemetry-rebind.js';
import { candidateEnvelopeMatchesSiblings } from '../candidate-run-result-contract.mjs';

const runNode = promisify(execFile);
const script = path.resolve('tools/k6-proofs/scripts/validate-candidate-run-result.mjs');
const corpusValidator = path.resolve('tools/k6-proofs/scripts/validate-corpus.mjs');
const sha = 'a'.repeat(40);
const docsRef = 'b'.repeat(40);
const repository = 'karmaterminal/karmaterminal-openclaw-docs';
const scenarioSource = 'export default function scenario() { return true; }\n';
const gatewayKey = 'candidate-test-gateway-key';
const exactPartialReceipt = path.resolve(
  'tools/k6-proofs/scripts/__tests__/fixtures/run-32956764849-backend-status.json',
);

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function manifest() {
  return {
    schema: 'openclaw.k6.proof-row-manifest.v1',
    rowId: 'R-CW-TEST',
    candidateSha: sha,
    seat: 'cael',
    scenario: { name: 'r-cw-test' },
    review: { candidateOnly: true, foldRequiresReview: true },
    liveRunSafety: { expectedArtifactClass: 'PASS-candidate' },
  };
}

function runResult(overrides = {}) {
  return {
    effectiveExitCode: 0,
    verdict: 'PASS-candidate',
    verdictSource: 'summary-file',
    candidateOnly: true,
    foldRequiresReview: true,
    observability: { traceStatus: 'present', traceId: 'safe-trace-id', correlationReceipt: 'continuation-correlation.json' },
    review: { status: 'ready-for-human-review', pendingReceipts: [] },
    ...overrides,
  };
}

/**
 * The runner copies the exact manifest and scenario bytes it fired into the
 * candidate directory and records their digests plus the frozen docs ref, so a
 * faithful fixture must carry the same immutable harness identity (#496).
 */
async function writeHarnessSources(candidateDir, manifestBody, scenario = scenarioSource) {
  await writeFile(path.join(candidateDir, 'row-manifest.json'), manifestBody);
  await writeFile(path.join(candidateDir, 'row-scenario.js'), scenario);
}

function harnessMetadata({ manifestBody, scenario = scenarioSource, rowFile = 'r-cw-test' } = {}) {
  return {
    docsRef,
    repository,
    manifestPath: `tools/k6-proofs/manifests/${rowFile}.json`,
    manifestSha256: digest(manifestBody),
    scenarioPath: `tools/k6-proofs/scenarios/${rowFile}.js`,
    scenarioSha256: digest(scenario),
  };
}

async function fixture({
  result = runResult(),
  metadata = null,
  manifestValue = manifest(),
  candidateDirName = 'candidate',
} = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'candidate-run-result-'));
  const candidateDir = path.join(root, candidateDirName);
  await mkdir(candidateDir);
  const manifestPath = path.join(root, 'manifest.json');
  const manifestBody = `${JSON.stringify(manifestValue, null, 2)}\n`;
  await writeFile(manifestPath, manifestBody);
  await writeHarnessSources(candidateDir, manifestBody);
  await writeFile(path.join(candidateDir, 'runner-metadata.json'), `${JSON.stringify({
    row: 'R-CW-TEST',
    candidateSha: sha,
    seat: 'cael',
    scenario: 'r-cw-test.js',
    ...harnessMetadata({ manifestBody }),
    ...(metadata || {}),
  }, null, 2)}\n`);
  await writeFile(path.join(candidateDir, 'run-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  return { root, candidateDir, manifestPath, manifestBody };
}

async function writeCanonicalCorpusFixture(root) {
  const corpusDir = path.join(root, 'PROOFS', sha);
  await mkdir(corpusDir, { recursive: true });
  const rollup = {
    total_rows: 0,
    pass: 0,
    partial: 0,
    thin: 0,
    fail: 0,
    honest_limit: 0,
    missing: 0,
  };
  await writeFile(
    path.join(corpusDir, 'proofs-manifest.json'),
    `${JSON.stringify({
      schema: 'openclaw.proofs.manifest.v1',
      capture_sha: sha,
      rows: [],
      rollup,
    }, null, 2)}\n`,
  );
  await writeFile(
    path.join(root, 'PROOFS', 'INDEX.json'),
    `${JSON.stringify({
      schema: 'openclaw.proofs.index.v1',
      current_sha: sha,
      corpus_path: `PROOFS/${sha}`,
      manifest_path: `PROOFS/${sha}/proofs-manifest.json`,
      rollup,
    }, null, 2)}\n`,
  );
}

async function invoke({ manifestPath, candidateDir, out = null }) {
  const args = [script, '--manifest', manifestPath, '--candidate-dir', candidateDir, '--docs-ref', docsRef];
  if (out) args.push('--out', out);
  return runNode(process.execPath, args, { encoding: 'utf8', env: { ...process.env, OPENCLAW_GATEWAY_TOKEN: gatewayKey } });
}

test('emits a public-safe, candidate-only routing envelope for a complete candidate run', async () => {
  const setup = await fixture();
  try {
    const out = path.join(setup.candidateDir, 'candidate-run-result.json');
    const run = await invoke({ ...setup, out });
    const result = JSON.parse(run.stdout);
    assert.equal(result.schema, 'openclaw.k6.candidate-run-result.v1');
    assert.equal(result.candidate.sha, sha);
    assert.equal(result.candidate.docsRef, docsRef);
    assert.equal(result.harness.docsRef, docsRef);
    assert.equal(result.harness.repository, repository);
    assert.equal(result.harness.manifestSha256, digest(setup.manifestBody));
    assert.equal(result.harness.scenarioSha256, digest(scenarioSource));
    assert.equal(result.harness.manifestArtifact, 'row-manifest.json');
    assert.equal(result.harness.scenarioArtifact, 'row-scenario.js');
    assert.ok(result.artifacts.files.includes('row-scenario.js'));
    assert.equal(result.run.rowId, 'R-CW-TEST');
    assert.equal(result.result.outcome, 'PASS-candidate');
    assert.equal(result.result.behaviorProof, false);
    assert.equal(result.canonicalFoldForbidden, true);
    assert.equal(result.review.complete, true);
    assert.equal(result.observability.traceCaptured, true);
    assert.equal(result.artifacts.correlationReceipt, 'continuation-correlation.json');
    assert.deepEqual(JSON.parse(await readFile(out, 'utf8')), result);
  } finally {
    await rm(setup.root, { recursive: true, force: true });
  }
});

test('candidate envelope binds backend status and telemetry rebind siblings', async () => {
  const requiredCompletenessKeys = [
    'totalBlocks',
    'completedJobs',
    'inspectedBytes',
    'tempoApiStatus',
  ];
  const manifestValue = {
    ...manifest(),
    telemetryContract: {
      schema: 'openclaw.k6.row-telemetry-contract.v1',
      enforcement: 'advisory',
      rebindable: false,
      productInstrumentationPrerequisite: true,
      prerequisiteRows: ['R-OBS-BACKEND-DISPOSITION'],
      backendUnavailable: {
        disposition: 'PARTIAL-candidate',
        requiredCompletenessKeys,
        rebindKeys: [],
      },
      artifact: {
        schema: 'openclaw.k6.proof-row-result.v1',
        requiredFiles: ['backend-status.json'],
      },
      verdictAuthority: { passScope: 'behavioral-only' },
    },
  };
  const setup = await fixture({ manifestValue });
  try {
    const backendStatus = buildTelemetryBackendStatusReceipt({
      rowId: 'R-CW-TEST',
      candidateSha: sha,
      seat: 'cael',
      proofRunId: path.basename(setup.candidateDir),
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

    const telemetryRebind = telemetryRebindFrom({
      manifest: manifestValue,
      receiptStatuses: [],
      backendStatus,
      artifactStatuses: [{ name: 'backend-status.json', status: 'present' }],
    });
    const result = runResult({
      telemetryRebind,
      observability: {
        traceStatus: 'present',
        traceId: 'safe-trace-id',
        correlationReceipt: 'continuation-correlation.json',
        backendStatus: 'backend-status.json',
        backendDisposition: 'complete',
        backendComplete: true,
        backendCountAuthority: true,
        dispositionContractStatus: 'not-applicable',
      },
    });
    await writeFile(
      path.join(setup.candidateDir, 'backend-status.json'),
      `${JSON.stringify(backendStatus, null, 2)}\n`,
    );
    await writeFile(
      path.join(setup.candidateDir, 'run-result.json'),
      `${JSON.stringify(result, null, 2)}\n`,
    );
    const envelope = JSON.parse((await invoke(setup)).stdout);
    assert.equal(envelope.observability.backendStatus, 'backend-status.json');
    assert.equal(envelope.observability.backendDisposition, 'complete');
    assert.equal(envelope.observability.backendCountAuthority, true);
    assert.equal(envelope.observability.dispositionContractStatus, 'not-applicable');
    assert.equal(envelope.telemetryRebind.backend.complete, true);
    assert.equal(candidateEnvelopeMatchesSiblings({
      envelope,
      manifest: manifestValue,
      metadata: JSON.parse(
        await readFile(path.join(setup.candidateDir, 'runner-metadata.json'), 'utf8'),
      ),
      runResult: result,
      runDir: setup.candidateDir,
    }), true);
    const smuggled = {
      ...envelope,
      telemetryRebind: {
        ...envelope.telemetryRebind,
        requiredArtifacts: [{
          name: 'backend-status.json',
          status: 'present',
          rawResponse: 'not-public',
        }],
      },
    };
    assert.equal(candidateEnvelopeMatchesSiblings({
      envelope: smuggled,
      manifest: manifestValue,
      metadata: JSON.parse(
        await readFile(path.join(setup.candidateDir, 'runner-metadata.json'), 'utf8'),
      ),
      runResult: result,
      runDir: setup.candidateDir,
    }), false);

    const unknown = buildTelemetryBackendStatusReceipt({
      rowId: 'R-CW-TEST',
      candidateSha: sha,
      seat: 'cael',
      proofRunId: path.basename(setup.candidateDir),
      requiredCompletenessKeys,
      rebindKeys: [],
      interactions: [],
    });
    await writeFile(
      path.join(setup.candidateDir, 'backend-status.json'),
      `${JSON.stringify(unknown, null, 2)}\n`,
    );
    await assert.rejects(invoke(setup), /backend disposition disagrees/);
  } finally {
    await rm(setup.root, { recursive: true, force: true });
  }
});

test('candidate envelope preserves partial backend health for a proven disposition-row PASS', async () => {
  const backendStatus = JSON.parse(await readFile(exactPartialReceipt, 'utf8'));
  const manifestValue = {
    schema: 'openclaw.k6.proof-row-manifest.v1',
    rowId: backendStatus.rowId,
    candidateSha: backendStatus.candidateSha,
    seat: backendStatus.seat,
    scenario: { name: 'r-obs-backend-disposition' },
    review: { candidateOnly: true, foldRequiresReview: true },
    liveRunSafety: { expectedArtifactClass: 'PASS-candidate' },
    expectedReceipts: [
      { name: 'backend-completeness-receipt', required: true },
      { name: 'degraded-response-classified', required: true },
      { name: 'rebind-key-set-published', required: true },
      { name: 'slice-strategy-recorded', required: true },
    ],
    telemetryContract: {
      schema: 'openclaw.k6.row-telemetry-contract.v1',
      enforcement: 'blocking',
      rebindable: false,
      productInstrumentationPrerequisite: false,
      rebindReceipts: [
        'backend-completeness-receipt',
        'degraded-response-classified',
        'rebind-key-set-published',
        'slice-strategy-recorded',
      ],
      backendUnavailable: {
        disposition: 'PARTIAL-candidate',
        requiredCompletenessKeys: backendStatus.requiredCompletenessKeys,
        rebindKeys: backendStatus.rebind.declaredKeys,
      },
      artifact: {
        schema: backendStatus.schema,
        requiredFiles: ['EVIDENCE.md', 'row-result.json', 'backend-status.json'],
      },
      verdictAuthority: {
        passScope: 'backend-disposition-contract',
        backendDispositionContract: {
          requiredBackends: ['tempo', 'loki'],
          rowPassStatuses: ['complete', 'partial', 'capped'],
          requireNonAuthoritativeZero: true,
          requireCompleteRebind: true,
        },
      },
    },
  };
  const summary = {
    row: backendStatus.rowId,
    verdict: 'PASS-candidate',
    classificationControls: {
      complete: 'complete',
      partial: 'partial',
      unavailable: 'unavailable',
      capped: 'capped',
      unknown: 'unknown',
    },
    proof_receipts: Object.fromEntries(
      manifestValue.expectedReceipts.map(({ name }) => [name, true]),
    ),
  };
  const setup = await fixture({
    manifestValue,
    candidateDirName: backendStatus.proofRunId,
    metadata: {
      row: backendStatus.rowId,
      candidateSha: backendStatus.candidateSha,
      seat: backendStatus.seat,
      scenario: 'r-obs-backend-disposition.js',
      manifestPath: 'tools/k6-proofs/manifests/r-obs-backend-disposition.json',
      scenarioPath: 'tools/k6-proofs/scenarios/r-obs-backend-disposition.js',
    },
  });
  try {
    const telemetryRebind = telemetryRebindFrom({
      manifest: manifestValue,
      receiptStatuses: telemetryReceiptStatuses({
        manifest: manifestValue,
        summary,
        backendStatus,
      }),
      backendStatus,
      artifactStatuses: manifestValue.telemetryContract.artifact.requiredFiles
        .map((name) => ({ name, status: 'present' })),
    });
    const result = runResult({
      telemetryRebind,
      observability: {
        traceStatus: 'not-required',
        traceId: null,
        correlationReceipt: null,
        backendStatus: 'backend-status.json',
        backendDisposition: 'partial',
        backendComplete: false,
        backendCountAuthority: false,
        dispositionContractStatus: 'proven',
      },
    });
    await writeFile(
      path.join(setup.candidateDir, 'backend-status.json'),
      `${JSON.stringify(backendStatus, null, 2)}\n`,
    );
    await writeFile(
      path.join(setup.candidateDir, 'k6-summary.json'),
      `${JSON.stringify(summary, null, 2)}\n`,
    );
    await writeFile(path.join(setup.candidateDir, 'EVIDENCE.md'), '# disposition\n');
    await writeFile(
      path.join(setup.candidateDir, 'row-result.json'),
      `${JSON.stringify(result, null, 2)}\n`,
    );
    await writeFile(
      path.join(setup.candidateDir, 'run-result.json'),
      `${JSON.stringify(result, null, 2)}\n`,
    );

    const envelope = JSON.parse((await invoke(setup)).stdout);
    const metadata = JSON.parse(
      await readFile(path.join(setup.candidateDir, 'runner-metadata.json'), 'utf8'),
    );
    assert.equal(envelope.result.outcome, 'PASS-candidate');
    assert.equal(envelope.observability.backendDisposition, 'partial');
    assert.equal(envelope.observability.backendComplete, false);
    assert.equal(envelope.observability.backendCountAuthority, false);
    assert.equal(envelope.observability.dispositionContractStatus, 'proven');
    assert.equal(envelope.telemetryRebind.status, 'proven');
    assert.equal(candidateEnvelopeMatchesSiblings({
      envelope,
      manifest: manifestValue,
      metadata,
      runResult: result,
      runDir: setup.candidateDir,
    }), true);

    assert.equal(candidateEnvelopeMatchesSiblings({
      envelope: {
        ...envelope,
        observability: {
          ...envelope.observability,
          backendCountAuthority: true,
        },
      },
      manifest: manifestValue,
      metadata,
      runResult: result,
      runDir: setup.candidateDir,
    }), false);

    const tampered = structuredClone(result);
    tampered.telemetryRebind.dispositionContract.status = 'unproven';
    tampered.telemetryRebind.passBlockers.backend = true;
    tampered.telemetryRebind.status = 'unproven';
    tampered.observability.dispositionContractStatus = 'unproven';
    await writeFile(
      path.join(setup.candidateDir, 'run-result.json'),
      `${JSON.stringify(tampered, null, 2)}\n`,
    );
    await assert.rejects(
      invoke(setup),
      /telemetryRebind disagrees with backend disposition receipts/,
    );
  } finally {
    await rm(setup.root, { recursive: true, force: true });
  }
});

test('rejects malformed, identity-mismatched, and review-incomplete candidates', async (t) => {
  await t.test('malformed run result', async () => {
    const setup = await fixture();
    try {
      await writeFile(path.join(setup.candidateDir, 'run-result.json'), '{bad json');
      await assert.rejects(invoke(setup), /run result is malformed JSON/);
    } finally { await rm(setup.root, { recursive: true, force: true }); }
  });
  await t.test('metadata mismatch', async () => {
    const setup = await fixture({ metadata: { row: 'R-OTHER', candidateSha: sha, seat: 'cael', scenario: 'r-cw-test.js' } });
    try {
      await assert.rejects(invoke(setup), /row ID mismatch/);
    } finally { await rm(setup.root, { recursive: true, force: true }); }
  });
  await t.test('pending review debt', async () => {
    const setup = await fixture({ result: runResult({ review: { status: 'review-pending', pendingReceipts: ['tempo-trace-json'] } }) });
    try {
      await assert.rejects(invoke(setup), /review-incomplete/);
    } finally { await rm(setup.root, { recursive: true, force: true }); }
  });
  await t.test('honest limit on a non-R-RC-2 row', async () => {
    const setup = await fixture({ result: runResult({ verdict: 'HONEST-LIMIT-candidate' }) });
    try {
      await assert.rejects(invoke(setup), /candidate run result is incomplete or inconsistent/);
    } finally { await rm(setup.root, { recursive: true, force: true }); }
  });
});

test('candidate envelope binds the approved docs ref and both harness source digests', async (t) => {
  await t.test('omitted docs ref', async () => {
    const setup = await fixture({ metadata: { docsRef: undefined } });
    try {
      await assert.rejects(invoke(setup), /runner metadata docsRef must be a 40-character lowercase SHA/);
    } finally { await rm(setup.root, { recursive: true, force: true }); }
  });

  await t.test('mismatched docs ref', async () => {
    const setup = await fixture({ metadata: { docsRef: 'c'.repeat(40) } });
    try {
      await assert.rejects(invoke(setup), /docs ref mismatch/);
    } finally { await rm(setup.root, { recursive: true, force: true }); }
  });

  await t.test('omitted repository identity', async () => {
    const setup = await fixture({ metadata: { repository: undefined } });
    try {
      await assert.rejects(invoke(setup), /runner metadata repository must be a non-empty string/);
    } finally { await rm(setup.root, { recursive: true, force: true }); }
  });

  await t.test('private path smuggled as repository identity', async () => {
    const setup = await fixture({ metadata: { repository: '/home/someone/private/checkout' } });
    try {
      await assert.rejects(invoke(setup), /safe <owner>\/<repo> identity/);
    } finally { await rm(setup.root, { recursive: true, force: true }); }
  });

  await t.test('omitted manifest digest', async () => {
    const setup = await fixture({ metadata: { manifestSha256: undefined } });
    try {
      await assert.rejects(invoke(setup), /runner metadata manifestSha256 must be a 64-character lowercase sha256 digest/);
    } finally { await rm(setup.root, { recursive: true, force: true }); }
  });

  await t.test('omitted scenario digest', async () => {
    const setup = await fixture({ metadata: { scenarioSha256: undefined } });
    try {
      await assert.rejects(invoke(setup), /runner metadata scenarioSha256 must be a 64-character lowercase sha256 digest/);
    } finally { await rm(setup.root, { recursive: true, force: true }); }
  });

  await t.test('manifest source mutated after capture', async () => {
    const setup = await fixture();
    try {
      await writeFile(path.join(setup.candidateDir, 'row-manifest.json'), '{"rowId":"R-CW-TEST"}\n');
      await assert.rejects(invoke(setup), /copied row manifest digest mismatch/);
    } finally { await rm(setup.root, { recursive: true, force: true }); }
  });

  await t.test('scenario source mutated after capture', async () => {
    const setup = await fixture();
    try {
      await writeFile(path.join(setup.candidateDir, 'row-scenario.js'), '// swapped\n');
      await assert.rejects(invoke(setup), /copied row scenario digest mismatch/);
    } finally { await rm(setup.root, { recursive: true, force: true }); }
  });

  await t.test('scenario source missing entirely', async () => {
    const setup = await fixture();
    try {
      await rm(path.join(setup.candidateDir, 'row-scenario.js'));
      await assert.rejects(invoke(setup), /copied row scenario missing or unreadable/);
    } finally { await rm(setup.root, { recursive: true, force: true }); }
  });

  await t.test('sibling contract rejects a sidecar whose harness identity is unrecorded or mutated', async () => {
    const setup = await fixture();
    try {
      const envelope = JSON.parse((await invoke(setup)).stdout);
      const metadata = JSON.parse(await readFile(path.join(setup.candidateDir, 'runner-metadata.json'), 'utf8'));
      const siblings = (overrides = {}) => ({
        envelope,
        manifest: manifest(),
        metadata,
        runResult: runResult(),
        runDir: setup.candidateDir,
        ...overrides,
      });
      assert.equal(candidateEnvelopeMatchesSiblings(siblings()), true);

      for (const omitted of ['docsRef', 'repository', 'manifestPath', 'scenarioPath', 'manifestSha256', 'scenarioSha256']) {
        const stripped = { ...metadata };
        delete stripped[omitted];
        assert.equal(
          candidateEnvelopeMatchesSiblings(siblings({ metadata: stripped })),
          false,
          `metadata omitting ${omitted} must not satisfy the sibling contract`,
        );
      }

      assert.equal(candidateEnvelopeMatchesSiblings(siblings({
        envelope: { ...envelope, harness: { ...envelope.harness, docsRef: 'c'.repeat(40) } },
      })), false);
      assert.equal(candidateEnvelopeMatchesSiblings(siblings({
        envelope: { ...envelope, harness: { ...envelope.harness, manifestPath: 'tools/k6-proofs/manifests/other.json' } },
      })), false);

      await writeFile(path.join(setup.candidateDir, 'row-scenario.js'), '// swapped after the envelope was written\n');
      assert.equal(candidateEnvelopeMatchesSiblings(siblings()), false);
    } finally { await rm(setup.root, { recursive: true, force: true }); }
  });

  await t.test('a supplied manifest that is not the captured manifest is refused', async () => {
    const setup = await fixture();
    const otherManifest = path.join(setup.root, 'other-manifest.json');
    try {
      await writeFile(otherManifest, `${JSON.stringify({ ...manifest(), seat: 'elliott' }, null, 2)}\n`);
      await assert.rejects(
        invoke({ ...setup, manifestPath: otherManifest }),
        /supplied manifest is not the manifest captured for this run/,
      );
    } finally { await rm(setup.root, { recursive: true, force: true }); }
  });

  await t.test('unsafe or unrecorded harness paths are refused', async (sub) => {
    for (const [label, override, expected] of [
      ['omitted manifest path', { manifestPath: undefined }, /runner metadata manifestPath must be a non-empty string/],
      ['escaping manifest path', { manifestPath: '../../etc/passwd' }, /manifestPath must be a tools\/k6-proofs\/manifests/],
      ['omitted scenario path', { scenarioPath: undefined }, /runner metadata scenarioPath must be a non-empty string/],
      ['absolute scenario path', { scenarioPath: '/home/someone/scenarios/r-cw-test.js' }, /scenarioPath must be a tools\/k6-proofs\/scenarios/],
    ]) {
      await sub.test(label, async () => {
        const setup = await fixture({ metadata: override });
        try {
          await assert.rejects(invoke(setup), expected);
        } finally { await rm(setup.root, { recursive: true, force: true }); }
      });
    }
  });

  await t.test('a sidecar carrying fields the emitter never writes is refused', async () => {
    const setup = await fixture();
    try {
      const envelope = JSON.parse((await invoke(setup)).stdout);
      const metadata = JSON.parse(await readFile(path.join(setup.candidateDir, 'runner-metadata.json'), 'utf8'));
      const siblings = (value) => candidateEnvelopeMatchesSiblings({
        envelope: value,
        manifest: manifest(),
        metadata,
        runResult: runResult(),
        runDir: setup.candidateDir,
      });
      assert.equal(siblings(envelope), true);

      // Smuggling extra material past review must not be possible even when
      // every checked identity field still agrees.
      assert.equal(siblings({ ...envelope, gatewayToken: 'not-a-real-token' }), false);
      assert.equal(siblings({ ...envelope, harness: { ...envelope.harness, operatorNote: '/home/someone/private' } }), false);
      assert.equal(siblings({ ...envelope, candidate: { ...envelope.candidate, sessionKey: 'agent:main' } }), false);
      assert.equal(siblings({
        ...envelope,
        artifacts: { ...envelope.artifacts, files: [...envelope.artifacts.files, 'gateway.token'] },
      }), false);
      // An allowed field is not automatically a safe value.
      assert.equal(siblings({
        ...envelope,
        artifacts: { ...envelope.artifacts, files: [...envelope.artifacts.files, '../../private-summary.json'] },
      }), false);
      assert.equal(siblings({
        ...envelope,
        artifacts: { ...envelope.artifacts, tempoTraceJson: '../../../etc/passwd' },
      }), false);
      // Observability artifact names must still agree with the raw sibling.
      assert.equal(siblings({
        ...envelope,
        artifacts: { ...envelope.artifacts, correlationReceipt: 'invented-correlation.json' },
      }), false);
      assert.equal(siblings({ ...envelope, run: { ...envelope.run, executionKind: 'hand-written' } }), false);
      // R-CW-TEST has no row-scoped resolver, so it may not carry one.
      assert.equal(siblings({
        ...envelope,
        authoritativeReceipt: { file: 'r-cd-2-authoritative-receipt.json', sha256: 'a'.repeat(64) },
      }), false);
      const { harness, ...withoutHarness } = envelope;
      assert.equal(siblings(withoutHarness), false);
    } finally { await rm(setup.root, { recursive: true, force: true }); }
  });

  await t.test('isolated observability mismatches cannot suppress the raw sibling', async () => {
    const setup = await fixture();
    try {
      const envelope = JSON.parse((await invoke(setup)).stdout);
      const metadata = JSON.parse(await readFile(path.join(setup.candidateDir, 'runner-metadata.json'), 'utf8'));
      const siblings = (value) => candidateEnvelopeMatchesSiblings({
        envelope: value,
        manifest: manifest(),
        metadata,
        runResult: runResult(),
        runDir: setup.candidateDir,
      });
      assert.equal(siblings(envelope), true);

      for (const [field, value] of [
        ['traceStatus', 'missing'],
        ['traceCaptured', false],
        ['correlationReceiptPresent', false],
      ]) {
        assert.equal(siblings({
          ...envelope,
          observability: { ...envelope.observability, [field]: value },
        }), false, `${field} mismatch must not suppress the raw sibling`);
      }
    } finally { await rm(setup.root, { recursive: true, force: true }); }
  });
});

test('R-RC-2 honest limit requires the nonce-bound structured threshold receipt in both validation layers', async () => {
  const manifestValue = {
    schema: 'openclaw.k6.proof-row-manifest.v1',
    rowId: 'R-RC-2',
    candidateSha: sha,
    seat: 'cael',
    scenario: { name: 'r-rc-2-delegate-request-compaction' },
    review: { candidateOnly: true, foldRequiresReview: true },
    liveRunSafety: { expectedArtifactClass: 'HONEST-LIMIT-candidate' },
  };
  const rrc2ManifestBody = `${JSON.stringify(manifestValue, null, 2)}\n`;
  const metadata = {
    row: 'R-RC-2',
    candidateSha: sha,
    seat: 'cael',
    scenario: 'r-rc-2-delegate-request-compaction.js',
    ...harnessMetadata({ manifestBody: rrc2ManifestBody, rowFile: 'r-rc-2-delegate-request-compaction' }),
  };
  const verifiedEvidence = {
    row: 'R-RC-2',
    parent_dispatch_accepted: true,
    delegate_requested: true,
    child_session_observed: true,
    delegate_child_report_observed: true,
    child_reported_context_threshold: true,
    request_compaction_tool_result_observed: true,
    request_compaction_receipt_role: 'toolResult',
    request_compaction_receipt_tool_name: 'request_compaction',
    request_compaction_receipt_status: 'rejected',
    request_compaction_invocation_bound: true,
    request_compaction_rejected_context_threshold: true,
    guard: 'context_threshold',
  };
  const invalidResult = runResult({
    verdict: 'HONEST-LIMIT-candidate',
    evidence: { ...verifiedEvidence, request_compaction_invocation_bound: false },
  });
  const setup = await fixture({ result: invalidResult, metadata, manifestValue });
  try {
    await assert.rejects(invoke(setup), /nonce-bound structured request_compaction/);

    const validResult = runResult({
      verdict: 'HONEST-LIMIT-candidate',
      evidence: verifiedEvidence,
    });
    await writeFile(
      path.join(setup.candidateDir, 'run-result.json'),
      `${JSON.stringify(validResult, null, 2)}\n`,
    );
    const envelope = JSON.parse((await invoke(setup)).stdout);
    assert.equal(candidateEnvelopeMatchesSiblings({
      envelope,
      manifest: manifestValue,
      metadata,
      runResult: validResult,
      runDir: setup.candidateDir,
    }), true);
    assert.equal(candidateEnvelopeMatchesSiblings({
      envelope,
      manifest: manifestValue,
      metadata,
      runResult: invalidResult,
      runDir: setup.candidateDir,
    }), false);

    const verifiedPassEvidence = {
      ...verifiedEvidence,
      child_reported_context_threshold: false,
      post_compaction_path_observed: true,
      request_compaction_receipt_status: 'accepted',
      request_compaction_rejected_context_threshold: false,
      request_compaction_accepted: true,
      guard: null,
    };
    const validPassResult = runResult({
      verdict: 'PASS-candidate',
      evidence: verifiedPassEvidence,
    });
    await writeFile(
      path.join(setup.candidateDir, 'run-result.json'),
      `${JSON.stringify(validPassResult, null, 2)}\n`,
    );
    const passEnvelope = JSON.parse((await invoke(setup)).stdout);
    assert.equal(candidateEnvelopeMatchesSiblings({
      envelope: passEnvelope,
      manifest: manifestValue,
      metadata,
      runResult: validPassResult,
      runDir: setup.candidateDir,
    }), true);

    const invalidPassResult = runResult({
      verdict: 'PASS-candidate',
      evidence: { ...verifiedPassEvidence, request_compaction_receipt_status: 'rejected' },
    });
    await writeFile(
      path.join(setup.candidateDir, 'run-result.json'),
      `${JSON.stringify(invalidPassResult, null, 2)}\n`,
    );
    await assert.rejects(invoke(setup), /nonce-bound structured request_compaction/);
    assert.equal(candidateEnvelopeMatchesSiblings({
      envelope: passEnvelope,
      manifest: manifestValue,
      metadata,
      runResult: invalidPassResult,
      runDir: setup.candidateDir,
    }), false);
  } finally {
    await rm(setup.root, { recursive: true, force: true });
  }
});

test('candidate envelope is outside and invisible to canonical corpus validation', async () => {
  const setup = await fixture();
  try {
    await writeCanonicalCorpusFixture(setup.root);
    const validatorArgs = [corpusValidator, '--root', setup.root, '--index', '--json'];
    const before = await runNode(process.execPath, validatorArgs, { encoding: 'utf8' });
    await invoke({ ...setup, out: path.join(setup.candidateDir, 'candidate-run-result.json') });
    const after = await runNode(process.execPath, validatorArgs, { encoding: 'utf8' });
    const normalized = (raw) => {
      const value = JSON.parse(raw);
      value.root = '<repo-root>';
      for (const report of value.reports || []) {
        if (report.indexPath) report.indexPath = '<repo-root>/PROOFS/INDEX.json';
        for (const check of report.checks || []) {
          if (typeof check.detail === 'string') check.detail = check.detail.replaceAll(setup.root, '<repo-root>');
        }
      }
      return value;
    };
    assert.deepEqual(normalized(after.stdout), normalized(before.stdout));
  } finally {
    await rm(setup.root, { recursive: true, force: true });
  }
});

test('refuses output outside the candidate directory', async () => {
  const setup = await fixture();
  try {
    await assert.rejects(
      invoke({ ...setup, out: path.join(setup.root, 'not-a-candidate-envelope.json') }),
      /output must be candidate-run-result\.json directly inside the candidate directory/,
    );
  } finally {
    await rm(setup.root, { recursive: true, force: true });
  }
});

test('R-CD-TOKEN requires the signed authoritative receipt and rejects tampering', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'candidate-token-'));
  const candidateDir = path.join(root, 'candidate');
  await mkdir(candidateDir);
  const manifestPath = path.join(root, 'manifest.json');
  const h = (character) => character.repeat(16);
  const tokenManifestBody = `${JSON.stringify({
    schema: 'openclaw.k6.proof-row-manifest.v1', rowId: 'R-CD-TOKEN', candidateSha: sha,
    scenario: { name: 'r-cd-token-bracket-delegate' },
    review: { candidateOnly: true, foldRequiresReview: true },
    liveRunSafety: { expectedArtifactClass: 'PASS-candidate' },
  }, null, 2)}\n`;
  const metadata = {
    row: 'R-CD-TOKEN', candidateSha: sha, runtimeBuildSha: sha,
    seat: 'elliott', scenario: 'r-cd-token-bracket-delegate.js',
    ...harnessMetadata({ manifestBody: tokenManifestBody, rowFile: 'r-cd-token-bracket-delegate' }),
  };
  const evidence = {
    surface_class: 'raw-final-text', session_created: true, disposable_origin_ready: true,
    prompt_injected: true,
    send_accepted: true, send_run_id_hash: h('1'), row_nonce_hash: h('2'),
    attempt_id_hash: h('3'), candidateSha: sha, runtimeBuildSha: sha,
    origin_subscription_accepted: true, delegate_return_observed: true,
    origin_cursor_snapshot_accepted: true, origin_cursor_snapshots_rejected: 0,
    origin_return_event_count: 1, root_substituted_return_count: 0,
    origin_return_run_id_hash: h('c'), origin_return_cursor: 2,
    origin_return_message_seq: 3,
    return_target_session_hash: h('4'), return_source_session_hash: h('5'),
    task_pagination_exhausted: true, tasks_list_rejected: 0,
    task_snapshot_consistent: true, task_snapshot_stable_count: 3,
    task_snapshot_digest: h('f'),
    origin_task_unique_count: 1, delegate_task_unique_count: 1,
    origin_task_id_hash: h('6'), origin_run_id_hash: h('7'),
    origin_requester_session_hash: h('8'), origin_child_session_hash: h('4'),
    delegate_task_id_hash: h('9'), delegate_run_id_hash: h('a'),
    delegate_requester_session_hash: h('4'), delegate_child_session_hash: h('5'),
    delegate_requester_matches_origin_child: true, delegate_parent_mismatch: false,
    delegate_correlation_strategy: 'disposable-origin-child-lineage',
    origin_task_status: 'completed', delegate_task_status: 'completed', interrupted: false,
    reason_hash: h('b'), reason_length: 42,
  };
  const attemptState = {
    schema: 'openclaw.k6.r-cd-token.attempt-state.v1', row: 'R-CD-TOKEN',
    attemptIdHash: h('3'), rowNonceHash: h('2'), candidateSha: sha,
    runtimeBuildSha: sha, automaticRetryAllowed: false,
  };
  const correlation = {
    traceId: 'c'.repeat(32), chainId: '11111111-1111-4111-8111-111111111111',
    dispatchSpanId: h('d'), fireSpanId: h('e'), toolSpanIds: [],
    sameTrace: true, distinctSpans: true, reason: { hash: h('b'), length: 42 },
    continuation: { tool: 'continue_delegate', originSurface: 'raw-final-text' },
  };
  const receipt = resolveRcdTokenAuthoritativeReceipt({
    evidence, correlation, attemptState, metadata, signingKey: gatewayKey,
  });

  await test('R-CD-CHAINED-DEPTH-2 candidate envelope requires structured signed authority', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'candidate-chain-'));
    const candidateDir = path.join(root, 'candidate');
    await mkdir(candidateDir);
    const manifestPath = path.join(root, 'manifest.json');
    const chainManifestBody = `${JSON.stringify({
      schema: 'openclaw.k6.proof-row-manifest.v1',
      rowId: 'R-CD-CHAINED-DEPTH-2',
      candidateSha: sha,
      scenario: { name: 'r-cd-chained-depth-2' },
      review: { candidateOnly: true, foldRequiresReview: true },
      liveRunSafety: { expectedArtifactClass: 'PASS-candidate' },
    }, null, 2)}\n`;
    const metadata = {
      row: 'R-CD-CHAINED-DEPTH-2',
      candidateSha: sha,
      runtimeBuildSha: sha,
      seat: 'ronan',
      scenario: 'r-cd-chained-depth-2.js',
      ...harnessMetadata({
        manifestBody: chainManifestBody,
        rowFile: 'r-cd-chained-depth-2',
      }),
    };
    const nonce = 'candidate-chain-envelope-nonce';
    const taskLedger = {
      schema: 'openclaw.k6.r-cd-chained-depth-2.task-ledger.v1',
      nonce,
      rootSessionKey: 'agent:main:root',
      childSessionKey: 'agent:main:subagent:child',
      grandchildSessionKey: 'agent:main:subagent:grandchild',
      taskIds: ['task-child', 'task-grandchild'],
      runIds: ['run-child', 'run-grandchild'],
      taskCount: 2,
      completedTaskCount: 2,
      deliveredTaskCount: 2,
      maxDepth: 2,
      recoveryWakeScheduled: true,
      dispatchAcceptedAtMs: 50,
      completedAtMs: 100,
    };
    const evidence = {
      row: 'R-CD-CHAINED-DEPTH-2',
      candidateSha: sha,
      runtimeBuildSha: sha,
      parent_dispatch_accepted: true,
      dispatch_run_captured: true,
      task_pagination_exhausted: true,
      tasks_list_rejected: 0,
      task_snapshot_stable_count: 2,
      accepted_dispatch_run_id: 'dispatch-run',
      child_spawned: true,
      grandchild_spawned: true,
      child_waiting_sentinel: true,
      depth1_recovery_wake_scheduled: true,
      child_done_sentinel: true,
      grandchild_done_sentinel: true,
      chain_return_received: true,
      max_depth_observed: 2,
      child_session: taskLedger.childSessionKey,
      grandchild_session: taskLedger.grandchildSessionKey,
      reason_hash: '1'.repeat(16),
      reason_length: 42,
      task_ledger_receipt: taskLedger,
      root_return_receipt: {
        authority: 'structured-post-return-consumption',
        rootSessionKey: taskLedger.rootSessionKey,
        nonce,
        childSessionKey: taskLedger.childSessionKey,
        grandchildSessionKey: taskLedger.grandchildSessionKey,
        taskIds: taskLedger.taskIds,
        runIds: taskLedger.runIds,
        consumptionRunId: 'consumption-run',
        taskCompletedAtMs: 100,
        consumptionRunStartedAtMs: 101,
        consumptionInputAtMs: 102,
        consumptionAcceptedAtMs: 103,
        consumptionTerminalAtMs: 104,
        inputMessageSeq: 10,
        acceptedMessageSeq: 11,
        assistantSentinelObserved: false,
      },
    };
    const correlation = {
      row: 'R-CD-CHAINED-DEPTH-2',
      traceId: '2'.repeat(32),
      chainId: 'chain-envelope',
      dispatchSpanId: '3'.repeat(16),
      fireSpanId: '4'.repeat(16),
      toolSpanIds: ['5'.repeat(16)],
      reason: { hash: '1'.repeat(16), length: 42 },
      continuation: { tool: 'continue_delegate' },
      delegate: { mode: 'silent-wake' },
    };
    const receipt = resolveRcdChainAuthoritativeReceipt({
      evidence,
      correlation,
      signingKey: gatewayKey,
    });
    const raw = `${JSON.stringify(receipt, null, 2)}\n`;
    const receiptDigest = createHash('sha256').update(raw).digest('hex');
    const receiptFile = 'r-cd-chained-depth-2-authoritative-receipt.json';
    const runResultValue = {
      effectiveExitCode: 0,
      verdict: 'PASS-candidate',
      verdictSource: 'r-cd-chained-depth-2-authoritative-receipt',
      candidateOnly: true,
      foldRequiresReview: true,
      authoritativeReceipt: {
        file: receiptFile,
        sha256: receiptDigest,
        validated: true,
        source: 'r-cd-chained-depth-2-row-scoped-resolver',
      },
      observability: {
        traceStatus: 'present',
        traceId: correlation.traceId,
        correlationReceipt: 'continuation-trace-correlation.json',
      },
      review: { status: 'ready-for-human-review', pendingReceipts: [] },
    };
    await writeFile(manifestPath, chainManifestBody);
    await writeHarnessSources(candidateDir, chainManifestBody);
    await writeFile(path.join(candidateDir, 'runner-metadata.json'), `${JSON.stringify(metadata)}\n`);
    await writeFile(path.join(candidateDir, receiptFile), raw);
    await writeFile(
      path.join(candidateDir, 'run-result.json'),
      `${JSON.stringify(runResultValue, null, 2)}\n`,
    );
    try {
      const good = JSON.parse((await invoke({ manifestPath, candidateDir })).stdout);
      assert.equal(good.authoritativeReceipt.file, receiptFile);
      assert.equal(good.authoritativeReceipt.sha256, receiptDigest);
      assert.ok(good.artifacts.files.includes(receiptFile));

      await writeFile(
        path.join(candidateDir, 'runner-metadata.json'),
        `${JSON.stringify({ ...metadata, runtimeBuildSha: 'f'.repeat(40) })}\n`,
      );
      await assert.rejects(invoke({ manifestPath, candidateDir }), /build identity mismatch/);
      await writeFile(path.join(candidateDir, 'runner-metadata.json'), `${JSON.stringify(metadata)}\n`);

      await writeFile(path.join(candidateDir, receiptFile), raw.replace('"maxDepth": 2', '"maxDepth": 1'));
      await assert.rejects(invoke({ manifestPath, candidateDir }), /digest mismatch/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  const raw = `${JSON.stringify(receipt, null, 2)}\n`;
  const receiptDigest = createHash('sha256').update(raw).digest('hex');
  await writeFile(manifestPath, tokenManifestBody);
  await writeHarnessSources(candidateDir, tokenManifestBody);
  await writeFile(path.join(candidateDir, 'runner-metadata.json'), `${JSON.stringify(metadata)}\n`);
  await writeFile(path.join(candidateDir, 'r-cd-token-authoritative-receipt.json'), raw);
  await writeFile(path.join(candidateDir, 'run-result.json'), `${JSON.stringify({
    effectiveExitCode: 0, verdict: 'PASS-candidate',
    verdictSource: 'r-cd-token-authoritative-receipt', candidateOnly: true,
    foldRequiresReview: true,
    authoritativeReceipt: {
      file: 'r-cd-token-authoritative-receipt.json', sha256: receiptDigest,
      validated: true, source: 'r-cd-token-row-scoped-resolver',
    },
    observability: {
      traceStatus: 'present', traceId: 'c'.repeat(32),
      correlationReceipt: 'continuation-trace-correlation.json',
    },
    review: { status: 'ready-for-human-review', pendingReceipts: [] },
  }, null, 2)}\n`);
  try {
    const good = JSON.parse((await invoke({ manifestPath, candidateDir })).stdout);
    assert.equal(good.authoritativeReceipt.sha256, receiptDigest);
    assert.equal(good.harness.docsRef, docsRef);
    await writeFile(
      path.join(candidateDir, 'runner-metadata.json'),
      `${JSON.stringify({ ...metadata, runtimeBuildSha: 'f'.repeat(40) })}\n`,
    );
    await assert.rejects(invoke({ manifestPath, candidateDir }), /build identity mismatch/);
    await writeFile(path.join(candidateDir, 'runner-metadata.json'), `${JSON.stringify(metadata)}\n`);
    await writeFile(
      path.join(candidateDir, 'r-cd-token-authoritative-receipt.json'),
      raw.replace('PASS-candidate', 'PARTIAL-candidate'),
    );
    await assert.rejects(invoke({ manifestPath, candidateDir }), /digest mismatch/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
