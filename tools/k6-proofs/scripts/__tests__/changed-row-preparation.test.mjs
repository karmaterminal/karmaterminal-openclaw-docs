import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  advancePreparationAuthority,
  classifyPreparationLifecycle,
  completePreparationAuthority,
  incompletePreparationAuthority,
  publicPreparationEvent,
  sessionVerifiedPreparationAuthority,
  toolsEffectiveRequest,
  resolvePreparedListedSession,
  verifyCreatedPreparedSession,
} from '../../lib/session-runtime-preparation.js';
import { authorityFromEvidence } from '../record-preparation-authority.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const run = promisify(execFile);
const key = 'agent:main:prepared-test-session';
const model = {
  provider: 'openai',
  id: 'prepared-model',
  available: true,
  agentRuntime: { id: 'openclaw', source: 'model' },
};
const session = {
  key,
  sessionId: 'session-id',
  agentId: 'main',
  modelProvider: model.provider,
  model: model.id,
  agentRuntime: model.agentRuntime,
};

test('metadata-only session verification cannot mark runtime preparation complete', () => {
  const listed = resolvePreparedListedSession(
    { sessions: [{ ...session, channelId: 'discord-channel' }] },
    { models: [model] },
    key,
  );
  assert.equal(listed.key, key);
  const listedAuthority = sessionVerifiedPreparationAuthority({
    source: 'sessions-list',
    sessionClass: 'existing-listed',
    agentId: listed.agentId,
    selectedModel: listed.selectedModel,
    session: listed.session,
  });
  assert.equal(listedAuthority.preparation_stage, 'session-verified');
  assert.equal(listedAuthority.preparation_complete, false);
  assert.equal(toolsEffectiveRequest(listed.key, listedAuthority, 'runtime-lifecycle-complete'), null);

  const created = verifyCreatedPreparedSession({
    createPayload: {
      key,
      sessionId: session.sessionId,
      entry: { sessionId: session.sessionId },
      resolved: { modelProvider: model.provider, model: model.id },
    },
    listedPayload: { sessions: [session] },
    key,
    selectedModel: model,
  });
  assert.equal(created.key, key);
  const createdAuthority = sessionVerifiedPreparationAuthority({
    source: 'sessions-create',
    sessionClass: 'disposable-unbound',
    agentId: 'main',
    selectedModel: model,
    session: created.session,
  });
  assert.equal(createdAuthority.preparation_stage, 'session-verified');
  assert.equal(createdAuthority.preparation_complete, false);
  assert.equal(toolsEffectiveRequest(created.key, createdAuthority, 'runtime-lifecycle-complete'), null);
});

test('PREFLIGHT completes only after its exact-session tools.effective probe succeeds', () => {
  const verified = sessionVerifiedPreparationAuthority({
    source: 'sessions-list',
    sessionClass: 'existing-listed',
    agentId: 'main',
    selectedModel: model,
    session,
  });
  const request = toolsEffectiveRequest(key, verified, 'session-verified');
  assert.deepEqual(request.params, { sessionKey: key });
  assert.equal(request.authority.tools_effective_call_stage, 'after-session-verified');
  const complete = completePreparationAuthority(request.authority, 'session-verified');
  assert.equal(complete.preparation_stage, 'tools-effective-complete');
  assert.equal(complete.preparation_complete, true);
});

test('R-RC-1 gates tools.effective on the matching successful preparation lifecycle', () => {
  const verified = sessionVerifiedPreparationAuthority({
    source: 'sessions-create',
    sessionClass: 'disposable-unbound',
    agentId: 'main',
    selectedModel: model,
    session,
  });
  const accepted = advancePreparationAuthority(verified, 'runtime-run-accepted');
  assert.equal(accepted.preparation_complete, false);
  const lifecycleComplete = advancePreparationAuthority(accepted, 'runtime-lifecycle-complete');
  const request = toolsEffectiveRequest(key, lifecycleComplete, 'runtime-lifecycle-complete');
  assert.deepEqual(request.params, { sessionKey: key });
  assert.equal(request.authority.tools_effective_call_stage, 'after-runtime-lifecycle-complete');
  assert.equal(
    completePreparationAuthority(request.authority, 'runtime-lifecycle-complete').preparation_complete,
    true,
  );
});

test('only the exact top-level preparation run lifecycle can satisfy preparation', () => {
  const runId = 'preparation-run';
  assert.equal(classifyPreparationLifecycle({ data: { runId, phase: 'end', status: 'ok' } }, runId), 'unrelated');
  assert.equal(classifyPreparationLifecycle({ runId: 'lookalike', stream: 'lifecycle', data: { phase: 'end', status: 'ok' } }, runId), 'unrelated');
  assert.equal(classifyPreparationLifecycle({ runId, stream: 'lifecycle', data: { phase: 'start' } }, runId), 'active');
  assert.equal(classifyPreparationLifecycle({ runId, stream: 'lifecycle', data: { phase: 'end', status: 'failed' } }, runId), 'failed');
  assert.equal(classifyPreparationLifecycle({ runId, stream: 'lifecycle', data: { phase: 'end', status: 'ok' } }, runId), 'succeeded');
});

