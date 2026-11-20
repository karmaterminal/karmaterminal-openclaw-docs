// Every harness result reader against the Tool Search result envelope
// (openclaw/openclaw#129388; lane proof-rows-adjudicate-10 finding H1, run 44245772142).
//
// On a Tool Search seat (the default, openclaw ab5a30ea79 tool-search-config.ts:11)
// continue_work, continue_delegate, sessions_spawn and request_compaction run
// through dispatch_action, and their result row carries the { tool, result }
// envelope (tool-search.ts:396-422), not the tool's own JSON. Docs PR #617 taught
// the matchers to unwrap the call; no reader unwrapped the result, so each one
// read no status and the rows went PARTIAL although the work was scheduled.
//
// Per reader: the direct row, the envelope in each product form (ab5a/9476c7aa
// compact, f15237ec pretty-printed, a live event with details, the older
// tool_call), and the shapes that must stay unreadable (another tool's envelope,
// a same-named MCP or plugin tool, name and id disagreeing, the #617 fixture's
// bare JSON under the dispatcher name, an envelope inside an envelope, an
// envelope with no JSON answer or no tool, an envelope on a direct row, a row
// named after another tool). This file imports only exports that predate the
// fix, so it runs unchanged against docs main 54d750e8 as its negative control
// (167 tests: 87 pass, 80 fail there). What fails there: all 44 envelope-form
// cases (4 forms x 11 readers) and the R-RC-1 catalog-entry test. Two shapes
// that base accepted and the fix refuses on purpose also fail there: the #617
// bare answer under the dispatcher name (9 readers; no product build writes it),
// and a result row named after another tool (the 6 shared-reader cases). The
// 20 parent tests holding those cases fail with them. Every direct row and every
// other unreadable shape holds on both trees.
import test from 'node:test';
import assert from 'node:assert/strict';
import { continueWorkChain } from '../lib/continue-work-chain.mjs';
import { continueWorkScheduledIndex, cwDelegateSelfHops } from '../lib/cw-delegate-self-receipt.mjs';
import { applySameRunDelegateOutcome, createSameRunDelegateTracker } from '../lib/r-cd-2-same-run-delegate.mjs';
import { compactionOutcome, compactionReceiptsFromHistory, stagingOutcome, stagingReceiptsFromHistory } from '../lib/r-cd-3-lifeboat.mjs';
import {
  childPostCompactionReport,
  childReportAfterReceipt,
  classifyRequestCompactionReceipt,
  findRequestCompactionReceipt,
  measuredRequestCompactionOutcome,
} from '../lib/request-compaction-receipt.js';
import { createToolReceiptTracker, toolReceiptsFromHistory, toolResultPayload } from '../lib/sentinel-binding.mjs';
import { createHeartbeatAckTracker, heartbeatAckFromHistory, heartbeatRespondResult } from '../lib/wake-turn-receipt.mjs';
import { DISPATCHER, catalogEntry, dispatchedCallPart, jsonResult, resultRow } from './helpers/tool-search-envelope.mjs';

const N = 'R-CW-1-1794981360000-abcd1234';
const SESSION = 'agent:main:tool-search-envelope';
const user = (text, runId) => ({ role: 'user', content: [{ type: 'text', text }], ...(runId ? { __openclaw: { runId } } : {}) });
const say = (text, runId, extra = {}) => ({ role: 'assistant', content: [{ type: 'text', text }], ...(runId ? { __openclaw: { runId } } : {}), ...extra });

/** The call, recorded the way the result's form implies (a direct call, the dispatcher, or the older tool_call). */
function callRow(id, tool, args, via, runId) {
  const part = via === 'direct' ? { type: 'toolCall', id, name: tool, arguments: args }
    : via === 'legacy-tool-call' ? { type: 'toolCall', id, name: 'tool_call', arguments: { id: tool, args } }
    : dispatchedCallPart(id, tool, args);
  return { role: 'assistant', content: [part], ...(runId ? { __openclaw: { runId } } : {}) };
}

