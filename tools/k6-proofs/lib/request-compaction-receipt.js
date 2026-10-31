import { hasExactSentinelText } from './wake-turn-receipt.mjs';
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonText(value) {
  const text = String(value || '').trim();
  if (!text.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function receiptFromContent(content) {
  if (isRecord(content)) return content;
  if (typeof content === 'string') return parseJsonText(content);
  if (!Array.isArray(content)) return null;

  for (const part of content) {
    if (isRecord(part?.details)) return part.details;
    if (typeof part?.text === 'string') {
      const parsed = parseJsonText(part.text);
      if (parsed) return parsed;
    }
  }
  return null;
}

export function effectiveToolNames(payload) {
  const names = [];
  for (const group of Array.isArray(payload?.groups) ? payload.groups : []) {
    for (const tool of Array.isArray(group?.tools) ? group.tools : []) {
      const name = typeof tool === 'string' ? tool : tool?.id || tool?.name;
      if (typeof name === 'string' && name) names.push(name);
    }
  }
  return [...new Set(names)];
}

export function hasEffectiveTool(payload, expectedName) {
  return effectiveToolNames(payload).includes(expectedName);
}

function toolCallArguments(part) {
  if (isRecord(part?.arguments)) return part.arguments;
  if (typeof part?.arguments === 'string') return parseJsonText(part.arguments);
  if (isRecord(part?.input)) return part.input;
  if (typeof part?.input === 'string') return parseJsonText(part.input);
  return null;
}

export function requestCompactionToolCallIdForNonce(messages, rowNonce) {
  if (typeof rowNonce !== 'string' || !rowNonce) return null;
  const matchingCallIds = new Set();
  let unidentifiedMatch = false;
  for (const message of Array.isArray(messages) ? messages : []) {
    if (message?.role !== 'assistant' || !Array.isArray(message.content)) continue;
    for (const part of message.content) {
      if (part?.type !== 'toolCall') continue;
      if ((part.name || part.toolName) !== 'request_compaction') continue;
      const reason = toolCallArguments(part)?.reason;
      if (typeof reason === 'string' && reason.includes(rowNonce)) {
        if (typeof part.id === 'string' && part.id) matchingCallIds.add(part.id);
        else unidentifiedMatch = true;
      }
    }
  }
  if (unidentifiedMatch || matchingCallIds.size !== 1) return null;
  return [...matchingCallIds][0];
}

/**
 * Classify one sessions.messages session.message event for an authoritative
 * request_compaction tool-result receipt. Assistant prose is intentionally not
 * accepted here: only role=toolResult + toolName=request_compaction can pass.
 */
export function classifyRequestCompactionReceipt(eventPayload) {
  const message = eventPayload?.message || eventPayload?.payload?.message || eventPayload;
  if (!isRecord(message) || message.role !== 'toolResult') return { kind: 'unrelated' };
  if (message.toolName !== 'request_compaction') return { kind: 'unrelated' };

  const receipt = isRecord(message.details)
    ? message.details
    : receiptFromContent(message.content);
  if (!receipt) {
    return {
      kind: 'invalid',
      error: 'request_compaction tool result did not contain a structured receipt',
      toolCallId: message.toolCallId || null,
    };
  }

  if (receipt.status === 'rejected' && receipt.guard === 'context_threshold') {
    return {
      kind: 'threshold_rejected',
      receipt,
      toolCallId: message.toolCallId || null,
    };
  }

  // Builds with openclaw-bootstrap#1727 reject usage that was never measured
  // under its own guard, naming a cause (no_fresh_usage, unknown_context_window
  // or inventory_only). Older builds report it as context_threshold with no
  // contextUsage/threshold.
  if (receipt.status === 'rejected' && receipt.guard === 'context_unmeasured') {
    return {
      kind: 'unmeasured_rejected',
      receipt,
      toolCallId: message.toolCallId || null,
    };
  }

  return {
    kind: 'non_threshold_result',
    receipt,
    toolCallId: message.toolCallId || null,
  };
}

// ---------------------------------------------------------------------------
// R-RC-1 PASS rule: manifests/r-rc-1.json telemetryContract.verdictAuthority.pass
// (approved by 🌊 at docs b37adbda). The nonce-bound toolResult is a structured
// rejection, either guard=context_threshold measured below the floor (usage and
// threshold both numbers, usage < threshold, no inventory-only wording) or
// guard=context_unmeasured with a live cause. An unmeasured rejection is never
// measured proof, and inventory-only in either form is non-PASS: the wording, or
// a cause of inventory_only whatever the guard (🌊's review of docs 3e2c83c7).
//
// Receipt shapes at karmaterminal/openclaw 542d1cac46 (#1506),
// src/agents/tools/request-compaction-tool.ts: context_unmeasured carries a cause
// and no numbers (:252-265), context_threshold carries contextUsage and threshold
// (:266-277). The pre-#1727 unknown branch answered context_threshold with no
// numbers and the inventory stub's wording (:40-41).
// ---------------------------------------------------------------------------

// Causes a live runner reports for usage it has not measured
// (request-compaction-tool.ts:35). On a live session, inventory_only means the
// runner's origin wiring regressed.
export const LIVE_UNMEASURED_CAUSES = Object.freeze(['no_fresh_usage', 'unknown_context_window']);

// Inventory-only in a receipt's reason or its cause.
const INVENTORY_ONLY = /inventory[-_ ]only/i;

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * What the R-RC-1 PASS rule reads from one request_compaction receipt. The
 * scenario records these facts in its evidence, so the verdict can be computed
 * again from the evidence alone (classifyRrc1Evidence).
 */
export function rrc1RejectionFacts(receipt) {
  const r = isRecord(receipt) ? receipt : {};
  return {
    status: typeof r.status === 'string' ? r.status : null,
    guard: typeof r.guard === 'string' ? r.guard : null,
    // A cause that is not a string is recorded as given (JSON), so the rule still reads it.
    cause: typeof r.cause === 'string' ? r.cause : r.cause === undefined || r.cause === null ? null : JSON.stringify(r.cause),
    contextUsage: finiteNumber(r.contextUsage),
    threshold: finiteNumber(r.threshold),
    usageFieldsPresent: 'contextUsage' in r || 'threshold' in r,
    inventoryOnlyWording: typeof r.reason === 'string' && INVENTORY_ONLY.test(r.reason),
  };
}

/**
 * The R-RC-1 PASS rule over rrc1RejectionFacts. Returns { pass, shape, reason }:
 * shape is 'measured_below_threshold' or 'unmeasured_live_cause' when it passes,
 * otherwise reason names the first part of the rule the receipt breaks. Facts
 * that were not recorded fail closed.
 */
export function rrc1RejectionVerdict(facts) {
  const f = facts || {};
  const fail = (reason) => ({ pass: false, shape: null, reason });
  if (f.status !== 'rejected') return fail(`request_compaction did not return a rejection (status ${f.status ?? 'missing'})`);
  if (f.inventoryOnlyWording === true) return fail(`guard ${f.guard ?? 'missing'} answered with inventory-only wording on the live seat`);
  if (f.inventoryOnlyWording !== false) return fail('the rejection wording was not checked for inventory-only');
  // Before any guard branch: a runner that names inventory_only has lost its live
  // usage wiring, whatever guard and numbers come with it.
  if (typeof f.cause === 'string' && INVENTORY_ONLY.test(f.cause)) {
    return fail(`guard ${f.guard ?? 'missing'} named cause ${f.cause} on the live seat`);
  }
  if (f.guard === 'context_threshold') {
    if (finiteNumber(f.contextUsage) === null || finiteNumber(f.threshold) === null) {
      return fail('context_threshold without a measured contextUsage and threshold');
    }
    if (!(f.contextUsage < f.threshold)) {
      return fail(`context_threshold usage ${f.contextUsage} is not below threshold ${f.threshold}`);
    }
    return { pass: true, shape: 'measured_below_threshold', reason: null };
  }
  if (f.guard === 'context_unmeasured') {
    if (!LIVE_UNMEASURED_CAUSES.includes(f.cause)) return fail(`context_unmeasured without a live cause (cause ${f.cause ?? 'missing'})`);
    if (f.usageFieldsPresent === true) return fail('context_unmeasured carries usage numbers, which contradict it');
    if (f.usageFieldsPresent !== false) return fail('the unmeasured rejection was not checked for usage numbers');
    return { pass: true, shape: 'unmeasured_live_cause', reason: null };
  }
  return fail(`not a context-guard rejection (guard ${f.guard ?? 'missing'})`);
}

/** The R-RC-1 PASS rule over a classifyRequestCompactionReceipt result. */
export function classifyLiveContextGuardRejection(result) {
  if (result?.kind !== 'threshold_rejected' && result?.kind !== 'unmeasured_rejected') {
    return { pass: false, shape: null, reason: `no context-guard rejection receipt (${result?.kind || 'missing'})` };
  }
  return rrc1RejectionVerdict(rrc1RejectionFacts(result.receipt));
}

/**
 * A rejection receipt that meets the R-RC-1 PASS rule: context_threshold
 * measured below the floor, or context_unmeasured with a live cause, and no
 * inventory-only wording or inventory_only cause in either.
 */
export function isLiveContextGuardRejection(result) {
  return classifyLiveContextGuardRejection(result).pass;
}

// ---------------------------------------------------------------------------
// R-RC-1 compaction side effect.
//
// At openclaw 542d1cac46 the operator-visible mark of a committed compaction is
// the transcript compaction record, which sessions.get returns as
// { role: "system", content: [{ text: "Compaction" }], __openclaw: { kind: "compaction", id } }
// (src/gateway/session-transcript-entry-message.ts:82-112). It is written when
// the compaction commits, after its summary call, in the same session. No
// compaction counter is readable, no session.message carries the row (the
// gateway only sends sessions.changed { phase: "message" } with no messageId),
// and the queued request_compaction path emits no compaction event. In-attempt
// and recovery compaction do emit agent events { stream: "compaction" }
// (src/agents/embedded-agent-runner/run/compaction-runtime.ts:102-120), which
// sessions.messages subscribers receive for phases start and end
// (src/gateway/server-chat-event-admission.ts:15); any of those after dispatch
// is a compaction too. Absence only means something once the turn has ended
// and a window has passed, and it is bounded by that window.
// ---------------------------------------------------------------------------

// The contract's side-effect window (manifests/r-rc-1.json verdictAuthority.pass),
// per 🌊's review of docs 3e2c83c7: the product's compaction timeout plus a
// scheduling margin after the turn ends, as the default and the minimum. At
// openclaw 542d1cac46 a queued (volitional) compaction starts once the turn
// releases the session lane (src/agents/tools/request-compaction-tool.ts:305-306),
// and its summary call runs under EMBEDDED_COMPACTION_TIMEOUT_MS = 180_000
// (src/agents/embedded-agent-runner/compaction-safety-timeout.ts:9). A summary
// that times out still commits, with a deterministic summary
// (compaction-session-execution.ts:570-577, #164220), so the transcript row can
// land just after the 180s.
export const RRC1_COMPACTION_TIMEOUT_MS = 180000;
// The margin covers what runs outside that timeout: the lane handoff after the
// turn's lifecycle end, the compaction session's setup before its watchdog arms,
// and the deterministic fallback and transcript commit after it fires. All of it
// is local work with no model call, so 60s is headroom for a loaded seat, not a
// measured bound. The window stays a bounded observation, not a categorical
// proof: the 180s is a silence timeout that summary progress re-arms
// (compaction-session-execution.ts:248-252) up to COMPACTION_CEILING_WINDOWS = 10
// (compaction-safety-timeout.ts:13), and agents.defaults.compaction.timeoutSeconds
// changes it (:15-21). A compaction still streaming its summary, or one on a seat
// with a longer timeout, can commit after the window;
// OPENCLAW_RRC1_SIDE_EFFECT_WINDOW_MS lengthens the window for that seat.
export const RRC1_SIDE_EFFECT_MARGIN_MS = 60000;
export const RRC1_MIN_SIDE_EFFECT_WINDOW_MS = RRC1_COMPACTION_TIMEOUT_MS + RRC1_SIDE_EFFECT_MARGIN_MS;

/**
 * Index of the toolResult for `toolCallId` in a transcript read, or -1. A read
 * that still holds it covers everything that came after it.
 */
export function requestCompactionResultIndex(messages, toolCallId) {
  if (!Array.isArray(messages) || typeof toolCallId !== 'string' || !toolCallId) return -1;
  return messages.findIndex((message) => {
    const result = classifyRequestCompactionReceipt(message);
    return result.kind !== 'unrelated' && result.toolCallId === toolCallId;
  });
}

export function isCompactionMarker(message) {
  return isRecord(message) && isRecord(message.__openclaw) && message.__openclaw.kind === 'compaction';
}

/**
 * Compaction rows in `messages` that are not in `baselineMessages`, matched by
 * their record id, as { index, id } (id null when the row has none). A row
 * without an id never matches, so it always counts.
 */
export function newCompactionRows(baselineMessages, messages) {
  const baselineIds = new Set();
  for (const message of Array.isArray(baselineMessages) ? baselineMessages : []) {
    if (isCompactionMarker(message) && typeof message.__openclaw.id === 'string') baselineIds.add(message.__openclaw.id);
  }
  const rows = [];
  (Array.isArray(messages) ? messages : []).forEach((message, index) => {
    if (!isCompactionMarker(message)) return;
    const id = typeof message.__openclaw.id === 'string' ? message.__openclaw.id : null;
    if (!(id !== null && baselineIds.has(id))) rows.push({ index, id });
  });
  return rows;
}

export function newCompactionMarkerCount(baselineMessages, messages) {
  return newCompactionRows(baselineMessages, messages).length;
}

function sessionKeyTail(key) {
  return String(key).trim().toLowerCase().replace(/^agent:[^:]+:/, '');
}

/**
 * True only when the event payload names this session (with or without its
 * agent:<id>: prefix). Used where a false match would start the side-effect
 * window early, so an event that names no session does not match.
 */
export function eventNamesSession(eventPayload, sessionKey) {
  const named = isRecord(eventPayload) && typeof eventPayload.sessionKey === 'string' && eventPayload.sessionKey.trim();
  if (!named || typeof sessionKey !== 'string' || !sessionKey.trim()) return false;
  return sessionKeyTail(eventPayload.sessionKey) === sessionKeyTail(sessionKey);
}

/**
 * A compaction signal on the subscribed stream: an agent compaction event or a
 * session.message carrying a compaction row. `eventPayload` is the event
 * frame's payload. An event that names another session is not this one's; an
 * event that names no session counts, so a missing key cannot hide a compaction.
 * Returns { source, phase } or null.
 */
export function compactionStreamSignal(eventPayload, sessionKey) {
  if (!isRecord(eventPayload)) return null;
  const named = typeof eventPayload.sessionKey === 'string' && eventPayload.sessionKey.trim();
  if (named && !eventNamesSession(eventPayload, sessionKey)) return null;
  if (eventPayload.stream === 'compaction') {
    return { source: 'agent-compaction-event', phase: typeof eventPayload.data?.phase === 'string' ? eventPayload.data.phase : null };
  }
  if (isCompactionMarker(eventPayload.message)) return { source: 'session-message-compaction-row', phase: null };
  return null;
}

// The sources a side_effect.compaction_observations entry can have, and which
// count each is tallied in.
const COMPACTION_OBSERVATION_SOURCES = new Map([
  ['transcript-compaction-row', 'transcript'],
  ['agent-compaction-event', 'stream'],
  ['session-message-compaction-row', 'stream'],
]);

/**
 * One entry of side_effect.compaction_observations that shows a committed
 * compaction in this session after the rejection: a transcript row after the
 * nonce-bound toolResult in the same sessions.get read, or, arriving after the
 * toolResult and naming this session, a compaction row on the stream or an
 * agent compaction end with completed:true. An attempt is not a compaction: at
 * openclaw 542d1cac46 start carries no outcome and end carries
 * completed = ok && compacted
 * (src/agents/embedded-agent-runner/run/compaction-runtime.ts:101-148).
 */
export function rrc1CompactionShownAfterRejection(observation) {
  if (!isRecord(observation) || observation.after_rejection !== true) return false;
  switch (observation.source) {
    case 'transcript-compaction-row':
      return true;
    case 'session-message-compaction-row':
      return observation.session_named === true;
    case 'agent-compaction-event':
      return observation.session_named === true && observation.phase === 'end' && observation.completed === true;
    default:
      return false;
  }
}

/** Why the recorded compaction evidence disagrees with itself, or null. */
function compactionEvidenceProblem(sideEffect, observations) {
  const rows = finiteNumber(sideEffect.new_compaction_markers);
  const signals = finiteNumber(sideEffect.stream_compaction_signals);
  if (rows === null || signals === null) return 'the transcript or stream compaction count is missing';
  const sources = Array.isArray(sideEffect.stream_compaction_sources) ? sideEffect.stream_compaction_sources : [];
  let rowObservations = 0;
  let streamObservations = 0;
  for (const observation of observations) {
    const tally = isRecord(observation) ? COMPACTION_OBSERVATION_SOURCES.get(observation.source) : undefined;
    if (!tally) return `an observation has an unknown source (${observation?.source ?? 'missing'})`;
    if (tally === 'transcript') {
      rowObservations += 1;
    } else {
      streamObservations += 1;
      if (!sources.includes(observation.source)) return `stream source ${observation.source} is not in stream_compaction_sources`;
    }
  }
  if (rowObservations > 0 && rows < 1) return 'transcript compaction rows are observed but none is counted';
  if (streamObservations > signals) return `${streamObservations} stream observations but ${signals} stream compaction signals counted`;
  return null;
}

function describeCompactionEvidence(sideEffect) {
  const sources = Array.isArray(sideEffect.stream_compaction_sources) && sideEffect.stream_compaction_sources.length > 0
    ? ` (${sideEffect.stream_compaction_sources.join(', ')})`
    : '';
  const observations = Array.isArray(sideEffect.compaction_observations) ? sideEffect.compaction_observations : [];
  const committed = observations.filter(rrc1CompactionShownAfterRejection).length;
  return `stream signals ${sideEffect.stream_compaction_signals ?? '?'}${sources}, ` +
    `new transcript compaction rows ${sideEffect.new_compaction_markers ?? '?'}; ` +
    `${committed} committed ${committed === 1 ? 'compaction' : 'compactions'} shown after the rejection in this session`;
}

/**
 * The one R-RC-1 verdict, printed by the scenario's VERDICT line (the verdict
 * run-proofs.sh reads) and asserted by its tests, so the two cannot drift.
 * PASS-candidate needs every required receipt, the PASS rule above over the
 * recorded receipt facts, and no_compaction_side_effect proven true by a
 * complete window of at least RRC1_MIN_SIDE_EFFECT_WINDOW_MS.
 * FAIL-candidate (verdictAuthority.fail, the contract change in 🌊's review of
 * docs 3e2c83c7): the same receipts and a rejection that meets the PASS rule,
 * then a committed compaction shown after it in this session, which
 * contradicts it, on evidence that agrees with itself. It outranks an
 * incomplete window, since the run stops once it sees one.
 * Anything else is PARTIAL-candidate with the first missing piece named.
 */
export function classifyRrc1Evidence(evidence) {
  const e = evidence || {};
  const partial = (reason) => ({ verdict: 'PARTIAL-candidate', reason, shape: null });
  if (e.row !== undefined && e.row !== 'R-RC-1') return partial(`not R-RC-1 evidence (${e.row})`);
  if (e.tool_inventory_checked !== true || e.tool_registered !== true) {
    return partial('request_compaction is not in the effective tool inventory');
  }
  if (e.dispatch_accepted !== true) return partial('sessions.send was not accepted');
  if (e.tool_result_observed !== true) return partial('no authoritative request_compaction toolResult');
  if (e.tool_call_nonce_bound !== true || e.tool_invocation_observed !== true) {
    return partial("the toolResult is not bound to this row's nonce-bearing invocation");
  }
  const rejection = rrc1RejectionVerdict({
    status: e.tool_result_status,
    guard: e.guard,
    cause: e.cause,
    contextUsage: e.context_usage,
    threshold: e.threshold,
    usageFieldsPresent: e.usage_fields_present,
    inventoryOnlyWording: e.inventory_only_wording,
  });
  const window = isRecord(e.side_effect) ? e.side_effect : {};
  const observations = Array.isArray(window.compaction_observations) ? window.compaction_observations : null;
  if (!rejection.pass) {
    // Still the rule's PARTIAL, but a compaction the run saw is never silent.
    const sawCompaction = e.no_compaction_side_effect === false || (observations?.length ?? 0) > 0;
    return partial(sawCompaction ? `${rejection.reason}; a compaction was also observed (${describeCompactionEvidence(window)})` : rejection.reason);
  }
  if (e.no_compaction_side_effect === false) {
    const problem = compactionEvidenceProblem(window, observations || []);
    if (problem) return partial(`the compaction evidence is inconsistent: ${problem}`);
    if ((observations || []).some(rrc1CompactionShownAfterRejection)) {
      return { verdict: 'FAIL-candidate', reason: `a compaction followed the rejection (${describeCompactionEvidence(window)})`, shape: rejection.shape };
    }
    return partial(`a compaction signal was observed, but a committed compaction is not shown to follow the rejection in this session (${describeCompactionEvidence(window)})`);
  }
  if (e.no_compaction_side_effect !== true) {
    return partial(`no compaction side effect is unproven: ${window.unproven_reason || 'the side-effect window did not complete'}`);
  }
  // The claim stands only on the window that produced it.
  const windowMs = finiteNumber(window.window_ms);
  if (windowMs !== null && windowMs < RRC1_MIN_SIDE_EFFECT_WINDOW_MS) {
    return partial(`no compaction side effect is claimed, but the side-effect window ${windowMs}ms is shorter than the contract's ${RRC1_MIN_SIDE_EFFECT_WINDOW_MS}ms (the ${RRC1_COMPACTION_TIMEOUT_MS / 1000}s compaction timeout plus a ${RRC1_SIDE_EFFECT_MARGIN_MS / 1000}s scheduling margin)`);
  }
  const windowComplete = window.baseline_read === true && window.turn_end_observed === true &&
    window.window_elapsed === true && window.final_read === true &&
    window.new_compaction_markers === 0 && window.stream_compaction_signals === 0 &&
    observations !== null && observations.length === 0 && windowMs !== null;
  if (!windowComplete) {
    return partial('no compaction side effect is claimed, but its baseline read, turn end, window or final read is missing or saw a compaction');
  }
  return { verdict: 'PASS-candidate', reason: null, shape: rejection.shape };
}

export function findRequestCompactionReceipt(messages, { rowNonce, toolCallId } = {}) {
  const items = Array.isArray(messages) ? messages : [];
  const expectedToolCallId = toolCallId || requestCompactionToolCallIdForNonce(items, rowNonce);
  if (!expectedToolCallId) return { kind: 'missing' };

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const result = classifyRequestCompactionReceipt(items[index]);
    if (result.kind === 'unrelated' || result.toolCallId !== expectedToolCallId) continue;
    return { ...result, nonceBound: true };
  }
  return { kind: 'missing' };
}

// ---------------------------------------------------------------------------
// R-RC-2 measured-wake shape (#562 review, figs).
//
// At openclaw cut 41b8d69b90 request_compaction measures usage from the
// session entry's fresh totalTokens, which is written at turn end
// (src/agents/command/session-store.ts:168-182 via post-run.ts:266). A
// delegated child runs through the gateway `agent` path, whose attempt reads a
// session snapshot taken at attempt start
// (src/agents/command/attempt-execution.continuation.ts:82-88), so on the
// child's FIRST turn usage is null and the tool returns the "unknown" branch:
// { status: "rejected", guard: "context_threshold", reason } with no
// contextUsage / threshold (src/agents/tools/request-compaction-tool.ts:211-217).
// Only a later turn can carry a measured { contextUsage: N, threshold: 70 }
// (request-compaction-tool.ts:219-229; MIN_CONTEXT_THRESHOLD = 0.7 at :26).
// The accepted branch reports status "compaction_requested" (:338-348).
//
// chat.history keeps the toolResult content text (the pretty-printed JSON,
// tool-results.ts:10-11) but drops `details` (chat-display-projection
// sanitize.ts:441-460), so the receipt is parsed from content text.
//
// With openclaw-bootstrap#1727 the unknown branch becomes
// { status: "rejected", guard: "context_unmeasured", cause, reason }: a fresh
// child's first turn answers cause "no_fresh_usage". It is classified
// context_unknown the same way.
// ---------------------------------------------------------------------------

// Exact status strings at openclaw 41b8d69b90 request-compaction-tool.ts:
// rejections return status "rejected" (:211-229, also rate_limit :236-247);
// acceptance returns status "compaction_requested" (:338-348). There is no
// "accepted" status, so it is not accepted here (#563 review item 1).
export const RC2_REJECTED_STATUS = 'rejected';
export const RC2_ACCEPTED_STATUS = 'compaction_requested';
export const RC2_ACCEPTED_STATUSES = Object.freeze([RC2_ACCEPTED_STATUS]);

function toolCallsFor(messages, toolName) {
  const calls = [];
  (Array.isArray(messages) ? messages : []).forEach((message, index) => {
    if (message?.role !== 'assistant' || !Array.isArray(message.content)) return;
    for (const part of message.content) {
      if (part?.type !== 'toolCall') continue;
      if ((part.name || part.toolName) !== toolName) continue;
      calls.push({ index, id: typeof part.id === 'string' ? part.id : null, args: toolCallArguments(part) || {} });
    }
  });
  return calls;
}

/**
 * The child's turn-1 yield: exactly one continue_work tool call whose reason
 * carries the row nonce. Returns { index, toolCallId } or null.
 */
export function continueWorkYieldForNonce(messages, rowNonce) {
  if (typeof rowNonce !== 'string' || !rowNonce) return null;
  const calls = toolCallsFor(messages, 'continue_work')
    .filter((call) => typeof call.args.reason === 'string' && call.args.reason.includes(rowNonce));
  if (calls.length !== 1) return null;
  return { index: calls[0].index, toolCallId: calls[0].id };
}

function plainText(message) {
  const content = message?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter((part) => part && part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text).join('\n');
}

/**
 * The continue_work wake turn: a user-role message after the yield whose text
 * is the gateway's wake prompt ("[continuation:wake] ... Prior reason:
 * \"<reason>\"", openclaw 41b8d69b90 work-dispatch-execution.ts:197-215, sent
 * as the turn Body at :365-372) and carries the row nonce through the quoted
 * reason. Returns its index, or -1.
 */
export function wakeTurnIndexAfter(messages, afterIndex, rowNonce) {
  const items = Array.isArray(messages) ? messages : [];
  for (let i = afterIndex + 1; i < items.length; i += 1) {
    const m = items[i];
    if (String(m?.role || '').toLowerCase() !== 'user') continue;
    const text = plainText(m);
    if (text.startsWith('[continuation:wake]') && text.includes(rowNonce)) return i;
  }
  return -1;
}

/**
 * Classify the R-RC-2 child receipt for both turns.
 * kinds: missing | invalid | context_unknown | threshold_rejected_measured |
 *        accepted | other
 * yieldBound: the nonce-bound continue_work call, then a nonce-bound wake turn
 * (#563 review item 6: a real turn boundary, not just call order), then the
 * nonce-bound request_compaction call, all in the same child transcript (the
 * wake runs on the child session, work-dispatch-execution.ts:540-545).
 * contextUsage and threshold must both be numbers to count as measured; one
 * without the other is invalid, not unknown.
 */
export function measuredRequestCompactionOutcome(messages, { rowNonce } = {}) {
  const items = Array.isArray(messages) ? messages : [];
  const toolCallId = requestCompactionToolCallIdForNonce(items, rowNonce);
  const callIndex = toolCallId
    ? toolCallsFor(items, 'request_compaction').find((call) => call.id === toolCallId)?.index ?? -1
    : -1;
  const yieldCall = continueWorkYieldForNonce(items, rowNonce);
  const wakeIndex = yieldCall ? wakeTurnIndexAfter(items, yieldCall.index, rowNonce) : -1;
  const wakeTurnBound = Boolean(yieldCall && wakeIndex > yieldCall.index && callIndex > wakeIndex);
  const yieldBound = wakeTurnBound;
  const found = findRequestCompactionReceipt(items, { rowNonce });
  const base = {
    yieldBound,
    yieldCallObserved: Boolean(yieldCall),
    wakeTurnBound,
    toolCallId: toolCallId || null,
    receipt: found.receipt || null,
    nonceBound: found.nonceBound === true,
  };
  if (found.kind === 'missing') return { ...base, kind: 'missing', measured: false };
  if (found.kind === 'invalid') return { ...base, kind: 'invalid', measured: false };
  const receipt = found.receipt || {};
  const hasUsage = typeof receipt.contextUsage === 'number' && Number.isFinite(receipt.contextUsage);
  const hasThreshold = typeof receipt.threshold === 'number' && Number.isFinite(receipt.threshold);
  const measured = hasUsage && hasThreshold;
  const partialFields = 'contextUsage' in receipt || 'threshold' in receipt;
  if (receipt.status === 'rejected' && receipt.guard === 'context_unmeasured') {
    // Usage numbers contradict an unmeasured rejection.
    return { ...base, kind: partialFields ? 'invalid' : 'context_unknown', measured: false };
  }
  if (receipt.status === 'rejected' && receipt.guard === 'context_threshold') {
    // The unknown branch carries neither field (request-compaction-tool.ts:211-217).
    if (!measured && partialFields) return { ...base, kind: 'invalid', measured: false };
    if (!measured) return { ...base, kind: 'context_unknown', measured: false };
    return receipt.contextUsage < receipt.threshold
      ? { ...base, kind: 'threshold_rejected_measured', measured: true }
      : { ...base, kind: 'invalid', measured: true };
  }
  if (RC2_ACCEPTED_STATUSES.includes(receipt.status)) return { ...base, kind: 'accepted', measured };
  return { ...base, kind: 'other', measured };
}

/**
 * The child's own report sentinel, read from the CHILD's transcript.
 *
 * The parent cannot observe it: at openclaw 41b8d69b90 the delivered-return row
 * is hidden from the parent's chat.history and session.message projections
 * (chat-display-projection.history.ts:329-334), so the parent-subscription path
 * never sees the child's reply. The re-run on emeric (2026-10-05) had the
 * measured receipt (context_usage 5 vs threshold 70) and still ended PARTIAL on
 * delegate_child_report_observed:false.
 *
 * Bound: an assistant message AFTER the nonce-bound request_compaction
 * toolResult and before the next user message (the same wake turn), whose
 * plain text carries the exact sentinel for this row's nonce. A sentinel in the
 * spawn task, before the toolResult, or in a later turn does not count.
 * Returns { kind: 'threshold' | 'accepted' | null, usage, threshold, index }.
 */
/** End offset of the first word-bounded `<marker> <nonce>` in text, or -1. */
function exactSentinelEnd(text, marker, nonce) {
  if (!hasExactSentinelText(text, marker, nonce)) return -1;
  const sentinel = `${marker} ${nonce}`;
  for (let at = text.indexOf(sentinel); at >= 0; at = text.indexOf(sentinel, at + 1)) {
    const end = at + sentinel.length;
    const before = at === 0 ? '' : text[at - 1];
    const after = end >= text.length ? '' : text[end];
    if (!/[A-Za-z0-9_-]/.test(before) && !/[A-Za-z0-9_-]/.test(after)) return end;
  }
  return -1;
}

export function childReportAfterReceipt(messages, { rowNonce } = {}) {
  const items = Array.isArray(messages) ? messages : [];
  const none = { kind: null, usage: null, threshold: null, index: -1 };
  if (typeof rowNonce !== 'string' || !rowNonce) return none;
  const toolCallId = requestCompactionToolCallIdForNonce(items, rowNonce);
  if (!toolCallId) return none;
  let resultIndex = -1;
  for (let i = 0; i < items.length; i += 1) {
    const result = classifyRequestCompactionReceipt(items[i]);
    if (result.kind !== 'unrelated' && result.toolCallId === toolCallId) { resultIndex = i; break; }
  }
  if (resultIndex < 0) return none;
  // Word-bounded exact sentinels (#568's hasExactSentinelText): a longer nonce
  // with the same prefix (NONCE-x) never matches NONCE.
  for (let i = resultIndex + 1; i < items.length; i += 1) {
    const role = String(items[i]?.role || '').toLowerCase();
    if (role === 'user') break;
    if (role !== 'assistant') continue;
    const text = plainText(items[i]);
    const thresholdAt = exactSentinelEnd(text, 'REQUEST_COMPACTION_REJECTED_CONTEXT_THRESHOLD', rowNonce);
    if (thresholdAt >= 0) {
      const tail = text.slice(thresholdAt);
      const usage = tail.match(/CONTEXT[^0-9A-Za-z]+(\d+)/)?.[1];
      const threshold = tail.match(/THRESHOLD[^0-9A-Za-z]+(\d+)/)?.[1];
      return { kind: 'threshold', usage: usage ? Number(usage) : null, threshold: threshold ? Number(threshold) : null, index: i };
    }
    if (hasExactSentinelText(text, 'REQUEST_COMPACTION_ACCEPTED', rowNonce)) return { kind: 'accepted', usage: null, threshold: null, index: i };
  }
  return none;
}

/**
 * The one R-RC-2 verdict, shared by the scenario and the manual
 * postprocessor (scripts/postprocess-k6-summary.mjs) so the two cannot drift
 * (#563 review item 1). Fail closed first: a preflight that did not pass, a
 * refused or incomplete observation, or a child-identity conflict is PARTIAL
 * with the reason named, never HONEST-LIMIT, PASS or FAIL.
 */
export function classifyRrc2Evidence(evidence) {
  const e = evidence || {};
  if (e.row !== undefined && e.row !== 'R-RC-2') {
    return { verdict: 'PARTIAL-candidate', reason: `not R-RC-2 evidence (${e.row})` };
  }
  if (!e.preflight || e.preflight.ok !== true) {
    return { verdict: 'PARTIAL-candidate', reason: `preflight did not pass: ${e.preflight?.reason || 'no preflight result'}` };
  }
  if (e.observation_refused) {
    const r = e.observation_refused;
    return { verdict: 'PARTIAL-candidate', reason: `observation refused: ${r.method} ${r.code || ''} ${r.message || ''}`.replace(/\s+/g, ' ').trim() };
  }
  if (e.observation_incomplete) {
    const r = e.observation_incomplete;
    return { verdict: 'PARTIAL-candidate', reason: `observation incomplete: ${r.method} ${r.code || ''} ${r.message || ''}`.replace(/\s+/g, ' ').trim() };
  }
  if (e.child_identity_conflict === true) {
    return { verdict: 'PARTIAL-candidate', reason: `child identity conflict: ${e.child_identity_reason || 'observer and event path disagree'}` };
  }
  const receiptBase = e.child_session_observed === true &&
    e.request_compaction_tool_result_observed === true &&
    e.request_compaction_receipt_role === 'toolResult' &&
    e.request_compaction_receipt_tool_name === 'request_compaction' &&
    e.request_compaction_invocation_bound === true &&
    e.child_yield_bound === true &&
    e.child_wake_turn_bound === true;
  const thresholdReceipt = receiptBase &&
    e.request_compaction_receipt_status === RC2_REJECTED_STATUS &&
    e.request_compaction_rejected_context_threshold === true &&
    e.request_compaction_context_measured === true &&
    e.guard === 'context_threshold';
  const acceptedReceipt = receiptBase &&
    e.request_compaction_receipt_status === RC2_ACCEPTED_STATUS &&
    e.request_compaction_accepted === true;
  const dispatched = e.parent_dispatch_accepted === true && e.delegate_requested === true;
  const verifiedThreshold = dispatched && thresholdReceipt &&
    e.delegate_child_report_observed === true && e.child_reported_context_threshold === true;
  const verifiedPostCompaction = dispatched && acceptedReceipt &&
    e.delegate_child_report_observed === true && e.post_compaction_path_observed === true;
  if (verifiedPostCompaction) return { verdict: 'PASS-candidate', reason: null, thresholdReceipt, acceptedReceipt };
  if (verifiedThreshold) return { verdict: 'HONEST-LIMIT-candidate', reason: null, thresholdReceipt, acceptedReceipt };
  const partialEvidence = thresholdReceipt || acceptedReceipt ||
    e.delegate_child_report_observed === true || e.child_reported_context_threshold === true ||
    e.request_compaction_accepted === true || e.request_compaction_accepted_reported === true ||
    e.post_compaction_path_observed === true || e.request_compaction_context_unknown === true;
  let reason = null;
  if (e.request_compaction_context_unknown === true) {
    reason = 'request_compaction answered context unknown (no measured contextUsage); HONEST-LIMIT needs a measured below-threshold receipt';
  } else if (e.request_compaction_tool_result_observed === true && e.child_wake_turn_bound !== true) {
    reason = 'request_compaction receipt is not preceded by the nonce-bound continue_work yield and its wake turn';
  }
  return { verdict: partialEvidence ? 'PARTIAL-candidate' : 'FAIL-candidate', reason, thresholdReceipt, acceptedReceipt };
}

/**
 * k6 invokes handleSummary in a separate JS isolate from the VU, where its
 * module-local evidence is normally null. A green metric cannot substitute
 * for the VU's nonce-bound compaction receipt and child return. If evidence
 * is available, require its VU verdict to agree with the shared classifier;
 * the VU's observation gates can only lower that verdict.
 */
export function summaryRrc2Verdict(evidence) {
  if (!evidence) return 'PARTIAL-candidate';
  const classified = classifyRrc2Evidence(evidence).verdict;
  return evidence.verdict === classified ? classified : 'PARTIAL-candidate';
}
