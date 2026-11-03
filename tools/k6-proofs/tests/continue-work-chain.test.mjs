// continue_work chain binding by transcript turn order (karmaterminal/openclaw-bootstrap#1727).
// Shapes follow openclaw f15237ec92: continue_work answers {"status":"scheduled"}
// (src/agents/tools/continue-work-tool.ts:102-110), the wake input is a user row
// "[continuation:wake] ... Prior reason: "<reason>"" quoting the reason twice
// (src/auto-reply/continuation/work-dispatch-execution.ts:165-226).
import test from 'node:test';
import assert from 'node:assert/strict';
import { continueWorkChain } from '../lib/continue-work-chain.mjs';

const N = 'R-CW-1-1793326378000-abcd1234';
const user = (text) => ({ role: 'user', content: [{ type: 'text', text }] });
const say = (text) => ({ role: 'assistant', content: [{ type: 'text', text }] });
const call = (id, reason) => ({ role: 'assistant', content: [{ type: 'toolCall', id, name: 'continue_work', arguments: { reason, delaySeconds: 5 } }] });
const result = (id, status = 'scheduled') => ({ role: 'toolResult', toolCallId: id, toolName: 'continue_work', content: [{ type: 'text', text: JSON.stringify({ status }) }] });
const wake = (reason) => user(`[continuation:wake] Turn 1/200. Prior reason: ${JSON.stringify(reason)} [provenance] Prior reason: ${JSON.stringify(reason)}`);
const one = { nonce: N, scheduledMarkers: ['CW-SCHEDULED'], doneMarker: 'CW-WOKE' };

test('a true schedule and wake bind', () => {
  const chain = continueWorkChain([user(`[k6-proof-harness] ${N}`), call('c', `k6 ${N}`), result('c'), say(`CW-SCHEDULED ${N}`), wake(`k6 ${N}`), say(`CW-WOKE ${N}`)], one);
  assert.equal(chain.complete, true, chain.reason);
  assert.equal(chain.scheduled, 1);
  assert.equal(chain.woke, 1);
  assert.equal(chain.doneIndex, 5);
});

test('F′ shape: the reason carrying the wake sentinel, echoed in the call and the wake input, never wakes the row', () => {
  const reason = `k6 ${N} -- on continuation wake reply exactly CW-WOKE ${N}`;
  const chain = continueWorkChain([user(`[k6-proof-harness] ${N}`), call('c', reason), result('c'), say(`CW-SCHEDULED ${N}`), wake(reason)], one);
  assert.equal(chain.complete, false);
  assert.equal(chain.scheduled, 1);
  assert.match(chain.reason, /CW-WOKE is not in the final wake turn/);
});

test('the wake sentinel in the dispatch turn, in thinking or in a tool call is not the woken turn', () => {
  const base = [user(`[k6-proof-harness] ${N}`), call('c', `k6 ${N}`), result('c'), say(`CW-SCHEDULED ${N} CW-WOKE ${N}`), wake(`k6 ${N}`)];
  assert.equal(continueWorkChain(base, one).complete, false);
  assert.equal(continueWorkChain([...base, { role: 'assistant', content: [{ type: 'thinking', thinking: `CW-WOKE ${N}` }] }], one).complete, false);
  assert.equal(continueWorkChain([...base, call('d', `CW-WOKE ${N}`)], one).complete, false);
});

test('no scheduled result, a scheduled sentinel before the result, or a wake for another nonce does not bind', () => {
  assert.match(continueWorkChain([user(`[k6-proof-harness] ${N}`), call('c', `k6 ${N}`), result('c', 'rejected'), say(`CW-SCHEDULED ${N}`)], one).reason, /not "scheduled"/);
  assert.match(continueWorkChain([user(`[k6-proof-harness] ${N}`), say(`CW-SCHEDULED ${N}`), call('c', `k6 ${N}`), result('c')], one).reason, /CW-SCHEDULED is not in the turn/);
  assert.match(continueWorkChain([user(`[k6-proof-harness] ${N}`), call('c', `k6 ${N}`), result('c'), say(`CW-SCHEDULED ${N}`), wake('k6 R-CW-1-other'), say(`CW-WOKE ${N}`)], one).reason, /no nonce-bound \[continuation:wake\]/);
  // A user row the agent could not have written is required between the turns: a harness-shaped quote is not a wake.
  assert.match(continueWorkChain([user(`[k6-proof-harness] ${N}`), call('c', `k6 ${N}`), result('c'), say(`CW-SCHEDULED ${N}`), say(`[continuation:wake] ${N}`), say(`CW-WOKE ${N}`)], one).reason, /no nonce-bound \[continuation:wake\]/);
});

test('R-CW-4: three hops in order, each next call inside the previous wake turn', () => {
  const markers = ['CW4-HOP1-SCHEDULED', 'CW4-HOP2-SCHEDULED', 'CW4-HOP3-SCHEDULED'];
  const rows = [user(`[k6-proof-harness] ${N}`)];
  ['hop1', 'hop2', 'hop3'].forEach((hop, i) => {
    rows.push(call(`c${i}`, `R-CW-4 ${hop} ${N}`), result(`c${i}`), say(`${markers[i]} ${N}`), wake(`R-CW-4 ${hop} ${N}`));
  });
  rows.push(say(`CW4-DONE ${N}`));
  const chain = continueWorkChain(rows, { nonce: N, scheduledMarkers: markers, doneMarker: 'CW4-DONE' });
  assert.equal(chain.complete, true, chain.reason);
  assert.equal(chain.scheduled, 3);
  // All hop sentinels in one dispatch turn (a restated prompt) bind only hop 1.
  const restated = [user(`[k6-proof-harness] ${N}`), call('c0', `R-CW-4 hop1 ${N}`), result('c0'), say(markers.map((m) => `${m} ${N}`).join(' ') + ` CW4-DONE ${N}`)];
  const partial = continueWorkChain(restated, { nonce: N, scheduledMarkers: markers, doneMarker: 'CW4-DONE' });
  assert.equal(partial.complete, false);
  assert.equal(partial.scheduled, 1);
});
