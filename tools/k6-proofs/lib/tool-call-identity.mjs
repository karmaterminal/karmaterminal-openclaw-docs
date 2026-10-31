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
