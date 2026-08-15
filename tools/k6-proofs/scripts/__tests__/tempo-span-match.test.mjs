import test from 'node:test';
import assert from 'node:assert/strict';
import { tempoAttributeValue } from '../../lib/public-tempo-trace.mjs';
import {
  TOOL_EXECUTION_SPAN_NAME,
  TOOL_NAME_ATTRIBUTE_KEYS,
  toolSpanDeclaresName,
  toolSpanMatchesName,
  toolSpanNames,
} from '../../lib/tempo-span-match.mjs';

const attr = (key, value) => ({ key, value: { stringValue: value } });
const span = (name, attributes) => ({ name, attributes });

test('both published tool-name attribute keys identify the same span', () => {
  assert.deepEqual(TOOL_NAME_ATTRIBUTE_KEYS, ['gen_ai.tool.name', 'openclaw.toolName']);

  const genAiOnly = span(TOOL_EXECUTION_SPAN_NAME, [attr('gen_ai.tool.name', 'continue_delegate')]);
  const openclawOnly = span(TOOL_EXECUTION_SPAN_NAME, [attr('openclaw.toolName', 'continue_delegate')]);
  const both = span(TOOL_EXECUTION_SPAN_NAME, [
    attr('gen_ai.tool.name', 'continue_delegate'),
    attr('openclaw.toolName', 'continue_delegate'),
  ]);

  for (const candidate of [genAiOnly, openclawOnly, both]) {
    assert.equal(toolSpanMatchesName(candidate, 'continue_delegate', tempoAttributeValue), true);
  }
  assert.deepEqual(toolSpanNames(both, tempoAttributeValue), ['continue_delegate']);
});

test('the continuation path no longer disagrees with the generic tool path', () => {
  // Published corpora carry both keys on one span. The narrower matcher used by
  // continuation rows reported `matched trace lacks the originating <tool> tool
  // span` for spans the wider matcher in the same file accepted.
  const spans = [
    span(TOOL_EXECUTION_SPAN_NAME, [attr('openclaw.toolName', 'continue_work')]),
    span('continuation.work', [attr('reason.hash', 'abc')]),
  ];
  const matched = spans.filter((candidate) => toolSpanMatchesName(candidate, 'continue_work', tempoAttributeValue));
  assert.equal(matched.length, 1);
});

test('a span naming two different tools is never an unambiguous origin', () => {
  const conflicted = span(TOOL_EXECUTION_SPAN_NAME, [
    attr('gen_ai.tool.name', 'continue_delegate'),
    attr('openclaw.toolName', 'continue_work'),
  ]);
  assert.deepEqual(toolSpanNames(conflicted, tempoAttributeValue), ['continue_delegate', 'continue_work']);
  assert.equal(toolSpanMatchesName(conflicted, 'continue_delegate', tempoAttributeValue), false);
  assert.equal(toolSpanMatchesName(conflicted, 'continue_work', tempoAttributeValue), false);
});

test('non-tool spans and empty names never match', () => {
  assert.equal(
    toolSpanMatchesName(span('continuation.delegate.dispatch', [attr('gen_ai.tool.name', 'continue_delegate')]),
      'continue_delegate', tempoAttributeValue),
    false,
  );
  assert.equal(toolSpanMatchesName(span(TOOL_EXECUTION_SPAN_NAME, []), 'continue_delegate', tempoAttributeValue), false);
  assert.equal(toolSpanMatchesName(span(TOOL_EXECUTION_SPAN_NAME, [attr('gen_ai.tool.name', '')]),
    '', tempoAttributeValue), false);
  assert.equal(toolSpanMatchesName(null, 'continue_delegate', tempoAttributeValue), false);
  assert.equal(toolSpanMatchesName(span(TOOL_EXECUTION_SPAN_NAME, [attr('gen_ai.tool.name', 'sessions_spawn')]),
    'continue_delegate', tempoAttributeValue), false);
});

test('ambiguity fails closed on the negative control, not just the positive gate', () => {
  // The bracket-token rows assert that NO typed tool span exists. Reusing the
  // exactly-one predicate there inverts it: an ambiguous span reads as "no
  // typed tool span present" and satisfies the assertion it exists to break.
  const conflicted = span(TOOL_EXECUTION_SPAN_NAME, [
    attr('gen_ai.tool.name', 'continue_delegate'),
    attr('openclaw.toolName', 'sessions_spawn'),
  ]);
  assert.equal(toolSpanMatchesName(conflicted, 'continue_delegate', tempoAttributeValue), false);
  assert.equal(toolSpanDeclaresName(conflicted, 'continue_delegate', tempoAttributeValue), true);
  assert.equal(toolSpanDeclaresName(conflicted, 'sessions_spawn', tempoAttributeValue), true);
  assert.equal(toolSpanDeclaresName(conflicted, 'continue_work', tempoAttributeValue), false);
});

test('the declared-name predicate still refuses non-tool spans and empty names', () => {
  assert.equal(
    toolSpanDeclaresName(span('continuation.delegate.dispatch', [attr('gen_ai.tool.name', 'continue_delegate')]),
      'continue_delegate', tempoAttributeValue),
    false,
  );
  assert.equal(toolSpanDeclaresName(span(TOOL_EXECUTION_SPAN_NAME, []), 'continue_delegate', tempoAttributeValue), false);
  assert.equal(toolSpanDeclaresName(null, 'continue_delegate', tempoAttributeValue), false);
  assert.equal(toolSpanDeclaresName(span(TOOL_EXECUTION_SPAN_NAME, [attr('gen_ai.tool.name', 'x')]), '', tempoAttributeValue), false);
});
