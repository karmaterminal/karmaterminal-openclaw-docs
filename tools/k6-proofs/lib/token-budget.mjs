// Token budget for a live proof matrix: the input, the poll interval, and the
// ledger that decides when the run must stop.
//
// 🌊 put the single live rerun at ab5a30ea on hold behind a hard 3.2M-token
// bound (🕯) that neither the seat nor the model route can enforce (🕯, Discord
// 1573081925374181397), ruling for a harness-side counter that aborts at the
// bound (🌊 1573082087307616310). run-proofs.sh takes the budget, and
// scripts/token-budget-meter.mjs reads usage and keeps this ledger. This module
// holds the arithmetic and nothing that touches a gateway, so the stop rules
// are tested on their own.
//
// The rules, all fail-closed:
// - Only growth since the baseline counts. Usage a session had before the run
//   started is never charged to the run.
// - A session is accounted by its own cumulative counter, at the highest value
//   ever read. One that disappears (deleted, cleaned up) keeps what it was seen
//   to consume, and a counter that goes down never lowers the total.
// - The run stops when the cumulative total reaches the budget, or when the
//   total plus the largest growth seen between two polls would pass it, so the
//   next poll is not allowed to cross it if the run's own pace holds.
// - An unreadable counter stops the run. The first trip is latched: a later
//   reading still records consumption but never re-arms the run.

import { createHash } from 'node:crypto';

export const TOKEN_BUDGET_ENV = 'OPENCLAW_PROOFS_TOKEN_BUDGET';
export const TOKEN_BUDGET_POLL_ENV = 'OPENCLAW_PROOFS_TOKEN_BUDGET_POLL_SECONDS';
// The detection lag is bounded by one poll interval of usage (the overshoot is
// not bounded at all: see lib/token-budget-cutoff.mjs), so the interval is
// fixed for live runs. The variable exists so fixtures can poll faster.
export const DEFAULT_TOKEN_BUDGET_POLL_SECONDS = 5;
const MIN_POLL_SECONDS = 0.05;
const MAX_POLL_SECONDS = 60;
const POLL_SECONDS = /^\d+(?:\.\d{1,3})?$/u;
// At most 15 digits: always a safe integer, and the same shape run-proofs.sh
// checks in bash before it runs any node.
const BUDGET = /^[1-9]\d{0,14}$/u;

export const BUDGET_TRIP_REASONS = Object.freeze(['budget-reached', 'projected-exceed', 'counter-unreadable']);

/**
 * The token budget from its raw input: empty or absent disables enforcement
 * (the matrix runs as it always has), a positive decimal integer enables it,
 * and anything else throws rather than being read as some other budget.
 */
export function parseTokenBudget(raw) {
  if (raw === undefined || raw === null || raw === '') return { enabled: false, budget: null };
  const value = typeof raw === 'string' && BUDGET.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(value)) {
    throw new Error(
      `invalid token budget: set ${TOKEN_BUDGET_ENV} (or --token-budget) to a positive whole number of tokens, ` +
      'at most 15 digits with no sign, separators, exponent or surrounding spaces, or leave it empty for no budget',
    );
  }
  return { enabled: true, budget: value };
}

/** The meter's poll interval in milliseconds. */
export function tokenBudgetPollMs(env = process.env) {
  const raw = env?.[TOKEN_BUDGET_POLL_ENV];
  if (raw === undefined || raw === '') return DEFAULT_TOKEN_BUDGET_POLL_SECONDS * 1000;
  const seconds = POLL_SECONDS.test(raw) ? Number(raw) : NaN;
  if (!(seconds >= MIN_POLL_SECONDS && seconds <= MAX_POLL_SECONDS)) {
    throw new Error(
      `invalid ${TOKEN_BUDGET_POLL_ENV}: ${raw}; set seconds from ${MIN_POLL_SECONDS} to ${MAX_POLL_SECONDS} ` +
      `(default ${DEFAULT_TOKEN_BUDGET_POLL_SECONDS})`,
    );
  }
  return Math.round(seconds * 1000);
}

