import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  resolveRcdModelToolAuthoritativeReceipt,
  validateRcdModelToolAuthoritativeReceipt,
} from '../../lib/r-cd-model-tool-authoritative-receipt.mjs';
import { RCD_MODEL_TOOL_REQUIRED_MODEL } from '../../lib/r-cd-model-tool-verdict.js';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '../../../..');
const manifestPath = path.join(repoRoot, 'tools/k6-proofs/manifests/r-cd-model-tool.json');
const writerPath = path.join(repoRoot, 'tools/k6-proofs/scripts/evidence-writer.mjs');
const postprocessorPath = path.join(
  repoRoot,
  'tools/k6-proofs/scripts/postprocess-k6-summary.mjs',
);
const validatorPath = path.join(
  repoRoot,
  'tools/k6-proofs/scripts/validate-candidate-run-result.mjs',
);
const signingKey = 'r-cd-model-tool-authoritative-test-key';
const traceId = 'a'.repeat(32);
const runId = '20260801T000000Z-r-cd-model-tool';
const candidateSha = 'a'.repeat(40);
const runtimeBuildSha = '9'.repeat(40);
const docsRef = 'b'.repeat(40);

// The independent runner envelope. The receipt must bind to it, and validators
// must re-read it from disk rather than trusting anything inside the receipt.
function metadata(overrides = {}) {
  return {
    row: 'R-CD-MODEL-TOOL',
    scenario: 'r-cd-model-tool.js',
    candidateSha,
    runtimeBuildSha,
    seat: 'unit',
    sessionConfigured: true,
    startedAt: '2026-08-01T00:00:00Z',
    docsRef,
    repository: 'karmaterminal/karmaterminal-openclaw-docs',
    matrixId: 'unit-matrix',
    runId,
    manifestPath: 'tools/k6-proofs/manifests/r-cd-model-tool.json',
    manifestSha256: 'c'.repeat(64),
    scenarioPath: 'tools/k6-proofs/scenarios/r-cd-model-tool.js',
    scenarioSha256: 'd'.repeat(64),
    ...overrides,
  };
}

function envelope(overrides = {}) {
  return { metadata: metadata(), runId, traceId, ...overrides };
}

function resolve(overrides = {}) {
  return resolveRcdModelToolAuthoritativeReceipt({
    evidence: evidence(),
    correlation: correlation(),
    metadata: metadata(),
    runId,
    signingKey,
    ...overrides,
  });
}

function evidence(overrides = {}) {
  return {
    row: 'R-CD-MODEL-TOOL',
    nonce: 'R-CD-MODEL-TOOL-UNIT',
    requested_model_byte: RCD_MODEL_TOOL_REQUIRED_MODEL,
    manifest_model_matches_required: true,
    dispatch_accepted: true,
    parent_scheduled_sentinel: true,
    child_session_observed: true,
    child_session_key: 'agent:main:subagent:unit',
    return_payload: true,
    disposable_session_required: false,
    accepted_send_trace_id: traceId,
    ...overrides,
  };
}

function call(overrides = {}) {
  return {
    spanId: '5'.repeat(16),
    status: 'OK',
    provider: 'openai',
    model: 'gpt-5.6-luna',
    identity: RCD_MODEL_TOOL_REQUIRED_MODEL,
    complete: true,
    ...overrides,
  };
}

function correlation(overrides = {}) {
  return {
    row: 'R-CD-MODEL-TOOL',
    continuation: { tool: 'continue_delegate' },
    delegate: { mode: 'normal' },
    sameTrace: true,
    distinctSpans: true,
    traceId,
    chainId: '12345678-1234-4123-8123-123456789abc',
    dispatchSpanId: '1'.repeat(16),
    fireSpanId: '2'.repeat(16),
    reason: { hash: '3'.repeat(16), length: 100, rawPersisted: false },
    rowBinding: { acceptedSendTraceId: traceId },
    modelExecution: {
      bound: true,
      complete: true,
      identityComplete: true,
      lifecycleComplete: true,
      childHarnessCount: 1,
      childHarnessSpanId: '3'.repeat(16),
      childRunCount: 1,
      childRunSpanId: '4'.repeat(16),
      calls: [call()],
    },
    ...overrides,
  };
}

