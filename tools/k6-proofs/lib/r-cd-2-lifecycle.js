const SCHEDULED_SENTINEL_PREFIX = 'RCD2-DELEGATE-SCHEDULED';

function eventText(eventData) {
  try {
    return JSON.stringify(eventData || {});
  } catch {
    return '';
  }
}

function transcriptMessageText(eventName, eventData) {
  if (eventName !== 'session.message' || eventData?.message?.role !== 'assistant') {
    return '';
  }
  const content = eventData?.message?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  const texts = [];
  for (const block of content) {
    if (typeof block === 'string') {
      texts.push(block);
    } else if (
      block &&
      typeof block === 'object' &&
      ['text', 'output_text'].includes(block.type) &&
      typeof block.text === 'string'
    ) {
      texts.push(block.text);
    }
  }
  return texts.join('\n');
}

function hasCorrelatedSilentStatusReceipt(eventName, eventData, rowNonce) {
  if (eventName !== 'session.message' || eventData?.message?.role !== 'assistant') {
    return false;
  }
  const content = eventData?.message?.content;
  if (!Array.isArray(content)) return false;
  for (const block of content) {
    if (!block || typeof block !== 'object') continue;
    const name = block.name || block.toolName;
    if (name !== 'continue_status') continue;
    const args = block.arguments || block.input || block.args;
    if (!args || typeof args !== 'object') continue;
    if (
      args.notify === false &&
      args.outcome === 'done' &&
      eventText(args).includes(rowNonce)
    ) {
      return true;
    }
  }
  return false;
}

function isMatchingDispatchLifecycle(eventName, eventData, dispatchRunId) {
  return Boolean(
    eventName === 'agent' &&
      dispatchRunId &&
      eventData?.runId === dispatchRunId,
  );
}

function redactedFailureReceipt(eventName, eventData, dispatchRunId, observedAtMs) {
  const text = eventText(eventData).toLowerCase();
  const matchingLifecycle = isMatchingDispatchLifecycle(
    eventName,
    eventData,
    dispatchRunId,
  );
  const stream = String(eventData?.stream || '').toLowerCase();
  const phase = String(eventData?.data?.phase || '').toLowerCase();
  const livenessState = String(eventData?.data?.livenessState || '').toLowerCase();
  const status = String(
    eventData?.status ||
      eventData?.state ||
      eventData?.outcome ||
      eventData?.data?.status ||
      '',
  ).toLowerCase();
  const lifecycleFailed =
    matchingLifecycle &&
    (stream === 'error' ||
      (stream === 'lifecycle' && ['error', 'failed', 'failure'].includes(phase)) ||
      (stream === 'lifecycle' &&
        phase === 'end' &&
        ['error', 'failed', 'failure'].includes(status)) ||
      (stream === 'lifecycle' &&
        phase === 'end' &&
        (eventData?.data?.replayInvalid === true ||
          eventData?.data?.aborted === true ||
          ['blocked', 'abandoned'].includes(livenessState))));

  if (lifecycleFailed) {
    let kind = 'dispatching-turn-failed';
    if (eventData?.data?.replayInvalid === true) {
      kind = 'dispatching-turn-replay-invalid';
    } else if (eventData?.data?.aborted === true) {
      kind = 'dispatching-turn-aborted';
    } else if (['blocked', 'abandoned'].includes(livenessState)) {
      kind = 'dispatching-turn-not-live';
    } else if (
      text.includes('continue_delegate') &&
      (text.includes('replay-unsafe') || text.includes('enclosing turn was incomplete'))
    ) {
      kind = 'delegate-replay-unsafe';
    } else if (text.includes('model override') && text.includes('not allowed')) {
      kind = 'model-policy-rejected';
    } else if (
      (text.includes('provider') || text.includes('openai responses')) &&
      (text.includes('transport error') ||
        text.includes('request failed') ||
        text.includes('connection error'))
    ) {
      kind = 'provider-transport-error';
    }
    return {
      kind,
      sourceEvent: eventName || 'unknown',
      correlation: 'dispatch-run-id',
      observedAtMs,
    };
  }

  if (eventName !== 'session.message') return null;

  const messageText = transcriptMessageText(eventName, eventData).toLowerCase();
  let kind = null;
  if (
    messageText.includes('continue_delegate') &&
    (messageText.includes('replay-unsafe') ||
      messageText.includes('enclosing turn was incomplete'))
  ) {
    kind = 'delegate-replay-unsafe';
  } else if (
    messageText.includes('model override') &&
    messageText.includes('not allowed')
  ) {
    kind = 'model-policy-rejected';
  } else if (
    (messageText.includes('provider') || messageText.includes('openai responses')) &&
    (messageText.includes('transport error') ||
      messageText.includes('request failed') ||
      messageText.includes('connection error'))
  ) {
    kind = 'provider-transport-error';
  }
  if (kind) {
    return {
      kind,
      sourceEvent: eventName || 'unknown',
      correlation: 'subscribed-session-after-dispatch',
      observedAtMs,
    };
  }

  return null;
}

export function rCd2ScheduledSentinel(rowNonce) {
  return `${SCHEDULED_SENTINEL_PREFIX} ${rowNonce}`;
}

