import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activeFallbackFromSessionMetadata,
  classifyModelIdentity,
  modelFromSessionMetadata,
  resolveRequestedModel,
  servedModelFromMessage,
  servedReceiptFromHistory,
} from '../lib/model-identity.mjs';

test('reads provider/model from session metadata', () => {
  assert.equal(modelFromSessionMetadata({ modelProvider: 'openai', model: 'gpt-5.6-sol' }), 'openai/gpt-5.6-sol');
  assert.equal(modelFromSessionMetadata({ model: 'openai/gpt-5.6-sol' }), 'openai/gpt-5.6-sol');
  assert.equal(modelFromSessionMetadata({ modelProvider: 'openai' }), null);
  assert.equal(modelFromSessionMetadata(null), null);
});

test('#562 review: a matching selection alone is PARTIAL, served route unproven', () => {
  // Before the review this was a PASS: sessions.describe model/modelProvider is
  // the persisted selection, which a child row carries before dispatch.
  const r = classifyModelIdentity({ baseline: 'openai/gpt-5.6-sol', observed: 'openai/gpt-5.6-sol', complete: true });
  assert.equal(r.verdict, 'PARTIAL-candidate');
  assert.equal(r.reason, 'selection matched; served route unproven');
  assert.equal(r.selectionMatches, true);
  assert.equal(r.modelMatches, false);
});

