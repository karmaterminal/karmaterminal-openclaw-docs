// Receipts bound through Tool Search's dispatcher (karmaterminal/openclaw-bootstrap#1727,
// harness review F1 sibling paths and N1).
//
// At openclaw f15237ec92, with Tool Search on, a typed call is persisted as
// { type: "toolCall", name: "dispatch_action", arguments: { id: "<tool>", args } }
// (src/agents/tool-catalog.ts:29; tool-display-call.ts:5-24 unwraps it for
// display only) and its toolResult row takes the raw name dispatch_action
// (src/agents/session-tool-result-guard.ts:482-486). The review tests cover the
// false PASS (a typed call missed by the token-form checks). These cover the
// other side of the same name-only matching: every positive receipt failed
// closed on a Tool Search seat. They import only modules that predate the fix,
// so they run unchanged against the pre-fix tree as its negative control.
import test from 'node:test';
import assert from 'node:assert/strict';
import { continueWorkChain, tokenWorkHops } from '../lib/continue-work-chain.mjs';
import { cwDelegateSelfHops } from '../lib/cw-delegate-self-receipt.mjs';
import { createSameRunDelegateTracker } from '../lib/r-cd-2-same-run-delegate.mjs';
import { findRequestCompactionReceipt, measuredRequestCompactionOutcome } from '../lib/request-compaction-receipt.js';
import { boundToolCalls, createToolReceiptTracker, toolReceiptsFromHistory } from '../lib/sentinel-binding.mjs';
import { createHeartbeatAckTracker, heartbeatAckFromHistory } from '../lib/wake-turn-receipt.mjs';

const N = 'R-CD-1-1793326378000-abcd1234';
const user = (text) => ({ role: 'user', content: [{ type: 'text', text }] });
const say = (text, runId) => ({ role: 'assistant', content: [{ type: 'text', text }], ...(runId ? { __openclaw: { runId } } : {}) });
/** A Tool Search call: dispatch_action with the tool in arguments.id. */
const dispatched = (id, tool, args, { name = 'dispatch_action', runId = null } = {}) => ({
  role: 'assistant',
  content: [{ type: 'toolCall', id, name, arguments: { id: tool, args } }],
  ...(runId ? { __openclaw: { runId } } : {}),
});
/** Its toolResult row, named after the dispatcher. */
const dispatchedResult = (id, payload, { runId = null, isError = false } = {}) => ({
  role: 'toolResult',
  toolCallId: id,
  toolName: 'dispatch_action',
  isError,
  content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
  ...(runId ? { __openclaw: { runId } } : {}),
});

test('a continue_delegate call made through dispatch_action is that call, with its inner args', () => {
  const calls = boundToolCalls(dispatched('cd-1', 'continue_delegate', { task: `k6 ${N}`, mode: 'silent' }), { toolName: 'continue_delegate', argField: 'task', needle: N });
  assert.deepEqual(calls, [{ id: 'cd-1', args: { task: `k6 ${N}`, mode: 'silent' } }]);
});

test('the catalog id form (openclaw:core:<tool>) and the shipped tool_call name both resolve to the tool', () => {
  const byCatalogId = boundToolCalls(dispatched('a', 'openclaw:core:continue_delegate', { task: N }), { toolName: 'continue_delegate', argField: 'task', needle: N });
  const byShippedName = boundToolCalls(dispatched('b', 'continue_delegate', { task: N }, { name: 'tool_call' }), { toolName: 'continue_delegate', argField: 'task', needle: N });
  assert.equal(byCatalogId.length, 1);
  assert.equal(byShippedName.length, 1);
});

