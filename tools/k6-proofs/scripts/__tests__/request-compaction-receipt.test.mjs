import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyRequestCompactionReceipt,
  effectiveToolNames,
  findRequestCompactionReceipt,
  hasEffectiveTool,
  observeRrc2ParentDelegateCall,
  requestCompactionToolCallIdForNonce,
} from '../../lib/request-compaction-receipt.js';

function thresholdReceipt(overrides = {}) {
  return {
    status: 'rejected',
    guard: 'context_threshold',
    contextUsage: 10,
    threshold: 70,
    ...overrides,
  };
}

test('reads request_compaction from the effective tool inventory', () => {
  const payload = {
    groups: [
      { id: 'core', tools: [{ id: 'exec' }, { id: 'request_compaction' }] },
      { id: 'plugins', tools: [{ name: 'message' }] },
    ],
  };
  assert.deepEqual(effectiveToolNames(payload), ['exec', 'request_compaction', 'message']);
  assert.equal(hasEffectiveTool(payload, 'request_compaction'), true);
  assert.equal(hasEffectiveTool(payload, 'continue_work'), false);
});

test('accepts only a structured below-threshold tool result', () => {
  const receipt = {
    status: 'rejected',
    guard: 'context_threshold',
    contextUsage: 3,
    threshold: 70,
    reason: 'below threshold',
  };
  const result = classifyRequestCompactionReceipt({
    message: {
      role: 'toolResult',
      toolName: 'request_compaction',
      toolCallId: 'call-rc1',
      content: [{ type: 'text', text: JSON.stringify(receipt, null, 2) }],
    },
  });
  assert.deepEqual(result, {
    kind: 'threshold_rejected',
    receipt,
    toolCallId: 'call-rc1',
  });
});

test('accepts details-backed structured receipts', () => {
  const receipt = thresholdReceipt();
  assert.equal(classifyRequestCompactionReceipt({
    message: {
      role: 'toolResult',
      toolName: 'request_compaction',
      details: receipt,
      content: [],
    },
  }).kind, 'threshold_rejected');
});

test('keeps the shared R-RC-1 classifier compatible with numeric-less threshold receipts', () => {
  const receipt = { status: 'rejected', guard: 'context_threshold' };
  assert.equal(classifyRequestCompactionReceipt({
    message: {
      role: 'toolResult',
      toolName: 'request_compaction',
      details: receipt,
    },
  }).kind, 'threshold_rejected');
  assert.equal(classifyRequestCompactionReceipt({
    message: {
      role: 'toolResult',
      toolName: 'request_compaction',
      details: receipt,
    },
  }, { requireCanonicalNumericThreshold: true }).kind, 'invalid');
});

test('deduplicates one parent continue_delegate tool call and rejects distinct or mutated calls', () => {
  const args = { task: 'R-RC-2 child', mode: 'normal', delaySeconds: 0 };
  const first = observeRrc2ParentDelegateCall(
    { fingerprints: {} },
    { toolCallId: 'call-one', args },
  );
  assert.deepEqual(
    { count: first.count, keys: first.keys, exact: first.exact, violation: first.violation },
    {
      count: 1,
      keys: ['delaySeconds', 'mode', 'task'],
      exact: true,
      violation: false,
    },
  );

  const duplicate = observeRrc2ParentDelegateCall(first.state, {
    toolCallId: 'call-one',
    args: { ...args },
  });
  assert.equal(duplicate.count, 1);
  assert.equal(duplicate.exact, true);
  assert.equal(duplicate.violation, false);

  const mutated = observeRrc2ParentDelegateCall(duplicate.state, {
    toolCallId: 'call-one',
    args: { ...args, recipientContext: 'invalid' },
  });
  assert.equal(mutated.count, 1);
  assert.equal(mutated.violation, true);

  const second = observeRrc2ParentDelegateCall(duplicate.state, {
    toolCallId: 'call-two',
    args,
  });
  assert.equal(second.count, 2);
  assert.equal(second.violation, true);
});

