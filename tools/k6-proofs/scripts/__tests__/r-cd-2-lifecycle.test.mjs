import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  classifyRcd2LifecycleEvent,
  isRcd2OutboundChannelDeliveryEvent,
  isRcd2LifecyclePass,
  rCd2ScheduledSentinel,
} from '../../lib/r-cd-2-lifecycle.js';

const rowNonce = 'R-CD-2-fixture';
const harnessMarker = '[k6-proof-harness]';

function classify(overrides) {
  return classifyRcd2LifecycleEvent({
    eventName: 'session.message',
    eventData: {},
    rowNonce,
    harnessMarker,
    toolAccepted: true,
    dispatchRunId: 'dispatch-run',
    delegateScheduledAtMs: null,
    dispatchTurnCompletedAtMs: 500,
    wakeGateMs: 5000,
    nowMs: 10000,
    ...overrides,
  });
}

test('R-CD-2 does not treat a generic delayed message after scheduling as a continuation wake', () => {
  const event = classify({
    eventData: {
      sessionKey: `r-cd-2-${rowNonce}`,
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'unrelated activity' }],
        metadata: { continuation: rowNonce },
      },
    },
    delegateScheduledAtMs: 1000,
  });

  assert.equal(event.delegateScheduledReceipt, false);
  assert.equal(event.parentWakeObserved, false);
  assert.deepEqual(
    isRcd2LifecyclePass({
      disposable_session_required: true,
      session_created: true,
      session_unbound_confirmed: true,
      tool_accepted: true,
      delegate_scheduled_receipt: false,
      dispatch_turn_completed: true,
      parent_wake_observed: true,
      post_wake_quiet_completed: true,
      dispatch_failure_observed: false,
      channel_message_observed: false,
    }),
    false,
  );
});

test('R-CD-2 ignores nonce-bearing tool-call arguments when correlating the wake', () => {
  const event = classify({
    eventData: {
      message: {
        role: 'assistant',
        content: [
          {
            type: 'toolCall',
            name: 'continue_delegate',
            arguments: { task: `reply DONE ${rowNonce}` },
          },
        ],
      },
    },
    delegateScheduledAtMs: 1000,
  });

  assert.equal(event.delegateScheduledReceipt, false);
  assert.equal(event.parentWakeObserved, false);
});

test('R-CD-2 rejects user-authored lifecycle sentinels', () => {
  const event = classify({
    eventData: {
      message: {
        role: 'user',
        content: [{ type: 'text', text: rCd2ScheduledSentinel(rowNonce) }],
      },
    },
    delegateScheduledAtMs: 1000,
  });

  assert.equal(event.delegateScheduledReceipt, false);
  assert.equal(event.parentWakeObserved, false);
});

test('R-CD-2 does not reuse a repeated scheduled sentinel as the delayed wake', () => {
  const event = classify({
    eventData: {
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: rCd2ScheduledSentinel(rowNonce) }],
      },
    },
    delegateScheduledAtMs: 1000,
    dispatchTurnCompletedAtMs: 2000,
  });

  assert.equal(event.delegateScheduledReceipt, true);
  assert.equal(event.parentWakeObserved, false);
});

test('R-CD-2 accepts a correlated assistant continue_status receipt as the silent wake', () => {
  const event = classify({
    eventData: {
      message: {
        role: 'assistant',
        content: [
          {
            type: 'toolCall',
            name: 'continue_status',
            arguments: {
              notify: false,
              outcome: 'done',
              status: `completed ${rowNonce}`,
            },
          },
        ],
      },
    },
    delegateScheduledAtMs: 1000,
  });

  assert.equal(event.parentWakeObserved, true);
});

