// R-CD-2 same-run delegate success, from the send run's own continue_delegate
// tool call and its tool result (transcript rows delivered as session.message).
//
// The scenario used to infer success only from a notify:false/done completion
// record on the accepted send run, but the current product writes that record
// from the WAKE run (docs #572), so same-run success could never be observed.
// The send run's own evidence is its continue_delegate toolCall (the task
// carries the row nonce) and the toolResult for that toolCallId:
//   assistant part { type:"toolCall", id, name:"continue_delegate", arguments:{ task } }
//   { role:"toolResult", toolCallId, toolName, isError?, content:[{ type:"text", text:'{"status":"scheduled",...}' }] }
// both stamped __openclaw.runId. Success = a nonce-bound call and its
// non-error result with status "scheduled", both on the accepted send run.

import { messageRunId } from './wake-turn-receipt.mjs';

const DELEGATE = 'continue_delegate';

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function record(value) {
  if (isRecord(value)) return value;
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); return isRecord(parsed) ? parsed : {}; } catch { /* text */ }
  }
  return {};
}
function parts(message) {
  return Array.isArray(message.content) ? message.content : [];
}
function resultObject(message) {
  for (const part of parts(message)) {
    if (part?.type !== 'text') continue;
    const parsed = record(part.text);
    if (Object.keys(parsed).length) return parsed;
  }
  return record(message.details);
}
function toolId(entry) {
  return entry?.id || entry?.toolId || entry?.name || entry?.toolName;
}
function isTool(name, suffix) {
  return typeof name === 'string' && (name === suffix || name.endsWith(`__${suffix}`));
}
function discoveredId(value) {
  const queue = [value];
  while (queue.length) {
    const item = queue.shift();
    if (!isRecord(item)) continue;
    if (isTool(item.name || item.toolName, DELEGATE)) return toolId(item);
    for (const child of Object.values(item)) {
      if (Array.isArray(child)) queue.push(...child);
      else if (isRecord(child)) queue.push(child);
    }
  }
  return null;
}

/** Only deferred discovery followed by tool_call on the accepted run counts. */
export function createSameRunDelegateTracker({ acceptedRunId, nonce }) {
  const searches = new Set();
  const discovered = new Set();
  const invokes = new Map();
  return {
    observe(eventData) {
      if (!acceptedRunId || !nonce || !isRecord(eventData)) return null;
      const message = eventData.message;
      if (!isRecord(message) || messageRunId(message, eventData) !== acceptedRunId) return null;
      const role = String(message.role || '').toLowerCase();
      if (role === 'assistant') {
        for (const part of parts(message)) {
          if (part?.type !== 'toolCall' || typeof part.id !== 'string') continue;
          if (isTool(part.name || part.toolName, 'tool_search')) {
            const args = record(part.arguments);
            if (JSON.stringify(args).includes(DELEGATE)) searches.add(part.id);
          } else if (isTool(part.name || part.toolName, 'tool_call')) {
            const args = record(part.arguments);
            const selected = args.toolId || args.id || args.name || args.toolName;
            const nested = record(args.args || args.arguments || args.input);
            if (discovered.has(selected) && nested.mode === 'silent-wake' &&
                typeof nested.task === 'string' && nested.task.includes(nonce)) invokes.set(part.id, selected);
          }
        }
        return null;
      }
      if (role !== 'toolresult' || typeof message.toolCallId !== 'string') return null;
      if (searches.has(message.toolCallId) && isTool(message.toolName, 'tool_search') && message.isError !== true) {
        const id = discoveredId(resultObject(message));
        if (id) discovered.add(id);
        return null;
      }
      if (!invokes.has(message.toolCallId) || !isTool(message.toolName, 'tool_call')) return null;
      if (message.isError === true) return 'failed';
      const outer = resultObject(message);
      const target = record(outer.result || outer.output || outer);
      const details = record(target.details);
      const invokedTool = record(outer.tool);
      if (invokedTool.id !== invokes.get(message.toolCallId) ||
          !isTool(invokedTool.name, DELEGATE) || outer.isError === true ||
          target.isError === true || details.isError === true) return 'failed';
      return details.status === 'scheduled' ? 'scheduled' : 'failed';
    },
  };
}

/**
 * The single authority for the same-run delegate evidence fields. A scheduled
 * result proves the delegate spawned on the send run and clears a duplicate
 * call's failure; a failure applies only when nothing has succeeded.
 */
export function applySameRunDelegateOutcome(evidence, outcome) {
  if (outcome === 'scheduled') {
    evidence.typed_delegate_attempted_same_run = true;
    evidence.typed_delegate_success_same_run = true;
    evidence.typed_delegate_failed_same_run = false;
    evidence.typed_delegate_failure_category = null;
  } else if (outcome === 'failed' && evidence.typed_delegate_success_same_run !== true) {
    evidence.typed_delegate_attempted_same_run = true;
    evidence.typed_delegate_failed_same_run = true;
    evidence.typed_delegate_failure_category = 'tool-result-not-scheduled';
  }
  return evidence;
}
