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
function wake(reason) {
  return { role: 'user', content: [{ type: 'text', text: `[continuation:wake] Turn 2/200. The agent elected to continue working. Prior reason: ${JSON.stringify(reason)} [provenance] Chain: c hop 2/200` }] };
}
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
    say('yielding'),
    // The wake turn body (work-dispatch-execution.ts:197-215) quotes the prior reason.
    wake(`R-RC-2 measured wake nonce ${NONCE}`),
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

// --- #563 review item 6 -----------------------------------------------------

test('item 6: yield and request_compaction in the same turn (no wake turn) is not yield-bound', () => {
  const sameTurn = [
    spawnTask,
    say(`RRC2-CHILD-READY ${NONCE}`),
    toolCall('cw-1', 'continue_work', { delaySeconds: 5, reason: `R-RC-2 measured wake nonce ${NONCE}` }),
    toolResult('cw-1', 'continue_work', { status: 'scheduled' }),
    toolCall('rc-1', 'request_compaction', { reason: `R-RC-2 delegated request_compaction nonce ${NONCE}` }),
    toolResult('rc-1', 'request_compaction', MEASURED_REJECTION),
  ];
  const outcome = measuredRequestCompactionOutcome(sameTurn, { rowNonce: NONCE });
  assert.equal(outcome.yieldCallObserved, true);
  assert.equal(outcome.wakeTurnBound, false);
  assert.equal(outcome.yieldBound, false);
});

test('item 6: a wake turn for another nonce, or one after the request, does not bind', () => {
  const otherWake = measuredWake(MEASURED_REJECTION);
  otherWake[5] = wake('R-RC-2 measured wake nonce R-RC-2-other');
  assert.equal(measuredRequestCompactionOutcome(otherWake, { rowNonce: NONCE }).wakeTurnBound, false);
  const late = [
    spawnTask,
    toolCall('cw-1', 'continue_work', { reason: `R-RC-2 measured wake nonce ${NONCE}` }),
    toolCall('rc-1', 'request_compaction', { reason: `R-RC-2 delegated request_compaction nonce ${NONCE}` }),
    toolResult('rc-1', 'request_compaction', MEASURED_REJECTION),
    wake(`R-RC-2 measured wake nonce ${NONCE}`),
  ];
  assert.equal(measuredRequestCompactionOutcome(late, { rowNonce: NONCE }).wakeTurnBound, false);
});

test('item 6: contextUsage without threshold (or the reverse) is invalid, not context_unknown', () => {
  const { threshold, ...noThreshold } = MEASURED_REJECTION;
  assert.equal(measuredRequestCompactionOutcome(measuredWake(noThreshold), { rowNonce: NONCE }).kind, 'invalid');
  const { contextUsage, ...noUsage } = MEASURED_REJECTION;
  assert.equal(measuredRequestCompactionOutcome(measuredWake(noUsage), { rowNonce: NONCE }).kind, 'invalid');
  assert.equal(measuredRequestCompactionOutcome(measuredWake(UNKNOWN_REJECTION), { rowNonce: NONCE }).kind, 'context_unknown');
});

// --- #563 review items 1 and 4: one classifier, fail closed ------------------

import { classifyRrc2Evidence } from '../lib/request-compaction-receipt.js';

const CLEAN = {
  row: 'R-RC-2',
  preflight: { ok: true, missing: [], reason: null },
  observation_refused: null,
  observation_incomplete: null,
  child_identity_conflict: false,
  parent_dispatch_accepted: true,
  delegate_requested: true,
  child_session_observed: true,
  delegate_child_report_observed: true,
  request_compaction_tool_result_observed: true,
  request_compaction_receipt_role: 'toolResult',
  request_compaction_receipt_tool_name: 'request_compaction',
  request_compaction_invocation_bound: true,
  child_yield_bound: true,
  child_wake_turn_bound: true,
};

test('items 1/4: classifyRrc2Evidence uses the product status strings', () => {
  assert.equal(classifyRrc2Evidence({ ...CLEAN, child_reported_context_threshold: true, request_compaction_receipt_status: 'rejected', request_compaction_rejected_context_threshold: true, request_compaction_context_measured: true, guard: 'context_threshold' }).verdict, 'HONEST-LIMIT-candidate');
  assert.equal(classifyRrc2Evidence({ ...CLEAN, post_compaction_path_observed: true, request_compaction_receipt_status: 'compaction_requested', request_compaction_accepted: true }).verdict, 'PASS-candidate');
  assert.equal(classifyRrc2Evidence({ ...CLEAN, post_compaction_path_observed: true, request_compaction_receipt_status: 'accepted', request_compaction_accepted: true }).verdict, 'PARTIAL-candidate');
});

