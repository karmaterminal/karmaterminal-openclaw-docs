// R-RC-2 measured-wake receipts (#562 review). Shapes follow openclaw 41b8d69b90:
//   request_compaction payloads: src/agents/tools/request-compaction-tool.ts:211-229, 338-348
//   jsonResult: content text is JSON.stringify(payload, null, 2) (tool-results.ts:10-11)
//   toolResult message: packages/agent-core/src/agent-loop.ts:1443-1465
//   chat.history drops `details` (chat-display-projection.sanitize.ts:441-460), so
//   these fixtures carry no details and the receipt is parsed from content text.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  continueWorkYieldForNonce,
  measuredRequestCompactionOutcome,
} from '../lib/request-compaction-receipt.js';

const NONCE = 'R-RC-2-1791234567890-rrrrcccc';

function toolCall(id, name, args) {
  return { role: 'assistant', content: [{ type: 'toolCall', id, name, arguments: args }], provider: 'openai', model: 'gpt-5.6-sol', stopReason: 'toolUse' };
}
function toolResult(id, name, payload) {
  return { role: 'toolResult', toolCallId: id, toolName: name, content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }], isError: false, timestamp: 3 };
}
function say(text) { return { role: 'assistant', content: [{ type: 'text', text }], stopReason: 'stop' }; }
const spawnTask = { role: 'user', content: [{ type: 'text', text: `[Subagent Task]\n\nRRC2:1791234567890-rr R-RC-2 child nonce ${NONCE}.` }] };

const MEASURED_REJECTION = {
  status: 'rejected',
  guard: 'context_threshold',
  contextUsage: 12,
  threshold: 70,
  reason: 'Context usage (12%) is below the minimum threshold (70%). Compaction is not needed yet.',
};
const UNKNOWN_REJECTION = {
  status: 'rejected',
  guard: 'context_threshold',
  reason: 'Context usage is unknown for this session; request_compaction is unavailable on inventory-only paths.',
};

function measuredWake(resultPayload) {
  return [
    spawnTask,
    say(`RRC2-CHILD-READY ${NONCE}`),
    toolCall('cw-1', 'continue_work', { delaySeconds: 5, reason: `R-RC-2 measured wake nonce ${NONCE}` }),
    toolResult('cw-1', 'continue_work', { status: 'scheduled' }),
    { role: 'user', content: '[continuation wake]' },
    toolCall('rc-1', 'request_compaction', { reason: `R-RC-2 delegated request_compaction nonce ${NONCE}` }),
    toolResult('rc-1', 'request_compaction', resultPayload),
    say(`REQUEST_COMPACTION_REJECTED_CONTEXT_THRESHOLD ${NONCE} CONTEXT 12 THRESHOLD 70`),
  ];
}

test('measured wake: a measured below-threshold rejection after the yield is the HONEST-LIMIT receipt', () => {
  const outcome = measuredRequestCompactionOutcome(measuredWake(MEASURED_REJECTION), { rowNonce: NONCE });
  assert.equal(outcome.kind, 'threshold_rejected_measured');
  assert.equal(outcome.measured, true);
  assert.equal(outcome.yieldBound, true);
  assert.equal(outcome.nonceBound, true);
  assert.equal(outcome.receipt.contextUsage, 12);
  assert.equal(outcome.receipt.threshold, 70);
});

test('first-turn read: the unknown branch is context_unknown, never a threshold receipt', () => {
  const firstTurn = [
    spawnTask,
    toolCall('rc-1', 'request_compaction', { reason: `R-RC-2 delegated request_compaction nonce ${NONCE}` }),
    toolResult('rc-1', 'request_compaction', UNKNOWN_REJECTION),
  ];
  const outcome = measuredRequestCompactionOutcome(firstTurn, { rowNonce: NONCE });
  assert.equal(outcome.kind, 'context_unknown');
  assert.equal(outcome.measured, false);
  assert.equal(outcome.yieldBound, false);
  // Even after a yield, an unknown answer stays unknown.
  assert.equal(measuredRequestCompactionOutcome(measuredWake(UNKNOWN_REJECTION), { rowNonce: NONCE }).kind, 'context_unknown');
});

test('a request_compaction call before the continue_work yield is not yield-bound', () => {
  const reversed = [
    spawnTask,
    toolCall('rc-1', 'request_compaction', { reason: `R-RC-2 delegated request_compaction nonce ${NONCE}` }),
    toolResult('rc-1', 'request_compaction', MEASURED_REJECTION),
    toolCall('cw-1', 'continue_work', { reason: `R-RC-2 measured wake nonce ${NONCE}` }),
  ];
  const outcome = measuredRequestCompactionOutcome(reversed, { rowNonce: NONCE });
  assert.equal(outcome.kind, 'threshold_rejected_measured');
  assert.equal(outcome.yieldBound, false);
});

test('a yield for another row nonce does not bind', () => {
  const messages = measuredWake(MEASURED_REJECTION);
  messages[2] = toolCall('cw-1', 'continue_work', { reason: 'R-RC-2 measured wake nonce R-RC-2-other' });
  assert.equal(continueWorkYieldForNonce(messages, NONCE), null);
  assert.equal(measuredRequestCompactionOutcome(messages, { rowNonce: NONCE }).yieldBound, false);
});

test('accepted compaction reports status compaction_requested and is recognised', () => {
  const outcome = measuredRequestCompactionOutcome(measuredWake({
    status: 'compaction_requested',
    compactionRequestId: 'diag-1',
    trigger: 'volitional',
    contextUsage: 82,
    reason: `R-RC-2 delegated request_compaction nonce ${NONCE}`,
    note: 'Compaction will run after this turn.',
  }), { rowNonce: NONCE });
  assert.equal(outcome.kind, 'accepted');
  assert.equal(outcome.yieldBound, true);
});

test('a measured usage at or above threshold with a rejection is invalid, not HONEST-LIMIT', () => {
  const outcome = measuredRequestCompactionOutcome(measuredWake({ ...MEASURED_REJECTION, contextUsage: 75 }), { rowNonce: NONCE });
  assert.equal(outcome.kind, 'invalid');
});