function sessionTotals(sessions) {
  const totals = new Map();
  for (const [id, tokens] of Object.entries(sessions || {})) {
    if (!Number.isSafeInteger(tokens) || tokens < 0) {
      throw new Error(`session usage for ${id} is not a non-negative whole number of tokens`);
    }
    totals.set(id, tokens);
  }
  return totals;
}

/**
 * A ledger over one run. `baseline` is the reading taken before any row fired;
 * it must be readable, because an unreadable start is never a budget of zero.
 * observe() takes each later reading in order:
 *   { at, readable: true, sessions: { [accountingId]: cumulativeTokens } }
 *   { at, readable: false, error }
 * and returns that reading's entry, including the latched trip if any.
 */
export function createBudgetLedger({ budget, baseline }) {
  if (!Number.isSafeInteger(budget) || budget <= 0) throw new Error('token budget must be a positive whole number');
  if (baseline?.readable !== true) throw new Error('a token-budget ledger needs a readable baseline');
  const base = sessionTotals(baseline.sessions);
  const highest = new Map(base);
  const readings = [];
  let cumulative = 0;
  let maxIncrement = 0;
  let trip = null;

  const total = () => {
    let sum = 0;
    for (const [id, tokens] of highest) sum += tokens - (base.get(id) ?? 0);
    return sum;
  };

  function observe(next) {
    let entry;
    if (next?.readable === true) {
      const totals = sessionTotals(next.sessions);
      const decreased = [];
      for (const [id, tokens] of totals) {
        const seen = highest.get(id) ?? base.get(id) ?? 0;
        if (tokens < seen) decreased.push(id);
        else highest.set(id, tokens);
      }
      const previous = cumulative;
      cumulative = total();
      const increment = cumulative - previous;
      maxIncrement = Math.max(maxIncrement, increment);
      entry = { at: next.at, readable: true, cumulative, increment, maxIncrement, sessionsCounted: highest.size, decreased };
      if (!trip && cumulative >= budget) {
        trip = { reason: 'budget-reached', at: next.at, cumulative, maxIncrement, projected: cumulative };
      } else if (!trip && cumulative + maxIncrement > budget) {
        trip = { reason: 'projected-exceed', at: next.at, cumulative, maxIncrement, projected: cumulative + maxIncrement };
      }
    } else {
      const error = typeof next?.error === 'string' && next.error ? next.error : 'usage-unreadable';
      entry = { at: next?.at ?? null, readable: false, error, cumulative, increment: null, maxIncrement };
      if (!trip) trip = { reason: 'counter-unreadable', at: entry.at, cumulative, maxIncrement, error };
    }
    readings.push(entry);
    return { ...entry, trip };
  }

  function state() {
    return {
      budget,
      baseline: { at: baseline.at, sessionsSeen: base.size },
      cumulative,
      maxIncrement,
      trip,
      readings: readings.map((entry) => ({ ...entry })),
    };
  }

  return { observe, state };
}

