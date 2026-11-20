// The token budget's cutoff: which sessions a tripped run may abort, the one
// abort pass, and the overshoot the receipt reports.
//
// 🌊's ruling (Discord 1573086211386384495): at the trip, call sessions.abort
// only on sessions the run provably owns, fixtures only for now. Ambiguous
// ownership fails closed, a prince session is never touched, metering
// continues through the drain, and the receipt reports the actual overshoot.
// It is a cutoff, not a hard ceiling. 🌫's additions (1573086236497678419): an
// abort acknowledgement does not prove that future wakes or provider work have
// stopped, the observed overshoot is reported apart from the maximum possible
// one (unknown when unbounded), and a quiet polling window is not proof that
// the drain completed.
//
// This module holds the decisions and nothing that opens a socket, so each
// rule is tested on its own. scripts/token-budget-abort.mjs runs them against
// the gateway.
//
// What sessions.abort does, at openclaw ab5a30ea79b776f149e24b1fccab9e79b0a5d299:
// - Params { key, runId, agentId, clearQueued, userInitiated }, a closed object
//   (packages/gateway-protocol/src/schema/sessions.ts:541-549); operator.write
//   (src/gateway/methods/core-descriptors.ts:247). Success is
//   { ok, abortedRunId, status: "aborted" | "no-active-run" }
//   (src/gateway/server-methods/sessions-abort.ts:69-76). A key no session holds,
//   under a configured agent, is not an error: it answers no-active-run
//   (src/gateway/server-methods/sessions-abort.test.ts:224-234). A key naming
//   an unknown agent is refused
//   (sessions-abort.ts:261-263).
// - A key with no runId cascades (sessions-abort.ts:570): every subagent run
//   the session controls, recursively, chosen from the in-memory subagent
//   registry by controller session key
//   (src/agents/subagents/registry/subagent-registry-queries.ts:166-169,
//   subagent-control-scope.ts:200-201, subagent-control-kill.ts:360-363,383).
//   sessions.list shows that controller as controlOwnerSessionKey while the
//   child's run is live or queued (src/gateway/session-utils-row.ts:650,
//   src/agents/subagents/registry/subagent-registry-read.ts:476-488); in the
//   normal spawn path spawnedBy is the same key
//   (src/agents/subagents/spawn/subagent-spawn-request.ts:126,
//   subagent-spawn.ts:382,550). parentSessionKey is navigation lineage, which
//   the cascade never reads (session-utils-row.ts:504-505). A session created
//   with a parent gets spawnedBy only under a spawn-tool policy
//   (src/gateway/session-create-inheritance.ts:222-231), and no session-create
//   code registers a subagent run (by code reading, not by a cited line), so
//   the cascade's reach is the registry's, not the listing's. This cutoff
//   therefore aborts every owned session itself, descendants included, rather
//   than relying on the cascade.
// - An adopting sessions.create still writes the parent link onto the session
//   it adopts (src/gateway/session-create-service.ts:888-907), while spawnedBy
//   comes only with a new entry (:885). So any operator client can re-parent a
//   session onto an owned key, and a descendant needs a spawnedBy or
//   controlOwnerSessionKey link to an owned session: a link by
//   parentSessionKey alone proves nothing.
// - A key-only abort is a client-session stop, which cancels the session's
//   queued inputs (src/sessions/session-controller.stop.ts:77-79,91,507). The
//   cutoff also passes clearQueued: true, as the schema documents ("also
//   discard followup and lane queues", packages/gateway-protocol/src/schema/
//   sessions.ts:545-546) and the product's own test uses
//   (src/gateway/server-methods/sessions.abort-yielded.test.ts:281-288). In
//   the handler at ab5a it only gates the MCP runtime's retirement
//   (sessions-abort.ts:459-465); the stop itself cancels queued input.
// - It does not cancel a continue_work wake already scheduled: only reset or
//   delete cleanup and /continuations cancel do
//   (src/auto-reply/reply/session-reset-cleanup.ts:165-197,
//   src/auto-reply/reply/commands-continuations.ts:52), and the wake's own
//   checks never read sessions.abort state; the signal they check is the
//   reset and claim signal
//   (src/auto-reply/continuation/work-dispatch-execution.ts:214-291). A wake
//   can therefore start a new model turn after the abort answered.
// - A non-admin caller may abort only a run started from its own connection,
//   or a run with no owner
//   (src/gateway/server-methods/chat-abort-authorization.ts:222-227);
//   otherwise the abort answers INVALID_REQUEST "unauthorized"
//   (chat-abort-handler.ts:206-208). A sessions.send turn is owned by the socket
//   that sent it (src/gateway/server-methods/chat-send-admission.ts:227). The
//   cutoff's connection is not the row's k6 socket, so an in-flight dispatch
//   turn can refuse; that is recorded, never retried.
// - sessions.create answers { key, sessionId } with the canonical key
//   (src/gateway/server-methods/sessions-create.ts:688-691) but adopts an
//   existing key without saying so (src/gateway/session-create-service.ts:
//   711-713), so a create answer alone proves no creation. A root is owned
//   only if its key was also absent from the meter's baseline listing; every
//   disposable key carries a fresh nonce.

