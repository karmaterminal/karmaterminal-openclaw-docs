import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findRcd2Session,
  isRcd2OpenclawRuntime,
  rcd2ModelRef,
  resolveRcd2ExecutionRuntime,
  selectRcd2ExecutionModel,
  verifyRcd2ListedSession,
  verifyRcd2SessionCreateResponse,
} from '../../lib/r-cd-2-runtime-selection.js';

const unresolvedModels = [
  { provider: 'anthropic', id: 'missing-runtime', available: true },
  {
    provider: 'google',
    id: 'auto-runtime',
    available: true,
    agentRuntime: { id: 'auto', source: 'model' },
  },
  {
    provider: 'openai',
    id: 'default-runtime',
    available: true,
    agentRuntime: { id: 'default', source: 'model' },
  },
];

const builtInModels = [
  {
    provider: 'xai',
    id: 'explicit-openclaw',
    available: true,
    agentRuntime: { id: 'openclaw', source: 'provider' },
  },
  {
    provider: 'openai',
    id: 'another-openclaw',
    available: true,
    agentRuntime: { id: 'openclaw', source: 'model' },
  },
];

test('R-CD-2 requires explicit OpenClaw runtime metadata with a source', () => {
  for (const model of unresolvedModels) {
    assert.equal(isRcd2OpenclawRuntime(model), false);
  }
  assert.equal(isRcd2OpenclawRuntime({
    provider: 'xai',
    id: 'missing-source',
    available: true,
    agentRuntime: { id: 'openclaw' },
  }), false);
  assert.deepEqual(resolveRcd2ExecutionRuntime(builtInModels[0]), {
    id: 'openclaw',
    source: 'provider',
    builtIn: true,
  });
});

test('R-CD-2 rejects concrete plugin-owned runtimes and unavailable models', () => {
  const models = [
    {
      provider: 'openai',
      id: 'plugin-runtime',
      available: true,
      agentRuntime: { id: 'codex', source: 'model' },
    },
    {
      provider: 'anthropic',
      id: 'unavailable',
      available: false,
    },
  ];
  assert.equal(isRcd2OpenclawRuntime(models[0]), false);
  assert.equal(selectRcd2ExecutionModel(models), null);
  assert.equal(
    selectRcd2ExecutionModel([...models, ...builtInModels], {
      requestedModel: 'openai/plugin-runtime',
    }),
    null,
  );
});

test('R-CD-2 selects a deterministic available explicit model or the requested built-in model', () => {
  assert.equal(rcd2ModelRef(selectRcd2ExecutionModel(builtInModels)), 'openai/another-openclaw');
  assert.equal(
    rcd2ModelRef(selectRcd2ExecutionModel(builtInModels, {
      requestedModel: 'xai/explicit-openclaw',
    })),
    'xai/explicit-openclaw',
  );
  assert.equal(selectRcd2ExecutionModel(unresolvedModels), null);
});

test('R-CD-2 proves a new session only after create response and sessions.list model verification', () => {
  const selected = builtInModels[0];
  const key = 'agent:main:r-cd-2-proof-key';
  assert.equal(findRcd2Session([], key), null);
  assert.equal(
    verifyRcd2SessionCreateResponse({
      key,
      sessionId: 'session-new',
      entry: { sessionId: 'session-new' },
      resolved: { modelProvider: selected.provider, model: selected.id },
    }, key, selected),
    true,
  );
  assert.equal(
    verifyRcd2SessionCreateResponse({
      key,
      sessionId: 'session-new',
      entry: { sessionId: 'session-other' },
      resolved: { modelProvider: selected.provider, model: selected.id },
    }, key, selected),
    false,
  );
  assert.equal(
    verifyRcd2SessionCreateResponse({
      key: 'agent:main:other',
      sessionId: 'session-new',
      entry: { sessionId: 'session-new' },
      resolved: { modelProvider: selected.provider, model: selected.id },
    }, key, selected),
    false,
  );
  const listed = {
    key,
    sessionId: 'session-new',
    modelProvider: selected.provider,
    model: selected.id,
    agentRuntime: selected.agentRuntime,
  };
  assert.equal(verifyRcd2ListedSession(listed, key, 'session-new', selected), true);
  assert.equal(
    verifyRcd2ListedSession({ ...listed, channelId: 'bound' }, key, 'session-new', selected),
    false,
  );
  assert.equal(
    verifyRcd2ListedSession({ ...listed, model: 'other' }, key, 'session-new', selected),
    false,
  );
  assert.equal(
    verifyRcd2ListedSession({ ...listed, sessionId: 'session-other' }, key, 'session-new', selected),
    false,
  );
  assert.equal(
    verifyRcd2ListedSession({ ...listed, agentRuntime: undefined }, key, 'session-new', selected),
    false,
  );
  assert.equal(
    verifyRcd2ListedSession({
      ...listed,
      agentRuntime: { id: 'openclaw', source: 'model' },
    }, key, 'session-new', selected),
    false,
  );
});
