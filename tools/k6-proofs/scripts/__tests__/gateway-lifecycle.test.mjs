import test from 'node:test';
import assert from 'node:assert/strict';
import { gatewayLifecyclePhase, gatewayLifecycleRunId, gatewayLifecycleSessionKey, gatewayLifecycleSucceeded, gatewayWakeRunId } from '../../lib/gateway-lifecycle.js';

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
  const wake = { runId: 'wake-run-2', sessionKey: 'agent:main:proof', stream: 'lifecycle', data: { phase: 'start' } };
  assert.equal(gatewayLifecyclePhase(terminal), 'end');
  assert.equal(gatewayLifecycleSucceeded(terminal), true);
  assert.equal(gatewayLifecycleSessionKey(wake), 'agent:main:proof');
  assert.equal(gatewayWakeRunId(wake, 'send-run-1', 'agent:main:proof'), 'wake-run-2');
  assert.equal(gatewayWakeRunId(wake, 'send-run-1', 'agent:main:other'), null);
  assert.equal(gatewayWakeRunId({ runId: 'wake-run-2', stream: 'lifecycle', data: { phase: 'start' } }, 'send-run-1', 'agent:main:proof'), null);
  assert.equal(gatewayWakeRunId({ stream: 'lifecycle', data: { phase: 'start', runId: 'nested' } }, 'send-run-1', 'agent:main:proof'), null);
  assert.equal(gatewayWakeRunId({ runId: 'send-run-1', sessionKey: 'agent:main:proof', stream: 'lifecycle', data: { phase: 'start' } }, 'send-run-1', 'agent:main:proof'), null);
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

test('terminal lifecycle success does not fall back to a top-level status', async (t) => {
  for (const [name, data] of [
    ['missing nested status', { phase: 'end' }],
    ['null nested status', { phase: 'end', status: null }],
  ]) {
    await t.test(name, () => {
      assert.equal(gatewayLifecycleSucceeded({
        runId: 'send-run-1',
        stream: 'lifecycle',
        data,
        status: 'ok',
      }), false);
    });
  }
});

test('the live runtime success terminal (no status, aborted:false) succeeds', () => {
  // Captured from the isolated 14d31a81b1 gateway, 2026-10-05 (lifecycle-probe).
  const live = {
    runId: 'lifecycle-probe-1791177834970',
    sessionKey: 'agent:main:proof-disposable',
    stream: 'lifecycle',
    data: {
      phase: 'end', endedAt: 1791177843706, startedAt: 1791177835336, stopReason: 'stop',
      aborted: false, livenessState: 'working', replayInvalid: false,
      terminalReply: { disposition: 'visible', text: 'LIFECYCLE-PROBE' }, executionSettled: true,
    },
  };
  assert.equal(gatewayLifecycleSucceeded(live), true);
  for (const data of [
    { ...live.data, aborted: true },
    { ...live.data, aborted: undefined },
    { ...live.data, error: 'provider failed' },
    { ...live.data, status: 'timed_out', aborted: true, stopReason: 'timeout' },
    { ...live.data, status: 'cancelled', aborted: true },
    { ...live.data, status: 'future-terminal-status' },
    { ...live.data, phase: 'error' },
    { ...live.data, yielded: true, stopReason: 'end_turn', livenessState: 'paused' },
  ]) {
    assert.equal(gatewayLifecycleSucceeded({ ...live, data }), false, JSON.stringify(data));
  }
});

test('R-CD-2 wake binds a session-bound start to the completion record of the SAME run, in live order', async () => {
  const { createSilentWakeBinder, eventRunId } = await import('../../lib/gateway-lifecycle.js');
  // Live order (isolated 14d31a81b1, preview run 2026-10-05): wake run 7db15a55
  // starts at 05:33:18.061; its heartbeat_respond { notify:false, outcome:"done" }
  // is written at 05:33:30.152, after the start.
  const binder = createSilentWakeBinder({ acceptedRunId: 'R-CD-2-send' });
  assert.equal(binder.noteStart('7db15a55-wake', { atMs: 1 }), null);
  assert.deepEqual(binder.noteCompletionRecord('7db15a55-wake'), { runId: '7db15a55-wake', atMs: 1 });

  const reversed = createSilentWakeBinder({ acceptedRunId: 'R-CD-2-send' });
  assert.equal(reversed.noteCompletionRecord('w'), null);
  assert.equal(reversed.noteStart('w', {}).runId, 'w');

  const negatives = createSilentWakeBinder({ acceptedRunId: 'R-CD-2-send' });
  negatives.noteStart('R-CD-2-send', {});
  assert.equal(negatives.noteCompletionRecord('R-CD-2-send'), null, 'the dispatch run never binds');
  negatives.noteStart('wake-a', {});
  assert.equal(negatives.noteCompletionRecord('other-run'), null, 'a record from another run never binds');
  assert.equal(negatives.noteCompletionRecord(null), null, 'a record without run identity never binds');
  assert.equal(negatives.bound(), null);

  assert.equal(eventRunId({ runId: 'env' }), 'env');
  assert.equal(eventRunId({ message: { __openclaw: { runId: 'row' } } }), 'row');
  assert.equal(eventRunId({ data: { runId: 'nested' } }), null);
});

test('R-CD-2 scenario no longer gates the wake start on an already-seen completion record', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../scenarios/r-cd-2-silent-wake.js', import.meta.url), 'utf8');
  assert.equal(src.includes('const wakeRunId = evidence.silent_status_record_observed'), false);
  assert.match(src, /noteCompletionRecord\(eventRunId\(eventData\)\)/);
  assert.match(src, /noteStart\(startRunId/);
});