import { sessionPublicId } from './token-budget.mjs';

// A session's public form is the meter's own: the 12-hex hash of its agent id
// and session id, or of its key while it has no session id
// (lib/token-budget.mjs). Never the key or the session id itself.
export { sessionPublicId };

export const CUTOFF_GUARD = 'cutoff, not a hard ceiling';
export const MAX_POSSIBLE_UNBOUNDED = 'unknown / unbounded by this guard';
export const DRAIN_NOTE = 'a quiet polling window is not proof that the drain has completed';
export const ABORT_ACK_NOTE = 'an abort acknowledgement does not prove that future wakes or provider work have stopped';
export const USAGE_ATTRIBUTION_NOTE =
  'usage is counted in the reading where it first becomes visible, when its model call completes and is written to the transcript, not when the request was sent';
export const ABORT_BOUNDARY_NOTE =
  'a reading counts after the abort when it completed at or after the cutoff ended; one begun before that straddles the abort and counts after it, so growth after the abort is never understated, though it can include usage that landed during the abort pass';

export const AMBIGUITY_REASONS = Object.freeze([
  'recorded-session-present-at-baseline',
  'recorded-session-id-mismatch',
  'recorded-session-id-unverifiable',
  'conflicting-records',
  'configured-session',
  'unknown-parent',
  'ambiguous-parent',
  'conflicting-ancestry',
  'lineage-only-parent',
  'ancestry-cycle',
  'selector-match-without-record',
  'unrecorded-new-session',
]);
export const ABORT_OUTCOMES = Object.freeze(['aborted', 'no-active-run', 'acknowledged', 'partial', 'refused', 'failed', 'not-attempted', 'skipped']);

const AGENT_KEY = /^agent:([^:]+):/u;
const DISPOSABLE_LABEL_PREFIX = 'k6 ';
const CODE = /^[A-Z][A-Z0-9_]{0,63}$/u;
const LOCAL_ERROR = /^[a-z][a-z0-9-]{0,63}$/u;

const agentIdOf = (key) => AGENT_KEY.exec(key)?.[1] ?? null;
const nonEmpty = (value) => (typeof value === 'string' && value ? value : null);

/**
 * Which listed sessions this run owns, and which of those it may abort.
 *
 * - `records`: the ownership records the run's k6 rows logged when the gateway
 *   answered their sessions.create ({ key, sessionId }, lib/session-ownership.mjs).
 * - `baseline`: the sessions the token-budget meter listed before any row ran
 *   ({ key, sessionId }).
 * - `rows`: a sessions.list taken at the trip (key, sessionId, spawnedBy,
 *   parentSessionKey, controlOwnerSessionKey, label).
 * - `configuredKeys`: the configured session keys the rows use.
 *
 * A session is owned when it is
 * - a root: its key carries a record, its listed session id equals the
 *   recorded one, and its key was not listed at the baseline; or
 * - a descendant: every session its spawnedBy, parentSessionKey and
 *   controlOwnerSessionKey name is listed and owned, transitively, and at
 *   least one of them is a spawnedBy or controlOwnerSessionKey link (an
 *   adopting create can write parentSessionKey for any client).
 * A session listed at the baseline (every prince session: main, heartbeat,
 * channel sessions), a configured key, or a session descending only from such
 * sessions is untouched. A session whose ownership cannot be decided is
 * ambiguous, with its reason, and is left alone too:
 * - a record that disagrees with the listing, cannot be checked, or names a
 *   pre-existing or configured session;
 * - a parent that is not listed or is itself ambiguous, an ancestry that
 *   mixes owned and unowned parents or loops, or owned parents named only by
 *   parentSessionKey;
 * - a session new since the baseline with no record and no parent, including
 *   one whose "k6 " label matches the disposable-session selector: a selector
 *   is never a record.
 * An owned session is still not aborted when any listed session under it in
 * the control tree (controlOwnerSessionKey, the product's cascade rule, at
 * any depth) is not owned: its abort would cascade, through owned sessions
 * if need be, into a session the run cannot prove is its own.
 */
