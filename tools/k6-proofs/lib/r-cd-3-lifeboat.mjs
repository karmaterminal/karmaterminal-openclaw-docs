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
//                    contextUsage is Math.round(raw * 100) while the guard compares the raw
//                    fraction, so a 69.5-69.99% rejection reads contextUsage 70, threshold 70
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
//   prefix is product text only in that position: an ordinary delegate's task
//   is "[continuation:chain-hop:N] Delegated task (turn N/M): <requester task>"
//   (delegate-dispatch-request.ts:43), and chat.history keeps either as written,
//   so a requester that writes the prefix into a task can mint a child that
//   carries it (harness review F4). The task must start with the release
//   composition, and a requester call that carries the prefix is refused.
// - Automatic compaction runs when the prompt exceeds the window minus the
//   reserve (packages/agent-core/src/harness/compaction/compaction.ts:260-269).
//   The reserve is max(configured, 20,000) capped at a quarter of the window
//   (src/agents/agent-settings.ts:11,29-38; agent-compaction-constants.ts:2-13),
//   so the line is window - min(20,000, window/4) at the floor: 90% of 200k,
//   84.4% of 128k, 75% of any window up to 80k. Preflight compaction also runs
//   when the fresh total plus the next prompt reaches it
//   (src/auto-reply/reply/agent-runner-memory.ts:112-300), and its after-total
//   can exceed the previous one. The planner keeps every planned total below
//   the line minus a margin, and stops PARTIAL when the target is not
//   reachable below it (harness review F7).
// - The window the fill sizes itself against is the disposable session's
//   sessions.describe contextTokens, projected from the selected model's
//   configured or catalog window (openclaw ab5a30ea79
//   src/gateway/session-utils-row.ts:180-262,
//   src/config/sessions/context-token-provenance.ts:80-110). The filler budget
//   and the turn allowance follow it, under a hard ceiling (live run
//   44245772142: a fixed 300k budget could not fill a 922k window).
//
// k6 and Node compatible: no k6 or Node imports.

import { compactTaskIdentityToken } from './row-child-correlation.mjs';
import { mintedTokenFromHistory, tokenReplyFromHistory, toolReceiptsFromHistory } from './sentinel-binding.mjs';
import { toolCallTarget } from './tool-call-identity.mjs';

export const RCD3_LIFEBOAT_MARKER = 'RCD3-LIFEBOAT';
export const RCD3_PARENT_RETURN_MARKER = 'RCD3-PARENT-RETURN';
export const POST_COMPACTION_TASK_PREFIX = '[continuation:post-compaction]';
/** The start of a released lifeboat's task (post-compaction-delegate-delivery.ts:499-502). */
const RELEASED_LIFEBOAT_TASK_START = /^\[continuation:post-compaction\] \[continuation:chain-hop:\d+\] /;
/** request-compaction-tool.ts:26 MIN_CONTEXT_THRESHOLD. Read-only here: the scenario never changes it. */
export const COMPACTION_THRESHOLD = 0.7;
export const DEFAULT_FILL_TARGET = 0.75;
export const DEFAULT_FILL_CEILING = 0.85;
/** Each fill step aims this far past the target, as a fraction of the window. */
export const FILL_TARGET_OVERSHOOT = 0.02;
/**
 * The fill budget bounds what the fill costs: each turn re-sends the growing
 * context. A budget derived from the measured window (fillBudgetForWindow)
 * above this ceiling refuses instead, so a wrong contextTokens cannot buy a
 * larger fill. It covers any window up to about 1.29M tokens at the default
 * target. An explicit OPENCLAW_RCD3_FILL_BUDGET_TOKENS is the operator's own
 * bound and is not held to it.
 */
export const FILL_BUDGET_CEILING_TOKENS = 1_000_000;
/** The fewest fill turns allowed: the fixed allowance before the window sized it. */
export const FILL_MIN_TURNS = 6;
export const FILL_CALIBRATION_CHARS = 40_000;
export const FILL_MAX_CHUNK_CHARS = 480_000;
export const FILL_MIN_CHUNK_CHARS = 4_000;
/** Assumed tokens per filler character until two measured turns give a rate; high, so the first step undershoots. */
export const FILL_INITIAL_TOKENS_PER_CHAR = 0.3;
const FILL_MIN_TOKENS_PER_CHAR = 0.2;
export const FILL_BUDGET_ENV = 'OPENCLAW_RCD3_FILL_BUDGET_TOKENS';
export const FILL_MAX_TURNS_ENV = 'OPENCLAW_RCD3_FILL_MAX_TURNS';
/** agent-settings.ts:11 DEFAULT_AGENT_COMPACTION_RESERVE_TOKENS_FLOOR. */
export const COMPACTION_RESERVE_FLOOR_TOKENS = 20_000;
/** agent-compaction-constants.ts:2 MAX_COMPACTION_RESERVE_RATIO. */
const COMPACTION_RESERVE_MAX_RATIO = 0.25;
/**
 * Headroom kept below the automatic-compaction line: the larger of 2,000
 * tokens and 2% of the window. It covers the smallest filler chunk
 * (FILL_MIN_CHUNK_CHARS), the turn's reply and the proof turn's own prompt.
 */
