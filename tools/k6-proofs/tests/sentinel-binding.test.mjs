// Structural sentinel binding (karmaterminal/openclaw-bootstrap#1727): what the
// agent emits on the way out (tool arguments, thinking, the prompt, another
// session's text) never satisfies a receipt; the product record it cannot
// author does. Shapes follow openclaw f15237ec92 (see lib/sentinel-binding.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assistantSentinelFromEvent,
  assistantSentinelFromHistory,
  createToolReceiptTracker,
  isContinuationWakeInput,
  mintedTokenFromHistory,
  tokenReplyFromHistory,
  toolReceiptsFromHistory,
} from '../lib/sentinel-binding.mjs';
import {
  classifyRcd3Evidence,
  classifyRequestCompactionReceipt,
  fillerText,
  isReleasedLifeboatTask,
  measuredSessionUsage,
  planFillStep,
  rcd3TaskIdentityToken,
  summaryRcd3Verdict,
} from '../lib/r-cd-3-lifeboat.mjs';

const NONCE = 'R-CD-3-1793323864000-abcdefgh';
const SESSION = 'agent:main:r-cd-3-x';

const say = (text, runId, extra = {}) => ({ role: 'assistant', content: [{ type: 'text', text }], __openclaw: { runId }, ...extra });
const call = (id, name, args, runId = 'run-a') => ({ role: 'assistant', content: [{ type: 'toolCall', id, name, arguments: args }], __openclaw: { runId } });
const result = (id, name, payload, runId = 'run-a') => ({ role: 'toolResult', toolCallId: id, toolName: name, content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }], __openclaw: { runId } });
const message = (m) => ({ sessionKey: SESSION, message: m });

test('assistantSentinelFromEvent: outbound text never binds, the woken run\'s own words do', () => {
  const opts = { sessionKey: SESSION, marker: 'CW-WOKE', nonce: NONCE, excludeRunIds: ['run-dispatch'] };
  // The agent's own tool call carrying the sentinel in its arguments.
  assert.equal(assistantSentinelFromEvent('session.message', message(call('c1', 'continue_work', { reason: `CW-WOKE ${NONCE}` }, 'run-x')), opts), null);
  // Thinking that restates the instruction.
  assert.equal(assistantSentinelFromEvent('session.message', message({ role: 'assistant', content: [{ type: 'thinking', thinking: `reply CW-WOKE ${NONCE}` }], __openclaw: { runId: 'run-x' } }), opts), null);
  // The wake input that quotes the reason (a user row).
  assert.equal(assistantSentinelFromEvent('session.message', message({ role: 'user', content: [{ type: 'text', text: `[continuation:wake] Prior reason: "CW-WOKE ${NONCE}"` }] }), opts), null);
  // The dispatch run saying it.
  assert.equal(assistantSentinelFromEvent('session.message', message(say(`CW-WOKE ${NONCE}`, 'run-dispatch')), opts), null);
  // Another session, an agent/chat stream event, a prompt quote, an unstamped row.
  assert.equal(assistantSentinelFromEvent('session.message', { sessionKey: 'agent:main:other', message: say(`CW-WOKE ${NONCE}`, 'run-w') }, opts), null);
  assert.equal(assistantSentinelFromEvent('chat', message(say(`CW-WOKE ${NONCE}`, 'run-w')), opts), null);
  assert.equal(assistantSentinelFromEvent('session.message', message(say(`[k6-proof-harness] reply CW-WOKE ${NONCE}`, 'run-w')), opts), null);
  assert.equal(assistantSentinelFromEvent('session.message', message({ role: 'assistant', content: [{ type: 'text', text: `CW-WOKE ${NONCE}` }] }), opts), null);
  // A longer nonce with the same prefix.
  assert.equal(assistantSentinelFromEvent('session.message', message(say(`CW-WOKE ${NONCE}-x`, 'run-w')), opts), null);
  // The woken run.
  assert.deepEqual(assistantSentinelFromEvent('session.message', message(say(`CW-WOKE ${NONCE}`, 'run-w')), opts), { runId: 'run-w' });
});