/** The product forms a reader must read: [label, resultRow options]. */
const READABLE = [
  ['direct', { via: 'direct' }],
  ['dispatch_action, ab5a compact envelope (chat.history)', { via: 'dispatch' }],
  ['dispatch_action, f15237ec pretty envelope (chat.history)', { via: 'dispatch', compact: false }],
  ['dispatch_action, live event with details', { via: 'dispatch', surface: 'event' }],
  ['tool_call, v2026.7.1-1 envelope', { via: 'legacy-tool-call' }],
];

/**
 * The shapes a reader must leave unreadable: [label, build(row fields) -> row].
 * `base` is the matching readable dispatched row; each case breaks one thing.
 */
const UNREADABLE = [
  ['an envelope naming another tool', (f) => {
    const other = f.tool === 'sessions_spawn' ? 'continue_work' : 'sessions_spawn';
    return resultRow({ ...f, via: 'dispatch', envelope: { name: other, id: `openclaw:core:${other}` } });
  }],
  ['an envelope for a same-named MCP tool', (f) => resultRow({ ...f, via: 'dispatch', envelope: { id: `mcp:lookalike:${f.tool}`, source: 'mcp' } })],
  ['an envelope for a same-named plugin tool', (f) => resultRow({ ...f, via: 'dispatch', envelope: { id: `openclaw:lookalike-plugin:${f.tool}`, sourceName: 'lookalike-plugin' } })],
  ['an envelope whose name and id disagree', (f) => resultRow({ ...f, via: 'dispatch', envelope: { id: 'openclaw:core:exec' } })],
  ['the #617 fixture: the bare answer under the dispatcher name', (f) => ({ ...resultRow({ ...f, via: 'direct' }), toolName: DISPATCHER })],
  ['an envelope inside an envelope', (f) => {
    const inner = resultRow({ ...f, via: 'dispatch', surface: 'event' });
    const outer = { tool: { id: `openclaw:core:${f.tool}`, name: f.tool, source: 'openclaw' }, result: { content: [{ type: 'text', text: inner.content[0].text }] } };
    return { ...inner, content: [{ type: 'text', text: JSON.stringify(outer) }], details: undefined };
  }],
  ['an envelope whose result has no JSON answer', (f) => {
    const row = resultRow({ ...f, via: 'dispatch' });
    const env = JSON.parse(row.content[0].text);
    env.result = { content: [{ type: 'text', text: 'scheduled' }] };
    return { ...row, content: [{ type: 'text', text: JSON.stringify(env) }] };
  }],
  ['an envelope with no tool', (f) => {
    const row = resultRow({ ...f, via: 'dispatch' });
    const { tool: _drop, ...env } = JSON.parse(row.content[0].text);
    return { ...row, content: [{ type: 'text', text: JSON.stringify(env) }] };
  }],
  ['an envelope on a row named after the tool', (f) => ({ ...resultRow({ ...f, via: 'dispatch' }), toolName: f.tool })],
  ['a row named after another tool', (f) => ({ ...resultRow({ ...f, via: 'direct' }), toolName: 'exec' })],
];
const UNREADABLE_CALL_VIA = { 'an envelope on a row named after the tool': 'direct', 'a row named after another tool': 'direct' };

// ---------------------------------------------------------------------------
// The shared reader: toolResultPayload / receiptFor (sentinel-binding.mjs)
// ---------------------------------------------------------------------------

test('toolResultPayload: the dispatched row yields the tool\'s answer, not the envelope', async (t) => {
  for (const [label, opts] of READABLE) await t.test(label, () => {
    const row = resultRow({ toolCallId: 'c1', tool: 'continue_work', payload: { status: 'scheduled', delaySeconds: 5 }, ...opts });
    assert.deepEqual(toolResultPayload(row, 'continue_work'), { status: 'scheduled', delaySeconds: 5 }, label);
  });
});

