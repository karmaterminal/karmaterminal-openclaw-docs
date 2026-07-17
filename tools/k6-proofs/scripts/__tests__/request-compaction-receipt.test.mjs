import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyRequestCompactionReceipt,
  effectiveToolNames,
  findRequestCompactionReceipt,
  hasEffectiveTool,
} from '../../lib/request-compaction-receipt.js';

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
  const receipt = { status: 'rejected', guard: 'context_threshold', threshold: 70 };
  assert.equal(classifyRequestCompactionReceipt({
    message: {
      role: 'toolResult',
      toolName: 'request_compaction',
      details: receipt,
      content: [],
    },
  }).kind, 'threshold_rejected');
});

test('does not accept assistant sentinel prose as a tool receipt', () => {
  assert.deepEqual(classifyRequestCompactionReceipt({
    message: { role: 'assistant', content: [{ type: 'text', text: 'RC1-REJECTED' }] },
  }), { kind: 'unrelated' });
});

test('finds the authoritative receipt in a sessions.get transcript', () => {
  const receipt = { status: 'rejected', guard: 'context_threshold' };
  const result = findRequestCompactionReceipt([
    { role: 'user', content: 'invoke it' },
    { role: 'assistant', content: [{ type: 'toolCall', name: 'request_compaction' }] },
    {
      role: 'toolResult',
      toolName: 'request_compaction',
      toolCallId: 'call-history',
      content: [{ type: 'text', text: JSON.stringify(receipt) }],
    },
    { role: 'assistant', content: 'RC1-RESULT-OBSERVED' },
  ]);
  assert.deepEqual(result, {
    kind: 'threshold_rejected',
    receipt,
    toolCallId: 'call-history',
  });
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
