// R-CD-3 post-compaction lifeboat receipts (karmaterminal/openclaw-bootstrap#1727).
//
// The F′ run recorded a "lifeboat return" from the agent's own continue_delegate
// call: the lifeboat task carried the return sentinel and the scenario matched
// it in any requester event. The session in fact stayed on its first turn,
// request_compaction answered "Context usage is unknown for this session", and
// nothing was released. This module holds what the scenario binds to instead.
//
// Product shapes at openclaw f15237ec92:
// - request_compaction (src/agents/tools/request-compaction-tool.ts):
//     unknown usage  { status:"rejected", guard:"context_threshold", reason }   (:236-243)
//     measured below { status:"rejected", guard:"context_threshold", contextUsage, threshold:70, reason } (:244-255)
//     rate limited   { status:"rejected", guard:"rate_limit", retryAfterSeconds, reason } (:257-273)
//     pending        { status:"already_pending", reason }                       (:226-232)
//     accepted       { status:"compaction_requested", compactionRequestId, trigger, contextUsage, reason, note } (:377-387)
//   The threshold is 0.7 and not configurable (:26). Usage is the previous
//   turn's fresh prompt total over the context window
//   (src/auto-reply/reply/agent-runner-post-compaction-release.ts:149-170): a
//   brand-new session has no measured usage until a turn has ended.
// - continue_delegate(mode="post-compaction") answers
//   { status:"queued-for-compaction", mode:"post-compaction", ... } and does
//   not echo the task (src/agents/tools/continue-delegate-tool.ts:389-418).
// - Release spawns the lifeboat as a child of the requester whose task is
//   "[continuation:post-compaction] [continuation:chain-hop:N] Compaction just
//   completed. Carry this working state to the post-compaction session: <task>"
//   (src/auto-reply/reply/post-compaction-delegate-delivery.ts:497-539). That
//   prefix is product text: no requester call carries it.
// - Automatic compaction runs when the prompt exceeds the window minus the
//   reserve (packages/agent-core/src/harness/compaction/compaction.ts:260-269;
//   reserve floor 20,000, src/agents/agent-settings.ts:11), about 90% of a
//   200k window. The fill stops well below that.
//
// k6 and Node compatible: no k6 or Node imports.

import { compactTaskIdentityToken } from './row-child-correlation.mjs';
import { mintedTokenFromHistory, tokenReplyFromHistory, toolReceiptsFromHistory } from './sentinel-binding.mjs';

export const RCD3_LIFEBOAT_MARKER = 'RCD3-LIFEBOAT';
export const RCD3_PARENT_RETURN_MARKER = 'RCD3-PARENT-RETURN';
export const POST_COMPACTION_TASK_PREFIX = '[continuation:post-compaction]';
/** request-compaction-tool.ts:26 MIN_CONTEXT_THRESHOLD. Read-only here: the scenario never changes it. */
export const COMPACTION_THRESHOLD = 0.7;
export const DEFAULT_FILL_TARGET = 0.75;
export const DEFAULT_FILL_CEILING = 0.85;
export const DEFAULT_FILL_BUDGET_TOKENS = 300_000;
export const DEFAULT_FILL_MAX_TURNS = 6;
export const FILL_CALIBRATION_CHARS = 40_000;
export const FILL_MAX_CHUNK_CHARS = 480_000;
export const FILL_MIN_CHUNK_CHARS = 4_000;
/** Assumed tokens per filler character until two measured turns give a rate; high, so the first step undershoots. */
export const FILL_INITIAL_TOKENS_PER_CHAR = 0.3;
const FILL_MIN_TOKENS_PER_CHAR = 0.2;