export const FILL_COMPACTION_MARGIN_MIN_TOKENS = 2_000;
export const FILL_COMPACTION_MARGIN_RATIO = 0.02;

/**
 * The prompt total past which the product compacts on its own:
 * window - min(max(reserve, 20,000), floor(window / 4)). The configured
 * reserve is not observable here, so the floor is the default; a seat that
 * configures a larger reserve can pass it in (it only lowers the line).
 */
export function automaticCompactionLine(contextTokens, reserveTokens = COMPACTION_RESERVE_FLOOR_TOKENS) {
  const window = Math.max(1, Math.floor(contextTokens));
  const reserve = Math.max(COMPACTION_RESERVE_FLOOR_TOKENS, Math.floor(Number(reserveTokens) || 0));
  return window - Math.min(reserve, Math.floor(window * COMPACTION_RESERVE_MAX_RATIO));
}

/** The highest total the fill may plan: the automatic-compaction line minus the margin. */
export function fillCompactionCap(contextTokens, reserveTokens = COMPACTION_RESERVE_FLOOR_TOKENS) {
  const margin = Math.max(FILL_COMPACTION_MARGIN_MIN_TOKENS, Math.ceil(FILL_COMPACTION_MARGIN_RATIO * contextTokens));
  return automaticCompactionLine(contextTokens, reserveTokens) - margin;
}

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
 * sessionId is carried through: compaction can rotate it
 * (agent-runner-post-compaction-release.ts:64-74 newSessionId), and the row
 * projects no compaction counter. windowUnknown marks a row whose turn
 * accounting has landed (a fresh total) but which names no window: nothing
 * the fill could size itself against.
 */
export function measuredSessionUsage(row) {
  if (!row || typeof row !== 'object') return { measured: false, windowUnknown: false, totalTokens: null, contextTokens: null, usage: null, sessionId: null, reason: 'sessions.describe returned no session row' };
  const totalTokens = isNumber(row.totalTokens) ? row.totalTokens : null;
  const contextTokens = isNumber(row.contextTokens) && row.contextTokens > 0 ? row.contextTokens : null;
  const base = { totalTokens, contextTokens, sessionId: typeof row.sessionId === 'string' && row.sessionId ? row.sessionId : null, windowUnknown: false };
  if (row.totalTokensFresh !== true) return { ...base, measured: false, usage: null, reason: 'session totalTokens is not fresh' };
  if (totalTokens === null) return { ...base, measured: false, usage: null, reason: 'session row carries no totalTokens' };
  if (contextTokens === null) return { ...base, measured: false, windowUnknown: true, usage: null, reason: 'session row carries no contextTokens' };
  return { ...base, measured: true, usage: totalTokens / contextTokens, reason: null };
}

export const CONTEXT_WINDOW_UNKNOWN_REASON =
  'context window unknown: the sessions.describe row carries a fresh total but no contextTokens for this session\'s model, so no fill target or budget can be sized; refusing rather than guessing a window';

/**
 * The filler a measured window needs: what the plan aims at, target plus the
 * step overshoot, from an empty session. The first measured total also holds
 * the system prompt, so a real fill needs less.
 */
export function fillBudgetForWindow(contextTokens, target = DEFAULT_FILL_TARGET) {
  return Math.ceil((target + FILL_TARGET_OVERSHOOT) * contextTokens);
}

/**
 * The fill turns a budget needs: the calibration turn, the budget in the
 * largest chunks at the lowest token rate, and one top-up turn; never fewer
 * than FILL_MIN_TURNS. A budget under the ceiling keeps this at 13 or fewer.
 */
