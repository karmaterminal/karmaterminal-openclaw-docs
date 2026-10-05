import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyModelIdentity,
  modelFromSessionMetadata,
  resolveRequestedModel,
} from '../lib/model-identity.mjs';

test('reads provider/model from session metadata', () => {
  assert.equal(modelFromSessionMetadata({ modelProvider: 'openai', model: 'gpt-5.6-sol' }), 'openai/gpt-5.6-sol');
  assert.equal(modelFromSessionMetadata({ model: 'openai/gpt-5.6-sol' }), 'openai/gpt-5.6-sol');
  assert.equal(modelFromSessionMetadata({ modelProvider: 'openai' }), null);
  assert.equal(modelFromSessionMetadata(null), null);
});

test('matching parent and child session models pass', () => {
  const r = classifyModelIdentity({ baseline: 'openai/gpt-5.6-sol', observed: 'openai/gpt-5.6-sol', complete: true });
  assert.equal(r.verdict, 'PASS-candidate');
});

test('negative control: a deliberately wrong expected model fails', () => {
  const r = classifyModelIdentity({
    baseline: 'openai/gpt-5.6-sol',
    observed: 'openai/gpt-5.6-sol',
    expected: 'github-copilot/gpt-5.5',
    complete: true,
  });
  assert.equal(r.verdict, 'FAIL-candidate');
  assert.match(r.reason, /expected model/);
});

test('a child on a different model than the baseline fails', () => {
  const r = classifyModelIdentity({ baseline: 'openai/gpt-5.6-sol', observed: 'openai/gpt-5.6-terra', complete: true });
  assert.equal(r.verdict, 'FAIL-candidate');
});

test('#559 regression: an echoed sentinel with no session metadata can never pass', () => {
  // The old R-CD-MODEL-DEFAULT set both bytes from the constant it told the
  // child to print. Without metadata there is no observed model at all.
  const r = classifyModelIdentity({ baseline: 'github-copilot/gpt-5.5', observed: null, complete: true });
  assert.equal(r.verdict, 'PARTIAL-candidate');
  assert.equal(r.modelMatches, false);
});

test('missing baseline is partial, not pass', () => {
  assert.equal(classifyModelIdentity({ baseline: null, observed: 'openai/gpt-5.6-sol', complete: true }).verdict, 'PARTIAL-candidate');
});

test('matched identity with missing non-identity receipts stays partial', () => {
  const r = classifyModelIdentity({ baseline: 'openai/gpt-5.6-sol', observed: 'openai/gpt-5.6-sol', complete: false });
  assert.equal(r.verdict, 'PARTIAL-candidate');
  assert.equal(r.modelMatches, true);
});

test('override model has no built-in default', () => {
  const r = resolveRequestedModel(undefined, '', null);
  assert.equal(r.model, null);
  assert.match(r.refusal, /no override model configured/);
});

test('#559 regression: a bare alias such as "gpt" is refused before dispatch', () => {
  const r = resolveRequestedModel('gpt');
  assert.equal(r.model, null);
  assert.match(r.refusal, /not a provider\/model/);
});

test('first non-empty candidate wins and is normalized', () => {
  assert.deepEqual(resolveRequestedModel('', 'openai/gpt-5.6-terra.'), { model: 'openai/gpt-5.6-terra', refusal: null });
});