// ---------------------------------------------------------------------------
// Reading the run's usage from the gateway
// ---------------------------------------------------------------------------
//
// The usage source, at openclaw ab5a30ea79b776f149e24b1fccab9e79b0a5d299:
// - sessions.usage.timeseries { key } (operator.read, unadvertised;
//   src/gateway/methods/core-descriptors.ts:370) reads that session's
//   transcript on every call, with no cache (src/gateway/server-methods/
//   usage.ts:681-706 -> src/infra/session-cost-usage-reporting.ts:169-239).
//   Each point is one assistant (or tool) message's recorded usage, and its
//   totalTokens is usage.total or else input+output+cacheRead+cacheWrite
//   (src/infra/session-cost-usage-pricing.ts:130-142). Downsampling to 200
//   points sums buckets, so the sum over points is the session's lifetime
//   total. An assistant message, usage included, is written to the transcript
//   when that model response finishes (src/agents/sessions/
//   agent-session-base.ts:368-412): a reading is current up to the last
//   completed model call.
// - sessions.list (operator.read; core-descriptors.ts:232) names the sessions,
//   with spawnedBy / parentSessionKey linkage (src/gateway/session-utils-row.ts:
//   505-506,649), paged by hasMore / nextOffset (src/gateway/
//   session-utils-list.ts:159-168,214-219).
// Not used, and why:
// - sessions.list inputTokens/outputTokens are the last run's snapshot, which
//   each run overwrites (src/config/sessions/session-entry-usage.ts:30,56-59),
//   and its totalTokens is context occupancy (src/agents/usage.ts:450). Neither
//   can be summed.
// - sessions.usage serves a 30 s result cache and, after a ~100 ms wait, stale
//   per-session summaries (src/gateway/server-methods/usage-cache.ts:4;
//   usage-session-loading.ts:40,153,167).
// What no surface here counts: a compaction's model call (a compaction
// transcript entry carries no usage; packages/agent-core/src/harness/
// types.ts:77-84) and detached internal runs such as a memory flush
// (src/agents/internal-run-usage.ts:11-12).
//
// Scope, so only this run's sessions are charged (each reason sticks once
// given):
// - configured: the configured session key(s) the rows use, matched exactly or,
//   for a bare key such as "main", as agent:<id>:<key>;
// - labelled: absent from the baseline listing, with a label starting "k6 ",
//   which every scenario's sessions.create sets ("k6 <ROW> <nonce>");
// - spawned: spawnedBy or parentSessionKey names an in-scope session (delegate
//   children, transitively; src/agents/subagents/spawn/
//   subagent-spawn-session-patch.ts:146-158);
// - new-since-baseline: any other session absent from the baseline listing.
//   The harness cannot prove such a session is not the run's, so it is
//   counted; on a dedicated proof gateway there are none.
// A session already listed at the baseline is never read unless it is
// configured or descends from an in-scope session. That includes earlier
// runs' "k6 " sessions: every disposable key carries a fresh nonce, so they
// are never this run's, and re-reading them every poll would only load the
// gateway. sessions.list itself never lists cron runs, global/unknown,
// archived or phantom sessions (src/gateway/session-list-filters.ts:467-486),
// nor internal-effects sessions (session-accessor.sqlite-entry-list.read.ts:
// 231); those are not counted.
//
// A session that leaves the listing (sessions.delete, subagent
// cleanup="delete", or a reset that gives the key a new session id) is read
// once more by agent:<agentId>:<sessionId>. With no store entry that key
// resolves to the newest <sessionId>.jsonl.deleted.* or .reset.* archive
// (src/gateway/server-methods/usage-session-selection.ts:72-95 ->
// src/infra/session-cost-usage-reporting.ts:545-588); sessions.delete archives
// by default (src/gateway/server-methods/sessions-delete.ts:189,482). The turns
// it ran after the last poll are counted that way, and the meter lists the
// sessions about once a second between readings (discover()), keeping every
// (key, session id) it sees, so a session created and deleted between two
// readings is usually read the same way. A session that lives less than a
// discovery interval, or that is created after a reading's listing and deleted
// before the next listing (none runs during a reading), can still be missed.
// If that read fails, or a session only a listing saw has no archive, the
// reading is unreadable. This archive path is traced in code at
// ab5a (including the SQLite store's zstd .deleted export,
// src/config/sessions/session-accessor.sqlite-archive-artifact.ts:117-139), not
// exercised against a live gateway. An incognito session is deleted with no
// archive (sessions-delete.ts:482,493), so one seen with usage that is then
// deleted stops the run as unreadable.

export const DISPOSABLE_SESSION_LABEL_PREFIX = 'k6 ';
export const SCOPE_REASONS = Object.freeze(['configured', 'labelled', 'spawned', 'new-since-baseline']);
const DEFAULT_LIST_PAGE = 500;
const MAX_LIST_PAGES = 200;
const MISSING_TRANSCRIPT = /^No transcript found for session: /u;
const AGENT_KEY = /^agent:([^:]+):/u;

const nonNegative = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/**
 * The cumulative tokens in one sessions.usage.timeseries payload: per point,
 * the larger of totalTokens and the sum of its components, rounded up.
 */
