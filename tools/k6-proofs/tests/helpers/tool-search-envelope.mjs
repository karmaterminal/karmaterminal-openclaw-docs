// Product-shaped Tool Search transcripts for harness tests (openclaw/openclaw#129388,
// lane proof-rows-adjudicate-10 finding H1).
//
// The #617 fixtures modelled a dispatcher result as the tool's own JSON under
// the name dispatch_action. No product build writes that row, so every reader
// passed its tests and failed live. These builders follow the product bytes
// (openclaw ab5a30ea79b776f149e24b1fccab9e79b0a5d299):
//   - src/agents/tools/tool-results.ts:10-12   jsonResult(p) = { content: [{ type: "text",
//                                               text: JSON.stringify(p, null, 2) }], details: p }
//   - src/agents/tool-search.ts:396-422         dispatch_action result: content text = JSON of
//                                               { tool: { id, name, source }, result: <inner minus details> }
//                                               (compact; pretty-printed only at f15237ec92),
//                                               details = { tool: <catalog entry>, result: <inner> },
//                                               plus status: <failure kind> when the inner result failed (:421)
//   - src/agents/tool-search-catalog.ts:195     catalog id `<source>:<sourceName>:<tool>`
//   - src/agents/core-tool-facts.ts:5           TOOL_CALL_RAW_TOOL_NAME = "dispatch_action"
//   - src/agents/tool-surface-plan.ts:145-151   only `message` stays direct (non-ollama)
//   - v2026.7.1-1 src/agents/tool-search.ts:2361-2367  the older `tool_call` returned
//                                               jsonResult({ tool: <catalog entry>, result: <inner> })
// session.message events keep details; chat.history keeps only an allowlisted projection of them
// (chat-display-projection.sanitize.ts:504-532) that drops every key these rows' details carry.
// Every value here is synthetic.

export const DISPATCHER = 'dispatch_action';

/** tools/tool-results.ts:10-12. */
export function jsonResult(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }], details: payload };
}

/** A compact OpenClaw catalog entry (tool-search-catalog.ts:195, compactToolSearchCatalogEntry). */
export function catalogEntry(tool, overrides = {}) {
  return {
    id: `openclaw:core:${tool}`,
    source: 'openclaw',
    sourceName: 'core',
    name: tool,
    label: 'Synthetic',
    description: `synthetic catalog entry for ${tool}`,
    input: 'synthetic input hint',
    ...overrides,
  };
}

/**
 * The dispatch_action result for `inner` (an AgentToolResult), as ab5a builds it.
 * envelope: overrides for the envelope's tool identity ({ name, id, source }), to
 * build a mismatched envelope; compact: false gives the f15237ec92 bytes;
 * failureKind: the canonical failure kind ab5a copies into details.status when
 * the inner result failed (tool-search.ts:418-421, tool-result-error.ts:56-84).
 */
export function dispatchedResult(tool, inner, { envelope = {}, compact = true, failureKind } = {}) {
  const entry = { ...catalogEntry(tool), ...envelope };
  const { details: _drop, ...modelResult } = inner;
  const text = JSON.stringify({ tool: { id: entry.id, name: entry.name, source: entry.source }, result: modelResult }, null, compact ? undefined : 2);
  const details = { tool: entry, result: inner };
  return { content: [{ type: 'text', text }], details: failureKind ? { ...details, status: failureKind } : details };
}

/** The older `tool_call` result (v2026.7.1-1): jsonResult of { tool: <entry>, result: <inner, details kept> }. */
export function legacyToolCallResult(tool, inner) {
  return jsonResult({ tool: catalogEntry(tool), result: inner });
}

/** A toolCall part through the dispatcher, with the catalog id (the id tool_search returns). */
export function dispatchedCallPart(id, tool, args) {
  return { type: 'toolCall', id, name: DISPATCHER, arguments: { id: `openclaw:core:${tool}`, args } };
}

/**
 * One toolResult row for a call of `tool` answering `payload`.
 *   via: 'direct' | 'dispatch' | 'legacy-tool-call'
 *   surface: 'history' drops details (chat.history); 'event' keeps them.
 *   envelope: envelope tool overrides (dispatch only).
 */
