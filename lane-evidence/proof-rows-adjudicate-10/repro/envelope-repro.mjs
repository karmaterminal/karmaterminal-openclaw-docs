// Offline reproduction for the proof-rows-adjudicate-10 lane (openclaw/openclaw#129388).
//
// Drives the EXACT harness libraries run 44245772142 executed (docs fe8e3c2188f4,
// extracted with `git archive`) with transcripts shaped by openclaw ab5a30ea79 bytes,
// once as a Tool Search dispatch (the shape the emeric live gateway produced) and once
// as a direct call (the shape the f15237ec isolated gateway produced). No gateway, no
// network, no product code runs here: the fixtures are built from the cited product
// lines, and every nonce, id and key below is synthetic.
//
// Usage: node envelope-repro.mjs --lib <dir holding tools/k6-proofs/lib at fe8e3c21>
//
// Product anchors (openclaw ab5a30ea79b776f149e24b1fccab9e79b0a5d299):
//   - tools/tool-results.ts:3-12            jsonResult = { content:[{type:"text", text: JSON.stringify(p,null,2)}], details:p }
//   - tool-search.ts:396-422                 dispatch_action result: content text = JSON of
//                                            { tool:{id,name,source}, result:<inner result minus details> }
//                                            (compact), details = callResult = { tool:<catalog entry>, result:<inner> }
//   - tool-search-runtime.ts:562-588         formatToolSearchControlResult -> textResult(serialized, payload)
//   - tool-search-config.ts:11               Tool Search on when tools.toolSearch is unset
//   - tool-surface-plan.ts:145-152           only `message` stays direct for non-ollama models
//   - core-tool-facts.ts:5                   TOOL_CALL_RAW_TOOL_NAME = "dispatch_action"
//   - tool-search-request.ts:30-88           the dispatcher accepts args, input, "args.*" keys and
//                                            flattened top-level arguments
//   - tools/continue-work-tool.ts:103        continue_work returns jsonResult({ status:"scheduled", delaySeconds })
//   - tools/request-compaction-tool.ts:212-223 unmeasured usage -> { status:"rejected", guard:"context_unmeasured" }

import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const libRoot = argValue('--lib');
if (!libRoot) {
  console.error('usage: node envelope-repro.mjs --lib <dir holding tools/k6-proofs/lib>');
  process.exit(2);
}
const lib = (name) => import(pathToFileURL(path.resolve(libRoot, 'tools/k6-proofs/lib', name)).href);

const { continueWorkChain } = await lib('continue-work-chain.mjs');
const { createToolReceiptTracker, toolReceiptsFromHistory, toolResultPayload } = await lib('sentinel-binding.mjs');
const { continueWorkScheduledIndex } = await lib('cw-delegate-self-receipt.mjs');
const { createSameRunDelegateTracker } = await lib('r-cd-2-same-run-delegate.mjs');
const { classifyRequestCompactionReceipt, findRequestCompactionReceipt } = await lib('request-compaction-receipt.js');
const { toolCallTarget } = await lib('tool-call-identity.mjs');

// ---------------------------------------------------------------------------
// Product-shaped builders (synthetic values only)
// ---------------------------------------------------------------------------

const MARKER = '[k6-proof-harness]';
const NONCE = 'R-CW-1-1700000000000-abcd1234';
const SESSION = 'agent:main:r-cw-1-synthetic';
const RUN = 'R-CW-1-DISPATCH-synthetic';
const CALL_ID = 'call_synthetic0001|fc_synthetic0001';

/** tools/tool-results.ts:10-12 */
function jsonResult(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }], details: payload };
}

function catalogEntry(name, extra = {}) {
  return { id: `openclaw:core:${name}`, source: 'openclaw', sourceName: 'core', name, label: 'Synthetic', description: 'synthetic catalog entry', ...extra };
}

