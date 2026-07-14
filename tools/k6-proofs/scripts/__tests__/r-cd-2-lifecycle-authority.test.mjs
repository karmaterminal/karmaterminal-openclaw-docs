import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  validateAndProjectRcd2LifecycleReceipt,
} from '../../lib/r-cd-2-lifecycle-receipt.js';
import {
  classifyRcd2LocalEvidence,
} from '../../lib/r-cd-2-lifecycle-policy.js';
import { resolveRcd2LifecycleReceipt } from '../resolve-r-cd-2-lifecycle-receipt.mjs';
import { projectRcd2PublicArtifacts } from '../project-r-cd-2-public-artifacts.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '../..');
const defaultManifest = path.join(repoRoot, 'manifests/r-cd-2.json');
const writer = path.join(repoRoot, 'scripts/evidence-writer.mjs');
const postprocessor = path.join(repoRoot, 'scripts/postprocess-k6-summary.mjs');
const sha = 'a'.repeat(40);
const signingKey = 'r-cd-2-lifecycle-authority-test-token';
process.env.OPENCLAW_GATEWAY_TOKEN = signingKey;

function localEvidence(overrides = {}) {
  const runFingerprint = '4'.repeat(16);
  const reasonHash = '5'.repeat(16);
  return {
    row: 'R-CD-2',
    session_created: true,
    session_unbound_confirmed: true,
    tool_accepted: true,
    delegate_mode: 'silent-wake',
    reason_hash: reasonHash,
    reason_length: 91,
    send_run_id_captured: true,
    send_run_fingerprint: runFingerprint,
    delegate_scheduled_receipt: true,
    delegate_scheduled_run_matched: true,
    dispatch_turn_completed: true,
    terminal_success_observed: true,
    terminal_run_matched: true,
    terminal_run_fingerprint: runFingerprint,
    parent_wake_observed: true,
    child_fire_or_completion_observed: true,
    wake_run_matched: true,
    wake_run_fingerprint: runFingerprint,
    wake_delay_satisfied: true,
    post_wake_quiet_completed: true,
    channel_message_observed: false,
    dispatch_failure_observed: false,
    dispatch_replay_unsafe_observed: false,
    failed_item_observed: false,
    failure_receipt: null,
    redacted_events: [],
    ...overrides,
  };
}

function correlation(overrides = {}) {
  return {
    schema: 'openclaw.k6.continuation-trace-correlation.v1',
    row: 'R-CD-2',
    continuation: {
      tool: 'continue_delegate',
      acceptSpan: 'continuation.delegate.dispatch',
      fireSpan: 'continuation.delegate.fire',
    },
    delegate: { mode: 'silent-wake' },
    reason: { hash: '5'.repeat(16), length: 91, source: 'manifest-nonce', rawPersisted: false },
    sameTrace: true,
    distinctSpans: true,
    traceId: '1'.repeat(32),
    chainId: 'private-chain-id',
    dispatchSpanId: '2'.repeat(16),
    fireSpanId: '3'.repeat(16),
    toolSpanIds: ['6'.repeat(16)],
    ...overrides,
  };
}

async function withTmp(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'r-cd-2-authority-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function artifactTree(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await artifactTree(target));
    else files.push({ path: path.relative(root, target), text: await readFile(target, 'utf8') });
  }
  return files;
}

