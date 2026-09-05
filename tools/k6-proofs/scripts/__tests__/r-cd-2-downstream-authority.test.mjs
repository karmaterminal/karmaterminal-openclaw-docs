import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';
import {
  resolveRcdTokenAuthoritativeReceipt,
  validateRcdTokenAuthoritativeReceipt,
} from '../../lib/r-cd-token-authoritative-receipt.mjs';
import {
  isVerifiedRrc2HonestLimitEvidence,
} from '../../lib/request-compaction-receipt.js';
import {
  BASE,
  testWorkspace,
} from './helpers/r-cd-2-authority-fixture.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../../../..');
const scripts = path.join(repoRoot, 'tools/k6-proofs/scripts');
const corpusValidator = path.join(scripts, 'validate-corpus.mjs');
const postprocessor = path.join(scripts, 'postprocess-k6-summary.mjs');
const metricsExporter = path.join(scripts, 'export-row-metrics.mjs');
const legacyWorkflow = path.join(repoRoot, '.github/workflows/k6-proof.yml');

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd || repoRoot,
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

test('synthetic corpus arithmetic and arbitrary evidence cannot promote R-CD-2', async () => {
  const workspace = await testWorkspace(repoRoot, 'rcd2-corpus');
  try {
    const proofDir = path.join(workspace.root, 'PROOFS', BASE.candidateSha, 'R-CD-2');
    await mkdir(proofDir, { recursive: true });
    await writeFile(path.join(proofDir, 'EVIDENCE.md'), '# Unreviewed claim\n\nPASS\n');
    const rollup = {
      total_rows: 1,
      pass: 1,
      partial: 0,
      thin: 0,
      fail: 0,
      honest_limit: 0,
      missing: 0,
    };
    await writeFile(
      path.join(workspace.root, 'PROOFS', BASE.candidateSha, 'proofs-manifest.json'),
      `${JSON.stringify({
        schema: 'openclaw.proofs.manifest.v1',
        capture_sha: BASE.candidateSha,
        rows: [{
          row: 'R-CD-2',
          state: 'pass',
          dir: `PROOFS/${BASE.candidateSha}/R-CD-2`,
          evidence_doc: `PROOFS/${BASE.candidateSha}/R-CD-2/EVIDENCE.md`,
        }],
        rollup,
      }, null, 2)}\n`,
    );
    await writeFile(
      path.join(workspace.root, 'PROOFS', 'INDEX.json'),
      `${JSON.stringify({
        schema: 'openclaw.proofs.index.v1',
        current_sha: BASE.candidateSha,
        corpus_path: `PROOFS/${BASE.candidateSha}`,
        manifest_path: `PROOFS/${BASE.candidateSha}/proofs-manifest.json`,
        rollup,
      }, null, 2)}\n`,
    );
    const result = await run(process.execPath, [
      corpusValidator, '--root', workspace.root, '--index', '--json',
    ]);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /R-CD-2.*authorit|authorit.*R-CD-2/i);
  } finally {
    await workspace.cleanup();
  }
});

test('legacy workflow rejects every R-CD-2 selector before readiness or live acquisition', async () => {
  const source = await readFile(legacyWorkflow, 'utf8');
  const validationStart = source.indexOf('- name: Validate inputs');
  const acquisitionStart = source.indexOf('- name: Seat readiness preflight');
  assert.ok(validationStart >= 0 && acquisitionStart > validationStart);
  const validation = source.slice(validationStart, acquisitionStart);
  assert.match(validation, /R-CD-2/);
  assert.match(validation, /r-cd-2-silent-wake/);
  assert.match(validation, /r-cd-2\.json/);
  assert.match(validation, /project81-k6-proof\.yml/i);
  assert.match(validation, /exit 1/);
});

test('immutable harness snapshot tracks every R-CD-2 authority dependency and fixture', async () => {
  const { status, stdout, stderr } = await run('git', [
    '-C', repoRoot, 'ls-tree', '-r', '--name-only', 'HEAD',
  ]);
  assert.equal(status, 0, stderr);
  const tracked = new Set(stdout.trim().split('\n'));
  for (const file of [
    'tools/k6-proofs/lib/canonical-json.mjs',
    'tools/k6-proofs/lib/signed-observer-receipt.mjs',
    'tools/k6-proofs/lib/r-cd-2-authority-context.mjs',
    'tools/k6-proofs/scripts/__tests__/helpers/r-cd-2-authority-fixture.mjs',
  ]) {
    assert.equal(tracked.has(file), true, `${file} must be materialized by the full-tree snapshot`);
  }
  const runner = await readFile(path.join(scripts, 'run-proofs.sh'), 'utf8');
  assert.match(runner, /git[\s\S]+archive[\s\S]+tools\/k6-proofs/);
});

