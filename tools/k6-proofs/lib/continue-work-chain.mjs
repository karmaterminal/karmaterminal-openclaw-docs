// continue_work schedule-and-wake receipts from the session's own transcript
// (karmaterminal/openclaw-bootstrap#1727).
//
// R-CW-1/2/3 put "on continuation wake reply exactly CW*-WOKE <nonce>" inside
// the continue_work reason and credited the wake from any event carrying it.
// At openclaw f15237ec92 the reason reaches a subscriber in the agent's own
// tool call and tool-start meta (src/agents/tool-display-config.ts:394) and
// again, quoted twice, in the wake input
// (src/auto-reply/continuation/work-dispatch-execution.ts:165-226). The
// R-CW-3 canonical F′ run matched CW3-WOKE 5.3 s after scheduling with a 5 s
// delay: the wake input, not the woken agent. R-CW-4's hop sentinels were
// prompt-only but credited from any event.
//
// A hop here is bound by turn order in chat.history, the shape
// cw-delegate-self-receipt.mjs already uses:
//   the nonce-bound continue_work call, then its toolResult reporting
//   "scheduled" (both product rows, paired by toolCallId), then the hop's
//   scheduled sentinel in assistant text inside that same turn; then a
//   "[continuation:wake]" user row carrying the nonce (product text: the agent
//   cannot write a user row), and inside that wake turn the next hop's call,
//   or for the last hop the done sentinel in assistant text.
// A turn ends at the next user row. Tool arguments, thinking and the wake
// input itself never satisfy a sentinel (text parts of assistant rows only).
//
// k6 and Node compatible: no k6 or Node imports.

import { assistantText, boundToolCalls, callsTool, isContinuationWakeInput, mintedTokenFromHistory, toolResultPayload } from './sentinel-binding.mjs';
import { hasExactSentinelText } from './wake-turn-receipt.mjs';

function role(message) {
  return String(message?.role || '').toLowerCase();
}

/** Index of the next user row after `from`, or the transcript length. */
function turnEnd(messages, from) {
  for (let i = from + 1; i < messages.length; i += 1) if (role(messages[i]) === 'user') return i;
  return messages.length;
}

function scheduledResultIndex(messages, toolCallId, from, end) {
  for (let i = from + 1; i < end; i += 1) {
    const m = messages[i];
    if (role(m) !== 'toolresult' || m.toolCallId !== toolCallId) continue;
    if (m.isError === true) return -1;
    return toolResultPayload(m)?.status === 'scheduled' ? i : -1;
  }
  return -1;
}

function sentinelIndex(messages, marker, nonce, from, end) {
  for (let i = from + 1; i < end; i += 1) {
    const text = assistantText(messages[i]);
    if (text && hasExactSentinelText(text, marker, nonce)) return i;
  }
  return -1;
}

/**
 * Bind a continue_work chain in one transcript (oldest to newest).
 * scheduledMarkers: one per hop, in order (e.g. ['CW-SCHEDULED']).
 * doneMarker: the sentinel the last wake turn answers (e.g. 'CW-WOKE').
 * Returns { hops: [{ callIndex, resultIndex, sentinelIndex, wakeIndex }],
 * scheduled: hops fully scheduled, woke: wakes observed, doneIndex, complete,
 * reason }.
 */
export function continueWorkChain(messages, { nonce, scheduledMarkers = [], doneMarker } = {}) {
  const list = Array.isArray(messages) ? messages : [];
  const hops = [];
  const out = (reason, doneIndex = -1) => ({
    hops,
    scheduled: hops.filter((h) => h.sentinelIndex >= 0).length,
    woke: hops.filter((h) => h.wakeIndex >= 0).length,
    doneIndex,
    complete: reason === null,
    reason,
  });
  if (!nonce || !doneMarker || scheduledMarkers.length === 0) return out('no nonce or markers to bind');
  // Hop 1 is elected in the dispatch turn, the first turn that follows a user row.
  let windowStart = list.findIndex((m) => role(m) === 'user');
  if (windowStart < 0) return out('no dispatch turn in the transcript');
  for (let h = 0; h < scheduledMarkers.length; h += 1) {
    const end = turnEnd(list, windowStart);
    let callIndex = -1;
    let toolCallId = null;
    for (let i = windowStart + 1; i < end && callIndex < 0; i += 1) {
      const [call] = boundToolCalls(list[i], { toolName: 'continue_work', argField: 'reason', needle: nonce });
      if (call) { callIndex = i; toolCallId = call.id; }
    }
    const hop = { callIndex, resultIndex: -1, sentinelIndex: -1, wakeIndex: -1 };
    hops.push(hop);
    if (callIndex < 0) return out(`hop ${h + 1}: no nonce-bound continue_work call in its turn`);
    hop.resultIndex = scheduledResultIndex(list, toolCallId, callIndex, end);
    if (hop.resultIndex < 0) return out(`hop ${h + 1}: the continue_work result is not "scheduled"`);
    hop.sentinelIndex = sentinelIndex(list, scheduledMarkers[h], nonce, hop.resultIndex, end);
    if (hop.sentinelIndex < 0) return out(`hop ${h + 1}: ${scheduledMarkers[h]} is not in the turn after the scheduled result`);
    for (let i = end; i < list.length; i += 1) {
      if (isContinuationWakeInput(list[i], nonce)) { hop.wakeIndex = i; break; }
      if (role(list[i]) === 'user') break;
    }
    if (hop.wakeIndex < 0) return out(`hop ${h + 1}: no nonce-bound [continuation:wake] turn follows the scheduled turn`);
    windowStart = hop.wakeIndex;
  }
  const doneIndex = sentinelIndex(list, doneMarker, nonce, windowStart, turnEnd(list, windowStart));
  if (doneIndex < 0) return out(`${doneMarker} is not in the final wake turn`);
  return out(null, doneIndex);
}