test('item 4: R-RC-2 never ends FAIL from an observer error', () => {
  const nothing = { row: 'R-RC-2', preflight: { ok: true }, parent_dispatch_accepted: true, delegate_requested: true };
  assert.equal(classifyRrc2Evidence(nothing).verdict, 'FAIL-candidate', 'a clean observation with no outcome is FAIL');
  const broken = { ...nothing, observation_incomplete: { method: 'sessions.list', code: 'UNAVAILABLE', message: 'busy' } };
  const r = classifyRrc2Evidence(broken);
  assert.equal(r.verdict, 'PARTIAL-candidate');
  assert.match(r.reason, /observation incomplete: sessions\.list UNAVAILABLE busy/);
});

// --- child report read from the child's own transcript ----------------------
// The delivered return is hidden from the parent's projections at 41b8d69b90
// (chat-display-projection.history.ts:329-334). Re-run on emeric 2026-10-05:
// measured receipt present, row PARTIAL on delegate_child_report_observed:false.
import { childReportAfterReceipt, classifyRrc2Evidence as classifyForReport } from '../lib/request-compaction-receipt.js';

test('child report: the sentinel after the bound toolResult in the same wake turn is the report', () => {
  const r = childReportAfterReceipt(measuredWake(MEASURED_REJECTION), { rowNonce: NONCE });
  assert.equal(r.kind, 'threshold');
  assert.equal(r.usage, 12);
  assert.equal(r.threshold, 70);
});

test('child report: a sentinel before the toolResult does not count', () => {
  const msgs = measuredWake(MEASURED_REJECTION);
  const report = msgs.pop();
  msgs.splice(msgs.length - 1, 0, report); // sentinel now precedes the toolResult
  assert.equal(childReportAfterReceipt(msgs, { rowNonce: NONCE }).kind, null);
});

test('child report: a sentinel in a later turn (after a user message) does not count', () => {
  const msgs = measuredWake(MEASURED_REJECTION);
  const report = msgs.pop();
  msgs.push({ role: 'user', content: [{ type: 'text', text: 'later turn' }] }, report);
  assert.equal(childReportAfterReceipt(msgs, { rowNonce: NONCE }).kind, null);
});

test('child report: another nonce, or the spawn task text, does not count', () => {
  assert.equal(childReportAfterReceipt(measuredWake(MEASURED_REJECTION), { rowNonce: 'R-RC-2-other' }).kind, null);
  const msgs = measuredWake(MEASURED_REJECTION).slice(0, -1);
  msgs[0] = { role: 'user', content: [{ type: 'text', text: `[Subagent Task] reply exactly REQUEST_COMPACTION_REJECTED_CONTEXT_THRESHOLD ${NONCE} CONTEXT 1 THRESHOLD 70` }] };
  assert.equal(childReportAfterReceipt(msgs, { rowNonce: NONCE }).kind, null);
});

test('child report: the measured receipt plus the child-transcript report reaches HONEST-LIMIT', () => {
  const msgs = measuredWake(MEASURED_REJECTION);
  const outcome = measuredRequestCompactionOutcome(msgs, { rowNonce: NONCE });
  const report = childReportAfterReceipt(msgs, { rowNonce: NONCE });
  const evidence = {
    row: 'R-RC-2', preflight: { ok: true }, parent_dispatch_accepted: true, delegate_requested: true,
    child_session_observed: true, request_compaction_tool_result_observed: true,
    request_compaction_receipt_role: 'toolResult', request_compaction_receipt_tool_name: 'request_compaction',
    request_compaction_invocation_bound: outcome.nonceBound, child_yield_bound: outcome.yieldBound,
    child_wake_turn_bound: outcome.wakeTurnBound, request_compaction_receipt_status: 'rejected',
    request_compaction_rejected_context_threshold: outcome.kind === 'threshold_rejected_measured',
    request_compaction_context_measured: outcome.measured, guard: 'context_threshold',
    delegate_child_report_observed: report.kind === 'threshold', child_reported_context_threshold: report.kind === 'threshold',
  };
  assert.equal(classifyForReport(evidence).verdict, 'HONEST-LIMIT-candidate');
  assert.equal(classifyForReport({ ...evidence, delegate_child_report_observed: false, child_reported_context_threshold: false }).verdict, 'PARTIAL-candidate', 'the live re-run state: receipt but no visible report');
});
