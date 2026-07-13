import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { resolveRcd2LifecycleReceipt } from '../resolve-r-cd-2-lifecycle-receipt.mjs';
import { projectRcd2PublicArtifacts } from '../project-r-cd-2-public-artifacts.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '../..');
const manifest = path.join(repoRoot, 'manifests/r-cd-2.json');
const writer = path.join(repoRoot, 'scripts/evidence-writer.mjs');
const postprocessor = path.join(repoRoot, 'scripts/postprocess-k6-summary.mjs');
const sha = 'a'.repeat(40);

function localEvidence(overrides = {}) {
  return {
    session_created: true, session_unbound_confirmed: true, tool_accepted: true,
    delegate_scheduled_receipt: true, dispatch_turn_completed: true,
    terminal_success_observed: true, parent_wake_observed: true,
    child_fire_or_completion_observed: true, post_wake_quiet_completed: true,
    channel_message_observed: false, dispatch_failure_observed: false,
    ...overrides,
  };
}

function correlation(overrides = {}) {
  return {
    continuation: { tool: 'continue_delegate', acceptSpan: 'continuation.delegate.dispatch', fireSpan: 'continuation.delegate.fire' },
    delegate: { mode: 'silent-wake' }, sameTrace: true, distinctSpans: true,
    traceId: '1'.repeat(32), chainId: 'private-chain-id',
    dispatchSpanId: '2'.repeat(16), fireSpanId: '3'.repeat(16),
    ...overrides,
  };
}

