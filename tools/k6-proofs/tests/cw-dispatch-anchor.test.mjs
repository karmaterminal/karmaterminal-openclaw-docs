// continue_work chains anchor at the harness's own dispatch row (karmaterminal/openclaw-bootstrap#1727,
// harness review N5).
//
// continueWorkChain took the page's first user row as the dispatch turn. In a
// reused or runner-provisioned session (R-CW-1/2/3 default to
// non-disposable; R-CW-4 skips creation for `:subagent:continuation-` keys)
// that row belongs to an earlier turn, so a true chain failed closed. The
// chain now starts at the user row carrying the harness marker and this
// row's nonce. Imports predate the fix.
import test from 'node:test';
import assert from 'node:assert/strict';
import { continueWorkChain } from '../lib/continue-work-chain.mjs';

const N = 'R-CW-2-1793326378000-abcd1234';
const user = (text) => ({ role: 'user', content: [{ type: 'text', text }] });
const say = (text) => ({ role: 'assistant', content: [{ type: 'text', text }] });
const call = (id, reason) => ({ role: 'assistant', content: [{ type: 'toolCall', id, name: 'continue_work', arguments: { reason, delaySeconds: 5 } }] });
const result = (id) => ({ role: 'toolResult', toolCallId: id, toolName: 'continue_work', content: [{ type: 'text', text: JSON.stringify({ status: 'scheduled' }) }] });
const wake = (reason) => user(`[continuation:wake] Turn 1/200. Prior reason: ${JSON.stringify(reason)}`);
const one = { nonce: N, scheduledMarkers: ['CW2-SCHEDULED'], doneMarker: 'CW2-WOKE' };
const chain = [user(`[k6-proof-harness] R-CW-2 proof nonce ${N}.`), call('c', `k6 ${N}`), result('c'), say(`CW2-SCHEDULED ${N}`), wake(`k6 ${N}`), say(`CW2-WOKE ${N}`)];

test('a true chain in a reused session binds after earlier turns', () => {
  const earlier = [user('an operator message from before the proof'), say('an earlier reply')];
  const bound = continueWorkChain([...earlier, ...chain], one);
  assert.equal(bound.complete, true, bound.reason);
  assert.equal(bound.hops[0].callIndex, 3);
});

test('an earlier proof\'s dispatch row (another nonce) is not this chain\'s dispatch turn', () => {
  const other = [user('[k6-proof-harness] R-CW-2 proof nonce R-CW-2-1793326370000-ffff0000.'), say('CW2-SCHEDULED R-CW-2-1793326370000-ffff0000')];
  assert.equal(continueWorkChain([...other, ...chain], one).complete, true);
});

test('without the harness dispatch row nothing binds', () => {
  const unmarked = [user(`R-CW-2 proof nonce ${N}.`), ...chain.slice(1)];
  const bound = continueWorkChain(unmarked, one);
  assert.equal(bound.complete, false);
  assert.match(bound.reason, /no dispatch turn/);
});