test('a dispatcher call for another tool, or with no id, is never the named tool', () => {
  const other = dispatched('a', 'sessions_spawn', { task: N });
  const noId = { role: 'assistant', content: [{ type: 'toolCall', id: 'b', name: 'dispatch_action', arguments: { args: { task: N } } }] };
  assert.deepEqual(boundToolCalls(other, { toolName: 'continue_delegate', argField: 'task', needle: N }), []);
  assert.deepEqual(boundToolCalls(noId, { toolName: 'continue_delegate', argField: 'task', needle: N }), []);
  // The nonce in the outer arguments (not the tool's args) binds nothing.
  const outer = { role: 'assistant', content: [{ type: 'toolCall', id: 'c', name: 'dispatch_action', arguments: { id: 'continue_delegate', task: N, args: {} } }] };
  assert.deepEqual(boundToolCalls(outer, { toolName: 'continue_delegate', argField: 'task', needle: N }), []);
});

test('R-CD-1/SILENT/3 scheduled receipt: a dispatch_action call pairs with its dispatch_action result', () => {
  const rows = [
    user(`[k6-proof-harness] ${N}`),
    dispatched('cd-1', 'continue_delegate', { task: `k6 ${N}`, delaySeconds: 1 }, { runId: 'run-d' }),
    dispatchedResult('cd-1', { status: 'scheduled', mode: 'normal' }, { runId: 'run-d' }),
  ];
  const [receipt] = toolReceiptsFromHistory(rows, { toolName: 'continue_delegate', argField: 'task', needle: N });
  assert.equal(receipt?.status, 'scheduled');
  assert.equal(receipt?.runId, 'run-d');
  assert.equal(receipt?.args?.task, `k6 ${N}`);
  const tracker = createToolReceiptTracker({ sessionKey: 'agent:main:p', toolName: 'continue_delegate', argField: 'task', needle: N });
  assert.equal(tracker.observe('session.message', { sessionKey: 'agent:main:p', message: rows[1] }), null);
  assert.equal(tracker.observe('session.message', { sessionKey: 'agent:main:p', message: rows[2] })?.status, 'scheduled');
});

test('R-CD-2 same-run delegate: a dispatch_action continue_delegate on the send run reports scheduled', () => {
  const tracker = createSameRunDelegateTracker({ acceptedRunId: 'run-s', nonce: N });
  assert.equal(tracker.observe({ sessionKey: 'k', message: dispatched('cd-1', 'continue_delegate', { task: `k6 ${N}`, mode: 'silent-wake' }, { runId: 'run-s' }) }), null);
  assert.equal(tracker.observe({ sessionKey: 'k', message: dispatchedResult('cd-1', { status: 'scheduled' }, { runId: 'run-s' }) }), 'scheduled');
});

test('R-CW-1..4: a continue_work chain scheduled through dispatch_action binds by turn order', () => {
  const chain = continueWorkChain([
    user(`[k6-proof-harness] ${N}`),
    dispatched('cw-1', 'continue_work', { reason: `k6 ${N}`, delaySeconds: 5 }),
    dispatchedResult('cw-1', { status: 'scheduled', delaySeconds: 5 }),
    say(`CW-SCHEDULED ${N}`),
    user(`[continuation:wake] Turn 1/200. Prior reason: "k6 ${N}"`),
    say(`CW-WOKE ${N}`),
  ], { nonce: N, scheduledMarkers: ['CW-SCHEDULED'], doneMarker: 'CW-WOKE' });
  assert.equal(chain.complete, true, chain.reason);
});

test('R-CW-TOKEN: a typed continue_work through dispatch_action marks the child typed (never the token form)', () => {
  const hops = tokenWorkHops([
    user(`[Subagent Task] k6 proof R-CW-TOKEN nonce ${N}.`),
    dispatched('cw-1', 'continue_work', { delaySeconds: 5, reason: 'hop 2' }, { runId: 'run-c1' }),
    dispatchedResult('cw-1', { status: 'scheduled' }, { runId: 'run-c1' }),
    say(`TOKEN-HOP1 ${N}`, 'run-c1'),
    user('[continuation:wake] Turn 1/200.'),
    { ...say(`TOKEN-HOP2-DONE ${N} TOKEN q1w2e3r4t5y6`, 'run-c2'), timestamp: 20 },
  ], { nonce: N, hop1Marker: 'TOKEN-HOP1', hop2Marker: 'TOKEN-HOP2-DONE' });
  assert.equal(hops.typedToolUsed, true);
  assert.equal(hops.complete, false);
});