export function resolveOwnership({ records = [], baseline = [], rows = [], configuredKeys = [] }) {
  const baselineKeys = new Set(baseline.map((entry) => entry?.key).filter(nonEmpty));
  const configured = [...new Set(configuredKeys.filter(nonEmpty))];
  const isConfigured = (key) => configured.some((wanted) => key === wanted
    || (!wanted.startsWith('agent:') && agentIdOf(key) !== null && key === `agent:${agentIdOf(key)}:${wanted}`));
  const recordsByKey = new Map();
  for (const record of records) {
    const key = nonEmpty(record?.key);
    if (!key) continue;
    if (!recordsByKey.has(key)) recordsByKey.set(key, new Set());
    recordsByKey.get(key).add(nonEmpty(record.sessionId));
  }
  const listed = new Map();
  for (const row of rows) {
    const key = nonEmpty(row?.key);
    if (key && !listed.has(key)) listed.set(key, row);
  }

  // key -> { status: 'owned' | 'untouched' | 'ambiguous', role, depth, reason }
  const decided = new Map();
  const decide = (key, verdict) => {
    decided.set(key, verdict);
    return verdict;
  };

  function rootVerdict(key, row) {
    const recordedIds = recordsByKey.get(key);
    if (baselineKeys.has(key)) return { status: 'ambiguous', reason: 'recorded-session-present-at-baseline' };
    if (isConfigured(key)) return { status: 'ambiguous', reason: 'configured-session' };
    if (recordedIds.size > 1) return { status: 'ambiguous', reason: 'conflicting-records' };
    const [recordedId] = recordedIds;
    const listedId = nonEmpty(row.sessionId);
    if (!recordedId || !listedId) return { status: 'ambiguous', reason: 'recorded-session-id-unverifiable' };
    if (recordedId !== listedId) return { status: 'ambiguous', reason: 'recorded-session-id-mismatch' };
    return { status: 'owned', role: 'root', depth: 0 };
  }

  const parentsOf = (row) => [...new Set(
    [row.spawnedBy, row.parentSessionKey, row.controlOwnerSessionKey].map(nonEmpty).filter((parent) => parent && parent !== row.key),
  )];
  // A recorded, pre-existing or configured session is decided without its
  // parents, so an ancestry loop can only run through the other sessions.
  // Every session on such a loop is marked before anything descends from it.
  const linksAncestry = (key) => listed.has(key) && !recordsByKey.has(key) && !baselineKeys.has(key) && !isConfigured(key);
  for (const start of listed.keys()) {
    if (!linksAncestry(start)) continue;
    const seen = new Set();
    const stack = parentsOf(listed.get(start)).filter(linksAncestry);
    while (stack.length) {
      const key = stack.pop();
      if (key === start) {
        decide(start, { status: 'ambiguous', reason: 'ancestry-cycle' });
        break;
      }
      if (seen.has(key)) continue;
      seen.add(key);
      stack.push(...parentsOf(listed.get(key)).filter(linksAncestry));
    }
  }
  function resolve(key) {
    if (decided.has(key)) return decided.get(key);
    const row = listed.get(key);
    if (!row) return { status: 'unknown' };
    if (recordsByKey.has(key)) return decide(key, rootVerdict(key, row));
    if (baselineKeys.has(key) || isConfigured(key)) return decide(key, { status: 'untouched' });
    const parents = parentsOf(row);
    if (parents.length === 0) {
      const labelled = typeof row.label === 'string' && row.label.startsWith(DISPOSABLE_LABEL_PREFIX);
      return decide(key, { status: 'ambiguous', reason: labelled ? 'selector-match-without-record' : 'unrecorded-new-session' });
    }
    const verdicts = parents.map(resolve);
    const has = (status) => verdicts.some((verdict) => verdict.status === status);
    if (has('unknown')) return decide(key, { status: 'ambiguous', reason: 'unknown-parent' });
    if (has('ambiguous')) return decide(key, { status: 'ambiguous', reason: 'ambiguous-parent' });
    if (verdicts.every((verdict) => verdict.status === 'owned')) {
      const controlLinked = [row.spawnedBy, row.controlOwnerSessionKey].some((parent) => nonEmpty(parent) && parent !== key);
      if (!controlLinked) return decide(key, { status: 'ambiguous', reason: 'lineage-only-parent' });
      return decide(key, { status: 'owned', role: 'descendant', depth: Math.max(...verdicts.map((verdict) => verdict.depth)) + 1 });
    }
    if (verdicts.every((verdict) => verdict.status === 'untouched')) return decide(key, { status: 'untouched' });
    return decide(key, { status: 'ambiguous', reason: 'conflicting-ancestry' });
  }

  const order = [...listed.keys()];
  for (const key of order) resolve(key);

  const isOwned = (key) => decided.get(key)?.status === 'owned';
  const entry = (key) => {
    const row = listed.get(key);
    return {
      key,
      sessionId: nonEmpty(row?.sessionId),
      labelled: typeof row?.label === 'string' && row.label.startsWith(DISPOSABLE_LABEL_PREFIX),
    };
  };
  // Roots newest record first (the stopped row's sessions are the likeliest
  // to be running), then descendants by depth, so a parent is stopped before
  // its children.
  const roots = [...recordsByKey.keys()].reverse().filter(isOwned);
  const descendants = order
    .filter((key) => isOwned(key) && decided.get(key).role === 'descendant')
    .sort((a, b) => decided.get(a).depth - decided.get(b).depth);
  // The control tree, by controlOwnerSessionKey: what a key-only abort of each
  // session would cascade into (recursively, subagent-control-kill.ts:360-363).
  const controlled = new Map();
  for (const row of listed.values()) {
    const controller = nonEmpty(row.controlOwnerSessionKey);
    if (!controller || controller === row.key) continue;
    if (!controlled.has(controller)) controlled.set(controller, []);
    controlled.get(controller).push(row.key);
  }
  const reachesUnowned = (start) => {
    const seen = new Set([start]);
    const stack = [...(controlled.get(start) ?? [])];
    while (stack.length) {
      const key = stack.pop();
      if (seen.has(key)) continue;
      seen.add(key);
      if (!isOwned(key)) return true;
      stack.push(...(controlled.get(key) ?? []));
    }
    return false;
  };
  const owned = [...roots, ...descendants].map((key) => {
    const cascadeReachesUnowned = reachesUnowned(key);
    return {
      ...entry(key),
      role: decided.get(key).role,
      depth: decided.get(key).depth,
      abortable: !cascadeReachesUnowned,
      ...(cascadeReachesUnowned ? { skipReason: 'cascade-would-reach-unowned-session' } : {}),
    };
  });
  const ambiguous = order
    .filter((key) => decided.get(key)?.status === 'ambiguous')
    .map((key) => ({ ...entry(key), reason: decided.get(key).reason }));
  const recordedNotListed = [...recordsByKey.keys()].filter((key) => !listed.has(key)).length;
  const untouched = order.filter((key) => decided.get(key)?.status === 'untouched');
  return {
    owned,
    ambiguous,
    recordedNotListed,
    untouched: {
      preExisting: untouched.filter((key) => baselineKeys.has(key)).length,
      configured: untouched.filter((key) => !baselineKeys.has(key) && isConfigured(key)).length,
      notOwned: untouched.filter((key) => !baselineKeys.has(key) && !isConfigured(key)).length,
    },
  };
}