test('R-CD-2 accepts a wake only after the correlated scheduled receipt and delay gate', () => {
  const scheduledAtMs = 1000;
  const scheduled = classify({
    eventData: {
      sessionKey: `r-cd-2-${rowNonce}`,
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: rCd2ScheduledSentinel(rowNonce) }],
      },
    },
    nowMs: scheduledAtMs,
  });
  const wake = classify({
    eventData: {
      sessionKey: `r-cd-2-${rowNonce}`,
      message: { role: 'assistant', content: [{ type: 'text', text: `DONE ${rowNonce}` }] },
    },
    delegateScheduledAtMs: scheduledAtMs,
    nowMs: scheduledAtMs + 5000,
  });

  assert.equal(scheduled.delegateScheduledReceipt, true);
  assert.equal(wake.parentWakeObserved, true);
  assert.equal(
    isRcd2LifecyclePass({
      disposable_session_required: true,
      session_created: true,
      session_unbound_confirmed: true,
      tool_accepted: true,
      delegate_scheduled_receipt: true,
      dispatch_turn_completed: true,
      parent_wake_observed: true,
      post_wake_quiet_completed: true,
      dispatch_failure_observed: false,
      channel_message_observed: false,
      authoritative_lifecycle_receipt: true,
      observed_delegate_mode: 'silent-wake',
      observed_trace_id: 'a'.repeat(32),
      observed_chain_id: 'test-chain',
      observed_delegate_id: 'delegate-1',
      child_fire_or_completion_observed: true,
    }),
    true,
  );
});

test('R-CD-2 emits redacted failure receipts for rejected dispatching turns', () => {
  const providerFailure = classify({
    eventData: {
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'OpenAI Responses transport error' }],
      },
    },
  });
  const replayUnsafe = classify({
    eventData: {
      message: {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Failed 1 queued continue_delegate election(s) because the enclosing turn was incomplete and replay-unsafe',
          },
        ],
      },
    },
  });

  assert.deepEqual(providerFailure.failureReceipt, {
    kind: 'provider-transport-error',
    sourceEvent: 'session.message',
    correlation: 'subscribed-session-after-dispatch',
    observedAtMs: 10000,
  });
  assert.deepEqual(replayUnsafe.failureReceipt, {
    kind: 'delegate-replay-unsafe',
    sourceEvent: 'session.message',
    correlation: 'subscribed-session-after-dispatch',
    observedAtMs: 10000,
  });
  assert.equal(JSON.stringify(replayUnsafe.failureReceipt).includes('continue_delegate'), false);
});

test('R-CD-2 classifies standard dispatch lifecycle errors and requires terminal success', () => {
  const lifecycleError = classify({
    eventName: 'agent',
    eventData: {
      runId: 'dispatch-run',
      stream: 'lifecycle',
      data: { phase: 'error', error: 'private provider details' },
    },
  });
  const lifecycleEnd = classify({
    eventName: 'agent',
    eventData: {
      runId: 'dispatch-run',
      stream: 'lifecycle',
      data: { phase: 'end' },
    },
  });

  assert.deepEqual(lifecycleError.failureReceipt, {
    kind: 'dispatching-turn-failed',
    sourceEvent: 'agent',
    correlation: 'dispatch-run-id',
    observedAtMs: 10000,
  });
  assert.equal(lifecycleEnd.dispatchTurnCompleted, true);
  assert.equal(
    classify({
      eventName: 'agent',
      eventData: {
        runId: 'dispatch-run',
        stream: 'lifecycle',
        data: { phase: 'start', status: 'failed' },
      },
    }).failureReceipt,
    null,
  );
  assert.deepEqual(
    classify({
      eventName: 'agent',
      eventData: {
        runId: 'dispatch-run',
        stream: 'item',
        data: { status: 'failed' },
      },
    }).failureReceipt,
    {
      kind: 'dispatching-turn-failed',
      sourceEvent: 'agent',
      correlation: 'dispatch-run-id',
      observedAtMs: 10000,
    },
  );
  assert.equal(
    classify({
      eventName: 'agent',
      eventData: {
        runId: 'another-run',
        stream: 'lifecycle',
        data: { phase: 'error', error: 'OpenAI Responses transport error' },
      },
    }).failureReceipt,
    null,
  );
  assert.equal(
    isRcd2LifecyclePass({
      disposable_session_required: true,
      session_created: true,
      session_unbound_confirmed: true,
      tool_accepted: true,
      delegate_scheduled_receipt: true,
      dispatch_turn_completed: false,
      parent_wake_observed: true,
      post_wake_quiet_completed: true,
      dispatch_failure_observed: false,
      channel_message_observed: false,
    }),
    false,
  );
});