/** tool-search.ts:396-422 at ab5a: the model-visible envelope plus the callResult details. */
function dispatchedResult(name, inner) {
  const entry = catalogEntry(name);
  const { details: _drop, ...modelResult } = inner;
  return {
    content: [{ type: 'text', text: JSON.stringify({ tool: { id: entry.id, name: entry.name, source: entry.source }, result: modelResult }) }],
    details: { tool: entry, result: inner },
  };
}

function toolCallPart(name, args, { dispatched, shape = 'args' }) {
  if (!dispatched) return { type: 'toolCall', id: CALL_ID, name, arguments: args };
  const id = `openclaw:core:${name}`;
  const wrapped = shape === 'args' ? { id, args }
    : shape === 'input' ? { id, input: args }
    : shape === 'dotted' ? Object.fromEntries([['id', id], ...Object.entries(args).map(([k, v]) => [`args.${k}`, v])])
    : shape === 'flattened' ? { id, ...args }
    : shape === 'string-args' ? { id, args: JSON.stringify(args) }
    : null;
  return { type: 'toolCall', id: CALL_ID, name: 'dispatch_action', arguments: wrapped };
}

function toolResultRow(name, inner, { dispatched, keepDetails }) {
  const result = dispatched ? dispatchedResult(name, inner) : inner;
  const row = { role: 'toolResult', toolCallId: CALL_ID, toolName: dispatched ? 'dispatch_action' : name, isError: false, content: result.content, __openclaw: { runId: RUN } };
  // chat.history drops non-canvas details (chat-display-projection.sanitize.ts:504-534); events keep them.
  if (keepDetails) row.details = result.details;
  return row;
}

function user(text) { return { role: 'user', content: [{ type: 'text', text }], __openclaw: { runId: RUN } }; }
function assistant(content) { return { role: 'assistant', content, __openclaw: { runId: RUN } }; }

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

const report = [];
function record(id, rows, observed, expected) {
  assert.deepEqual(observed, expected, `${id}: ${JSON.stringify(observed)} != ${JSON.stringify(expected)}`);
  report.push({ id, rows, observed });
}

// 1. continueWorkChain (R-CW-1/2/3/4; chat.history, details dropped).
const reason = `k6-proof-R-CW-1-${NONCE}`;
function cwTranscript(dispatched) {
  return [
    user(`${MARKER} Call continue_work with reason="${reason}" and delaySeconds=5. ${NONCE}`),
    assistant([toolCallPart('continue_work', { reason, delaySeconds: 5 }, { dispatched })]),
    toolResultRow('continue_work', jsonResult({ status: 'scheduled', delaySeconds: 5 }), { dispatched, keepDetails: false }),
    assistant([{ type: 'text', text: `CW-SCHEDULED ${NONCE}` }]),
    user(`[continuation:wake] Turn 1/999999. Prior reason: "${reason}"`),
    assistant([{ type: 'text', text: `CW-WOKE ${NONCE}` }]),
  ];
}
for (const dispatched of [true, false]) {
  const chain = continueWorkChain(cwTranscript(dispatched), { nonce: NONCE, scheduledMarkers: ['CW-SCHEDULED'], doneMarker: 'CW-WOKE' });
  record(`continueWorkChain/${dispatched ? 'dispatched' : 'direct'}`, ['R-CW-1', 'R-CW-2', 'R-CW-3', 'R-CW-4'],
    { complete: chain.complete, reason: chain.reason },
    dispatched
      ? { complete: false, reason: 'hop 1: the continue_work result is not "scheduled"' }
      : { complete: true, reason: null });
}

// 2. toolResultPayload on the dispatched chat.history row: the envelope, no status.
{
  const row = toolResultRow('continue_work', jsonResult({ status: 'scheduled', delaySeconds: 5 }), { dispatched: true, keepDetails: false });
  const payload = toolResultPayload(row);
  record('toolResultPayload/dispatched', ['shared reader'], { keys: Object.keys(payload).sort(), status: payload.status ?? null }, { keys: ['result', 'tool'], status: null });
}

