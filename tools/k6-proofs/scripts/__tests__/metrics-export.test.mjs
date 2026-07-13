import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const script = join(repoRoot, 'tools/k6-proofs/scripts/export-row-metrics.mjs');

async function withTmp(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'p81-k6-metrics-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runExporter(args, cwd = repoRoot) {
  return spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
}

test('exports row-result.json to the public-safe Prometheus/OTLP contract', async () => {
  await withTmp(async (dir) => {
    const rowResult = join(dir, 'row-result.json');
    const prom = join(dir, 'metrics.prom');
    const otlp = join(dir, 'metrics.otlp.json');
    await writeFile(rowResult, `${JSON.stringify({
      schema: 'openclaw.k6.proof-row-result.v1',
      runId: 'k6-run-unit',
      rowId: 'R-CD-2',
      candidateSha: '2723dbee783c113cae70e4fb63a4cff9f55402e3',
      seat: 'cael-dgx',
      scenario: 'r-cd-2-silent-wake',
      toolSurface: 'typed-tool',
      transport: 'websocket',
      outcome: 'PASS-candidate',
      metrics: { proofFailures: 0, checksRate: 1, durationMs: 21301 },
      receipts: [{ name: 'tempo-trace-json', required: true, status: 'missing' }],
      failureClass: 'none',
      candidateOnly: true,
      foldRequiresReview: true,
    }, null, 2)}\n`);

    const run = runExporter(['--row-result', rowResult, '--prometheus-out', prom, '--otlp-out', otlp]);
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const receipt = JSON.parse(run.stdout);
    assert.equal(receipt.sampleCount, 6);
    assert.deepEqual(new Set(receipt.metricNames), new Set([
      'openclaw_proofs_k6_run_total',
      'openclaw_proofs_k6_proof_failures_total',
      'openclaw_proofs_k6_candidate_pending_review',
      'openclaw_proofs_k6_duration_ms',
      'openclaw_proofs_k6_checks_rate',
      'openclaw_proofs_k6_receipt_status',
    ]));

    const promText = await readFile(prom, 'utf8');
    assert.match(promText, /openclaw_proofs_k6_run_total\{[^\n]*run_id="k6-run-unit"/);
    assert.match(promText, /row_id="R-CD-2"/);
    assert.match(promText, /openclaw_proofs_k6_candidate_pending_review\{[^\n]*run_id="k6-run-unit"[^\n]*fold_requires_review="true"[^\n]*\} 1/);
    assert.match(promText, /receipt_name="tempo-trace-json"/);
    assert.match(promText, /receipt_status="missing"\} 0/);
    assert.doesNotMatch(promText, /agent:main|Proof nonce|Authorization|TOKEN|\/tmp\//);

    const otlpJson = JSON.parse(await readFile(otlp, 'utf8'));
    const metrics = otlpJson.resourceMetrics[0].scopeMetrics[0].metrics;
    assert.ok(metrics.some((m) => m.name === 'openclaw_proofs_k6_run_total' && m.sum));
    assert.ok(metrics.some((m) => m.name === 'openclaw_proofs_k6_duration_ms' && m.gauge));
  });
});

test('exports row-list runner directory and marks trace-missing as pending receipt', async () => {
  await withTmp(async (dir) => {
    const runDir = join(dir, '20260707T133429Z-r-cd-2');
    await mkdir(runDir, { recursive: true });
    await writeFile(join(runDir, 'row-manifest.json'), `${JSON.stringify({
      rowId: 'R-CD-2',
      candidateSha: '${OPENCLAW_CANDIDATE_SHA}',
      seat: '${OPENCLAW_SEAT_NAME:-cael-dgx}',
      transport: 'websocket',
      toolSurface: 'typed-tool',
      scenario: { name: 'r-cd-2-silent-wake', file: 'r-cd-2-silent-wake.js' },
      liveRunSafety: { requiredReceipts: ['dispatch-accepted', 'parent-wake-event', 'no-channel-delivery'] },
    }, null, 2)}\n`);
    await writeFile(join(runDir, 'runner-metadata.json'), `${JSON.stringify({
      row: 'R-CD-2',
      scenario: 'r-cd-2-silent-wake.js',
      candidateSha: '2723dbee783c113cae70e4fb63a4cff9f55402e3',
      seat: 'cael-dgx',
    }, null, 2)}\n`);
    await writeFile(join(runDir, 'r-cd-2-summary.json'), `${JSON.stringify({
      row: 'R-CD-2',
      sha: '2723dbee783c113cae70e4fb63a4cff9f55402e3',
      seat: 'cael-dgx',
      verdict: 'PASS-candidate',
      metrics: { duration_ms: { avg: 21301 }, failures: 0 },
    }, null, 2)}\n`);
    await writeFile(join(runDir, 'run-result.json'), `${JSON.stringify({
      k6ExitCode: 0,
      endedAt: '2026-07-07T13:34:51Z',
      candidateOnly: true,
      foldRequiresReview: true,
      observability: { traceStatus: 'missing' },
      review: { status: 'review-pending', pendingReceipts: ['tempo-trace-json'] },
    }, null, 2)}\n`);
    await writeFile(join(runDir, 'evidence.jsonl'), `${JSON.stringify({
      tool_accepted: true,
      parent_wake_observed: true,
      channel_message_observed: false,
      trace_id: null,
    })}\n`);

    const prom = join(dir, 'metrics.prom');
    const run = runExporter(['--run-dir', runDir, '--prometheus-out', prom]);
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const receipt = JSON.parse(run.stdout);
    assert.equal(receipt.outcome, 'PASS-candidate');
    const promText = await readFile(prom, 'utf8');
    assert.match(promText, /openclaw_proofs_k6_run_total\{[^\n]*run_id="20260707T133429Z-r-cd-2"/);
    assert.match(promText, /openclaw_proofs_k6_candidate_pending_review\{[^\n]*run_id="20260707T133429Z-r-cd-2"[^\n]*fold_requires_review="true"[^\n]*\} 1/);
    assert.match(promText, /receipt_name="tempo-trace-json"/);
    assert.match(promText, /receipt_status="missing"\} 0/);
    assert.match(promText, /receipt_name="dispatch-accepted"[^\n]*receipt_status="present"[^\n]*\} 1/);
    assert.match(promText, /receipt_name="parent-wake-event"[^\n]*receipt_status="present"[^\n]*\} 1/);
    assert.match(promText, /receipt_name="no-channel-delivery"[^\n]*receipt_status="present"[^\n]*\} 1/);
  });
});