test('toolResultPayload: unreadable shapes yield no payload', async (t) => {
  for (const [label, build] of UNREADABLE) await t.test(label, () => {
    const row = build({ toolCallId: 'c1', tool: 'continue_work', payload: { status: 'scheduled', delaySeconds: 5 } });
    assert.notEqual(toolResultPayload(row, 'continue_work')?.status, 'scheduled', label);
  });
});

const RECEIPT_TOOLS = [
  // [tool, argField, payload, rows]
  ['continue_delegate', 'task', { status: 'scheduled', mode: 'normal', delaySeconds: 1 }, 'R-CD-1, R-CD-SILENT'],
  ['sessions_spawn', 'task', { status: 'accepted', childSessionKey: 'agent:main:subagent:synthetic', runId: 'run-c1' }, 'R-CW-TOKEN, R-CD-MODEL-TOKEN'],
  ['request_compaction', 'reason', { status: 'compaction_requested', contextUsage: 81, threshold: 70 }, 'R-CD-3'],
];

for (const [tool, argField, payload, rows] of RECEIPT_TOOLS) {
  const args = { [argField]: `k6 proof ${N}` };
  test(`toolReceiptsFromHistory / createToolReceiptTracker (${rows}): ${tool} reads its answer in every product form`, async (t) => {
    for (const [label, opts] of READABLE) await t.test(label, () => {
      const history = [user(`[k6-proof-harness] ${N}`), callRow('c1', tool, args, opts.via, 'run-d'), resultRow({ toolCallId: 'c1', tool, payload, runId: 'run-d', ...opts })];
      const [receipt] = toolReceiptsFromHistory(history, { toolName: tool, argField, needle: N });
      assert.equal(receipt?.status, payload.status, `${tool} history, ${label}`);
      assert.deepEqual(receipt?.payload, payload, `${tool} history payload, ${label}`);
      const tracker = createToolReceiptTracker({ sessionKey: SESSION, toolName: tool, argField, needle: N });
      tracker.observe('session.message', { sessionKey: SESSION, message: history[1] });
      const live = tracker.observe('session.message', { sessionKey: SESSION, message: resultRow({ toolCallId: 'c1', tool, payload, runId: 'run-d', surface: 'event', ...opts }) });
      assert.equal(live?.status, payload.status, `${tool} live, ${label}`);
    });
  });

  test(`toolReceiptsFromHistory / createToolReceiptTracker (${rows}): ${tool} never reads an unreadable shape`, async (t) => {
    for (const [label, build] of UNREADABLE) await t.test(label, () => {
      const via = UNREADABLE_CALL_VIA[label] || 'dispatch';
      const row = build({ toolCallId: 'c1', tool, payload, runId: 'run-d' });
      const [receipt] = toolReceiptsFromHistory([callRow('c1', tool, args, via, 'run-d'), row], { toolName: tool, argField, needle: N });
      assert.notEqual(receipt?.status, payload.status, `${tool}, ${label}`);
      assert.equal(receipt?.payload?.childSessionKey, undefined, `${tool}, ${label}: no child key from an unreadable row`);
    });
  });
}

// ---------------------------------------------------------------------------
// continueWorkChain (R-CW-1/2/3/4)
// ---------------------------------------------------------------------------

function cwTranscript(row, via) {
  const reason = `k6-proof-R-CW-1-${N}`;
  return [
    user(`[k6-proof-harness] Call continue_work with reason="${reason}" and delaySeconds=5. ${N}`),
    callRow('cw-1', 'continue_work', { reason, delaySeconds: 5 }, via, 'run-d'),
    row,
    say(`CW-SCHEDULED ${N}`, 'run-d'),
    user(`[continuation:wake] Turn 1/200. Prior reason: "${reason}"`),
    say(`CW-WOKE ${N}`, 'run-w'),
  ];
}