test('signed exact Luna receipt is valid and contains no raw nonce or session key', () => {
  const receipt = resolve();
  assert.equal(receipt.verdict, 'PASS-candidate');
  assert.deepEqual(validateRcdModelToolAuthoritativeReceipt(receipt, signingKey, envelope()), {
    valid: true,
    verdict: 'PASS-candidate',
  });
  assert.doesNotMatch(JSON.stringify(receipt), /R-CD-MODEL-TOOL-UNIT|agent:main:subagent:unit/);
  // Runner identity, run identity, and the full trace topology are all signed.
  assert.deepEqual(receipt.binding.run, {
    rowId: 'R-CD-MODEL-TOOL',
    seat: 'unit',
    scenario: 'r-cd-model-tool',
    runId,
    matrixId: 'unit-matrix',
    startedAt: '2026-08-01T00:00:00Z',
  });
  assert.equal(receipt.binding.candidateSha, candidateSha);
  assert.equal(receipt.binding.runtimeBuildSha, runtimeBuildSha);
  assert.deepEqual(receipt.binding.trace.callSpanIds, ['5'.repeat(16)]);
});

test('execution fallback is FAIL even when selected-model projection says Luna', () => {
  const receipt = resolve({
    evidence: evidence({
      child_selected_model_projection_byte: RCD_MODEL_TOOL_REQUIRED_MODEL,
      selected_model_projection_matches_request: true,
    }),
    correlation: correlation({
      modelExecution: {
        ...correlation().modelExecution,
        calls: [call({
          model: 'gpt-5.4',
          identity: 'openai/gpt-5.4',
        })],
      },
    }),
  });
  assert.deepEqual(
    [receipt.verdict, receipt.failureCategory],
    ['FAIL-candidate', 'execution-model-mismatch'],
  );
  assert.equal(
    validateRcdModelToolAuthoritativeReceipt(receipt, signingKey, envelope()).valid,
    true,
  );
});

test('nested model IDs preserve provider separation and cannot certify Luna', () => {
  const receipt = resolve({
    correlation: correlation({
      modelExecution: {
        ...correlation().modelExecution,
        calls: [call({
          provider: 'openrouter',
          model: 'anthropic/claude-sonnet',
          identity: 'openrouter/anthropic/claude-sonnet',
        })],
      },
    }),
  });
  assert.equal(receipt.verdict, 'FAIL-candidate');
  assert.equal(receipt.execution.calls[0].identity, 'openrouter/anthropic/claude-sonnet');
  assert.equal(
    validateRcdModelToolAuthoritativeReceipt(receipt, signingKey, envelope()).valid,
    true,
  );
});

test('missing, ambiguous, incomplete, or trace-mismatched authority stays NO-VERDICT', () => {
  const cases = [
    [null, 'missing-continuation-topology'],
    [correlation({
      modelExecution: {
        bound: false,
        complete: false,
        childHarnessCount: 2,
        calls: [],
      },
    }), 'ambiguous-model-execution'],
    [correlation({
      modelExecution: {
        ...correlation().modelExecution,
        complete: false,
        identityComplete: true,
        lifecycleComplete: false,
      },
    }), 'incomplete-model-execution'],
    [correlation({
      traceId: 'b'.repeat(32),
      rowBinding: { acceptedSendTraceId: 'b'.repeat(32) },
    }), 'invalid-continuation-topology'],
  ];
  for (const [value, category] of cases) {
    const receipt = resolve({ correlation: value });
    assert.deepEqual([receipt.verdict, receipt.failureCategory], [null, category]);
    assert.equal(
      validateRcdModelToolAuthoritativeReceipt(receipt, signingKey, envelope()).valid,
      true,
    );
  }
});

test('receipt tampering is rejected', () => {
  const receipt = resolve();
  assert.equal(validateRcdModelToolAuthoritativeReceipt({
    ...receipt,
    verdict: 'FAIL-candidate',
  }, signingKey, envelope()).reason, 'invalid-integrity');
  assert.equal(
    validateRcdModelToolAuthoritativeReceipt(receipt, 'wrong-key', envelope()).reason,
    'invalid-integrity',
  );
});

