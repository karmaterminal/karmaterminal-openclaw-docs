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

import { assistantText, boundToolCalls, isContinuationWakeInput, toolResultPayload } from './sentinel-binding.mjs';
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
