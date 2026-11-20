// The tool a transcript toolCall actually invoked (karmaterminal/openclaw-bootstrap#1727,
// harness review F1/N1).
//
// At openclaw f15237ec92, with Tool Search on, only `message` stays a direct
// tool (src/agents/tool-surface-plan.ts:145-150). Every other call, the typed
// continuation tools and sessions_spawn included, is persisted under the raw
// dispatcher name `dispatch_action` (`tool_call` on shipped builds) with
// arguments { id: "<tool>", args } (src/agents/tool-catalog.ts:29,
// src/agents/tool-display-call.ts:5-24). The id is the tool name or its
// catalog id `<source>:<sourceName>:<tool>` (src/agents/tool-search-catalog.ts:193;
// the runtime resolves either, tool-search-runtime.ts:75-103). The toolResult
// row takes the call's raw name (src/agents/session-tool-result-guard.ts:482-486),
// so it says `dispatch_action` too and is tied to its call by toolCallId only.
//
// A matcher that compares only the raw name misses every such call: a check
// that a typed tool was NOT used passes falsely, and a receipt that it WAS used
// fails closed. toolCallTarget unwraps the call the way the product's display
// projection does; each matcher then applies its own name rule to the result.
//
// The RESULT of a dispatched call is wrapped too (openclaw/openclaw#129388,
// lane proof-rows-adjudicate-10 finding H1). At openclaw ab5a30ea79
// src/agents/tool-search.ts:396-422 the dispatcher returns
//   content: one text part, the JSON of { tool: { id, name, source }, result }
//            where `result` is the tool's own result minus its details
//            (compact at ab5a and 9476c7aaf7; pretty-printed at f15237ec92);
//   details: { tool: <catalog entry>, result: <the tool's own result> }, plus
//            `status: <failure kind>` when that result failed.
// The tool's own answer ({"status":"scheduled",...}) is a JSON string inside
// result.content[].text. Every build with a dispatcher has returned this
// envelope; at v2026.7.1-1 `tool_call` returned it through jsonResult, with
// the inner details kept. session.message events keep details; chat.history
// keeps only an allowlisted projection of them (chat-display-projection
// sanitize.ts:504-532, canvas.ts projectToolResultDetails) that drops every key
// of a dispatcher row's details. unwrapToolResult reads both forms for every
// receipt reader.
//
// k6 and Node compatible: no k6 or Node imports.

/** Raw names of the Tool Search dispatcher (tool-display-call.ts:5 TOOL_CALL_DISPLAY_NAMES). */
export const TOOL_SEARCH_DISPATCHER_NAMES = Object.freeze(['dispatch_action', 'tool_call']);
const CATALOG_ID = /^(?:openclaw|mcp|client):[^:]+:(.+)$/u;

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

function rawArguments(part) {
  if (isRecord(part?.arguments)) return part.arguments;
  if (typeof part?.arguments === 'string') return parseJsonRecord(part.arguments) || {};
  if (isRecord(part?.input)) return part.input;
  if (typeof part?.input === 'string') return parseJsonRecord(part.input) || {};
  return {};
}

/** Whether a raw toolCall or toolResult name is the Tool Search dispatcher. */
export function isToolSearchDispatcherName(name) {
  return typeof name === 'string' && TOOL_SEARCH_DISPATCHER_NAMES.includes(name.trim().toLowerCase());
}

/**
 * The tool a `type:"toolCall"` part invoked: { name, args, dispatched }, or
 * null for anything else. A dispatcher call with a string `arguments.id` is
 * that tool, with `arguments.args` as its arguments; any other call is itself.
 */
export function toolCallTarget(part) {
  if (!isRecord(part) || part.type !== 'toolCall') return null;
  const rawName = part.name || part.toolName;
  if (typeof rawName !== 'string' || !rawName) return null;
  const args = rawArguments(part);
  const id = typeof args.id === 'string' ? args.id.trim() : '';
  if (!isToolSearchDispatcherName(rawName) || !id) return { name: rawName, args, dispatched: false };
  return {
    name: id.match(CATALOG_ID)?.[1] ?? id,
    args: isRecord(args.args) ? args.args : {},
    dispatched: true,
  };
}

/** Whether a toolResult row's name can belong to a call of `toolName`: its own name, or the dispatcher's. */
export function toolResultNameAdmits(message, toolName) {
  const name = message?.toolName;
  return name === toolName || isToolSearchDispatcherName(name);
}

