import test from 'node:test';
import assert from 'node:assert/strict';
import { gatewayLifecyclePhase, gatewayLifecycleReplayInvalid, gatewayLifecycleRunId, gatewayLifecycleSucceeded, gatewayWakeRunId } from '../../lib/gateway-lifecycle.js';

test('R-CD-2 accepts only the documented top-level gateway lifecycle runId', () => {
  assert.equal(gatewayLifecycleRunId({ runId: 'send-run-1', stream: 'lifecycle' }), 'send-run-1');
  for (const value of [
    {},
    { run_id: 'legacy-looking' },
    { turnId: 'tool-turn' },
    { data: { runId: 'nested-attempt' } },
    { runId: '' },
  ]) {
    assert.equal(gatewayLifecycleRunId(value), null);
  }
});

test('uses only top-level lifecycle envelopes for terminal and wake identity', () => {
  const terminal = { runId: 'send-run-1', stream: 'lifecycle', data: { phase: 'end', status: 'ok' } };
  const wake = { runId: 'wake-run-2', stream: 'lifecycle', data: { phase: 'start' } };
  assert.equal(gatewayLifecyclePhase(terminal), 'end');
  assert.equal(gatewayLifecycleSucceeded(terminal), true);
  assert.equal(gatewayWakeRunId(wake, 'send-run-1'), 'wake-run-2');
  assert.equal(gatewayWakeRunId({ stream: 'lifecycle', data: { phase: 'start', runId: 'nested' } }, 'send-run-1'), null);
  assert.equal(gatewayWakeRunId({ runId: 'send-run-1', stream: 'lifecycle', data: { phase: 'start' } }, 'send-run-1'), null);
});

test('successful phase=end remains successful when replayInvalid is true', () => {
  const event = {
    runId: 'send-run-1',
    stream: 'lifecycle',
    data: { phase: 'end', status: 'ok', replayInvalid: true },
  };
  assert.equal(gatewayLifecycleSucceeded(event), true);
  assert.equal(gatewayLifecycleReplayInvalid(event), true);
});

test('failed or aborted lifecycle ends remain unsuccessful', () => {
  for (const event of [
    { runId: 'send-run-1', stream: 'lifecycle', data: { phase: 'error', status: 'ok' } },
    { runId: 'send-run-1', stream: 'lifecycle', data: { phase: 'end', status: 'failed' } },
    { runId: 'send-run-1', stream: 'lifecycle', data: { phase: 'end', status: 'error' } },
    { runId: 'send-run-1', stream: 'lifecycle', data: { phase: 'end', status: 'failure' } },
    { runId: 'send-run-1', stream: 'lifecycle', data: { phase: 'end', status: 'aborted' } },
    { runId: 'send-run-1', stream: 'lifecycle', data: { phase: 'end', status: 'ok', aborted: true } },
  ]) {
    assert.equal(gatewayLifecycleSucceeded(event), false);
  }
});