test('continueWorkChain (R-CW-1..4): the scheduled hop binds in every product form', async (t) => {
  for (const [label, opts] of READABLE) await t.test(label, () => {
    const row = resultRow({ toolCallId: 'cw-1', tool: 'continue_work', payload: { status: 'scheduled', delaySeconds: 5 }, runId: 'run-d', ...opts });
    const chain = continueWorkChain(cwTranscript(row, opts.via), { nonce: N, scheduledMarkers: ['CW-SCHEDULED'], doneMarker: 'CW-WOKE' });
    assert.equal(chain.complete, true, `${label}: ${chain.reason}`);
  });
});

test('continueWorkChain (R-CW-1..4): an unreadable result stops the chain at hop 1', async (t) => {
  for (const [label, build] of UNREADABLE) await t.test(label, () => {
    const row = build({ toolCallId: 'cw-1', tool: 'continue_work', payload: { status: 'scheduled', delaySeconds: 5 }, runId: 'run-d' });
    const chain = continueWorkChain(cwTranscript(row, UNREADABLE_CALL_VIA[label] || 'dispatch'), { nonce: N, scheduledMarkers: ['CW-SCHEDULED'], doneMarker: 'CW-WOKE' });
    assert.equal(chain.complete, false, label);
    assert.equal(chain.reason, 'hop 1: the continue_work result is not "scheduled"', label);
  });
});

// ---------------------------------------------------------------------------
// continueWorkScheduledIndex / cwDelegateSelfHops (R-CW-DELEGATE-SELF-CONTINUATION child)
// ---------------------------------------------------------------------------

function childTranscript(row, via) {
  return [
    user(`[Subagent Task] ${N}`),
    callRow('cw-1', 'continue_work', { reason: `child hop 2 ${N}`, delaySeconds: 5 }, via, 'run-c1'),
    row,
    say(`CHILD-CW-SCHEDULED ${N}`, 'run-c1'),
    user(`[continuation:wake] Turn 1/200. Prior reason: "child hop 2 ${N}"`),
    say(`CHILD-HOP2-DONE ${N}`, 'run-c2'),
  ];
}

test('continueWorkScheduledIndex (DELEGATE-SELF): the child\'s scheduled yield binds in every product form', async (t) => {
  for (const [label, opts] of READABLE) await t.test(label, () => {
    const rows = childTranscript(resultRow({ toolCallId: 'cw-1', tool: 'continue_work', payload: { status: 'scheduled', delaySeconds: 5 }, runId: 'run-c1', ...opts }), opts.via);
    assert.equal(continueWorkScheduledIndex(rows, 'cw-1', 1), 2, label);
    const hops = cwDelegateSelfHops(rows, { rowNonce: N });
    assert.equal(hops.childContinueWorkAccepted, true, `${label}: ${hops.reason}`);
    assert.equal(hops.childHop2Woke, true, `${label}: ${hops.reason}`);
  });
});

test('continueWorkScheduledIndex (DELEGATE-SELF): an unreadable result is not scheduled', async (t) => {
  for (const [label, build] of UNREADABLE) await t.test(label, () => {
    const rows = childTranscript(build({ toolCallId: 'cw-1', tool: 'continue_work', payload: { status: 'scheduled', delaySeconds: 5 }, runId: 'run-c1' }), UNREADABLE_CALL_VIA[label] || 'dispatch');
    assert.equal(continueWorkScheduledIndex(rows, 'cw-1', 1), -1, label);
    assert.equal(cwDelegateSelfHops(rows, { rowNonce: N }).reason, 'continue_work result is not "scheduled"', label);
  });
});

// ---------------------------------------------------------------------------
// createSameRunDelegateTracker (R-CD-2)
// ---------------------------------------------------------------------------