test('writer and postprocessor require the signed model receipt', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'r-cd-model-tool-writers-'));
  try {
    const receipt = resolve();
    const receiptPath = path.join(dir, 'receipt.json');
    const logPath = path.join(dir, 'k6.log');
    const summaryPath = path.join(dir, 'summary.json');
    const metadataPath = path.join(dir, 'runner-metadata.json');
    await writeFile(receiptPath, JSON.stringify(receipt));
    await writeFile(metadataPath, JSON.stringify(metadata()));
    await writeFile(
      logPath,
      '--- R-CD-MODEL-TOOL EVIDENCE SUMMARY ---\n' +
        '{"row":"R-CD-MODEL-TOOL","redacted_events":[]}\n' +
        '--- END EVIDENCE ---\n',
    );
    await writeFile(summaryPath, JSON.stringify({
      metrics: {
        proof_failures: { values: { count: 0 } },
        checks: { values: { rate: 1 } },
      },
    }));
    const env = { ...process.env, OPENCLAW_GATEWAY_TOKEN: signingKey };
    const writer = await execFileAsync(process.execPath, [
      writerPath,
      '--input', logPath,
      '--row', 'R-CD-MODEL-TOOL',
      '--seat', 'unit',
      '--sha', candidateSha,
      '--manifest', manifestPath,
      '--authoritative-receipt', receiptPath,
      '--runner-metadata', metadataPath,
    ], { cwd: dir, env });
    const writerDir = path.join(dir, JSON.parse(writer.stdout).runDir);
    const writerResult = JSON.parse(
      await readFile(path.join(writerDir, 'row-result.json'), 'utf8'),
    );
    assert.equal(writerResult.outcome, 'PASS-candidate');
    assert.equal(writerResult.verdictSource, 'r-cd-model-tool-authoritative-receipt');
    await access(path.join(writerDir, 'r-cd-model-tool-authoritative-receipt.json'));

    const post = await execFileAsync(process.execPath, [
      postprocessorPath,
      '--manifest', manifestPath,
      '--summary', summaryPath,
      '--out-root', path.join(dir, 'post'),
      '--run-id', 'unit',
      '--authoritative-receipt', receiptPath,
      '--runner-metadata', metadataPath,
    ], { cwd: dir, env });
    const postDir = JSON.parse(post.stdout).runDir;
    const postResult = JSON.parse(
      await readFile(path.join(postDir, 'row-result.json'), 'utf8'),
    );
    assert.equal(postResult.outcome, 'PASS-candidate');
    assert.equal(postResult.verdictSource, 'r-cd-model-tool-authoritative-receipt');
    await access(path.join(postDir, 'r-cd-model-tool-authoritative-receipt.json'));

    await assert.rejects(execFileAsync(process.execPath, [
      writerPath,
      '--input', logPath,
      '--row', 'R-CD-MODEL-TOOL',
      '--seat', 'unit',
      '--sha', candidateSha,
    ], { cwd: dir, env }), /requires --authoritative-receipt/);

    // A signed receipt alone is not authority: the publication surfaces must
    // also be handed the runner envelope the receipt claims to describe.
    await assert.rejects(execFileAsync(process.execPath, [
      writerPath,
      '--input', logPath,
      '--row', 'R-CD-MODEL-TOOL',
      '--seat', 'unit',
      '--sha', candidateSha,
      '--manifest', manifestPath,
      '--authoritative-receipt', receiptPath,
    ], { cwd: dir, env }), /requires --runner-metadata/);
    await assert.rejects(execFileAsync(process.execPath, [
      postprocessorPath,
      '--manifest', manifestPath,
      '--summary', summaryPath,
      '--out-root', path.join(dir, 'post-no-envelope'),
      '--run-id', 'unit-no-envelope',
      '--authoritative-receipt', receiptPath,
    ], { cwd: dir, env }), /requires --runner-metadata/);

    // Replay: the same signed receipt presented against a different run.
    const foreignMetadataPath = path.join(dir, 'foreign-runner-metadata.json');
    await writeFile(
      foreignMetadataPath,
      JSON.stringify(metadata({ runId: '20260801T999999Z-other-run' })),
    );
    await assert.rejects(execFileAsync(process.execPath, [
      postprocessorPath,
      '--manifest', manifestPath,
      '--summary', summaryPath,
      '--out-root', path.join(dir, 'post-replay'),
      '--run-id', 'unit-replay',
      '--authoritative-receipt', receiptPath,
      '--runner-metadata', foreignMetadataPath,
    ], { cwd: dir, env }), /binding-mismatch/);

    const noVerdictReceipt = resolve({ correlation: null });
    await writeFile(receiptPath, JSON.stringify(noVerdictReceipt));
    await assert.rejects(execFileAsync(process.execPath, [
      postprocessorPath,
      '--manifest', manifestPath,
      '--summary', summaryPath,
      '--out-root', path.join(dir, 'post-null'),
      '--run-id', 'unit-null',
      '--authoritative-receipt', receiptPath,
      '--runner-metadata', metadataPath,
    ], { cwd: dir, env }), /no verdict/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('candidate envelope validates the exact model receipt and rejects tampering', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'r-cd-model-tool-envelope-'));
  try {
    const candidateDir = path.join(root, 'unit-run');
    await mkdir(candidateDir);
    const scenario = 'export default function scenario() { return true; }\n';
    const manifest = {
      schema: 'openclaw.k6.proof-row-manifest.v1',
      rowId: 'R-CD-MODEL-TOOL',
      candidateSha,
      seat: 'unit',
      scenario: { name: 'r-cd-model-tool' },
      review: { candidateOnly: true, foldRequiresReview: true },
      liveRunSafety: { expectedArtifactClass: 'PASS-candidate' },
    };
    const manifestBody = `${JSON.stringify(manifest, null, 2)}\n`;
    const scenarioDigest = createHash('sha256').update(scenario).digest('hex');
    const manifestDigest = createHash('sha256').update(manifestBody).digest('hex');
    const runnerMetadata = metadata({
      runId: path.basename(candidateDir),
      manifestSha256: manifestDigest,
      scenarioSha256: scenarioDigest,
    });
    const receipt = resolveRcdModelToolAuthoritativeReceipt({
      evidence: evidence(),
      correlation: correlation(),
      metadata: runnerMetadata,
      runId: path.basename(candidateDir),
      signingKey,
    });
    const receiptRaw = `${JSON.stringify(receipt, null, 2)}\n`;
    const receiptDigest = createHash('sha256').update(receiptRaw).digest('hex');
    const suppliedManifest = path.join(root, 'manifest.json');
    await Promise.all([
      writeFile(suppliedManifest, manifestBody),
      writeFile(path.join(candidateDir, 'row-manifest.json'), manifestBody),
      writeFile(path.join(candidateDir, 'row-scenario.js'), scenario),
      writeFile(
        path.join(candidateDir, 'r-cd-model-tool-authoritative-receipt.json'),
        receiptRaw,
      ),
      writeFile(
        path.join(candidateDir, 'runner-metadata.json'),
        `${JSON.stringify(runnerMetadata, null, 2)}\n`,
      ),
      writeFile(path.join(candidateDir, 'run-result.json'), `${JSON.stringify({
        effectiveExitCode: 0,
        verdict: 'PASS-candidate',
        verdictSource: 'r-cd-model-tool-authoritative-receipt',
        candidateOnly: true,
        foldRequiresReview: true,
        authoritativeReceipt: {
          file: 'r-cd-model-tool-authoritative-receipt.json',
          sha256: receiptDigest,
          validated: true,
          source: 'r-cd-model-tool-row-scoped-resolver',
        },
        observability: {
          traceStatus: 'present',
          traceId,
          correlationReceipt: 'continuation-trace-correlation.json',
        },
        review: { status: 'ready-for-human-review', pendingReceipts: [] },
      }, null, 2)}\n`),
    ]);

    const env = { ...process.env, OPENCLAW_GATEWAY_TOKEN: signingKey };
    const good = await execFileAsync(process.execPath, [
      validatorPath,
      '--manifest', suppliedManifest,
      '--candidate-dir', candidateDir,
      '--docs-ref', docsRef,
    ], { cwd: repoRoot, env });
    assert.equal(JSON.parse(good.stdout).authoritativeReceipt.sha256, receiptDigest);

    await writeFile(
      path.join(candidateDir, 'r-cd-model-tool-authoritative-receipt.json'),
      `${receiptRaw} `,
    );
    await assert.rejects(execFileAsync(process.execPath, [
      validatorPath,
      '--manifest', suppliedManifest,
      '--candidate-dir', candidateDir,
      '--docs-ref', docsRef,
    ], { cwd: repoRoot, env }), /authoritative receipt digest mismatch/);

    // Replay a correctly signed, correctly digested receipt that was minted for
    // a different run: the candidate validator must refuse it.
    const replayReceipt = resolveRcdModelToolAuthoritativeReceipt({
      evidence: evidence(),
      correlation: correlation(),
      metadata: metadata({ runId: 'some-other-run' }),
      runId: 'some-other-run',
      signingKey,
    });
    const replayRaw = `${JSON.stringify(replayReceipt, null, 2)}\n`;
    await writeFile(
      path.join(candidateDir, 'r-cd-model-tool-authoritative-receipt.json'),
      replayRaw,
    );
    const runResultPath = path.join(candidateDir, 'run-result.json');
    const runResult = JSON.parse(await readFile(runResultPath, 'utf8'));
    runResult.authoritativeReceipt.sha256 =
      createHash('sha256').update(replayRaw).digest('hex');
    await writeFile(runResultPath, `${JSON.stringify(runResult, null, 2)}\n`);
    await assert.rejects(execFileAsync(process.execPath, [
      validatorPath,
      '--manifest', suppliedManifest,
      '--candidate-dir', candidateDir,
      '--docs-ref', docsRef,
    ], { cwd: repoRoot, env }), /binding-mismatch/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('authority is refused without an independent runner envelope', () => {
  const receipt = resolve();
  for (const bad of [undefined, {}, { metadata: metadata() }, { runId }]) {
    assert.deepEqual(
      validateRcdModelToolAuthoritativeReceipt(receipt, signingKey, bad),
      { valid: false, reason: 'missing-authority-envelope' },
    );
  }
});

test('a signed receipt cannot be replayed into another run, candidate, or build', () => {
  const receipt = resolve();
  const replays = [
    ['another run directory', envelope({
      metadata: metadata({ runId: '20260801T111111Z-other' }),
      runId: '20260801T111111Z-other',
    })],
    ['another candidate sha', envelope({ metadata: metadata({ candidateSha: 'e'.repeat(40) }) })],
    ['another runtime build', envelope({ metadata: metadata({ runtimeBuildSha: '8'.repeat(40) }) })],
    ['another seat', envelope({ metadata: metadata({ seat: 'other-seat' }) })],
    ['another matrix leg', envelope({ metadata: metadata({ matrixId: 'other-matrix' }) })],
    ['another docs ref', envelope({ metadata: metadata({ docsRef: 'f'.repeat(40) }) })],
    ['another manifest digest', envelope({ metadata: metadata({ manifestSha256: '1'.repeat(64) }) })],
    ['another scenario digest', envelope({ metadata: metadata({ scenarioSha256: '2'.repeat(64) }) })],
  ];
  for (const [label, value] of replays) {
    assert.deepEqual(
      validateRcdModelToolAuthoritativeReceipt(receipt, signingKey, value),
      { valid: false, reason: 'binding-mismatch' },
      label,
    );
  }
  assert.deepEqual(
    validateRcdModelToolAuthoritativeReceipt(receipt, signingKey, envelope({
      traceId: 'c'.repeat(32),
    })),
    { valid: false, reason: 'trace-binding-mismatch' },
  );
});

test('a run directory that disagrees with the runner envelope yields NO-VERDICT', () => {
  const receipt = resolveRcdModelToolAuthoritativeReceipt({
    evidence: evidence(),
    correlation: correlation(),
    metadata: metadata(),
    runId: 'directory-says-something-else',
    signingKey,
  });
  assert.deepEqual(
    [receipt.verdict, receipt.failureCategory],
    [null, 'runner-or-build-identity-mismatch'],
  );
  assert.equal(receipt.binding.candidateSha, null);
  assert.equal(receipt.execution, null);
});

test('an unusable build stamp cannot certify anything', () => {
  for (const bad of [
    { runtimeBuildSha: 'unverified' },
    { runtimeBuildSha: '' },
    // run-proofs.sh stamps these placeholders when it cannot read the deployed
    // build identity; a placeholder is the absence of a runtime build binding.
    { runtimeBuildSha: 'unknown' },
    { runtimeBuildSha: 'UNKNOWN' },
    { runtimeBuildSha: 'none' },
    { candidateSha: 'not-a-sha' },
    { row: 'R-CD-2' },
    { seat: '' },
    { scenario: '' },
    // Runner metadata is part of the authority: an unbound runner identity is
    // not a weaker receipt, it is no receipt.
    { repository: null },
    { docsRef: null },
    { manifestPath: null },
    { scenarioPath: null },
    { manifestSha256: null },
    { scenarioSha256: null },
    { manifestSha256: 'not-a-digest' },
    { scenarioSha256: 'c'.repeat(63) },
  ]) {
    const receipt = resolve({ metadata: metadata(bad) });
    assert.deepEqual(
      [receipt.verdict, receipt.failureCategory],
      [null, 'runner-or-build-identity-mismatch'],
      JSON.stringify(bad),
    );
    assert.equal(
      validateRcdModelToolAuthoritativeReceipt(receipt, signingKey, {
        metadata: metadata(bad),
        runId,
      }).reason,
      'missing-authority-envelope',
    );
  }
});

test('the receipt is a closed document: unknown or missing fields are rejected', () => {
  const receipt = resolve();
  const mutations = [
    { ...receipt, extra: true },
    { ...receipt, binding: { ...receipt.binding, extra: true } },
    { ...receipt, binding: { ...receipt.binding, run: { ...receipt.binding.run, extra: true } } },
    { ...receipt, binding: { ...receipt.binding, runner: { ...receipt.binding.runner, extra: 1 } } },
    { ...receipt, binding: { ...receipt.binding, trace: { ...receipt.binding.trace, extra: 1 } } },
    { ...receipt, lifecycle: { ...receipt.lifecycle, extra: true } },
    { ...receipt, execution: { ...receipt.execution, extra: true } },
    {
      ...receipt,
      execution: {
        ...receipt.execution,
        calls: receipt.execution.calls.map((c) => ({ ...c, extra: true })),
      },
    },
    { ...receipt, integrity: { ...receipt.integrity, extra: true } },
  ];
  for (const [index, mutated] of mutations.entries()) {
    assert.deepEqual(
      validateRcdModelToolAuthoritativeReceipt(mutated, signingKey, envelope()),
      { valid: false, reason: 'invalid-shape' },
      `unknown field mutation ${index}`,
    );
  }
  for (const key of ['binding', 'lifecycle', 'execution', 'integrity', 'verdict', 'schema']) {
    const stripped = { ...receipt };
    delete stripped[key];
    assert.equal(
      validateRcdModelToolAuthoritativeReceipt(stripped, signingKey, envelope()).valid,
      false,
      `missing ${key}`,
    );
  }
});

test('a PASS receipt must carry a complete, exact trace binding', () => {
  const receipt = resolve({
    correlation: correlation({
      modelExecution: {
        ...correlation().modelExecution,
        calls: [call({ spanId: null })],
      },
    }),
  });
  assert.equal(receipt.verdict, 'PASS-candidate');
  assert.deepEqual(receipt.binding.trace.callSpanIds, []);
  assert.deepEqual(
    validateRcdModelToolAuthoritativeReceipt(receipt, signingKey, envelope()),
    { valid: false, reason: 'invalid-trace-binding' },
  );
});

const reportPath = path.join(repoRoot, 'tools/k6-proofs/scripts/render-run-report.mjs');
const rowMetricsPath = path.join(repoRoot, 'tools/k6-proofs/scripts/export-row-metrics.mjs');
const promMetricsPath = path.join(
  repoRoot,
  'tools/k6-proofs/scripts/export-prometheus-metrics.mjs',
);

async function publicationFixture(root, { receiptRaw, metadataOverrides = {}, rowResult } = {}) {
  const runDirRunId = '20260801T000000Z-r-cd-model-tool';
  const runDir = path.join(root, candidateSha, 'R-CD-MODEL-TOOL', 'unit', runDirRunId);
  await mkdir(runDir, { recursive: true });
  const runnerMetadata = metadata({ runId: runDirRunId, ...metadataOverrides });
  const receipt = resolveRcdModelToolAuthoritativeReceipt({
    evidence: evidence(),
    correlation: correlation(),
    metadata: runnerMetadata,
    runId: runDirRunId,
    signingKey,
  });
  const raw = receiptRaw ?? `${JSON.stringify(receipt, null, 2)}\n`;
  await Promise.all([
    writeFile(path.join(runDir, 'runner-metadata.json'), `${JSON.stringify(runnerMetadata)}\n`),
    writeFile(path.join(runDir, 'row-manifest.json'), `${JSON.stringify({
      rowId: 'R-CD-MODEL-TOOL',
      candidateSha,
      seat: 'unit',
      scenario: { name: 'r-cd-model-tool', file: 'r-cd-model-tool.js' },
    })}\n`),
    writeFile(path.join(runDir, 'r-cd-model-tool-authoritative-receipt.json'), raw),
    writeFile(path.join(runDir, 'r-cd-model-tool-summary.json'), `${JSON.stringify({
      row: 'R-CD-MODEL-TOOL',
      verdict: 'PASS-candidate',
      metrics: { failures: 0, duration_ms: { avg: 1000 } },
    })}\n`),
    writeFile(path.join(runDir, 'run-result.json'), `${JSON.stringify({
      k6ExitCode: 0,
      verdict: 'PASS-candidate',
      verdictSource: 'r-cd-model-tool-authoritative-receipt',
      candidateOnly: true,
      foldRequiresReview: true,
      authoritativeReceipt: {
        file: 'r-cd-model-tool-authoritative-receipt.json',
        sha256: createHash('sha256').update(raw).digest('hex'),
        validated: true,
        source: 'r-cd-model-tool-row-scoped-resolver',
      },
      observability: { traceStatus: 'present', traceId },
      review: { status: 'ready-for-human-review', pendingReceipts: [] },
    })}\n`),
  ]);
  // The postprocessed publication shape: a normalized row-result.json sits
  // beside the signed run-result envelope and is preferred by the Prometheus
  // exporter, so it must not become a way around receipt authority.
  if (rowResult) {
    await writeFile(path.join(runDir, 'row-result.json'), `${JSON.stringify({
      schema: 'openclaw.k6.proof-row-result.v1',
      runId: runDirRunId,
      rowId: 'R-CD-MODEL-TOOL',
      candidateSha,
      seat: 'unit',
      scenario: 'r-cd-model-tool',
      outcome: 'PASS-candidate',
      metrics: { proofFailures: 0, checksRate: 1, durationMs: 1000 },
      receipts: [],
      failureClass: 'none',
      candidateOnly: true,
      foldRequiresReview: true,
      ...(rowResult === true ? {} : rowResult),
    }, null, 2)}\n`);
  }
  return { runDir, receipt };
}

async function publishedOutcomes(root, runDir, env) {
  const reportOut = path.join(root, 'report.html');
  await execFileAsync(process.execPath, [reportPath, '--root', root, '--out', reportOut], { env });
  const report = await readFile(reportOut, 'utf8');
  const rowMetrics = await execFileAsync(process.execPath, [
    rowMetricsPath, '--run-dir', runDir, '--prometheus-out', path.join(root, 'row.prom'),
  ], { env });
  const promOut = path.join(root, 'all.prom');
  await execFileAsync(process.execPath, [promMetricsPath, '--root', root, '--out', promOut], { env });
  return {
    report,
    rowOutcome: JSON.parse(rowMetrics.stdout).outcome,
    prom: await readFile(promOut, 'utf8'),
  };
}

test('report and metrics publish the model row only from valid signed authority', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'r-cd-model-tool-publish-'));
  try {
    const env = { ...process.env, OPENCLAW_GATEWAY_TOKEN: signingKey };
    const { runDir } = await publicationFixture(root);
    const good = await publishedOutcomes(root, runDir, env);
    assert.equal(good.rowOutcome, 'PASS-candidate');
    assert.match(good.report, /PASS-candidate/);
    assert.match(good.prom, /outcome="PASS-candidate"/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('every broken model-row authority publishes NO-VERDICT, never a behavioural claim', async () => {
  const env = { ...process.env, OPENCLAW_GATEWAY_TOKEN: signingKey };
  const cases = [
    ['missing receipt file', async (runDir) => {
      await rm(path.join(runDir, 'r-cd-model-tool-authoritative-receipt.json'));
    }],
    ['stale digest', async (runDir) => {
      const file = path.join(runDir, 'r-cd-model-tool-authoritative-receipt.json');
      await writeFile(file, `${await readFile(file, 'utf8')} `);
    }],
    ['malformed receipt', async (runDir) => {
      await writeFile(path.join(runDir, 'r-cd-model-tool-authoritative-receipt.json'), 'not json');
    }],
    ['missing runner envelope', async (runDir) => {
      await rm(path.join(runDir, 'runner-metadata.json'));
    }],
    ['runner envelope replaced with another run', async (runDir) => {
      await writeFile(
        path.join(runDir, 'runner-metadata.json'),
        `${JSON.stringify(metadata({ runId: 'a-different-run' }))}\n`,
      );
    }],
    ['undeclared authority', async (runDir) => {
      const file = path.join(runDir, 'run-result.json');
      const runResult = JSON.parse(await readFile(file, 'utf8'));
      delete runResult.authoritativeReceipt;
      runResult.verdictSource = 'k6-summary';
      await writeFile(file, `${JSON.stringify(runResult)}\n`);
    }],
  ];
  for (const [label, breakIt] of cases) {
    const root = await mkdtemp(path.join(tmpdir(), 'r-cd-model-tool-broken-'));
    try {
      const { runDir } = await publicationFixture(root);
      await breakIt(runDir);
      const published = await publishedOutcomes(root, runDir, env);
      assert.equal(published.rowOutcome, 'NO-VERDICT', label);
      assert.match(published.prom, /outcome="NO-VERDICT"/, label);
      assert.doesNotMatch(published.prom, /outcome="PASS-candidate"/, label);
      assert.doesNotMatch(published.report, /PASS-candidate<\/td>/, label);
      // A degraded model row must never be dressed up as a partial behaviour claim.
      assert.doesNotMatch(published.prom, /outcome="PARTIAL-candidate"/, label);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test('a replayed model receipt is never published as authority', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'r-cd-model-tool-replay-publish-'));
  try {
    const env = { ...process.env, OPENCLAW_GATEWAY_TOKEN: signingKey };
    const foreign = resolveRcdModelToolAuthoritativeReceipt({
      evidence: evidence(),
      correlation: correlation(),
      metadata: metadata({ runId: 'foreign-run' }),
      runId: 'foreign-run',
      signingKey,
    });
    const { runDir } = await publicationFixture(root, {
      receiptRaw: `${JSON.stringify(foreign, null, 2)}\n`,
    });
    const published = await publishedOutcomes(root, runDir, env);
    assert.equal(published.rowOutcome, 'NO-VERDICT');
    assert.doesNotMatch(published.prom, /outcome="PASS-candidate"/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a receipt signed by the wrong key is never published as authority', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'r-cd-model-tool-wrongkey-'));
  try {
    const { runDir } = await publicationFixture(root);
    const published = await publishedOutcomes(root, runDir, {
      ...process.env,
      OPENCLAW_GATEWAY_TOKEN: 'a-different-gateway-token',
    });
    assert.equal(published.rowOutcome, 'NO-VERDICT');
    assert.doesNotMatch(published.prom, /outcome="PASS-candidate"/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('the normalized row-result is never a way around receipt authority', async () => {
  const env = { ...process.env, OPENCLAW_GATEWAY_TOKEN: signingKey };

  // A postprocessed directory still publishes PASS from the signed receipt.
  const intact = await mkdtemp(path.join(tmpdir(), 'r-cd-model-tool-rowresult-ok-'));
  try {
    const { runDir } = await publicationFixture(intact, { rowResult: true });
    const published = await publishedOutcomes(intact, runDir, env);
    assert.equal(published.rowOutcome, 'PASS-candidate');
    assert.match(published.prom, /outcome="PASS-candidate"/);
  } finally {
    await rm(intact, { recursive: true, force: true });
  }

  const cases = [
    // The Prometheus exporter prefers row-result.json; its pre-computed
    // outcome must not survive a broken receipt.
    ['pre-computed PASS with a destroyed receipt', {}, async (runDir) => {
      await rm(path.join(runDir, 'r-cd-model-tool-authoritative-receipt.json'));
    }],
    // Row identity drives receipt enforcement, so an unsigned relabel must not
    // opt the run out of it.
    ['row relabelled in the unsigned row-result', { rowId: 'R-CD-UNGOVERNED' }, async () => {}],
    // A behavioural verdict has to be anchored to the trace the run published.
    ['run-result publishing no trace id', {}, async (runDir) => {
      const file = path.join(runDir, 'run-result.json');
      const runResult = JSON.parse(await readFile(file, 'utf8'));
      runResult.observability = { traceStatus: 'missing' };
      await writeFile(file, `${JSON.stringify(runResult)}\n`);
    }],
  ];
  for (const [label, rowResultOverrides, breakIt] of cases) {
    const root = await mkdtemp(path.join(tmpdir(), 'r-cd-model-tool-rowresult-'));
    try {
      const { runDir } = await publicationFixture(root, { rowResult: rowResultOverrides });
      await breakIt(runDir);
      const promOut = path.join(root, 'all.prom');
      await execFileAsync(process.execPath, [promMetricsPath, '--root', root, '--out', promOut], { env });
      const prom = await readFile(promOut, 'utf8');
      assert.doesNotMatch(prom, /outcome="PASS-candidate"/, label);
      assert.match(prom, /outcome="NO-VERDICT"/, label);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test('exporting a normalized row-result by path re-establishes authority or downgrades', async () => {
  const env = { ...process.env, OPENCLAW_GATEWAY_TOKEN: signingKey };
  const root = await mkdtemp(path.join(tmpdir(), 'r-cd-model-tool-rowresult-path-'));
  try {
    const { runDir } = await publicationFixture(root, { rowResult: true });
    const rowResultPath = path.join(runDir, 'row-result.json');
    const intact = await execFileAsync(process.execPath, [
      rowMetricsPath, '--row-result', rowResultPath,
      '--prometheus-out', path.join(root, 'intact.prom'),
    ], { env });
    assert.equal(JSON.parse(intact.stdout).outcome, 'PASS-candidate');

    // Detached from its run directory the artifact proves nothing, so the
    // pre-computed PASS is downgraded rather than republished.
    const orphan = path.join(root, 'orphan-row-result.json');
    await writeFile(orphan, await readFile(rowResultPath, 'utf8'));
    const detached = await execFileAsync(process.execPath, [
      rowMetricsPath, '--row-result', orphan,
      '--prometheus-out', path.join(root, 'orphan.prom'),
    ], { env });
    assert.equal(JSON.parse(detached.stdout).outcome, 'NO-VERDICT');

    await rm(path.join(runDir, 'r-cd-model-tool-authoritative-receipt.json'));
    const broken = await execFileAsync(process.execPath, [
      rowMetricsPath, '--row-result', rowResultPath,
      '--prometheus-out', path.join(root, 'broken.prom'),
    ], { env });
    assert.equal(JSON.parse(broken.stdout).outcome, 'NO-VERDICT');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
