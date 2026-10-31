// Structural sentinel binding for k6 proof rows (karmaterminal/openclaw-bootstrap#1727).
//
// A row may not credit a sentinel it finds anywhere in a subscribed event. At
// openclaw f15237ec92 a sessions.messages.subscribe connection receives the
// agent's own tool-call arguments verbatim
// (src/gateway/chat-display-projection.sanitize.ts:182-183,227-233), its
// thinking parts (:227-249), a session snapshot spread into every
// session.message (src/gateway/session-transcript-message.ts:139-149), and,
// for a connection without the session-scoped-events capability, chat and
// agent events for every session (src/gateway/server/client-registry.ts:60-66).
// A delegate task comes back in the return's `task:` line
// (src/agents/internal-events.ts:159-219) and a continue_work reason in the
// wake input (src/auto-reply/continuation/work-dispatch-execution.ts:165-226).
// R-CD-3 credited a "lifeboat return" from its own continue_delegate call.
//
// What the agent cannot author, and what these helpers bind to instead:
//   - a toolResult row, paired with its call by toolCallId;
//   - the run stamp on a transcript row (__openclaw.runId): a woken run is not
//     the run that dispatched it;
//   - the text parts of an assistant row in a named session (never its tool
//     calls, never its thinking, never a user row).
//
// k6 and Node compatible: no k6 or Node imports.

import { toolCallTarget } from './tool-call-identity.mjs';
import { hasExactSentinelText, messageRunId } from './wake-turn-receipt.mjs';

