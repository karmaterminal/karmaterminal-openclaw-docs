// unwrapToolResult (lib/tool-call-identity.mjs): the one reader of a tool's answer,
// direct or through Tool Search's dispatch_action envelope (openclaw/openclaw#129388 H1).
// Product anchors: openclaw ab5a30ea79 src/agents/tool-search.ts:396-422 (envelope; the
// failure kind is copied into details.status at :418-421), tool-result-error.ts:56-84
// (the failure kind), tool-search-control-result.ts:12-24 (network-sourced text is
// wrapped and capped), src/plugins/tool-metadata.ts:56-71 (core vs plugin sourceName).
import test from 'node:test';
import assert from 'node:assert/strict';
import { unwrapToolResult } from '../lib/tool-call-identity.mjs';
import { DISPATCHER, dispatchedResult, jsonResult, resultRow } from './helpers/tool-search-envelope.mjs';

const ANSWER = { status: 'scheduled', delaySeconds: 5 };
const row = (fields) => resultRow({ toolCallId: 'c1', tool: 'continue_work', payload: ANSWER, ...fields });

test('direct and every envelope form read the tool\'s own answer', () => {
  for (const fields of [{}, { via: 'dispatch' }, { via: 'dispatch', compact: false }, { via: 'dispatch', surface: 'event' }, { via: 'legacy-tool-call' }]) {
    const read = unwrapToolResult(row(fields), 'continue_work');
    assert.deepEqual(read, { payload: ANSWER, dispatched: Boolean(fields.via && fields.via !== 'direct'), reason: null }, JSON.stringify(fields));
  }
});

test('a direct row: its JSON text, else its details; a provider-namespaced or missing name is still direct', () => {
  assert.deepEqual(unwrapToolResult({ role: 'toolResult', toolName: 'continue_work', content: [], details: ANSWER }, 'continue_work').payload, ANSWER);
  assert.deepEqual(unwrapToolResult({ ...row({}), toolName: 'functions__continue_work' }, 'continue_work').payload, ANSWER);
  const { toolName: _drop, ...unnamed } = row({});
  assert.deepEqual(unwrapToolResult(unnamed, 'continue_work').payload, ANSWER);
  assert.deepEqual(unwrapToolResult({ role: 'toolResult', toolName: 'continue_work', content: JSON.stringify(ANSWER) }, 'continue_work').payload, ANSWER);
});

test('a live dispatcher row whose text is not JSON falls back to its details envelope', () => {
  // Network-sourced control text is wrapped as external content (tool-search-control-result.ts:12-24).
  const live = row({ via: 'dispatch', surface: 'event' });
  const wrapped = { ...live, content: [{ type: 'text', text: '<<<EXTERNAL_UNTRUSTED_CONTENT>>> {"tool":...} [truncated]' }] };
  assert.deepEqual(unwrapToolResult(wrapped, 'continue_work').payload, ANSWER);
  // chat.history drops details: the same row there is unreadable.
  const { details: _drop, ...history } = wrapped;
  assert.equal(unwrapToolResult(history, 'continue_work').payload, null);
  assert.equal(unwrapToolResult(history, 'continue_work').reason, 'the result carries no JSON object');
});

test('a failed inner result: details carry the failure kind beside the envelope; the answer is the tool\'s own', () => {
  // A tool that returns a failed answer normally: the envelope text carries it, and details add status.
  const answer = { status: 'error', error: 'synthetic failure' };
  const live = resultRow({ toolCallId: 'c1', tool: 'continue_work', payload: answer, via: 'dispatch', surface: 'event', failureKind: 'failed' });
  assert.equal(live.details.status, 'failed');
  assert.deepEqual(unwrapToolResult(live, 'continue_work').payload, answer);
  // With unreadable text, the details path reads the same inner answer, never the outer failure kind.
  const result = dispatchedResult('continue_work', jsonResult(answer), { failureKind: 'failed' });
  const wrapped = { role: 'toolResult', toolCallId: 'c1', toolName: DISPATCHER, isError: true, content: [{ type: 'text', text: 'not json' }], details: result.details };
  assert.deepEqual(unwrapToolResult(wrapped, 'continue_work').payload, answer);
});

test('every unreadable shape names why', () => {
  const env = (overrides) => row({ via: 'dispatch', envelope: overrides });
  const text = (value) => ({ ...row({ via: 'dispatch' }), content: [{ type: 'text', text: JSON.stringify(value) }] });
  const cases = [
    ['not a toolResult row', { role: 'assistant', content: [] }, 'continue_work'],
    ['no expected tool to read the result for', row({}), ''],
    ['the result row is named exec, not continue_work', { ...row({}), toolName: 'exec' }, 'continue_work'],
    ['the result carries no JSON object', { ...row({}), content: [{ type: 'text', text: 'scheduled' }] }, 'continue_work'],
    ['a direct result row carries a Tool Search envelope', { ...row({ via: 'dispatch' }), toolName: 'continue_work' }, 'continue_work'],
    ['the dispatcher result carries no { tool, result } envelope', { ...row({}), toolName: DISPATCHER }, 'continue_work'],
    ['the envelope names tool "sessions_spawn", not continue_work', env({ name: 'sessions_spawn', id: 'openclaw:core:sessions_spawn' }), 'continue_work'],
    ['the envelope tool id "mcp:lookalike:continue_work" is not openclaw:core:continue_work', env({ id: 'mcp:lookalike:continue_work', source: 'mcp' }), 'continue_work'],
    ['the envelope tool id "openclaw:lookalike-plugin:continue_work" is not openclaw:core:continue_work', env({ id: 'openclaw:lookalike-plugin:continue_work' }), 'continue_work'],
    ['the envelope tool id "openclaw:core:exec" is not openclaw:core:continue_work', env({ id: 'openclaw:core:exec' }), 'continue_work'],
    ['the envelope tool id "continue_work" is not openclaw:core:continue_work', env({ id: 'continue_work' }), 'continue_work'],
    ['the envelope tool id null is not openclaw:core:continue_work', env({ id: undefined }), 'continue_work'],
    ['the envelope tool source "client" is not openclaw', env({ source: 'client' }), 'continue_work'],
    ['the envelope tool source null is not openclaw', env({ source: undefined }), 'continue_work'],
    ['the envelope result carries no JSON object', text({ tool: { id: 'openclaw:core:continue_work', name: 'continue_work', source: 'openclaw' }, result: { content: [{ type: 'text', text: 'ok' }] } }), 'continue_work'],
    ['the envelope result is itself an envelope', text({ tool: { id: 'openclaw:core:continue_work', name: 'continue_work', source: 'openclaw' }, result: { content: [{ type: 'text', text: JSON.stringify({ tool: { id: 'openclaw:core:continue_work', name: 'continue_work' }, result: { content: [] } }) }] } }), 'continue_work'],
  ];
  for (const [reason, message, tool] of cases) {
    const read = unwrapToolResult(message, tool);
    assert.equal(read.payload, null, reason);
    assert.equal(read.reason, reason);
  }
});
