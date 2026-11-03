// Wake-turn answers through heartbeat_respond (#567). Shapes follow openclaw
// cut 41b8d69b90:
//   toolCall part      packages/llm-core/src/types.ts:304-313
//   toolResult message packages/llm-core/src/types.ts:424-432
//   heartbeat_respond  src/agents/tools/heartbeat-response-tool.ts:21-37 (args), :78-105 (result:
//                      textResult(JSON.stringify({status:"accepted", ...}, null, 2), details))
//   chat.history       keeps toolCall arguments and toolResult content text, deletes details
//                      (chat-display-projection.sanitize.ts:185-186, 220-235, 431-463)
//   __openclaw.runId   session-tool-result-guard.ts:311
// The live R-CD-4 transcript tail (issue #567) is: assistant TARGET-READY,
// assistant toolCall heartbeat_respond, toolResult {"status":"accepted",...,
// "notificationText":"TARGET-ACK <nonce>"}.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { rCd4HistoryObservation, rCd4ReturnReceipt } from '../lib/r-cd-4-authority.mjs';
import {
  createHeartbeatAckTracker,
  heartbeatAckFromHistory,
  hasExactSentinelText,
} from '../lib/wake-turn-receipt.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NONCE = 'R-CD-4-1791171553558-vqnp40d7';
const TARGET = 'agent:main:r-cd-4-target-r-cd-4-1791171553558-vqnp40d7';
const PARENT = 'agent:main:r-cd-4-parent-r-cd-4-1791171553558-vqnp40d7';
const CHILD = 'agent:main:subagent:rcd4-child';

function meta(runId) { return { __openclaw: { runId } }; }
function assistantText(text, runId) {
  return { role: 'assistant', content: [{ type: 'text', text }], provider: 'openai', model: 'gpt-5.6-sol', stopReason: 'stop', ...meta(runId) };
}
function heartbeatCall(id, args, runId) {
  return {
    role: 'assistant',
    content: [{ type: 'toolCall', id, name: 'heartbeat_respond', arguments: args }],
    provider: 'openai', model: 'gpt-5.6-sol', stopReason: 'toolUse', ...meta(runId),
  };
}
function heartbeatResult(id, payload, runId, extra = {}) {
  return {
    role: 'toolResult',
    toolCallId: id,
    toolName: 'heartbeat_respond',
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    isError: false,
    timestamp: 1791171560000,
    ...meta(runId),
    ...extra,
  };
}
const ACK_ARGS = {
  outcome: 'done',
  notify: true,
  summary: 'Delegated proof target completed successfully.',
  notificationText: `TARGET-ACK ${NONCE}`,
};
const ACK_RESULT = { status: 'accepted', ...ACK_ARGS };

// The live tail: priming reply (run-prime), then the woken heartbeat turn (run-wake).
function liveTargetTail() {
  return [
    { role: 'user', content: `[k6-proof-harness] R-CD-4 target priming nonce ${NONCE}. Reply exactly TARGET-READY ${NONCE} now.`, ...meta('run-prime') },
    assistantText(`TARGET-READY ${NONCE}`, 'run-prime'),
    heartbeatCall('call-hb-1', ACK_ARGS, 'run-wake'),
    heartbeatResult('call-hb-1', ACK_RESULT, 'run-wake'),
  ];
}

function historyObservation(messages, sessionKey = TARGET) {
  return rCd4HistoryObservation({
    messages, sessionKey, targetSessionKey: TARGET, parentSessionKey: PARENT, nonce: NONCE, elapsedMs: 30_000, wakeGateMs: 5_000,
  });
}

// --- R-CD-4 history path ------------------------------------------------------