test('unaffected generic, construct-only, R-RC-2, and R-CD-TOKEN controls remain accepted', async (t) => {
  await t.test('R-CW-1 metrics', async () => {
    const workspace = await testWorkspace(repoRoot, 'rcd2-positive-cw1');
    try {
      const rowResult = path.join(workspace.root, 'row-result.json');
      await writeFile(rowResult, `${JSON.stringify({
        schema: 'openclaw.k6.proof-row-result.v1',
        runId: 'positive-r-cw-1',
        rowId: 'R-CW-1',
        candidateSha: BASE.candidateSha,
        seat: BASE.seat,
        scenario: 'r-cw-1',
        toolSurface: 'typed-tool',
        transport: 'websocket',
        outcome: 'PASS-candidate',
        metrics: { proofFailures: 0, checksRate: 1 },
        receipts: [],
        candidateOnly: true,
        foldRequiresReview: true,
      })}\n`);
      const result = await run(process.execPath, [metricsExporter, '--row-result', rowResult]);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).outcome, 'PASS-candidate');
    } finally {
      await workspace.cleanup();
    }
  });

  await t.test('construct-only postprocessing', async () => {
    const workspace = await testWorkspace(repoRoot, 'rcd2-positive-construct');
    try {
      const manifest = path.join(workspace.root, 'manifest.json');
      const summary = path.join(workspace.root, 'summary.json');
      await writeFile(manifest, `${JSON.stringify({
        schema: 'openclaw.k6.proof-row-manifest.v1',
        rowId: 'R-OBS-PROOF-MARKER',
        candidateSha: BASE.candidateSha,
        seat: BASE.seat,
        scenario: { name: 'static-corpus-row-validator' },
        review: { candidateOnly: true, foldRequiresReview: true },
        liveRunSafety: { expectedArtifactClass: 'construct-only', foldRequiresReview: true },
      })}\n`);
      await writeFile(summary, '{"metrics":{"proof_failures":{"values":{"count":0}},"checks":{"values":{"rate":1}}}}\n');
      const result = await run(process.execPath, [
        postprocessor,
        '--manifest', manifest,
        '--summary', summary,
        '--out-root', path.join(workspace.root, 'out'),
        '--run-id', 'construct-control',
      ]);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).outcome, 'construct-only');
    } finally {
      await workspace.cleanup();
    }
  });

  await t.test('R-RC-2 structured threshold receipt', () => {
    const evidence = {
      row: 'R-RC-2',
      parent_delegate_argument_policy_valid: true,
      parent_delegate_tool_call_count: 1,
      parent_delegate_argument_keys: ['delaySeconds', 'mode', 'task'],
      parent_delegate_arguments_exact: true,
      parent_dispatch_accepted: true,
      delegate_requested: true,
      child_session_observed: true,
      delegate_child_report_observed: true,
      request_compaction_tool_result_observed: true,
      request_compaction_receipt_role: 'toolResult',
      request_compaction_receipt_tool_name: 'request_compaction',
      request_compaction_invocation_bound: true,
      child_reported_context_threshold: true,
      request_compaction_receipt_status: 'rejected',
      request_compaction_rejected_context_threshold: true,
      guard: 'context_threshold',
      context_usage: 10,
      threshold: 70,
      reported_context_usage: 10,
      reported_threshold: 70,
    };
    assert.equal(isVerifiedRrc2HonestLimitEvidence(evidence), true);
  });

  await t.test('R-CD-TOKEN signed authority', () => {
    const h = (character) => character.repeat(16);
    const key = 'r-cd-token-positive-control';
    const sha = BASE.candidateSha;
    const receipt = resolveRcdTokenAuthoritativeReceipt({
      metadata: { row: 'R-CD-TOKEN', candidateSha: sha, runtimeBuildSha: sha },
      attemptState: {
        schema: 'openclaw.k6.r-cd-token.attempt-state.v1',
        row: 'R-CD-TOKEN',
        attemptIdHash: h('3'),
        rowNonceHash: h('2'),
        candidateSha: sha,
        runtimeBuildSha: sha,
        automaticRetryAllowed: false,
      },
      evidence: {
        surface_class: 'raw-final-text',
        session_created: true,
        disposable_origin_ready: true,
        prompt_injected: true,
        send_accepted: true,
        send_run_id_hash: h('1'),
        row_nonce_hash: h('2'),
        attempt_id_hash: h('3'),
        candidateSha: sha,
        runtimeBuildSha: sha,
        origin_subscription_accepted: true,
        delegate_return_observed: true,
        return_target_session_hash: h('4'),
        return_source_session_hash: h('5'),
        task_pagination_exhausted: true,
        task_snapshot_consistent: true,
        task_snapshot_stable_count: 3,
        task_snapshot_digest: h('0'),
        tasks_list_rejected: 0,
        origin_task_unique_count: 1,
        delegate_task_unique_count: 1,
        origin_task_id_hash: h('6'),
        origin_run_id_hash: h('7'),
        origin_requester_session_hash: h('8'),
        origin_child_session_hash: h('4'),
        delegate_task_id_hash: h('9'),
        delegate_run_id_hash: h('a'),
        delegate_requester_session_hash: h('4'),
        delegate_child_session_hash: h('5'),
        delegate_requester_matches_origin_child: true,
        delegate_parent_mismatch: false,
        origin_task_status: 'completed',
        delegate_task_status: 'completed',
        interrupted: false,
        reason_hash: h('b'),
        reason_length: 42,
      },
      correlation: {
        traceId: 'c'.repeat(32),
        chainId: '11111111-1111-4111-8111-111111111111',
        dispatchSpanId: h('d'),
        fireSpanId: h('e'),
        toolSpanIds: [],
        sameTrace: true,
        distinctSpans: true,
        reason: { hash: h('b'), length: 42 },
        continuation: { tool: 'continue_delegate', originSurface: 'raw-final-text' },
      },
      ancillaryRuntime: null,
      signingKey: key,
    });
    assert.equal(receipt.verdict, 'PASS-candidate');
    assert.deepEqual(validateRcdTokenAuthoritativeReceipt(receipt, key), {
      valid: true,
      verdict: 'PASS-candidate',
    });
  });
});
