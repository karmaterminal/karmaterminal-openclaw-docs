import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applySameRunDelegateOutcome, createSameRunDelegateTracker } from '../../lib/r-cd-2-same-run-delegate.mjs';

const nonce = 'R-CD-2-1791186854000-abcd1234';
const run = `R-CD-2-${nonce}`;
const meta = (runId = run) => ({ __openclaw: { runId } });
const call = (id, name, args, runId = run) => ({ message: { role: 'assistant', ...meta(runId),
  content: [{ type: 'toolCall', id, name, arguments: args }] } });
const result = (id, name, payload, extra = {}, runId = run) => ({ message: {
  role: 'toolResult', toolCallId: id, toolName: name, ...meta(runId), ...extra,
  content: [{ type: 'text', text: JSON.stringify(payload) }],
} });
const search = () => call('search1', 'tool_search', { query: 'continue_delegate' });
const found = () => result('search1', 'tool_search', { results: [{ query: 'continue_delegate', candidates: [{ id: 'deferred_42', name: 'continue_delegate' }] }] });
const invoke = (id = 'invoke1', args = { id: 'deferred_42', args: { task: `Proof nonce ${nonce}`, mode: 'silent-wake' } }) => call(id, 'tool_call', args);
const scheduled = (id = 'invoke1', payload = { tool: { id: 'deferred_42', name: 'continue_delegate' }, result: { details: { status: 'scheduled' } } }, extra = {}) => result(id, 'tool_call', payload, extra);

test('deferred search, discovered ID, nested nonce/mode, and scheduled result bind on accepted run', () => {
  const t = createSameRunDelegateTracker({ acceptedRunId: run, nonce });
  assert.equal(t.observe(search()), null);
  assert.equal(t.observe(found()), null);
  assert.equal(t.observe(invoke()), null);
  assert.equal(t.observe(scheduled()), 'scheduled');
});

test('direct call, exec sentinel, search alone, terminal text, and undiscovered ID never execute', () => {
  for (const event of [
    call('direct', 'continue_delegate', { task: nonce, mode: 'silent-wake' }),
    call('exec', 'exec', { code: `continue_delegate ${nonce}` }),
    call('wrong', 'tool_call', { toolId: 'other', args: { task: nonce, mode: 'silent-wake' } }),
    { message: { role: 'assistant', ...meta(), content: [{ type: 'text', text: `RCD2-DELEGATE-SCHEDULED ${nonce}` }] } },
  ]) {
    const t = createSameRunDelegateTracker({ acceptedRunId: run, nonce });
    t.observe(search()); t.observe(found()); t.observe(event);
    assert.equal(t.observe(scheduled(event.message.content?.[0]?.id || 'ghost')), null);
  }
  const t = createSameRunDelegateTracker({ acceptedRunId: run, nonce });
  t.observe(search()); assert.equal(t.observe(invoke()), null);
  assert.equal(t.observe(scheduled()), null);
});

test('wrong run, nonce, mode, errors, and non-scheduled nested results reject success', () => {
  const setup = () => { const t = createSameRunDelegateTracker({ acceptedRunId: run, nonce }); t.observe(search()); t.observe(found()); return t; };
  let t = setup(); t.observe(invoke('x', { toolId: 'deferred_42', args: { task: 'other', mode: 'silent-wake' } })); assert.equal(t.observe(scheduled('x')), null);
  t = setup(); t.observe(invoke('x', { toolId: 'deferred_42', args: { task: nonce, mode: 'silent' } })); assert.equal(t.observe(scheduled('x')), null);
  t = setup(); t.observe(invoke()); assert.equal(t.observe(result('invoke1', 'tool_call', { result: { details: { status: 'scheduled' } } }, {}, 'wake-run')), null);
  t = setup(); t.observe(invoke()); assert.equal(t.observe(scheduled('invoke1', { result: { details: { status: 'scheduled', isError: true } } })), 'failed');
  t = setup(); t.observe(invoke()); assert.equal(t.observe(scheduled('invoke1', { result: { details: { status: 'rejected' } } })), 'failed');
  t = setup(); t.observe(invoke()); assert.equal(t.observe(scheduled('invoke1', { tool: { id: 'other', name: 'continue_delegate' }, result: { details: { status: 'scheduled' } } })), 'failed');
});