test('R-CD-4: the live heartbeat_respond tail is a bound target ack (red before #567)', () => {
  const observation = historyObservation(liveTargetTail());
  assert.ok(observation.targetCandidate, 'heartbeat_respond ack in the woken target turn counts');
  assert.equal(observation.targetCandidate.source, 'heartbeat_respond');
  assert.equal(observation.targetCandidate.sessionKey, TARGET);
  assert.equal(observation.targetCandidate.toolCallId, 'call-hb-1');
  assert.equal(observation.targetCandidate.field, 'notificationText');
  assert.equal(observation.targetCandidate.runId, 'run-wake');
  assert.equal(observation.parentCandidate, null);
  assert.notEqual(rCd4ReturnReceipt(observation.targetCandidate, CHILD), null);
});

test('R-CD-4: the assistant-text ack path still works unchanged', () => {
  const messages = [
    assistantText(`TARGET-READY ${NONCE}`, 'run-prime'),
    assistantText(`TARGET-ACK ${NONCE}`, 'run-wake'),
  ];
  const observation = historyObservation(messages);
  assert.equal(observation.targetCandidate.role, 'assistant');
  assert.equal(observation.targetCandidate.source, undefined);
});

test('negative: a heartbeat_respond ack in the parent session is a parent landing, never a target ack', () => {
  const messages = [heartbeatCall('call-p', ACK_ARGS, 'run-p'), heartbeatResult('call-p', ACK_RESULT, 'run-p')];
  const observation = historyObservation(messages, PARENT);
  assert.equal(observation.targetCandidate, null);
  assert.equal(observation.parentCandidate.source, 'heartbeat_respond');
  // Another session entirely binds nothing.
  const other = historyObservation(liveTargetTail(), 'agent:main:someone-else');
  assert.equal(other.targetCandidate, null);
  assert.equal(other.parentCandidate, null);
});

test('negative: without the row nonce, or with another nonce, nothing binds', () => {
  for (const notificationText of ['TARGET-ACK', `TARGET-ACK ${NONCE}-older`, 'TARGET-ACK R-CD-4-older-run', `please ack ${NONCE}`]) {
    const tail = liveTargetTail();
    tail[2] = heartbeatCall('call-hb-1', { ...ACK_ARGS, notificationText }, 'run-wake');
    tail[3] = heartbeatResult('call-hb-1', { ...ACK_RESULT, notificationText }, 'run-wake');
    assert.equal(historyObservation(tail).targetCandidate, null, notificationText);
  }
});

test('negative: outside the woken turn (before priming, or in the priming run) nothing binds', () => {
  const before = [
    heartbeatCall('call-early', ACK_ARGS, 'run-early'),
    heartbeatResult('call-early', ACK_RESULT, 'run-early'),
    assistantText(`TARGET-READY ${NONCE}`, 'run-prime'),
  ];
  assert.equal(historyObservation(before).targetCandidate, null, 'an ack before the priming reply is outside the window');
  const samePrimingRun = [
    assistantText(`TARGET-READY ${NONCE}`, 'run-prime'),
    heartbeatCall('call-same', ACK_ARGS, 'run-prime'),
    heartbeatResult('call-same', ACK_RESULT, 'run-prime'),
  ];
  assert.equal(historyObservation(samePrimingRun).targetCandidate, null, 'the priming run is not the woken turn');
  const noPriming = [heartbeatCall('call-x', ACK_ARGS, 'run-wake'), heartbeatResult('call-x', ACK_RESULT, 'run-wake')];
  assert.equal(historyObservation(noPriming).targetCandidate, null, 'no priming reply, no window');
});

test('negative: an unaccepted, errored, unmatched or cross-run result does not bind', () => {
  const variants = {
    'error result': (t) => { t[3] = heartbeatResult('call-hb-1', ACK_RESULT, 'run-wake', { isError: true }); },
    'status not accepted': (t) => { t[3] = heartbeatResult('call-hb-1', { ...ACK_RESULT, status: 'rejected' }, 'run-wake'); },
    'result for another call': (t) => { t[3] = heartbeatResult('call-other', ACK_RESULT, 'run-wake'); },
    'result in another run': (t) => { t[3] = heartbeatResult('call-hb-1', ACK_RESULT, 'run-other'); },
    'call without the sentinel': (t) => { t[2] = heartbeatCall('call-hb-1', { ...ACK_ARGS, notificationText: 'done' }, 'run-wake'); },
    'result without the sentinel': (t) => { t[3] = heartbeatResult('call-hb-1', { ...ACK_RESULT, notificationText: 'done', summary: 'done' }, 'run-wake'); },
    'no result at all': (t) => { t.pop(); },
  };
  for (const [name, mutate] of Object.entries(variants)) {
    const tail = liveTargetTail();
    mutate(tail);
    assert.equal(historyObservation(tail).targetCandidate, null, name);
  }
});

