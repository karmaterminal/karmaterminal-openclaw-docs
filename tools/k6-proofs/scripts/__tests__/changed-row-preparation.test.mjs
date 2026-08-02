import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  completePreparationAuthority,
  incompletePreparationAuthority,
  preparedToolsEffectiveParams,
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

test('validated listed and disposable sessions pass only their exact returned key to tools.effective', () => {
  const listed = resolvePreparedListedSession(
    { sessions: [{ ...session, channelId: 'discord-channel' }] },
    { models: [model] },
    key,
  );
  assert.equal(listed.key, key);
  const listedAuthority = completePreparationAuthority({
    source: 'sessions-list',
    sessionClass: 'existing-listed',
    agentId: listed.agentId,
    selectedModel: listed.selectedModel,
    session: listed.session,
  });
  assert.deepEqual(preparedToolsEffectiveParams(listed.key, listedAuthority), { sessionKey: key });

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
  const createdAuthority = completePreparationAuthority({
    source: 'sessions-create',
    sessionClass: 'disposable-unbound',
    agentId: 'main',
    selectedModel: model,
    session: created.session,
  });
  assert.deepEqual(preparedToolsEffectiveParams(created.key, createdAuthority), { sessionKey: key });
});

test('unknown, absent, or incompletely prepared sessions cannot reach tools.effective', () => {
  assert.equal(resolvePreparedListedSession({ sessions: [session] }, { models: [model] }, 'agent:main:unknown'), null);
  assert.equal(resolvePreparedListedSession({ sessions: [] }, { models: [model] }, key), null);
  assert.equal(preparedToolsEffectiveParams(key, incompletePreparationAuthority('session-not-listed')), null);
  assert.equal(preparedToolsEffectiveParams('', completePreparationAuthority({
    source: 'sessions-list',
    sessionClass: 'existing-listed',
    agentId: 'main',
    selectedModel: model,
    session,
  })), null);
});

test('public preparation authority cannot disclose raw session keys', async () => {
  const evidence = {
    row: 'PREFLIGHT',
    sessionKey: key,
    created_session_key: key,
    ...completePreparationAuthority({
      source: 'sessions-create',
      sessionClass: 'disposable-unbound',
      agentId: 'main',
      selectedModel: model,
      session,
    }),
  };
  const authority = authorityFromEvidence('PREFLIGHT', evidence);
  assert.equal(authority.preparationComplete, true);
  assert.equal(authority.sessionSource, 'sessions-create');
  assert.equal(JSON.stringify(authority).includes(key), false);

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
    ['agents.list', 'models.list', 'sessions.create', 'sessions.list', 'tools.effective']
      .every((method) => rrc1Manifest.scenario.methods.includes(method)),
    true,
  );
  for (const source of [preflight, rrc1]) {
    assert.match(source, /preparedToolsEffectiveParams\(/);
    assert.match(source, /preparation_complete/);
    assert.match(source, /VERDICT: \$\{verdict\}/);
  }
  assert.match(preflight, /resolvePreparedListedSession\(/);
  assert.match(preflight, /verifyCreatedPreparedSession\(/);
  assert.match(rrc1, /verifyCreatedPreparedSession\(/);
  assert.match(preflight, /row:\s*'PREFLIGHT'/);
  assert.match(rrc1, /classifyRequestCompactionReceipt/);
  assert.match(rrc1, /findRequestCompactionReceipt/);
  assert.match(runner, /record-preparation-authority\.mjs/);
  assert.match(runner, /NO-VERDICT/);
});