function rpcFailure(method, error) {
  const code = typeof error?.code === 'string' && CODE.test(error.code) ? error.code : 'ERROR';
  return `${method}:${code}`;
}

// The refusals the product names (sessions-abort.ts, chat-abort-handler.ts:207,
// chat-abort-descendants.ts:288-297), as a fixed vocabulary: a gateway message
// can carry keys, so it is never published.
function refusalKind(error) {
  const message = typeof error?.message === 'string' ? error.message : '';
  if (error?.code === 'INVALID_REQUEST' && message === 'unauthorized') return 'unauthorized';
  if (/descendant cancellation was incomplete/u.test(message)) return 'descendants-incomplete';
  if (/not found/u.test(message)) return 'not-found';
  return 'other';
}

function localFailure(error) {
  const message = String(error?.message || error || '');
  return LOCAL_ERROR.test(message) ? message : 'rpc-error';
}

/**
 * The cutoff's one abort pass over the owned sessions, in order. Each
 * abortable session gets exactly one sessions.abort call and nothing is ever
 * retried: a refusal is recorded as refused; a call with no answer (timeout,
 * closed socket) is failed, and every later session is not-attempted, since
 * reconnecting would be a second try under another name. Sessions left once
 * the deadline passes are not-attempted too. `rpc(method, params)` resolves
 * to { ok, payload, error } or throws.
 */