// 3. createToolReceiptTracker (R-CD-1, R-CD-SILENT; live session.message events keep details).
for (const dispatched of [true, false]) {
  const tracker = createToolReceiptTracker({ sessionKey: SESSION, toolName: 'continue_delegate', argField: 'task', needle: NONCE });
  const task = `child task ${NONCE}`;
  tracker.observe('session.message', { sessionKey: SESSION, message: assistant([toolCallPart('continue_delegate', { task, mode: 'normal', delaySeconds: 1 }, { dispatched })]) });
  const receipt = tracker.observe('session.message', { sessionKey: SESSION, message: toolResultRow('continue_delegate', jsonResult({ status: 'scheduled', mode: 'normal' }), { dispatched, keepDetails: true }) });
  record(`createToolReceiptTracker/${dispatched ? 'dispatched' : 'direct'}`, ['R-CD-1', 'R-CD-SILENT'],
    { status: receipt?.status ?? null, scheduledReceiptObserved: Boolean(receipt && !receipt.isError && receipt.status === 'scheduled') },
    dispatched ? { status: null, scheduledReceiptObserved: false } : { status: 'scheduled', scheduledReceiptObserved: true });
}

// 4. toolReceiptsFromHistory for sessions_spawn (R-CW-TOKEN; chat.history).
for (const dispatched of [true, false]) {
  const task = `child task ${NONCE}`;
  const rows = [
    assistant([toolCallPart('sessions_spawn', { task, runtime: 'subagent', mode: 'run' }, { dispatched })]),
    toolResultRow('sessions_spawn', jsonResult({ status: 'accepted', childSessionKey: 'agent:main:subagent:synthetic', runId: 'child-run' }), { dispatched, keepDetails: false }),
  ];
  const [receipt] = toolReceiptsFromHistory(rows, { toolName: 'sessions_spawn', argField: 'task', needle: NONCE });
  const key = typeof receipt?.payload?.childSessionKey === 'string' ? receipt.payload.childSessionKey : null;
  record(`toolReceiptsFromHistory-sessions_spawn/${dispatched ? 'dispatched' : 'direct'}`, ['R-CW-TOKEN'],
    { status: receipt?.status ?? null, childSessionKey: key, subagentSpawnAccepted: Boolean(receipt && receipt.status === 'accepted' && key) },
    dispatched
      ? { status: null, childSessionKey: null, subagentSpawnAccepted: false }
      : { status: 'accepted', childSessionKey: 'agent:main:subagent:synthetic', subagentSpawnAccepted: true });
}

// 5. continueWorkScheduledIndex (R-CW-DELEGATE-SELF-CONTINUATION child; chat.history).
for (const dispatched of [true, false]) {
  const rows = cwTranscript(dispatched);
  record(`continueWorkScheduledIndex/${dispatched ? 'dispatched' : 'direct'}`, ['R-CW-DELEGATE-SELF-CONTINUATION'],
    { index: continueWorkScheduledIndex(rows, CALL_ID, 1) }, { index: dispatched ? -1 : 2 });
}

// 6. createSameRunDelegateTracker (R-CD-2; live events): the result reader, then the call-side
//    argument shapes ab5a's dispatcher accepts (tool-search-request.ts:30-88).
{
  const task = `silent wake task ${NONCE}`;
  const outcomeFor = (dispatched, shape) => {
    const t = createSameRunDelegateTracker({ acceptedRunId: RUN, nonce: NONCE });
    t.observe({ sessionKey: SESSION, message: assistant([toolCallPart('continue_delegate', { task, mode: 'silent-wake', delaySeconds: 5 }, { dispatched, shape })]) });
    return t.observe({ sessionKey: SESSION, message: toolResultRow('continue_delegate', jsonResult({ status: 'scheduled', mode: 'silent-wake' }), { dispatched, keepDetails: true }) });
  };
  record('sameRunDelegate/direct', ['R-CD-2'], { outcome: outcomeFor(false) }, { outcome: 'scheduled' });
  record('sameRunDelegate/dispatched-args', ['R-CD-2'], { outcome: outcomeFor(true, 'args') }, { outcome: 'failed' });
  for (const shape of ['input', 'dotted', 'flattened', 'string-args']) {
    record(`sameRunDelegate/dispatched-${shape}`, ['R-CD-2'], { outcome: outcomeFor(true, shape) }, { outcome: null });
  }
}

