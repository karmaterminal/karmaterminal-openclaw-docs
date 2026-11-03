import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applySameRunDelegateOutcome, createSameRunDelegateTracker } from '../../lib/r-cd-2-same-run-delegate.mjs';

const nonce = 'R-CD-2-1791186854000-abcd1234';
const run = 'R-CD-2-R-CD-2-1791186854000-abcd1234';
const meta = (runId = run) => ({ __openclaw: { runId } });
// Shapes as seen in the live parent transcripts (isolated 14d31a81b1, 2026-10-05).
const call = (id, task = `Proof nonce ${nonce}: reply with DONE and the nonce only.`, runId = run, name = 'continue_delegate') => ({
  sessionKey: 'agent:main:r-cd-2', message: { role: 'assistant', ...meta(runId),
    content: [{ type: 'toolCall', id, name, arguments: { mode: 'silent-wake', delaySeconds: 1, task } }] },
});
const result = (toolCallId, text = '{\n  "status": "scheduled",\n  "mode": "silent-wake",\n  "delaySeconds": 5\n}', extra = {}, runId = run) => ({
  sessionKey: 'agent:main:r-cd-2', message: { role: 'toolResult', toolCallId, toolName: 'continue_delegate',
    content: [{ type: 'text', text }], ...meta(runId), ...extra },
});

test('a nonce-bound continue_delegate call and its scheduled result on the send run is same-run success', () => {
  const t = createSameRunDelegateTracker({ acceptedRunId: run, nonce });
  assert.equal(t.observe(call('call_1')), null);
  assert.equal(t.observe(result('call_1')), 'scheduled');
});

test('error or non-scheduled results on the paired call are failures', () => {
  const t = createSameRunDelegateTracker({ acceptedRunId: run, nonce });
  t.observe(call('c1')); t.observe(call('c2'));
  assert.equal(t.observe(result('c1', '{"status":"rejected"}')), 'failed');
  assert.equal(t.observe(result('c2', 'codex_dynamic_tool_error', { isError: true })), 'failed');
});

test('nothing binds outside the accepted send run, without the nonce, or without a paired call', () => {
  const other = createSameRunDelegateTracker({ acceptedRunId: run, nonce });
  other.observe(call('w1', undefined, 'wake-run'));
  assert.equal(other.observe(result('w1', undefined, {}, 'wake-run')), null, 'wake run never counts');

  const noNonce = createSameRunDelegateTracker({ acceptedRunId: run, nonce });
  noNonce.observe(call('n1', 'some other task'));
  assert.equal(noNonce.observe(result('n1')), null, 'a call without the row nonce never binds');

  const unpaired = createSameRunDelegateTracker({ acceptedRunId: run, nonce });
  assert.equal(unpaired.observe(result('ghost')), null, 'a result with no recorded call never binds');

  const crossRun = createSameRunDelegateTracker({ acceptedRunId: run, nonce });
  crossRun.observe(call('x1'));
  assert.equal(crossRun.observe(result('x1', undefined, {}, 'wake-run')), null, 'the result must be on the send run too');
});

test('a namespaced tool name (openclaw__continue_delegate) also counts; exec does not', () => {
  const t = createSameRunDelegateTracker({ acceptedRunId: run, nonce });
  t.observe(call('ns1', undefined, run, 'openclaw__continue_delegate'));
  assert.equal(t.observe(result('ns1')), 'scheduled');
  const e = createSameRunDelegateTracker({ acceptedRunId: run, nonce });
  e.observe(call('ex1', undefined, run, 'exec'));
  assert.equal(e.observe(result('ex1')), null);
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
  t.observe(call('ok')); t.observe(call('dup'));
  const outcomes = [t.observe(result('ok')), t.observe(result('dup', '{"status":"rejected"}'))];
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
  t.observe(call('p1'));
  const ev = applySameRunDelegateOutcome({}, t.observe(result('p1')));
  assert.equal(ev.typed_delegate_success_same_run, true);
});
