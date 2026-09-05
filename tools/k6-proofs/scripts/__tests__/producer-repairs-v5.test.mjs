import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildArtifactAuthority,
  validateArtifactAuthority,
} from '../../lib/artifact-authority.mjs';
import { publishArtifacts } from '../../lib/atomic-artifacts.mjs';
import { sourceVitestMatchesAuthenticated } from '../../lib/authenticated-product-tests.mjs';
import { withoutGitControlVariables } from '../../lib/git-execution-environment.mjs';
import {
  beginTaskPagination,
  consumeTaskPage,
  createTaskPagination,
  MAX_TASK_PAGES,
} from '../../lib/task-pagination.js';
import {
  DEPENDENCY_RECEIPT_SCHEMA,
  REQUIRED_PRODUCT_SHA,
  signProducerReceipt,
} from '../../lib/producer-receipt.mjs';
import { delegateSpawnBound } from '../collect-live-producer-lineage.mjs';
import { sanitizeEvidenceRecords, sanitizeServiceLog } from '../sanitize-k6-artifacts.mjs';

const proofsDir = fileURLToPath(new URL('../..', import.meta.url));
const resolver = path.join(proofsDir, 'scripts/resolve-producer-plan.mjs');

async function workspace(fn) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'producer-v5-'));
  try { return await fn(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}

test('Git authentication environment removes every inherited Git control variable', () => {
  const clean = withoutGitControlVariables({
    PATH: '/bin',
    GIT_DIR: '/attacker',
    GIT_WORK_TREE: '/borrowed',
    GIT_INDEX_FILE: '/index',
    GIT_OBJECT_DIRECTORY: '/objects',
    GIT_ALTERNATE_OBJECT_DIRECTORIES: '/alternates',
    GIT_REPLACE_REF_BASE: 'refs/replace',
    GIT_NAMESPACE: 'other',
    GIT_CEILING_DIRECTORIES: '/',
  });
  assert.deepEqual(clean, { PATH: '/bin' });
});

test('ignored Vitest shim must match the freshly authenticated dependency closure', async () =>
  workspace(async (directory) => {
    const trusted = path.join(directory, 'trusted');
    const hostile = path.join(directory, 'hostile');
    await writeFile(trusted, '#!/bin/sh\nexec vitest "$@"\n');
    await writeFile(hostile, '#!/bin/sh\necho expected-json\n');
    assert.equal(sourceVitestMatchesAuthenticated(hostile, trusted), false);
    await writeFile(hostile, await readFile(trusted));
    assert.equal(sourceVitestMatchesAuthenticated(hostile, trusted), true);
  }));

function signedReceipt(rowId, index, now, key, docsSha, runId) {
  return signProducerReceipt({
    schema: DEPENDENCY_RECEIPT_SCHEMA,
    issuer: 'v5-observer',
    receiptId: `receipt-${index}`,
    rowId,
    verdict: 'PASS',
    candidateSha: REQUIRED_PRODUCT_SHA,
    runtimeSha: REQUIRED_PRODUCT_SHA,
    docsSha,
    runId,
    producerEvidenceId: `evidence-${index}`,
    artifactDigests: { 'evidence.json': 'c'.repeat(64) },
    issuedAt: new Date(now - 1000).toISOString(),
    expiresAt: new Date(now + 60000).toISOString(),
  }, key);
}

test('durable receipt store rejects replay across caller output roots', async () =>
  workspace(async (directory) => {
    const key = 'v5-test-key';
    const docsSha = 'b'.repeat(40);
    const runId = 'v5-replay';
    const receipt = signedReceipt('R-CD-RETURN-COVENANT-AUTHORITY', 1, Date.now(), key, docsSha, runId);
    const receipts = path.join(directory, 'receipts.json');
    const trust = path.join(directory, 'trust.json');
    const store = path.join(directory, 'verifier-store');
    await writeFile(receipts, JSON.stringify([receipt]));
    await writeFile(trust, JSON.stringify({ 'v5-observer': key }));
    const args = ['--selection', receipt.rowId, '--candidate-sha', REQUIRED_PRODUCT_SHA,
      '--docs-sha', docsSha, '--run-id', runId, '--receipts', receipts];
    const env = {
      ...process.env,
      OPENCLAW_PRODUCER_TRUST_FILE: trust,
      OPENCLAW_PRODUCER_RECEIPT_STORE: store,
    };
    assert.equal(spawnSync(process.execPath, [resolver, ...args], { env }).status, 0);
    assert.equal(spawnSync(process.execPath, [resolver, ...args], {
      env: { ...env, OUT_ROOT: path.join(directory, 'different-output') },
    }).status, 2);
  }));

test('failed receipt bundle consumes no identities', async () =>
  workspace(async (directory) => {
    const key = 'v5-test-key';
    const docsSha = 'b'.repeat(40);
    const runId = 'v5-atomic';
    const now = Date.now();
    const receipts = [
      signedReceipt('R-CD-RETURN-COVENANT-AUTHORITY', 1, now, key, docsSha, runId),
      signedReceipt('R-CD-RETURN-OVERLAP', 2, now, key, docsSha, runId),
    ];
    const receiptFile = path.join(directory, 'receipts.json');
    const trust = path.join(directory, 'trust.json');
    const store = path.join(directory, 'verifier-store');
    await writeFile(receiptFile, JSON.stringify(receipts));
    await writeFile(trust, JSON.stringify({ 'v5-observer': key }));
    await mkdir(store);
    await writeFile(path.join(store, 'prior.json'), JSON.stringify({
      identities: [receipts[1].integrity.signature],
    }));
    const run = spawnSync(process.execPath, [resolver,
      '--selection', 'R-CD-RETURN-COVENANT-AUTHORITY,R-CD-RETURN-OVERLAP',
      '--candidate-sha', REQUIRED_PRODUCT_SHA, '--docs-sha', docsSha,
      '--run-id', runId, '--receipts', receiptFile,
    ], { env: {
      ...process.env,
      OPENCLAW_PRODUCER_TRUST_FILE: trust,
      OPENCLAW_PRODUCER_RECEIPT_STORE: store,
    } });
    assert.equal(run.status, 2);
    assert.deepEqual((await readdir(store)).sort(), ['prior.json']);
  }));

test('service logs publish only structured allowlisted fields and fingerprints', () => {
  const { orderedTokens } = sanitizeEvidenceRecords([{ run_id: 'proof-run-123456' }]);
  const result = sanitizeServiceLog(
    '{"runId":"proof-run-123456","status":"ok","content":"PRIVATE USER PAYLOAD 8675309","token":"UNMAPPED_SECRET_8675309","unknown":"private"}',
    orderedTokens,
  );
  assert.equal(result.retainedLines, 1);
  assert.match(result.text, /runidFingerprint/u);
  assert.match(result.text, /"status":"ok"/u);
  assert.doesNotMatch(result.text, /PRIVATE|UNMAPPED|content|token|unknown/u);
});

test('delegate spawn binding rejects failed and wrong-controller alias matches', () => {
  const task = 'exact task';
  const traceId = 'a'.repeat(32);
  const evidence = {
    parent_session_key: 'parent',
    parent_run_id: 'origin',
    child_session_key: 'child',
    child_initial_run_id: 'child-run',
    spawn_tool_call_id: 'call',
    spawn_task_id: 'task-id',
    spawn_flow_id: 'flow',
  };
  const flow = {
    flowId: 'flow',
    controllerId: 'core/continuation-delegate',
    status: 'succeeded',
    ownerKey: 'parent',
    stateJson: {
      task,
      originRunId: 'origin',
      childSessionKey: 'child',
      childRunId: 'child-run',
      disposition: 'granted',
      traceparent: `00-${traceId}-${'b'.repeat(16)}-01`,
    },
  };
  const taskHash = createHash('sha256').update(task).digest('hex');
  const log = `controllerId=core/continuation-delegate toolCallId=call taskId=task-id flowId=flow taskSha256=${taskHash} originRunId=origin childSessionKey=child childRunId=child-run traceId=${traceId} status=succeeded disposition=granted`;
  assert.equal(delegateSpawnBound(flow, evidence, task, log), true);
  assert.equal(delegateSpawnBound({ ...flow, controllerId: 'attacker/controller' }, evidence, task, log), false);
  assert.equal(delegateSpawnBound({ ...flow, status: 'failed' }, evidence, task, log), false);
});

test('signed artifact authority rejects missing, symlinked, wrong-schema and changed references', async () =>
  workspace(async (directory) => {
    const key = 'artifact-key';
    const trace = 'tempo-trace-abcdef123456.json';
    const correlation = 'continuation-trace-correlation.json';
    await writeFile(path.join(directory, trace), JSON.stringify({
      schema: 'openclaw.k6.public-tempo-trace.v1', spans: [],
    }));
    await writeFile(path.join(directory, correlation), JSON.stringify({
      schema: 'openclaw.k6.continuation-trace-correlation.v1',
    }));
    const names = [correlation, trace];
    const authority = buildArtifactAuthority({ directory, names, signingKey: key });
    assert.equal(validateArtifactAuthority({ authority, directory, names, signingKey: key }), true);
    await writeFile(path.join(directory, trace), '{}');
    assert.equal(validateArtifactAuthority({ authority, directory, names, signingKey: key }), false);
    await rm(path.join(directory, trace));
    await symlink(correlation, path.join(directory, trace));
    assert.equal(validateArtifactAuthority({ authority, directory, names, signingKey: key }), false);
  }));

test('task pagination reaches identities after page 100 and preserves cross-page ambiguity', () => {
  const state = createTaskPagination();
  assert.deepEqual(beginTaskPagination(state), { limit: 100 });
  let result;
  for (let page = 0; page <= 100; page += 1) {
    result = consumeTaskPage(state, {
      tasks: page === 0 || page === 100 ? [{ id: `target-${page}` }] : [],
      nextCursor: page === 100 ? null : `cursor-${page + 1}`,
    });
  }
  assert.equal(result.complete, true);
  assert.deepEqual(result.tasks.filter(({ id }) => id.startsWith('target-')).map(({ id }) => id),
    ['target-0', 'target-100']);
});

test('task pagination rejects cursor loops and its finite page bound', () => {
  const loop = createTaskPagination();
  beginTaskPagination(loop);
  assert.deepEqual(consumeTaskPage(loop, { tasks: [], nextCursor: 'same' }).next,
    { limit: 100, cursor: 'same' });
  assert.match(consumeTaskPage(loop, { tasks: [], nextCursor: 'same' }).error, /loop/u);
  const bounded = createTaskPagination();
  beginTaskPagination(bounded);
  let result;
  for (let page = 0; page < MAX_TASK_PAGES; page += 1) {
    result = consumeTaskPage(bounded, { tasks: [], nextCursor: `cursor-${page}` });
    if (result.error) break;
  }
  assert.match(result.error, /exceeded/u);
});

test('multi-artifact publication switches one complete generation', async () =>
  workspace(async (directory) => {
    const first = path.join(directory, 'metrics.prom');
    const second = path.join(directory, 'metrics.json');
    await publishArtifacts([[first, 'old'], [second, '{"value":"old"}']]);
    await publishArtifacts([[first, 'new'], [second, '{"value":"new"}']]);
    const prom = await readFile(first, 'utf8');
    const json = JSON.parse(await readFile(second, 'utf8'));
    const generation = /# artifact_generation ([a-f0-9-]+)/u.exec(prom)?.[1];
    assert.equal(json.artifactGeneration, generation);
    assert.match(prom, /\nnew$/u);
    assert.equal(json.value, 'new');
  }));
