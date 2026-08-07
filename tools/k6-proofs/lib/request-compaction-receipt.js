function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonText(value) {
  const text = String(value || '').trim();
  if (!text.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function receiptFromContent(content) {
  if (isRecord(content)) return content;
  if (typeof content === 'string') return parseJsonText(content);
  if (!Array.isArray(content)) return null;

  for (const part of content) {
    if (isRecord(part?.details)) return part.details;
    if (typeof part?.text === 'string') {
      const parsed = parseJsonText(part.text);
      if (parsed) return parsed;
    }
  }
  return null;
}

export function effectiveToolNames(payload) {
  const names = [];
  for (const group of Array.isArray(payload?.groups) ? payload.groups : []) {
    for (const tool of Array.isArray(group?.tools) ? group.tools : []) {
      const name = typeof tool === 'string' ? tool : tool?.id || tool?.name;
      if (typeof name === 'string' && name) names.push(name);
    }
  }
  return [...new Set(names)];
}

export function hasEffectiveTool(payload, expectedName) {
  return effectiveToolNames(payload).includes(expectedName);
}

function toolCallArguments(part) {
  if (isRecord(part?.arguments)) return part.arguments;
  if (typeof part?.arguments === 'string') return parseJsonText(part.arguments);
  if (isRecord(part?.input)) return part.input;
  if (typeof part?.input === 'string') return parseJsonText(part.input);
  return null;
}

export function requestCompactionToolCallIdForNonce(messages, rowNonce) {
  if (typeof rowNonce !== 'string' || !rowNonce) return null;
  const matchingCallIds = new Set();
  let unidentifiedMatch = false;
  for (const message of Array.isArray(messages) ? messages : []) {
    if (message?.role !== 'assistant' || !Array.isArray(message.content)) continue;
    for (const part of message.content) {
      if (part?.type !== 'toolCall') continue;
      if ((part.name || part.toolName) !== 'request_compaction') continue;
      const reason = toolCallArguments(part)?.reason;
      if (typeof reason === 'string' && reason.includes(rowNonce)) {
        if (typeof part.id === 'string' && part.id) matchingCallIds.add(part.id);
        else unidentifiedMatch = true;
      }
    }
  }
  if (unidentifiedMatch || matchingCallIds.size !== 1) return null;
  return [...matchingCallIds][0];
}

/**
 * Classify one sessions.messages session.message event for an authoritative
 * request_compaction tool-result receipt. Assistant prose is intentionally not
 * accepted here: only role=toolResult + toolName=request_compaction can pass.
 */
export function classifyRequestCompactionReceipt(eventPayload) {
  const message = eventPayload?.message || eventPayload?.payload?.message || eventPayload;
  if (!isRecord(message) || message.role !== 'toolResult') return { kind: 'unrelated' };
  if (message.toolName !== 'request_compaction') return { kind: 'unrelated' };

  const receipt = isRecord(message.details)
    ? message.details
    : receiptFromContent(message.content);
  if (!receipt) {
    return {
      kind: 'invalid',
      error: 'request_compaction tool result did not contain a structured receipt',
      toolCallId: message.toolCallId || null,
    };
  }

  if (receipt.status === 'rejected' && receipt.guard === 'context_threshold') {
    return {
      kind: 'threshold_rejected',
      receipt,
      toolCallId: message.toolCallId || null,
    };
  }

  return {
    kind: 'non_threshold_result',
    receipt,
    toolCallId: message.toolCallId || null,
  };
}

export function findRequestCompactionReceipt(messages, { rowNonce, toolCallId } = {}) {
  const items = Array.isArray(messages) ? messages : [];
  const expectedToolCallId = toolCallId || requestCompactionToolCallIdForNonce(items, rowNonce);
  if (!expectedToolCallId) return { kind: 'missing' };

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const result = classifyRequestCompactionReceipt(items[index]);
    if (result.kind === 'unrelated' || result.toolCallId !== expectedToolCallId) continue;
    return { ...result, nonceBound: true };
  }
  return { kind: 'missing' };
}
