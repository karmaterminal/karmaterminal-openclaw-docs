import test from 'node:test';
import assert from 'node:assert/strict';
import { markerReturn } from '../lib/journal-return-binding.mjs';

test('review: a dispatcher echo carrying marker+session must not fake an offline journal return', () => {
  const marker = 'RCD_REVIEW_ECHO_MARKER';
  const journal = [
    `dispatcher copy: delegated ${marker} session=agent:main:subagent:review-child`,
    `[continuation:targeted-return] Delivered to agent:main:main from agent:main:subagent:review-child`,
  ].join('\n');

  const bound = markerReturn(journal, marker);
  assert.equal(bound.writer, null);
  assert.equal(bound.bound, false);
});