// 7. toolCallTarget on every dispatcher argument shape: which ones still carry the nonce.
{
  const out = {};
  for (const shape of ['args', 'input', 'dotted', 'flattened', 'string-args']) {
    const target = toolCallTarget(toolCallPart('continue_work', { reason, delaySeconds: 5 }, { dispatched: true, shape }));
    out[shape] = { name: target?.name ?? null, reasonBound: typeof target?.args?.reason === 'string' && target.args.reason.includes(NONCE) };
  }
  record('toolCallTarget/shapes', ['R-CW-*', 'R-CD-*', 'R-RC-1'], out, {
    args: { name: 'continue_work', reasonBound: true },
    input: { name: 'continue_work', reasonBound: false },
    dotted: { name: 'continue_work', reasonBound: false },
    flattened: { name: 'continue_work', reasonBound: false },
    'string-args': { name: 'continue_work', reasonBound: false },
  });
}

// 8. classifyRequestCompactionReceipt (R-RC-1; sessions.get/event rows keep details, read first).
{
  const rcReason = `R-RC-1 k6 proof nonce ${NONCE}: expected below-threshold structured rejection; do not compact.`;
  const classify = (dispatched, inner) => {
    const rows = [
      assistant([toolCallPart('request_compaction', { reason: rcReason }, { dispatched })]),
      toolResultRow('request_compaction', jsonResult(inner), { dispatched, keepDetails: true }),
    ];
    const r = findRequestCompactionReceipt(rows, { rowNonce: NONCE });
    return { kind: r.kind, status: r.receipt?.status ?? null, guard: r.receipt?.guard ?? null, receiptToolId: r.receipt?.tool?.id ?? null };
  };
  const measured = { status: 'rejected', guard: 'context_threshold', contextUsage: 13, threshold: 70, reason: 'synthetic' };
  const unmeasured = { status: 'rejected', guard: 'context_unmeasured', cause: 'no_fresh_usage', reason: 'synthetic' };
  record('requestCompaction/direct-measured', ['R-RC-1'], classify(false, measured), { kind: 'threshold_rejected', status: 'rejected', guard: 'context_threshold', receiptToolId: null });
  record('requestCompaction/dispatched-measured', ['R-RC-1'], classify(true, measured), { kind: 'non_threshold_result', status: null, guard: null, receiptToolId: 'openclaw:core:request_compaction' });
  record('requestCompaction/direct-unmeasured', ['R-RC-1'], classify(false, unmeasured), { kind: 'non_threshold_result', status: 'rejected', guard: 'context_unmeasured', receiptToolId: null });
  // The classifier itself, on the live event shape the run's log line shows.
  const evt = { message: toolResultRow('request_compaction', jsonResult(measured), { dispatched: true, keepDetails: true }) };
  const c = classifyRequestCompactionReceipt(evt, { toolCallId: CALL_ID });
  record('classifyRequestCompactionReceipt/dispatched-event', ['R-RC-1'], { kind: c.kind, scenarioStatus: c.receipt?.status || 'invalid' }, { kind: 'non_threshold_result', scenarioStatus: 'invalid' });
}

console.log(JSON.stringify({
  schema: 'proof-rows-adjudicate-10.envelope-repro.v1',
  harnessLibRef: 'karmaterminal-openclaw-docs fe8e3c2188f4a3cb82a7c04c47dab96d49e13955 tools/k6-proofs/lib',
  productShapeRef: 'karmaterminal/openclaw ab5a30ea79b776f149e24b1fccab9e79b0a5d299',
  cases: report.length,
  allExpectationsHeld: true,
  report,
}, null, 2));