test('R-CD-2 scenario derives same-run delegate success from the tracker', () => {
  const src = readFileSync(new URL('../../scenarios/r-cd-2-silent-wake.js', import.meta.url), 'utf8');
  assert.match(src, /createSameRunDelegateTracker\(\{ acceptedRunId, nonce: rowNonce \}\)/);
  assert.match(src, /const applyDelegateOutcome = \(outcome\) => applySameRunDelegateOutcome\(evidence, outcome\);/);
  // Failure-first then success, and failure alone.
  const failedOnly = applySameRunDelegateOutcome({}, 'failed');
  assert.equal(failedOnly.typed_delegate_failed_same_run, true);
  assert.equal(failedOnly.typed_delegate_success_same_run, undefined);
  const recovered = applySameRunDelegateOutcome(applySameRunDelegateOutcome({}, 'failed'), 'scheduled');
  assert.equal(recovered.typed_delegate_success_same_run, true);
  assert.equal(recovered.typed_delegate_failed_same_run, false);
  // Early session.message events are buffered before the accepted run id and replayed.
  const block = src.indexOf("if (eventName === 'session.message') {");
  const gated = src.indexOf("if (eventName === 'session.message' && evidence.send_accepted) {");
  assert.ok(block > 0 && block < gated, 'delegate tracking runs outside the send_accepted gate');
  assert.match(src, /pendingDelegateEvents\.splice\(0\)\) applyDelegateOutcome\(sameRunDelegate\.observe\(pending\)\)/);
});

test('the tracker is the single authority: a scheduled call plus a rejected duplicate is success, not a FAIL', async () => {
  // Review 🍃 on #578: the old substring scan set dispatch_failure_observed +
  // a conclusive provider-or-turn-failure on its own.
  const src = readFileSync(new URL('../../scenarios/r-cd-2-silent-wake.js', import.meta.url), 'utf8');
  const scan = src.slice(src.indexOf('Diagnostic only. The same-run delegate outcome'), src.indexOf('delegate_failure_text_seen_same_run = true') + 60);
  assert.ok(scan.length > 100, 'diagnostic scan block present');
  for (const forbidden of ['dispatch_failure_observed =', 'failureCategory =', 'typed_delegate_failed_same_run =', 'typed_delegate_attempted_same_run =']) {
    assert.equal(scan.includes(forbidden), false, `the substring scan must not write ${forbidden}`);
  }
  // Behaviour of the authority itself: scheduled, then a rejected duplicate, then a late rejection.
  const t = createSameRunDelegateTracker({ acceptedRunId: run, nonce });
  t.observe(search()); t.observe(found()); t.observe(invoke('ok')); t.observe(invoke('dup'));
  const outcomes = [t.observe(scheduled('ok')), t.observe(scheduled('dup', { result: { details: { status: 'rejected' } } }))];
  assert.deepEqual(outcomes, ['scheduled', 'failed']);
  // The real authority: success sticks once seen; a later rejection cannot flip it.
  const ev = {};
  outcomes.forEach((o) => applySameRunDelegateOutcome(ev, o));
  applySameRunDelegateOutcome(ev, 'failed');
  assert.equal(ev.typed_delegate_success_same_run, true);
  assert.equal(ev.typed_delegate_failed_same_run, false);
  assert.equal(ev.dispatch_failure_observed, undefined);
});

test('the notify:false/done completion record alone can never set same-run delegate success', () => {
  // Review 🌻 on #578: the record branch still wrote typed_delegate_* on the
  // accepted run, bypassing the nonce-bound call/result pairing.
  const src = readFileSync(new URL('../../scenarios/r-cd-2-silent-wake.js', import.meta.url), 'utf8');
  const start = src.indexOf("eventStr.includes('\"notify\":false')");
  const end = src.indexOf("console.log('ℹ internal continue_status notify:false receipt observed');", start);
  assert.ok(start > 0 && end > start, 'completion-record branch located');
  const branch = src.slice(start, end);
  for (const field of ['typed_delegate_success_same_run', 'typed_delegate_attempted_same_run', 'typed_delegate_failed_same_run']) {
    assert.equal(branch.includes(`evidence.${field} =`), false, `the record branch must not write ${field}`);
  }
  // Every write of the success flag in the scenario goes through the lib authority.
  const writes = src.match(/evidence\.typed_delegate_success_same_run\s*=/g) || [];
  assert.equal(writes.length, 0, 'no direct success writes remain in the scenario');
  // Positive: only a paired scheduled result on the accepted run sets success.
  const t = createSameRunDelegateTracker({ acceptedRunId: run, nonce });
  t.observe(search()); t.observe(found()); t.observe(invoke('p1'));
  const ev = applySameRunDelegateOutcome({}, t.observe(scheduled('p1')));
  assert.equal(ev.typed_delegate_success_same_run, true);
});