test('assistantSentinelFromHistory honours the anchor and the excluded runs', () => {
  const messages = [say(`CW-WOKE ${NONCE}`, 'run-dispatch'), say('noise', 'run-w'), say(`CW-WOKE ${NONCE}`, 'run-w', { timestamp: 9 })];
  assert.deepEqual(assistantSentinelFromHistory(messages, { marker: 'CW-WOKE', nonce: NONCE, excludeRunIds: ['run-dispatch'] }), { index: 2, runId: 'run-w', timestamp: 9 });
  assert.equal(assistantSentinelFromHistory(messages, { marker: 'CW-WOKE', nonce: NONCE, afterIndex: 2 }), null);
});

test('tool receipts pair a nonce-bound call with its own result by toolCallId', () => {
  const messages = [
    result('orphan', 'continue_work', { status: 'scheduled' }),
    call('c-other', 'continue_work', { reason: 'another row' }),
    result('c-other', 'continue_work', { status: 'scheduled' }),
    call('c1', 'continue_work', { reason: `k6 ${NONCE}` }, 'run-d'),
    result('c1', 'continue_work', { status: 'scheduled', delaySeconds: 5 }, 'run-d'),
  ];
  const receipts = toolReceiptsFromHistory(messages, { toolName: 'continue_work', argField: 'reason', needle: NONCE });
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].toolCallId, 'c1');
  assert.equal(receipts[0].status, 'scheduled');
  assert.equal(receipts[0].runId, 'run-d');

  const tracker = createToolReceiptTracker({ sessionKey: SESSION, toolName: 'continue_work', argField: 'reason', needle: NONCE });
  assert.equal(tracker.observe('session.message', message(result('c1', 'continue_work', { status: 'scheduled' }))), null, 'a result before its call binds nothing');
  assert.equal(tracker.observe('session.message', message(call('c1', 'continue_work', { reason: `k6 ${NONCE}` }))), null);
  assert.equal(tracker.observe('session.message', { sessionKey: 'agent:main:other', message: result('c1', 'continue_work', { status: 'scheduled' }) }), null);
  assert.equal(tracker.observe('session.message', message(result('c1', 'continue_work', { status: 'scheduled' }))).status, 'scheduled');
});

test('minted tokens: only the session\'s own reply, never a harness-sent or user-row token, never the placeholder', () => {
  const task = `RCD3-LIFEBOAT ${NONCE} TOKEN <your token>`;
  assert.equal(mintedTokenFromHistory([{ role: 'user', content: [{ type: 'text', text: task }] }], { marker: 'RCD3-LIFEBOAT', nonce: NONCE }).token, null);
  assert.equal(mintedTokenFromHistory([say(task, 'run-l')], { marker: 'RCD3-LIFEBOAT', nonce: NONCE }).token, null);
  const minted = [say(`RCD3-LIFEBOAT ${NONCE} TOKEN q1w2e3r4t5y6`, 'run-l', { timestamp: 4 })];
  assert.match(mintedTokenFromHistory(minted, { marker: 'RCD3-LIFEBOAT', nonce: NONCE, sentTexts: ['use q1w2e3r4t5y6'] }).reason, /harness-sent/);
  assert.match(mintedTokenFromHistory([{ role: 'user', content: [{ type: 'text', text: 'q1w2e3r4t5y6' }] }, ...minted], { marker: 'RCD3-LIFEBOAT', nonce: NONCE }).reason, /user text/);
  const ok = mintedTokenFromHistory(minted, { marker: 'RCD3-LIFEBOAT', nonce: NONCE, sentTexts: [task] });
  assert.equal(ok.token, 'q1w2e3r4t5y6');
  assert.equal(ok.timestamp, 4);
});

test('a reproduced token binds only outside the excluded runs and not before the token', () => {
  const opts = { marker: 'RCD3-PARENT-RETURN', nonce: NONCE, token: 'q1w2e3r4t5y6', excludeRunIds: ['run-proof'], notBeforeTimestamp: 10 };
  const line = `RCD3-PARENT-RETURN ${NONCE} TOKEN q1w2e3r4t5y6`;
  assert.equal(tokenReplyFromHistory([say(line, 'run-proof', { timestamp: 11 })], opts).bound, false);
  assert.equal(tokenReplyFromHistory([say(line, 'run-wake', { timestamp: 9 })], opts).bound, false);
  assert.match(tokenReplyFromHistory([say(line, 'run-wake')], opts).reason, /no timestamp/);
  assert.match(tokenReplyFromHistory([say(line, 'run-wake', { timestamp: 11 })], { ...opts, notBeforeTimestamp: null }).reason, /ordering after it cannot be proven/);
  assert.equal(tokenReplyFromHistory([say(line, 'run-wake', { timestamp: 11 })], opts).bound, true);
});

