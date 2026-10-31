// Wake-turn answers given through heartbeat_respond (karmaterminal-openclaw-docs#567).
//
// At openclaw cut 41b8d69b90 a continuation return delivered to a recipient
// session (targeted return, silent-wake enrichment) wakes it through the
// heartbeat path (targeting.ts:229-237, subagent-announce.continuation-return.ts
// :210-231). A heartbeat turn on current builds answers through the
// heartbeat_respond tool, not assistant text
// (src/agents/tools/heartbeat-response-tool.ts):
//   arguments: { outcome: no_change|progress|done|blocked|needs_attention,
//                notify: boolean, summary: string (non-empty),
//                notificationText?, reason?, priority?, nextCheck?, scratch? }
//              (:21-37; aliases notification_text, next_check)
//   result:    textResult(JSON.stringify({ status: "accepted", ...response }, null, 2), details)
//              (:78-105); "accepted" is the only success status, failures are
//              isError toolResults (:54-75).
// Transcript: an assistant part { type: "toolCall", id, name: "heartbeat_respond",
// arguments } (packages/llm-core/src/types.ts:304-313) and a message
// { role: "toolResult", toolCallId, toolName, content: [{ type: "text", text }],
// details?, isError } (:424-432), each stamped __openclaw.runId
// (session-tool-result-guard.ts:311). chat.history keeps both, keeps the result
// content text and deletes `details` (chat-display-projection.sanitize.ts
// :431-463), so the result is read from its content text. The wake's own user
// row ("[OpenClaw session event]") and the runtime-context row that carries the
// delivered return text are hidden from chat.history and session.message
// (chat-display-projection.history.ts:329-334, 366), so the delivery itself is
// not observable to a reader; notificationText is not mirrored into any
// assistant transcript message (heartbeat-dispatch.ts:605-623,
// deliver-core.ts:214) and the `heartbeat` event that previews it carries no
// sessionKey (heartbeat-events.ts:10-27).
//
// Binding (no looser than the assistant-text path): the sentinel must be exact
// (marker + whitespace + nonce, word-bounded) in the structured notificationText
// or summary of BOTH the toolCall arguments and the accepted toolResult with the
// same toolCallId and the same run, in the expected session, after the row's
// window anchor, and in a run other than the anchor turn's. Text nested in a
// prompt (the harness marker) never counts.
//
// k6 and Node compatible: no k6 or Node imports.

export const HEARTBEAT_RESPOND_TOOL = 'heartbeat_respond';
const HARNESS_MARKER = '[k6-proof-harness]';
const SENTINEL_FIELDS = ['notificationText', 'notification_text', 'summary'];

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function hasExactSentinelText(text, marker, nonce) {
  if (typeof text !== 'string' || !text || text.includes(HARNESS_MARKER)) return false;
  if (!marker || !nonce) return false;
  const pattern = new RegExp(
    `(?:^|[^A-Za-z0-9_-])${escapeRegex(marker)}\\s+${escapeRegex(nonce)}(?=$|[^A-Za-z0-9_-])`,
  );
  return pattern.test(text);
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

function sentinelField(record, marker, nonce) {
  if (!isRecord(record)) return null;
  for (const field of SENTINEL_FIELDS) {
    if (hasExactSentinelText(record[field], marker, nonce)) return field;
  }
  return null;
}

export function messageRunId(message, eventData = null) {
  const meta = isRecord(message?.__openclaw) ? message.__openclaw : null;
  const fromMessage = typeof meta?.runId === 'string' && meta.runId ? meta.runId : null;
  const fromEvent = typeof eventData?.runId === 'string' && eventData.runId ? eventData.runId : null;
  return fromMessage || fromEvent;
}

/** heartbeat_respond toolCall parts of one assistant message. */
export function heartbeatRespondCalls(message) {
  if (!isRecord(message) || String(message.role || '').toLowerCase() !== 'assistant') return [];
  if (!Array.isArray(message.content)) return [];
  return message.content
    .filter((part) => isRecord(part) && part.type === 'toolCall' &&
      (part.name || part.toolName) === HEARTBEAT_RESPOND_TOOL)
    .map((part) => {
      const args = isRecord(part.arguments) ? part.arguments : (parseJsonRecord(part.arguments) || {});
      return { id: typeof part.id === 'string' ? part.id : null, args };
    });
}

/** The heartbeat_respond toolResult in one message, or null. */
export function heartbeatRespondResult(message) {
  if (!isRecord(message) || String(message.role || '').toLowerCase() !== 'toolresult') return null;
  if (message.toolName !== HEARTBEAT_RESPOND_TOOL) return null;
  // chat.history drops details; prefer the content text, fall back to details.
  let payload = null;
  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (isRecord(part) && part.type === 'text') payload = parseJsonRecord(part.text);
      if (payload) break;
    }
  } else if (typeof message.content === 'string') {
    payload = parseJsonRecord(message.content);
  }
  if (!payload && isRecord(message.details)) payload = message.details;
  return {
    toolCallId: typeof message.toolCallId === 'string' ? message.toolCallId : null,
    isError: message.isError === true,
    payload: payload || {},
  };
}

