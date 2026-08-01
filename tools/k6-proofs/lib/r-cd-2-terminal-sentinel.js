const IGNORABLE_REASONING_PART_TYPES = new Set(['thinking', 'reasoning']);

function messageText(message) {
  if (typeof message?.content === 'string') return message.content.trim();
  if (!Array.isArray(message?.content) || message.content.length === 0) return null;

  let text = '';
  for (const part of message.content) {
    if (part && IGNORABLE_REASONING_PART_TYPES.has(part.type)) continue;
    if (!part || part.type !== 'text' || typeof part.text !== 'string') return null;
    text += part.text;
  }
  return text.trim();
}

export function observesExactRcd2TerminalSentinel(eventData, expectedSentinel) {
  if (typeof expectedSentinel !== 'string' || expectedSentinel.length === 0) return false;
  const message = eventData?.message || eventData?.payload?.message;
  if (!message || String(message.role || '').toLowerCase() !== 'assistant') return false;
  return messageText(message) === expectedSentinel;
}

export function observesRcd2DispatchTerminalSentinel(
  eventData,
  expectedSentinel,
  { dispatchLifecycleActive, wakeLifecycleObserved } = {},
) {
  return dispatchLifecycleActive === true &&
    wakeLifecycleObserved !== true &&
    observesExactRcd2TerminalSentinel(eventData, expectedSentinel);
}