function sameRunOutcome(row, via) {
  const tracker = createSameRunDelegateTracker({ acceptedRunId: 'run-s', nonce: N });
  tracker.observe({ sessionKey: SESSION, message: callRow('cd-1', 'continue_delegate', { task: `silent wake task ${N}`, mode: 'silent-wake', delaySeconds: 5 }, via, 'run-s') });
  return tracker.observe({ sessionKey: SESSION, message: row });
}

test('createSameRunDelegateTracker (R-CD-2): a scheduled delegate on the send run binds in every product form', async (t) => {
  for (const [label, opts] of READABLE) await t.test(label, () => {
    const row = resultRow({ toolCallId: 'cd-1', tool: 'continue_delegate', payload: { status: 'scheduled', mode: 'silent-wake' }, runId: 'run-s', surface: 'event', ...opts });
    const outcome = sameRunOutcome(row, opts.via);
    assert.equal(outcome, 'scheduled', label);
    const evidence = applySameRunDelegateOutcome({}, outcome);
    assert.equal(evidence.typed_delegate_success_same_run, true, label);
  });
});

test('createSameRunDelegateTracker (R-CD-2): an unreadable result is never same-run success', async (t) => {
  for (const [label, build] of UNREADABLE) await t.test(label, () => {
    const row = build({ toolCallId: 'cd-1', tool: 'continue_delegate', payload: { status: 'scheduled', mode: 'silent-wake' }, runId: 'run-s', surface: 'event' });
    assert.notEqual(sameRunOutcome(row, UNREADABLE_CALL_VIA[label] || 'dispatch'), 'scheduled', label);
  });
});

// ---------------------------------------------------------------------------
// request_compaction (R-RC-1, R-RC-2)
// ---------------------------------------------------------------------------

const RC_MEASURED = { status: 'rejected', guard: 'context_threshold', contextUsage: 12, threshold: 70, reason: 'synthetic' };
const rcReason = `R-RC-1 k6 proof nonce ${N}: expected below-threshold structured rejection; do not compact.`;

test('classifyRequestCompactionReceipt / findRequestCompactionReceipt (R-RC-1): the measured rejection reads in every product form', async (t) => {
  for (const [label, opts] of READABLE) await t.test(label, () => {
    const history = [callRow('rc-1', 'request_compaction', { reason: rcReason }, opts.via, 'run-d'), resultRow({ toolCallId: 'rc-1', tool: 'request_compaction', payload: RC_MEASURED, runId: 'run-d', ...opts })];
    const found = findRequestCompactionReceipt(history, { rowNonce: N });
    assert.equal(found.kind, 'threshold_rejected', label);
    assert.deepEqual(found.receipt, RC_MEASURED, label);
    const event = { message: resultRow({ toolCallId: 'rc-1', tool: 'request_compaction', payload: RC_MEASURED, runId: 'run-d', surface: 'event', ...opts }) };
    assert.equal(classifyRequestCompactionReceipt(event, { toolCallId: 'rc-1' }).kind, 'threshold_rejected', `${label} (event)`);
  });
});

test('classifyRequestCompactionReceipt / findRequestCompactionReceipt (R-RC-1): an unreadable result is never a threshold receipt', async (t) => {
  for (const [label, build] of UNREADABLE) await t.test(label, () => {
    const via = UNREADABLE_CALL_VIA[label] || 'dispatch';
    const row = build({ toolCallId: 'rc-1', tool: 'request_compaction', payload: RC_MEASURED, runId: 'run-d', surface: 'event' });
    const found = findRequestCompactionReceipt([callRow('rc-1', 'request_compaction', { reason: rcReason }, via, 'run-d'), row], { rowNonce: N });
    assert.notEqual(found.kind, 'threshold_rejected', label);
    assert.notEqual(classifyRequestCompactionReceipt({ message: row }, { toolCallId: 'rc-1' }).kind, 'threshold_rejected', `${label} (event)`);
  });
});