async function writerOut(dir, {
  receipt,
  evidence,
  traceCorrelation,
  summaryOverrides = {},
  manifestPath = defaultManifest,
  seatReadiness = null,
}) {
  const receiptPath = path.join(dir, 'r-cd-2-lifecycle-receipt.json');
  const correlationPath = path.join(dir, 'continuation-trace-correlation.json');
  const evidencePath = path.join(dir, 'private-evidence.jsonl');
  const logPath = path.join(dir, 'k6.log');
  const summaryPath = path.join(dir, 'summary.json');
  const readinessPath = path.join(dir, 'private-seat-readiness.json');
  await writeFile(receiptPath, `${JSON.stringify(receipt)}\n`);
  if (traceCorrelation) await writeFile(correlationPath, `${JSON.stringify(traceCorrelation)}\n`);
  await writeFile(evidencePath, `${JSON.stringify(evidence)}\n`);
  await writeFile(
    logPath,
    `--- R-CD-2 EVIDENCE SUMMARY ---\n${JSON.stringify(evidence)}\n--- END EVIDENCE ---\n`,
  );
  await writeFile(summaryPath, JSON.stringify({
    metrics: {
      proof_failures: { values: { count: 0 } },
      checks: { values: { rate: 1 } },
      r_cd_2_duration: { values: { avg: 12000 } },
    },
    ...summaryOverrides,
  }));
  if (seatReadiness) await writeFile(readinessPath, JSON.stringify(seatReadiness));

  const receiptArgs = ['--lifecycle-receipt', receiptPath];
  const correlationArgs = traceCorrelation
    ? ['--lifecycle-correlation', correlationPath]
    : [];
  const writerRun = await execFileAsync(process.execPath, [
    writer,
    '--input', logPath,
    '--row', 'R-CD-2',
    '--seat', 'unit',
    '--sha', sha,
    '--manifest', manifestPath,
    ...(seatReadiness ? ['--seat-readiness', readinessPath] : []),
    ...receiptArgs,
    ...correlationArgs,
  ], { cwd: dir });
  const postRun = await execFileAsync(process.execPath, [
    postprocessor,
    '--manifest', manifestPath,
    '--summary', summaryPath,
    '--out-root', path.join(dir, 'post'),
    '--run-id', 'unit',
    '--lifecycle-evidence', evidencePath,
    ...receiptArgs,
    ...correlationArgs,
  ], { cwd: dir });
  const writerDir = path.join(dir, JSON.parse(writerRun.stdout).runDir);
  const postDir = JSON.parse(postRun.stdout).runDir;
  return {
    writer: JSON.parse(await readFile(path.join(writerDir, 'row-result.json'), 'utf8')),
    post: JSON.parse(await readFile(path.join(postDir, 'row-result.json'), 'utf8')),
    writerDir,
    postDir,
  };
}

test('July-shaped generic delayed traffic cannot complete the local lifecycle', () => {
  const july = localEvidence({
    delegate_scheduled_receipt: false,
    delegate_scheduled_run_matched: false,
    terminal_success_observed: false,
    terminal_run_matched: false,
    terminal_run_fingerprint: null,
    child_fire_or_completion_observed: true,
    wake_run_matched: false,
    wake_run_fingerprint: '9'.repeat(16),
  });
  assert.equal(classifyRcd2LocalEvidence(july).complete, false);
  const receipt = resolveRcd2LifecycleReceipt({
    evidence: july,
    correlation: correlation(),
    signingKey,
  });
  assert.deepEqual(
    [receipt.verdict, receipt.failureCategory],
    ['PARTIAL-candidate', 'missing-local-lifecycle-evidence'],
  );
});

test('provider, failed-turn, replay-unsafe, and failed-item evidence fails closed', () => {
  const fixtures = [
    ['provider-transport-error', { dispatch_failure_observed: true, failure_receipt: { kind: 'provider-transport-error' } }],
    ['dispatching-turn-failed', { dispatch_failure_observed: true, failure_receipt: { kind: 'dispatching-turn-failed' } }],
    ['dispatching-turn-replay-invalid', { dispatch_replay_unsafe_observed: true }],
    ['dispatching-turn-failed', { failed_item_observed: true }],
  ];
  for (const [category, overrides] of fixtures) {
    const receipt = resolveRcd2LifecycleReceipt({
      evidence: localEvidence(overrides),
      correlation: correlation(),
      signingKey,
    });
    assert.deepEqual([receipt.verdict, receipt.failureCategory], ['PARTIAL-candidate', category]);
  }
});

test('full local evidence and typed silent-wake topology produce one bound PASS receipt', () => {
  const evidence = localEvidence();
  const traceCorrelation = correlation();
  const receipt = resolveRcd2LifecycleReceipt({ evidence, correlation: traceCorrelation, signingKey });
  const validation = validateAndProjectRcd2LifecycleReceipt({
    receipt,
    evidence,
    correlation: traceCorrelation,
    signingKey,
  });
  assert.equal(validation.valid, true);
  assert.equal(validation.publicReceipt.verdict, 'PASS-candidate');
  assert.equal(validation.publicReceipt.lifecycle.sameDelegate, true);
  assert.equal(validation.publicReceipt.lifecycle.runFingerprint, evidence.send_run_fingerprint);
});