test('negative: the sentinel nested in prompt text, or another tool, never counts', () => {
  const nested = liveTargetTail().slice(0, 2).concat([
    { role: 'user', content: `[k6-proof-harness] reply TARGET-ACK ${NONCE}`, ...meta('run-wake') },
    { role: 'assistant', content: [{ type: 'toolCall', id: 'c-msg', name: 'message', arguments: { text: `TARGET-ACK ${NONCE}` } }], ...meta('run-wake') },
    { role: 'toolResult', toolCallId: 'c-msg', toolName: 'message', content: [{ type: 'text', text: JSON.stringify({ status: 'accepted', notificationText: `TARGET-ACK ${NONCE}` }) }], ...meta('run-wake') },
  ]);
  assert.equal(historyObservation(nested).targetCandidate, null);
  assert.equal(hasExactSentinelText(`[k6-proof-harness] TARGET-ACK ${NONCE}`, 'TARGET-ACK', NONCE), false);
});

test('the result is read from content text (chat.history drops details) or from details on raw rows', () => {
  const tail = liveTargetTail();
  tail[3] = { ...heartbeatResult('call-hb-1', ACK_RESULT, 'run-wake'), content: [] , details: ACK_RESULT };
  assert.ok(historyObservation(tail).targetCandidate, 'details path (raw transcript)');
  const summaryOnly = liveTargetTail();
  const args = { ...ACK_ARGS, notificationText: undefined, summary: `TARGET-ACK ${NONCE}` };
  summaryOnly[2] = heartbeatCall('call-hb-1', args, 'run-wake');
  summaryOnly[3] = heartbeatResult('call-hb-1', { status: 'accepted', ...args }, 'run-wake');
  assert.equal(historyObservation(summaryOnly).targetCandidate.field, 'summary');
});

// --- event path -------------------------------------------------------------

function messageEvent(sessionKey, message, extra = {}) {
  return { sessionKey, message, messageId: `m-${Math.random().toString(36).slice(2)}`, messageSeq: 7, ...extra };
}

test('event path: call then accepted result in the target, window open, binds', () => {
  const tracker = createHeartbeatAckTracker({ sessionKey: TARGET, marker: 'TARGET-ACK', nonce: NONCE });
  const [, , call, result] = liveTargetTail();
  assert.equal(tracker.observe(messageEvent(TARGET, call), { windowOpen: true, excludeRunIds: ['run-prime'] }), null);
  const receipt = tracker.observe(messageEvent(TARGET, result), { windowOpen: true, excludeRunIds: ['run-prime'] });
  assert.equal(receipt.source, 'heartbeat_respond');
  assert.equal(receipt.runId, 'run-wake');
});