export function timeseriesTokens(payload) {
  if (!payload || typeof payload !== 'object' || typeof payload.sessionId !== 'string' || !payload.sessionId || !Array.isArray(payload.points)) {
    return { ok: false, reason: 'timeseries payload has no sessionId and points list' };
  }
  let tokens = 0;
  for (const entry of payload.points) {
    const parts = ['input', 'output', 'cacheRead', 'cacheWrite'].map((name) => entry?.[name] ?? 0);
    if (!nonNegative(entry?.totalTokens) || !parts.every(nonNegative)) {
      return { ok: false, reason: 'timeseries point has a missing or negative token count' };
    }
    tokens += Math.max(entry.totalTokens, parts.reduce((sum, part) => sum + part, 0));
  }
  const rounded = Math.ceil(tokens);
  return Number.isSafeInteger(rounded) ? { ok: true, sessionId: payload.sessionId, tokens: rounded } : { ok: false, reason: 'timeseries total is out of range' };
}

/** The product's answer for a session that has no transcript yet (usage.ts:695-701). */
export function isMissingTranscriptError(error) {
  return error?.code === 'INVALID_REQUEST' && typeof error.message === 'string' && MISSING_TRANSCRIPT.test(error.message);
}

function rpcFailure(method, error) {
  const code = typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/u.test(error.code) ? error.code : 'ERROR';
  return `${method}:${code}`;
}

function agentIdOf(key) {
  return AGENT_KEY.exec(key)?.[1] ?? null;
}

/** The public form of an accounting id: a 12-hex hash, never the key or session id. */
export function publicId(accountingId) {
  return createHash('sha256').update(accountingId).digest('hex').slice(0, 12);
}

/**
 * The meter's reading cycle. `rpc(method, params)` resolves to
 * { ok: true, payload } or { ok: false, error } and may throw (closed socket,
 * timeout). baseline() must be readable before read() or discover() is used.
 *
 * - read() is one usage reading: list, scope, a timeseries read for every
 *   in-scope session, and an archive read for each in-scope session that has
 *   left the listing.
 * - discover() only lists and scopes. The meter runs it between readings, so a
 *   session that is created and deleted between two readings is still seen;
 *   the next read() reads its archive.
 */