test('rejects null, non-finite, non-numeric, and non-below-threshold receipts', () => {
  const invalid = [
    thresholdReceipt({ contextUsage: null }),
    thresholdReceipt({ threshold: null }),
    thresholdReceipt({ contextUsage: '10' }),
    thresholdReceipt({ threshold: '70' }),
    thresholdReceipt({ contextUsage: Number.NaN }),
    thresholdReceipt({ contextUsage: Number.POSITIVE_INFINITY }),
    thresholdReceipt({ contextUsage: -1 }),
    thresholdReceipt({ contextUsage: 70 }),
    thresholdReceipt({ threshold: 71 }),
  ];
  for (const receipt of invalid) {
    const result = classifyRequestCompactionReceipt(
      {
        message: {
          role: 'toolResult',
          toolName: 'request_compaction',
          toolCallId: 'call-invalid',
          details: receipt,
        },
      },
      { requireCanonicalNumericThreshold: true },
    );
    assert.equal(result.kind, 'invalid');
  }
});

test('does not accept assistant sentinel prose as a tool receipt', () => {
  assert.deepEqual(classifyRequestCompactionReceipt({
    message: { role: 'assistant', content: [{ type: 'text', text: 'RC1-REJECTED' }] },
  }), { kind: 'unrelated' });
});

test('finds only the receipt bound to the current nonce-bearing tool call', () => {
  const rowNonce = 'R-RC-1-current-nonce';
  const receipt = thresholdReceipt();
  const result = findRequestCompactionReceipt([
    { role: 'user', content: 'invoke it' },
    {
      role: 'assistant',
      content: [{
        type: 'toolCall',
        id: 'call-history',
        name: 'request_compaction',
        arguments: { reason: `proof ${rowNonce}` },
      }],
    },
    {
      role: 'toolResult',
      toolName: 'request_compaction',
      toolCallId: 'call-history',
      content: [{ type: 'text', text: JSON.stringify(receipt) }],
    },
    { role: 'assistant', content: 'RC1-RESULT-OBSERVED' },
  ], { rowNonce });
  assert.deepEqual(result, {
    kind: 'threshold_rejected',
    receipt,
    toolCallId: 'call-history',
    nonceBound: true,
  });
});

test('extracts the current request_compaction tool-call id from its nonce-bearing arguments', () => {
  assert.equal(requestCompactionToolCallIdForNonce([
    {
      role: 'assistant',
      content: [{
        type: 'toolCall',
        id: 'call-current',
        name: 'request_compaction',
        arguments: JSON.stringify({ reason: 'proof R-RC-1-current' }),
      }],
    },
  ], 'R-RC-1-current'), 'call-current');
});

test('rejects a prior valid result when the current nonce has no matching tool call/result', () => {
  const priorReceipt = thresholdReceipt();
  assert.deepEqual(findRequestCompactionReceipt([
    {
      role: 'assistant',
      content: [{
        type: 'toolCall',
        id: 'call-prior',
        name: 'request_compaction',
        arguments: { reason: 'proof R-RC-1-prior' },
      }],
    },
    {
      role: 'toolResult',
      toolName: 'request_compaction',
      toolCallId: 'call-prior',
      content: [{ type: 'text', text: JSON.stringify(priorReceipt) }],
    },
    { role: 'user', content: 'new proof R-RC-1-current' },
    { role: 'assistant', content: 'RC1-RESULT-OBSERVED R-RC-1-current' },
  ], { rowNonce: 'R-RC-1-current' }), { kind: 'missing' });
});

test('ignores a newer unrelated result and returns the result linked to the current call id', () => {
  const receipt = thresholdReceipt();
  const result = findRequestCompactionReceipt([
    {
      role: 'assistant',
      content: [{
        type: 'toolCall',
        id: 'call-current',
        name: 'request_compaction',
        arguments: { reason: 'proof R-RC-1-current' },
      }],
    },
    {
      role: 'toolResult',
      toolName: 'request_compaction',
      toolCallId: 'call-current',
      content: [{ type: 'text', text: JSON.stringify(receipt) }],
    },
    {
      role: 'toolResult',
      toolName: 'request_compaction',
      toolCallId: 'call-stale',
      content: [{ type: 'text', text: JSON.stringify(receipt) }],
    },
  ], { rowNonce: 'R-RC-1-current' });
  assert.equal(result.toolCallId, 'call-current');
  assert.equal(result.nonceBound, true);
});

