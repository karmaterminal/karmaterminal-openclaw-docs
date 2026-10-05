// R-CW-DELEGATE-SELF-CONTINUATION hop receipts from the delegate child's own
// transcript (chat.history).
//
// The child writes CHILD-CW-SCHEDULED and CHILD-HOP2-DONE in its own turns, so a
// subscription to the parent session cannot see them (at openclaw cut
// 41b8d69b90 the parent stream also carries no childSessionKey). The shape is:
//   turn 1 (spawn run):  continue_work toolCall, reason carries the nonce;
//                        toolResult {"status":"scheduled", delaySeconds}
//                        (src/agents/tools/continue-work-tool.ts:86-95);
//                        assistant "CHILD-CW-SCHEDULED <nonce>"
//   turn 2 (work wake):  user "[continuation:wake] ... Prior reason: "<reason>""
//                        (src/auto-reply/continuation/work-dispatch-execution.ts
//                        :197-215; a normal turn, not a heartbeat, :364-388);
//                        assistant "CHILD-HOP2-DONE <nonce>"
// chat.history keeps the toolResult content text and drops details
// (chat-display-projection.sanitize.ts:431-463), so the result is parsed from text.

import { continueWorkYieldForNonce, wakeTurnIndexAfter } from './request-compaction-receipt.js';
import { hasExactSentinelText } from './wake-turn-receipt.mjs';

function role(message) {
  return String(message?.role || '').toLowerCase();
}

function plainText(message) {
  const content = message?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter((part) => part && part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text).join('\n');
}

function parseJson(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed.startsWith('{')) return null;
  try { return JSON.parse(trimmed); } catch { return null; }
}

/** Index of the continue_work toolResult with status "scheduled" for toolCallId, or -1. */
export function continueWorkScheduledIndex(messages, toolCallId, afterIndex = -1) {
  const list = Array.isArray(messages) ? messages : [];
  if (!toolCallId) return -1;
  for (let i = afterIndex + 1; i < list.length; i += 1) {
    const m = list[i];
    if (role(m) !== 'toolresult' || m.toolName !== 'continue_work' || m.toolCallId !== toolCallId) continue;
    if (m.isError === true) return -1;
    const payload = parseJson(plainText(m)) || (m.details && typeof m.details === 'object' ? m.details : null);
    return payload?.status === 'scheduled' ? i : -1;
  }
  return -1;
}

/** First assistant message after `from` and before the next user message with the exact sentinel. */
function sentinelInTurn(messages, from, marker, nonce) {
  for (let i = from + 1; i < messages.length; i += 1) {
    if (role(messages[i]) === 'user') return -1;
    if (role(messages[i]) === 'assistant' && hasExactSentinelText(plainText(messages[i]), marker, nonce)) return i;
  }
  return -1;
}

/**
 * Both hops, in order, from the child's own transcript.
 * - childContinueWorkAccepted: exactly one nonce-bound continue_work call, its
 *   toolResult reports "scheduled", and CHILD-CW-SCHEDULED <nonce> follows in
 *   the same turn (before any user message).
 * - childHop2Woke: a "[continuation:wake]" user turn carrying the nonce after
 *   that yield, and CHILD-HOP2-DONE <nonce> in that wake turn.
 */
export function cwDelegateSelfHops(messages, { rowNonce } = {}) {
  const list = Array.isArray(messages) ? messages : [];
  const out = {
    yieldIndex: -1, scheduledResultIndex: -1, scheduledSentinelIndex: -1, wakeIndex: -1, hop2Index: -1,
    childContinueWorkAccepted: false, childHop2Woke: false, reason: null,
  };
  if (typeof rowNonce !== 'string' || !rowNonce) return { ...out, reason: 'no row nonce' };
  const yieldCall = continueWorkYieldForNonce(list, rowNonce);
  if (!yieldCall) return { ...out, reason: 'no single nonce-bound continue_work call in the child transcript' };
  out.yieldIndex = yieldCall.index;
  out.scheduledResultIndex = continueWorkScheduledIndex(list, yieldCall.toolCallId, yieldCall.index);
  if (out.scheduledResultIndex < 0) return { ...out, reason: 'continue_work result is not "scheduled"' };
  out.scheduledSentinelIndex = sentinelInTurn(list, out.scheduledResultIndex, 'CHILD-CW-SCHEDULED', rowNonce);
  if (out.scheduledSentinelIndex < 0) return { ...out, reason: 'CHILD-CW-SCHEDULED not in the turn of the continue_work call' };
  out.childContinueWorkAccepted = true;
  out.wakeIndex = wakeTurnIndexAfter(list, out.scheduledSentinelIndex, rowNonce);
  if (out.wakeIndex < 0) return { ...out, reason: 'no nonce-bound [continuation:wake] turn after the yield' };
  out.hop2Index = sentinelInTurn(list, out.wakeIndex, 'CHILD-HOP2-DONE', rowNonce);
  if (out.hop2Index < 0) return { ...out, reason: 'CHILD-HOP2-DONE not in the wake turn' };
  out.childHop2Woke = true;
  return out;
}
