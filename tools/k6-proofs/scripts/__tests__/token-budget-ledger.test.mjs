// The token-budget ledger: the arithmetic a budgeted proof run stops on.
//
// 🌊 ruled (Discord 1573082087307616310) that the single live rerun at
// ab5a30ea stays on hold until a harness-side counter aborts at a hard token
// bound (🕯's 3.2M), because neither the seat nor the model route can enforce
// one (🕯 1573081925374181397). The ledger turns per-session usage readings
// into the run's cumulative consumption and decides when to stop. These tests
// pin its rules with no gateway: the input format, the stop conditions, and the
// accounting rules that keep it from under-counting.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUDGET_TRIP_REASONS,
  createBudgetLedger,
  parseTokenBudget,
  tokenBudgetPollMs,
  DEFAULT_TOKEN_BUDGET_POLL_SECONDS,
} from '../../lib/token-budget.mjs';

const at = (second) => new Date(Date.UTC(2026, 10, 19, 12, 0, second)).toISOString();
const reading = (second, sessions) => ({ at: at(second), readable: true, sessions });

test('an empty or absent budget disables enforcement; only a positive decimal integer enables it', () => {
  assert.deepEqual(parseTokenBudget(undefined), { enabled: false, budget: null });
  assert.deepEqual(parseTokenBudget(''), { enabled: false, budget: null });
  assert.deepEqual(parseTokenBudget('3200000'), { enabled: true, budget: 3_200_000 });
  assert.deepEqual(parseTokenBudget('1'), { enabled: true, budget: 1 });
  for (const bad of ['0', '-1', '1.5', '1e6', ' 12', '12 ', '012', 'abc', '3,200,000', '9007199254740993', ' ']) {
    assert.throws(() => parseTokenBudget(bad), /token budget/u, `${JSON.stringify(bad)} must be refused, not read as some budget`);
  }
});

test('the poll interval is fixed unless a test overrides it with a bounded value', () => {
  assert.equal(tokenBudgetPollMs({}), DEFAULT_TOKEN_BUDGET_POLL_SECONDS * 1000);
  assert.equal(tokenBudgetPollMs({ OPENCLAW_PROOFS_TOKEN_BUDGET_POLL_SECONDS: '' }), DEFAULT_TOKEN_BUDGET_POLL_SECONDS * 1000);
  assert.equal(tokenBudgetPollMs({ OPENCLAW_PROOFS_TOKEN_BUDGET_POLL_SECONDS: '0.25' }), 250);
  for (const bad of ['0', '-1', 'abc', '61', '0.01', '5000']) {
    assert.throws(() => tokenBudgetPollMs({ OPENCLAW_PROOFS_TOKEN_BUDGET_POLL_SECONDS: bad }), /OPENCLAW_PROOFS_TOKEN_BUDGET_POLL_SECONDS/u);
  }
});

test('a run under its budget never trips, and cumulative counts only growth since the baseline', () => {
  const ledger = createBudgetLedger({ budget: 1000, baseline: reading(0, { old: 5000, live: 100 }) });
  assert.equal(ledger.observe(reading(5, { old: 5000, live: 150 })).trip, null);
  const last = ledger.observe(reading(10, { old: 5000, live: 200, fresh: 50 }));
  assert.equal(last.cumulative, 150, 'pre-run usage is never charged to the run');
  assert.equal(last.increment, 100);
  assert.equal(last.maxIncrement, 100);
  assert.equal(last.trip, null);
  assert.equal(ledger.state().trip, null);
});

test('cumulative reaching the budget trips budget-reached', () => {
  const ledger = createBudgetLedger({ budget: 300, baseline: reading(0, {}) });
  ledger.observe(reading(5, { a: 100 }));
  ledger.observe(reading(10, { a: 200 }));
  const tripped = ledger.observe(reading(15, { a: 300 }));
  assert.equal(tripped.trip?.reason, 'budget-reached');
  assert.equal(tripped.trip.cumulative, 300);
  assert.equal(tripped.trip.at, at(15));
});

