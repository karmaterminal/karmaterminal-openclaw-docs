import test from 'node:test';
import assert from 'node:assert/strict';
import { gatewayLifecyclePhase, gatewayLifecycleRunId, gatewayLifecycleSucceeded, gatewayWakeRunId } from '../../lib/gateway-lifecycle.js';

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

test('terminal lifecycle success uses the documented explicit allowlist', async (t) => {
  const cases = [
    ['undefined', undefined, false],
    ['null', null, false],
    ['empty', '', false],
    ['object', {}, false],
    ['array', ['ok'], false],
    ['cancelled', 'cancelled', false],
    ['timeout', 'timeout', false],
    ['rejected', 'rejected', false],
    ['error', 'error', false],
    ['failed', 'failed', false],
    ['failure', 'failure', false],
    ['aborted', 'aborted', false],
    ['completed', 'completed', false],
    ['success', 'success', false],
    ['unknown', 'future-terminal-status', false],
    ['ok', 'ok', true],
    ['uppercase ok', 'OK', true],
  ];
  for (const [name, status, expected] of cases) {
    await t.test(name, () => {
      const terminal = {
        runId: 'send-run-1',
        stream: 'lifecycle',
        data: { phase: 'end', status },
      };
      assert.equal(gatewayLifecycleSucceeded(terminal), expected);
    });
  }

  assert.equal(gatewayLifecycleSucceeded({
    runId: 'send-run-1',
    stream: 'lifecycle',
    data: { phase: 'end', status: 'ok', replayInvalid: true },
  }), true);
});