test('a served receipt equal to the baseline, with the selection agreeing, passes', () => {
  const r = classifyModelIdentity({ baseline: 'openai/gpt-5.6-sol', selected: 'openai/gpt-5.6-sol', served: 'openai/gpt-5.6-sol', complete: true });
  assert.equal(r.verdict, 'PASS-candidate');
  assert.equal(r.modelMatches, true);
  assert.equal(r.selectionMatches, true);
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
  const r = classifyModelIdentity({ baseline: 'openai/gpt-5.6-sol', observed: 'openai/gpt-5.6-sol', served: 'openai/gpt-5.6-sol', complete: false });
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

// --- #561 / #562 review: selected vs served -------------------------------

const SOL = 'openai/gpt-5.6-sol';
const TERRA = 'openai/gpt-5.6-terra';

test('selection matches but the served model differs: FAIL', () => {
  const r = classifyModelIdentity({ baseline: SOL, selected: SOL, served: TERRA, complete: true });
  assert.equal(r.verdict, 'FAIL-candidate');
  assert.match(r.reason, /served model openai\/gpt-5\.6-terra does not match baseline openai\/gpt-5\.6-sol/);
  assert.equal(r.selectionMatches, true);
});

test('selection only, no served receipt: PARTIAL', () => {
  const r = classifyModelIdentity({ baseline: SOL, selected: SOL, served: null, complete: true });
  assert.equal(r.verdict, 'PARTIAL-candidate');
  assert.equal(r.reason, 'selection matched; served route unproven');
});

test('active fallback to another model: FAIL even with a matching selection', () => {
  const r = classifyModelIdentity({ baseline: SOL, selected: SOL, served: null, activeFallback: TERRA, complete: true });
  assert.equal(r.verdict, 'FAIL-candidate');
  assert.match(r.reason, /active fallback/);
});

test('a run window that served more than one model: FAIL', () => {
  const r = classifyModelIdentity({ baseline: SOL, selected: SOL, served: SOL, servedConflict: true, complete: true });
  assert.equal(r.verdict, 'FAIL-candidate');
});

test('served matches but the persisted selection differs: PASS with the selection recorded', () => {
  const r = classifyModelIdentity({ baseline: SOL, selected: TERRA, served: SOL, complete: true });
  assert.equal(r.verdict, 'PASS-candidate');
  assert.equal(r.selectionMatches, false);
});

test('no served receipt and a different selection: FAIL on the selection', () => {
  const r = classifyModelIdentity({ baseline: SOL, selected: TERRA, served: null, complete: true });
  assert.equal(r.verdict, 'FAIL-candidate');
});

test('MODEL-DEFAULT: a missing parent served baseline is PARTIAL, never PASS on selection', () => {
  const r = classifyModelIdentity({ baseline: null, selected: SOL, served: SOL, complete: true });
  assert.equal(r.verdict, 'PARTIAL-candidate');
  assert.equal(r.reason, 'no authoritative baseline model');
});

test('activeFallbackFromSessionMetadata reads activeModel* only when it differs', () => {
  assert.equal(activeFallbackFromSessionMetadata({ modelProvider: 'openai', model: 'gpt-5.6-sol' }), null);
  assert.equal(activeFallbackFromSessionMetadata({ modelProvider: 'openai', model: 'gpt-5.6-sol', activeModelProvider: 'openai', activeModel: 'gpt-5.6-sol' }), null);
  assert.equal(activeFallbackFromSessionMetadata({ modelProvider: 'openai', model: 'gpt-5.6-sol', activeModelProvider: 'anthropic', activeModel: 'claude-x' }), 'anthropic/claude-x');
});

test('servedModelFromMessage: provider/model, responseModel reroute, dated snapshot', () => {
  assert.equal(servedModelFromMessage({ role: 'assistant', provider: 'openai', model: 'gpt-5.6-sol' }), SOL);
  assert.equal(servedModelFromMessage({ role: 'assistant', provider: 'openai', model: 'gpt-5.6-sol', responseModel: 'gpt-5.6-sol-2026-08-01' }), SOL);
  assert.equal(servedModelFromMessage({ role: 'assistant', provider: 'anthropic', model: 'claude-a', responseModel: 'claude-b' }), 'anthropic/claude-b');
  assert.equal(servedModelFromMessage({ role: 'assistant', model: 'gpt-5.6-sol' }), null, 'no provider, no byte-comparable model');
  assert.equal(servedModelFromMessage({ role: 'user', provider: 'openai', model: 'gpt-5.6-sol' }), null);
});

// Transcript shapes: packages/llm-core/src/types.ts:390-420 (AssistantMessage).
const NONCE = 'R-CD-MODEL-TOOL-1791234567890-mmmmnnnn';
const TOKEN = 'MTOOL:1791234567890-mmmmnnnn'.slice(0, 22);
function user(text) { return { role: 'user', content: [{ type: 'text', text }], timestamp: 1 }; }
function assistant(text, provider, model, extra = {}) {
  return { role: 'assistant', content: [{ type: 'text', text }], api: 'openai-responses', provider, model, stopReason: 'stop', timestamp: 2, ...extra };
}

test('served receipt: bound to the sentinel message after the row anchor', () => {
  const messages = [
    user(`[Subagent Task]\n\n${TOKEN} Proof nonce ${NONCE}: reply exactly MODEL-TOOL-CHILD ${NONCE} MODEL <provider/model>`),
    assistant(`MODEL-TOOL-CHILD ${NONCE} MODEL openai/gpt-5.6-sol`, 'openai', 'gpt-5.6-sol'),
  ];
  const r = servedReceiptFromHistory(messages, { anchor: TOKEN, sentinel: `MODEL-TOOL-CHILD ${NONCE}` });
  assert.equal(r.served, SOL);
  assert.equal(r.stopReason, 'stop');
  assert.equal(r.conflict, false);
  assert.equal(r.messageIndex, 1);
});

test('served receipt: a matching-model message outside the run window is ignored', () => {
  const messages = [
    // Earlier: before the row anchor, same session, matching model and even the sentinel text.
    assistant(`MODEL-TOOL-CHILD ${NONCE} MODEL openai/gpt-5.6-terra`, 'openai', 'gpt-5.6-terra'),
    user(`[Subagent Task]\n\n${TOKEN} Proof nonce ${NONCE}: reply exactly MODEL-TOOL-CHILD ${NONCE}`),
    assistant('working on it', 'openai', 'gpt-5.6-terra'),
  ];
  // The only sentinel-bearing assistant message precedes the anchor: no receipt.
  const before = servedReceiptFromHistory(messages, { anchor: TOKEN, sentinel: `MODEL-TOOL-CHILD ${NONCE}` });
  assert.equal(before.served, null);
  assert.match(before.reason, /no assistant message after the anchor carries the row sentinel/);

  const later = [
    user(`[Subagent Task]\n\n${TOKEN} Proof nonce ${NONCE}: reply exactly MODEL-TOOL-CHILD ${NONCE}`),
    assistant(`MODEL-TOOL-CHILD ${NONCE} MODEL x`, 'openai', 'gpt-5.6-sol'),
    // Later message on the same session served another model: outside the window.
    assistant(`MODEL-TOOL-CHILD ${NONCE} again`, 'openai', 'gpt-5.6-terra'),
  ];
  const r = servedReceiptFromHistory(later, { anchor: TOKEN, sentinel: `MODEL-TOOL-CHILD ${NONCE}` });
  assert.equal(r.served, SOL);
  assert.equal(r.conflict, false);
  assert.deepEqual(r.servedModels, [SOL]);
});

test('served receipt: no anchor means no window, so the row stays selection-only PARTIAL', () => {
  const r = servedReceiptFromHistory([assistant(`MODEL-TOOL-CHILD ${NONCE}`, 'openai', 'gpt-5.6-sol')], { anchor: TOKEN, sentinel: `MODEL-TOOL-CHILD ${NONCE}` });
  assert.equal(r.served, null);
  const verdict = classifyModelIdentity({ baseline: SOL, selected: SOL, served: r.served, complete: true });
  assert.equal(verdict.reason, 'selection matched; served route unproven');
});

test('served receipt: a fallback inside the window is a conflict; an errored sentinel turn is no receipt', () => {
  const window = [
    user(`${TOKEN} task`),
    assistant('partial answer', 'anthropic', 'claude-fallback'),
    assistant(`MODEL-TOOL-CHILD ${NONCE}`, 'openai', 'gpt-5.6-sol'),
  ];
  const conflict = servedReceiptFromHistory(window, { anchor: TOKEN, sentinel: `MODEL-TOOL-CHILD ${NONCE}` });
  assert.equal(conflict.conflict, true);
  assert.equal(classifyModelIdentity({ baseline: SOL, selected: SOL, served: conflict.served, servedConflict: conflict.conflict, complete: true }).verdict, 'FAIL-candidate');

  const errored = servedReceiptFromHistory([
    user(`${TOKEN} task`),
    assistant(`MODEL-TOOL-CHILD ${NONCE}`, 'openai', 'gpt-5.6-sol', { stopReason: 'error', errorMessage: 'provider 500' }),
  ], { anchor: TOKEN, sentinel: `MODEL-TOOL-CHILD ${NONCE}` });
  assert.equal(errored.served, null);
  assert.equal(errored.errorMessage, 'provider 500');
});
