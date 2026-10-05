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

// --- #570 review: parent-return is a real binding ---------------------------
import { childMintedToken, parentReturnReceipt } from '../lib/cw-delegate-self-receipt.mjs';

const TOKEN = 'q7m2x9k4p1z8';
const DISPATCH_RUN = 'run-dispatch';
const TASK = `k6 proof R-CW-DELEGATE-SELF nonce ${NONCE}: ... reply exactly CHILD-CW-SCHEDULED ${NONCE} TOKEN <your token>. On hop-2 wake, reply exactly CHILD-HOP2-DONE ${NONCE}.`;
const INSTRUCTION = `[k6-proof-harness] Call continue_delegate with: mode="normal", delaySeconds=1, task="${TASK}". Later, when the delegate's return arrives, reply exactly PARENT-RETURN ${NONCE} TOKEN <the TOKEN value from that return>.`;

function stamped(message, runId, timestamp) { return { ...message, timestamp, __openclaw: { runId } }; }

function childWithToken(token = TOKEN, ts = 1000) {
  const t = liveChild();
  t[3] = text('assistant', `CHILD-CW-SCHEDULED ${NONCE} TOKEN ${token}`, { stopReason: 'stop', timestamp: ts });
  return t;
}

// Parent transcript at the cut: the dispatch run (harness user row, the
// continue_delegate toolCall carrying the nonce and task text, its result, the
// reply), then the hidden completion-report row is not in chat.history, then
// the parent's reply to the delivered return in its own run.
function parentTranscript({ reply = `PARENT-RETURN ${NONCE} TOKEN ${TOKEN}`, replyRun = 'run-return', replyTs = 2000 } = {}) {
  const rows = [
    stamped(text('user', INSTRUCTION), DISPATCH_RUN, 100),
    stamped(call('cd-1', 'continue_delegate', { mode: 'normal', delaySeconds: 1, task: TASK }), DISPATCH_RUN, 110),
    stamped(result('cd-1', 'continue_delegate', { status: 'scheduled' }), DISPATCH_RUN, 120),
    stamped(text('assistant', 'Delegated.'), DISPATCH_RUN, 130),
  ];
  if (reply !== null) rows.push(stamped(text('assistant', reply), replyRun, replyTs));
  return rows;
}

test('#570: the parent dispatch alone (its own continue_delegate toolCall) no longer satisfies parent-return', () => {
  const r = parentReturnReceipt(parentTranscript({ reply: null }), { rowNonce: NONCE, token: TOKEN, dispatchRunId: DISPATCH_RUN });
  assert.equal(r.bound, false);
  // ...even when the harness asked for PARENT-RETURN in the instruction (user row, dispatch run).
  const minted = childMintedToken(childWithToken(), { rowNonce: NONCE, harnessTexts: [INSTRUCTION, TASK] });
  assert.equal(minted.token, TOKEN);
});

test('#570: the child-minted token reproduced by the parent outside the dispatch run binds', () => {
  const minted = childMintedToken(childWithToken(), { rowNonce: NONCE, harnessTexts: [INSTRUCTION, TASK] });
  const r = parentReturnReceipt(parentTranscript(), { rowNonce: NONCE, token: minted.token, dispatchRunId: DISPATCH_RUN, tokenTimestamp: minted.timestamp });
  assert.deepEqual([r.bound, r.source, r.runId], [true, 'assistant-text', 'run-return']);
});

test('#570: a heartbeat_respond reproduction also binds, with the same window', () => {
  const rows = parentTranscript({ reply: null });
  const args = { outcome: 'done', notify: false, summary: 'return consumed', notificationText: `PARENT-RETURN ${NONCE} TOKEN ${TOKEN}` };
  rows.push(stamped(call('hb-1', 'heartbeat_respond', args), 'run-wake', 2000));
  rows.push(stamped(result('hb-1', 'heartbeat_respond', { status: 'accepted', ...args }), 'run-wake', 2001));
  const r = parentReturnReceipt(rows, { rowNonce: NONCE, token: TOKEN, dispatchRunId: DISPATCH_RUN, tokenTimestamp: 1000 });
  assert.deepEqual([r.bound, r.source], [true, 'heartbeat_respond']);
});

