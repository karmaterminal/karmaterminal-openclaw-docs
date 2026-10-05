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

// ---------------------------------------------------------------------------
// R-RC-2 measured-wake shape (#562 review, figs).
//
// At openclaw cut 41b8d69b90 request_compaction measures usage from the
// session entry's fresh totalTokens, which is written at turn end
// (src/agents/command/session-store.ts:168-182 via post-run.ts:266). A
// delegated child runs through the gateway `agent` path, whose attempt reads a
// session snapshot taken at attempt start
// (src/agents/command/attempt-execution.continuation.ts:82-88), so on the
// child's FIRST turn usage is null and the tool returns the "unknown" branch:
// { status: "rejected", guard: "context_threshold", reason } with no
// contextUsage / threshold (src/agents/tools/request-compaction-tool.ts:211-217).
// Only a later turn can carry a measured { contextUsage: N, threshold: 70 }
// (request-compaction-tool.ts:219-229; MIN_CONTEXT_THRESHOLD = 0.7 at :26).
// The accepted branch reports status "compaction_requested" (:338-348).
//
// chat.history keeps the toolResult content text (the pretty-printed JSON,
// tool-results.ts:10-11) but drops `details` (chat-display-projection
// sanitize.ts:441-460), so the receipt is parsed from content text.
// ---------------------------------------------------------------------------

export const RC2_ACCEPTED_STATUSES = Object.freeze(['compaction_requested', 'accepted']);

function toolCallsFor(messages, toolName) {
  const calls = [];
  (Array.isArray(messages) ? messages : []).forEach((message, index) => {
    if (message?.role !== 'assistant' || !Array.isArray(message.content)) return;
    for (const part of message.content) {
      if (part?.type !== 'toolCall') continue;
      if ((part.name || part.toolName) !== toolName) continue;
      calls.push({ index, id: typeof part.id === 'string' ? part.id : null, args: toolCallArguments(part) || {} });
    }
  });
  return calls;
}

/**
 * The child's turn-1 yield: exactly one continue_work tool call whose reason
 * carries the row nonce. Returns { index, toolCallId } or null.
 */
export function continueWorkYieldForNonce(messages, rowNonce) {
  if (typeof rowNonce !== 'string' || !rowNonce) return null;
  const calls = toolCallsFor(messages, 'continue_work')
    .filter((call) => typeof call.args.reason === 'string' && call.args.reason.includes(rowNonce));
  if (calls.length !== 1) return null;
  return { index: calls[0].index, toolCallId: calls[0].id };
}

/**
 * Classify the R-RC-2 child receipt for both turns.
 * kinds: missing | invalid | context_unknown | threshold_rejected_measured |
 *        accepted | other
 * yieldBound: the nonce-bound continue_work call precedes the nonce-bound
 * request_compaction call in the same child transcript (same session, same
 * chain: the wake runs on the child session, work-dispatch-execution.ts:540-545).
 */
export function measuredRequestCompactionOutcome(messages, { rowNonce } = {}) {
  const items = Array.isArray(messages) ? messages : [];
  const toolCallId = requestCompactionToolCallIdForNonce(items, rowNonce);
  const callIndex = toolCallId
    ? toolCallsFor(items, 'request_compaction').find((call) => call.id === toolCallId)?.index ?? -1
    : -1;
  const yieldCall = continueWorkYieldForNonce(items, rowNonce);
  const yieldBound = Boolean(yieldCall && callIndex >= 0 && yieldCall.index < callIndex);
  const found = findRequestCompactionReceipt(items, { rowNonce });
  const base = { yieldBound, toolCallId: toolCallId || null, receipt: found.receipt || null, nonceBound: found.nonceBound === true };
  if (found.kind === 'missing') return { ...base, kind: 'missing', measured: false };
  if (found.kind === 'invalid') return { ...base, kind: 'invalid', measured: false };
  const receipt = found.receipt || {};
  const measured = typeof receipt.contextUsage === 'number' && Number.isFinite(receipt.contextUsage) &&
    typeof receipt.threshold === 'number' && Number.isFinite(receipt.threshold);
  if (receipt.status === 'rejected' && receipt.guard === 'context_threshold') {
    if (!measured) return { ...base, kind: 'context_unknown', measured: false };
    return receipt.contextUsage < receipt.threshold
      ? { ...base, kind: 'threshold_rejected_measured', measured: true }
      : { ...base, kind: 'invalid', measured: true };
  }
  if (RC2_ACCEPTED_STATUSES.includes(receipt.status)) return { ...base, kind: 'accepted', measured };
  return { ...base, kind: 'other', measured };
}
