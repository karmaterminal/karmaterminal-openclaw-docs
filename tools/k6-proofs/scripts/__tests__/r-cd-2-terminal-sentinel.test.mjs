import test from 'node:test';
import assert from 'node:assert/strict';
import {
  observesExactRcd2TerminalSentinel,
  observesRcd2DispatchTerminalSentinel,
} from '../../lib/r-cd-2-terminal-sentinel.js';

const sentinel = 'RCD2-DELEGATE-SCHEDULED R-CD-2-example';

test('R-CD-2 accepts only the exact assistant terminal sentinel', () => {
  assert.equal(observesExactRcd2TerminalSentinel({
    message: { role: 'assistant', content: [{ type: 'text', text: sentinel }] },
  }, sentinel), true);
  assert.equal(observesExactRcd2TerminalSentinel({
    payload: { message: { role: 'assistant', content: sentinel } },
  }, sentinel), true);
  assert.equal(observesExactRcd2TerminalSentinel({
    message: {
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: 'private reasoning' },
        { type: 'text', text: sentinel },
      ],
    },
  }, sentinel), true);

  for (const event of [
    { message: { role: 'user', content: sentinel } },
    { message: { role: 'assistant', content: `scheduled: ${sentinel}` } },
    { message: { role: 'assistant', content: `${sentinel} extra` } },
    { message: { role: 'assistant', content: [{ type: 'toolCall', name: 'continue_delegate' }, { type: 'text', text: sentinel }] } },
    { message: { role: 'assistant', content: [{ type: 'text', text: `[k6-proof-harness] ${sentinel}` }] } },
  ]) {
    assert.equal(observesExactRcd2TerminalSentinel(event, sentinel), false);
  }
});

test('R-CD-2 accepts the terminal sentinel only inside the dispatch lifecycle window', () => {
  const event = {
    message: { role: 'assistant', content: [{ type: 'text', text: sentinel }] },
  };
  assert.equal(observesRcd2DispatchTerminalSentinel(
    event,
    sentinel,
    { dispatchLifecycleActive: true, wakeLifecycleObserved: false },
  ), true);
  assert.equal(observesRcd2DispatchTerminalSentinel(
    event,
    sentinel,
    { dispatchLifecycleActive: false, wakeLifecycleObserved: false },
  ), false);
  assert.equal(observesRcd2DispatchTerminalSentinel(
    event,
    sentinel,
    { dispatchLifecycleActive: true, wakeLifecycleObserved: true },
  ), false);
});