async function withTmp(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'r-cd-2-authority-'));
  try { return await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

async function writerOut(dir, receipt, summaryOverrides = {}) {
  const receiptPath = path.join(dir, 'r-cd-2-lifecycle-receipt.json');
  const logPath = path.join(dir, 'k6.log');
  const summaryPath = path.join(dir, 'summary.json');
  await writeFile(receiptPath, `${JSON.stringify(receipt)}\n`);
  await writeFile(logPath, '--- R-CD-2 EVIDENCE SUMMARY ---\n{"row":"R-CD-2","tool_accepted":true,"task_created":true,"redacted_events":[]}\n--- END EVIDENCE ---\n');
  await writeFile(summaryPath, JSON.stringify({
    metrics: { proof_failures: { values: { count: 0 } }, checks: { values: { rate: 1 } } },
    ...summaryOverrides,
  }));
  const common = ['--manifest', manifest, '--lifecycle-receipt', receiptPath];
  const writerRun = await execFileAsync(process.execPath, [writer, '--input', logPath, '--row', 'R-CD-2', '--seat', 'unit', '--sha', sha, ...common], { cwd: dir });
  const postRun = await execFileAsync(process.execPath, [postprocessor, '--summary', summaryPath, '--out-root', path.join(dir, 'post'), '--run-id', 'unit', ...common], { cwd: dir });
  const writerDir = JSON.parse(writerRun.stdout).runDir;
  const postDir = JSON.parse(postRun.stdout).runDir;
  return {
    writer: JSON.parse(await readFile(path.join(dir, writerDir, 'row-result.json'), 'utf8')),
    post: JSON.parse(await readFile(path.join(postDir, 'row-result.json'), 'utf8')),
    writerDir: path.join(dir, writerDir),
    postDir,
  };
}

async function artifactText(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const texts = await Promise.all(entries
    .filter((entry) => entry.isFile())
    .map((entry) => readFile(path.join(root, entry.name), 'utf8')));
  return texts.join('\n');
}

test('R-CD-2 resolver fails closed for the July, provider, replay, and failed-item shapes', () => {
  const july = resolveRcd2LifecycleReceipt({ evidence: localEvidence({ terminal_success_observed: false }), correlation: correlation() });
  assert.deepEqual([july.verdict, july.failureCategory], ['PARTIAL-candidate', 'missing-local-lifecycle-evidence']);
  for (const kind of ['provider-transport-error', 'delegate-replay-unsafe', 'dispatching-turn-failed']) {
    const receipt = resolveRcd2LifecycleReceipt({ evidence: localEvidence({ dispatch_failure_observed: true, failure_receipt: { kind } }), correlation: correlation() });
    assert.deepEqual([receipt.verdict, receipt.failureCategory], ['PARTIAL-candidate', kind]);
  }
  const noLocal = resolveRcd2LifecycleReceipt({ evidence: localEvidence({ terminal_success_observed: false }), correlation: correlation() });
  assert.deepEqual([noLocal.verdict, noLocal.failureCategory], ['PARTIAL-candidate', 'missing-local-lifecycle-evidence']);
});

test('R-CD-2 resolver rejects wrong mode and mismatched topology', () => {
  for (const bad of [correlation({ delegate: { mode: 'normal' } }), correlation({ sameTrace: false })]) {
    const receipt = resolveRcd2LifecycleReceipt({ evidence: localEvidence(), correlation: bad });
    assert.deepEqual([receipt.verdict, receipt.failureCategory], ['PARTIAL-candidate', 'invalid-lifecycle-topology']);
  }
});

test('both shared writers consume only the canonical receipt and reject forged passes', async () => {
  await withTmp(async (dir) => {
    const forged = { schema: 'openclaw.k6.r-cd-2-lifecycle-receipt.v2', row: 'R-CD-2', authoritativeSource: 'made-up', verdict: 'PASS-candidate' };
    const receiptPath = path.join(dir, 'forged.json');
    const logPath = path.join(dir, 'k6.log');
    const summaryPath = path.join(dir, 'summary.json');
    await writeFile(receiptPath, JSON.stringify(forged));
    await writeFile(logPath, '--- R-CD-2 EVIDENCE SUMMARY ---\n{"redacted_events":[]}\n--- END EVIDENCE ---\n');
    await writeFile(summaryPath, JSON.stringify({ metrics: { proof_failures: { values: { count: 0 } }, checks: { values: { rate: 1 } } } }));
    await assert.rejects(execFileAsync(process.execPath, [writer, '--input', logPath, '--row', 'R-CD-2', '--seat', 'unit', '--sha', sha, '--manifest', manifest, '--lifecycle-receipt', receiptPath], { cwd: dir }));
    await assert.rejects(execFileAsync(process.execPath, [postprocessor, '--manifest', manifest, '--summary', summaryPath, '--out-root', path.join(dir, 'post'), '--lifecycle-receipt', receiptPath], { cwd: dir }));
  });
});

test('both shared writers agree on complete topology and publish fingerprints only', async () => {
  await withTmp(async (dir) => {
    const receipt = resolveRcd2LifecycleReceipt({ evidence: localEvidence(), correlation: correlation() });
    const result = await writerOut(dir, receipt);
    assert.equal(result.writer.outcome, 'PASS-candidate');
    assert.equal(result.post.outcome, 'PASS-candidate');
    const serialized = JSON.stringify(result);
    assert.doesNotMatch(serialized, /private-chain-id|11111111111111111111111111111111|2222222222222222|3333333333333333/);
    assert.match(result.writer.lifecycleReceipt.lifecycle.traceFingerprint, /^[a-f0-9]{16}$/);
  });
});

test('R-CD-2 public outputs retain no raw acquisition identifiers while partial and non-R-CD-2 paths stay usable', async () => {
  await withTmp(async (dir) => {
    const partial = resolveRcd2LifecycleReceipt({ evidence: localEvidence({ dispatch_failure_observed: true, failure_receipt: { kind: 'provider-transport-error' } }), correlation: correlation() });
    const result = await writerOut(dir, partial);
    assert.equal(result.writer.outcome, 'PARTIAL-candidate');
    assert.equal(result.post.outcome, 'PARTIAL-candidate');
    const serialized = JSON.stringify(result);
    assert.doesNotMatch(serialized, /private-chain-id|11111111111111111111111111111111|2222222222222222|3333333333333333|TraceQL/i);

    const input = path.join(dir, 'non-r-cd-2.log');
    await writeFile(input, '=== K6-PROOF-EVIDENCE ===\n{"tool_accepted":true,"child_spawned":true,"redacted_events":[]}\n--- END EVIDENCE ---\n');
    const run = await execFileAsync(process.execPath, [writer, '--input', input, '--row', 'R-CD-1', '--seat', 'unit', '--sha', sha], { cwd: dir });
    const nonRcd2Dir = JSON.parse(run.stdout).runDir;
    const nonRcd2 = JSON.parse(await readFile(path.join(dir, nonRcd2Dir, 'row-result.json'), 'utf8'));
    assert.equal(nonRcd2.outcome, 'PASS-candidate');
  });
});

test('R-CD-2 writers project raw k6 summaries before public artifacts are written', async () => {
  await withTmp(async (dir) => {
    const marker = 'private-rpc-provider-session-marker';
    const receipt = resolveRcd2LifecycleReceipt({ evidence: localEvidence(), correlation: correlation() });
    const result = await writerOut(dir, receipt, {
      errors: [{ error: marker }],
      root_group: { checks: [{ name: marker }] },
      metrics: {
        proof_failures: { values: { count: 0, tags: { session: marker } } },
        checks: { values: { rate: 1, tags: { rpc: marker } } },
      },
    });
    assert.doesNotMatch(await artifactText(result.writerDir), new RegExp(marker));
    assert.doesNotMatch(await artifactText(result.postDir), new RegExp(marker));
    for (const root of [result.writerDir, result.postDir]) {
      const publicSummary = JSON.parse(await readFile(path.join(root, 'k6-summary.json'), 'utf8'));
      assert.equal(publicSummary.schema, 'openclaw.k6.r-cd-2-public-summary.v1');
      assert.equal(publicSummary.verdict, 'PASS-candidate');
    }
  });
});

test('R-CD-2 projector removes private acquisition files and preserves only safe receipt fingerprints', async () => {
  await withTmp(async (dir) => {
    const receipt = resolveRcd2LifecycleReceipt({ evidence: localEvidence(), correlation: correlation() });
    const receiptPath = path.join(dir, 'r-cd-2-lifecycle-receipt.json');
    const correlationPath = path.join(dir, 'continuation-trace-correlation.json');
    await writeFile(receiptPath, `${JSON.stringify(receipt)}\n`);
    await writeFile(correlationPath, JSON.stringify({
      ...correlation(),
      query: '{ resource.service.name="cael-prince" && .private="TraceQL-private" }',
    }));
    await writeFile(path.join(dir, 'row-manifest.json'), JSON.stringify({
      schema: 'openclaw.k6.proof-row-manifest.v1', rowId: 'R-CD-2', candidateSha: sha,
      seat: 'unit', sessionKey: 'agent:private-session-key', transport: 'websocket', toolSurface: 'typed-tool',
      invocation: { promptTemplate: 'private prompt body' }, scenario: { name: 'r-cd-2-silent-wake' },
    }));
    await writeFile(path.join(dir, 'tempo-trace-111111111111.json'), JSON.stringify({ traceId: '1'.repeat(32) }));
    await writeFile(path.join(dir, 'gateway-journal-capture.json'), JSON.stringify({ raw: 'private journal' }));
    await projectRcd2PublicArtifacts({ runDir: dir, receiptPath, correlationPath });

    const publicText = (await Promise.all((await readdir(dir)).map((name) => readFile(path.join(dir, name), 'utf8')))).join('\n');
    assert.doesNotMatch(publicText, /private-chain-id|private-session-key|private prompt body|TraceQL-private|11111111111111111111111111111111/);
    const projectedManifest = JSON.parse(await readFile(path.join(dir, 'row-manifest.json'), 'utf8'));
    assert.equal(projectedManifest.publicArtifactProjection, 'r-cd-2-lifecycle-receipt-only');
    assert.equal((await readFile(receiptPath, 'utf8')).includes(receipt.lifecycle.traceFingerprint), true);
    await assert.rejects(readFile(correlationPath, 'utf8'));
    await assert.rejects(readFile(path.join(dir, 'tempo-trace-111111111111.json'), 'utf8'));
  });
});