test('wrong mode and trace, chain, or delegate identity mismatches stay PARTIAL', () => {
  const mismatches = [
    correlation({ delegate: { mode: 'normal' } }),
    correlation({ sameTrace: false }),
    correlation({ fireTraceId: '7'.repeat(32) }),
    correlation({ fireChainId: 'unrelated-chain' }),
    correlation({ fireDelegateIdentity: '8'.repeat(16) }),
  ];
  for (const traceCorrelation of mismatches) {
    const receipt = resolveRcd2LifecycleReceipt({
      evidence: localEvidence(),
      correlation: traceCorrelation,
      signingKey,
    });
    assert.deepEqual(
      [receipt.verdict, receipt.failureCategory],
      ['PARTIAL-candidate', 'invalid-lifecycle-topology'],
    );
  }
});

test('valid correlation with unrelated local lifecycle stays PARTIAL through both writers', async () => {
  const evidence = localEvidence({
    terminal_run_matched: false,
    terminal_run_fingerprint: '7'.repeat(16),
    wake_run_matched: false,
    wake_run_fingerprint: '8'.repeat(16),
  });
  const traceCorrelation = correlation();
  const receipt = resolveRcd2LifecycleReceipt({ evidence, correlation: traceCorrelation, signingKey });
  assert.deepEqual(
    [receipt.verdict, receipt.failureCategory],
    ['PARTIAL-candidate', 'missing-local-lifecycle-evidence'],
  );
  await withTmp(async (dir) => {
    const result = await writerOut(dir, { receipt, evidence, traceCorrelation });
    assert.equal(result.writer.outcome, 'PARTIAL-candidate');
    assert.equal(result.post.outcome, 'PARTIAL-candidate');
  });
});

test('both writers reject a shape-valid PASS receipt bound to different private evidence', async () => {
  await withTmp(async (dir) => {
    const originalEvidence = localEvidence();
    const traceCorrelation = correlation();
    const receipt = resolveRcd2LifecycleReceipt({
      evidence: originalEvidence,
      correlation: traceCorrelation,
      signingKey,
    });
    const unrelatedEvidence = localEvidence({
      send_run_fingerprint: '7'.repeat(16),
      terminal_run_fingerprint: '7'.repeat(16),
      wake_run_fingerprint: '7'.repeat(16),
    });
    await assert.rejects(writerOut(dir, {
      receipt,
      evidence: unrelatedEvidence,
      traceCorrelation,
    }));
  });
});

test('unknown root or lifecycle receipt fields are rejected by the canonical verifier', () => {
  const evidence = localEvidence();
  const traceCorrelation = correlation();
  const receipt = resolveRcd2LifecycleReceipt({ evidence, correlation: traceCorrelation, signingKey });
  for (const forged of [
    { ...receipt, rawRpcError: 'forged-private-rpc' },
    { ...receipt, lifecycle: { ...receipt.lifecycle, traceQuery: 'forged-trace-query' } },
  ]) {
    const validation = validateAndProjectRcd2LifecycleReceipt({
      receipt: forged,
      evidence,
      correlation: traceCorrelation,
      signingKey,
    });
    assert.equal(validation.valid, false);
    assert.match(validation.reason, /root-field|lifecycle-field/);
  }
});

test('a hand-authored valid-shape PASS with a fabricated seal is rejected by both writers', async () => {
  await withTmp(async (dir) => {
    const evidence = localEvidence();
    const traceCorrelation = correlation();
    const canonical = resolveRcd2LifecycleReceipt({ evidence, correlation: traceCorrelation, signingKey });
    const forged = {
      ...canonical,
      integrity: { ...canonical.integrity, signature: '0'.repeat(64) },
    };
    await assert.rejects(writerOut(dir, { receipt: forged, evidence, traceCorrelation }));
  });
});