export function rcd3TaskIdentityToken(nonce) {
  return compactTaskIdentityToken('RCD3', nonce);
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

// ---------------------------------------------------------------------------
// Context fill (real prior turns; no threshold or config change)
// ---------------------------------------------------------------------------

/**
 * Measured usage from a sessions.describe row: fresh totalTokens over
 * contextTokens, the same inputs computeRequestCompactionContextUsage reads.
 */
export function measuredSessionUsage(row) {
  if (!row || typeof row !== 'object') return { measured: false, totalTokens: null, contextTokens: null, usage: null, reason: 'sessions.describe returned no session row' };
  const totalTokens = isNumber(row.totalTokens) ? row.totalTokens : null;
  const contextTokens = isNumber(row.contextTokens) && row.contextTokens > 0 ? row.contextTokens : null;
  const base = { totalTokens, contextTokens };
  if (row.totalTokensFresh !== true) return { ...base, measured: false, usage: null, reason: 'session totalTokens is not fresh' };
  if (totalTokens === null) return { ...base, measured: false, usage: null, reason: 'session row carries no totalTokens' };
  if (contextTokens === null) return { ...base, measured: false, usage: null, reason: 'session row carries no contextTokens' };
  return { ...base, measured: true, usage: totalTokens / contextTokens, reason: null };
}

/**
 * Next fill step. 'done' once measured usage reaches the target; 'fill' with a
 * character count sized from the measured gap; 'stop' with a reason when the
 * gap cannot be closed within the turn and token budgets.
 */
export function planFillStep({
  measurement,
  turnsUsed,
  filledTokens = 0,
  tokensPerChar = FILL_INITIAL_TOKENS_PER_CHAR,
  target = DEFAULT_FILL_TARGET,
  ceiling = DEFAULT_FILL_CEILING,
  budgetTokens = DEFAULT_FILL_BUDGET_TOKENS,
  maxTurns = DEFAULT_FILL_MAX_TURNS,
} = {}) {
  if (!measurement?.measured) return { action: 'stop', chars: 0, reason: `no measured usage: ${measurement?.reason || 'unknown'}` };
  const { usage, totalTokens, contextTokens } = measurement;
  if (usage >= target) return { action: 'done', chars: 0, reason: null };
  if (turnsUsed >= maxTurns) {
    return { action: 'stop', chars: 0, reason: `measured usage ${pct(usage)} is below the ${pct(target)} target after ${turnsUsed} fill turns` };
  }
  const wantTokens = Math.ceil((target + 0.02) * contextTokens) - totalTokens;
  const roomTokens = Math.floor(ceiling * contextTokens) - totalTokens;
  const stepTokens = Math.max(0, Math.min(wantTokens, roomTokens));
  if (filledTokens + stepTokens > budgetTokens) {
    return {
      action: 'stop',
      chars: 0,
      reason: `reaching ${pct(target)} of a ${contextTokens}-token window needs about ${filledTokens + stepTokens} filler tokens, over the ${budgetTokens}-token fill budget`,
    };
  }
  const rate = Math.max(FILL_MIN_TOKENS_PER_CHAR, tokensPerChar);
  const chars = Math.min(FILL_MAX_CHUNK_CHARS, Math.max(FILL_MIN_CHUNK_CHARS, Math.ceil(stepTokens / rate)));
  return { action: 'fill', chars, reason: null, stepTokens };
}

function pct(fraction) {
  return `${Math.round(fraction * 1000) / 10}%`;
}

const FILLER_WORDS = Object.freeze([
  'amber', 'basalt', 'cedar', 'delta', 'ember', 'fjord', 'granite', 'harbor', 'island', 'juniper',
  'kelp', 'lagoon', 'meadow', 'nectar', 'orchard', 'pebble', 'quartz', 'river', 'saffron', 'thistle',
  'umber', 'valley', 'willow', 'yarrow', 'zephyr', 'alder', 'birch', 'canyon', 'dune', 'estuary',
  'fern', 'glacier', 'heath', 'inlet', 'jasper', 'knoll', 'lichen', 'marsh', 'nimbus', 'oxbow',
  'prairie', 'quarry', 'reef', 'sorrel', 'tundra', 'upland', 'vetch', 'wetland', 'yew', 'zinnia',
  'acorn', 'bramble', 'clover', 'dew', 'eddy', 'flint', 'grove', 'hollow', 'ivy', 'juncus',
  'kestrel', 'loam', 'moss', 'nettle',
]);

function seedFrom(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h || 1;
}

/**
 * Deterministic inert filler of about `chars` characters: lowercase words
 * from a fixed list, nine letters at most, so no 12-character token can occur
 * inside it.
 */
export function fillerText(seed, chars) {
  let state = seedFrom(String(seed));
  const next = () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state;
  };
  const lines = [];
  let length = 0;
  while (length < chars) {
    const words = [];
    for (let i = 0; i < 12; i += 1) words.push(FILLER_WORDS[next() % FILLER_WORDS.length]);
    const line = words.join(' ');
    lines.push(line);
    length += line.length + 1;
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Authoritative receipts
// ---------------------------------------------------------------------------

/**
 * The request_compaction answer for one bound receipt. An unknown usage
 * answer and a measured below-threshold answer are different kinds, and
 * neither is acceptance.
 */
export function classifyRequestCompactionReceipt(receipt) {
  if (!receipt) return { kind: 'missing', contextUsage: null, threshold: null };
  const payload = receipt.payload || {};
  const contextUsage = isNumber(payload.contextUsage) ? payload.contextUsage : null;
  const threshold = isNumber(payload.threshold) ? payload.threshold : null;
  const base = { contextUsage, threshold, status: payload.status ?? null, guard: payload.guard ?? null };
  if (receipt.isError) return { ...base, kind: 'error' };
  if (payload.status === 'compaction_requested') return { ...base, kind: contextUsage !== null ? 'accepted' : 'invalid' };
  if (payload.status === 'rejected' && payload.guard === 'context_threshold') {
    if (contextUsage === null && threshold === null) return { ...base, kind: 'context_unknown' };
    if (contextUsage !== null && threshold !== null && contextUsage < threshold) return { ...base, kind: 'threshold_rejected_measured' };
    return { ...base, kind: 'invalid' };
  }
  if (payload.status === 'rejected' && payload.guard === 'rate_limit') return { ...base, kind: 'rate_limited' };
  if (payload.status === 'already_pending') return { ...base, kind: 'already_pending' };
  return { ...base, kind: 'other' };
}

/** The one request_compaction receipt whose call reason carries the nonce, from a transcript or a live list. */
export function compactionOutcome(receipts) {
  const list = Array.isArray(receipts) ? receipts : [];
  if (list.length > 1) return { kind: 'ambiguous', contextUsage: null, threshold: null, toolCallId: null };
  const [receipt] = list;
  return { ...classifyRequestCompactionReceipt(receipt), toolCallId: receipt?.toolCallId || null };
}

export function compactionReceiptsFromHistory(messages, rowNonce) {
  return toolReceiptsFromHistory(messages, { toolName: 'request_compaction', argField: 'reason', needle: rowNonce });
}

/** The staging receipt: the bound continue_delegate call answered queued-for-compaction in post-compaction mode. */
export function stagingOutcome(receipts) {
  const list = Array.isArray(receipts) ? receipts : [];
  if (list.length !== 1) return { staged: false, status: null, reason: list.length ? 'more than one bound continue_delegate call' : 'no bound continue_delegate receipt' };
  const [receipt] = list;
  const staged = !receipt.isError && receipt.status === 'queued-for-compaction' && receipt.payload?.mode === 'post-compaction';
  return { staged, status: receipt.status, toolCallId: receipt.toolCallId, reason: staged ? null : `continue_delegate answered ${receipt.status || 'no status'}` };
}

export function stagingReceiptsFromHistory(messages, taskToken) {
  return toolReceiptsFromHistory(messages, { toolName: 'continue_delegate', argField: 'task', needle: taskToken });
}

/** A bound child's own spawn task is a released lifeboat only with the product prefix and the row token. */
export function isReleasedLifeboatTask(taskText, taskToken) {
  return typeof taskText === 'string' && typeof taskToken === 'string' && taskToken.length > 0 &&
    taskText.includes(POST_COMPACTION_TASK_PREFIX) && taskText.includes(taskToken);
}

/** The lifeboat's own report, from its own transcript: a token it minted. */
export function lifeboatReport(childMessages, { rowNonce, sentTexts = [] }) {
  return mintedTokenFromHistory(childMessages, { marker: RCD3_LIFEBOAT_MARKER, nonce: rowNonce, sentTexts });
}

/** The requester reproducing the lifeboat's token, outside the dispatch and fill runs, after the token. */
export function parentReturn(parentMessages, { rowNonce, token, excludeRunIds, tokenTimestamp }) {
  return tokenReplyFromHistory(parentMessages, {
    marker: RCD3_PARENT_RETURN_MARKER,
    nonce: rowNonce,
    token,
    excludeRunIds,
    notBeforeTimestamp: tokenTimestamp,
  });
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

const COMPACTION_REASONS = {
  context_unknown: 'request_compaction answered context unknown (no measured contextUsage): the accepted compaction path was not reached. An unknown or unmeasured rejection is never PASS, and it is not a measured threshold rejection',
  rate_limited: 'request_compaction was rate limited',
  already_pending: 'request_compaction answered already_pending',
  error: 'request_compaction returned an error result',
  invalid: 'request_compaction answered an inconsistent receipt',
  ambiguous: 'more than one request_compaction call carries the row nonce',
  missing: 'no request_compaction result is bound to the row call',
  other: 'request_compaction answered an unrecognised status',
};

/**
 * The one R-CD-3 verdict, shared by the scenario and its summary. Fail closed:
 * a preflight that did not pass, a refused or incomplete observation, or a
 * lifeboat identity conflict is PARTIAL with the reason named.
 */
export function classifyRcd3Evidence(evidence) {
  const e = evidence || {};
  const partial = (reason) => ({ verdict: 'PARTIAL-candidate', reason });
  if (e.row !== 'R-CD-3') return partial(`not R-CD-3 evidence (${e.row})`);
  if (!e.preflight || e.preflight.ok !== true) return partial(`preflight did not pass: ${e.preflight?.reason || 'no preflight result'}`);
  if (e.observation_refused) {
    const r = e.observation_refused;
    return partial(`observation refused: ${r.method} ${r.code || ''} ${r.message || ''}`.replace(/\s+/g, ' ').trim());
  }
  if (e.observation_incomplete) {
    const r = e.observation_incomplete;
    return partial(`observation incomplete: ${r.method} ${r.code || ''} ${r.message || ''}`.replace(/\s+/g, ' ').trim());
  }
  if (e.lifeboat_identity_conflict === true) return partial(`lifeboat identity conflict: ${e.lifeboat_identity_reason || 'more than one bound child'}`);
  if (e.proof_dispatched !== true) {
    return partial(`context fill stopped before the proof turn: ${e.fill_stop_reason || 'the fill did not finish'}`);
  }
  if (e.dispatch_accepted !== true) return { verdict: 'FAIL-candidate', reason: 'the proof turn was not accepted' };
  const kind = e.compaction_outcome_kind || 'missing';
  if (kind === 'missing' && e.staging_receipt_observed !== true) {
    return { verdict: 'FAIL-candidate', reason: 'neither a staging receipt nor a request_compaction result is bound to the proof turn' };
  }
  if (kind === 'threshold_rejected_measured') {
    return partial(`measured below-threshold rejection (contextUsage ${e.compaction_context_usage}% < threshold ${e.compaction_threshold}%): the fill did not reach the accepted compaction path`);
  }
  if (kind !== 'accepted') return partial(COMPACTION_REASONS[kind] || COMPACTION_REASONS.other);
  if (e.staging_receipt_observed !== true) return partial('compaction accepted, but no queued-for-compaction staging receipt is bound to the lifeboat task');
  if (e.lifeboat_child_observed !== true) return partial('compaction accepted; no released lifeboat child was observed');
  if (e.lifeboat_report_bound !== true) return partial(`released lifeboat child observed, but its own transcript carries no bound report: ${e.lifeboat_report_reason || 'no report'}`);
  if (e.parent_return_bound !== true) {
    return partial(`the lifeboat fired after compaction and reported, but the return is not bound: ${e.parent_return_reason || 'no requester reply'}`);
  }
  return { verdict: 'PASS-candidate', reason: null };
}

/** handleSummary runs in another isolate; without the VU's evidence the row is PARTIAL. */
export function summaryRcd3Verdict(evidence) {
  if (!evidence) return 'PARTIAL-candidate';
  const classified = classifyRcd3Evidence(evidence).verdict;
  return evidence.verdict === classified ? classified : 'PARTIAL-candidate';
}