export function isRcd2OutboundChannelDeliveryEvent(eventName, eventData) {
  const lowerName = String(eventName || '').toLowerCase();
  const namedDelivery =
    lowerName.includes('delivery') &&
    (lowerName.includes('channel') ||
      lowerName.includes('message') ||
      lowerName.includes('outbound'));
  if (namedDelivery) return true;
  if (!eventData || typeof eventData !== 'object') return false;

  const channelTarget =
    eventData.channelId ||
    eventData.channel_id ||
    eventData.targetChannel ||
    eventData.deliveryChannel;
  const deliveryStatus = String(
    eventData.deliveryStatus ||
      eventData.delivery_state ||
      eventData.deliveryState ||
      '',
  ).toLowerCase();
  if (Boolean(channelTarget) && ['sent', 'delivered', 'completed'].includes(deliveryStatus)) {
    return true;
  }

  const message = eventData.message;
  if (!message || typeof message !== 'object') return false;
  const isMessageToolResult =
    ['tool', 'toolResult'].includes(message.role) && message.toolName === 'message';
  if (
    isMessageToolResult &&
    message.details &&
    typeof message.details === 'object' &&
    message.details.result &&
    typeof message.details.result === 'object' &&
    (typeof message.details.result.messageId === 'string' ||
      (message.details.result.receipt &&
        typeof message.details.result.receipt === 'object'))
  ) {
    return true;
  }
  if (isMessageToolResult && Array.isArray(message.content)) {
    for (const block of message.content) {
      if (!block || typeof block !== 'object' || typeof block.text !== 'string') continue;
      try {
        const parsed = JSON.parse(block.text);
        const result = parsed && typeof parsed === 'object' ? parsed.result : null;
        if (
          result &&
          typeof result === 'object' &&
          (typeof result.messageId === 'string' ||
            (result.receipt && typeof result.receipt === 'object'))
        ) {
          return true;
        }
      } catch {
        // Non-JSON tool result text cannot prove delivery.
      }
    }
  }
  const statuses = [];
  const appendStatus = (value) => {
    if (typeof value === 'string') statuses.push(value.toLowerCase());
  };
  appendStatus(message.details?.deliveryStatus);
  appendStatus(message.details?.delivery?.status);
  if (Array.isArray(message.content)) {
    for (const block of message.content) {
      if (!block || typeof block !== 'object') continue;
      appendStatus(block.details?.deliveryStatus);
      appendStatus(block.result?.deliveryStatus);
      appendStatus(block.result?.details?.deliveryStatus);
    }
  }
  return statuses.some((value) => ['sent', 'delivered', 'completed'].includes(value));
}

export function classifyRcd2LifecycleEvent({
  eventName,
  eventData,
  rowNonce,
  harnessMarker,
  toolAccepted,
  dispatchRunId,
  delegateScheduledAtMs,
  dispatchTurnCompletedAtMs,
  wakeGateMs,
  nowMs,
}) {
  const messageText = transcriptMessageText(eventName, eventData);
  const harnessEcho = messageText.includes(harnessMarker);
  const scheduledSentinel = messageText.includes(rCd2ScheduledSentinel(rowNonce));
  const correlatedReturn =
    !scheduledSentinel &&
    (messageText.includes(rowNonce) ||
      hasCorrelatedSilentStatusReceipt(eventName, eventData, rowNonce));
  const dispatchTurnCompleted =
    isMatchingDispatchLifecycle(eventName, eventData, dispatchRunId) &&
    String(eventData?.stream || '').toLowerCase() === 'lifecycle' &&
    String(eventData?.data?.phase || '').toLowerCase() === 'end' &&
    eventData?.data?.willRetry !== true &&
    eventData?.data?.completed !== false &&
    eventData?.data?.replayInvalid !== true &&
    eventData?.data?.aborted !== true &&
    !['blocked', 'abandoned'].includes(
      String(eventData?.data?.livenessState || '').toLowerCase(),
    );
  const delegateScheduledReceipt =
    toolAccepted &&
    !harnessEcho &&
    messageText.includes(rCd2ScheduledSentinel(rowNonce));
  const parentWakeObserved =
    toolAccepted &&
    !harnessEcho &&
    correlatedReturn &&
    delegateScheduledAtMs !== null &&
    dispatchTurnCompletedAtMs !== null &&
    eventName === 'session.message' &&
    nowMs >= delegateScheduledAtMs + wakeGateMs &&
    nowMs >= dispatchTurnCompletedAtMs;
  const failureReceipt =
    toolAccepted && !harnessEcho
      ? redactedFailureReceipt(eventName, eventData, dispatchRunId, nowMs)
      : null;

  return {
    delegateScheduledReceipt,
    parentWakeObserved,
    dispatchTurnCompleted,
    failureReceipt,
  };
}

export function isRcd2LifecyclePass(evidence) {
  return Boolean(
    evidence &&
      evidence.disposable_session_required &&
      evidence.session_created &&
      evidence.session_unbound_confirmed &&
      evidence.tool_accepted &&
      evidence.delegate_scheduled_receipt &&
      evidence.dispatch_turn_completed &&
      evidence.parent_wake_observed &&
      evidence.post_wake_quiet_completed &&
      !evidence.dispatch_failure_observed &&
      !evidence.channel_message_observed,
  );
}