test('R-CD-2 does not pass before the bounded post-wake quiet window completes', () => {
  assert.equal(
    isRcd2LifecyclePass({
      disposable_session_required: true,
      session_created: true,
      session_unbound_confirmed: true,
      tool_accepted: true,
      delegate_scheduled_receipt: true,
      dispatch_turn_completed: true,
      parent_wake_observed: true,
      post_wake_quiet_completed: false,
      dispatch_failure_observed: false,
      channel_message_observed: false,
    }),
    false,
  );
});

test('R-CD-2 cannot pass without an unbound disposable session receipt', () => {
  assert.equal(
    isRcd2LifecyclePass({
      disposable_session_required: true,
      session_created: true,
      session_unbound_confirmed: false,
      tool_accepted: true,
      delegate_scheduled_receipt: true,
      dispatch_turn_completed: true,
      parent_wake_observed: true,
      post_wake_quiet_completed: true,
      dispatch_failure_observed: false,
      channel_message_observed: false,
    }),
    false,
  );
});

test('R-CD-2 rejects replay-invalid or abandoned terminal lifecycle events', () => {
  const invalidEnd = classify({
    eventName: 'agent',
    eventData: {
      runId: 'dispatch-run',
      stream: 'lifecycle',
      data: {
        phase: 'end',
        replayInvalid: true,
        aborted: true,
        livenessState: 'abandoned',
      },
    },
  });

  assert.equal(invalidEnd.dispatchTurnCompleted, false);
  assert.deepEqual(invalidEnd.failureReceipt, {
    kind: 'dispatching-turn-replay-invalid',
    sourceEvent: 'agent',
    correlation: 'dispatch-run-id',
    observedAtMs: 10000,
  });
});

test('R-CD-2 recognizes status-only outbound delivery receipts', () => {
  assert.equal(
    isRcd2OutboundChannelDeliveryEvent('channel.delivery', {
      channelId: 'proof-channel',
      deliveryStatus: 'delivered',
    }),
    true,
  );
  assert.equal(
    isRcd2OutboundChannelDeliveryEvent('session.message', {
      message: {
        role: 'tool',
        content: [
          {
            type: 'toolResult',
            result: { details: { deliveryStatus: 'sent' } },
          },
        ],
      },
    }),
    true,
  );
  assert.equal(
    isRcd2OutboundChannelDeliveryEvent('session.message', {
      message: {
        role: 'toolResult',
        toolName: 'message',
        details: {
          result: {
            receipt: {
              primaryPlatformMessageId: 'public-message-id',
            },
            messageId: 'public-message-id',
          },
        },
      },
    }),
    true,
  );
  assert.equal(
    isRcd2OutboundChannelDeliveryEvent('session.message', {
      message: {
        role: 'toolResult',
        toolName: 'message',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              result: {
                receipt: {
                  primaryPlatformMessageId: 'public-message-id',
                },
                messageId: 'public-message-id',
              },
            }),
          },
        ],
      },
    }),
    true,
  );
});

test('R-CD-2 handleSummary stays provisional until the strict lifecycle receipt resolves it', async () => {
  const scenario = await readFile(
    new URL('../../scenarios/r-cd-2-silent-wake.js', import.meta.url),
    'utf8',
  );

  assert.match(scenario, /verdict: 'PARTIAL-candidate'/);
  assert.match(scenario, /r-cd-2-lifecycle-receipt\.json/);
  assert.doesNotMatch(scenario, /finalEvidence/);
  assert.match(scenario, /postWakeQuietMs < 1000/);
  assert.match(scenario, /postWakeQuietMs > 30000/);
});