test('event path negatives: window closed, priming run, another session, mixed session keys', () => {
  const [, , call, result] = liveTargetTail();
  const closed = createHeartbeatAckTracker({ sessionKey: TARGET, marker: 'TARGET-ACK', nonce: NONCE });
  closed.observe(messageEvent(TARGET, call), { windowOpen: false });
  assert.equal(closed.observe(messageEvent(TARGET, result), { windowOpen: true }), null, 'a call seen before the window opened never binds');

  const priming = createHeartbeatAckTracker({ sessionKey: TARGET, marker: 'TARGET-ACK', nonce: NONCE });
  priming.observe(messageEvent(TARGET, call), { windowOpen: true, excludeRunIds: ['run-wake'] });
  assert.equal(priming.observe(messageEvent(TARGET, result), { windowOpen: true }), null);

  const other = createHeartbeatAckTracker({ sessionKey: TARGET, marker: 'TARGET-ACK', nonce: NONCE });
  other.observe(messageEvent(PARENT, call), { windowOpen: true });
  assert.equal(other.observe(messageEvent(PARENT, result), { windowOpen: true }), null);

  const mixed = createHeartbeatAckTracker({ sessionKey: TARGET, marker: 'TARGET-ACK', nonce: NONCE });
  mixed.observe(messageEvent(TARGET, call, { session: PARENT }), { windowOpen: true });
  assert.equal(mixed.observe(messageEvent(TARGET, result), { windowOpen: true }), null);
});

test('scenario wiring: R-CD-4 and CHAINED-DEPTH-2 feed both receipt paths', () => {
  const rcd4 = readFileSync(path.join(root, 'scenarios', 'r-cd-4-target-session-key.js'), 'utf8');
  assert.match(rcd4, /createHeartbeatAckTracker\(\{ sessionKey: targetSessionKey, marker: 'TARGET-ACK', nonce: rowNonce \}\)/);
  assert.match(rcd4, /windowOpen: evidence\.target_primed && evidence\.tool_accepted/);
  assert.match(rcd4, /excludeRunIds: \[evidence\.target_priming_run_id\]/);
  assert.match(rcd4, /createHeartbeatAckTracker\(\{ sessionKey, marker: 'TARGET-ACK', nonce: rowNonce \}\)/);
  const chain = readFileSync(path.join(root, 'scenarios', 'r-cd-chained-depth-2.js'), 'utf8');
  assert.match(chain, /createHeartbeatAckTracker\(\{ sessionKey, marker: 'ROOT-CHAIN-ACK', nonce: chainNonce \}\)/);
  assert.match(chain, /excludeRunIds: \[evidence\.dispatch_run_id\]/);
});

test('CHAINED-DEPTH-2: a root heartbeat ack outside the dispatch run binds; inside it does not', () => {
  const chainNonce = 'R-CD-CHAIN-1791171553558-qqqqwwww';
  const rootKey = 'agent:main:r-cd-chain-root';
  const args = { outcome: 'done', notify: false, summary: 'chain consumed', notificationText: `ROOT-CHAIN-ACK ${chainNonce}` };
  const ok = createHeartbeatAckTracker({ sessionKey: rootKey, marker: 'ROOT-CHAIN-ACK', nonce: chainNonce });
  ok.observe(messageEvent(rootKey, heartbeatCall('c1', args, 'run-wake')), { windowOpen: true, excludeRunIds: ['run-dispatch'] });
  assert.ok(ok.observe(messageEvent(rootKey, heartbeatResult('c1', { status: 'accepted', ...args }, 'run-wake')), { windowOpen: true }));
  const inDispatch = createHeartbeatAckTracker({ sessionKey: rootKey, marker: 'ROOT-CHAIN-ACK', nonce: chainNonce });
  inDispatch.observe(messageEvent(rootKey, heartbeatCall('c1', args, 'run-dispatch')), { windowOpen: true, excludeRunIds: ['run-dispatch'] });
  assert.equal(inDispatch.observe(messageEvent(rootKey, heartbeatResult('c1', { status: 'accepted', ...args }, 'run-dispatch')), { windowOpen: true }), null);
});

test('heartbeatAckFromHistory requireRunId refuses rows without a run', () => {
  const rows = [heartbeatCall('c', ACK_ARGS), heartbeatResult('c', ACK_RESULT)];
  for (const row of rows) delete row.__openclaw;
  assert.ok(heartbeatAckFromHistory(rows, { sessionKey: TARGET, marker: 'TARGET-ACK', nonce: NONCE }));
  assert.equal(heartbeatAckFromHistory(rows, { sessionKey: TARGET, marker: 'TARGET-ACK', nonce: NONCE, requireRunId: true }), null);
});