export function fillTurnsForBudget(budgetTokens) {
  return Math.max(FILL_MIN_TURNS, 2 + Math.ceil(budgetTokens / (FILL_MAX_CHUNK_CHARS * FILL_MIN_TOKENS_PER_CHAR)));
}

/**
 * An explicit fill override from the environment: { value: null } when unset
 * or empty, { value } for a positive whole number, otherwise { error } naming
 * the variable. A malformed override refuses the run; it never falls back to
 * the window-derived value silently.
 */
export function fillOverrideFromEnv(env, name) {
  const raw = env?.[name];
  if (raw === undefined || raw === null || String(raw).trim() === '') return { value: null, error: null };
  const value = Number(String(raw).trim());
  return Number.isSafeInteger(value) && value > 0
    ? { value, error: null }
    : { value: null, error: `${name}=${JSON.stringify(String(raw))} is not a positive whole number; unset it to size the fill from the context window` };
}

/**
 * The fill's token budget and turn allowance for a measured window. An
 * explicit budget or turn count (the env overrides) wins; otherwise the budget
 * follows the window and the turns follow the budget. An unknown window, or a
 * window-derived budget over the ceiling, refuses with the reason named.
 */
export function resolveFillAllowance({
  contextTokens,
  target = DEFAULT_FILL_TARGET,
  budgetTokens = null,
  maxTurns = null,
  ceilingTokens = FILL_BUDGET_CEILING_TOKENS,
} = {}) {
  const refused = (reason, extra = {}) => ({ ok: false, reason, budgetTokens: null, budgetSource: null, maxTurns: null, maxTurnsSource: null, ceilingTokens, ...extra });
  if (!isNumber(contextTokens) || contextTokens <= 0) return refused(CONTEXT_WINDOW_UNKNOWN_REASON);
  const explicitBudget = isNumber(budgetTokens) && budgetTokens > 0;
  const budget = explicitBudget ? Math.floor(budgetTokens) : fillBudgetForWindow(contextTokens, target);
  const budgetSource = explicitBudget ? 'override' : 'context-window';
  if (!explicitBudget && budget > ceilingTokens) {
    return refused(
      `reaching ${pct(target)} of a ${contextTokens}-token window needs a fill budget of about ${budget} tokens, over the ${ceilingTokens}-token hard ceiling on a window-derived budget; set ${FILL_BUDGET_ENV} to accept a larger fill explicitly`,
      { budgetTokens: budget, budgetSource },
    );
  }
  const explicitTurns = isNumber(maxTurns) && maxTurns > 0;
  return {
    ok: true,
    reason: null,
    budgetTokens: budget,
    budgetSource,
    maxTurns: explicitTurns ? Math.floor(maxTurns) : fillTurnsForBudget(budget),
    maxTurnsSource: explicitTurns ? 'override' : 'budget',
    ceilingTokens,
  };
}

/**
 * Next fill step. 'done' once measured usage reaches the target; 'fill' with a
 * character count sized from the measured gap, never planning a total at or
 * past the automatic-compaction line minus its margin; 'stop' with a reason
 * when the window is unknown, the target is not reachable below that line, or
 * the gap cannot be closed within the turn and token budgets. budgetTokens and
 * maxTurns left null follow the window (resolveFillAllowance); the allowance
 * in force comes back on every answer that measured a window.
 */