test('the dispatcher\'s own details (the catalog entry) are never the request_compaction receipt (run 44245772142 R-RC-1)', () => {
  const row = resultRow({ toolCallId: 'rc-1', tool: 'request_compaction', payload: RC_MEASURED, via: 'dispatch', surface: 'event' });
  const result = classifyRequestCompactionReceipt({ message: row }, { toolCallId: 'rc-1' });
  assert.equal(result.receipt?.tool, undefined, 'the receipt is the tool\'s answer, not { tool, result }');
  assert.equal(result.receipt?.guard, 'context_threshold');
});

function rrc2Child(opts, { report = true, accepted = false } = {}) {
  const answer = accepted ? { status: 'compaction_requested', contextUsage: 81, threshold: 70 } : RC_MEASURED;
  return [
    user(`[Subagent Task] ${N}`),
    callRow('cw-1', 'continue_work', { reason: `yield ${N}`, delaySeconds: 1 }, opts.via, 'run-c1'),
    resultRow({ toolCallId: 'cw-1', tool: 'continue_work', payload: { status: 'scheduled', delaySeconds: 1 }, runId: 'run-c1', ...opts }),
    user(`[continuation:wake] Turn 1/200. Prior reason: "yield ${N}"`),
    callRow('rc-1', 'request_compaction', { reason: `k6 ${N}` }, opts.via, 'run-c2'),
    resultRow({ toolCallId: 'rc-1', tool: 'request_compaction', payload: answer, runId: 'run-c2', ...opts }),
    ...(report && !accepted ? [say(`REQUEST_COMPACTION_REJECTED_CONTEXT_THRESHOLD ${N} CONTEXT 12 THRESHOLD 70`, 'run-c2')] : []),
    ...(accepted ? [user('[continuation:post-compaction]'), say(`REQUEST_COMPACTION_POST_COMPACTION ${N}`, 'run-c3')] : []),
  ];
}

test('measuredRequestCompactionOutcome / childReportAfterReceipt / childPostCompactionReport (R-RC-2): every product form', async (t) => {
  for (const [label, opts] of READABLE) await t.test(label, () => {
    const rejected = rrc2Child(opts);
    const outcome = measuredRequestCompactionOutcome(rejected, { rowNonce: N });
    assert.equal(outcome.kind, 'threshold_rejected_measured', label);
    assert.equal(outcome.yieldBound, true, label);
    assert.equal(childReportAfterReceipt(rejected, { rowNonce: N }).kind, 'threshold', label);
    const accepted = rrc2Child(opts, { accepted: true });
    assert.equal(measuredRequestCompactionOutcome(accepted, { rowNonce: N }).kind, 'accepted', label);
    assert.ok(childPostCompactionReport(accepted, { rowNonce: N }).index >= 0, label);
  });
});

// ---------------------------------------------------------------------------
// heartbeat_respond (R-CD-4, DELEGATE-SELF parent return)
// ---------------------------------------------------------------------------

test('heartbeatRespondResult / heartbeatAckFromHistory / createHeartbeatAckTracker: every product form', async (t) => {
  const args = { outcome: 'done', notify: false, summary: `TARGET-ACK ${N}` };
  for (const [label, opts] of READABLE) await t.test(label, () => {
    const call = callRow('hb-1', 'heartbeat_respond', args, opts.via, 'run-wake');
    const row = resultRow({ toolCallId: 'hb-1', tool: 'heartbeat_respond', payload: { status: 'accepted', ...args }, runId: 'run-wake', ...opts });
    assert.equal(heartbeatRespondResult(row)?.payload?.status, 'accepted', label);
    const rows = [say(`TARGET-READY ${N}`, 'run-prime'), call, row];
    const receipt = heartbeatAckFromHistory(rows, { sessionKey: SESSION, marker: 'TARGET-ACK', nonce: N, afterIndex: 0, excludeRunIds: ['run-prime'] });
    assert.equal(receipt?.toolCallId, 'hb-1', label);
    const tracker = createHeartbeatAckTracker({ sessionKey: SESSION, marker: 'TARGET-ACK', nonce: N });
    tracker.observe({ sessionKey: SESSION, message: call }, { windowOpen: true, excludeRunIds: ['run-prime'] });
    assert.equal(tracker.observe({ sessionKey: SESSION, message: row }, { windowOpen: true, excludeRunIds: ['run-prime'] })?.toolCallId, 'hb-1', `${label} (live)`);
  });
});

