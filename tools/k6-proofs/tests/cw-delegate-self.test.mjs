// R-CW-DELEGATE-SELF-CONTINUATION hop receipts from the child's own transcript.
// Shapes at openclaw cut 41b8d69b90:
//   spawn task         first user message "[Subagent Task]\n\n<task>" (subagent-system-prompt.ts:23-36)
//   continue_work      toolResult {"status":"scheduled","delaySeconds":N} (continue-work-tool.ts:86-95),
//                      content text kept, details dropped by chat.history (sanitize.ts:431-463)
//   work wake          user "[continuation:wake] Turn 2/200. ... Prior reason: "<reason>" [provenance] ..."
//                      (work-dispatch-execution.ts:197-215; a normal turn, :364-388)
// Live trap (frond-scribe): the child agent:main:subagent:continuation-... had
// spawnedBy = parent, status done, and a hop-2 work-wake, but the row read the
// parent stream only and ended PARTIAL.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { cwDelegateSelfHops } from '../lib/cw-delegate-self-receipt.mjs';
import { ROW_METHODS } from '../lib/child-observer.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NONCE = 'R-CW-DS-1791200000000-k3j9x2ab';
const REASON = `k6-self-continuation-${NONCE}`;

function text(role, t, extra = {}) { return { role, content: [{ type: 'text', text: t }], ...extra }; }
function call(id, name, args) {
  return { role: 'assistant', content: [{ type: 'toolCall', id, name, arguments: args }], stopReason: 'toolUse' };
}
function result(id, name, payload, extra = {}) {
  return { role: 'toolResult', toolCallId: id, toolName: name, content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }], isError: false, ...extra };
}
function wake(reason) {
  return text('user', `[continuation:wake] Turn 2/200. The agent elected to continue working. Prior reason: ${JSON.stringify(reason)} [provenance] Chain: c hop 2/200`);
}

function liveChild() {
  return [
    text('user', `[Subagent Context] You are running as a subagent.\n\n[Subagent Task]\n\n[continuation:chain-hop:1] Delegated task (turn 1/200): k6 proof R-CW-DELEGATE-SELF nonce ${NONCE}: after arriving, call continue_work(reason="${REASON}", delaySeconds=2).`),
    call('cw-1', 'continue_work', { reason: REASON, delaySeconds: 2 }),
    result('cw-1', 'continue_work', { status: 'scheduled', delaySeconds: 2 }),
    text('assistant', `CHILD-CW-SCHEDULED ${NONCE}`, { stopReason: 'stop' }),
    wake(REASON),
    text('assistant', `CHILD-HOP2-DONE ${NONCE}`, { stopReason: 'stop' }),
  ];
}

test('the live child transcript binds both hops, in order', () => {
  const hops = cwDelegateSelfHops(liveChild(), { rowNonce: NONCE });
  assert.equal(hops.childContinueWorkAccepted, true);
  assert.equal(hops.childHop2Woke, true);
  assert.deepEqual([hops.yieldIndex, hops.scheduledResultIndex, hops.scheduledSentinelIndex, hops.wakeIndex, hops.hop2Index], [1, 2, 3, 4, 5]);
  assert.equal(hops.reason, null);
});

test('negative: CHILD-CW-SCHEDULED only in the wake turn is not a turn-1 receipt', () => {
  const t = liveChild();
  t.splice(3, 1); // drop the turn-1 sentinel
  t.push(text('assistant', `CHILD-CW-SCHEDULED ${NONCE}`));
  const hops = cwDelegateSelfHops(t, { rowNonce: NONCE });
  assert.equal(hops.childContinueWorkAccepted, false);
  assert.equal(hops.childHop2Woke, false);
});

test('negative: CHILD-HOP2-DONE without a wake turn (same turn as the yield) does not count', () => {
  const t = liveChild();
  t.splice(4, 1); // no [continuation:wake] user turn
  const hops = cwDelegateSelfHops(t, { rowNonce: NONCE });
  assert.equal(hops.childContinueWorkAccepted, true);
  assert.equal(hops.childHop2Woke, false);
  assert.match(hops.reason, /no nonce-bound \[continuation:wake\] turn/);
});

