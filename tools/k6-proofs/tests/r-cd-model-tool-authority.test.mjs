import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createModelToolDispatchGate,
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
  // Adversarial: paraphrased schedule acknowledgement must NOT prove return.
  assert.equal(
    parentReturnContainsNonce([
      { role: 'assistant', content: 'Scheduled delegate for nonce-x; waiting for completion.' },
    ], 'nonce-x'),
    false,
  );
  // Loose MODEL-TOOL-CHILD mention without exact MODEL byte is not authority.
  assert.equal(
    parentReturnContainsNonce([
      { role: 'assistant', content: 'saw MODEL-TOOL-CHILD for nonce-x earlier' },
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
      { role: 'assistant', content: 'Child finished: MODEL-TOOL-CHILD nonce-x MODEL openai/gpt-5.6-luna' },
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

test('delayed pre-baseline still dispatches exactly once and never before baseline', () => {
  const gate = createModelToolDispatchGate();
  // Simulate the old fixed +800ms gap elapsing while pre sessions.list is still
  // in flight: no dispatch may occur before baseline capture.
  assert.deepEqual(gate.getState(), {
    baselineCaptured: false,
    dispatched: false,
    failedClosed: false,
    dispatchCount: 0,
  });

  // Baseline arrives late (e.g. RPC took >500ms). Dispatch arms exactly once.
  assert.deepEqual(gate.onPreBaselineCaptured(), { action: 'dispatch' });
  assert.equal(gate.getState().dispatchCount, 1);
  assert.equal(gate.getState().dispatched, true);
  assert.equal(gate.getState().baselineCaptured, true);

  // Duplicate/late baseline responses must not re-dispatch.
  assert.deepEqual(gate.onPreBaselineCaptured(), {
    action: 'noop',
    reason: 'already-dispatched',
  });
  assert.equal(gate.getState().dispatchCount, 1);

  // Watchdog after a successful baseline is a no-op (preserve post polls).
  assert.deepEqual(gate.onBaselineWatchdog(), {
    action: 'noop',
    reason: 'baseline-already-handled',
  });
  assert.equal(gate.getState().failedClosed, false);
  assert.equal(gate.getState().dispatchCount, 1);
});

test('baseline watchdog fail-closes when pre list never arrives; late baseline cannot dispatch', () => {
  const gate = createModelToolDispatchGate();
  assert.deepEqual(gate.onBaselineWatchdog(), { action: 'fail-closed' });
  assert.equal(gate.getState().failedClosed, true);
  assert.equal(gate.getState().dispatched, false);
  // A baseline that arrives after the watchdog must not resurrect dispatch.
  assert.deepEqual(gate.onPreBaselineCaptured(), {
    action: 'noop',
    reason: 'already-failed-closed',
  });
  assert.equal(gate.getState().dispatchCount, 0);
});

test('scenario requires disposable parent, spawnedBy filter, and baseline-gated dispatch', async () => {
  const { readFile } = await import('node:fs/promises');
  const scenario = await readFile(new URL('../scenarios/r-cd-model-tool.js', import.meta.url), 'utf8');
  assert.match(scenario, /OPENCLAW_CREATE_DISPOSABLE_SESSION=true is required/);
  assert.match(scenario, /sessions\.list',\s*\{\s*spawnedBy:\s*sessionKey,\s*limit:\s*100\s*\}/);
  assert.match(scenario, /pre_spawned_by_keys/);
  assert.match(scenario, /post_spawned_by_keys/);
  assert.match(scenario, /auxiliary child runtime-context self-report \(not used for equality\)/);
  assert.match(scenario, /sessions\.get/);
  assert.match(scenario, /createModelToolDispatchGate/);
  assert.match(scenario, /onPreBaselineCaptured/);
  assert.match(scenario, /dispatchModelToolTurn/);
  assert.match(scenario, /onBaselineWatchdog/);
  // Fixed +800ms sole dispatch timer must not remain (latency-dependent drop).
  assert.doesNotMatch(scenario, /setTimeout\(\s*\(\)\s*=>\s*\{[^}]*pre_spawned_by_captured[^}]*sessions\.send[\s\S]*?\},\s*800\s*\)/);
  assert.doesNotMatch(scenario, /production DB|sqlite|better-sqlite/i);
});