export async function runAbortPass({ rpc, owned, deadline, clock = () => Date.now() }) {
  const results = [];
  let connectionError = null;
  let calls = 0;
  for (const session of owned) {
    const base = { key: session.key, sessionId: session.sessionId, role: session.role, depth: session.depth };
    if (session.abortable === false) {
      results.push({ ...base, outcome: 'skipped', reason: session.skipReason ?? 'not-abortable' });
      continue;
    }
    if (connectionError) {
      results.push({ ...base, outcome: 'not-attempted', reason: 'abort-connection-failed' });
      continue;
    }
    if (clock() >= deadline) {
      results.push({ ...base, outcome: 'not-attempted', reason: 'abort-deadline' });
      continue;
    }
    calls += 1;
    let answer;
    try {
      answer = await rpc('sessions.abort', { key: session.key, clearQueued: true });
    } catch (error) {
      connectionError = localFailure(error);
      results.push({ ...base, outcome: 'failed', error: connectionError });
      continue;
    }
    if (answer?.ok === true) {
      const status = answer.payload?.status;
      if (status === 'aborted' || status === 'no-active-run') results.push({ ...base, outcome: status, status });
      else results.push({ ...base, outcome: 'acknowledged', status: 'unrecognized' });
    } else {
      const refusal = refusalKind(answer?.error);
      // "Session stopped, but descendant cancellation was incomplete": the
      // session itself stopped (chat-abort-descendants.ts:288-297).
      results.push({ ...base, outcome: refusal === 'descendants-incomplete' ? 'partial' : 'refused', error: rpcFailure('sessions-abort', answer?.error), refusal });
    }
  }
  return { results, calls, connectionError };
}

const count = (items, predicate) => items.filter(predicate).length;
const timeOf = (value) => (typeof value === 'string' ? Date.parse(value) : NaN);

/**
 * The overshoot the receipt reports, from the meter's final state, the abort
 * document and the drain. The observed figures are measured; the maximum
 * possible overshoot is never claimed: nothing here bounds work the gateway
 * keeps running, so it is MAX_POSSIBLE_UNBOUNDED with the reasons that apply.
 */