// ---------------------------------------------------------------------------
// Bare CONTINUE_WORK token hops (R-CW-TOKEN)
// ---------------------------------------------------------------------------

function boundRows(rows) {
  return Array.isArray(rows) ? rows : [];
}

// A typed continue_work call by name or through Tool Search's dispatch_action (review F1).
function typedContinueWork(message) {
  return callsTool(message, 'continue_work');
}

/**
 * The child's own rows for a bare CONTINUE_WORK token chain, in order:
 *   hop 1: an assistant row whose text says `<hop1Marker> <nonce>`;
 *   hop 2: after a "[continuation:wake]" user row (product text) or in a run
 *          other than hop 1's, an assistant row whose text carries
 *          `<hop2Marker> <nonce> TOKEN <minted>`, a token absent from every
 *          harness-sent text (mintedTokenFromHistory).
 * A typed continue_work call anywhere in the child means the token form is
 * not what scheduled the wake. Rows come from one session only (the caller
 * binds the session). Returns { hop1Index, hop1RunId, wakeIndex, hop2Index,
 * hop2RunId, token, tokenTimestamp, typedToolUsed, complete, reason }.
 */
export function tokenWorkHops(rows, { nonce, hop1Marker, hop2Marker, sentTexts = [] } = {}) {
  const list = boundRows(rows);
  const out = {
    hop1Index: -1, hop1RunId: null, wakeIndex: -1, hop2Index: -1, hop2RunId: null,
    token: null, tokenTimestamp: null, typedToolUsed: list.some(typedContinueWork), complete: false, reason: null,
  };
  const runOf = (m) => (typeof m?.__openclaw?.runId === 'string' && m.__openclaw.runId) || null;
  out.hop1Index = list.findIndex((m) => {
    const text = assistantText(m);
    return Boolean(text) && hasExactSentinelText(text, hop1Marker, nonce);
  });
  if (out.hop1Index < 0) return { ...out, reason: `no child assistant row says ${hop1Marker}` };
  out.hop1RunId = runOf(list[out.hop1Index]);
  for (let i = out.hop1Index + 1; i < list.length; i += 1) {
    const text = role(list[i]) === 'user' ? textOfUser(list[i]) : null;
    if (text && text.startsWith('[continuation:wake]')) { out.wakeIndex = i; break; }
  }
  const after = list.slice(out.hop1Index + 1);
  const minted = mintedTokenFromHistory(after, { marker: hop2Marker, nonce, sentTexts });
  if (!minted.token) return { ...out, reason: `hop 2: ${minted.reason}` };
  const index = out.hop1Index + 1 + minted.index;
  const runId = minted.runId || null;
  const afterWake = out.wakeIndex >= 0 && index > out.wakeIndex;
  const otherRun = Boolean(runId && out.hop1RunId && runId !== out.hop1RunId);
  if (!afterWake && !otherRun) return { ...out, reason: 'hop 2 is neither after a [continuation:wake] row nor in a run other than hop 1' };
  Object.assign(out, { hop2Index: index, hop2RunId: runId, token: minted.token, tokenTimestamp: minted.timestamp });
  if (out.typedToolUsed) return { ...out, reason: 'the child called the typed continue_work tool; the token form is not proven' };
  return { ...out, complete: true };
}

function textOfUser(message) {
  const content = message?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return null;
  const parts = content.filter((p) => p && p.type === 'text' && typeof p.text === 'string').map((p) => p.text);
  return parts.length ? parts.join('\n') : null;
}