export function resultRow({ toolCallId, tool, payload, via = 'direct', surface = 'history', envelope, compact, failureKind, runId, isError = false, extra = {} }) {
  const inner = jsonResult(payload);
  const result = via === 'dispatch' ? dispatchedResult(tool, inner, { envelope, compact, failureKind })
    : via === 'legacy-tool-call' ? legacyToolCallResult(tool, inner)
    : inner;
  const toolName = via === 'dispatch' ? DISPATCHER : via === 'legacy-tool-call' ? 'tool_call' : tool;
  return {
    role: 'toolResult',
    toolCallId,
    toolName,
    isError,
    content: result.content,
    ...(surface === 'event' ? { details: result.details } : {}),
    ...(runId ? { __openclaw: { runId } } : {}),
    ...extra,
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parsedPayload(row) {
  for (const part of Array.isArray(row.content) ? row.content : []) {
    if (part?.type !== 'text' || typeof part.text !== 'string') continue;
    try {
      const parsed = JSON.parse(part.text);
      if (isRecord(parsed)) return parsed;
    } catch { /* not JSON */ }
  }
  return isRecord(row.details) ? row.details : null;
}

/**
 * The same transcript row as a Tool Search seat records it: every toolCall
 * part other than `keepDirect` goes through the dispatcher, and a direct
 * toolResult of such a tool becomes the dispatcher's envelope. The envelope
 * keeps details when the original row had them or `withDetails` is set (a
 * session.message event). A row already in dispatcher form, or of a direct
 * tool, is returned unchanged.
 *   envelope(tool): optional envelope tool overrides per tool (mismatch cases).
 */
export function toToolSearchRow(row, { keepDirect = ['message'], envelope = () => undefined, compact = true } = {}, { withDetails = false } = {}) {
  if (!isRecord(row)) return row;
  const role = String(row.role || '').toLowerCase();
  if (role === 'assistant' && Array.isArray(row.content)) {
    let changed = false;
    const content = row.content.map((part) => {
      if (!isRecord(part) || part.type !== 'toolCall' || typeof part.name !== 'string') return part;
      if (part.name === DISPATCHER || part.name === 'tool_call' || keepDirect.includes(part.name)) return part;
      changed = true;
      const args = isRecord(part.arguments) ? part.arguments : {};
      return dispatchedCallPart(part.id, part.name, args);
    });
    return changed ? { ...row, content } : row;
  }
  if (role === 'toolresult' && typeof row.toolName === 'string' && row.toolName !== DISPATCHER && row.toolName !== 'tool_call' && !keepDirect.includes(row.toolName)) {
    const payload = parsedPayload(row);
    const inner = payload ? jsonResult(payload) : { content: row.content, details: row.details };
    const result = dispatchedResult(row.toolName, inner, { envelope: envelope(row.toolName), compact });
    const { details: hadDetails, ...rest } = row;
    return {
      ...rest,
      toolName: DISPATCHER,
      content: result.content,
      ...(hadDetails !== undefined || withDetails ? { details: result.details } : {}),
    };
  }
  return row;
}

/** Map every transcript row anywhere in a frame (history pages, session.message events). */
function mapRows(value, mapRow) {
  if (Array.isArray(value)) return value.map((item) => mapRows(item, mapRow));
  if (!isRecord(value)) return value;
  if (typeof value.role === 'string') return mapRow(value);
  const out = {};
  for (const [key, item] of Object.entries(value)) out[key] = mapRows(item, mapRow);
  return out;
}

/**
 * A scripted gateway, as a Tool Search seat: every frame it sends has its
 * transcript rows re-shaped by toToolSearchRow. A dispatched result in an
 * event keeps details (live session.message rows carry them); one in a
 * history page keeps whatever the original row had.
 */
export function viaToolSearch(gateway, options = {}) {
  return (frame) => {
    const replies = gateway(frame);
    if (!Array.isArray(replies)) return replies;
    return replies.map((reply) => {
      const withDetails = reply?.type === 'event';
      return mapRows(reply, (row) => toToolSearchRow(row, options, { withDetails }));
    });
  };
}