export const HARNESS_MARKER = '[k6-proof-harness]';
/** A token a child invents: no harness-sent text can carry it. */
export const MINTED_TOKEN_PATTERN = /^[a-z0-9]{12}$/;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function role(message) {
  return String(message?.role || '').toLowerCase();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseJsonRecord(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Text of a message's `type:"text"` parts, or its string content. Tool calls and thinking never count. */
export function textParts(message) {
  if (!isRecord(message)) return null;
  const content = message.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return null;
  const parts = content
    .filter((part) => isRecord(part) && part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text);
  return parts.length > 0 ? parts.join('\n') : null;
}

/** The text an assistant row says, or null for any other role. */
export function assistantText(message) {
  return role(message) === 'assistant' ? textParts(message) : null;
}

/** The event's top-level session; two names that disagree bind nothing. */
export function eventSessionKey(eventData) {
  if (!isRecord(eventData)) return null;
  const keys = [eventData.sessionKey, eventData.session]
    .filter((value) => typeof value === 'string' && value.length > 0);
  const unique = [...new Set(keys)];
  return unique.length === 1 ? unique[0] : null;
}

/** Run stamp of a transcript row: its own __openclaw.runId, else the event envelope runId. */
export function rowRunId(message, eventData = null) {
  return messageRunId(message, eventData);
}

function exactIn(text, marker, nonce) {
  return hasExactSentinelText(text, marker, nonce);
}

/**
 * A session.message assistant row, in `sessionKey`, whose text parts carry the
 * exact `<marker> <nonce>` sentinel, stamped with a run outside
 * `excludeRunIds`. Returns { runId } or null.
 */
export function assistantSentinelFromEvent(eventName, eventData, {
  sessionKey,
  marker,
  nonce,
  excludeRunIds = [],
  requireRunId = true,
} = {}) {
  if (eventName !== 'session.message' || !sessionKey || !marker || !nonce) return null;
  if (eventSessionKey(eventData) !== sessionKey) return null;
  const message = eventData.message;
  const text = assistantText(message);
  if (!text || !exactIn(text, marker, nonce)) return null;
  const runId = rowRunId(message, eventData);
  if (requireRunId && !runId) return null;
  if (runId && excludeRunIds.filter(Boolean).includes(runId)) return null;
  return { runId: runId || null };
}

/**
 * The first assistant row after `afterIndex` in a chat.history page (oldest to
 * newest) whose text parts carry the exact sentinel, in a run outside
 * `excludeRunIds`. Returns { index, runId, timestamp } or null.
 */
export function assistantSentinelFromHistory(messages, {
  marker,
  nonce,
  afterIndex = -1,
  excludeRunIds = [],
  requireRunId = true,
} = {}) {
  const list = Array.isArray(messages) ? messages : [];
  const excluded = new Set(excludeRunIds.filter(Boolean));
  for (let i = afterIndex + 1; i < list.length; i += 1) {
    const text = assistantText(list[i]);
    if (!text || !exactIn(text, marker, nonce)) continue;
    const runId = rowRunId(list[i]);
    if (requireRunId && !runId) continue;
    if (runId && excluded.has(runId)) continue;
    return { index: i, runId: runId || null, timestamp: isTimestamp(list[i].timestamp) ? list[i].timestamp : null };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tool receipts
// ---------------------------------------------------------------------------

function toolNameMatches(name, toolName) {
  return typeof name === 'string' && (name === toolName || name.endsWith(`__${toolName}`));
}

/**
 * Whether a toolCall part invoked `toolName`, by name or through Tool Search's
 * dispatcher (lib/tool-call-identity.mjs).
 */
export function isToolCallOf(part, toolName) {
  const target = toolCallTarget(part);
  return Boolean(target) && toolNameMatches(target.name, toolName);
}

/** Whether an assistant row calls `toolName` anywhere, by name or through the dispatcher. */
export function callsTool(message, toolName) {
  return role(message) === 'assistant' && Array.isArray(message.content) &&
    message.content.some((part) => isToolCallOf(part, toolName));
}

/** The nonce-bound calls of `toolName` in one assistant row: [{ id, args }]. */
export function boundToolCalls(message, { toolName, argField, needle }) {
  if (role(message) !== 'assistant' || !Array.isArray(message.content) || !needle) return [];
  return message.content
    .filter((part) => isRecord(part) && typeof part.id === 'string' && part.id && isToolCallOf(part, toolName))
    .map((part) => ({ id: part.id, args: toolCallTarget(part).args }))
    .filter((call) => typeof call.args[argField] === 'string' && call.args[argField].includes(needle));
}

/** The structured payload of a toolResult row: its JSON content text, else its details. */
export function toolResultPayload(message) {
  if (role(message) !== 'toolresult') return null;
  const parts = Array.isArray(message.content) ? message.content
    : typeof message.content === 'string' ? [{ type: 'text', text: message.content }] : [];
  for (const part of parts) {
    if (!isRecord(part) || part.type !== 'text') continue;
    const parsed = parseJsonRecord(part.text);
    if (parsed) return parsed;
  }
  return isRecord(message.details) ? message.details : null;
}

function receiptFor(call, message, extra) {
  const payload = toolResultPayload(message);
  return {
    toolCallId: call.id,
    status: typeof payload?.status === 'string' ? payload.status : null,
    isError: message.isError === true,
    payload: payload || null,
    ...extra,
  };
}

/**
 * Receipts for the nonce-bound calls of `toolName` in a chat.history page:
 * each call (assistant toolCall whose `argField` carries `needle`) paired with
 * the toolResult that names its toolCallId. A result never counts without its
 * bound call. Returns [{ toolCallId, callIndex, resultIndex, runId, status,
 * isError, payload, args }].
 */
export function toolReceiptsFromHistory(messages, { toolName, argField, needle } = {}) {
  const list = Array.isArray(messages) ? messages : [];
  const calls = new Map();
  const receipts = [];
  list.forEach((message, index) => {
    for (const call of boundToolCalls(message, { toolName, argField, needle })) {
      calls.set(call.id, { call, index, runId: rowRunId(message) });
    }
    if (role(message) === 'toolresult' && typeof message.toolCallId === 'string' && calls.has(message.toolCallId)) {
      const bound = calls.get(message.toolCallId);
      receipts.push(receiptFor(bound.call, message, {
        callIndex: bound.index,
        resultIndex: index,
        runId: bound.runId || rowRunId(message),
        args: bound.call.args,
      }));
    }
  });
  return receipts;
}

/**
 * Live counterpart of toolReceiptsFromHistory over session.message events in
 * one session. observe() returns the receipt when the bound call's result
 * arrives, else null.
 */
export function createToolReceiptTracker({ sessionKey, toolName, argField, needle }) {
  const calls = new Map();
  const receipts = [];
  return {
    /** Every bound call seen so far, answered or not: [{ id, args }]. */
    calls() {
      return [...calls.values()].map(({ call }) => ({ id: call.id, args: call.args }));
    },
    observe(eventName, eventData) {
      if (eventName !== 'session.message' || !sessionKey || eventSessionKey(eventData) !== sessionKey) return null;
      const message = eventData.message;
      for (const call of boundToolCalls(message, { toolName, argField, needle })) {
        calls.set(call.id, { call, runId: rowRunId(message, eventData) });
      }
      if (role(message) !== 'toolresult' || typeof message.toolCallId !== 'string' || !calls.has(message.toolCallId)) return null;
      if (receipts.some((r) => r.toolCallId === message.toolCallId)) return null;
      const bound = calls.get(message.toolCallId);
      const receipt = receiptFor(bound.call, message, { runId: bound.runId || rowRunId(message, eventData), args: bound.call.args });
      receipts.push(receipt);
      return receipt;
    },
    receipts() {
      return receipts.slice();
    },
  };
}

/**
 * The texts a requester's own calls carried: one JSON rendering per call's
 * arguments (receipts or calls with `args`). The requester can write a
 * "token" into a task it hands a child and later reproduce it from memory
 * (harness review F2), so a minted token must be absent from these as well
 * as from every harness-sent text.
 */
export function requesterCallTexts(calls) {
  return (Array.isArray(calls) ? calls : [])
    .filter((call) => isRecord(call?.args))
    .map((call) => JSON.stringify(call.args));
}

// ---------------------------------------------------------------------------
// Wakes and minted tokens
// ---------------------------------------------------------------------------

/** A continue_work wake input row (user role, "[continuation:wake]" first) carrying `needle`. */
export function isContinuationWakeInput(message, needle) {
  if (role(message) !== 'user' || !needle) return false;
  const text = textParts(message);
  return typeof text === 'string' && text.startsWith('[continuation:wake]') && text.includes(needle);
}

function isTimestamp(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * The token a session minted in its own assistant text:
 * `<marker> <nonce> TOKEN <12 lowercase letters/digits>`. A token that occurs
 * in any harness-sent text, or in a user row of the same transcript (its spawn
 * task, an injected return), is not minted there and is refused.
 * Returns { token, index, runId, timestamp, reason }.
 */
export function mintedTokenFromHistory(messages, { marker, nonce, sentTexts = [] } = {}) {
  const list = Array.isArray(messages) ? messages : [];
  const none = (reason, index = -1) => ({ token: null, index, runId: null, timestamp: null, reason });
  if (!marker || !nonce) return none('no marker or nonce to bind');
  const pattern = new RegExp(
    `(?:^|[^A-Za-z0-9_-])${escapeRegex(marker)}\\s+${escapeRegex(nonce)}\\s+TOKEN\\s+([A-Za-z0-9]+)(?=$|[^A-Za-z0-9_-])`,
  );
  for (let i = 0; i < list.length; i += 1) {
    const text = assistantText(list[i]);
    if (!text || text.includes(HARNESS_MARKER)) continue;
    const match = text.match(pattern);
    if (!match) continue;
    const token = match[1];
    if (!MINTED_TOKEN_PATTERN.test(token)) return none('the reply carries no 12-character lowercase TOKEN', i);
    const userTexts = list.filter((m) => role(m) === 'user').map((m) => textParts(m));
    const sent = [...sentTexts, ...userTexts].filter((t) => typeof t === 'string');
    if (sent.some((t) => t.toLowerCase().includes(token))) return none('the token appears in harness-sent or user text', i);
    return {
      token,
      index: i,
      runId: rowRunId(list[i]),
      timestamp: isTimestamp(list[i].timestamp) ? list[i].timestamp : null,
      reason: null,
    };
  }
  return none('no assistant reply carries the minted token sentinel');
}

/**
 * Another session reproducing a minted token: an assistant row whose text
 * parts carry the exact `<marker> <nonce> TOKEN <token>`, stamped with a run
 * outside `excludeRunIds`, not earlier than the token itself (gateway
 * timestamps; fail closed when either is missing).
 * Returns { bound, index, runId, reason }.
 */
export function tokenReplyFromHistory(messages, {
  marker,
  nonce,
  token,
  excludeRunIds = [],
  notBeforeTimestamp = null,
} = {}) {
  const list = Array.isArray(messages) ? messages : [];
  const none = (reason) => ({ bound: false, index: -1, runId: null, reason });
  if (!marker || !nonce || !token) return none('no minted token to look for');
  if (!isTimestamp(notBeforeTimestamp)) return none('the minted token has no timestamp; ordering after it cannot be proven');
  const excluded = new Set(excludeRunIds.filter(Boolean));
  let untimed = false;
  for (let i = 0; i < list.length; i += 1) {
    const text = assistantText(list[i]);
    if (!text || !exactIn(text, marker, `${nonce} TOKEN ${token}`)) continue;
    const runId = rowRunId(list[i]);
    if (!runId || excluded.has(runId)) continue;
    if (!isTimestamp(list[i].timestamp)) { untimed = true; continue; }
    if (list[i].timestamp < notBeforeTimestamp) continue;
    return { bound: true, index: i, runId, reason: null };
  }
  return none(untimed
    ? 'a reply carrying the token has no timestamp; ordering after the token cannot be proven'
    : 'no reply outside the excluded runs reproduces the minted token');
}
