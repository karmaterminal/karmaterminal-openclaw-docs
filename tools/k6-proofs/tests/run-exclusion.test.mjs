// A missing run id empties no exclusion (karmaterminal/openclaw-bootstrap#1727,
// harness review F5 sibling paths).
//
// Every binder that excludes runs used `excludeRunIds.filter(Boolean)`, so a
// dispatch, priming or fill run whose id was unknown dropped out of the list
// and the very run the exclusion guards against could bind. The review test
// covers R-CD-CHAINED-DEPTH-2's root ack; these cover the same shape in every
// other binder: R-CD-1/3/SILENT/R-CW-TOKEN replies, R-CD-4's unstamped
// priming run (live, history and heartbeat), R-CW-DELEGATE-SELF's heartbeat
// path, and R-CD-3's fill runs. Each pairs a [null] list (nothing binds) with
// the same rows and a known run id (the true record binds). They import only
// exports that predate the fix.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rCdChainRootReturnCandidate } from '../lib/r-cd-chained-depth-2-authority.mjs';
import { rCd4HistoryObservation, rCd4SessionMessageObservation } from '../lib/r-cd-4-authority.mjs';
import { assistantSentinelFromEvent, assistantSentinelFromHistory, tokenReplyFromHistory } from '../lib/sentinel-binding.mjs';
import { createHeartbeatAckTracker, heartbeatAckFromHistory } from '../lib/wake-turn-receipt.mjs';

const N = 'R-CD-1-1793326378000-abcd1234';
const KEY = 'agent:main:run-exclusion';
const say = (text, runId, timestamp) => ({ role: 'assistant', content: [{ type: 'text', text }], __openclaw: { runId }, ...(timestamp ? { timestamp } : {}) });

test('assistant sentinels: [null] binds nothing; the same row binds outside a known run', () => {
  const event = { sessionKey: KEY, message: say(`CW-WOKE ${N}`, 'run-d') };
  assert.equal(assistantSentinelFromEvent('session.message', event, { sessionKey: KEY, marker: 'CW-WOKE', nonce: N, excludeRunIds: [null] }), null);
  assert.deepEqual(assistantSentinelFromEvent('session.message', event, { sessionKey: KEY, marker: 'CW-WOKE', nonce: N, excludeRunIds: ['run-other'] }), { runId: 'run-d' });
  assert.equal(assistantSentinelFromHistory([event.message], { marker: 'CW-WOKE', nonce: N, excludeRunIds: [null] }), null);
  assert.equal(assistantSentinelFromHistory([event.message], { marker: 'CW-WOKE', nonce: N, excludeRunIds: ['run-other'] })?.runId, 'run-d');
});

test('R-CD-1/3/SILENT/R-CW-TOKEN replies: an unknown run in the list leaves the reply unbound, with the reason named', () => {
  const rows = [say(`CD1-RETURN ${N} TOKEN q1w2e3r4t5y6`, 'run-d', 20)];
  const opts = { marker: 'CD1-RETURN', nonce: N, token: 'q1w2e3r4t5y6', notBeforeTimestamp: 10 };
  const unknown = tokenReplyFromHistory(rows, { ...opts, excludeRunIds: [null] });
  assert.equal(unknown.bound, false);
  assert.match(unknown.reason, /run/);
  // R-CD-3: the proof run known, one fill run unknown.
  assert.equal(tokenReplyFromHistory(rows, { ...opts, excludeRunIds: ['run-proof', null] }).bound, false);
  assert.equal(tokenReplyFromHistory(rows, { ...opts, excludeRunIds: ['run-proof', 'run-fill-1'] }).bound, true);
});

test('R-CD-CHAINED-DEPTH-2 root ack: [null] binds nothing', () => {
  const opts = { eventName: 'session.message', eventData: { sessionKey: KEY, message: say(`ROOT-CHAIN-ACK ${N}`, 'run-d') }, rootSessionKey: KEY, nonce: N };
  assert.equal(rCdChainRootReturnCandidate({ ...opts, excludeRunIds: [null] }), null);
  assert.equal(rCdChainRootReturnCandidate({ ...opts, excludeRunIds: ['run-other'] })?.role, 'assistant');
});

test('R-CD-4 live: an unstamped priming run excludes nothing, so no target ack binds', () => {
  const ack = (exclude) => rCd4SessionMessageObservation({
    eventName: 'session.message',
    eventData: { sessionKey: KEY, message: say(`TARGET-ACK ${N}`, 'run-prime') },
    targetSessionKey: KEY,
    parentSessionKey: 'agent:main:run-exclusion-parent',
    nonce: N,
    elapsedMs: 6_000,
    wakeGateMs: 5_000,
    excludeTargetRunIds: exclude,
  }).targetCandidate;
  assert.equal(ack([null]), null, 'the priming run restating its prompt is the ack the exclusion guards against');
  assert.equal(ack(['run-other'])?.sessionKey, KEY);
});

test('R-CD-4 history: a priming reply with no run id anchors a window in which nothing binds', () => {
  const opts = { sessionKey: KEY, targetSessionKey: KEY, parentSessionKey: 'agent:main:p', nonce: N, elapsedMs: 6_000, wakeGateMs: 5_000 };
  const ready = { role: 'assistant', content: [{ type: 'text', text: `TARGET-READY ${N}` }] };
  // The priming turn's own later row, unstamped like its priming reply: indistinguishable from the woken run.
  const ack = say(`TARGET-ACK ${N}`, 'run-x');
  assert.equal(rCd4HistoryObservation({ ...opts, messages: [ready, ack] }).targetCandidate, null);
  assert.equal(rCd4HistoryObservation({ ...opts, messages: [{ ...ready, __openclaw: { runId: 'run-prime' } }, ack] }).targetCandidate?.sessionKey, KEY);
});

test('heartbeat acks (R-CD-4 target, R-CD-CHAINED-DEPTH-2 root, R-CW-DELEGATE-SELF return): [null] binds nothing', () => {
  const args = { outcome: 'done', notify: false, summary: `TARGET-ACK ${N}` };
  const call = { role: 'assistant', content: [{ type: 'toolCall', id: 'hb-1', name: 'heartbeat_respond', arguments: args }], __openclaw: { runId: 'run-x' } };
  const result = { role: 'toolResult', toolCallId: 'hb-1', toolName: 'heartbeat_respond', content: [{ type: 'text', text: JSON.stringify({ status: 'accepted', ...args }) }], __openclaw: { runId: 'run-x' } };
  const base = { sessionKey: KEY, marker: 'TARGET-ACK', nonce: N };
  assert.equal(heartbeatAckFromHistory([call, result], { ...base, excludeRunIds: [null] }), null);
  assert.equal(heartbeatAckFromHistory([call, result], { ...base, excludeRunIds: ['run-other'] })?.toolCallId, 'hb-1');
  const tracker = createHeartbeatAckTracker(base);
  tracker.observe({ sessionKey: KEY, message: call }, { windowOpen: true, excludeRunIds: [null] });
  assert.equal(tracker.observe({ sessionKey: KEY, message: result }, { windowOpen: true, excludeRunIds: [null] }), null);
});