export function createUsageMeter({
  rpc,
  configuredKeys = [],
  now = () => new Date().toISOString(),
  pageSize = DEFAULT_LIST_PAGE,
}) {
  const configured = configuredKeys.filter((key) => typeof key === 'string' && key);
  const scopeReason = new Map(); // session key -> reason
  // Every in-scope (key, session id) any listing showed, until it is read or
  // found gone: key + "\0" + session id -> { key, agentId, sessionId, reason }.
  const seen = new Map();
  const seenKey = (key, sessionId) => `${key}\0${sessionId ?? ''}`;
  const sessions = new Map(); // accounting id -> { agentId, sessionId, reason, baselineTokens, lastTokens, everPositive, closed, placeholder }
  let baselineKeys = null;
  let baselineRows = null;

  // A configured key matches its row exactly, or, when it is bare ("main"),
  // any agent-scoped row agent:<id>:<key>: sessions.list answers canonical keys.
  const matchesConfigured = (key, wanted) => key === wanted
    || (!wanted.startsWith('agent:') && agentIdOf(key) !== null && key === `agent:${agentIdOf(key)}:${wanted}`);
  const isConfigured = (key) => configured.some((wanted) => matchesConfigured(key, wanted));

  async function call(method, params) {
    const answer = await rpc(method, params);
    if (!answer || typeof answer !== 'object') throw new Error(`${method}:no-answer`);
    return answer;
  }

  async function listAll() {
    const rows = [];
    let offset = 0;
    for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
      const answer = await call('sessions.list', { limit: pageSize, ...(offset ? { offset } : {}) });
      if (answer.ok !== true) throw new Error(rpcFailure('sessions-list', answer.error));
      const payload = answer.payload;
      if (!payload || !Array.isArray(payload.sessions) || typeof payload.hasMore !== 'boolean') {
        throw new Error('sessions-list:malformed');
      }
      rows.push(...payload.sessions.filter((row) => row && typeof row.key === 'string' && row.key));
      if (!payload.hasMore) return rows;
      if (!Number.isInteger(payload.nextOffset) || payload.nextOffset <= offset) throw new Error('sessions-list:no-next-offset');
      offset = payload.nextOffset;
    }
    throw new Error('sessions-list:too-many-pages');
  }

  function classify(rows) {
    let priorRunLabelled = 0;
    for (const row of rows) {
      if (scopeReason.has(row.key)) continue;
      const labelled = typeof row.label === 'string' && row.label.startsWith(DISPOSABLE_SESSION_LABEL_PREFIX);
      // A labelled session that was already listed at the baseline is an earlier
      // run's: every scenario's disposable key carries a fresh nonce.
      const preExisting = baselineKeys === null || baselineKeys.has(row.key);
      if (isConfigured(row.key)) scopeReason.set(row.key, 'configured');
      else if (labelled && !preExisting) scopeReason.set(row.key, 'labelled');
      else if (labelled) priorRunLabelled += 1;
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (const row of rows) {
        if (scopeReason.has(row.key)) continue;
        if ([row.spawnedBy, row.parentSessionKey].some((owner) => typeof owner === 'string' && scopeReason.has(owner))) {
          scopeReason.set(row.key, 'spawned');
          changed = true;
        }
      }
    }
    if (baselineKeys) {
      for (const row of rows) {
        if (!scopeReason.has(row.key) && !baselineKeys.has(row.key)) scopeReason.set(row.key, 'new-since-baseline');
      }
    }
    const inScope = rows.filter((row) => scopeReason.has(row.key));
    const byReason = {};
    for (const row of inScope) {
      const reason = scopeReason.get(row.key);
      byReason[reason] = (byReason[reason] ?? 0) + 1;
      const sessionId = typeof row.sessionId === 'string' && row.sessionId ? row.sessionId : null;
      // A row that now has its session id supersedes its earlier id-less listing.
      if (sessionId) seen.delete(seenKey(row.key, null));
      seen.set(seenKey(row.key, sessionId), { key: row.key, agentId: agentIdOf(row.key), sessionId, reason });
    }
    return { inScope, scope: { sessionsListed: rows.length, sessionsInScope: inScope.length, byReason, priorRunLabelled } };
  }

  // Reads one timeseries. Resolves to { sessionId, tokens } or { missing: true }; throws otherwise.
  async function readUsage(key) {
    const answer = await call('sessions.usage.timeseries', { key });
    if (answer.ok !== true) {
      if (isMissingTranscriptError(answer.error)) return { missing: true };
      throw new Error(rpcFailure('sessions-usage-timeseries', answer.error));
    }
    const parsed = timeseriesTokens(answer.payload);
    if (!parsed.ok) throw new Error('sessions-usage-timeseries:malformed');
    return parsed;
  }

  function record(agentId, sessionId, reason, tokens, { asBaseline, placeholder = false }) {
    const id = `${agentId ?? '?'}:${sessionId}`;
    let entry = sessions.get(id);
    if (!entry) {
      entry = { agentId, sessionId, reason, baselineTokens: asBaseline ? tokens : 0, lastTokens: tokens, everPositive: false, closed: false, placeholder };
      sessions.set(id, entry);
    }
    entry.lastTokens = tokens;
    if (tokens > 0) entry.everPositive = true;
    return id;
  }

  async function closeVanished(id, entry, reading) {
    // Listed with no session id and no transcript: nothing was recorded under
    // this placeholder, and there is no archive to read.
    if (entry.placeholder && !entry.everPositive) {
      entry.closed = true;
      return;
    }
    if (!entry.agentId) throw new Error('vanished-session-archive:no-agent-id');
    const usage = await readUsage(`agent:${entry.agentId}:${entry.sessionId}`).catch((error) => {
      throw new Error(`vanished-session-archive:${error.message}`);
    });
    // No archive: harmless only for a session read before and never seen with
    // usage. One only a discovery saw has unknown consumption.
    if (usage.missing && (entry.everPositive || entry.discoveredOnly)) throw new Error('vanished-session-archive:missing');
    entry.closed = true;
    if (!usage.missing) entry.lastTokens = usage.tokens;
    reading[id] = entry.lastTokens;
  }

  async function cycle({ asBaseline }) {
    const at = now();
    try {
      const rows = await listAll();
      if (asBaseline) {
        baselineKeys = new Set(rows.map((row) => row.key));
        baselineRows = rows.map((row) => ({ key: row.key, sessionId: typeof row.sessionId === 'string' && row.sessionId ? row.sessionId : null }));
      }
      const { inScope, scope } = classify(rows);
      // A bare configured key ("main") resolves through the gateway's own main
      // key or global scope, which this meter cannot see. One that matches no
      // listed session at the baseline is refused rather than left uncounted.
      if (asBaseline) {
        const unresolved = configured.filter((wanted) => !wanted.startsWith('agent:') && !rows.some((row) => matchesConfigured(row.key, wanted)));
        if (unresolved.length) throw new Error('configured-session-unresolved: pass the configured session as agent:<id>:<key>');
      }
      const reading = {};
      const live = new Set();
      for (const row of inScope) {
        const agentId = agentIdOf(row.key);
        const usage = await readUsage(row.key);
        const listedId = typeof row.sessionId === 'string' && row.sessionId ? row.sessionId : null;
        const sessionId = usage.missing ? (listedId ?? `key:${row.key}`) : usage.sessionId;
        const id = record(agentId, sessionId, scopeReason.get(row.key), usage.missing ? 0 : usage.tokens, {
          asBaseline,
          placeholder: usage.missing && !listedId,
        });
        live.add(id);
        reading[id] = sessions.get(id).lastTokens;
      }
      if (!asBaseline) {
        for (const [id, entry] of sessions) {
          if (entry.closed || live.has(id)) continue;
          await closeVanished(id, entry, reading);
        }
        // Seen by a listing (a discovery, typically) but gone before any
        // reading read it: a session created and deleted between readings, or
        // a session id a key held between two resets.
        const listedKeys = new Set(rows.map((row) => row.key));
        const listed = new Set(rows.map((row) => seenKey(row.key, typeof row.sessionId === 'string' && row.sessionId ? row.sessionId : null)));
        for (const [entryKey, found] of seen) {
          if (listed.has(entryKey)) continue;
          seen.delete(entryKey);
          if (!found.sessionId) {
            if (listedKeys.has(found.key)) continue;
            throw new Error('vanished-session-archive:no-session-id');
          }
          const id = `${found.agentId ?? '?'}:${found.sessionId}`;
          if (sessions.has(id)) continue;
          const entry = { agentId: found.agentId, sessionId: found.sessionId, reason: found.reason, baselineTokens: 0, lastTokens: 0, everPositive: false, closed: false, placeholder: false, discoveredOnly: true };
          sessions.set(id, entry);
          await closeVanished(id, entry, reading);
        }
      }
      return { at, readable: true, sessions: reading, scope };
    } catch (error) {
      return { at, readable: false, error: String(error?.message || error).slice(0, 200) };
    }
  }

  let baselineTaken = false;
  return {
    async baseline() {
      const reading = await cycle({ asBaseline: true });
      baselineTaken = reading.readable;
      return reading;
    },
    async read() {
      if (!baselineTaken) throw new Error('read() needs a readable baseline first');
      return cycle({ asBaseline: false });
    },
    async discover() {
      if (!baselineTaken) throw new Error('discover() needs a readable baseline first');
      const at = now();
      try {
        const { scope } = classify(await listAll());
        return { at, readable: true, scope };
      } catch (error) {
        return { at, readable: false, error: String(error?.message || error).slice(0, 200) };
      }
    },
    /**
     * Every session the baseline listing showed, key and session id. Private:
     * the token budget's cutoff (lib/token-budget-cutoff.mjs) never aborts a
     * session that existed before the run, and reads this to know which.
     */
    baselineSessions() {
      if (!baselineTaken || !baselineRows) throw new Error('baselineSessions() needs a readable baseline first');
      return baselineRows.map((row) => ({ ...row }));
    },
    /** Per-session facts safe to publish: a 12-hex id hash, never a key or session id. */
    publicSessions() {
      return [...sessions].map(([id, entry]) => ({
        id: publicId(id),
        reason: entry.reason,
        baselineTokens: entry.baselineTokens,
        lastTokens: entry.lastTokens,
        state: entry.closed ? 'closed' : 'live',
      }));
    },
  };
}
