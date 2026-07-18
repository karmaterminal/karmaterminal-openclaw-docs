import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { resolveRcdTokenAuthoritativeReceipt } from '../../lib/r-cd-token-authoritative-receipt.mjs';

const runNode = promisify(execFile);
const script = path.resolve('tools/k6-proofs/scripts/validate-candidate-run-result.mjs');
const corpusValidator = path.resolve('tools/k6-proofs/scripts/validate-corpus.mjs');
const sha = 'a'.repeat(40);
const docsRef = 'b'.repeat(40);
const gatewayKey = 'candidate-test-gateway-key';

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

async function fixture({ result = runResult(), metadata = null } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'candidate-run-result-'));
  const candidateDir = path.join(root, 'candidate');
  await mkdir(candidateDir);
  const manifestPath = path.join(root, 'manifest.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest(), null, 2)}\n`);
  await writeFile(path.join(candidateDir, 'runner-metadata.json'), `${JSON.stringify(metadata || {
    row: 'R-CW-TEST', candidateSha: sha, seat: 'cael', scenario: 'r-cw-test.js',
  }, null, 2)}\n`);
  await writeFile(path.join(candidateDir, 'run-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  return { root, candidateDir, manifestPath };
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
});

test('candidate envelope is outside and invisible to canonical corpus validation', async () => {
  const setup = await fixture();
  try {
    const before = await runNode(process.execPath, [corpusValidator, '--index', '--json'], { encoding: 'utf8' });
    await invoke({ ...setup, out: path.join(setup.candidateDir, 'candidate-run-result.json') });
    const after = await runNode(process.execPath, [corpusValidator, '--index', '--json'], { encoding: 'utf8' });
    const normalized = (raw) => {
      const value = JSON.parse(raw);
      value.root = '<repo-root>';
      for (const report of value.reports || []) {
        if (report.indexPath) report.indexPath = '<repo-root>/PROOFS/INDEX.json';
        for (const check of report.checks || []) {
          if (typeof check.detail === 'string') check.detail = check.detail.replaceAll(process.cwd(), '<repo-root>');
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
  const metadata = {
    row: 'R-CD-TOKEN', candidateSha: sha, runtimeBuildSha: sha,
    seat: 'elliott', scenario: 'r-cd-token-bracket-delegate.js',
  };
  const evidence = {
    surface_class: 'raw-final-text', session_created: true, disposable_origin_ready: true,
    prompt_injected: true,
    send_accepted: true, send_run_id_hash: h('1'), row_nonce_hash: h('2'),
    attempt_id_hash: h('3'), candidateSha: sha, runtimeBuildSha: sha,
    origin_subscription_accepted: true, delegate_return_observed: true,
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
  const raw = `${JSON.stringify(receipt, null, 2)}\n`;
  const digest = createHash('sha256').update(raw).digest('hex');
  await writeFile(manifestPath, `${JSON.stringify({
    schema: 'openclaw.k6.proof-row-manifest.v1', rowId: 'R-CD-TOKEN', candidateSha: sha,
    scenario: { name: 'r-cd-token-bracket-delegate' },
    review: { candidateOnly: true, foldRequiresReview: true },
    liveRunSafety: { expectedArtifactClass: 'PASS-candidate' },
  }, null, 2)}\n`);
  await writeFile(path.join(candidateDir, 'runner-metadata.json'), `${JSON.stringify(metadata)}\n`);
  await writeFile(path.join(candidateDir, 'r-cd-token-authoritative-receipt.json'), raw);
  await writeFile(path.join(candidateDir, 'run-result.json'), `${JSON.stringify({
    effectiveExitCode: 0, verdict: 'PASS-candidate',
    verdictSource: 'r-cd-token-authoritative-receipt', candidateOnly: true,
    foldRequiresReview: true,
    authoritativeReceipt: {
      file: 'r-cd-token-authoritative-receipt.json', sha256: digest,
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
    assert.equal(good.authoritativeReceipt.sha256, digest);
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
