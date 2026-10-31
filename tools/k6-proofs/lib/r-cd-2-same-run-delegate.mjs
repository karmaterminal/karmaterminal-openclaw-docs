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

const TOOL = 'continue_delegate';

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toolNameMatches(name) {
  return typeof name === 'string' && (name === TOOL || name.endsWith(`__${TOOL}`));
}

function argsRecord(args) {
  if (isRecord(args)) return args;
  if (typeof args === 'string') {
    try { const parsed = JSON.parse(args); return isRecord(parsed) ? parsed : {}; } catch { return {}; }
  }
  return {};
}

function resultStatus(message) {
  const parts = Array.isArray(message.content) ? message.content
    : typeof message.content === 'string' ? [{ type: 'text', text: message.content }] : [];
  for (const part of parts) {
    if (!isRecord(part) || part.type !== 'text' || typeof part.text !== 'string') continue;
    const text = part.text.trim();
    if (!text.startsWith('{')) continue;
    try {
      const parsed = JSON.parse(text);
      if (isRecord(parsed) && typeof parsed.status === 'string') return parsed.status;
    } catch { /* not JSON */ }
  }
  if (isRecord(message.details) && typeof message.details.status === 'string') return message.details.status;
  return null;
}

/**
 * Tracks the accepted send run's continue_delegate call and result.
 * observe(eventData) returns 'scheduled' when a nonce-bound call's result on the
 * same run reports status "scheduled", 'failed' when that result is an error or
 * another status, otherwise null.
 */
export function createSameRunDelegateTracker({ acceptedRunId, nonce }) {
  const calls = new Set();
  return {
    observe(eventData) {
      if (!acceptedRunId || !nonce || !isRecord(eventData)) return null;
      const message = eventData.message;
      if (!isRecord(message)) return null;
      if (messageRunId(message, eventData) !== acceptedRunId) return null;
      const role = String(message.role || '').toLowerCase();
      if (role === 'assistant' && Array.isArray(message.content)) {
        for (const part of message.content) {
          if (!isRecord(part) || part.type !== 'toolCall' || typeof part.id !== 'string') continue;
          if (!toolNameMatches(part.name || part.toolName)) continue;
          const task = argsRecord(part.arguments).task;
          if (typeof task === 'string' && task.includes(nonce)) calls.add(part.id);
        }
        return null;
      }
      if (role === 'toolresult' && typeof message.toolCallId === 'string' && calls.has(message.toolCallId)) {
        if (message.isError === true) return 'failed';
        return resultStatus(message) === 'scheduled' ? 'scheduled' : 'failed';
      }
      return null;
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