function receipt({ sessionKey, call, result, field, runId, marker, nonce, index }) {
  return {
    eventName: 'session.message',
    sessionKey,
    nonce,
    marker: `${marker} ${nonce}`,
    role: 'toolResult',
    source: 'heartbeat_respond',
    toolCallId: call.id,
    field,
    outcome: result.payload.outcome ?? call.args.outcome ?? null,
    notify: result.payload.notify ?? call.args.notify ?? null,
    runId: runId || null,
    index: Number.isInteger(index) ? index : null,
  };
}

function acceptedResultCarries(result, marker, nonce) {
  if (!result || result.isError) return null;
  if (result.payload.status !== 'accepted') return null;
  return sentinelField(result.payload, marker, nonce);
}

/**
 * The bound heartbeat_respond receipt in a transcript page (chat.history
 * messages, oldest to newest), or null.
 * - afterIndex: the window anchor; both rows must come after it.
 * - excludeRunIds: runs that cannot be the woken turn (e.g. the priming turn).
 * - requireRunId: when true, the call and result must both carry the same runId.
 */
export function heartbeatAckFromHistory(messages, {
  sessionKey,
  marker,
  nonce,
  afterIndex = -1,
  excludeRunIds = [],
  requireRunId = false,
} = {}) {
  const list = Array.isArray(messages) ? messages : [];
  const excluded = new Set(excludeRunIds.filter(Boolean));
  for (let i = afterIndex + 1; i < list.length; i += 1) {
    for (const call of heartbeatRespondCalls(list[i])) {
      if (!call.id || !sentinelField(call.args, marker, nonce)) continue;
      const callRun = messageRunId(list[i]);
      if (callRun && excluded.has(callRun)) continue;
      for (let j = i + 1; j < list.length; j += 1) {
        const result = heartbeatRespondResult(list[j]);
        if (!result || result.toolCallId !== call.id) continue;
        const field = acceptedResultCarries(result, marker, nonce);
        if (!field) break;
        const resultRun = messageRunId(list[j]);
        if (requireRunId && (!callRun || !resultRun)) break;
        if (callRun && resultRun && callRun !== resultRun) break;
        return receipt({ sessionKey, call, result, field, runId: callRun || resultRun, marker, nonce, index: j });
      }
    }
  }
  return null;
}

/**
 * Event-path tracker for one expected session. session.message delivers the
 * assistant toolCall and the toolResult as separate events; a call is recorded
 * only while the window is open and outside excluded runs, and the receipt is
 * the accepted result for that call in the same run.
 */
export function createHeartbeatAckTracker({ sessionKey, marker, nonce }) {
  const calls = {};
  return {
    observe(eventData, { windowOpen = false, excludeRunIds = [] } = {}) {
      if (!isRecord(eventData)) return null;
      const keys = [eventData.sessionKey, eventData.session].filter((v) => typeof v === 'string' && v);
      if ([...new Set(keys)].length !== 1 || keys[0] !== sessionKey) return null;
      const message = eventData.message;
      const runId = messageRunId(message, eventData);
      const excluded = new Set(excludeRunIds.filter(Boolean));
      for (const call of heartbeatRespondCalls(message)) {
        if (!windowOpen || !call.id || !sentinelField(call.args, marker, nonce)) continue;
        if (runId && excluded.has(runId)) continue;
        calls[call.id] = { call, runId };
      }
      const result = heartbeatRespondResult(message);
      if (!result || !result.toolCallId || !calls[result.toolCallId]) return null;
      const { call, runId: callRun } = calls[result.toolCallId];
      const field = acceptedResultCarries(result, marker, nonce);
      if (!field) return null;
      if (callRun && runId && callRun !== runId) return null;
      return receipt({ sessionKey, call, result, field, runId: callRun || runId, marker, nonce });
    },
  };
}