test('#570 negatives: token in harness or task text, wrong shape, or quoted only in the spawn task', () => {
  assert.equal(childMintedToken(childWithToken(), { rowNonce: NONCE, harnessTexts: [`${INSTRUCTION} ${TOKEN}`] }).token, null);
  assert.match(childMintedToken(childWithToken(), { rowNonce: NONCE, harnessTexts: [`task mentions ${TOKEN.toUpperCase()}`] }).reason, /harness-sent or task text/);
  const inSpawn = childWithToken();
  inSpawn[0] = text('user', `[Subagent Task]\n\n${TASK} ${TOKEN}`);
  assert.equal(childMintedToken(inSpawn, { rowNonce: NONCE }).token, null);
  for (const bad of ['short', 'q7m2x9k4p1z8x', 'Q7M2X9K4P1Z8']) {
    assert.equal(childMintedToken(childWithToken(bad), { rowNonce: NONCE }).token, null, bad);
  }
  // Token claimed in the wake turn only (not turn 1) is not minted.
  const lateOnly = liveChild();
  lateOnly[5] = text('assistant', `CHILD-HOP2-DONE ${NONCE} CHILD-CW-SCHEDULED ${NONCE} TOKEN ${TOKEN}`);
  assert.equal(childMintedToken(lateOnly, { rowNonce: NONCE }).token, null);
});

test('#570 negatives: inside the dispatch run, before the dispatch run ends, before the token, another nonce or token', () => {
  const opts = { rowNonce: NONCE, token: TOKEN, dispatchRunId: DISPATCH_RUN, tokenTimestamp: 1000 };
  assert.equal(parentReturnReceipt(parentTranscript({ replyRun: DISPATCH_RUN }), opts).bound, false, 'inside the dispatch run');
  const early = parentTranscript({ reply: null });
  early.splice(1, 0, stamped(text('assistant', `PARENT-RETURN ${NONCE} TOKEN ${TOKEN}`), 'run-other', 105));
  assert.equal(parentReturnReceipt(early, opts).bound, false, 'before the dispatch run ended');
  assert.equal(parentReturnReceipt(parentTranscript({ replyTs: 900 }), opts).bound, false, 'before the child minted the token');
  assert.equal(parentReturnReceipt(parentTranscript({ reply: `PARENT-RETURN R-CW-DS-other TOKEN ${TOKEN}` }), opts).bound, false, 'another nonce');
  assert.equal(parentReturnReceipt(parentTranscript({ reply: `PARENT-RETURN ${NONCE} TOKEN aaaaaaaaaaaa` }), opts).bound, false, 'another token');
  assert.equal(parentReturnReceipt(parentTranscript({ reply: `PARENT-RETURN ${NONCE} TOKEN ${TOKEN}x` }), opts).bound, false, 'longer token');
  assert.equal(parentReturnReceipt(parentTranscript({ replyRun: null }), opts).bound, false, 'no run id');
  assert.match(parentReturnReceipt(parentTranscript(), { ...opts, dispatchRunId: null }).reason, /dispatch run id unknown/);
  assert.match(parentReturnReceipt(parentTranscript(), { ...opts, dispatchRunId: 'run-missing' }).reason, /dispatch run not found/);
});

test('#570 wiring: parent-return comes only from the token binding; heuristic is diagnostic; hop-2 output not claimed (red before)', () => {
  const source = readFileSync(path.join(root, 'scenarios', 'r-cw-delegate-self-continuation.js'), 'utf8');
  assert.match(source, /parentReturnReceipt\(messages, \{\s*rowNonce, token: childToken, dispatchRunId: evidence\.dispatch_run_id/);
  assert.match(source, /childMintedToken\(messages, \{ rowNonce, harnessTexts \}\)/);
  assert.match(source, /evidence\.parent_return_heuristic = true;/);
  // The only assignment of the required receipt is the bound token path.
  assert.equal((source.match(/evidence\.parent_return = true/g) || []).length, 1);
  assert.match(source, /if \(receipt\.bound\) \{\s*evidence\.parent_return = true;/);
  assert.match(source, /hop2_output_reached_parent: null/);
});

test('#570 review (🌊): ordering after the child token fails closed when a timestamp is missing', () => {
  const base = { rowNonce: NONCE, token: TOKEN, dispatchRunId: DISPATCH_RUN };
  const noTokenTs = parentReturnReceipt(parentTranscript(), { ...base, tokenTimestamp: null });
  assert.equal(noTokenTs.bound, false);
  assert.match(noTokenTs.reason, /child token message has no timestamp/);
  const untimedReply = parentReturnReceipt(parentTranscript({ replyTs: null }), { ...base, tokenTimestamp: 1000 });
  assert.equal(untimedReply.bound, false);
  assert.match(untimedReply.reason, /parent reply has no timestamp/);
  assert.equal(parentReturnReceipt(parentTranscript({ replyTs: 999 }), { ...base, tokenTimestamp: 1000 }).bound, false, 'before the token');
  assert.equal(parentReturnReceipt(parentTranscript(), { ...base, tokenTimestamp: '1000' }).bound, false, 'a string token timestamp is not a timestamp');
  assert.equal(parentReturnReceipt(parentTranscript(), { ...base, tokenTimestamp: 1000 }).bound, true, 'timed and ordered still binds');
});
