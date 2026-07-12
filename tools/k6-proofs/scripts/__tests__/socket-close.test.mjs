import test from 'node:test';
import assert from 'node:assert/strict';
import { closeSocketAfterDelay } from '../../lib/socket-close.js';

test('closes immediately instead of scheduling an invalid zero timeout', () => {
  let closed = 0;
  let scheduled = 0;
  const socket = {
    close: () => { closed += 1; },
    setTimeout: () => { scheduled += 1; },
  };

  const wasScheduled = closeSocketAfterDelay(socket, 0);
  assert.equal(wasScheduled, false);
  assert.equal(closed, 1);
  assert.equal(scheduled, 0);
});

test('schedules positive close delays once', () => {
  let callback;
  let delay;
  let closed = 0;
  const socket = {
    close: () => { closed += 1; },
    setTimeout: (next, value) => {
      callback = next;
      delay = value;
    },
  };

  const wasScheduled = closeSocketAfterDelay(socket, 2000);
  assert.equal(wasScheduled, true);
  assert.equal(delay, 2000);
  assert.equal(closed, 0);
  callback();
  assert.equal(closed, 1);
});
