import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildArtifactAuthority,
  validateArtifactAuthority,
} from '../../lib/artifact-authority.mjs';
import { resolveTrustedCorepack } from '../../lib/authenticated-product-tests.mjs';
import {
  publishArtifacts,
  readPublishedArtifacts,
} from '../../lib/atomic-artifacts.mjs';
import { delegateSpawnBound } from '../collect-live-producer-lineage.mjs';
import { sanitizeEvidenceRecords, sanitizeServiceLog } from '../sanitize-k6-artifacts.mjs';

async function workspace(fn) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'producer-v6-'));
  try { return await fn(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}

test('catalog runtime and package manager cannot be selected through caller environment', async () => {
  const runner = await readFile(new URL('../run-catalog-producer.mjs', import.meta.url), 'utf8');
  const authenticated = await readFile(new URL('../../lib/authenticated-product-tests.mjs',
    import.meta.url), 'utf8');
  assert.match(runner, /realpathSync\(process\.execPath\)/u);
  assert.match(runner, /spawnSync\(trustedNode, commandArgs/u);
  assert.doesNotMatch(runner, /OPENCLAW_COREPACK_BIN/u);
  assert.doesNotMatch(authenticated, /OPENCLAW_COREPACK_BIN/u);
  assert.match(authenticated, /finalIdentity\.head !== candidateSha/u);
  assert.match(authenticated, /finalIdentity\.tree !== initialIdentity\.tree/u);
  assert.match(authenticated, /RUNNER_FILES\.some/u);
  assert.match(resolveTrustedCorepack(), /corepack/u);
});

test('receipt store ignores alternate caller stores and carries lease recovery metadata', async () => {
  const resolver = await readFile(new URL('../resolve-producer-plan.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(resolver, /process\.env\.OPENCLAW_PRODUCER_RECEIPT_STORE/u);
  assert.match(resolver, /os\.userInfo\(\)\.homedir/u);
  assert.match(resolver, /leaseExpiresAt/u);
  assert.match(resolver, /linkSync\(pending, lock\)/u);
  assert.match(resolver, /\.stale-\$\{token\}/u);
});

test('delegate spawn accepts exact product-shaped state and keeps complete log joins', () => {
  const task = 'product-shaped task';
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
      traceparent: `00-${traceId}-${'b'.repeat(16)}-01`,
    },
  };
  const taskHash = createHash('sha256').update(task).digest('hex');
  const log = `controllerId=core/continuation-delegate toolCallId=call taskId=task-id ` +
    `flowId=flow taskSha256=${taskHash} originRunId=origin childSessionKey=child ` +
    `childRunId=child-run traceId=${traceId} status=succeeded disposition=granted`;
  assert.equal(delegateSpawnBound(flow, evidence, task, log), true);
  assert.equal(delegateSpawnBound({ ...flow, controllerId: 'wrong' }, evidence, task, log), false);
  assert.equal(delegateSpawnBound({ ...flow, status: 'failed' }, evidence, task, log), false);
  assert.equal(delegateSpawnBound(flow, evidence, task, log.replace('status=succeeded', 'status=failed')), false);
});

test('artifact authority rejects unsigned nested integrity payload', async () =>
  workspace(async (directory) => {
    const name = 'tempo-trace-abcdef.json';
    const key = 'v6-artifact-key';
    await writeFile(path.join(directory, name), JSON.stringify({
      schema: 'openclaw.k6.public-tempo-trace.v1',
      spans: [],
    }));
    const authority = buildArtifactAuthority({ directory, names: [name], signingKey: key });
    assert.equal(validateArtifactAuthority({ authority, directory, names: [name], signingKey: key }), true);
    authority.integrity.privatePayload = 'TOP_SECRET_UNSIGNED_PAYLOAD';
    assert.equal(validateArtifactAuthority({ authority, directory, names: [name], signingKey: key }), false);
  }));

test('public projection drops payload and credential fields without censoring safe strings', () => {
  const privateValue = 'PRIVATE USER PAYLOAD 8675309';
  const secret = 'UNMAPPED_SECRET_8675309';
  const source = {
    safeSummary: 'ordinary explanatory text remains public ONLY_IN_ARGS_OBJECT_8675309',
    nested: {
      content: privateValue,
      text: privateValue,
      delta: privateValue,
      args: { value: 'ONLY_IN_ARGS_OBJECT_8675309' },
      result: privateValue,
      token: secret,
      secret,
      password: secret,
      apiKey: secret,
      authorization: secret,
    },
  };
  const { sanitized, orderedTokens } = sanitizeEvidenceRecords([source]);
  const text = JSON.stringify(sanitized);
  assert.match(text, /ordinary explanatory text remains public/u);
  assert.doesNotMatch(text, /PRIVATE USER PAYLOAD|UNMAPPED_SECRET|ONLY_IN_ARGS_OBJECT|content|delta|apiKey/u);
  const compound = sanitizeEvidenceRecords([{
    accessToken: 'LEAKED_ACCESS_TOKEN_123456',
    refresh_token: 'LEAKED_REFRESH_TOKEN_123456',
    authToken: 'LEAKED_AUTH_TOKEN_123456',
  }]);
  assert.doesNotMatch(JSON.stringify(compound.sanitized), /LEAKED_/u);
  const service = sanitizeServiceLog(
    `{"runId":"run-identity-123","status":"${secret}","level":"info"}`,
    [...orderedTokens, ['run-identity-123', '<redacted-run-id>']],
  );
  assert.match(service.text, /"level":"info"/u);
  assert.doesNotMatch(service.text, /UNMAPPED_SECRET/u);
});

test('pinned publication reads one generation and failed replacement preserves the old target', async () =>
  workspace(async (directory) => {
    const first = path.join(directory, 'metrics.prom');
    const second = path.join(directory, 'metrics.json');
    await publishArtifacts([[first, 'old'], [second, '{"value":"old"}']]);
    const pinned = await readPublishedArtifacts([first, second]);
    const newGeneration = await publishArtifacts([[first, 'new'], [second, '{"value":"new"}']]);
    assert.match(pinned.artifacts.get(path.resolve(first)).toString(), /\nold$/u);
    assert.equal(JSON.parse(pinned.artifacts.get(path.resolve(second))).value, 'old');
    const exactNew = await readPublishedArtifacts([first, second], newGeneration);
    assert.match(exactNew.artifacts.get(path.resolve(first)).toString(), /\nnew$/u);

    const unsafe = path.join(directory, 'unsafe');
    await mkdir(unsafe);
    await assert.rejects(publishArtifacts([[first, 'later'], [unsafe, '{}']]),
      /not a stable generation link/u);
    const current = await readPublishedArtifacts([first, second]);
    assert.match(current.artifacts.get(path.resolve(first)).toString(), /\nnew$/u);
    assert.equal(JSON.parse(current.artifacts.get(path.resolve(second))).value, 'new');
  }));