test('both writers emit only allowlisted R-CD-2 public trees', async () => {
  await withTmp(async (dir) => {
    const markers = [
      'RAW-NONCE-MARKER',
      'RAW-PROMPT-MARKER',
      'RAW-REASON-MARKER',
      'RAW-SESSION-KEY-MARKER',
      'RAW-TOKEN-MARKER',
      '00-raw-traceparent-marker',
      'TRACEQL-QUERY-MARKER',
      'RAW-RPC-PROVIDER-ERROR-MARKER',
      'RAW-JOURNAL-MARKER',
      'RAW-K6-SUMMARY-MARKER',
    ];
    const evidence = localEvidence({
      nonce: markers[0],
      prompt: markers[1],
      reason: markers[2],
      sessionKey: markers[3],
      token: markers[4],
      traceparent: markers[5],
      providerError: markers[7],
      journal: markers[8],
    });
    const traceCorrelation = correlation({ query: markers[6] });
    const receipt = resolveRcd2LifecycleReceipt({ evidence, correlation: traceCorrelation, signingKey });
    const rawManifest = JSON.parse(await readFile(defaultManifest, 'utf8'));
    const manifestPath = path.join(dir, 'private-manifest.json');
    await writeFile(manifestPath, JSON.stringify({
      ...rawManifest,
      candidateSha: markers[0],
      seat: markers[3],
      transport: markers[8],
      invocation: { ...rawManifest.invocation, promptTemplate: markers[1] },
      artifactDestination: {
        root: markers[8],
        sha: markers[0],
        row: markers[2],
        seat: markers[3],
        runDirPrefix: markers[4],
      },
      review: {
        ...rawManifest.review,
        notes: markers[2],
      },
    }));
    const result = await writerOut(dir, {
      receipt,
      evidence,
      traceCorrelation,
      manifestPath,
      summaryOverrides: {
        errors: [{ error: markers[7] }],
        root_group: { checks: [{ name: markers[9] }] },
        metrics: {
          proof_failures: { values: { count: 0, tags: { session: markers[3] } } },
          checks: { values: { rate: 1, tags: { rpc: markers[7] } } },
        },
      },
      seatReadiness: {
        outcome: 'PASS-candidate',
        raw: markers[4],
        k6: { ok: true, matchesExpected: true, rawVersion: markers[9] },
        gateway: { healthReachable: true, statusReachable: true, error: markers[7] },
        continuation: { enabled: true, defaultsPresent: true, error: markers[8] },
        candidate: { sha, private: markers[0] },
        seat: { name: 'unit', private: markers[3] },
      },
    });
    for (const root of [result.writerDir, result.postDir]) {
      const files = await artifactTree(root);
      const text = files.map((file) => file.text).join('\n');
      for (const marker of markers) {
        assert.doesNotMatch(text, new RegExp(marker, 'i'));
        assert.equal(files.some((file) => file.path.includes(marker)), false);
      }
      assert.doesNotMatch(
        text,
        /11111111111111111111111111111111|private-chain-id|2222222222222222|3333333333333333/,
      );
      assert.equal(
        files.some((file) =>
          /111111111111|222222222222|333333333333|tempo-trace-|continuation-trace-correlation/.test(file.path)),
        false,
      );
      for (const required of ['k6-summary.json', 'EVIDENCE.md', 'row-result.json']) {
        assert.equal(files.some((file) => path.basename(file.path) === required), true);
      }
      if (root === result.writerDir) {
        const readiness = JSON.parse(await readFile(path.join(root, 'seat-readiness.json'), 'utf8'));
        assert.equal(readiness.schema, 'openclaw.k6.r-cd-2-public-seat-readiness.v1');
      }
      const summary = JSON.parse(await readFile(path.join(root, 'k6-summary.json'), 'utf8'));
      assert.equal(summary.schema, 'openclaw.k6.r-cd-2-public-summary.v1');
      assert.deepEqual(Object.keys(summary.metrics).sort(), ['checksRate', 'durationMs', 'proofFailures']);
    }
  });
});

