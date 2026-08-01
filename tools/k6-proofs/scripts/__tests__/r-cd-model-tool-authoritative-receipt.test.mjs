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
  const receipt = resolveRcdModelToolAuthoritativeReceipt({
    evidence: evidence(),
    correlation: correlation(),
    signingKey,
  });
  assert.equal(receipt.verdict, 'PASS-candidate');
  assert.deepEqual(validateRcdModelToolAuthoritativeReceipt(receipt, signingKey), {
    valid: true,
    verdict: 'PASS-candidate',
  });
  assert.doesNotMatch(JSON.stringify(receipt), /R-CD-MODEL-TOOL-UNIT|agent:main:subagent:unit/);
});

test('execution fallback is FAIL even when selected-model projection says Luna', () => {
  const receipt = resolveRcdModelToolAuthoritativeReceipt({
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
    signingKey,
  });
  assert.deepEqual(
    [receipt.verdict, receipt.failureCategory],
    ['FAIL-candidate', 'execution-model-mismatch'],
  );
  assert.equal(validateRcdModelToolAuthoritativeReceipt(receipt, signingKey).valid, true);
});

test('nested model IDs preserve provider separation and cannot certify Luna', () => {
  const receipt = resolveRcdModelToolAuthoritativeReceipt({
    evidence: evidence(),
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
    signingKey,
  });
  assert.equal(receipt.verdict, 'FAIL-candidate');
  assert.equal(receipt.execution.calls[0].identity, 'openrouter/anthropic/claude-sonnet');
  assert.equal(validateRcdModelToolAuthoritativeReceipt(receipt, signingKey).valid, true);
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
    const receipt = resolveRcdModelToolAuthoritativeReceipt({
      evidence: evidence(),
      correlation: value,
      signingKey,
    });
    assert.deepEqual([receipt.verdict, receipt.failureCategory], [null, category]);
    assert.equal(validateRcdModelToolAuthoritativeReceipt(receipt, signingKey).valid, true);
  }
});

test('receipt tampering is rejected', () => {
  const receipt = resolveRcdModelToolAuthoritativeReceipt({
    evidence: evidence(),
    correlation: correlation(),
    signingKey,
  });
  assert.equal(validateRcdModelToolAuthoritativeReceipt({
    ...receipt,
    verdict: 'FAIL-candidate',
  }, signingKey).valid, false);
  assert.equal(validateRcdModelToolAuthoritativeReceipt(receipt, 'wrong-key').valid, false);
});

test('writer and postprocessor require the signed model receipt', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'r-cd-model-tool-writers-'));
  try {
    const receipt = resolveRcdModelToolAuthoritativeReceipt({
      evidence: evidence(),
      correlation: correlation(),
      signingKey,
    });
    const receiptPath = path.join(dir, 'receipt.json');
    const logPath = path.join(dir, 'k6.log');
    const summaryPath = path.join(dir, 'summary.json');
    await writeFile(receiptPath, JSON.stringify(receipt));
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
      '--sha', 'a'.repeat(40),
      '--manifest', manifestPath,
      '--authoritative-receipt', receiptPath,
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
      '--sha', 'a'.repeat(40),
    ], { cwd: dir, env }), /requires --authoritative-receipt/);

    const noVerdictReceipt = resolveRcdModelToolAuthoritativeReceipt({
      evidence: evidence(),
      correlation: null,
      signingKey,
    });
    await writeFile(receiptPath, JSON.stringify(noVerdictReceipt));
    await assert.rejects(execFileAsync(process.execPath, [
      postprocessorPath,
      '--manifest', manifestPath,
      '--summary', summaryPath,
      '--out-root', path.join(dir, 'post-null'),
      '--run-id', 'unit-null',
      '--authoritative-receipt', receiptPath,
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
    const candidateSha = 'a'.repeat(40);
    const docsRef = 'b'.repeat(40);
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
    const receipt = resolveRcdModelToolAuthoritativeReceipt({
      evidence: evidence(),
      correlation: correlation(),
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
      writeFile(path.join(candidateDir, 'runner-metadata.json'), `${JSON.stringify({
        row: 'R-CD-MODEL-TOOL',
        candidateSha,
        seat: 'unit',
        scenario: 'r-cd-model-tool.js',
        docsRef,
        repository: 'karmaterminal/karmaterminal-openclaw-docs',
        manifestPath: 'tools/k6-proofs/manifests/r-cd-model-tool.json',
        manifestSha256: manifestDigest,
        scenarioPath: 'tools/k6-proofs/scenarios/r-cd-model-tool.js',
        scenarioSha256: scenarioDigest,
      }, null, 2)}\n`),
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
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
