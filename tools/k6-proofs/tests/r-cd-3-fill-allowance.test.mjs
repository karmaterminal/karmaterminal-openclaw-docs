// R-CD-3 fill allowance: the budget and turn arithmetic behind
// r-cd-3-fill-window.test.mjs, and the override parsing the scenario uses.
// This file imports the helpers added with the window-sized budget, so unlike
// that file it does not load on the pre-fix tree.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTEXT_WINDOW_UNKNOWN_REASON,
  DEFAULT_FILL_TARGET,
  FILL_BUDGET_CEILING_TOKENS,
  FILL_MAX_TURNS_CEILING,
  FILL_MIN_TURNS,
  fillBudgetForWindow,
  fillOverrideFromEnv,
  fillTurnsForBudget,
  resolveFillAllowance,
} from '../lib/r-cd-3-lifeboat.mjs';

test('the budget is what the plan aims at: (target + 2%) of the window', () => {
  assert.equal(fillBudgetForWindow(922_000), 709_940);
  assert.equal(fillBudgetForWindow(200_000), 154_000);
  assert.equal(fillBudgetForWindow(1_048_576), 807_404);
  assert.equal(fillBudgetForWindow(200_000, 0.8), 164_000);
});

test('the turn allowance covers the budget in the largest chunks at the lowest rate, with a six-turn floor', () => {
  assert.equal(fillTurnsForBudget(709_940), 10);
  assert.equal(fillTurnsForBudget(154_000), FILL_MIN_TURNS);
  assert.equal(fillTurnsForBudget(1), FILL_MIN_TURNS);
});

test('the turn allowance follows a measured filler rate below 0.2 tokens per character, never one above it', () => {
  assert.equal(fillTurnsForBudget(709_940, 0.14), 13);
  assert.equal(fillTurnsForBudget(709_940, 0.3), 10);
  assert.equal(fillTurnsForBudget(709_940, 0), 10);
  assert.equal(fillTurnsForBudget(709_940, Number.NaN), 10);
});

test('a hard turn ceiling bounds a turn allowance derived from any rate', () => {
  assert.equal(FILL_MAX_TURNS_CEILING, 20);
  assert.equal(fillTurnsForBudget(709_940, 0.001), FILL_MAX_TURNS_CEILING);
  assert.equal(fillTurnsForBudget(5_000_000), FILL_MAX_TURNS_CEILING);
  assert.equal(resolveFillAllowance({ contextTokens: 922_000, tokensPerChar: 0.001 }).maxTurns, FILL_MAX_TURNS_CEILING);
  // An explicit turn count is the operator's own bound.
  assert.equal(resolveFillAllowance({ contextTokens: 922_000, maxTurns: 30 }).maxTurns, 30);
});

test('the hard ceiling also bounds the turns a window-derived budget can buy', () => {
  assert.equal(fillTurnsForBudget(FILL_BUDGET_CEILING_TOKENS), 13);
  // The largest window under the ceiling at the default target.
  const largest = Math.floor(FILL_BUDGET_CEILING_TOKENS / (DEFAULT_FILL_TARGET + 0.02));
  const allowance = resolveFillAllowance({ contextTokens: largest });
  assert.equal(allowance.ok, true);
  assert.ok(allowance.maxTurns <= 13);
  assert.equal(resolveFillAllowance({ contextTokens: largest + 1 }).ok, false);
});

test('allowance: a measured window sizes both budgets', () => {
  assert.deepEqual(resolveFillAllowance({ contextTokens: 922_000 }), {
    ok: true,
    reason: null,
    budgetTokens: 709_940,
    budgetSource: 'context-window',
    maxTurns: 10,
    maxTurnsSource: 'budget',
    ceilingTokens: FILL_BUDGET_CEILING_TOKENS,
  });
});

test('allowance: an unknown window refuses, whatever is overridden', () => {
  for (const contextTokens of [undefined, null, 0, -1, Number.NaN, '922000']) {
    const allowance = resolveFillAllowance({ contextTokens, budgetTokens: 500_000, maxTurns: 8 });
    assert.equal(allowance.ok, false, String(contextTokens));
    assert.equal(allowance.reason, CONTEXT_WINDOW_UNKNOWN_REASON);
    assert.equal(allowance.budgetTokens, null);
  }
});

test('allowance: a window-derived budget over the ceiling refuses and names the override', () => {
  const allowance = resolveFillAllowance({ contextTokens: 2_000_000 });
  assert.equal(allowance.ok, false);
  assert.match(allowance.reason, /needs a fill budget of about 1540000 tokens, over the 1000000-token hard ceiling/);
  assert.match(allowance.reason, /OPENCLAW_RCD3_FILL_BUDGET_TOKENS/);
  assert.equal(allowance.maxTurns, null);
});

test('allowance: an explicit budget wins either way and is not held to the ceiling', () => {
  const below = resolveFillAllowance({ contextTokens: 922_000, budgetTokens: 300_000 });
  assert.equal(below.budgetTokens, 300_000);
  assert.equal(below.budgetSource, 'override');
  assert.equal(below.maxTurns, FILL_MIN_TURNS);
  const above = resolveFillAllowance({ contextTokens: 2_000_000, budgetTokens: 1_600_000 });
  assert.equal(above.ok, true);
  assert.equal(above.budgetTokens, 1_600_000);
  assert.equal(above.maxTurns, fillTurnsForBudget(1_600_000));
});

test('allowance: an explicit turn count wins over the budget-derived one', () => {
  const allowance = resolveFillAllowance({ contextTokens: 922_000, maxTurns: 3 });
  assert.equal(allowance.maxTurns, 3);
  assert.equal(allowance.maxTurnsSource, 'override');
  assert.equal(allowance.budgetSource, 'context-window');
});

test('overrides: unset or empty follows the window; a positive whole number wins', () => {
  assert.deepEqual(fillOverrideFromEnv({}, 'X'), { value: null, error: null });
  assert.deepEqual(fillOverrideFromEnv({ X: '' }, 'X'), { value: null, error: null });
  assert.deepEqual(fillOverrideFromEnv({ X: '  ' }, 'X'), { value: null, error: null });
  assert.deepEqual(fillOverrideFromEnv({ X: '300000' }, 'X'), { value: 300_000, error: null });
  assert.deepEqual(fillOverrideFromEnv({ X: ' 12 ' }, 'X'), { value: 12, error: null });
  assert.deepEqual(fillOverrideFromEnv({ X: '0012' }, 'X'), { value: 12, error: null });
  assert.deepEqual(fillOverrideFromEnv(undefined, 'X'), { value: null, error: null });
});

test('overrides: anything else is an error naming the variable, never a silent fallback', () => {
  for (const raw of ['300k', '0', '000', '-1', '+5', '1.5', 'NaN', 'Infinity', '1e400', '1e6', '0x10', '0b11', '0o7', '1_000', '9007199254740993', 'true']) {
    const parsed = fillOverrideFromEnv({ OPENCLAW_RCD3_FILL_BUDGET_TOKENS: raw }, 'OPENCLAW_RCD3_FILL_BUDGET_TOKENS');
    assert.equal(parsed.value, null, raw);
    assert.match(parsed.error, /^OPENCLAW_RCD3_FILL_BUDGET_TOKENS=".*" is not a positive whole number/, raw);
  }
});