test('R-CW-DELEGATE-SELF: the child continue_work yield and its scheduled result bind through dispatch_action', () => {
  const hops = cwDelegateSelfHops([
    user(`[Subagent Task] ${N}`),
    dispatched('cw-1', 'continue_work', { reason: `child hop 2 ${N}`, delaySeconds: 5 }),
    dispatchedResult('cw-1', { status: 'scheduled', delaySeconds: 5 }),
    say(`CHILD-CW-SCHEDULED ${N}`),
    user(`[continuation:wake] Turn 1/200. Prior reason: "child hop 2 ${N}"`),
    say(`CHILD-HOP2-DONE ${N}`),
  ], { rowNonce: N });
  assert.equal(hops.childContinueWorkAccepted, true, hops.reason);
  assert.equal(hops.childHop2Woke, true, hops.reason);
});

test('R-RC-1/2: a request_compaction result named dispatch_action binds only to its own call id', () => {
  const rows = [
    user(`[Subagent Task] ${N}`),
    dispatched('rc-1', 'request_compaction', { reason: `k6 ${N}` }),
    dispatchedResult('rc-1', { status: 'rejected', guard: 'context_threshold', contextUsage: 12, threshold: 70, reason: 'below' }),
  ];
  const found = findRequestCompactionReceipt(rows, { rowNonce: N });
  assert.equal(found.kind, 'threshold_rejected');
  assert.equal(found.toolCallId, 'rc-1');
  // A dispatcher-named result for a different call is never this receipt.
  const stray = [rows[0], rows[1], dispatchedResult('other', { status: 'compaction_requested', contextUsage: 80 })];
  assert.equal(findRequestCompactionReceipt(stray, { rowNonce: N }).kind, 'missing');
  // The measured R-RC-2 outcome reads the same pairing.
  const yieldRows = [
    user(`[Subagent Task] ${N}`),
    dispatched('cw-1', 'continue_work', { reason: `yield ${N}` }),
    dispatchedResult('cw-1', { status: 'scheduled' }),
    user(`[continuation:wake] Turn 1/200. Prior reason: "yield ${N}"`),
    dispatched('rc-1', 'request_compaction', { reason: `k6 ${N}` }),
    dispatchedResult('rc-1', { status: 'rejected', guard: 'context_threshold', contextUsage: 12, threshold: 70, reason: 'below' }),
  ];
  const outcome = measuredRequestCompactionOutcome(yieldRows, { rowNonce: N });
  assert.equal(outcome.kind, 'threshold_rejected_measured');
  assert.equal(outcome.yieldBound, true);
});

test('heartbeat_respond acknowledgements bind through dispatch_action, call and result paired by id', () => {
  const args = { outcome: 'done', notify: false, summary: `TARGET-ACK ${N}` };
  const rows = [
    say(`TARGET-READY ${N}`, 'run-prime'),
    dispatched('hb-1', 'heartbeat_respond', args, { runId: 'run-wake' }),
    dispatchedResult('hb-1', { status: 'accepted', ...args }, { runId: 'run-wake' }),
  ];
  const receipt = heartbeatAckFromHistory(rows, { sessionKey: 'agent:main:t', marker: 'TARGET-ACK', nonce: N, afterIndex: 0, excludeRunIds: ['run-prime'] });
  assert.equal(receipt?.toolCallId, 'hb-1');
  const tracker = createHeartbeatAckTracker({ sessionKey: 'agent:main:t', marker: 'TARGET-ACK', nonce: N });
  tracker.observe({ sessionKey: 'agent:main:t', message: rows[1] }, { windowOpen: true, excludeRunIds: ['run-prime'] });
  assert.equal(tracker.observe({ sessionKey: 'agent:main:t', message: rows[2] }, { windowOpen: true, excludeRunIds: ['run-prime'] })?.toolCallId, 'hb-1');
});