test('marks direct operator config-get receipts present from public-safe evidence', async () => {
  await withTmp(async (dir) => {
    const runDir = join(dir, '20260713T033832Z-r-config-defaults');
    await mkdir(runDir, { recursive: true });
    await writeFile(join(runDir, 'row-manifest.json'), `${JSON.stringify({
      rowId: 'R-CONFIG-DEFAULTS',
      candidateSha: 'cea9e4296b7e5cd37f0a491d637ef8459ea2e737',
      seat: 'elliott',
      transport: 'websocket',
      toolSurface: 'read-only',
      scenario: { name: 'r-config-defaults', file: 'r-config-defaults.js' },
      liveRunSafety: { requiredReceipts: ['seat-readiness', 'config-read', 'continuation-values'] },
    }, null, 2)}\n`);
    await writeFile(join(runDir, 'runner-metadata.json'), `${JSON.stringify({
      row: 'R-CONFIG-DEFAULTS', scenario: 'r-config-defaults.js',
      candidateSha: 'cea9e4296b7e5cd37f0a491d637ef8459ea2e737', seat: 'elliott',
    }, null, 2)}\n`);
    await writeFile(join(runDir, 'run-result.json'), `${JSON.stringify({
      k6ExitCode: 0, candidateOnly: true, foldRequiresReview: true,
      review: { status: 'ready-for-human-review', pendingReceipts: [] },
    }, null, 2)}\n`);
    await writeFile(join(runDir, 'seat-readiness.json'), `${JSON.stringify({ outcome: 'PASS-candidate' })}\n`);
    await writeFile(join(runDir, 'evidence.jsonl'), `${JSON.stringify({
      config_read: true, enabled: true, max_chain_length: 200,
      max_delegates_per_turn: 500, cost_cap_tokens: 50000000,
    })}\n`);

    const prom = join(dir, 'metrics.prom');
    const run = runExporter(['--run-dir', runDir, '--prometheus-out', prom]);
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const promText = await readFile(prom, 'utf8');
    for (const name of ['seat-readiness', 'config-read', 'continuation-values']) {
      assert.match(promText, new RegExp(`receipt_name="${name}"[^\n]*receipt_status="present"[^\n]*\} 1`));
    }
  });
});

test('requires enabled, not merely non-empty, cross-session targeting in public-safe evidence', async () => {
  await withTmp(async (dir) => {
    const runDir = join(dir, '20260713T033832Z-r-config-intersession');
    await mkdir(runDir, { recursive: true });
    await writeFile(join(runDir, 'row-manifest.json'), `${JSON.stringify({
      rowId: 'R-CONFIG-INTERSESSION',
      candidateSha: 'cea9e4296b7e5cd37f0a491d637ef8459ea2e737',
      seat: 'elliott',
      transport: 'websocket', toolSurface: 'read-only',
      scenario: { name: 'r-config-intersession', file: 'r-config-intersession.js' },
      liveRunSafety: { requiredReceipts: ['cross-session-targeting'] },
    }, null, 2)}\n`);
    await writeFile(join(runDir, 'runner-metadata.json'), `${JSON.stringify({
      row: 'R-CONFIG-INTERSESSION', scenario: 'r-config-intersession.js',
      candidateSha: 'cea9e4296b7e5cd37f0a491d637ef8459ea2e737', seat: 'elliott',
    }, null, 2)}\n`);
    await writeFile(join(runDir, 'evidence.jsonl'), `${JSON.stringify({
      config_read: true, cross_session_targeting: 'disabled',
    })}\n`);

    const prom = join(dir, 'metrics.prom');
    const run = runExporter(['--run-dir', runDir, '--prometheus-out', prom]);
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const promText = await readFile(prom, 'utf8');
    assert.match(promText, /receipt_name="cross-session-targeting"[^\n]*receipt_status="unknown"[^\n]*\} 0/);

    await writeFile(join(runDir, 'evidence.jsonl'), `${JSON.stringify({
      config_read: true, cross_session_targeting: 'enabled',
    })}\n`);
    const enabled = runExporter(['--run-dir', runDir, '--prometheus-out', prom]);
    assert.equal(enabled.status, 0, enabled.stderr || enabled.stdout);
    const enabledProm = await readFile(prom, 'utf8');
    assert.match(enabledProm, /receipt_name="cross-session-targeting"[^\n]*receipt_status="present"[^\n]*\} 1/);
  });
});