test('negative: a wake for another nonce, or HOP2-DONE after a later user turn, does not count', () => {
  const other = liveChild();
  other[4] = wake('k6-self-continuation-R-CW-DS-other');
  assert.equal(cwDelegateSelfHops(other, { rowNonce: NONCE }).childHop2Woke, false);
  const later = liveChild();
  later.splice(5, 0, text('user', 'unrelated later message'));
  assert.equal(cwDelegateSelfHops(later, { rowNonce: NONCE }).childHop2Woke, false);
});

test('negative: continue_work not scheduled, errored, missing or called twice', () => {
  const notScheduled = liveChild();
  notScheduled[2] = result('cw-1', 'continue_work', { status: 'rejected' });
  assert.equal(cwDelegateSelfHops(notScheduled, { rowNonce: NONCE }).childContinueWorkAccepted, false);
  const errored = liveChild();
  errored[2] = result('cw-1', 'continue_work', { status: 'scheduled' }, { isError: true });
  assert.equal(cwDelegateSelfHops(errored, { rowNonce: NONCE }).childContinueWorkAccepted, false);
  const missing = liveChild();
  missing.splice(2, 1);
  assert.equal(cwDelegateSelfHops(missing, { rowNonce: NONCE }).childContinueWorkAccepted, false);
  const twice = liveChild();
  twice.splice(2, 0, call('cw-2', 'continue_work', { reason: REASON }));
  assert.equal(cwDelegateSelfHops(twice, { rowNonce: NONCE }).childContinueWorkAccepted, false);
});

test('negative: a longer nonce with the same prefix, or the spawn task text, never counts', () => {
  const longer = liveChild();
  longer[3] = text('assistant', `CHILD-CW-SCHEDULED ${NONCE}-x`);
  assert.equal(cwDelegateSelfHops(longer, { rowNonce: NONCE }).childContinueWorkAccepted, false);
  const longerHop = liveChild();
  longerHop[5] = text('assistant', `CHILD-HOP2-DONE ${NONCE}x`);
  assert.equal(cwDelegateSelfHops(longerHop, { rowNonce: NONCE }).childHop2Woke, false);
  // Sentinels quoted in the user-role spawn task are not assistant output.
  const quoted = [text('user', `[Subagent Task] reply CHILD-CW-SCHEDULED ${NONCE} then CHILD-HOP2-DONE ${NONCE}`)];
  assert.equal(cwDelegateSelfHops(quoted, { rowNonce: NONCE }).childContinueWorkAccepted, false);
});

test('scenario wiring: observer binding, child-transcript hops, parent stream diagnostic only (red before)', () => {
  const source = readFileSync(path.join(root, 'scenarios', 'r-cw-delegate-self-continuation.js'), 'utf8');
  assert.match(source, /createChildObserver\(\{ rootSessionKey: \(\) => sessionKey \}\)/);
  assert.match(source, /reconcileChildIdentity\(\{\s*observerBinding: observer\.boundChild\(rowNonce\)/);
  assert.match(source, /observer\.refreshHistory\(evidence\.child_session_key, 200, 'cw-hops'\)/);
  assert.match(source, /cwDelegateSelfHops\(messages, \{ rowNonce \}\)/);
  assert.match(source, /failClosedVerdict\(passed \? 'PASS-candidate' : 'PARTIAL-candidate', \{ gate, observer \}\)/);
  // The parent stream no longer sets the child receipts.
  assert.doesNotMatch(source, /evidence\.child_hop_2_woke = true;\s*console\.log\('✓ CHILD-HOP2-DONE sentinel observed post-dispatch'\)/);
  assert.doesNotMatch(source, /eventStr\.includes\('"childSessionKey"'\)/);
  assert.ok(ROW_METHODS['R-CW-DELEGATE-SELF-CONTINUATION'].includes('chat.history'));
  assert.ok(ROW_METHODS['R-CW-DELEGATE-SELF-CONTINUATION'].includes('sessions.list'));
});