test('heartbeatAckFromHistory: an unreadable heartbeat_respond result binds nothing', async (t) => {
  const args = { outcome: 'done', notify: false, summary: `TARGET-ACK ${N}` };
  for (const [label, build] of UNREADABLE) await t.test(label, () => {
    const via = UNREADABLE_CALL_VIA[label] || 'dispatch';
    // The call itself carries the sentinel in its arguments; only the result may confirm it.
    const rows = [say(`TARGET-READY ${N}`, 'run-prime'), callRow('hb-1', 'heartbeat_respond', args, via, 'run-wake'),
      build({ toolCallId: 'hb-1', tool: 'heartbeat_respond', payload: { status: 'accepted', ...args }, runId: 'run-wake' })];
    assert.equal(heartbeatAckFromHistory(rows, { sessionKey: SESSION, marker: 'TARGET-ACK', nonce: N, afterIndex: 0, excludeRunIds: ['run-prime'] }), null, label);
  });
});

// ---------------------------------------------------------------------------
// R-CD-3 lifeboat receipts (compaction and staging)
// ---------------------------------------------------------------------------

test('compactionOutcome / stagingOutcome (R-CD-3): both receipts read in every product form', async (t) => {
  const token = 'LIFEBOAT-abcd1234';
  for (const [label, opts] of READABLE) await t.test(label, () => {
    const rows = [
      user(`[k6-proof-harness] ${N}`),
      callRow('cd-1', 'continue_delegate', { task: `lifeboat ${token}`, mode: 'post-compaction' }, opts.via, 'run-d'),
      resultRow({ toolCallId: 'cd-1', tool: 'continue_delegate', payload: { status: 'queued-for-compaction', mode: 'post-compaction' }, runId: 'run-d', ...opts }),
      callRow('rc-1', 'request_compaction', { reason: `k6 ${N}` }, opts.via, 'run-d'),
      resultRow({ toolCallId: 'rc-1', tool: 'request_compaction', payload: { status: 'compaction_requested', contextUsage: 81, threshold: 70 }, runId: 'run-d', ...opts }),
    ];
    assert.equal(stagingOutcome(stagingReceiptsFromHistory(rows, token)).staged, true, label);
    assert.equal(compactionOutcome(compactionReceiptsFromHistory(rows, N)).kind, 'accepted', label);
  });
});

// ---------------------------------------------------------------------------
// The fixture builders follow the product bytes
// ---------------------------------------------------------------------------

test('fixture: the ab5a envelope is compact { tool:{id,name,source}, result } with details { tool, result }', () => {
  const row = resultRow({ toolCallId: 'c1', tool: 'continue_work', payload: { status: 'scheduled', delaySeconds: 5 }, via: 'dispatch', surface: 'event' });
  const text = row.content[0].text;
  assert.equal(text.includes('\n  '), false, 'compact JSON at ab5a (tool-search.ts:409-414)');
  const env = JSON.parse(text);
  assert.deepEqual(Object.keys(env).sort(), ['result', 'tool']);
  assert.deepEqual(env.tool, { id: 'openclaw:core:continue_work', name: 'continue_work', source: 'openclaw' });
  assert.equal(env.result.details, undefined, 'the model-visible result drops details (tool-search.ts:402)');
  assert.deepEqual(JSON.parse(env.result.content[0].text), { status: 'scheduled', delaySeconds: 5 });
  assert.deepEqual(row.details.tool, catalogEntry('continue_work'));
  assert.deepEqual(row.details.result, jsonResult({ status: 'scheduled', delaySeconds: 5 }));
});