test('run-directory projector replaces the complete private tree with an allowlist', async () => {
  await withTmp(async (dir) => {
    const evidence = localEvidence({ nonce: 'RAW-PROJECTOR-NONCE' });
    const traceCorrelation = correlation({ query: 'TRACEQL-PROJECTOR-MARKER' });
    const receipt = resolveRcd2LifecycleReceipt({ evidence, correlation: traceCorrelation, signingKey });
    const receiptPath = path.join(dir, 'r-cd-2-lifecycle-receipt.json');
    const evidencePath = path.join(dir, 'private-evidence.jsonl');
    const correlationPath = path.join(dir, 'continuation-trace-correlation.json');
    await writeFile(receiptPath, `${JSON.stringify(receipt)}\n`);
    await writeFile(evidencePath, `${JSON.stringify(evidence)}\n`);
    await writeFile(correlationPath, `${JSON.stringify(traceCorrelation)}\n`);
    await writeFile(path.join(dir, 'row-manifest.json'), JSON.stringify({
      schema: 'openclaw.k6.proof-row-manifest.v1',
      rowId: 'R-CD-2',
      candidateSha: sha,
      seat: 'unit',
      sessionKey: 'RAW-PRIVATE-SESSION',
      invocation: { promptTemplate: 'RAW-PRIVATE-PROMPT' },
    }));
    await writeFile(
      path.join(dir, 'r-cd-2-summary.json'),
      JSON.stringify({ errors: ['RAW-K6-SUMMARY'], metrics: {} }),
    );
    await writeFile(
      path.join(dir, 'tempo-trace-111111111111.json'),
      JSON.stringify({ traceId: '1'.repeat(32) }),
    );
    await writeFile(path.join(dir, 'gateway-journal-capture.json'), 'RAW-JOURNAL');
    await writeFile(path.join(dir, 'provider-error.log'), 'RAW-RPC-PROVIDER-ERROR');
    await writeFile(path.join(dir, 'seat-readiness.json'), JSON.stringify({
      outcome: 'PASS-candidate',
      raw: 'RAW-READINESS',
      k6: { ok: true, matchesExpected: true },
      gateway: { healthReachable: true, statusReachable: true },
      continuation: { enabled: true, defaultsPresent: true },
    }));
    await projectRcd2PublicArtifacts({ runDir: dir, receiptPath, evidencePath, correlationPath });

    const files = await artifactTree(dir);
    const text = files.map((file) => file.text).join('\n');
    assert.doesNotMatch(
      text,
      /RAW-|TRACEQL|11111111111111111111111111111111|private-chain-id|2222222222222222|3333333333333333/,
    );
    assert.deepEqual(
      (await readdir(dir)).sort(),
      [
        'EVIDENCE.md',
        'artifacts',
        'evidence-lines.log',
        'evidence-redaction.json',
        'evidence.jsonl',
        'gateway-journal.log',
        'k6-summary.json',
        'k6.log',
        'r-cd-2-lifecycle-receipt.json',
        'row-manifest.json',
        'row-result.json',
        'seat-readiness.json',
      ],
    );
  });
});

test('projector rejection also removes every private acquisition file', async () => {
  await withTmp(async (dir) => {
    const evidence = localEvidence({ nonce: 'RAW-REJECTED-NONCE' });
    const traceCorrelation = correlation({ query: 'RAW-REJECTED-TRACEQL' });
    const receipt = resolveRcd2LifecycleReceipt({ evidence, correlation: traceCorrelation, signingKey });
    receipt.integrity.signature = '0'.repeat(64);
    const receiptPath = path.join(dir, 'r-cd-2-lifecycle-receipt.json');
    const evidencePath = path.join(dir, 'private-evidence.jsonl');
    const correlationPath = path.join(dir, 'continuation-trace-correlation.json');
    await writeFile(receiptPath, `${JSON.stringify(receipt)}\n`);
    await writeFile(evidencePath, `${JSON.stringify(evidence)}\n`);
    await writeFile(correlationPath, `${JSON.stringify(traceCorrelation)}\n`);
    await writeFile(path.join(dir, 'row-manifest.json'), JSON.stringify({
      candidateSha: sha,
      seat: 'unit',
      prompt: 'RAW-REJECTED-PROMPT',
    }));
    await writeFile(path.join(dir, 'tempo-trace-private.json'), 'RAW-REJECTED-TRACE');
    await assert.rejects(projectRcd2PublicArtifacts({
      runDir: dir,
      receiptPath,
      evidencePath,
      correlationPath,
    }));
    const files = await artifactTree(dir);
    assert.doesNotMatch(files.map((file) => file.text).join('\n'), /RAW-REJECTED|111111111111/);
    assert.deepEqual(
      (await readdir(dir)).sort(),
      [
        'artifacts',
        'evidence-lines.log',
        'evidence.jsonl',
        'gateway-journal.log',
        'k6.log',
        'projection-rejected.json',
        'row-manifest.json',
      ],
    );
  });
});

test('non-R-CD-2 evidence-writer behavior remains unchanged', async () => {
  await withTmp(async (dir) => {
    const input = path.join(dir, 'non-r-cd-2.log');
    await writeFile(
      input,
      '=== K6-PROOF-EVIDENCE ===\n{"tool_accepted":true,"child_spawned":true,"redacted_events":[]}\n--- END EVIDENCE ---\n',
    );
    const run = await execFileAsync(process.execPath, [
      writer,
      '--input', input,
      '--row', 'R-CD-1',
      '--seat', 'unit',
      '--sha', sha,
    ], { cwd: dir });
    const runDir = path.join(dir, JSON.parse(run.stdout).runDir);
    const result = JSON.parse(await readFile(path.join(runDir, 'row-result.json'), 'utf8'));
    assert.equal(result.outcome, 'PASS-candidate');
  });
});
