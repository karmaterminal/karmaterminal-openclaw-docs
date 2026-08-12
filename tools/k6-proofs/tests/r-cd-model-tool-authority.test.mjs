import test from 'node:test';
import assert from 'node:assert/strict';
import {
  diffSpawnedByChildren,
  modelFromSessionMetadata,
  parentReturnContainsNonce,
  resolveModelToolChildAuthority,
  sessionKeysFromListPayload,
} from '../lib/r-cd-model-tool-authority.mjs';

const parent = 'agent:main:r-cd-model-tool-parent';
const childA = 'agent:main:subagent:child-a';
const childB = 'agent:main:subagent:child-b';

test('spawnedBy set-diff requires exactly one new child', () => {
  assert.deepEqual(diffSpawnedByChildren([], [childA]), {
    preCount: 0,
    postCount: 1,
    added: [childA],
    removed: [],
    uniqueNewChildKey: childA,
    ambiguous: false,
    empty: false,
  });
  assert.equal(diffSpawnedByChildren([], []).empty, true);
  assert.equal(diffSpawnedByChildren([], [childA, childB]).ambiguous, true);
  assert.equal(diffSpawnedByChildren([childA], [childA]).empty, true);
});

test('model authority reads provider/model from the unique new child row only', () => {
  const payload = {
    sessions: [
      { key: childA, modelProvider: 'openai', model: 'gpt-5.6-luna' },
      { key: childB, modelProvider: 'openai', model: 'gpt-5.5' },
    ],
  };
  const ok = resolveModelToolChildAuthority({
    preKeys: [],
    postKeys: sessionKeysFromListPayload(payload),
    sessionsPayload: payload,
    requestedModel: 'openai/gpt-5.6-luna',
  });
  assert.equal(ok.uniqueNewChildKey, null); // two added
  assert.equal(ok.failureCategory, 'multiple-new-children');

  const single = resolveModelToolChildAuthority({
    preKeys: [],
    postKeys: [childA],
    sessionsPayload: payload,
    requestedModel: 'openai/gpt-5.6-luna',
  });
  assert.equal(single.childSessionKey, childA);
  assert.equal(single.childMetadataModelByte, 'openai/gpt-5.6-luna');
  assert.equal(single.modelMatches, true);
  assert.equal(single.failureCategory, null);
});

test('zero new children and model mismatch fail closed', () => {
  const zero = resolveModelToolChildAuthority({
    preKeys: [childA],
    postKeys: [childA],
    sessionsPayload: { sessions: [{ key: childA, model: 'openai/gpt-5.6-luna' }] },
    requestedModel: 'openai/gpt-5.6-luna',
  });
  assert.equal(zero.failureCategory, 'zero-new-children');

  const mismatch = resolveModelToolChildAuthority({
    preKeys: [],
    postKeys: [childA],
    sessionsPayload: { sessions: [{ key: childA, provider: 'openai', model: 'gpt-5.5' }] },
    requestedModel: 'openai/gpt-5.6-luna',
  });
  assert.equal(mismatch.modelMatches, false);
  assert.equal(mismatch.failureCategory, 'model-mismatch');
});

test('child self-report cannot establish equality; parent schedule ack is not return', () => {
  assert.equal(modelFromSessionMetadata({ model: 'gpt-5.6-luna', provider: 'openai' }), 'openai/gpt-5.6-luna');
  // Parent schedule ack alone is NOT child→parent return authority.
  assert.equal(
    parentReturnContainsNonce([
      { role: 'user', content: '[k6-proof-harness] ignore MODEL-TOOL nonce-x' },
      { role: 'assistant', content: 'MODEL-TOOL-PARENT-SCHEDULED nonce-x REQUESTED openai/gpt-5.6-luna' },
    ], 'nonce-x'),
    false,
  );
  // Child return marker in parent history IS a return receipt (auxiliary model text).
  assert.equal(
    parentReturnContainsNonce([
      { role: 'system', content: 'MODEL-TOOL-CHILD nonce-x MODEL openai/gpt-5.6-luna' },
    ], 'nonce-x'),
    true,
  );
  assert.equal(
    parentReturnContainsNonce([
      { role: 'assistant', content: 'unrelated' },
    ], 'nonce-x'),
    false,
  );
  // Harness prompt alone is not a return.
  assert.equal(
    parentReturnContainsNonce([
      { role: 'user', content: '[k6-proof-harness] nonce-x' },
    ], 'nonce-x'),
    false,
  );
});

test('scenario requires disposable parent and spawnedBy list filter', async () => {
  const { readFile } = await import('node:fs/promises');
  const scenario = await readFile(new URL('../scenarios/r-cd-model-tool.js', import.meta.url), 'utf8');
  assert.match(scenario, /OPENCLAW_CREATE_DISPOSABLE_SESSION=true is required/);
  assert.match(scenario, /sessions\.list',\s*\{\s*spawnedBy:\s*sessionKey,\s*limit:\s*100\s*\}/);
  assert.match(scenario, /pre_spawned_by_keys/);
  assert.match(scenario, /post_spawned_by_keys/);
  assert.match(scenario, /auxiliary child runtime-context self-report \(not used for equality\)/);
  assert.match(scenario, /sessions\.get/);
  assert.doesNotMatch(scenario, /production DB|sqlite|better-sqlite/i);
});