// ---------------------------------------------------------------------------
// Tool results
// ---------------------------------------------------------------------------

/** A tool's own name, or a provider-namespaced `<prefix>__<tool>`. */
function isOwnToolName(name, toolName) {
  return typeof name === 'string' && (name === toolName || name.endsWith(`__${toolName}`));
}

/** Tool Search's { tool, result } envelope shape (content text or details). */
function isToolSearchEnvelope(value) {
  return isRecord(value) && isRecord(value.tool) && isRecord(value.result);
}

/** The first text part (or string content) that is a JSON object. */
function structuredText(content) {
  if (typeof content === 'string') return parseJsonRecord(content);
  if (!Array.isArray(content)) return null;
  for (const part of content) {
    if (!isRecord(part) || part.type !== 'text' || typeof part.text !== 'string') continue;
    const parsed = parseJsonRecord(part.text);
    if (parsed) return parsed;
  }
  return null;
}

/**
 * The structured answer of one tool result: its JSON content text, else its
 * details. Both carry the same payload (jsonResult, src/agents/tools/tool-results.ts:10-12);
 * chat.history keeps the text and at most a projection of the details.
 */
function structuredResult(result) {
  return structuredText(result?.content) ?? (isRecord(result?.details) ? result.details : null);
}

/**
 * Why an envelope's tool is not OpenClaw's core `toolName`, or null. Every tool
 * a receipt reads is core-owned at ab5a (created in src/agents/openclaw-tools*.ts
 * with no plugin metadata, so classifyAgentToolSource names it "core",
 * src/plugins/tool-metadata.ts:56-71), and every envelope form carries `source`.
 * So the id must be exactly `openclaw:core:<tool>` (tool-search-catalog.ts:195)
 * and the source `openclaw`: a same-named MCP, client or plugin tool is never it.
 */
function envelopeToolMismatch(tool, toolName) {
  if (tool.name !== toolName) return `the envelope names tool ${JSON.stringify(tool.name ?? null)}, not ${toolName}`;
  if (tool.id !== `openclaw:core:${toolName}`) {
    return `the envelope tool id ${JSON.stringify(tool.id ?? null)} is not openclaw:core:${toolName}`;
  }
  if (tool.source !== 'openclaw') return `the envelope tool source ${JSON.stringify(tool.source ?? null)} is not openclaw`;
  return null;
}

/**
 * The structured answer a toolResult row gives for a call of `toolName`:
 * { payload, dispatched, reason }. The caller pairs the row with its call by
 * toolCallId first; this reads the answer.
 *   - A row named after the tool (or with no name) is direct: its JSON content
 *     text, else its details.
 *   - A row named after the dispatcher must carry the { tool, result }
 *     envelope, whose tool is OpenClaw's core `toolName`; the answer is the
 *     inner result's JSON text, else its details.
 * Everything else is unreadable (payload null, with the reason): a row named
 * after another tool, a dispatcher row without an envelope, an envelope for
 * another tool or source, an envelope inside an envelope, an envelope on a
 * direct row, and a result with no JSON object at all.
 */
export function unwrapToolResult(message, toolName) {
  const unreadable = (reason, dispatched = false) => ({ payload: null, dispatched, reason });
  if (!isRecord(message) || String(message.role || '').toLowerCase() !== 'toolresult') return unreadable('not a toolResult row');
  if (typeof toolName !== 'string' || !toolName) return unreadable('no expected tool to read the result for');
  const name = message.toolName;
  const dispatched = isToolSearchDispatcherName(name);
  if (!dispatched && typeof name === 'string' && name && !isOwnToolName(name, toolName)) {
    return unreadable(`the result row is named ${name}, not ${toolName}`);
  }
  const outer = structuredResult(message);
  if (!outer) return unreadable('the result carries no JSON object', dispatched);
  if (!dispatched) {
    return isToolSearchEnvelope(outer)
      ? unreadable('a direct result row carries a Tool Search envelope')
      : { payload: outer, dispatched: false, reason: null };
  }
  if (!isToolSearchEnvelope(outer)) return unreadable('the dispatcher result carries no { tool, result } envelope', true);
  const mismatch = envelopeToolMismatch(outer.tool, toolName);
  if (mismatch) return unreadable(mismatch, true);
  const inner = structuredResult(outer.result);
  if (!inner) return unreadable('the envelope result carries no JSON object', true);
  if (isToolSearchEnvelope(inner)) return unreadable('the envelope result is itself an envelope', true);
  return { payload: inner, dispatched: true, reason: null };
}