test('fails closed when the current nonce appears in two distinct request_compaction invocations', () => {
  const rowNonce = 'R-RC-1-current';
  const receipt = thresholdReceipt();
  assert.deepEqual(findRequestCompactionReceipt([
    {
      role: 'assistant',
      content: [{
        type: 'toolCall',
        id: 'call-first',
        name: 'request_compaction',
        arguments: { reason: `proof ${rowNonce}` },
      }],
    },
    {
      role: 'toolResult',
      toolName: 'request_compaction',
      toolCallId: 'call-first',
      content: [{ type: 'text', text: JSON.stringify(receipt) }],
    },
    {
      role: 'assistant',
      content: [{
        type: 'toolCall',
        id: 'call-second',
        name: 'request_compaction',
        arguments: { reason: `retry ${rowNonce}` },
      }],
    },
  ], { rowNonce }), { kind: 'missing' });
});

test('fails closed when a repeated current-nonce invocation has a non-threshold result', () => {
  const rowNonce = 'R-RC-1-current';
  assert.deepEqual(findRequestCompactionReceipt([
    {
      role: 'assistant',
      content: [{
        type: 'toolCall',
        id: 'call-first',
        name: 'request_compaction',
        arguments: { reason: `proof ${rowNonce}` },
      }],
    },
    {
      role: 'toolResult',
      toolName: 'request_compaction',
      toolCallId: 'call-first',
      content: [{ type: 'text', text: JSON.stringify(thresholdReceipt()) }],
    },
    {
      role: 'assistant',
      content: [{
        type: 'toolCall',
        id: 'call-second',
        name: 'request_compaction',
        arguments: { reason: `retry ${rowNonce}` },
      }],
    },
    {
      role: 'toolResult',
      toolName: 'request_compaction',
      toolCallId: 'call-second',
      content: [{ type: 'text', text: JSON.stringify({ status: 'compaction_requested' }) }],
    },
  ], { rowNonce }), { kind: 'missing' });
});

test('accepts duplicate transcript copies of the same current invocation id', () => {
  const rowNonce = 'R-RC-1-current';
  const call = {
    type: 'toolCall',
    id: 'call-current',
    name: 'request_compaction',
    arguments: { reason: `proof ${rowNonce}` },
  };
  const receipt = thresholdReceipt();
  const result = findRequestCompactionReceipt([
    { role: 'assistant', content: [call] },
    { role: 'assistant', content: [{ ...call }] },
    {
      role: 'toolResult',
      toolName: 'request_compaction',
      toolCallId: 'call-current',
      content: [{ type: 'text', text: JSON.stringify(receipt) }],
    },
  ], { rowNonce });
  assert.equal(result.kind, 'threshold_rejected');
  assert.equal(result.toolCallId, 'call-current');
});

test('fails closed on accepted, wrong-guard, and unstructured tool results', () => {
  assert.equal(classifyRequestCompactionReceipt({
    message: {
      role: 'toolResult',
      toolName: 'request_compaction',
      content: [{ type: 'text', text: JSON.stringify({ status: 'compaction_requested' }) }],
    },
  }).kind, 'non_threshold_result');

  assert.equal(classifyRequestCompactionReceipt({
    message: {
      role: 'toolResult',
      toolName: 'request_compaction',
      content: [{ type: 'text', text: JSON.stringify({ status: 'rejected', guard: 'rate_limit' }) }],
    },
  }).kind, 'non_threshold_result');

  assert.equal(classifyRequestCompactionReceipt({
    message: {
      role: 'toolResult',
      toolName: 'request_compaction',
      content: [{ type: 'text', text: 'not-json' }],
    },
  }).kind, 'invalid');
});