test('continuation wake input: a user row that starts with the product prefix', () => {
  assert.equal(isContinuationWakeInput({ role: 'user', content: `[continuation:wake] Turn 1/200. Prior reason: "k6 ${NONCE}"` }, NONCE), true);
  assert.equal(isContinuationWakeInput(say(`[continuation:wake] ${NONCE}`, 'r'), NONCE), false);
  assert.equal(isContinuationWakeInput({ role: 'user', content: `quote: [continuation:wake] ${NONCE}` }, NONCE), false);
});

// --- R-CD-3 -----------------------------------------------------------------

test('request_compaction kinds: unknown, measured, accepted and the rest stay distinct', () => {
  const kind = (payload, isError = false) => classifyRequestCompactionReceipt({ payload, isError }).kind;
  assert.equal(kind({ status: 'rejected', guard: 'context_threshold', reason: 'unknown' }), 'context_unknown');
  assert.equal(kind({ status: 'rejected', guard: 'context_threshold', contextUsage: 13, threshold: 70 }), 'threshold_rejected_measured');
  assert.equal(kind({ status: 'rejected', guard: 'context_threshold', contextUsage: 75, threshold: 70 }), 'invalid');
  assert.equal(kind({ status: 'rejected', guard: 'context_threshold', contextUsage: 13 }), 'invalid');
  assert.equal(kind({ status: 'compaction_requested', contextUsage: 76 }), 'accepted');
  assert.equal(kind({ status: 'compaction_requested' }), 'invalid');
  assert.equal(kind({ status: 'rejected', guard: 'rate_limit', retryAfterSeconds: 30 }), 'rate_limited');
  assert.equal(kind({ status: 'already_pending' }), 'already_pending');
  assert.equal(kind({ status: 'compaction_requested', contextUsage: 76 }, true), 'error');
  assert.equal(classifyRequestCompactionReceipt(null).kind, 'missing');
});

const CHAIN = {
  row: 'R-CD-3',
  preflight: { ok: true },
  observation_refused: null,
  observation_incomplete: null,
  lifeboat_identity_conflict: false,
  proof_dispatched: true,
  dispatch_accepted: true,
  staging_receipt_observed: true,
  compaction_outcome_kind: 'accepted',
  lifeboat_child_observed: true,
  lifeboat_report_bound: true,
  parent_return_bound: true,
};

test('classifyRcd3Evidence: an unknown or unmeasured rejection is never PASS, whatever else is set', () => {
  assert.equal(classifyRcd3Evidence(CHAIN).verdict, 'PASS-candidate');
  for (const kind of ['context_unknown', 'threshold_rejected_measured', 'rate_limited', 'already_pending', 'invalid', 'error', 'ambiguous', 'missing', 'other']) {
    const out = classifyRcd3Evidence({ ...CHAIN, compaction_outcome_kind: kind, compaction_context_usage: 41, compaction_threshold: 70 });
    assert.equal(out.verdict, 'PARTIAL-candidate', kind);
    assert.ok(out.reason, kind);
  }
  assert.match(classifyRcd3Evidence({ ...CHAIN, compaction_outcome_kind: 'context_unknown' }).reason, /never PASS/);
  assert.match(classifyRcd3Evidence({ ...CHAIN, compaction_outcome_kind: 'threshold_rejected_measured', compaction_context_usage: 41, compaction_threshold: 70 }).reason, /^measured below-threshold rejection/);
});