test('the largest increment seen so far stops the run before the next poll could cross the budget', () => {
  const ledger = createBudgetLedger({ budget: 1000, baseline: reading(0, {}) });
  assert.equal(ledger.observe(reading(5, { a: 400 })).trip, null, '400 + 400 is not over 1000');
  const tripped = ledger.observe(reading(10, { a: 650 }));
  assert.equal(tripped.cumulative, 650);
  assert.equal(tripped.maxIncrement, 400);
  assert.equal(tripped.trip?.reason, 'projected-exceed', '650 + the 400 already seen in one poll would exceed 1000');
  assert.equal(tripped.trip.projected, 1050);
});

test('the first poll is measured from the baseline, so one large first jump sets the margin', () => {
  const ledger = createBudgetLedger({ budget: 1000, baseline: reading(0, { a: 10 }) });
  const first = ledger.observe(reading(5, { a: 610 }));
  assert.equal(first.increment, 600);
  assert.equal(first.trip?.reason, 'projected-exceed');
});

test('a session that disappears keeps what it was seen to consume', () => {
  const ledger = createBudgetLedger({ budget: 10_000, baseline: reading(0, {}) });
  ledger.observe(reading(5, { child: 700, parent: 100 }));
  const after = ledger.observe(reading(10, { parent: 150 }));
  assert.equal(after.cumulative, 850, 'a deleted child must not refund its tokens');
});

test('a counter that goes down never lowers the cumulative total', () => {
  const ledger = createBudgetLedger({ budget: 10_000, baseline: reading(0, { a: 100 }) });
  ledger.observe(reading(5, { a: 600 }));
  const after = ledger.observe(reading(10, { a: 50 }));
  assert.equal(after.cumulative, 500);
  assert.equal(after.increment, 0);
  assert.deepEqual(after.decreased, ['a']);
});

test('an unreadable counter trips counter-unreadable, and the trip stays latched', () => {
  const ledger = createBudgetLedger({ budget: 1000, baseline: reading(0, {}) });
  ledger.observe(reading(5, { a: 100 }));
  const failed = ledger.observe({ at: at(10), readable: false, error: 'gateway-rpc-timeout' });
  assert.equal(failed.trip?.reason, 'counter-unreadable');
  assert.equal(failed.trip.error, 'gateway-rpc-timeout');
  assert.equal(failed.cumulative, 100, 'the last good total stands');
  const later = ledger.observe(reading(15, { a: 120 }));
  assert.equal(later.trip?.reason, 'counter-unreadable', 'a recovered counter does not re-arm a stopped run');
  assert.equal(later.cumulative, 120, 'readings after the trip still record what was consumed');
});

test('every reading, trip or not, is kept in order for the receipt', () => {
  const ledger = createBudgetLedger({ budget: 100, baseline: reading(0, {}) });
  ledger.observe(reading(5, { a: 60 }));
  ledger.observe({ at: at(10), readable: false, error: 'gateway-closed' });
  const state = ledger.state();
  assert.equal(state.budget, 100);
  assert.equal(state.baseline.at, at(0));
  assert.deepEqual(state.readings.map((entry) => [entry.at, entry.readable, entry.cumulative]), [
    [at(5), true, 60],
    [at(10), false, 60],
  ]);
  assert.equal(state.trip.reason, 'projected-exceed', 'the first trip wins; a later unreadable reading does not replace it');
  assert.deepEqual([...BUDGET_TRIP_REASONS].sort(), ['budget-reached', 'counter-unreadable', 'projected-exceed']);
});

test('a ledger refuses an unreadable baseline: an unreadable start is never budget zero', () => {
  assert.throws(() => createBudgetLedger({ budget: 100, baseline: { at: at(0), readable: false, error: 'x' } }), /baseline/u);
  assert.throws(() => createBudgetLedger({ budget: 0, baseline: reading(0, {}) }), /budget/u);
});