export function planFillStep({
  measurement,
  turnsUsed,
  filledTokens = 0,
  tokensPerChar = FILL_INITIAL_TOKENS_PER_CHAR,
  target = DEFAULT_FILL_TARGET,
  ceiling = DEFAULT_FILL_CEILING,
  budgetTokens = null,
  maxTurns = null,
  budgetCeilingTokens = FILL_BUDGET_CEILING_TOKENS,
  reserveTokens = COMPACTION_RESERVE_FLOOR_TOKENS,
} = {}) {
  if (measurement?.windowUnknown) return { action: 'stop', chars: 0, reason: CONTEXT_WINDOW_UNKNOWN_REASON, allowance: null };
  if (!measurement?.measured) return { action: 'stop', chars: 0, reason: `no measured usage: ${measurement?.reason || 'unknown'}`, allowance: null };
  const { usage, totalTokens, contextTokens } = measurement;
  const allowance = resolveFillAllowance({ contextTokens, target, budgetTokens, maxTurns, ceilingTokens: budgetCeilingTokens });
  const stop = (reason) => ({ action: 'stop', chars: 0, reason, allowance });
  if (usage >= target) return { action: 'done', chars: 0, reason: null, allowance };
  const capTokens = fillCompactionCap(contextTokens, reserveTokens);
  if (Math.ceil(target * contextTokens) >= capTokens) {
    return stop(`context target unreachable below automatic compaction: ${pct(target)} of a ${contextTokens}-token window is not below the automatic-compaction line ${automaticCompactionLine(contextTokens, reserveTokens)} minus its margin (${capTokens})`);
  }
  if (!allowance.ok) return stop(allowance.reason);
  if (turnsUsed >= allowance.maxTurns) {
    return stop(`measured usage ${pct(usage)} is below the ${pct(target)} target after ${turnsUsed} fill turns`);
  }
  const wantTokens = Math.ceil((target + FILL_TARGET_OVERSHOOT) * contextTokens) - totalTokens;
  const roomTokens = Math.min(Math.floor(ceiling * contextTokens), capTokens) - totalTokens;
  const stepTokens = Math.max(0, Math.min(wantTokens, roomTokens));
  if (filledTokens + stepTokens > allowance.budgetTokens) {
    return stop(`reaching ${pct(target)} of a ${contextTokens}-token window needs about ${filledTokens + stepTokens} filler tokens, over the ${allowance.budgetTokens}-token fill budget`);
  }
  const rate = Math.max(FILL_MIN_TOKENS_PER_CHAR, tokensPerChar);
  const chars = Math.min(FILL_MAX_CHUNK_CHARS, Math.max(FILL_MIN_CHUNK_CHARS, Math.ceil(stepTokens / rate)));
  return { action: 'fill', chars, reason: null, stepTokens, allowance };
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
    // Both are integer percents of a raw fraction compared before rounding
    // (request-compaction-tool.ts:244-253): a raw 69.5-69.99% reads 70 vs 70 (review N2).
    if (contextUsage !== null && threshold !== null && contextUsage <= threshold) return { ...base, kind: 'threshold_rejected_measured' };
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

/**
 * A bound child's own de-enveloped spawn task (child-observer subagentTaskText)
 * is a released lifeboat only when it starts with the product's release
 * composition "[continuation:post-compaction] [continuation:chain-hop:N] " and
 * carries the row token. The prefix anywhere else is requester-written text.
 */
export function isReleasedLifeboatTask(taskText, taskToken) {
  return typeof taskText === 'string' && typeof taskToken === 'string' && taskToken.length > 0 &&
    RELEASED_LIFEBOAT_TASK_START.test(taskText.trimStart()) && taskText.includes(taskToken);
}

/**
 * The first call in a requester assistant row whose arguments carry the
 * post-compaction prefix (by name or through Tool Search's dispatcher), as
 * { tool, toolCallId }, else null. Such a call can create a child whose task
 * looks released, so the row refuses its lifeboat binding.
 */
export function requesterPrefixCall(message) {
  if (String(message?.role || '').toLowerCase() !== 'assistant' || !Array.isArray(message.content)) return null;
  for (const part of message.content) {
    const target = toolCallTarget(part);
    if (target && JSON.stringify(target.args).includes(POST_COMPACTION_TASK_PREFIX)) {
      return { tool: target.name, toolCallId: typeof part.id === 'string' ? part.id : null };
    }
  }
  return null;
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
  if (e.requester_prefix_call) {
    return partial(`a requester ${e.requester_prefix_call.tool || 'tool'} call carried the ${POST_COMPACTION_TASK_PREFIX} prefix; no child can be bound as the released lifeboat`);
  }
  if (e.proof_dispatched !== true) {
    return partial(`context fill stopped before the proof turn: ${e.fill_stop_reason || 'the fill did not finish'}`);
  }
  if (e.dispatch_accepted !== true) return { verdict: 'FAIL-candidate', reason: 'the proof turn was not accepted' };
  const kind = e.compaction_outcome_kind || 'missing';
  if (kind === 'missing' && e.staging_receipt_observed !== true) {
    return { verdict: 'FAIL-candidate', reason: 'neither a staging receipt nor a request_compaction result is bound to the proof turn' };
  }
  if (kind === 'threshold_rejected_measured') {
    const compared = e.compaction_context_usage < e.compaction_threshold
      ? `contextUsage ${e.compaction_context_usage}% < threshold ${e.compaction_threshold}%`
      : `contextUsage ${e.compaction_context_usage}% reported at threshold ${e.compaction_threshold}%: the tool rounds a raw usage just below the threshold up to it`;
    return partial(`measured below-threshold rejection (${compared}): the fill did not reach the accepted compaction path`);
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