test('classifyRcd3Evidence: each missing link names itself; fail closed first', () => {
  for (const field of ['staging_receipt_observed', 'lifeboat_child_observed', 'lifeboat_report_bound', 'parent_return_bound']) {
    assert.equal(classifyRcd3Evidence({ ...CHAIN, [field]: false }).verdict, 'PARTIAL-candidate', field);
  }
  assert.equal(classifyRcd3Evidence({ ...CHAIN, preflight: { ok: false, reason: 'x' } }).verdict, 'PARTIAL-candidate');
  assert.equal(classifyRcd3Evidence({ ...CHAIN, observation_incomplete: { method: 'sessions.list' } }).verdict, 'PARTIAL-candidate');
  assert.equal(classifyRcd3Evidence({ ...CHAIN, lifeboat_identity_conflict: true }).verdict, 'PARTIAL-candidate');
  assert.match(classifyRcd3Evidence({ ...CHAIN, proof_dispatched: false, fill_stop_reason: 'budget' }).reason, /context fill stopped before the proof turn: budget/);
  assert.equal(classifyRcd3Evidence({ ...CHAIN, dispatch_accepted: false }).verdict, 'FAIL-candidate');
  assert.equal(classifyRcd3Evidence({ ...CHAIN, compaction_outcome_kind: 'missing', staging_receipt_observed: false }).verdict, 'FAIL-candidate');
  assert.equal(classifyRcd3Evidence({ ...CHAIN, row: 'R-RC-2' }).verdict, 'PARTIAL-candidate');
  assert.equal(summaryRcd3Verdict(null), 'PARTIAL-candidate');
  assert.equal(summaryRcd3Verdict({ ...CHAIN, verdict: 'PASS-candidate' }), 'PASS-candidate');
  assert.equal(summaryRcd3Verdict({ ...CHAIN, parent_return_bound: false, verdict: 'PASS-candidate' }), 'PARTIAL-candidate');
});

test('measured fill: usage from fresh totals, steps sized to the gap, stops inside its budgets', () => {
  assert.equal(measuredSessionUsage({ totalTokens: 0, totalTokensFresh: false, contextTokens: 200000 }).measured, false);
  assert.equal(measuredSessionUsage({ totalTokens: 100000, totalTokensFresh: true }).measured, false);
  const m = measuredSessionUsage({ totalTokens: 50000, totalTokensFresh: true, contextTokens: 200000 });
  assert.equal(m.usage, 0.25);
  const step = planFillStep({ measurement: m, turnsUsed: 1, filledTokens: 10000, tokensPerChar: 0.25 });
  assert.equal(step.action, 'fill');
  // Toward the 75% target plus margin, never past the 85% ceiling.
  assert.ok(step.stepTokens <= 0.85 * 200000 - 50000);
  assert.equal(planFillStep({ measurement: { ...m, usage: 0.76, totalTokens: 152000 }, turnsUsed: 3 }).action, 'done');
  assert.match(planFillStep({ measurement: measuredSessionUsage({ totalTokens: 50000, totalTokensFresh: true, contextTokens: 1000000 }), turnsUsed: 1 }).reason, /fill budget/);
  assert.match(planFillStep({ measurement: m, turnsUsed: 6 }).reason, /after 6 fill turns/);
  assert.match(planFillStep({ measurement: { measured: false, reason: 'no row' }, turnsUsed: 1 }).reason, /no measured usage/);
});

test('filler is deterministic, inert and cannot hide a 12-character token', () => {
  const a = fillerText('seed', 5000);
  assert.equal(a, fillerText('seed', 5000));
  assert.notEqual(a, fillerText('other', 5000));
  assert.ok(a.length >= 5000);
  assert.ok(a.split(/\s+/).every((word) => /^[a-z]{1,9}$/.test(word)));
});

test('a released lifeboat task carries the product prefix and the row token', () => {
  const token = rcd3TaskIdentityToken(NONCE);
  assert.equal(token, `RCD3:${NONCE.slice(-16)}`);
  assert.equal(isReleasedLifeboatTask(`[continuation:post-compaction] [continuation:chain-hop:1] Compaction just completed. Carry this working state to the post-compaction session: ${token} lifeboat`, token), true);
  assert.equal(isReleasedLifeboatTask(`${token} lifeboat`, token), false);
  assert.equal(isReleasedLifeboatTask('[continuation:post-compaction] another row', token), false);
});