test('unknown, absent, or incompletely prepared sessions cannot reach tools.effective', () => {
  assert.equal(resolvePreparedListedSession({ sessions: [session] }, { models: [model] }, 'agent:main:unknown'), null);
  assert.equal(resolvePreparedListedSession({ sessions: [] }, { models: [model] }, key), null);
  assert.equal(toolsEffectiveRequest(key, incompletePreparationAuthority('session-not-listed'), 'session-verified'), null);
  assert.equal(toolsEffectiveRequest('', sessionVerifiedPreparationAuthority({
    source: 'sessions-list',
    sessionClass: 'existing-listed',
    agentId: 'main',
    selectedModel: model,
    session,
  }), 'session-verified'), null);
});

test('public preparation authority cannot disclose raw session keys', async () => {
  const evidence = {
    row: 'PREFLIGHT',
    sessionKey: key,
    created_session_key: key,
    ...completePreparationAuthority(toolsEffectiveRequest(key, sessionVerifiedPreparationAuthority({
      source: 'sessions-create',
      sessionClass: 'disposable-unbound',
      agentId: 'main',
      selectedModel: model,
      session,
    }), 'session-verified').authority, 'session-verified'),
  };
  const authority = authorityFromEvidence('PREFLIGHT', evidence);
  assert.equal(authority.preparationComplete, true);
  assert.equal(authority.sessionSource, 'sessions-create');
  assert.equal(JSON.stringify(authority).includes(key), false);
  const publicEvent = publicPreparationEvent({
    sessionKey: key,
    runId: 'private-run-id',
    nested: { childSessionKey: key, status: 'ok' },
  });
  assert.deepEqual(publicEvent, { nested: { status: 'ok' } });

  const dir = await mkdtemp(path.join(tmpdir(), 'preparation-authority-'));
  try {
    const metadata = path.join(dir, 'runner-metadata.json');
    const evidenceFile = path.join(dir, 'evidence.jsonl');
    await writeFile(metadata, `${JSON.stringify({ row: 'PREFLIGHT' })}\n`);
    await writeFile(evidenceFile, `${JSON.stringify(evidence)}\n`);
    const recorder = path.join(
      repoRoot,
      'tools/k6-proofs/scripts/record-preparation-authority.mjs',
    );
    await run(process.execPath, [
      recorder,
      '--row', 'PREFLIGHT',
      '--evidence', evidenceFile,
      '--metadata', metadata,
    ]);
    const recorded = JSON.parse(await readFile(metadata, 'utf8'));
    assert.deepEqual(recorded.preparationAuthority, authority);
    assert.equal(JSON.stringify(recorded).includes(key), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('changed-row manifests and scenarios keep canonical identity and preparation gates', async () => {
  const manifests = path.join(repoRoot, 'tools/k6-proofs/manifests');
  const scenarios = path.join(repoRoot, 'tools/k6-proofs/scenarios');
  const preflightManifest = JSON.parse(await readFile(path.join(manifests, 'preflight.example.json')));
  const rrc1Manifest = JSON.parse(await readFile(path.join(manifests, 'r-rc-1.json')));
  const preflight = await readFile(path.join(scenarios, 'preflight.js'), 'utf8');
  const rrc1 = await readFile(path.join(scenarios, 'r-rc-1-threshold-reject.js'), 'utf8');
  const runner = await readFile(path.join(repoRoot, 'tools/k6-proofs/scripts/run-proofs.sh'), 'utf8');

  assert.equal(preflightManifest.rowId, 'PREFLIGHT');
  assert.equal(preflightManifest.artifactDestination.row, 'PREFLIGHT');
  assert.deepEqual(
    ['agents.list', 'models.list', 'sessions.list', 'tools.effective']
      .every((method) => preflightManifest.scenario.methods.includes(method)),
    true,
  );
  assert.deepEqual(
    ['agents.list', 'models.list', 'sessions.create', 'sessions.list', 'sessions.messages.subscribe', 'sessions.send', 'tools.effective']
      .every((method) => rrc1Manifest.scenario.methods.includes(method)),
    true,
  );
  for (const source of [preflight, rrc1]) {
    assert.match(source, /toolsEffectiveRequest\(/);
    assert.match(source, /preparation_complete/);
    assert.match(source, /VERDICT: \$\{verdict\}/);
  }
  assert.match(preflight, /resolvePreparedListedSession\(/);
  assert.match(preflight, /verifyCreatedPreparedSession\(/);
  assert.match(rrc1, /verifyCreatedPreparedSession\(/);
  assert.match(rrc1, /classifyPreparationLifecycle\(/);
  assert.match(rrc1, /runtime-lifecycle-complete/);
  assert.doesNotMatch(rrc1, /evidence\.(?:sessionKey|created_session_key)\s*=/);
  assert.match(preflight, /row:\s*'PREFLIGHT'/);
  assert.match(rrc1, /classifyRequestCompactionReceipt/);
  assert.match(rrc1, /findRequestCompactionReceipt/);
  assert.match(runner, /record-preparation-authority\.mjs/);
  assert.match(runner, /NO-VERDICT/);
});
