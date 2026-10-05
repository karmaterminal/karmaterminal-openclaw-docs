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
import { hasExactSentinelText, heartbeatAckFromHistory } from './wake-turn-receipt.mjs';

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

// ---------------------------------------------------------------------------
// Parent-return binding (#570 review).
//
// The return a mode="normal" delegate delivers to its requester is the
// subagent announce of the child's spawned run: the registry runs the announce
// flow when that run's lifecycle cleans up
// (subagents/registry/subagent-registry-lifecycle-announce-cleanup.ts:560) and
// delivers it to the parent as an inter-session `agent` call
// (subagents/announce/subagent-announce-direct-delivery.ts:384-413). That call
// is a normal parent run, not a heartbeat, so the parent answers in assistant
// text; the delivered user row itself is hidden as a completion report
// (chat-display-projection.history.ts:350-354, input-provenance.ts:145-156).
// The child's continue_work wake is driven by work-dispatch-execution.ts
// :364-388 outside the subagent registry, so it delivers no second return:
// only turn-1 output reaches the parent (matches the live journal). The
// binding token is therefore minted by the child in TURN 1 and must be
// reproduced by the parent.
//
// Three receipts stay separate:
//   hop 2 ran                         -> cwDelegateSelfHops (child transcript)
//   the child's return reached parent -> parentReturnReceipt (this section)
//   hop-2 OUTPUT reached the parent   -> not claimed by this row (no second
//                                        delivery exists to bind)
// ---------------------------------------------------------------------------

export const CHILD_TOKEN_PATTERN = /^[a-z0-9]{12}$/;

function runIdOf(message) {
  const id = message?.__openclaw?.runId;
  return typeof id === 'string' && id ? id : null;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The token the child minted in its turn-1 reply
 * "CHILD-CW-SCHEDULED <nonce> TOKEN <12 lowercase letters/digits>", read from
 * the child's own transcript at the bound turn-1 sentinel. A token that occurs
 * in any text the harness sent (dispatch instruction, delegate task) or in the
 * child's spawn task is not child-minted and is refused.
 */
export function childMintedToken(messages, { rowNonce, harnessTexts = [] } = {}) {
  const list = Array.isArray(messages) ? messages : [];
  const hops = cwDelegateSelfHops(list, { rowNonce });
  if (!hops.childContinueWorkAccepted) return { token: null, index: -1, timestamp: null, reason: hops.reason || 'turn-1 receipt not bound' };
  const message = list[hops.scheduledSentinelIndex];
  const match = plainText(message).match(new RegExp(
    `(?:^|[^A-Za-z0-9_-])CHILD-CW-SCHEDULED\\s+${escapeRegex(rowNonce)}\\s+TOKEN\\s+([A-Za-z0-9]+)(?=$|[^A-Za-z0-9_-])`,
  ));
  const token = match ? match[1] : null;
  if (!token || !CHILD_TOKEN_PATTERN.test(token)) {
    return { token: null, index: hops.scheduledSentinelIndex, timestamp: null, reason: 'turn-1 reply carries no 12-character lowercase TOKEN' };
  }
  const spawnTask = list.find((m) => role(m) === 'user');
  const sent = [...harnessTexts, plainText(spawnTask)].filter((t) => typeof t === 'string');
  if (sent.some((t) => t.toLowerCase().includes(token))) {
    return { token: null, index: hops.scheduledSentinelIndex, timestamp: null, reason: 'token appears in harness-sent or task text' };
  }
  const timestamp = Number.isFinite(Number(message?.timestamp)) ? Number(message.timestamp) : null;
  return { token, index: hops.scheduledSentinelIndex, timestamp, reason: null };
}

/**
 * The parent's reproduction of the child token, bound to the parent session's
 * own transcript (chat.history):
 *   assistant text with the exact "PARENT-RETURN <nonce> TOKEN <token>", or a
 *   heartbeat_respond ack carrying it (heartbeatAckFromHistory, #568);
 *   in a run other than the dispatch run (dispatchRunId required);
 *   after the last row of the dispatch run in the parent transcript;
 *   not earlier than the child's token message (gateway timestamps, same clock).
 * The k6 clock (dispatch_accepted_at_ms) is not compared with gateway
 * timestamps; "after dispatch" is bound by transcript order instead.
 */
export function parentReturnReceipt(messages, { rowNonce, token, dispatchRunId, tokenTimestamp = null } = {}) {
  const list = Array.isArray(messages) ? messages : [];
  const none = (reason) => ({ bound: false, source: null, index: -1, runId: null, reason });
  if (!rowNonce || !token) return none('no child-minted token to look for');
  if (!dispatchRunId) return none('dispatch run id unknown; the parent window cannot be bound');
  let lastDispatchIndex = -1;
  list.forEach((m, i) => { if (runIdOf(m) === dispatchRunId) lastDispatchIndex = i; });
  if (lastDispatchIndex < 0) return none('dispatch run not found in the parent transcript');
  const sentinel = `${rowNonce} TOKEN ${token}`;
  const afterToken = (m) => tokenTimestamp === null || !Number.isFinite(Number(m?.timestamp)) || Number(m.timestamp) >= tokenTimestamp;
  for (let i = lastDispatchIndex + 1; i < list.length; i += 1) {
    const m = list[i];
    if (role(m) !== 'assistant') continue;
    const runId = runIdOf(m);
    if (!runId || runId === dispatchRunId) continue;
    if (!afterToken(m)) continue;
    if (hasExactSentinelText(plainText(m), 'PARENT-RETURN', sentinel)) {
      return { bound: true, source: 'assistant-text', index: i, runId, reason: null };
    }
  }
  const heartbeat = heartbeatAckFromHistory(list, {
    marker: 'PARENT-RETURN', nonce: sentinel, afterIndex: lastDispatchIndex, excludeRunIds: [dispatchRunId], requireRunId: true,
  });
  if (heartbeat && afterToken(list[heartbeat.index])) {
    return { bound: true, source: 'heartbeat_respond', index: heartbeat.index, runId: heartbeat.runId, reason: null };
  }
  return none('no parent reply reproduces the child token after the dispatch run');
}
