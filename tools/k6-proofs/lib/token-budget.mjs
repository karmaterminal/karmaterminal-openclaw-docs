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

export const TOKEN_BUDGET_ENV = 'OPENCLAW_PROOFS_TOKEN_BUDGET';
export const TOKEN_BUDGET_POLL_ENV = 'OPENCLAW_PROOFS_TOKEN_BUDGET_POLL_SECONDS';
// The overshoot is bounded by one poll interval of usage, so the interval is
// fixed for live runs. The variable exists so fixtures can poll faster.
export const DEFAULT_TOKEN_BUDGET_POLL_SECONDS = 5;
const MIN_POLL_SECONDS = 0.05;
const MAX_POLL_SECONDS = 60;
const POLL_SECONDS = /^\d+(?:\.\d{1,3})?$/u;
const BUDGET = /^[1-9]\d*$/u;

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
      `invalid token budget: set ${TOKEN_BUDGET_ENV} (or --token-budget) to a positive whole number of tokens ` +
      'with no sign, separators, exponent or surrounding spaces, or leave it empty for no budget',
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