export function computeOvershoot({ state = null, abort = null, drain = null, cutoffStarted = false } = {}) {
  const budget = Number.isSafeInteger(state?.budget) ? state.budget : null;
  const readings = (state?.readings ?? []).filter((reading) => !reading.discovery);
  const final = Number.isSafeInteger(state?.cumulative) ? state.cumulative : null;
  const trip = state?.trip ?? null;
  const tripAt = timeOf(trip?.at);
  // The abort is when the cutoff ended: the runner's mark, or else the abort
  // document's finish. A reading counts on the side of it where the reading
  // completed, so one begun before it and completed after it straddles it and
  // counts after (ABORT_BOUNDARY_NOTE). The meter keeps the totals as they
  // stood before the first reading that completed after the mark
  // (state.abortSessions); without them (the meter was gone), the readings
  // are split here the same way. A reading with no completion time (none
  // recorded) completes at its start plus its read time.
  const marked = abort ? state?.abortSessions ?? null : null;
  const abortAt = timeOf(marked?.markedAt) || timeOf(abort?.completedAt);
  const completedAt = (reading) => {
    const completed = timeOf(reading.completedAt);
    return Number.isFinite(completed) ? completed : timeOf(reading.at) + (Number.isFinite(reading.readMs) ? reading.readMs : 0);
  };
  const afterAbort = Number.isFinite(abortAt) ? readings.filter((reading) => completedAt(reading) >= abortAt) : [];
  const straddlingAbort = afterAbort.filter((reading) => timeOf(reading.at) < abortAt);
  const beforeAbortCumulative = Number.isSafeInteger(marked?.cumulative)
    ? marked.cumulative
    : (Number.isFinite(abortAt) ? readings.filter((reading) => reading.readable && completedAt(reading) < abortAt).at(-1)?.cumulative ?? null : null);
  let quietReadingsAtEnd = 0;
  for (let index = readings.length - 1; index >= 0; index -= 1) {
    if (readings[index].readable !== true || readings[index].increment !== 0) break;
    quietReadingsAtEnd += 1;
  }
  const lastGrowth = readings.filter((reading) => reading.readable && reading.increment > 0).at(-1) ?? null;

  // Per session: growth after the trip, against the totals the tripping
  // reading left, and after the abort, against the totals the meter kept
  // before the first reading that completed after it. A session first seen
  // later counts from its baseline.
  // A figure after an event is measured only if a readable reading came after
  // it (for the abort, completed after it); otherwise it is null, never a
  // measured zero. The drain is metered only by a readable reading begun
  // after the abort.
  const readableAfterTrip = Number.isFinite(tripAt) ? readings.filter((reading) => reading.readable === true && timeOf(reading.at) > tripAt).length : 0;
  const readableAfterAbort = afterAbort.filter((reading) => reading.readable === true).length;
  const readableBegunAfterAbort = afterAbort.filter((reading) => reading.readable === true && timeOf(reading.at) > abortAt).length;
  const atTrip = state?.tripSessions && readableAfterTrip ? Object.fromEntries(state.tripSessions.map(({ id, lastTokens }) => [id, lastTokens])) : null;
  const sessionsGrowingAfterTrip = atTrip
    ? (state?.sessions ?? [])
      .map((session) => ({ id: session.id, tokens: session.lastTokens - (Object.hasOwn(atTrip, session.id) ? atTrip[session.id] : session.baselineTokens) }))
      .filter((session) => session.tokens > 0)
    : null;
  // A meter that kept no totals from before the abort (sessions null) gives no per-session figure.
  const snapshot = Array.isArray(marked?.sessions) && readableAfterAbort ? Object.fromEntries(marked.sessions.map(({ id, lastTokens }) => [id, lastTokens])) : null;
  // A session the cutoff named by its key, because it had no session id then,
  // is metered under the session id it has since: the meter links the two
  // (abortId). A meter that could not read the cutoff's document could link
  // none, so there a session no abort id names is of unknown ownership
  // (null), never unowned.
  const outcomes = new Map((abort?.sessions ?? []).map((session) => [session.id, session.outcome]));
  const unlinked = marked?.abortIdsRead === null && outcomes.size > 0;
  const abortIdOf = (session) => [session.id, session.abortId].find((id) => typeof id === 'string' && outcomes.has(id)) ?? null;
  const sessionsGrowingAfterAbort = snapshot
    ? (state?.sessions ?? [])
      .map((session) => {
        const abortId = abortIdOf(session);
        return {
          id: session.id,
          tokens: session.lastTokens - (Object.hasOwn(snapshot, session.id) ? snapshot[session.id] : session.baselineTokens),
          owned: abortId ? true : (unlinked ? null : false),
          ...(abortId ? { abortOutcome: outcomes.get(abortId) } : {}),
          ...(abortId && abortId !== session.id ? { abortId } : {}),
        };
      })
      .filter((session) => session.tokens > 0)
    : null;

  const sessions = abort?.sessions ?? [];
  const unstopped = count(sessions, (session) => ['refused', 'failed', 'not-attempted'].includes(session.outcome));
  const partial = count(sessions, (session) => session.outcome === 'partial');
  const skipped = count(sessions, (session) => session.outcome === 'skipped');
  const ambiguous = abort?.ambiguous?.length ?? 0;
  const configuredInScope = [state?.baseline?.scope, ...readings.map((reading) => reading.scope)]
    .some((scope) => (scope?.byReason?.configured ?? 0) > 0);
  const unownedInScope = readings.some((reading) => (reading.scope?.byReason?.['new-since-baseline'] ?? 0) > 0);
  let drainRecord = drain ?? { metered: false, reason: abort || cutoffStarted ? 'drain-unrecorded' : 'no-cutoff' };
  if (drainRecord.metered === true && !readableBegunAfterAbort) drainRecord = { ...drainRecord, metered: false, reason: 'no-readable-reading-after-abort' };
  const phase = abort?.phase ?? 'done';
  const reasons = [];
  if (!abort) reasons.push(cutoffStarted ? 'the cutoff left no record, so sessions may have been aborted' : 'no abort was attempted');
  else if (phase === 'aborting') {
    reasons.push('the cutoff left no complete record, so sessions may have been aborted');
    reasons.push(ABORT_ACK_NOTE);
  } else if (phase !== 'done') reasons.push(`the cutoff stopped while ${phase}, before any abort call`);
  else if (abort.attempted === false) reasons.push(`no abort was attempted: ${abort.reason}`);
  else if (abort.ownership && abort.ownership.rowsListed === null) {
    reasons.push(`the cutoff could not decide ownership, so no session was aborted: ${abort.error ?? 'unknown'}`);
  } else {
    reasons.push(ABORT_ACK_NOTE);
    reasons.push('sessions.abort does not cancel a continue_work wake that was already scheduled (openclaw ab5a30ea, by code reading)');
    if (abort.error) reasons.push(`the abort pass stopped early: ${abort.error}`);
  }
  if (unstopped) reasons.push(`${unstopped} owned session(s) were refused, failed or not attempted, and nothing is retried`);
  if (partial) reasons.push(`${partial} owned session(s) stopped, but their descendants' cancellation was incomplete`);
  if (skipped) reasons.push(`${skipped} owned session(s) were not aborted because their cascade would reach a session the run does not own`);
  if (ambiguous) reasons.push(`${ambiguous} session(s) of ambiguous ownership were not aborted`);
  if (configuredInScope) reasons.push('configured sessions the rows use are in the meter\'s scope and are never aborted');
  if (unownedInScope) reasons.push('sessions new since the baseline that the run cannot prove it created are counted but never aborted');
  if (sessionsGrowingAfterAbort?.length) reasons.push(`usage grew after the abort in ${sessionsGrowingAfterAbort.length} session(s)`);
  if ((abort || cutoffStarted) && drainRecord.metered === false) reasons.push(`the drain was not metered: ${drainRecord.reason}`);
  reasons.push('compaction model calls and detached memory-flush runs are counted by no usage surface');
  reasons.push('a model call still streaming is invisible until it completes, and then lands whole');

  const afterTrip = Number.isFinite(tripAt) ? readings.filter((reading) => timeOf(reading.at) > tripAt) : [];
  return {
    guard: CUTOFF_GUARD,
    observed: {
      budget,
      finalCumulative: final,
      pastBudgetTokens: final !== null && budget !== null ? Math.max(0, final - budget) : null,
      postTripTokens: trip && final !== null && readableAfterTrip ? final - trip.cumulative : null,
      postAbortTokens: beforeAbortCumulative !== null && final !== null && readableAfterAbort ? final - beforeAbortCumulative : null,
      readingsAfterTrip: afterTrip.length,
      readingsAfterAbort: afterAbort.length,
      readingsStraddlingAbort: straddlingAbort.length,
      unreadableReadingsAfterAbort: afterAbort.filter((reading) => reading.readable !== true).length,
      lastGrowthAt: lastGrowth?.at ?? null,
      quietReadingsAtEnd,
      sessionsGrowingAfterTrip,
      sessionsGrowingAfterAbort,
      attribution: USAGE_ATTRIBUTION_NOTE,
      abortBoundary: ABORT_BOUNDARY_NOTE,
    },
    maxPossible: MAX_POSSIBLE_UNBOUNDED,
    maxPossibleReasons: reasons,
    drain: { ...drainRecord, complete: 'unproven', note: DRAIN_NOTE },
  };
}
